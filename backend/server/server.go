package server

import (
	"fmt"
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
		// Force permissive CORS for development/demo
		config.AllowAllOrigins = true
		s.logger.Println("CORS: Enabling permissive CORS for all origins")
	} else {
		config.AllowOrigins = []string{"http://localhost:3000", "https://localhost:3000"}
		s.logger.Println("CORS: Enabling CORS for specific origins")
	}
	config.AllowHeaders = []string{"Origin", "Content-Length", "Content-Type", "Authorization"}
	config.AllowCredentials = true // Allow cookies/auth headers

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
	r.PUT("/api/me/widget", s.HandleUpdateWidget)
	r.GET("/api/user/:username", s.HandleGetUser)
	r.POST("/api/tip", s.HandleTip)
	r.GET("/api/me/tips", s.HandleGetTips)

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
	// This endpoint is now "Complete Profile / Update Username"
	// It expects a valid SESSION token (Authorization header)
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

	var req model.SignupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if username is taken (by someone else)
	if s.db.CheckUsernameTaken(req.Username, claims.UserID) {
		c.JSON(http.StatusConflict, gin.H{"error": "Username already taken"})
		return
	}

	// Update the existing user
	err = s.db.UpdateUserProfile(claims.UserID, req.Username, req.EthAddress, req.MainWallet)
	if err != nil {
		s.logger.Printf("Failed to complete profile for user %d: %v", claims.UserID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update profile"})
		return
	}

	// Re-fetch updated user to generate new token if username changed
	updatedUser, err := s.db.GetUserByUsername(req.Username)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to refresh user"})
		return
	}

	// Generate new token with updated username claim
	newToken, err := s.GenerateSessionToken(updatedUser)
	if err != nil {
		s.logger.Printf("Failed to generate token for updated user %d: %v", updatedUser.ID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate session token"})
		return
	}

	s.logger.Printf("User profile completed: %s", updatedUser.Username)
	c.JSON(http.StatusOK, gin.H{"message": "Profile updated", "user": updatedUser, "token": newToken})
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
		"username":             user.Username,
		"eth_address":          user.EthAddress,
		"widget_tts":           user.WidgetTTS,
		"widget_bg_color":      user.WidgetBgColor,
		"widget_user_color":    user.WidgetUserColor,
		"widget_amount_color":  user.WidgetAmountColor,
		"widget_message_color": user.WidgetMessageColor,
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

func (s *Server) HandleUpdateWidget(c *gin.Context) {
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

	var req model.UpdateWidgetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	err = s.db.UpdateWidgetConfig(claims.UserID, req.WaitTTS, req.BgColor, req.UserColor, req.AmountColor, req.MessageColor)
	if err != nil {
		s.logger.Printf("Failed to update widget config for user %d: %v", claims.UserID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update widget settings"})
		return
	}

	s.logger.Printf("User %s updated widget config", claims.Username)
	c.JSON(http.StatusOK, gin.H{"message": "Widget settings updated"})
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

	// Save to DB
	dbTip := &dbmodel.Tip{
		StreamerID:    tip.StreamerID,
		Sender:        tip.Sender,
		Message:       tip.Message,
		Amount:        tip.Amount,
		Asset:         tip.Asset,
		TxHash:        tip.TxHash,
		ChainID:       tip.ChainID,
		SourceChain:   tip.SourceChain,
		DestChain:     tip.DestChain,
		SourceAddress: tip.SourceAddress,
		DestAddress:   tip.DestAddress,
	}

	if err := s.db.CreateTip(dbTip); err != nil {
		s.logger.Printf("Failed to save tip to DB: %v", err)
		// Don't fail the request, just log it. The widget was notified.
	}

	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Tip processed"})
}

func (s *Server) HandleGetTips(c *gin.Context) {
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

	// Parse Limit
	limit := 10 // Default
	if l := c.Query("limit"); l != "" {
		fmt.Sscanf(l, "%d", &limit)
	}
	if limit > 50 {
		limit = 50
	}

	// Parse Cursor
	var cursor uint64
	if cur := c.Query("cursor"); cur != "" {
		fmt.Sscanf(cur, "%d", &cursor)
	}

	// Fetch tips
	tips, err := s.db.GetTipsPaginated(claims.Username, limit, uint(cursor))
	if err != nil {
		s.logger.Printf("Failed to fetch tips for %s: %v", claims.Username, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch tips"})
		return
	}

	// Build Response
	var nextCursor string
	if len(tips) > 0 {
		// Since we ordered DESC, the last item has the smallest ID.
		// Next cursor should be that ID.
		lastTip := tips[len(tips)-1]
		nextCursor = fmt.Sprintf("%d", lastTip.ID)

		// Optimization: If we fetched less than limit, we are at the end.
		if len(tips) < limit {
			nextCursor = ""
		}
	}

	// Convert to Response Items
	responseItems := make([]model.TipResponseItem, 0, len(tips))
	for _, t := range tips {
		responseItems = append(responseItems, model.TipResponseItem{
			CreatedAt:   t.CreatedAt.Format(time.RFC3339),
			Sender:      t.Sender,
			Message:     t.Message,
			Amount:      t.Amount,
			Asset:       t.Asset,
			TxHash:      t.TxHash,
			SourceChain: t.SourceChain,
		})
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
