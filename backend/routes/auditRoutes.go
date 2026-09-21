package routes

import (
	"github.com/gin-gonic/gin"
	"github.com/vaneshadhani/e-audit-backend/controllers"
	"github.com/vaneshadhani/e-audit-backend/middleware"
)

// Pastikan parameternya *gin.RouterGroup (Bukan *gin.Engine)
func AuditRoutes(router *gin.RouterGroup) {

	// Membuat sub-group URL "/audit". Jadi nanti aksesnya: /api/audit/...
	audit := router.Group("/audit")

	// Middleware Auth
	audit.Use(middleware.RequireAuth())

	{
		// ==========================================
		// A. STATIC ROUTES (PRIORITAS TINGGI)
		// ==========================================

		// Modul 1: List & Create
		audit.GET("/aktif", controllers.GetAuditAktif)
		audit.POST("/create", controllers.CreateAudit)

		// Modul 2, 3, 4, 5: Masterlists
		audit.GET("/laporan-temuan/auditor-masterlist", controllers.GetAuditorMasterlist)
		audit.GET("/review-qs/masterlist", controllers.GetReviewQSMasterlist)
		audit.GET("/capa/masterlist", controllers.GetCAPAMasterlist)

		// Modul Laporan Bukti Perbaikan (User Upload)
		audit.GET("/evidence/masterlist", controllers.GetEvidenceMasterlist)
		audit.POST("/:id/upload-evidence/:itemId", controllers.UploadEvidence)
		audit.POST("/:id/close-audit", controllers.SubmitPerbaikanToVerification)

		// Modul Verifikasi Bukti Perbaikan (Verifikator)
		audit.GET("/verification-evidence/masterlist", controllers.GetEvidenceVerifList)

		// Utilities
		audit.GET("/utility/ping", controllers.PingLaporan)
		audit.GET("/verification/masterlist", controllers.GetVerificationMasterlist)

		// ==========================================
		// B. DYNAMIC ROUTES (WILDCARD /:id)
		// ==========================================

		// --- 1. DETAILS & CRUD HEADER ---
		audit.GET("/:id/details", controllers.GetAuditExecutionData)
		audit.GET("/:id", controllers.GetAuditByID)
		audit.PUT("/:id", controllers.UpdateAudit)
		audit.DELETE("/:id", controllers.DeleteAudit)

		// --- 2. ACTION MODUL 1 (PELAKSANAAN) ---
		audit.POST("/:id/save-draft", controllers.SaveAuditDraft)
		audit.POST("/:id/submit", controllers.SubmitAuditFinal)
		audit.POST("/:id/submit-final", controllers.SubmitAuditFinal) // Alias
		audit.POST("/:id/finish", controllers.SubmitAuditFinal)       // Alias

		// --- 3. ACTION MODUL 2 (LAPORAN TEMUAN) ---
		audit.GET("/laporan-temuan/detailed/:id", controllers.GetTemuanByPelaksanaanDetailed)
		audit.POST("/draft-laporan/:id", controllers.SaveLaporanDraft)
		audit.POST("/:id/save-draft-laporan", controllers.SaveLaporanDraft)
		audit.POST("/submit-laporan/:id", controllers.SubmitLaporanFinal)
		audit.POST("/:id/submit-laporan", controllers.SubmitLaporanFinal)
		audit.POST("/:id/submit-laporan/:subId", controllers.SubmitLaporanFinal)

		// --- 4. ACTION MODUL 3 (REVIEW QS) ---
		audit.POST("/:id/update-item-qs", controllers.UpdateLaporanItemQS)
		audit.POST("/:id/approve-qs", controllers.ApproveReviewQS)
		audit.POST("/review-qs-approve-full/:id", controllers.ApproveReviewQS)

		audit.PUT("/review-qs-update/:id/item/:itemId", controllers.UpdateTemuanQS)
		audit.POST("/review-qs-approve-pic/:id/item/:itemId", controllers.ApproveTemuanToPIC)

		// --- 5. ACTION MODUL 4 (CAPA - TINDAK LANJUT) ---
		audit.POST("/:id/assign-pic-start", controllers.AssignPICAndStart)
		audit.POST("/capa-assign/:id", controllers.AssignPICAndStart)

		audit.POST("/:id/reject-capa", controllers.RejectCapaToAuditor)
		audit.POST("/capa-reject/:id", controllers.RejectCapaToAuditor)

		audit.POST("/:id/capa-item/:itemId", controllers.SaveCapaItemDraft)
		audit.POST("/capa-item-draft/:id/item/:itemId", controllers.SaveCapaItemDraft)

		audit.POST("/:id/submit-capa", controllers.SubmitCAPA)
		audit.POST("/capa-submit-final/:id", controllers.SubmitCAPA)

		audit.GET("/:id/assignable-users", middleware.RequireAuth(), controllers.GetAssignableUsersForCAPA)

		// --- 6. ACTION FINAL (VERIFICATION - APPROVAL BERJENJANG) ---
		audit.POST("/verification-final-submit/:id", controllers.ProcessFinalApproval)
		audit.POST("/verify-item-status/:id", controllers.VerifyItemStatus)

		// --- 7. VERIFICATION ITEM ACTIONS (UPDATED) ---
		// Route ini dipanggil oleh tombol Centang/Silang di Verifikasi Auditor
		audit.POST("/:id/item/:itemId/approve", controllers.ApproveVerificationItem)
		audit.POST("/:id/item/:itemId/reject", controllers.RejectVerificationItem)

		// Reset status
		audit.POST("/:id/item/:itemId/reset", controllers.VerifyItemReset)

		// Legacy alias
		audit.POST("/item-action/:approveId/item/:itemId/approve", controllers.ApproveVerificationItem)
		audit.POST("/item-action/:approveId/item/:itemId/reject", controllers.RejectVerificationItem)

		audit.GET("/verification-evidence/:id/detail", controllers.GetEvidenceVerifDetail)

		// Upload & Submit Verification (Submit verif to final)
		audit.POST("/:id/upload-verification/:itemId", controllers.UploadVerificatorEvidence)
		audit.POST("/:id/submit-verification", controllers.SubmitVerifikasiToFinal)

		// --- 8. ACTION MODUL FINAL VERIFIKASI ---
		// Route ini dipanggil oleh QS SPV di tahap akhir
		audit.GET("/final-verification/masterlist", controllers.GetFinalVerificationList) // Reuse list verif / buat baru jika perlu
		// Note: Controller 'GetFinalVerifList' tidak ada di kode sebelumnya, kita reuse 'GetEvidenceVerifList'
		// atau gunakan endpoint masterlist umum jika filternya sudah mencakup FINAL_CLOSING.
		// Jika Anda punya controller spesifik 'GetFinalVerifList', silakan ganti kembali.

		audit.GET("/final-verification/:id/detail", controllers.GetEvidenceVerifDetail)
		// audit.POST("/final-verification/:id/submit-decision", controllers.SubmitFinalDecision) // Diganti logic SubmitVerifikasiToFinal dengan status check

		audit.POST("/:id/item/:itemId/final-approve", controllers.FinalApproveItem)
		audit.POST("/:id/item/:itemId/final-reject", controllers.FinalRejectItem)

		// --- 9. MODUL REPORT & LOGS ---
		audit.GET("/report/masterlist", controllers.GetAuditReportList)
		audit.GET("/report/download/excel", controllers.DownloadReportExcel)
		audit.GET("/report/download/pdf", controllers.DownloadReportPDF)

		// [NEW ROUTE] Leadtime Analysis
		audit.GET("/log/leadtime", controllers.GetLeadtimeAnalysis)

		// Audit Trail / Activity Logs
		audit.GET("/system-logs", controllers.GetActivityLogs)
	}
}
