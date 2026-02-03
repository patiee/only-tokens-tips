package server

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	dbmodel "github.com/patiee/backend/db/model"
	"github.com/patiee/backend/server/model"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"golang.org/x/oauth2/twitch"
)

var (
	googleConfig *oauth2.Config
	twitchConfig *oauth2.Config
	kickConfig   *oauth2.Config
	oauthState   = "random-string-verification" // In prod, use random state per request
)

func (s *Server) InitOAuth() {
	// Google
	googleConfig = &oauth2.Config{
		ClientID:     s.config.GoogleClientID,
		ClientSecret: s.config.GoogleClientSecret,
		RedirectURL:  "https://localhost:8080/auth/google/callback",
		Scopes: []string{
			"https://www.googleapis.com/auth/userinfo.email",
			"https://www.googleapis.com/auth/userinfo.profile",
		},
		Endpoint: google.Endpoint,
	}

	// Twitch
	twitchConfig = &oauth2.Config{
		ClientID:     s.config.TwitchClientID,
		ClientSecret: s.config.TwitchClientSecret,
		RedirectURL:  "https://localhost:8080/auth/twitch/callback",
		Scopes:       []string{"user:read:email"},
		Endpoint:     twitch.Endpoint,
	}

	// Kick
	kickConfig = &oauth2.Config{
		ClientID:     s.config.KickClientID,
		ClientSecret: s.config.KickClientSecret,
		RedirectURL:  "https://localhost:8080/auth/kick/callback",
		Scopes:       []string{"user:read"}, // Verify scope in Kick docs
		Endpoint: oauth2.Endpoint{
			AuthURL:  "https://id.kick.com/oauth/authorize", // Verify this
			TokenURL: "https://id.kick.com/oauth/token",     // Verify this
		},
	}
}

func (s *Server) HandleOAuthLogin(c *gin.Context) {
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

func (s *Server) HandleOAuthCallback(c *gin.Context) {
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
	existingUser, err := s.db.GetUserByProviderID(provider, userProfile.ID)

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
		if err := s.db.CreateUser(&newUser); err != nil {
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

func (s *Server) fetchUserProfile(provider, accessToken string, logger interface{}) (*model.UserProfile, error) {
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
