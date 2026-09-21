package routes

import (
	"github.com/gin-gonic/gin"
	"github.com/vaneshadhani/e-audit-backend/controllers"
	"github.com/vaneshadhani/e-audit-backend/middleware"
)

func SettingRoutes(router *gin.RouterGroup) {
	setting := router.Group("/setting")
	setting.Use(middleware.RequireAuth())
	{
		setting.POST("/checklists", controllers.CreateChecklist)
		setting.GET("/checklists", controllers.GetChecklists)
		setting.GET("/checklists/:id/items", controllers.GetChecklistItems)

		setting.GET("/checklists/:id", controllers.GetChecklist)
		setting.PUT("/checklists/:id", controllers.UpdateChecklist)
		setting.DELETE("/checklists/:id", controllers.DeleteChecklist)

		setting.GET("/areas", controllers.GetAreas)
		setting.POST("/areas", controllers.CreateArea)
		setting.DELETE("/areas/:id", controllers.DeleteArea)
		setting.GET("/areas/:id", controllers.GetArea)
		setting.PUT("/areas/:id", controllers.UpdateArea)

		setting.GET("/sites", controllers.GetSites)

		// --- TAMBAHKAN BARIS INI ---
		setting.GET("/roles", controllers.GetAllRoles)
		// ---------------------------

		setting.GET("/departments", controllers.GetDepartments)
		setting.GET("/jenis_audit", controllers.GetJenisAudit)
		setting.GET("/departments-by-jenis/:id", controllers.GetDepartmentsByJenis)
		setting.GET("/areas-by-filter", controllers.GetAreasByFilter)

		setting.PUT("/checklists/items/:id", controllers.UpdateChecklistItem)
		setting.DELETE("/checklists/items/:id", controllers.DeleteChecklistItem)

		setting.GET("/areas/all-relations", controllers.GetAreasWithRelations)

		// Tambahkan di dalam group setting atau admin
		setting.GET("/delegation/list", controllers.GetDelegationList)
		setting.PUT("/delegation/update/:id", controllers.UpdateDelegation)
	}
}
