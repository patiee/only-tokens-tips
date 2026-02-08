package model

import (
	"gorm.io/gorm"
)

type Tip struct {
	gorm.Model
	StreamerID    string `json:"streamer_id" gorm:"index"` // The username of the streamer receiving the tip
	Sender        string `json:"sender"`
	Message       string `json:"message"`
	Amount        string `json:"amount"`
	Asset         string `json:"asset"`        // e.g. "ETH", "USDC"
	TxHash        string `json:"tx_hash"`      // Chain tx hash
	ChainID       string `json:"chain_id"`     // Chain ID where tip happened
	SourceChain   string `json:"source_chain"` // Human readable or ChainID
	DestChain     string `json:"dest_chain"`
	SourceAddress string `json:"source_address"`                  // Sender wallet
	DestAddress   string `json:"dest_address"`                    // Streamer wallet (on that chain)
	AvatarURL     string `json:"avatar_url"`                      // ENS Avatar or other source
	Status        string `json:"status" gorm:"default:'pending'"` // pending, confirmed, failed
}
