package model

import "time"

type User struct {
	ID                 uint      `gorm:"primaryKey" json:"id"`
	CreatedAt          time.Time `json:"created_at"`
	Username           string    `gorm:"uniqueIndex" json:"username"`
	Email              string    `gorm:"uniqueIndex" json:"email"`       // For OAuth link
	Provider           string    `json:"provider"`                       // twitch, kick, google
	ProviderID         string    `gorm:"uniqueIndex" json:"provider_id"` // Unique ID from provider
	AvatarURL          string    `json:"avatar_url"`
	WalletAddress      string    `json:"wallet_address" gorm:"column:eth_address"`
	MainWallet         bool      `json:"main_wallet"`
	WidgetToken        string    `json:"widget_token" gorm:"uniqueIndex"` // Private UUID for widget URL
	WidgetTTS          bool      `json:"widget_tts" gorm:"default:false"`
	WidgetBgColor      string    `json:"widget_bg_color" gorm:"default:'#000000'"`
	WidgetUserColor    string    `json:"widget_user_color" gorm:"default:'#ffffff'"`
	WidgetAmountColor  string    `json:"widget_amount_color" gorm:"default:'#22c55e'"`
	WidgetMessageColor string    `json:"widget_message_color" gorm:"default:'#ffffff'"`
	PreferredChainID   int       `json:"preferred_chain_id" gorm:"default:1"`
	PreferredAsset     string    `json:"preferred_asset_address" gorm:"default:'0x0000000000000000000000000000000000000000'"`
	Description        string    `json:"description"`
	BackgroundURL      string    `json:"background_url"`
	GoogleID           *string   `json:"google_id" gorm:"uniqueIndex"`
	TwitchID           *string   `json:"twitch_id" gorm:"uniqueIndex"`
	KickID             *string   `json:"kick_id" gorm:"uniqueIndex"`
}
