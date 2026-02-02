package server

import (
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/patiee/backend/db"
	dbmodel "github.com/patiee/backend/db/model"
	"github.com/patiee/backend/server/model"
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
	config    Config
	logger    *log.Logger
	db        *db.Database
	clients   map[*websocket.Conn]bool
	clientsMu sync.Mutex
	upgrader  websocket.Upgrader
}

func New(logger *log.Logger, database *db.Database, config Config) *Server {
	return &Server{
		config:  config,
		logger:  logger,
		db:      database,
		clients: make(map[*websocket.Conn]bool),
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true // Allow all origins for OBS
			},
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
		s.logger.Println("CORS: Enabling Access-Control-Allow-Origin: *")
		config.AllowAllOrigins = true
	} else {
		// Fallback for dev or specific handling
		config.AllowOrigins = []string{"http://localhost:3000", "https://localhost:3000"}
	}

	config.AllowHeaders = []string{"Origin", "Content-Length", "Content-Type", "Authorization"}
	r.Use(cors.New(config))

	// WebSocket endpoint for OBS widget
	r.GET("/ws/:streamerId", s.HandleWS)

	// Auth endpoints
	r.POST("/auth/signup", s.HandleSignup)
	r.POST("/auth/login", s.HandleLogin)
	r.GET("/auth/:provider/login", s.HandleOAuthLogin)
	r.GET("/auth/:provider/callback", s.HandleOAuthCallback)

	// API endpoints
	r.GET("/api/me", s.HandleMe)
	r.PUT("/api/me/wallet", s.HandleUpdateWallet)
	r.GET("/api/user/:username", s.HandleGetUser)
	r.POST("/api/tip", s.HandleTip)

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
	var req model.SignupRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		s.logger.Printf("Signup error: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verify Signup Token
	claims, err := s.ValidateSignupToken(req.SignupToken)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid signup token"})
		return
	}

	// Check if username exists
	if _, err := s.db.GetUserByUsername(req.Username); err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Username already taken"})
		return
	}

	user := dbmodel.User{
		Username:   req.Username,
		Provider:   claims.Provider,
		ProviderID: claims.ProviderID,
		Email:      claims.Email,
		AvatarURL:  claims.Avatar,
		EthAddress: req.EthAddress,
		MainWallet: req.MainWallet,
		CreatedAt:  time.Now(),
	}

	if err := s.db.CreateUser(&user); err != nil {
		// Check if it failed because user already exists (ProviderID collision)
		// Since we verified the signup token which contains trusted ProviderID,
		// if the user exists with this ProviderID, we can safely log them in.
		existingUser, fetchErr := s.db.GetUserByProviderID(claims.Provider, claims.ProviderID)
		if fetchErr == nil {
			// User exists! seamless login.
			token, tokenErr := s.GenerateSessionToken(existingUser)
			if tokenErr != nil {
				s.logger.Printf("Failed to generate token for existing user: %v", tokenErr)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
				return
			}
			s.logger.Printf("User already exists, seamless login: %s", existingUser.Username)
			c.JSON(http.StatusOK, gin.H{"message": "User logged in", "user": existingUser, "token": token})
			return
		}

		s.logger.Printf("Failed to create user: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user or username taken"})
		return
	}

	// New user created
	token, err := s.GenerateSessionToken(&user) // Generate session token immediately for auto-login
	if err != nil {
		s.logger.Printf("User created but failed to generate token: %v", err)
		// Client will have to login manually, but user is created.
		c.JSON(http.StatusCreated, gin.H{"message": "User created", "user": user})
		return
	}

	s.logger.Printf("User created: %s", user.Username)
	c.JSON(http.StatusCreated, gin.H{"message": "User created", "user": user, "token": token})
}

func (s *Server) HandleLogin(c *gin.Context) {
	// Mock login
	c.JSON(http.StatusOK, gin.H{"message": "Login endpoint (Mock)"})
}

func (s *Server) HandleMe(c *gin.Context) {
	tokenString := c.Query("token")
	if tokenString == "" {
		// Also check Authorization header
		authHeader := c.GetHeader("Authorization")
		if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
			tokenString = authHeader[7:]
		}
	}

	if tokenString == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Missing token"})
		return
	}

	// Support legacy mock token for fresh signups if needed (optional, but better to unify)
	if len(tokenString) > 11 && tokenString[:11] == "mock_token_" {
		username := tokenString[11:]
		user, err := s.db.GetUserByUsername(username)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
			return
		}
		c.JSON(http.StatusOK, user)
		return
	}

	// Validate JWT
	claims, err := s.ValidateSessionToken(tokenString)
	if err != nil {
		s.logger.Printf("Invalid session token: %v", err)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
		return
	}

	user, err := s.db.GetUserByUsername(claims.Username)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, user)
}

func (s *Server) HandleGetUser(c *gin.Context) {
	username := c.Param("username")
	user, err := s.db.GetUserByUsername(username)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// Return only public info
	c.JSON(http.StatusOK, gin.H{
		"username":    user.Username,
		"eth_address": user.EthAddress,
	})
}

func (s *Server) HandleUpdateWallet(c *gin.Context) {
	// 1. Get user from token/context (middleware?)
	// Not using middleware yet, but HandleMe does token validation.
	// We should extract token validation if we add more protected routes,
	// but for now I'll duplicate the quick check or grab from header.

	authHeader := c.GetHeader("Authorization")
	if len(authHeader) < 8 || authHeader[:7] != "Bearer " {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Missing or invalid token"})
		return
	}
	tokenString := authHeader[7:]

	claims, err := s.ValidateSessionToken(tokenString)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
		return
	}

	// 2. Parse request
	var req model.UpdateWalletRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// 3. Update DB
	err = s.db.UpdateUserWallet(claims.UserID, req.EthAddress)
	if err != nil {
		s.logger.Printf("Failed to update wallet for user %d: %v", claims.UserID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update wallet"})
		return
	}

	s.logger.Printf("User %s updated wallet to %s", claims.Username, req.EthAddress)
	c.JSON(http.StatusOK, gin.H{"message": "Wallet updated", "eth_address": req.EthAddress})
}

func (s *Server) HandleTip(c *gin.Context) {
	var tip model.TipRequest
	if err := c.ShouldBindJSON(&tip); err != nil {
		s.logger.Printf("Tip error: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// TODO: Verify transaction on Sui/Sepolia Network here using tip.TxHash
	// For MVP, we assume the frontend is truthful, but in production, verify!

	s.logger.Printf("New tip received: %+v", tip)

	// Notify connected widgets
	s.notifyWidgets(tip)

	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Tip processed"})
}

func (s *Server) HandleWS(c *gin.Context) {
	streamerId := c.Param("streamerId")
	conn, err := s.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		s.logger.Printf("Failed to upgrade WS: %v", err)
		return
	}

	s.clientsMu.Lock()
	s.clients[conn] = true
	s.clientsMu.Unlock()

	s.logger.Printf("New OBS widget connected for streamer: %s", streamerId)

	// Keep connection alive
	go func() {
		defer func() {
			s.clientsMu.Lock()
			delete(s.clients, conn)
			s.clientsMu.Unlock()
			conn.Close()
		}()
		for {
			// Read message (ignore for now, just keep alive)
			_, _, err := conn.ReadMessage()
			if err != nil {
				break
			}
		}
	}()
}

func (s *Server) notifyWidgets(tip model.TipRequest) {
	notification := model.TipNotification{
		Type:       "TIP",
		StreamerID: tip.StreamerID,
		Sender:     tip.Sender,
		Message:    tip.Message,
		Amount:     tip.Amount,
	}

	s.clientsMu.Lock()
	defer s.clientsMu.Unlock()

	for client := range s.clients {
		err := client.WriteJSON(notification)
		if err != nil {
			s.logger.Printf("WS write error: %v", err)
			client.Close()
			delete(s.clients, client)
		}
	}
}
