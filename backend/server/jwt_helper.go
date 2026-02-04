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

func (s *Service) GetJWTSecret() []byte {
	if len(s.config.JWTSecret) == 0 {
		return []byte("dev-secret-do-not-use-in-prod")
	}
	return []byte(s.config.JWTSecret)
}

// GenerateSessionToken creates a standard access token for a user
func (s *Service) GenerateSessionToken(user *model.User) (string, error) {
	expiresAt := time.Now().Add(48 * time.Hour)
	claims := SessionClaims{
		UserID:   user.ID,
		Username: user.Username,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "only-tokens-tips",
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(s.GetJWTSecret())
	if err != nil {
		return "", err
	}

	// Persist to DB
	session := &model.UserSession{
		UserID:    user.ID,
		Token:     tokenString,
		ExpiresAt: expiresAt,
		CreatedAt: time.Now(),
	}

	if err := s.db.SaveUserSession(session); err != nil {
		return "", fmt.Errorf("failed to save user session: %v", err)
	}

	return tokenString, nil
}

// ValidateSessionToken parses and validates the session token
func (s *Service) ValidateSessionToken(tokenString string) (*SessionClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &SessionClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return s.GetJWTSecret(), nil
	})

	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*SessionClaims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}

	// Check DB
	session, err := s.db.GetUserSession(tokenString)
	if err != nil {
		return nil, fmt.Errorf("session not found or expired")
	}

	if time.Now().After(session.ExpiresAt) {
		return nil, fmt.Errorf("session expired")
	}

	return claims, nil
}

// Claims for a wallet session (tipper)
type WalletClaims struct {
	WalletAddress string `json:"wallet_address"`
	jwt.RegisteredClaims
}

func (s *Service) GenerateWalletToken(address string) (string, error) {
	expiresAt := time.Now().Add(24 * time.Hour)
	claims := WalletClaims{
		WalletAddress: address,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "only-tokens-tips-wallet",
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(s.GetJWTSecret())
	if err != nil {
		return "", err
	}

	// Persist to DB
	session := &model.WalletSession{
		Token:         tokenString,
		WalletAddress: address,
		ExpiresAt:     expiresAt,
		CreatedAt:     time.Now(),
	}

	if err := s.db.SaveWalletSession(session); err != nil {
		return "", fmt.Errorf("failed to save wallet session: %v", err)
	}

	return tokenString, nil
}

func (s *Service) ValidateWalletToken(tokenString string) (*WalletClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &WalletClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return s.GetJWTSecret(), nil
	})

	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*WalletClaims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("invalid wallet token")
	}

	// Check DB
	session, err := s.db.GetWalletSession(tokenString)
	if err != nil {
		return nil, fmt.Errorf("session not found or expired")
	}

	if time.Now().After(session.ExpiresAt) {
		return nil, fmt.Errorf("session expired")
	}

	return claims, nil
}
