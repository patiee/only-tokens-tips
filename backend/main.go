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
	config := server.Config{
		GoogleClientID:     os.Getenv("GOOGLE_CLIENT_ID"),
		GoogleClientSecret: os.Getenv("GOOGLE_CLIENT_SECRET"),
		TwitchClientID:     os.Getenv("TWITCH_CLIENT_ID"),
		TwitchClientSecret: os.Getenv("TWITCH_CLIENT_SECRET"),
		KickClientID:       os.Getenv("KICK_CLIENT_ID"),
		KickClientSecret:   os.Getenv("KICK_CLIENT_SECRET"),
		JWTSecret:          os.Getenv("JWT_SECRET"),
		CertFile:           os.Getenv("CERT_FILE"),
		KeyFile:            os.Getenv("KEY_FILE"),
	}

	// Init and Start Server
	srv := server.New(logger, database, config)
	srv.Start(port)
}
