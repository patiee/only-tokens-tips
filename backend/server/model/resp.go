package model

type TipNotification struct {
	Type       string `json:"type"`
	StreamerID string `json:"streamerId"`
	Sender     string `json:"sender"`
	Message    string `json:"message"`
	Amount     string `json:"amount"`
}
