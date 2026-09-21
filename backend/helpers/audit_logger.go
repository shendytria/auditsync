package helpers

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/vaneshadhani/e-audit-backend/config"
)

// Tambahkan parameter variadic "...string" di akhir untuk manualUserID
func CreateAuditLog(c *gin.Context, action string, entity string, entityID string, oldVal interface{}, newVal interface{}, manualUserID ...string) {

	var userID string

	// 1. Cek apakah ada UserID manual yang dikirim (Khusus Login)
	if len(manualUserID) > 0 && manualUserID[0] != "" {
		userID = manualUserID[0]
	} else {
		// 2. Jika tidak ada manual, ambil dari Token/Context (Untuk aksi lain)
		if val, exists := c.Get("userID"); exists {
			userID = fmt.Sprintf("%v", val)
		} else {
			// Jika gagal ambil dari context, set NULL atau 0
			userID = "0"
		}
	}

	// Ambil IP Address
	ip := c.ClientIP()

	// Convert changes ke JSON
	oldJson, _ := json.Marshal(oldVal)
	newJson, _ := json.Marshal(newVal)

	// Simpan ke Database
	// Pastikan query ini sesuai tabel Anda. Note: Kita simpan userID sebagai String.
	query := `
		INSERT INTO audit_logs (user_id, action, entity_name, entity_id, old_values, new_values, ip_address, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`

	_, err := config.DB.Exec(context.Background(), query, userID, action, entity, entityID, oldJson, newJson, ip, time.Now())
	if err != nil {
		fmt.Println("❌ ERROR AUDIT LOG:", err)
	}
}
