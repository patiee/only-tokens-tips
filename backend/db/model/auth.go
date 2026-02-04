package model

import (
	"time"

	"gorm.io/gorm"
)

type UsedSignature struct {
	Signature string    `gorm:"primaryKey" json:"signature"`
	CreatedAt time.Time `json:"created_at"`
}

// Migrate adds the model to the database
func AutoMigrateAuth(db *gorm.DB) error {
	return db.AutoMigrate(&UsedSignature{}, &WalletSession{}, &UserSession{}, &WalletBlacklist{})
}

type WalletBlacklist struct {
	WalletAddress string    `gorm:"primaryKey" json:"wallet_address"`
	Reason        string    `json:"reason"`
	CreatedAt     time.Time `json:"created_at"`
	ExpiresAt     time.Time `json:"expires_at"` // Optional: for temporary bans
}

type WalletSession struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	Token         string    `gorm:"uniqueIndex;not null" json:"token"`
	WalletAddress string    `gorm:"index;not null" json:"wallet_address"`
	ExpiresAt     time.Time `gorm:"index;not null" json:"expires_at"`
	CreatedAt     time.Time `json:"created_at"`
}

type UserSession struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    uint      `gorm:"index;not null" json:"user_id"`
	Token     string    `gorm:"uniqueIndex;not null" json:"token"`
	ExpiresAt time.Time `gorm:"index;not null" json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`
}
