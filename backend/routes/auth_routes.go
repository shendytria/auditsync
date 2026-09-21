package routes

import (
	"github.com/gin-gonic/gin"
	"github.com/ulule/limiter/v3"
	"github.com/ulule/limiter/v3/drivers/store/memory"
	mgin "github.com/ulule/limiter/v3/drivers/middleware/gin"
	"github.com/vaneshadhani/e-audit-backend/controllers"
	"github.com/vaneshadhani/e-audit-backend/middleware"
)

func AuthRoutes(router *gin.RouterGroup) {
	// Rate limiter: 5 percobaan per menit per IP untuk endpoint sensitif
	rate, _ := limiter.NewRateFromFormatted("5-M")
	store := memory.NewStore()
	authLimiter := mgin.NewMiddleware(limiter.New(store, rate))

	// 1. PUBLIC (Login)
	v1 := router.Group("/v1")
	{
		v1.POST("/login", authLimiter, controllers.LoginController)
		v1.POST("/forgot-password", authLimiter, controllers.ForgotPassword)
		v1.POST("/reset-password", authLimiter, controllers.ResetPassword)
	}

	// 2. PROTECTED (User Management)
	protected := router.Group("/")
	protected.Use(middleware.RequireAuth()) // Pasang Satpam

	// PERHATIKAN: Pakai variabel 'protected', bukan 'router'
	{
		protected.GET("/users", controllers.GetUsers)
		protected.POST("/users", controllers.CreateUser)
		protected.DELETE("/users/:id", controllers.DeleteUser)

		protected.GET("/users/:id", controllers.GetAUser)
		protected.PUT("/users/:id", controllers.UpdateUser) // <--- Ini yang bikin audit log jalan
		protected.PUT("/users/:id/change-password", controllers.ChangePassword)
	}
}
