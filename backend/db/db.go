package db

import (
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/patiee/backend/db/model"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type Database struct {
	logger *log.Logger
	conn   *gorm.DB
}

func New(logger *log.Logger) *Database {
	return &Database{logger: logger}
}

func (d *Database) Init(dsn string) (err error) {
	d.conn, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		d.logger.Printf("Failed to connect to database: %v. Retrying in 5s...", err)
		time.Sleep(5 * time.Second)
		d.conn, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
		if err != nil {
			return fmt.Errorf("could not connect to database: %w", err)
		}
	}

	d.logger.Println("Database connected successfully")

	// Migrate the schema
	return d.conn.AutoMigrate(&model.User{}, &model.Tip{}, &model.UsedSignature{}, &model.WalletSession{}, &model.UserSession{})
}

func (d *Database) GetUserByID(id uint) (user *model.User, err error) {
	user = &model.User{}
	if err = d.conn.First(user, id).Error; err != nil {
		return nil, err
	}
	return
}

func (d *Database) GetUserByUsername(username string) (user *model.User, err error) {
	user = &model.User{}
	if err = d.conn.Where("username = ?", username).First(user).Error; err != nil {
		return nil, err
	}
	return
}

func (d *Database) GetUserByProviderID(provider, providerID string) (user *model.User, err error) {
	user = &model.User{}
	query := d.conn

	switch provider {
	case "google":
		query = query.Where("google_id = ? OR (provider = 'google' AND provider_id = ?)", providerID, providerID)
	case "twitch":
		query = query.Where("twitch_id = ? OR (provider = 'twitch' AND provider_id = ?)", providerID, providerID)
	case "kick":
		query = query.Where("kick_id = ? OR (provider = 'kick' AND provider_id = ?)", providerID, providerID)
	default:
		query = query.Where("provider = ? AND provider_id = ?", provider, providerID)
	}

	if err = query.First(user).Error; err != nil {
		return nil, err
	}
	return
}

func (d *Database) LinkProvider(userID uint, provider, providerID string) error {
	var column string
	switch provider {
	case "google":
		column = "google_id"
	case "twitch":
		column = "twitch_id"
	case "kick":
		column = "kick_id"
	default:
		return fmt.Errorf("unsupported provider for linking: %s", provider)
	}

	return d.conn.Model(&model.User{}).Where("id = ?", userID).Update(column, providerID).Error
}

func (d *Database) CreateUser(user *model.User) error {
	if user.WidgetToken == "" {
		user.WidgetToken = uuid.New().String()
	}
	return d.conn.Create(user).Error
}

func (d *Database) GetUserByWalletAddress(address string) (*model.User, error) {
	var user model.User
	if err := d.conn.Where("eth_address = ?", address).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (d *Database) GetUserByWidgetToken(token string) (*model.User, error) {
	var user model.User
	if err := d.conn.Where("widget_token = ?", token).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (d *Database) UpdateUserWallet(userID uint, walletAddress string, chainID int, assetAddress string) error {
	updates := map[string]interface{}{
		"eth_address":        walletAddress,
		"preferred_chain_id": chainID,
		"preferred_asset":    assetAddress,
	}
	return d.conn.Model(&model.User{}).Where("id = ?", userID).Updates(updates).Error
}

func (d *Database) UpdateUserProfile(userID uint, username, description, backgroundURL, avatarURL, walletAddress string, mainWallet bool) error {
	updates := map[string]interface{}{
		"username":       username,
		"description":    description,
		"background_url": backgroundURL,
		"avatar_url":     avatarURL,
		"eth_address":    walletAddress,
		"main_wallet":    mainWallet,
	}
	return d.conn.Model(&model.User{}).Where("id = ?", userID).Updates(updates).Error
}

func (d *Database) CheckUsernameTaken(username string, excludeUserID uint) bool {
	var count int64
	d.conn.Model(&model.User{}).Where("username = ? AND id != ?", username, excludeUserID).Count(&count)
	return count > 0
}

func (d *Database) UpdateWidgetConfig(userID uint, tts bool, bg, userColor, amountColor, msgColor string) error {
	return d.conn.Model(&model.User{}).Where("id = ?", userID).Updates(map[string]interface{}{
		"widget_tts":           tts,
		"widget_bg_color":      bg,
		"widget_user_color":    userColor,
		"widget_amount_color":  amountColor,
		"widget_message_color": msgColor,
	}).Error
}

func (d *Database) CreateTip(tip *model.Tip) error {
	return d.conn.Create(tip).Error
}

func (d *Database) GetTipsPaginated(streamerID string, limit int, cursor uint) ([]model.Tip, error) {
	var tips []model.Tip
	query := d.conn.Where("streamer_id = ?", streamerID).Order("id desc").Limit(limit)

	if cursor > 0 {
		query = query.Where("id < ?", cursor)
	}

	err := query.Find(&tips).Error
	return tips, err
}

func (d *Database) IsSignatureUsed(signature string) bool {
	var count int64
	d.conn.Model(&model.UsedSignature{}).Where("signature = ?", signature).Count(&count)
	return count > 0
}

func (d *Database) MarkSignatureUsed(signature string) error {
	return d.conn.Create(&model.UsedSignature{
		Signature: signature,
		CreatedAt: time.Now(),
	}).Error
}

func (d *Database) SaveWalletSession(session *model.WalletSession) error {
	return d.conn.Create(session).Error
}

func (d *Database) GetWalletSession(token string) (*model.WalletSession, error) {
	var session model.WalletSession
	if err := d.conn.Where("token = ?", token).First(&session).Error; err != nil {
		return nil, err
	}
	return &session, nil
}

func (d *Database) SaveUserSession(session *model.UserSession) error {
	return d.conn.Create(session).Error
}

func (d *Database) GetUserSession(token string) (*model.UserSession, error) {
	var session model.UserSession
	if err := d.conn.Where("token = ?", token).First(&session).Error; err != nil {
		return nil, err
	}
	return &session, nil
}
func (d *Database) RevokeWalletSessions(walletAddress string) error {
	return d.conn.Where("wallet_address = ?", walletAddress).Delete(&model.WalletSession{}).Error
}

func (d *Database) BlacklistWallet(address string, reason string, duration time.Duration) error {
	return d.conn.Create(&model.WalletBlacklist{
		WalletAddress: address,
		Reason:        reason,
		CreatedAt:     time.Now(),
		ExpiresAt:     time.Now().Add(duration),
	}).Error
}

func (d *Database) IsWalletBlacklisted(address string) bool {
	var count int64
	d.conn.Model(&model.WalletBlacklist{}).
		Where("wallet_address = ? AND expires_at > ?", address, time.Now()).
		Count(&count)
	return count > 0
}

func (d *Database) CleanupExpiredSessions() error {
	now := time.Now()
	// Clean Wallet Sessions
	if err := d.conn.Where("expires_at < ?", now).Delete(&model.WalletSession{}).Error; err != nil {
		d.logger.Printf("Error cleaning wallet sessions: %v", err)
	}
	// Clean User Sessions
	if err := d.conn.Where("expires_at < ?", now).Delete(&model.UserSession{}).Error; err != nil {
		d.logger.Printf("Error cleaning user sessions: %v", err)
	}
	// Clean Blacklist (Expired bans)
	if err := d.conn.Where("expires_at < ?", now).Delete(&model.WalletBlacklist{}).Error; err != nil {
		d.logger.Printf("Error cleaning blacklist: %v", err)
	}
	return nil
}

func (d *Database) EnsureWidgetTokens() error {
	var users []model.User
	if err := d.conn.Where("widget_token = '' OR widget_token IS NULL").Find(&users).Error; err != nil {
		return err
	}

	for _, user := range users {
		user.WidgetToken = uuid.New().String()
		if err := d.conn.Save(&user).Error; err != nil {
			d.logger.Printf("Failed to generate widget token for user %s: %v", user.Username, err)
		}
	}
	return nil
}
func (d *Database) RefreshWidgetToken(userID uint) (string, error) {
	newToken := uuid.New().String()
	err := d.conn.Model(&model.User{}).Where("id = ?", userID).Update("widget_token", newToken).Error
	if err != nil {
		return "", err
	}
	return newToken, nil
}
