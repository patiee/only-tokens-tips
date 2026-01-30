package model

import "time"

type User struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	CreatedAt  time.Time `json:"created_at"`
	Username   string    `gorm:"uniqueIndex" json:"username"`
	Email      string    `gorm:"uniqueIndex" json:"email"` // For OAuth link
	Provider   string    `json:"provider"`                 // twitch, kick, google
	EthAddress string    `json:"eth_address"`
	MainWallet bool      `json:"main_wallet"`
}
