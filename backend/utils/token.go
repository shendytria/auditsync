package utils

import (
	"fmt"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type MyCustomClaims struct {
	UserID int64  `json:"user_id"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

func getJWTKey() []byte {
	jwtKey := os.Getenv("JWT_SECRET_KEY")
	if jwtKey == "" {
		fmt.Println("PERINGATAN: JWT_SECRET_KEY tidak diset. Menggunakan default.")
		return []byte("kunci_rahasia_development_ganti_nanti")
	}
	return []byte(jwtKey)
}

func GenerateToken(userID int64, role string) (string, error) {
	claims := MyCustomClaims{
		userID,
		role,
		jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
			Issuer:    "e-audit-system",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	ss, err := token.SignedString(getJWTKey())
	if err != nil {
		return "", err
	}
	return ss, nil
}

func ValidateToken(tokenString string) (*MyCustomClaims, error) {
	claims := &MyCustomClaims{}

	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("metode signing tidak terduga: %v", token.Header["alg"])
		}
		return getJWTKey(), nil
	})

	if err != nil {
		return nil, err
	}
	if !token.Valid {
		return nil, fmt.Errorf("token tidak valid")
	}
	return claims, nil
}
