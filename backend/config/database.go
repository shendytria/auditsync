package config

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

var DB *pgxpool.Pool

func ConnectDB() {

	// load .env hanya kalau ada (untuk local dev)
	_ = godotenv.Load("../.env")
	_ = godotenv.Load(".env")

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL tidak ditemukan di ENV (Docker atau .env)")
	}

	dbpool, err := pgxpool.New(context.Background(), dbURL)
	if err != nil {
		log.Fatalf("Tidak dapat membuat koneksi pool: %v\n", err)
	}

	if err = dbpool.Ping(context.Background()); err != nil {
		log.Fatalf("Tidak dapat terhubung ke database: %v\n", err)
	}

	fmt.Println("Berhasil terhubung ke database PostgreSQL!")
	DB = dbpool
}
