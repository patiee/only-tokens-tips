package model

import "encoding/json"

type TipsResponse struct {
	Tips       []TipResponseItem `json:"tips"`
	NextCursor string            `json:"next_cursor"`
}

type TipResponseItem struct {
	CreatedAt   string `json:"created_at"`
	Sender      string `json:"sender"`
	Message     string `json:"message"`
	Amount      string `json:"amount"`
	Asset       string `json:"asset"`
	TxHash      string `json:"tx_hash"`
	SourceChain string `json:"source_chain"`
}

type TipNotification struct {
	Type       string `json:"type"`
	StreamerID string `json:"streamerId"`
	Sender     string `json:"sender"`
	Message    string `json:"message"`
	Amount     string `json:"amount"`
}

type UserProfile struct {
	ID     string
	Email  string
	Name   string
	Avatar string
}

type GoogleUser struct {
	Id      string `json:"id"`
	Email   string `json:"email"`
	Name    string `json:"name"`
	Picture string `json:"picture"`
}

type TwitchResp struct {
	Data []struct {
		ID              string `json:"id"`
		Email           string `json:"email"`
		DisplayName     string `json:"display_name"`
		ProfileImageUrl string `json:"profile_image_url"`
	} `json:"data"`
}

type KickUser struct {
	ID         json.Number `json:"id"`
	Email      string      `json:"email"`
	Username   string      `json:"username"`
	ProfilePic string      `json:"profile_pic"`
}
