# Build Stage
FROM golang:1.22-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN go build -o main .

# Run Stage
FROM alpine:latest

WORKDIR /app

COPY --from=builder /app/main .
# Copy .env if needed, but docker-compose usually handles env vars. 
# Apps should read from env vars, not necessarily the file in production.
# But for local dev with docker-compose, we pass env vars.

EXPOSE 8080

CMD ["./main"]
