package model

type TipRequest struct {
	StreamerID    string `json:"streamerId" binding:"required"`
	Sender        string `json:"sender" binding:"required"`
	Message       string `json:"message"`
	Amount        string `json:"amount" binding:"required"`
	TxHash        string `json:"txHash" binding:"required"`
	Asset         string `json:"asset"`
	ChainID       string `json:"chainId"`
	SourceChain   string `json:"sourceChain"`
	DestChain     string `json:"destChain"`
	SourceAddress string `json:"sourceAddress"`
	DestAddress   string `json:"destAddress"`
}

type SignupRequest struct {
	Username    string `json:"username"`
	SignupToken string `json:"signup_token"` // JWT containing Provider, ProviderID, Email, Avatar
	EthAddress  string `json:"eth_address"`
	MainWallet  bool   `json:"main_wallet"`
}

type UpdateWidgetRequest struct {
	WaitTTS      bool   `json:"tts_enabled"`
	BgColor      string `json:"background_color"`
	UserColor    string `json:"user_color"`
	AmountColor  string `json:"amount_color"`
	MessageColor string `json:"message_color"`
}

type UpdateWalletRequest struct {
	EthAddress string `json:"eth_address" binding:"required"`
}
