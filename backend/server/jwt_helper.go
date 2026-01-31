package server

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/patiee/backend/db/model"
)

// Claims for a logged-in user session
type SessionClaims struct {
	UserID   uint   `json:"user_id"`
	Username string `json:"username"`
	jwt.RegisteredClaims
}

// Claims for a temporary signup handoff (from OAuth callback to Signup form)
type SignupClaims struct {
	Provider   string `json:"provider"`
	ProviderID string `json:"provider_id"`
	Email      string `json:"email"`
	Avatar     string `json:"avatar"`
	jwt.RegisteredClaims
}

func (s *Server) GetJWTSecret() []byte {
	if len(s.config.JWTSecret) == 0 {
		return []byte("dev-secret-do-not-use-in-prod")
	}
	return []byte(s.config.JWTSecret)
}

// GenerateSessionToken creates a standard access token for a user
func (s *Server) GenerateSessionToken(user *model.User) (string, error) {
	claims := SessionClaims{
		UserID:   user.ID,
		Username: user.Username,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "only-tokens-tips",
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.GetJWTSecret())
}

// GenerateSignupToken creates a temporary token containing verified OAuth info
func (s *Server) GenerateSignupToken(provider, providerID, email, avatar string) (string, error) {
	claims := SignupClaims{
		Provider:   provider,
		ProviderID: providerID,
		Email:      email,
		Avatar:     avatar,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(1 * time.Hour)), // Short lived
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "only-tokens-tips-signup",
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.GetJWTSecret())
}

// ValidateSignupToken parses and validates the signup token
func (s *Server) ValidateSignupToken(tokenString string) (*SignupClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &SignupClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return s.GetJWTSecret(), nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*SignupClaims); ok && token.Valid {
		return claims, nil
	}

	return nil, fmt.Errorf("invalid token")
}
