package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// OnlyAuditor memastikan hanya user dengan role AUDITOR yang bisa lewat
func OnlyAuditor() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 1. Ambil data role dari context
		// Pastikan di middleware Auth Utama, Anda melakukan: c.Set("user_role", roleName)
		role, exists := c.Get("user_role")

		// 2. Cek eksistensi
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized: Data role tidak ditemukan"})
			c.Abort()
			return
		}

		// 3. Konversi tipe data (Type Assertion) dan validasi
		// Kita gunakan strings.TrimSpace untuk menghindari error spasi
		roleStr, ok := role.(string)
		if !ok || strings.ToUpper(strings.TrimSpace(roleStr)) != "AUDITOR" {
			c.JSON(http.StatusForbidden, gin.H{
				"error": "Forbidden: Akses ditolak. Role Anda: " + roleStr,
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// TIPS: Agar lebih fleksibel untuk Dashboard Anda, buat middleware "RoleCheck" umum
func RoleCheck(allowedRoles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		role, _ := c.Get("user_role")
		roleStr := strings.ToUpper(strings.TrimSpace(role.(string)))

		for _, r := range allowedRoles {
			if roleStr == strings.ToUpper(r) {
				c.Next()
				return
			}
		}

		c.JSON(http.StatusForbidden, gin.H{"error": "Akses terbatas untuk role tertentu"})
		c.Abort()
	}
}
