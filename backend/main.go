package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var (
	// Store connected WebSocket clients (OBS widgets)
	clients   = make(map[*websocket.Conn]bool)
	clientsMu sync.Mutex

	// Database
	db *gorm.DB

	// Upgrader for WebSocket
	upgrader = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true // Allow all origins for OBS
		},
	}
)

type User struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	CreatedAt  time.Time `json:"created_at"`
	Username   string    `gorm:"uniqueIndex" json:"username"`
	Email      string    `gorm:"uniqueIndex" json:"email"` // For OAuth link
	Provider   string    `json:"provider"`                 // twitch, kick, google
	EthAddress string    `json:"eth_address"`
	MainWallet bool      `json:"main_wallet"`
}

type TipRequest struct {
	StreamerID string `json:"streamerId" binding:"required"`
	Sender     string `json:"sender" binding:"required"`
	Message    string `json:"message"`
	Amount     string `json:"amount" binding:"required"`
	TxHash     string `json:"txHash" binding:"required"`
}

type TipNotification struct {
	Type       string `json:"type"`
	StreamerID string `json:"streamerId"`
	Sender     string `json:"sender"`
	Message    string `json:"message"`
	Amount     string `json:"amount"`
}

func initDB() {
	// Load .env only if not in Docker (Docker handles envs differently, but godotenv won't override if set)
	// Actually for local dev without docker-compose up, we need this.
	// We'll look for .env in current dir or parent.
	_ = godotenv.Load("../.env")

	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=disable TimeZone=UTC",
		os.Getenv("DB_HOST"),
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASSWORD"),
		os.Getenv("DB_NAME"),
		os.Getenv("DB_PORT"),
	)

	var err error
	db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Printf("Failed to connect to database: %v. Retrying in 5s...", err)
		time.Sleep(5 * time.Second)
		db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
		if err != nil {
			log.Fatal("Could not connect to database:", err)
		}
	}

	log.Println("Database connected successfully")

	// Migrate the schema
	db.AutoMigrate(&User{})
}

func main() {
	initDB()

	r := gin.Default()

	// CORS configuration
	config := cors.DefaultConfig()
	config.AllowAllOrigins = true
	config.AllowHeaders = []string{"Origin", "Content-Length", "Content-Type"}
	r.Use(cors.New(config))

	// WebSocket endpoint for OBS widget
	r.GET("/ws/:streamerId", func(c *gin.Context) {
		streamerId := c.Param("streamerId")
		handleWebSocket(c.Writer, c.Request, streamerId)
	})

	// Auth endpoints
	r.POST("/auth/signup", func(c *gin.Context) {
		var req struct {
			Username   string `json:"username"`
			Provider   string `json:"provider"`
			EthAddress string `json:"eth_address"`
			MainWallet bool   `json:"main_wallet"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Check if username exists
		var existing User
		if result := db.Where("username = ?", req.Username).First(&existing); result.Error == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "Username already taken"})
			return
		}

		user := User{
			Username:   req.Username,
			Provider:   req.Provider,
			EthAddress: req.EthAddress,
			MainWallet: req.MainWallet,
			CreatedAt:  time.Now(),
		}

		if result := db.Create(&user); result.Error != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
			return
		}

		log.Printf("User created: %s", user.Username)
		c.JSON(http.StatusCreated, gin.H{"message": "User created", "user": user})
	})

	r.POST("/auth/login", func(c *gin.Context) {
		// Mock login
		c.JSON(http.StatusOK, gin.H{"message": "Login endpoint (Mock)"})
	})

	r.GET("/api/me", func(c *gin.Context) {
		token := c.Query("token")
		// Mock token parsing: "mock_token_USERNAME"
		if len(token) < 12 || token[:11] != "mock_token_" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			return
		}
		username := token[11:]

		var user User
		if result := db.Where("username = ?", username).First(&user); result.Error != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
			return
		}

		c.JSON(http.StatusOK, user)
	})

	// Public Profile Endpoint
	r.GET("/api/user/:username", func(c *gin.Context) {
		username := c.Param("username")
		var user User
		if result := db.Where("username = ?", username).First(&user); result.Error != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
			return
		}

		// Return only public info
		c.JSON(http.StatusOK, gin.H{
			"username":    user.Username,
			"eth_address": user.EthAddress,
		})
	})

	// API endpoint to receive tip notifications from frontend
	r.POST("/api/tip", func(c *gin.Context) {
		var tip TipRequest
		if err := c.ShouldBindJSON(&tip); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// TODO: Verify transaction on Sui/Sepolia Network here using tip.TxHash
		// For MVP, we assume the frontend is truthful, but in production, verify!

		log.Printf("New tip received: %+v", tip)

		// Notify connected widgets
		notifyWidgets(tip)

		c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Tip processed"})
	})

	log.Println("Server starting on :8080")
	r.Run(":8080")
}

func handleWebSocket(w http.ResponseWriter, r *http.Request, streamerId string) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Failed to upgrade WS: %v", err)
		return
	}

	clientsMu.Lock()
	clients[conn] = true
	clientsMu.Unlock()

	log.Printf("New OBS widget connected for streamer: %s", streamerId)

	// Keep connection alive
	go func() {
		defer func() {
			clientsMu.Lock()
			delete(clients, conn)
			clientsMu.Unlock()
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

func notifyWidgets(tip TipRequest) {
	notification := TipNotification{
		Type:       "TIP",
		StreamerID: tip.StreamerID,
		Sender:     tip.Sender,
		Message:    tip.Message,
		Amount:     tip.Amount,
	}

	clientsMu.Lock()
	defer clientsMu.Unlock()

	for client := range clients {
		err := client.WriteJSON(notification)
		if err != nil {
			log.Printf("WS write error: %v", err)
			client.Close()
			delete(clients, client)
		}
	}
}
