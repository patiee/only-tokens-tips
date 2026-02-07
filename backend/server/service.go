package server

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/gorilla/websocket"
	"github.com/patiee/backend/db"
	dbmodel "github.com/patiee/backend/db/model"
	"github.com/patiee/backend/server/model"
)

var (
	ErrTxNotFound     = errors.New("tx receipt not found")
	ErrSenderMismatch = errors.New("sender mismatch")
)

type Service struct {
	db          *db.Database
	config      Config
	logger      *log.Logger
	clients     map[uint]map[*websocket.Conn]bool // UserID -> Set of Conns
	connsToUser map[*websocket.Conn]uint          // Conn -> UserID (reverse lookup)
	clientsMu   sync.Mutex

	// Security
	securityMu sync.Mutex
	lastTipReq map[string]time.Time // Wallet -> Last Request Time
	strikes    map[string]int       // Wallet -> Strike Count
}

func NewService(db *db.Database, config Config, logger *log.Logger) *Service {
	return &Service{
		db:          db,
		config:      config,
		logger:      logger,
		clients:     make(map[uint]map[*websocket.Conn]bool),
		connsToUser: make(map[*websocket.Conn]uint),
		lastTipReq:  make(map[string]time.Time),
		strikes:     make(map[string]int),
	}
}

// Logic Methods

func (s *Service) RegisterClient(conn *websocket.Conn, userID uint) {
	s.clientsMu.Lock()
	defer s.clientsMu.Unlock()
	if s.clients[userID] == nil {
		s.clients[userID] = make(map[*websocket.Conn]bool)
	}
	s.clients[userID][conn] = true
	s.connsToUser[conn] = userID
}

func (s *Service) UnregisterClient(conn *websocket.Conn) {
	s.clientsMu.Lock()
	defer s.clientsMu.Unlock()
	if userID, ok := s.connsToUser[conn]; ok {
		if _, exists := s.clients[userID][conn]; exists {
			delete(s.clients[userID], conn)
			if len(s.clients[userID]) == 0 {
				delete(s.clients, userID)
			}
		}
		delete(s.connsToUser, conn)
		conn.Close()
	}
}

func (s *Service) NotifyWidgets(tip model.TipRequest) {
	// Find UserID for Streamer
	user, err := s.db.GetUserByUsername(tip.StreamerID)
	if err != nil {
		s.logger.Printf("Failed to find streamer %s: %v", tip.StreamerID, err)
		return
	}

	notification := model.TipNotification{
		Type:       "TIP",
		StreamerID: tip.StreamerID,
		Sender:     tip.Sender,
		Message:    tip.Message,
		Amount:     tip.Amount,
	}

	s.clientsMu.Lock()
	defer s.clientsMu.Unlock()

	if conns, ok := s.clients[user.ID]; ok {
		for client := range conns {
			err := client.WriteJSON(notification)
			if err != nil {
				s.logger.Printf("WS write error: %v", err)
				client.Close()
				delete(conns, client)
				delete(s.connsToUser, client)
			}
		}
	}
}

func (s *Service) CheckUsernameTaken(username string, userID uint) bool {
	return s.db.CheckUsernameTaken(username, userID)
}

func (s *Service) CompleteUserProfile(userID uint, username, walletAddress string, mainWallet bool) (*dbmodel.User, string, error) {
	// Preserve existing description/bg/avatar? Or assume they are empty/unchanged?
	// For "CompleteUserProfile" usually used in signup/onboarding, so we might not have description yet.
	// But to be safe, we should probably fetch the user first if we want to preserve fields, OR check if we can pass zero values to ignore?
	// Fetch current user logic seems unnecessary if we overwrite, but let's keep it clean
	// just by removing the unused fetch if we aren't using it.
	// user, err := s.db.GetUserByUsername(username)

	// Update DB
	err := s.db.UpdateUserProfile(userID, username, "", "", "", walletAddress, mainWallet)
	if err != nil {
		return nil, "", err
	}

	// Fetch updated user
	updatedUser, err := s.db.GetUserByUsername(username)
	if err != nil {
		return nil, "", err
	}

	token, err := s.GenerateSessionToken(updatedUser)
	if err != nil {
		return nil, "", err
	}

	return updatedUser, token, nil
}

func (s *Service) UpdateProfile(userID uint, req model.UpdateProfileRequest) error {
	user, err := s.db.GetUserByID(userID)
	if err != nil {
		return err
	}

	// Update fields if provided (or overwrite if that's the contract)
	// Assuming overwrite behavior for Settings form
	user.Username = req.Username
	user.Description = req.Description
	user.BackgroundURL = req.BackgroundURL
	user.AvatarURL = req.AvatarURL

	// Use the DB method
	return s.db.UpdateUserProfile(userID, user.Username, user.Description, user.BackgroundURL, user.AvatarURL, user.WalletAddress, user.MainWallet)
}

func (s *Service) GetUserByUsername(username string) (*dbmodel.User, error) {
	return s.db.GetUserByUsername(username)
}

func (s *Service) UpdateUserWallet(userID uint, walletAddress string, chainID int, assetAddress string) error {
	return s.db.UpdateUserWallet(userID, walletAddress, chainID, assetAddress)
}

func (s *Service) RegisterUser(username, provider, providerID, email, avatar, walletAddress string, mainWallet bool, preferredChainID int, preferredAssetAddress string) (*dbmodel.User, string, error) {
	user := &dbmodel.User{
		Username:         username,
		Provider:         provider,
		ProviderID:       providerID,
		Email:            email,
		AvatarURL:        avatar,
		WalletAddress:    walletAddress,
		MainWallet:       mainWallet,
		CreatedAt:        time.Now(),
		PreferredChainID: preferredChainID,
		PreferredAsset:   preferredAssetAddress,
	}

	if err := s.CreateUser(user); err != nil {
		return nil, "", err
	}

	// Generate Session Token
	token, err := s.GenerateSessionToken(user)
	if err != nil {
		return nil, "", err
	}

	return user, token, nil
}

func (s *Service) RegenerateWidgetToken(userID uint) (string, error) {
	return s.db.RefreshWidgetToken(userID)
}

func (s *Service) UpdateWidgetConfig(userID uint, req model.UpdateWidgetRequest) error {
	return s.db.UpdateWidgetConfig(userID, req.WaitTTS, req.BgColor, req.UserColor, req.AmountColor, req.MessageColor)
}

func (s *Service) ProcessTip(tip model.TipRequest, claims *WalletClaims) (bool, string, error) {
	// 0. Blacklist Check
	if s.db.IsWalletBlacklisted(claims.WalletAddress) {
		return false, "Wallet is blacklisted.", nil
	}

	s.securityMu.Lock()
	// 1. Rate Limit Check (1 request per 5 seconds)
	lastTime, exists := s.lastTipReq[claims.WalletAddress]
	if exists && time.Since(lastTime) < 5*time.Second {
		s.securityMu.Unlock()
		return false, "Rate limit exceeded. Please wait 5 seconds.", nil
	}
	s.lastTipReq[claims.WalletAddress] = time.Now()
	s.securityMu.Unlock()

	// Initial Sanity Check (Optional: Check if tx exists pending or mined)
	// For now, we trust and verify in background to allow instant "Pending" state

	// Check if this TxHash is already processed to prevent duplicate processing
	// (Though DB unique constraint on TxHash might be better alongside ChainID)
	// Skipped complexity for now.

	// Save to DB as PENDING
	dbTip := &dbmodel.Tip{
		StreamerID:    tip.StreamerID,
		Sender:        tip.Sender,
		Message:       tip.Message,
		Amount:        tip.Amount,
		Asset:         tip.Asset,
		TxHash:        tip.TxHash,
		ChainID:       tip.ChainID,
		SourceChain:   tip.SourceChain,
		DestChain:     tip.DestChain,
		SourceAddress: tip.SourceAddress,
		DestAddress:   tip.DestAddress,
		Status:        "pending",
	}

	if err := s.db.CreateTip(dbTip); err != nil {
		s.logger.Printf("Failed to save pending tip to DB: %v", err)
		return false, "", fmt.Errorf("failed to save tip: %v", err)
	}

	// Launch Background Verification
	go s.monitorTransaction(dbTip.ID, tip.ChainID, tip.TxHash, claims.WalletAddress, tip.Amount, tip.Asset, tip)

	return true, "Tip received! Waiting for transaction confirmation...", nil
}

func (s *Service) GetTips(username string, limit int, cursor uint) ([]model.TipResponseItem, string, error) {
	tips, err := s.db.GetTipsPaginated(username, limit, cursor)
	if err != nil {
		return nil, "", err
	}

	var nextCursor string
	if len(tips) > 0 {
		lastTip := tips[len(tips)-1]
		nextCursor = fmt.Sprintf("%d", lastTip.ID)
		if len(tips) < limit {
			nextCursor = ""
		}
	}

	responseItems := make([]model.TipResponseItem, 0, len(tips))
	for _, t := range tips {
		responseItems = append(responseItems, model.TipResponseItem{
			CreatedAt:   t.CreatedAt.Format(time.RFC3339),
			Sender:      t.Sender,
			Message:     t.Message,
			Amount:      t.Amount,
			Asset:       t.Asset,
			TxHash:      t.TxHash,
			SourceChain: t.SourceChain,
			Status:      t.Status,
		})
	}

	return responseItems, nextCursor, nil
}

// monitorTransaction polls for the transaction receipt
func (s *Service) monitorTransaction(tipID uint, chainID, txHash, sender, amount, asset string, originalTip model.TipRequest) {
	// Timeout after 1 hour
	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Hour)
	defer cancel()

	ticker := time.NewTicker(5 * time.Second) // Poll every 5s
	defer ticker.Stop()

	// Connect to RPC
	rpcURL, ok := ChainRPCs[chainID]
	if !ok {
		s.logger.Printf("Unsupported chain ID for monitoring: %s", chainID)
		s.db.UpdateTipStatus(tipID, "failed")
		return
	}

	client, err := ethclient.Dial(rpcURL)
	if err != nil {
		s.logger.Printf("Failed to dial RPC for monitoring: %v", err)
		s.db.UpdateTipStatus(tipID, "failed")
		return
	}
	defer client.Close()

	for {
		select {
		case <-ctx.Done():
			s.logger.Printf("Transaction monitoring timed out for tip %d (tx: %s)", tipID, txHash)
			s.db.UpdateTipStatus(tipID, "failed")
			return
		case <-ticker.C:
			// Check Receipt
			verified, err := s.checkTxStatus(client, txHash, sender)
			if err != nil {
				// Special case: If error is strictly "not found", we keep waiting (pending)
				// If error is "failed" (status 0) or sender mismatch, we stop.

				if errors.Is(err, ErrTxNotFound) {
					// Still pending, continue polling
					continue
				}

				// Determine if it is a permanent failure
				if strings.Contains(err.Error(), "transaction failed") || errors.Is(err, ErrSenderMismatch) {
					s.logger.Printf("Transaction verification failed for tip %d: %v", tipID, err)
					s.db.UpdateTipStatus(tipID, "failed")
					return
				}

				// Other temporary RPC errors? Log and continue
				s.logger.Printf("RPC error checking tip %d: %v", tipID, err)
				continue
			}

			if verified {
				s.logger.Printf("Transaction confirmed for tip %d", tipID)
				s.db.UpdateTipStatus(tipID, "confirmed")
				s.NotifyWidgets(originalTip)
				return
			}
		}
	}
}

// checkTxStatus checks validity in a single pass
func (s *Service) checkTxStatus(client *ethclient.Client, txHash string, expectedSender string) (bool, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	hash := common.HexToHash(txHash)

	// 1. Check Receipt Status
	receipt, err := client.TransactionReceipt(ctx, hash)
	if err != nil {
		// go-ethereum returns unexpored error for not found usually
		return false, ErrTxNotFound
	}

	if receipt.Status != 1 {
		return false, fmt.Errorf("transaction failed (status: 0)")
	}

	// 2. Check Sender (Re-verify strictness)
	tx, _, err := client.TransactionByHash(ctx, hash)
	if err != nil {
		return false, fmt.Errorf("failed to get tx details: %v", err)
	}

	from, err := types.Sender(types.LatestSignerForChainID(tx.ChainId()), tx)
	if err != nil {
		return false, fmt.Errorf("failed to recover sender: %v", err)
	}

	if !strings.EqualFold(from.Hex(), expectedSender) {
		return false, fmt.Errorf("%w: tx.from=%s, expected=%s", ErrSenderMismatch, from.Hex(), expectedSender)
	}

	return true, nil
}

func (s *Service) IsSignatureUsed(signature string) bool {
	return s.db.IsSignatureUsed(signature)
}

func (s *Service) MarkSignatureUsed(signature string) error {
	return s.db.MarkSignatureUsed(signature)
}

func (s *Service) GetUserByProviderID(provider, providerID string) (*dbmodel.User, error) {
	return s.db.GetUserByProviderID(provider, providerID)
}

func (s *Service) CreateUser(user *dbmodel.User) error {
	return s.db.CreateUser(user)
}

func (s *Service) IsWalletBlacklisted(address string) bool {
	return s.db.IsWalletBlacklisted(address)
}

func (s *Service) CleanupExpiredSessions() error {
	return s.db.CleanupExpiredSessions()
}
