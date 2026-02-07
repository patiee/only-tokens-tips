package server

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/gorilla/websocket"
	"github.com/patiee/backend/db"
	dbmodel "github.com/patiee/backend/db/model"
	"github.com/patiee/backend/server/model"
)

var (
	ErrTxNotFound     = errors.New("tx receipt not found")
	ErrSenderMismatch = errors.New("sender mismatch")
	ErrENSNotFound    = errors.New("ens name not found")
)

// Helper to resolve ENS name to address
// Requires ETH_RPC_URL env var or uses a default public one
func (s *Service) ResolveENS(name string) (string, error) {
	rpcURL := s.config.EthRPCURL
	if rpcURL == "" {
		rpcURL = "https://eth.llamarpc.com"
	}

	client, err := ethclient.Dial(rpcURL)
	if err != nil {
		return "", fmt.Errorf("failed to connect to eth rpc: %v", err)
	}
	defer client.Close()

	// Minimal ENS Resolution Implementation
	// 1. NameHash
	node, err := nameHash(name)
	if err != nil {
		return "", err
	}

	// 2. Get Resolver from Registry (0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e)
	registryAddr := common.HexToAddress("0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e")

	// resolver(node) signature: 0x0178b8bf
	// methodID + node
	data := append(common.Hex2Bytes("0178b8bf"), node[:]...)

	res, err := client.CallContract(context.Background(), ethereum.CallMsg{
		To:   &registryAddr,
		Data: data,
	}, nil)
	if err != nil {
		return "", fmt.Errorf("registry call failed: %v", err)
	}

	resolverAddr := common.BytesToAddress(res)
	if resolverAddr == (common.Address{}) {
		return "", ErrENSNotFound
	}

	// 3. Get Address from Resolver
	// addr(node) signature: 0x3b3b57de
	data = append(common.Hex2Bytes("3b3b57de"), node[:]...)

	res, err = client.CallContract(context.Background(), ethereum.CallMsg{
		To:   &resolverAddr,
		Data: data,
	}, nil)
	if err != nil {
		return "", fmt.Errorf("resolver call failed: %v", err)
	}

	targetAddr := common.BytesToAddress(res)
	if targetAddr == (common.Address{}) {
		return "", ErrENSNotFound
	}

	return targetAddr.Hex(), nil
}

// NameHash implementation
func nameHash(name string) ([32]byte, error) {
	var hash [32]byte
	if name == "" {
		return hash, nil
	}
	parts := strings.Split(name, ".")
	for i := len(parts) - 1; i >= 0; i-- {
		labelHash := crypto.Keccak256Hash([]byte(parts[i]))
		data := append(hash[:], labelHash.Bytes()...)
		hash = crypto.Keccak256Hash(data)
	}
	return hash, nil
}

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

func (s *Service) RegisterUser(username, provider, providerID, email, avatar, walletAddress string, mainWallet bool, preferredChainID int, preferredAssetAddress, description, background, twitter string) (*dbmodel.User, string, error) {
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
		Description:      description,
		BackgroundURL:    background,
		TwitterHandle:    twitter,
		WidgetTTS:        true,
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

	ticker := time.NewTicker(10 * time.Second) // Poll every 10s (relaxed)
	defer ticker.Stop()

	rpcURL, ok := ChainRPCs[chainID]
	if !ok {
		s.logger.Printf("Unsupported chain ID for monitoring: %s", chainID)
		s.db.UpdateTipStatus(tipID, "failed")
		return
	}

	for {
		select {
		case <-ctx.Done():
			s.logger.Printf("Transaction monitoring timed out for tip %d (tx: %s)", tipID, txHash)
			s.db.UpdateTipStatus(tipID, "failed")
			return
		case <-ticker.C:
			var verified bool
			var err error

			switch chainID {
			case "100001": // Bitcoin
				verified, err = s.checkBitcoinTx(rpcURL, txHash, amount)
			case "100002": // Solana
				verified, err = s.checkSolanaTx(rpcURL, txHash, sender)
			case "100003": // Sui
				verified, err = s.checkSuiTx(rpcURL, txHash, sender)
			default: // EVM
				verified, err = s.checkEvmTx(rpcURL, txHash, sender)
			}

			if err != nil {
				// Special case: If error is strictly "not found", we keep waiting (pending)
				if errors.Is(err, ErrTxNotFound) {
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

// checkEvmTx checks validity for EVM chains
func (s *Service) checkEvmTx(rpcURL string, txHash string, expectedSender string) (bool, error) {
	client, err := ethclient.Dial(rpcURL)
	if err != nil {
		return false, fmt.Errorf("failed to connect to RPC: %v", err)
	}
	defer client.Close()

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
		return false, fmt.Errorf("%w: tx.from=%s, expected=%s", ErrSenderMismatch, from.Hex(), expectedSender)
	}

	return true, nil
}

// checkBitcoinTx checks validity via Mempool.space API
func (s *Service) checkBitcoinTx(apiURL string, txHash string, expectedAmount string) (bool, error) {
	// GET /tx/:txid/status
	resp, err := http.Get(fmt.Sprintf("%s/tx/%s/status", apiURL, txHash))
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == 404 {
		return false, ErrTxNotFound
	}

	if resp.StatusCode != 200 {
		return false, fmt.Errorf("API error: %d", resp.StatusCode)
	}

	var status struct {
		Confirmed   bool   `json:"confirmed"`
		BlockHash   string `json:"block_hash"`
		BlockHeight int    `json:"block_height"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&status); err != nil {
		return false, err
	}

	if !status.Confirmed {
		return false, ErrTxNotFound // Treat unconfirmed as not found/pending for our logic
	}

	return true, nil
}

// checkSolanaTx checks validity via Solana JSON-RPC
func (s *Service) checkSolanaTx(rpcURL string, txHash string, expectedSender string) (bool, error) {
	payload := map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      1,
		"method":  "getTransaction",
		"params": []interface{}{
			txHash,
			map[string]interface{}{
				"encoding":                       "jsonParsed",
				"maxSupportedTransactionVersion": 0,
			},
		},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return false, err
	}

	resp, err := http.Post(rpcURL, "application/json", bytes.NewBuffer(body))
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()

	var result struct {
		Result *struct {
			Meta *struct {
				Err interface{} `json:"err"`
			} `json:"meta"`
			Transaction *struct {
				Message *struct {
					AccountKeys []struct {
						Pubkey string `json:"pubkey"`
						Signer bool   `json:"signer"`
					} `json:"accountKeys"`
				} `json:"message"`
			} `json:"transaction"`
		} `json:"result"`
		Error *struct {
			Code    int    `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return false, err
	}

	if result.Error != nil {
		return false, fmt.Errorf("RPC error: %s", result.Error.Message)
	}

	if result.Result == nil {
		return false, ErrTxNotFound
	}

	if result.Result.Meta.Err != nil {
		return false, fmt.Errorf("transaction failed on-chain")
	}

	// Check Sender (First signer)
	if result.Result.Transaction != nil && result.Result.Transaction.Message != nil {
		for _, key := range result.Result.Transaction.Message.AccountKeys {
			if key.Signer {
				if key.Pubkey == expectedSender {
					return true, nil
				}
				if key.Pubkey == expectedSender {
					return true, nil
				}
			}
		}
		return false, fmt.Errorf("%w: expected %s", ErrSenderMismatch, expectedSender)
	}

	return true, nil
}

// checkSuiTx checks validity via Sui JSON-RPC
func (s *Service) checkSuiTx(rpcURL string, txHash string, expectedSender string) (bool, error) {
	payload := map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      1,
		"method":  "sui_getTransactionBlock",
		"params": []interface{}{
			txHash,
			map[string]interface{}{
				"showEffects": true,
				"showInput":   true,
			},
		},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return false, err
	}

	resp, err := http.Post(rpcURL, "application/json", bytes.NewBuffer(body))
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()

	var result struct {
		Result *struct {
			Effects *struct {
				Status struct {
					Status string `json:"status"`
					Error  string `json:"error"`
				} `json:"status"`
			} `json:"effects"`
			Transaction *struct {
				Data *struct {
					Sender string `json:"sender"`
				} `json:"data"`
			} `json:"transaction"`
		} `json:"result"`
		Error *struct {
			Code    int    `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return false, err
	}

	if result.Error != nil {
		return false, ErrTxNotFound
	}

	if result.Result == nil {
		return false, ErrTxNotFound
	}

	if result.Result.Effects.Status.Status != "success" {
		return false, fmt.Errorf("transaction failed: %s", result.Result.Effects.Status.Error)
	}

	if result.Result.Transaction.Data.Sender != expectedSender {
		return false, fmt.Errorf("%w: expected %s, got %s", ErrSenderMismatch, expectedSender, result.Result.Transaction.Data.Sender)
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
