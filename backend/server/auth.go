package server

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/crypto"
	"github.com/gin-gonic/gin"
	dbmodel "github.com/patiee/backend/db/model"
	"github.com/patiee/backend/server/model"
	"golang.org/x/oauth2"
)

func (s *Service) HandleOAuthLogin(c *gin.Context) {
	provider := c.Param("provider")
	var config *oauth2.Config

	switch provider {
	case "google":
		config = googleConfig
	case "twitch":
		config = twitchConfig
	case "kick":
		config = kickConfig
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid provider"})
		return
	}

	var authURLOptions []oauth2.AuthCodeOption
	if provider == "google" {
		authURLOptions = append(authURLOptions, oauth2.SetAuthURLParam("prompt", "select_account"))
	}

	url := config.AuthCodeURL(oauthState, authURLOptions...)
	c.Redirect(http.StatusTemporaryRedirect, url)
}

func (s *Service) HandleOAuthCallback(c *gin.Context) {
	provider := c.Param("provider")
	state := c.Query("state")
	code := c.Query("code")

	if state != oauthState {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid state"})
		return
	}

	var config *oauth2.Config
	switch provider {
	case "google":
		config = googleConfig
	case "twitch":
		config = twitchConfig
	case "kick":
		config = kickConfig
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid provider"})
		return
	}

	token, err := config.Exchange(context.Background(), code)
	if err != nil {
		s.logger.Printf("OAuth exchange error: %v", err)
		c.Redirect(http.StatusTemporaryRedirect, "http://localhost:3000/signup?error=oauth_failed")
		return
	}

	userProfile, err := s.fetchUserProfile(provider, token.AccessToken, s.logger)
	if err != nil {
		s.logger.Printf("Failed to fetch profile: %v", err)
		c.Redirect(http.StatusTemporaryRedirect, "http://localhost:3000/signup?error=profile_failed")
		return
	}

	// Check if user exists
	existingUser, err := s.GetUserByProviderID(provider, userProfile.ID)

	// Create/Update Logic
	if err == nil {
		// User exists -> Login
		token, err := s.GenerateSessionToken(existingUser)
		if err != nil {
			s.logger.Printf("Failed to generate session token: %v", err)
			c.Redirect(http.StatusTemporaryRedirect, "http://localhost:3000/signup?error=token_err")
			return
		}
		c.Redirect(http.StatusTemporaryRedirect, fmt.Sprintf("http://localhost:3000/me?token=%s", token))
	} else {
		// New User -> Create immediately with temp username
		// We'll let them change username in step 2
		tempUsername := fmt.Sprintf("user_%s_%s", provider, userProfile.ID)
		if len(tempUsername) > 20 {
			tempUsername = tempUsername[:20] // Truncate if too long
		}

		newUser := dbmodel.User{
			Username:   tempUsername,
			Provider:   provider,
			ProviderID: userProfile.ID,
			Email:      userProfile.Email,
			AvatarURL:  userProfile.Avatar,
			CreatedAt:  time.Now(),
		}

		// Create in DB
		if err := s.CreateUser(&newUser); err != nil {
			s.logger.Printf("Failed to auto-create user: %v", err)
			c.Redirect(http.StatusTemporaryRedirect, "http://localhost:3000/signup?error=create_failed")
			return
		}

		// Generate Session Token
		token, err := s.GenerateSessionToken(&newUser)
		if err != nil {
			s.logger.Printf("Failed to generate session token: %v", err)
			c.Redirect(http.StatusTemporaryRedirect, "http://localhost:3000/signup?error=token_err")
			return
		}

		// Redirect to Signup Step 2 (Update Username) with Session Token
		c.Redirect(http.StatusTemporaryRedirect, fmt.Sprintf("http://localhost:3000/signup?step=2&token=%s", token))
	}
}

func (s *Service) fetchUserProfile(provider, accessToken string, logger interface{}) (*model.UserProfile, error) {
	var user model.UserProfile
	client := &http.Client{}

	switch provider {
	case "google":
		resp, err := client.Get("https://www.googleapis.com/oauth2/v2/userinfo?access_token=" + accessToken)
		if err != nil {
			return nil, err
		}
		defer resp.Body.Close()
		var googleUser model.GoogleUser
		if err := json.NewDecoder(resp.Body).Decode(&googleUser); err != nil {
			return nil, err
		}
		user.ID = googleUser.Id
		user.Email = googleUser.Email
		user.Name = googleUser.Name
		user.Avatar = googleUser.Picture

	case "twitch":
		req, _ := http.NewRequest("GET", "https://api.twitch.tv/helix/users", nil)
		req.Header.Set("Authorization", "Bearer "+accessToken)
		req.Header.Set("Client-Id", s.config.TwitchClientID)
		resp, err := client.Do(req)
		if err != nil {
			return nil, err
		}
		defer resp.Body.Close()
		var twitchResp model.TwitchResp
		if err := json.NewDecoder(resp.Body).Decode(&twitchResp); err != nil {
			return nil, err
		}
		if len(twitchResp.Data) > 0 {
			u := twitchResp.Data[0]
			user.ID = u.ID
			user.Email = u.Email
			user.Name = u.DisplayName
			user.Avatar = u.ProfileImageUrl
		}

	case "kick":
		req, _ := http.NewRequest("GET", "https://api.kick.com/v1/users", nil) // Verify endpoint
		req.Header.Set("Authorization", "Bearer "+accessToken)
		resp, err := client.Do(req)
		if err != nil {
			return nil, err
		}
		defer resp.Body.Close()
		// Assuming generic structure for now
		var kickUser model.KickUser
		if err := json.NewDecoder(resp.Body).Decode(&kickUser); err != nil {
			return nil, err
		}
		user.ID = kickUser.ID.String()
		user.Email = kickUser.Email
		user.Name = kickUser.Username
		user.Avatar = kickUser.ProfilePic
	}

	return &user, nil
}

// Struct for Wallet Login
type WalletLoginRequest struct {
	Address   string `json:"address" binding:"required"`
	Timestamp int64  `json:"timestamp" binding:"required"`
	Signature string `json:"signature" binding:"required"`
}

func (s *Service) HandleWalletLogin(c *gin.Context) {
	var req WalletLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// 1. Verify Timestamp (within 1 hour)
	now := time.Now().Unix()
	if req.Timestamp < now-3600 || req.Timestamp > now+300 { // 1h past, 5m future buffer
		c.JSON(http.StatusBadRequest, gin.H{"error": "Timestamp too old or invalid"})
		return
	}

	// 2. Check Replay Attack (Used Signature)
	if s.IsSignatureUsed(req.Signature) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Signature already used"})
		return
	}

	// 3. Verify Signature
	// Message format must match frontend: `{"address":"%s","timestamp":%d}`
	msg := fmt.Sprintf(`{"address":"%s","timestamp":%d}`, req.Address, req.Timestamp)
	isValid, err := verifySignature(req.Address, msg, req.Signature)
	if err != nil || !isValid {
		s.logger.Printf("Signature verification failed for %s: %v", req.Address, err)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid signature"})
		return
	}

	// 4. Mark Signature as Used
	if err := s.MarkSignatureUsed(req.Signature); err != nil {
		s.logger.Printf("Failed to mark signature used: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	// 5. Generate Session Token
	token, err := s.GenerateWalletToken(req.Address)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"token": token, "expires_in": 86400})
}

// verifySignature checks if the signature matches the address for the given message
// Uses go-ethereum crypto
func verifySignature(address, message, signatureHex string) (bool, error) {
	// 1. Decode Signature (Hex -> Bytes)
	// Remove 0x prefix if present
	if len(signatureHex) > 2 && signatureHex[:2] == "0x" {
		signatureHex = signatureHex[2:]
	}
	sigBytes, err := hex.DecodeString(signatureHex)
	if err != nil {
		return false, fmt.Errorf("invalid hex signature")
	}

	// 2. Handle Signature V recovery ID (it's 27/28 or 0/1 depending on client)
	// Ethereum crypto library expects 0/1
	if len(sigBytes) != 65 {
		return false, fmt.Errorf("invalid signature length")
	}
	if sigBytes[64] >= 27 {
		sigBytes[64] -= 27
	}

	// 3. Hash the Message (EIP-191 personal sign format)
	// prefix = "\x19Ethereum Signed Message:\n" + len(msg)
	prefix := fmt.Sprintf("\x19Ethereum Signed Message:\n%d", len(message))
	data := []byte(prefix + message)
	hash := crypto.Keccak256Hash(data)

	// 4. Recover Public Key
	// We use SigToPub below, which wraps Ecrecover, but for EIP-191 we need to be careful.
	// crypto.SigToPub(hash, sig) does the recovery.

	// 5. Convert Public Key to Address
	// Need to unmarshal the pubkey bytes to ECDSA pubkey then to address
	// Ecrecover returns uncompressed pubkey bytes (65 bytes), first byte is 0x04
	// remove first byte 0x04 (if present in Ecrecover result? Ecrecover returns 65 bytes usually)
	// Actually crypto.UnmarshalPubkey expects it. But crypto.PubkeyToAddress takes *ecdsa.PublicKey.
	// crypto.SigToPub is easier but it does hash internally which we already did? No, SigToPub takes raw hash.
	// Let's use crypto.SigToPub which wraps Ecrecover

	pubKey, err := crypto.SigToPub(hash.Bytes(), sigBytes)
	if err != nil {
		return false, err
	}

	recoveredAddr := crypto.PubkeyToAddress(*pubKey)

	// 6. Compare Addresses (Case insensitive)
	return strings.EqualFold(recoveredAddr.Hex(), address), nil
}
