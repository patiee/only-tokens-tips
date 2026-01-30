package main

import (
	"log"
	"net/http"
	"sync"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var (
	// Store connected WebSocket clients (OBS widgets)
	clients   = make(map[*websocket.Conn]bool)
	clientsMu sync.Mutex

	// Upgrader for WebSocket
	upgrader = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true // Allow all origins for OBS
		},
	}
)

type TipRequest struct {
	StreamerID string `json:"streamerId" binding:"required"`
	Sender     string `json:"sender" binding:"required"`
	Message    string `json:"message"`
	Amount     string `json:"amount" binding:"required"`
	TxHash     string `json:"txHash" binding:"required"` // Changed from TxDigest to TxHash
}

type TipNotification struct {
	Type       string `json:"type"`
	StreamerID string `json:"streamerId"`
	Sender     string `json:"sender"`
	Message    string `json:"message"`
	Amount     string `json:"amount"`
}

func main() {
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

	// API endpoint to receive tip notifications from frontend
	r.POST("/api/tip", func(c *gin.Context) {
		var tip TipRequest
		if err := c.ShouldBindJSON(&tip); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// TODO: Verify transaction on Sui Network here using tip.TxDigest
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
