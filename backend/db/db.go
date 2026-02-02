package db

import (
	"fmt"
	"log"
	"time"

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
	return d.conn.AutoMigrate(&model.User{})
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
	if err = d.conn.Where("provider = ? AND provider_id = ?", provider, providerID).First(user).Error; err != nil {
		return nil, err
	}
	return
}

func (d *Database) CreateUser(user *model.User) error {
	return d.conn.Create(user).Error
}

func (d *Database) UpdateUserWallet(userID uint, ethAddress string) error {
	return d.conn.Model(&model.User{}).Where("id = ?", userID).Update("eth_address", ethAddress).Error
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
