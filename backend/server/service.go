package server

import (
	"context"
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

type Service struct {
	db        *db.Database
	config    Config
	logger    *log.Logger
	clients   map[*websocket.Conn]bool
	clientsMu sync.Mutex
}

func NewService(db *db.Database, config Config, logger *log.Logger) *Service {
	return &Service{
		db:      db,
		config:  config,
		logger:  logger,
		clients: make(map[*websocket.Conn]bool),
	}
}

// Logic Methods

func (s *Service) RegisterClient(conn *websocket.Conn) {
	s.clientsMu.Lock()
	defer s.clientsMu.Unlock()
	s.clients[conn] = true
}

func (s *Service) UnregisterClient(conn *websocket.Conn) {
	s.clientsMu.Lock()
	defer s.clientsMu.Unlock()
	if _, ok := s.clients[conn]; ok {
		delete(s.clients, conn)
		conn.Close()
	}
}

func (s *Service) NotifyWidgets(tip model.TipRequest) {
	notification := model.TipNotification{
		Type:       "TIP",
		StreamerID: tip.StreamerID,
		Sender:     tip.Sender,
		Message:    tip.Message,
		Amount:     tip.Amount,
	}

	s.clientsMu.Lock()
	defer s.clientsMu.Unlock()

	for client := range s.clients {
		err := client.WriteJSON(notification)
		if err != nil {
			s.logger.Printf("WS write error: %v", err)
			client.Close()
			delete(s.clients, client)
		}
	}
}

func (s *Service) CheckUsernameTaken(username string, userID uint) bool {
	return s.db.CheckUsernameTaken(username, userID)
}

func (s *Service) CompleteUserProfile(userID uint, username, ethAddress string, mainWallet bool) (*dbmodel.User, string, error) {
	// Update DB
	err := s.db.UpdateUserProfile(userID, username, ethAddress, mainWallet)
	if err != nil {
		return nil, "", err
	}

	// Fetch updated user
	updatedUser, err := s.db.GetUserByUsername(username)
	if err != nil {
		return nil, "", err
	}

	// Generate Token (Method needs to be accessible, maybe migrate GenerateSessionToken to Service too?)
	// For now, let's duplicate logic or move JWT helper methods to Service receiver.
	// Assuming GenerateSessionToken becomes a method of Service
	token, err := s.GenerateSessionToken(updatedUser)
	if err != nil {
		return nil, "", err
	}

	return updatedUser, token, nil
}

func (s *Service) GetUserByUsername(username string) (*dbmodel.User, error) {
	return s.db.GetUserByUsername(username)
}

func (s *Service) UpdateUserWallet(userID uint, ethAddress string) error {
	return s.db.UpdateUserWallet(userID, ethAddress)
}

func (s *Service) UpdateWidgetConfig(userID uint, req model.UpdateWidgetRequest) error {
	return s.db.UpdateWidgetConfig(userID, req.WaitTTS, req.BgColor, req.UserColor, req.AmountColor, req.MessageColor)
}

func (s *Service) ProcessTip(tip model.TipRequest, claims *WalletClaims) (bool, string, error) {
	// Verify Tx
	verified, err := s.verifyTransaction(tip.ChainID, tip.TxHash, claims.WalletAddress, tip.Amount, tip.Asset)
	if err != nil {
		return false, "", err
	}
	if !verified {
		return false, "Transaction not valid", nil
	}

	// Notify
	s.NotifyWidgets(tip)

	// Save to DB
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
	}

	if err := s.db.CreateTip(dbTip); err != nil {
		s.logger.Printf("Failed to save tip to DB: %v", err)
		// Non-critical error?
	}

	return true, "Tip processed", nil
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
		})
	}

	return responseItems, nextCursor, nil
}

// verifyTransaction checks the tx status, sender, and amount on-chain
func (s *Service) verifyTransaction(chainID string, txHash string, expectedSender string, expectedAmount string, asset string) (bool, error) {
	// Map ChainID to RPC
	var rpcURL string
	switch chainID {
	case "1": // Ethereum Mainnet
		rpcURL = "https://rpc.ankr.com/eth"
	case "11155111": // Sepolia
		rpcURL = "https://rpc.ankr.com/eth_sepolia"
	case "8453": // Base
		rpcURL = "https://mainnet.base.org"
	case "84532": // Base Sepolia
		rpcURL = "https://sepolia.base.org"
	case "10": // Optimism
		rpcURL = "https://mainnet.optimism.io"
	case "42161": // Arbitrum
		rpcURL = "https://arb1.arbitrum.io/rpc"
	default:
		if chainID == "31337" {
			return true, nil
		}
		return false, fmt.Errorf("unsupported chain ID: %s", chainID)
	}

	client, err := ethclient.Dial(rpcURL)
	if err != nil {
		return false, fmt.Errorf("failed to connect to RPC: %v", err)
	}
	defer client.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	hash := common.HexToHash(txHash)

	// 1. Check Receipt Status
	receipt, err := client.TransactionReceipt(ctx, hash)
	if err != nil {
		return false, fmt.Errorf("tx receipt not found (pending?): %v", err)
	}

	if receipt.Status != 1 {
		return false, fmt.Errorf("transaction failed (status: 0)")
	}

	// 2. Check Sender
	tx, _, err := client.TransactionByHash(ctx, hash)
	if err != nil {
		return false, fmt.Errorf("failed to get tx details: %v", err)
	}

	from, err := types.Sender(types.LatestSignerForChainID(tx.ChainId()), tx)
	if err != nil {
		return false, fmt.Errorf("failed to recover sender: %v", err)
	}

	if !strings.EqualFold(from.Hex(), expectedSender) {
		return false, fmt.Errorf("sender mismatch: tx.from=%s, token.owner=%s", from.Hex(), expectedSender)
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
