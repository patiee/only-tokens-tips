# Streamer Tipping Platform - Backend

This is the backend service for the Streamer Tipping Platform, built with Go and PostgreSQL. It handles user authentication, profile management, and tip notifications via WebSockets.

## Prerequisites

- **Go**: Version 1.23 or higher.
- **Docker & Docker Compose**: For running the database and backend in a containerized environment.
- **PostgreSQL**: If running locally without Docker.

## Configuration

Ensure a `.env` file exists in the `backend` directory. You can copy the example:

```bash
cp .env.example .env
```

Configuration variables:
- `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_HOST`, `DB_PORT`: Database credentials.
- `JWT_SECRET`: Secret for signing JWTs.
- `PORT`: Server port (default: 8080).

## Build and Run

### Using Docker Compose (Recommended)

This will start both the PostgreSQL database and the Go backend.

```bash
# From the backend directory
docker-compose up --build
```

The server will be available at `http://localhost:8080`.

### Running Locally

1.  **Start PostgreSQL**: Ensure you have a running Postgres instance matching your `.env` config.
2.  **Run the Server**:

```bash
# From the backend directory
go mod tidy
go run main.go
```
