package middleware

import (
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// --- PERBAIKAN: GUNAKAN KEY YANG SAMA DENGAN UTILS/TOKEN.GO ---
func getMiddlewareJWTKey() []byte {
	// Cek ENV dulu
	jwtKey := os.Getenv("JWT_SECRET_KEY")
	if jwtKey == "" {
		// Jika kosong, gunakan default yang SAMA PERSIS dengan utils/token.go Anda
		return []byte("kunci_rahasia_development_ganti_nanti")
	}
	return []byte(jwtKey)
}

func RequireAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")

		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Authorization header is required"})
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenString == authHeader {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid token format"})
			return
		}

		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			// Panggil fungsi key yang sudah disamakan
			return getMiddlewareJWTKey(), nil
		})

		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			return
		}

		if claims, ok := token.Claims.(jwt.MapClaims); ok {
			// Utils Anda menyimpan user_id sebagai int64 di JSON "user_id"
			var userIDString string

			// Cek berbagai kemungkinan key claim
			if uid, exists := claims["user_id"]; exists {
				userIDString = fmt.Sprintf("%v", uid)
			} else if id, exists := claims["id"]; exists {
				userIDString = fmt.Sprintf("%v", id)
			}

			if userIDString != "" {
				// Simpan ke context
				c.Set("userID", userIDString)
			}

			if role, exists := claims["role"]; exists {
				c.Set("role", role)
			}
		}

		c.Next()
	}
}
