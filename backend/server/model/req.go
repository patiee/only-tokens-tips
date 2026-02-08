package model

type TipRequest struct {
	StreamerID          string `json:"streamerId" binding:"required"`
	Sender              string `json:"sender" binding:"required"`
	Message             string `json:"message"`
	Amount              string `json:"amount" binding:"required"`
	TxHash              string `json:"txHash" binding:"required"`
	Asset               string `json:"asset"`
	ChainID             string `json:"chainId"`
	SourceChain         string `json:"sourceChain"`
	DestChain           string `json:"destChain"`
	SourceAddress       string `json:"sourceAddress"`
	DestAddress         string `json:"destAddress"`
	EnableENSAvatar     bool   `json:"enableEnsAvatar"`
	EnableENSBackground bool   `json:"enableEnsBackground"`
	EnableENSTwitter    bool   `json:"enableEnsTwitter"`
}

type SignupRequest struct {
	Username              string `json:"username"`
	SignupToken           string `json:"signup_token"`
	WalletAddress         string `json:"wallet_address"`
	MainWallet            bool   `json:"main_wallet"`
	PreferredChainID      int64  `json:"preferred_chain_id"`
	PreferredAssetAddress string `json:"preferred_asset_address"`
	AvatarURL             string `json:"avatar_url"`
	Description           string `json:"description"`
	BackgroundURL         string `json:"background_url"`
	TwitterHandle         string `json:"twitter_handle"`
	UseEnsAvatar          bool   `json:"use_ens_avatar"`
	UseEnsBackground      bool   `json:"use_ens_background"`
	UseEnsDescription     bool   `json:"use_ens_description"`
	UseEnsUsername        bool   `json:"use_ens_username"`
}

type UpdateWidgetRequest struct {
	WaitTTS      bool   `json:"tts_enabled"`
	BgColor      string `json:"background_color"`
	UserColor    string `json:"user_color"`
	AmountColor  string `json:"amount_color"`
	MessageColor string `json:"message_color"`
}

type UpdateWalletRequest struct {
	WalletAddress         string `json:"wallet_address" binding:"required"`
	PreferredChainID      int64  `json:"preferred_chain_id"`
	PreferredAssetAddress string `json:"preferred_asset_address"`
}

type UpdateProfileRequest struct {
	Username          string `json:"username"`
	Description       string `json:"description"`
	BackgroundURL     string `json:"background_url"`
	AvatarURL         string `json:"avatar_url"`
	UseEnsAvatar      bool   `json:"use_ens_avatar"`
	UseEnsBackground  bool   `json:"use_ens_background"`
	UseEnsDescription bool   `json:"use_ens_description"`
	UseEnsUsername    bool   `json:"use_ens_username"`
}
