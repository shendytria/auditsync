package routes

import (
	"github.com/gin-gonic/gin"
	"github.com/vaneshadhani/e-audit-backend/controllers"
	"github.com/vaneshadhani/e-audit-backend/middleware"
)

func DashboardRoutes(router *gin.RouterGroup) {
	// Kita bungkus dengan Middleware agar data aman
	protected := router.Group("/")
	protected.Use(middleware.RequireAuth())
	{
		// Endpoint: /api/dashboard
		protected.GET("/dashboard", controllers.GetDashboardData)
	}
}
