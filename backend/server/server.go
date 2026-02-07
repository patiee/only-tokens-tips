package server

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
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
	minioClient  *minio.Client
)

// ... (Config struct)

func (s *Server) InitMinIO() {
	endpoint := "minio:9000"        // Service name in docker-compose
	accessKeyID := "minioadmin"     // Default or from env
	secretAccessKey := "minioadmin" // Default or from env
	useSSL := false

	if user := os.Getenv("MINIO_ROOT_USER"); user != "" {
		accessKeyID = user
	}
	if pass := os.Getenv("MINIO_ROOT_PASSWORD"); pass != "" {
		secretAccessKey = pass
	}

	var err error
	minioClient, err = minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKeyID, secretAccessKey, ""),
		Secure: useSSL,
	})
	if err != nil {
		s.logger.Printf("Failed to initialize MinIO client: %v", err)
		return
	}

	// Ensure bucket exists
	bucketName := "images"
	ctx := context.Background()
	exists, err := minioClient.BucketExists(ctx, bucketName)
	if err != nil {
		s.logger.Printf("Failed to check if bucket exists: %v", err)
		return
	}

	if !exists {
		err = minioClient.MakeBucket(ctx, bucketName, minio.MakeBucketOptions{})
		if err != nil {
			s.logger.Printf("Failed to create bucket: %v", err)
			return
		}
		s.logger.Printf("Created bucket: %s", bucketName)

		// Set Public Policy
		policy := fmt.Sprintf(`{"Version": "2012-10-17","Statement": [{"Action": ["s3:GetObject"],"Effect": "Allow","Principal": {"AWS": ["*"]},"Resource": ["arn:aws:s3:::%s/*"]}]}`, bucketName)
		err = minioClient.SetBucketPolicy(ctx, bucketName, policy)
		if err != nil {
			s.logger.Printf("Failed to set bucket policy: %v", err)
			return
		}
	}
	s.logger.Println("MinIO initialized successfully")
}

// ... (Start function)

func (s *Server) Start(port string) {
	// Initialize OAuth
	s.InitOAuth()

	// Initialize MinIO
	s.InitMinIO()

	r := gin.Default()
	// ... (CORS logic)

	// ... (Routes)
	r.POST("/api/upload", s.HandleUpload)

	// ... (Rest of Start)
}

// ... (Existing Handlers)

func (s *Server) HandleUpload(c *gin.Context) {
	// Check Auth
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

	// Single file
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}

	// Open the file
	src, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to open file"})
		return
	}
	defer src.Close()

	// Generate unique filename
	ext := filepath.Ext(file.Filename)
	filename := fmt.Sprintf("%d%s", time.Now().UnixNano(), ext)
	bucketName := "images"
	contentType := file.Header.Get("Content-Type")

	// Upload to MinIO
	info, err := minioClient.PutObject(context.Background(), bucketName, filename, src, file.Size, minio.PutObjectOptions{ContentType: contentType})
	if err != nil {
		s.logger.Printf("Failed to upload file to MinIO: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to upload file"})
		return
	}

	// Return URL
	// Since we are running in docker, we need to return a URL reachable by the browser.
	// Assuming MinIO is mapped to localhost:9000
	publicURL := fmt.Sprintf("http://localhost:9000/%s/%s", bucketName, filename)

	c.JSON(http.StatusOK, gin.H{
		"message": "File uploaded successfully",
		"url":     publicURL,
		"size":    info.Size,
	})
}

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

func (s *Server) HandleSignup(c *gin.Context) {
	var req model.SignupRequest
	// Note: We expect 'signup_token' in the body now
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if req.SignupToken == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Missing signup token"})
		return
	}

	claims, err := s.service.ValidateSignupToken(req.SignupToken)
	if err != nil {
		s.logger.Printf("Invalid signup token: %v", err)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired signup token"})
		return
	}

	// Validate Username (Basic check)
	if len(req.Username) < 3 || len(req.Username) > 20 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Username must be between 3 and 20 characters"})
		return
	}

	// We pass 0 as existing userID because this is a new user
	if s.service.CheckUsernameTaken(req.Username, 0) {
		c.JSON(http.StatusConflict, gin.H{"error": "Username already taken"})
		return
	}

	// Register User
	// Use claims data + request data (e.g. eth address might come from wallet connection in step 3)
	// Priority: Claims EthAddress (if wallet login) > Request EthAddress (if linked later)
	walletAddr := claims.WalletAddress
	if walletAddr == "" {
		walletAddr = req.WalletAddress
	}

	newUser, sessionToken, err := s.service.RegisterUser(
		req.Username,
		claims.Provider,
		claims.ProviderID,
		claims.Email,
		claims.AvatarURL,
		walletAddr,
		req.MainWallet,
		req.PreferredChainID,
		req.PreferredAssetAddress,
	)

	if err != nil {
		s.logger.Printf("Failed to register user: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create account"})
		return
	}

	s.logger.Printf("New user registered: %s (Provider: %s)", newUser.Username, claims.Provider)
	c.JSON(http.StatusOK, gin.H{"message": "Registration successful", "user": newUser, "token": sessionToken})
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

	connectedProviders := []string{}
	if user.GoogleID != nil || (user.Provider == "google" && user.ProviderID != "") {
		connectedProviders = append(connectedProviders, "google")
	}
	if user.TwitchID != nil || (user.Provider == "twitch" && user.ProviderID != "") {
		connectedProviders = append(connectedProviders, "twitch")
	}
	if user.KickID != nil || (user.Provider == "kick" && user.ProviderID != "") {
		connectedProviders = append(connectedProviders, "kick")
	}

	c.JSON(http.StatusOK, gin.H{
		"id":                      user.ID,
		"username":                user.Username,
		"email":                   user.Email,
		"avatar_url":              user.AvatarURL,
		"preferred_chain_id":      user.PreferredChainID,
		"preferred_asset_address": user.PreferredAsset,
		"description":             user.Description,
		"background_url":          user.BackgroundURL,
		"provider":                user.Provider,
		"connected_providers":     connectedProviders,
		"wallet_address":          user.WalletAddress,
		"widget_tts":              user.WidgetTTS,
		"widget_token":            user.WidgetToken,
		"widget_bg_color":         user.WidgetBgColor,
		"widget_user_color":       user.WidgetUserColor,
		"widget_amount_color":     user.WidgetAmountColor,
		"widget_message_color":    user.WidgetMessageColor,
	})
}

func (s *Server) HandleGetUser(c *gin.Context) {
	username := c.Param("username")
	user, err := s.service.GetUserByUsername(username)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	connectedProviders := []string{}
	if user.GoogleID != nil || (user.Provider == "google" && user.ProviderID != "") {
		connectedProviders = append(connectedProviders, "google")
	}
	if user.TwitchID != nil || (user.Provider == "twitch" && user.ProviderID != "") {
		connectedProviders = append(connectedProviders, "twitch")
	}
	if user.KickID != nil || (user.Provider == "kick" && user.ProviderID != "") {
		connectedProviders = append(connectedProviders, "kick")
	}

	c.JSON(http.StatusOK, gin.H{
		"id":                      user.ID,
		"username":                user.Username,
		"avatar_url":              user.AvatarURL,
		"preferred_chain_id":      user.PreferredChainID,
		"preferred_asset_address": user.PreferredAsset,
		"description":             user.Description,
		"background_url":          user.BackgroundURL,
		"provider":                user.Provider,
		"connected_providers":     connectedProviders,
		"wallet_address":          user.WalletAddress,
		"widget_tts":              user.WidgetTTS,
		"widget_bg_color":         user.WidgetBgColor,
		"widget_user_color":       user.WidgetUserColor,
		"widget_amount_color":     user.WidgetAmountColor,
		"widget_message_color":    user.WidgetMessageColor,
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

	err = s.service.UpdateUserWallet(claims.UserID, req.WalletAddress, req.PreferredChainID, req.PreferredAssetAddress)
	if err != nil {
		s.logger.Printf("Failed to update wallet: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update wallet"})
		return
	}

	s.logger.Printf("User %s updated wallet to %s (Chain: %d, Asset: %s)", claims.Username, req.WalletAddress, req.PreferredChainID, req.PreferredAssetAddress)
	c.JSON(http.StatusOK, gin.H{
		"message":                 "Wallet updated",
		"wallet_address":          req.WalletAddress,
		"preferred_chain_id":      req.PreferredChainID,
		"preferred_asset_address": req.PreferredAssetAddress,
	})
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

func (s *Server) HandleUpdateProfile(c *gin.Context) {
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

	var req model.UpdateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// Basic Validation
	if len(req.Username) < 3 || len(req.Username) > 20 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Username must be 3-20 characters"})
		return
	}

	// Check if username is taken (if changed)
	// Service.UpdateProfile fetches user first so we could check there?
	// But let's check here to return 409
	if s.service.CheckUsernameTaken(req.Username, claims.UserID) {
		c.JSON(http.StatusConflict, gin.H{"error": "Username already taken"})
		return
	}

	err = s.service.UpdateProfile(claims.UserID, req)
	if err != nil {
		s.logger.Printf("Failed to update profile: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update profile"})
		return
	}

	s.logger.Printf("User %s updated profile", claims.Username)
	c.JSON(http.StatusOK, gin.H{"message": "Profile updated"})
}

func (s *Server) HandleRegenerateWidget(c *gin.Context) {
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

	newToken, err := s.service.RegenerateWidgetToken(claims.UserID)
	if err != nil {
		s.logger.Printf("Failed to regenerate widget token: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to regenerate token"})
		return
	}

	s.logger.Printf("User %s regenerated widget token", claims.Username)
	c.JSON(http.StatusOK, gin.H{"message": "Token regenerated", "widget_token": newToken})
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
	token := c.Param("streamerId") // Route param is still :streamerId for now

	// Authenticate via Widget Token
	user, err := s.service.db.GetUserByWidgetToken(token)
	if err != nil {
		s.logger.Printf("WS Auth Failed: Invalid token %s", token)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid widget token"})
		return
	}

	conn, err := s.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		s.logger.Printf("Failed to upgrade WS: %v", err)
		return
	}

	s.service.RegisterClient(conn, user.ID)
	s.logger.Printf("New OBS widget connected for user: %s (ID: %d)", user.Username, user.ID)

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

func (s *Server) HandleGetWidgetConfig(c *gin.Context) {
	token := c.Param("token")
	user, err := s.service.db.GetUserByWidgetToken(token)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Widget not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"username":                user.Username,
		"wallet_address":          user.WalletAddress,
		"widget_tts":              user.WidgetTTS,
		"widget_bg_color":         user.WidgetBgColor,
		"widget_user_color":       user.WidgetUserColor,
		"widget_amount_color":     user.WidgetAmountColor,
		"widget_message_color":    user.WidgetMessageColor,
		"avatar_url":              user.AvatarURL,
		"preferred_chain_id":      user.PreferredChainID,
		"preferred_asset_address": user.PreferredAsset,
	})
}
