package main

import (
	"fmt"
	"log"
	"os"

	"github.com/joho/godotenv"
	"github.com/patiee/backend/db"
	"github.com/patiee/backend/server"
)

func main() {
	// Initialize Logger
	logger := log.New(os.Stdout, "[SERVER] ", log.LstdFlags)

	// Load .env files (ignore error if file not found)
	if err := godotenv.Load(); err != nil {
		logger.Println("No .env file found, using system env vars")
	}

	// DB Params
	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=disable TimeZone=UTC",
		os.Getenv("DB_HOST"),
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASSWORD"),
		os.Getenv("DB_NAME"),
		os.Getenv("DB_PORT"),
	)

	// Server Params
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// Init DB
	database := db.New(logger)
	if err := database.Init(dsn); err != nil {
		logger.Fatalf("Database initialization failed: %v", err)
	}

	// Config
	// Frontend URL
	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:3000"
	}

	config := server.Config{
		GoogleClientID:     os.Getenv("GOOGLE_CLIENT_ID"),
		GoogleClientSecret: os.Getenv("GOOGLE_CLIENT_SECRET"),
		TwitchClientID:     os.Getenv("TWITCH_CLIENT_ID"),
		TwitchClientSecret: os.Getenv("TWITCH_CLIENT_SECRET"),
		TikTokClientID:     os.Getenv("TIKTOK_CLIENT_ID"),
		TikTokClientSecret: os.Getenv("TIKTOK_CLIENT_SECRET"),
		JWTSecret:          os.Getenv("JWT_SECRET"),
		CertFile:           os.Getenv("CERT_FILE"),
		KeyFile:            os.Getenv("KEY_FILE"),
		CORSEnabled:        os.Getenv("CORS_ENABLED") == "true",
		MinIOEndpoint:      os.Getenv("MINIO_ENDPOINT"),
		MinIOAccessKeyID:   os.Getenv("MINIO_ACCESS_KEY"),
		MinIOSecretKey:     os.Getenv("MINIO_SECRET_KEY"),
		MinIOUseSSL:        os.Getenv("MINIO_USE_SSL") == "true",
		EthRPCURL:          os.Getenv("ETH_RPC_URL"),
		FrontendURL:        frontendURL,
	}

	// Init and Start Server
	srv := server.New(logger, database, config)
	srv.Start(port)
}
