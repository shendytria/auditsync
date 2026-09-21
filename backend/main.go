package main

import (
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/vaneshadhani/e-audit-backend/config"
	"github.com/vaneshadhani/e-audit-backend/helpers"
	"github.com/vaneshadhani/e-audit-backend/routes"
)

func main() {
	// 1. Cukup bikin SATU router saja
	router := gin.Default()

	config.ConnectDB()

	// 2. Setup CORS (sudah benar)
	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000", "https://auditsync.kalbeconsumerhealth.com"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	api := router.Group("/api")
	{
		routes.AuthRoutes(api)
		routes.SettingRoutes(api)
		routes.AuditRoutes(api)
		routes.DashboardRoutes(api)

		api.GET("/test-email", func(c *gin.Context) {
			err := helpers.SendResetEmail("emailkamu@gmail.com", "test123")

			if err != nil {
				c.JSON(500, gin.H{
					"message": "Gagal kirim email",
					"error":   err.Error(),
				})
				return
			}

			c.JSON(200, gin.H{
				"message": "Email berhasil dikirim",
			})
		})
	}
	router.Static("/uploads", "./uploads")
	router.Run(":8080")
}
