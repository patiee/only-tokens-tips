package server

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
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
		RedirectURL:  "http://localhost:8080/auth/google/callback",
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
		RedirectURL:  "http://localhost:8080/auth/twitch/callback",
		Scopes:       []string{"user:read:email"},
		Endpoint:     twitch.Endpoint,
	}

	// Kick
	kickConfig = &oauth2.Config{
		ClientID:     s.config.KickClientID,
		ClientSecret: s.config.KickClientSecret,
		RedirectURL:  "http://localhost:8080/auth/kick/callback",
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

	url := config.AuthCodeURL(oauthState)
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
		// New User -> Signup Flow
		// Generate verified Signup Token
		signupToken, err := s.GenerateSignupToken(provider, userProfile.ID, userProfile.Email, userProfile.Avatar)
		if err != nil {
			s.logger.Printf("Failed to generate signup token: %v", err)
			c.Redirect(http.StatusTemporaryRedirect, "http://localhost:3000/signup?error=token_err")
			return
		}
		c.Redirect(http.StatusTemporaryRedirect, fmt.Sprintf("http://localhost:3000/signup?step=2&signup_token=%s", signupToken))
	}
}

type UserProfile struct {
	ID     string
	Email  string
	Name   string
	Avatar string
}

func (s *Server) fetchUserProfile(provider, accessToken string, logger interface{}) (*UserProfile, error) {
	var user UserProfile
	client := &http.Client{}

	switch provider {
	case "google":
		resp, err := client.Get("https://www.googleapis.com/oauth2/v2/userinfo?access_token=" + accessToken)
		if err != nil {
			return nil, err
		}
		defer resp.Body.Close()
		var googleUser struct {
			Id      string `json:"id"`
			Email   string `json:"email"`
			Name    string `json:"name"`
			Picture string `json:"picture"`
		}
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
		var twitchResp struct {
			Data []struct {
				ID              string `json:"id"`
				Email           string `json:"email"`
				DisplayName     string `json:"display_name"`
				ProfileImageUrl string `json:"profile_image_url"`
			} `json:"data"`
		}
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
		var kickUser struct {
			ID         json.Number `json:"id"`    // integer specific
			Email      string      `json:"email"` // Might not be available
			Username   string      `json:"username"`
			ProfilePic string      `json:"profile_pic"`
		}
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
