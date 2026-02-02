package model

type TipRequest struct {
	StreamerID string `json:"streamerId" binding:"required"`
	Sender     string `json:"sender" binding:"required"`
	Message    string `json:"message"`
	Amount     string `json:"amount" binding:"required"`
	TxHash     string `json:"txHash" binding:"required"`
}

type SignupRequest struct {
	Username    string `json:"username"`
	SignupToken string `json:"signup_token"` // JWT containing Provider, ProviderID, Email, Avatar
	EthAddress  string `json:"eth_address"`
	MainWallet  bool   `json:"main_wallet"`
}

type UpdateWalletRequest struct {
	EthAddress string `json:"eth_address" binding:"required"`
}
