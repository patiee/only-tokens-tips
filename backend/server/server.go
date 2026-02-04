package server

import (
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/patiee/backend/db"
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

type Config struct {
	GoogleClientID     string
	GoogleClientSecret string
	TwitchClientID     string
	TwitchClientSecret string
	KickClientID       string
	KickClientSecret   string
	JWTSecret          string
	CertFile           string
	KeyFile            string
	CORSEnabled        bool
}

type Server struct {
	config   Config
	logger   *log.Logger
	service  *Service
	upgrader websocket.Upgrader // Upgrader is HTTP specific, keep here
}

func New(logger *log.Logger, database *db.Database, config Config) *Server {
	service := NewService(database, config, logger)
	return &Server{
		config:  config,
		logger:  logger,
		service: service,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true // Allow all origins for OBS
			},
		},
	}
}

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

func (s *Server) Start(port string) {
	// Initialize OAuth
	s.InitOAuth()

	r := gin.Default()

	// CORS configuration
	config := cors.DefaultConfig()

	if s.config.CORSEnabled {
		config.AllowAllOrigins = true
		config.AllowOrigins = nil // Explicitly clear to avoid conflict panic
		s.logger.Println("CORS: Enabling permissive CORS for all origins")
	} else {
		// Always allow both HTTP and HTTPS localhost
		config.AllowOrigins = []string{"http://localhost:3000", "https://localhost:3000", "http://127.0.0.1:3000"}
		s.logger.Println("CORS: Enabling CORS for localhost origins")
	}
	config.AllowHeaders = []string{"Origin", "Content-Length", "Content-Type", "Authorization", "Accept"}
	config.ExposeHeaders = []string{"Content-Length"}
	config.AllowCredentials = true

	r.Use(cors.New(config))

	// WebSocket endpoint for OBS widget
	r.GET("/ws/:streamerId", s.HandleWS)

	// Auth endpoints
	r.POST("/auth/signup", s.HandleSignup)
	r.POST("/auth/login", s.HandleLogin)
	r.GET("/auth/:provider/login", s.service.HandleOAuthLogin)
	r.GET("/auth/:provider/callback", s.service.HandleOAuthCallback)
	r.POST("/auth/wallet-login", s.service.HandleWalletLogin)

	// API endpoints
	r.GET("/api/me", s.HandleMe)
	r.PUT("/api/me/wallet", s.HandleUpdateWallet)
	r.PUT("/api/me/widget", s.HandleUpdateWidget)
	r.GET("/api/user/:username", s.HandleGetUser)
	r.POST("/api/tip", s.HandleTip)
	r.GET("/api/me/tips", s.HandleGetTips)

	// Start Background Cleanup Job (Every 24h)
	go func() {
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			s.logger.Println("Running daily session cleanup...")
			if err := s.service.db.CleanupExpiredSessions(); err != nil {
				s.logger.Printf("Failed to clean expired sessions: %v", err)
			} else {
				s.logger.Println("Daily session cleanup completed.")
			}
		}
	}()

	// Start Background Cleanup Job (Every 24h)
	go func() {
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			s.logger.Println("Running daily session cleanup...")
			if err := s.service.CleanupExpiredSessions(); err != nil {
				s.logger.Printf("Failed to clean expired sessions: %v", err)
			} else {
				s.logger.Println("Daily session cleanup completed.")
			}
		}
	}()

	s.logger.Printf("Server starting on :%s", port)
	if s.config.CertFile != "" && s.config.KeyFile != "" {
		s.logger.Printf("Enabling HTTPS with cert: %s", s.config.CertFile)
		if err := r.RunTLS(":"+port, s.config.CertFile, s.config.KeyFile); err != nil {
			s.logger.Fatalf("Failed to start HTTPS server: %v", err)
		}
	} else {
		r.Run(":" + port)
	}
}

func (s *Server) HandleSignup(c *gin.Context) {
	authHeader := c.GetHeader("Authorization")
	if len(authHeader) < 8 || authHeader[:7] != "Bearer " {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Missing or invalid token"})
		return
	}
	tokenString := authHeader[7:]

	claims, err := s.service.ValidateSessionToken(tokenString)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
		return
	}

	var req model.SignupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if s.service.CheckUsernameTaken(req.Username, claims.UserID) {
		c.JSON(http.StatusConflict, gin.H{"error": "Username already taken"})
		return
	}

	updatedUser, newToken, err := s.service.CompleteUserProfile(claims.UserID, req.Username, req.EthAddress, req.MainWallet)
	if err != nil {
		s.logger.Printf("Failed to complete profile: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update profile"})
		return
	}

	s.logger.Printf("User profile completed: %s", updatedUser.Username)
	c.JSON(http.StatusOK, gin.H{"message": "Profile updated", "user": updatedUser, "token": newToken})
}

func (s *Server) HandleLogin(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "Login endpoint (Mock)"})
}

func (s *Server) HandleMe(c *gin.Context) {
	tokenString := c.Query("token")
	if tokenString == "" {
		authHeader := c.GetHeader("Authorization")
		if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
			tokenString = authHeader[7:]
		}
	}

	if tokenString == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Missing token"})
		return
	}

	claims, err := s.service.ValidateSessionToken(tokenString)
	if err != nil {
		s.logger.Printf("Invalid session token: %v", err)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
		return
	}

	user, err := s.service.GetUserByUsername(claims.Username)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, user)
}

func (s *Server) HandleGetUser(c *gin.Context) {
	username := c.Param("username")
	user, err := s.service.GetUserByUsername(username)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"username":             user.Username,
		"eth_address":          user.EthAddress,
		"widget_tts":           user.WidgetTTS,
		"widget_bg_color":      user.WidgetBgColor,
		"widget_user_color":    user.WidgetUserColor,
		"widget_amount_color":  user.WidgetAmountColor,
		"widget_message_color": user.WidgetMessageColor,
		"avatar_url":           user.AvatarURL,
	})
}

func (s *Server) HandleUpdateWallet(c *gin.Context) {
	authHeader := c.GetHeader("Authorization")
	if len(authHeader) < 8 || authHeader[:7] != "Bearer " {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Missing or invalid token"})
		return
	}
	tokenString := authHeader[7:]

	claims, err := s.service.ValidateSessionToken(tokenString)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
		return
	}

	var req model.UpdateWalletRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	err = s.service.UpdateUserWallet(claims.UserID, req.EthAddress)
	if err != nil {
		s.logger.Printf("Failed to update wallet: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update wallet"})
		return
	}

	s.logger.Printf("User %s updated wallet to %s", claims.Username, req.EthAddress)
	c.JSON(http.StatusOK, gin.H{"message": "Wallet updated", "eth_address": req.EthAddress})
}

func (s *Server) HandleUpdateWidget(c *gin.Context) {
	authHeader := c.GetHeader("Authorization")
	if len(authHeader) < 8 || authHeader[:7] != "Bearer " {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Missing or invalid token"})
		return
	}
	tokenString := authHeader[7:]

	claims, err := s.service.ValidateSessionToken(tokenString)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
		return
	}

	var req model.UpdateWidgetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	err = s.service.UpdateWidgetConfig(claims.UserID, req)
	if err != nil {
		s.logger.Printf("Failed to update widget config: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update widget settings"})
		return
	}

	s.logger.Printf("User %s updated widget config", claims.Username)
	c.JSON(http.StatusOK, gin.H{"message": "Widget settings updated"})
}

func (s *Server) HandleTip(c *gin.Context) {
	authHeader := c.GetHeader("Authorization")
	if len(authHeader) < 8 || authHeader[:7] != "Bearer " {
		s.logger.Println("Tip rejected: Missing Authorization header")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Missing or invalid token"})
		return
	}
	tokenString := authHeader[7:]

	claims, err := s.service.ValidateWalletToken(tokenString)
	if err != nil {
		s.logger.Printf("Tip rejected: Invalid token: %v", err)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid session token"})
		return
	}

	var tip model.TipRequest
	if err := c.ShouldBindJSON(&tip); err != nil {
		s.logger.Printf("Tip error: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Delegate processing to Service
	success, msg, err := s.service.ProcessTip(tip, claims)
	if err != nil {
		// Technical Error
		s.logger.Printf("ProcessTip error: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if !success {
		// Logic Error / Validation Failed
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	// Success
	s.logger.Printf("New tip processed: %+v", tip)
	c.JSON(http.StatusOK, gin.H{"status": "success", "message": msg})
}

func (s *Server) HandleGetTips(c *gin.Context) {
	authHeader := c.GetHeader("Authorization")
	if len(authHeader) < 8 || authHeader[:7] != "Bearer " {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Missing or invalid token"})
		return
	}
	tokenString := authHeader[7:]

	_, err := s.service.ValidateSessionToken(tokenString)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
		return
	}

	claims, err := s.service.ValidateSessionToken(tokenString) // Duplicate check but safe

	limit := 10
	if l := c.Query("limit"); l != "" {
		fmt.Sscanf(l, "%d", &limit)
	}
	if limit > 50 {
		limit = 50
	}

	var cursor uint64
	if cur := c.Query("cursor"); cur != "" {
		fmt.Sscanf(cur, "%d", &cursor)
	}

	responseItems, nextCursor, err := s.service.GetTips(claims.Username, limit, uint(cursor))
	if err != nil {
		s.logger.Printf("Failed to fetch tips: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch tips"})
		return
	}

	c.JSON(http.StatusOK, model.TipsResponse{
		Tips:       responseItems,
		NextCursor: nextCursor,
	})
}

func (s *Server) HandleWS(c *gin.Context) {
	streamerId := c.Param("streamerId")
	conn, err := s.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		s.logger.Printf("Failed to upgrade WS: %v", err)
		return
	}

	s.service.RegisterClient(conn)
	s.logger.Printf("New OBS widget connected for streamer: %s", streamerId)

	go func() {
		defer s.service.UnregisterClient(conn)
		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				break
			}
		}
	}()
}
