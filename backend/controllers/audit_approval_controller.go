package controllers

import (
	"context"
	"database/sql"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/vaneshadhani/e-audit-backend/config"
	"github.com/vaneshadhani/e-audit-backend/helpers"
	"github.com/vaneshadhani/e-audit-backend/models"
)

// ==========================================
// KONTROLER 4 & 6: AUDIT APPROVAL & FINAL VERIFICATION
// Fokus:
// 1. Approval Berjenjang (QS SPV -> Mgr Area -> Mgr QS)
// 2. Final Verifikasi (Koordinator -> Closing)
// ==========================================

// ---------------------------------------------------------
// SECTION A: APPROVAL BERJENJANG (SEBELUM UPLOAD BUKTI)
// ---------------------------------------------------------

// 1. Get Masterlist untuk Approval Berjenjang
func GetVerificationMasterlist(c *gin.Context) {
	list, err := helpers.FetchVerificationMasterlist()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal ambil data verifikasi: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": list})
}

func VerifyItemStatus(c *gin.Context) {
	ctx := context.Background()
	pelaksanaanID := c.Param("id")

	var input struct {
		ItemID  int    `json:"item_id"`
		Status  string `json:"status"` // 'APPROVED' atau 'REVISION'
		Comment string `json:"comment"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Input invalid: " + err.Error()})
		return
	}

	// Validasi Status
	validStatus := input.Status == "APPROVED" || input.Status == "REVISION"
	if !validStatus {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Status harus APPROVED atau REVISION"})
		return
	}

	// Update Database Per Item
	query := `
		UPDATE laporan_temuan 
		SET hasil_verifikasi = $1, 
			catatan_verifikasi = $2, 
			tgl_verifikasi = NOW() 
		WHERE pelaksanaan_id = $3 AND item_id = $4
	`

	// Jika Approved, kosongkan catatan verifikasi
	note := input.Comment
	if input.Status == "APPROVED" {
		note = ""
	}

	_, err := config.DB.Exec(ctx, query, input.Status, note, pelaksanaanID, input.ItemID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal simpan status item: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Status item tersimpan"})
}

// 3. Process Approval Berjenjang (Final Submit Header)
func ProcessFinalApproval(c *gin.Context) {
	ctx := context.Background()
	pelaksanaanID := c.Param("id")

	var input models.ApprovalInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Input invalid: " + err.Error()})
		return
	}

	// Cek Status Saat Ini
	var currentStatus string
	err := config.DB.QueryRow(ctx, `SELECT status_laporan FROM pelaksanaan_audit WHERE pelaksanaan_id = $1`, pelaksanaanID).Scan(&currentStatus)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Audit tidak ditemukan"})
		return
	}
	currentStatus = strings.TrimSpace(currentStatus)

	var newStatus string
	var extraSQL string
	var isReturn bool = false
	var actionMsg string

	switch input.Action {

	case "REJECT":
		isReturn = true

		rejectNote := input.Comment
		if rejectNote == "" {
			rejectNote = "Dikembalikan (Tanpa Catatan Global)"
		}

		switch currentStatus {
		case models.StatusWaitingQsSpv:
			newStatus = models.StatusCapaRejectedQsSpv
			extraSQL = ", tgl_submit_capa = NULL"
			actionMsg = "Ditolak QS SPV. Dikembalikan ke PIC Area."

		case models.StatusWaitingMgrArea:
			newStatus = models.StatusQsRejectedMgr
			extraSQL = ", tgl_approve_qs_spv = NULL"
			actionMsg = "Ditolak Manager Area. Dikembalikan ke Review QS Supervisor."

			config.DB.Exec(ctx, `
				UPDATE laporan_temuan
				SET hasil_verifikasi = NULL
				WHERE pelaksanaan_id = $1
			`, pelaksanaanID)

		case models.StatusWaitingMgrQs:
			newStatus = "CAPA_REJECTED_MGR"
			extraSQL = ", tgl_submit_capa = NULL, tgl_approve_qs_spv = NULL, tgl_approve_mgr_area = NULL"
			actionMsg = "Ditolak QS Manager. Dikembalikan ke PIC Area."

		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": "Status tidak valid untuk REJECT"})
			return
		}

	// =========================
	// ✅ APPROVE (ADA NOTIFIKASI)
	// =========================
	case "APPROVE":
		isReturn = false

		// Safety net
		config.DB.Exec(ctx, `
			UPDATE laporan_temuan 
			SET hasil_verifikasi = 'APPROVED', catatan_verifikasi = NULL 
			WHERE pelaksanaan_id = $1 AND status != 'OK'
		`, pelaksanaanID)

		switch currentStatus {

		// =========================================
		// 1️⃣ QS SPV → MANAGER AREA
		// =========================================
		case models.StatusWaitingQsSpv:
			newStatus = models.StatusWaitingMgrArea
			extraSQL = ", tgl_approve_qs_spv = NOW(), approver_qs_spv_id = $3"

			// 🔔 NOTIFIKASI KE MANAGER AREA
			go func() {
				var mgrAreaID int
				err := config.DB.QueryRow(context.Background(), `
					SELECT approver_mgr_area_id 
					FROM pelaksanaan_audit 
					WHERE pelaksanaan_id = $1
				`, pelaksanaanID).Scan(&mgrAreaID)

				if err == nil && mgrAreaID != 0 {
					helpers.SendNextApprovalNotification(mgrAreaID, pelaksanaanID, "Manager Area")
				}
			}()

		// =========================================
		// 2️⃣ MANAGER AREA → QS MANAGER
		// =========================================
		case models.StatusWaitingMgrArea:
			newStatus = models.StatusWaitingMgrQs
			extraSQL = ", tgl_approve_mgr_area = NOW(), approver_mgr_area_id = $3"

			// 🔔 NOTIFIKASI KE QS MANAGER
			go func() {
				var mgrQsID int
				err := config.DB.QueryRow(context.Background(), `
					SELECT approver_mgr_qs_id 
					FROM pelaksanaan_audit 
					WHERE pelaksanaan_id = $1
				`, pelaksanaanID).Scan(&mgrQsID)

				if err == nil && mgrQsID != 0 {
					helpers.SendNextApprovalNotification(mgrQsID, pelaksanaanID, "QS Manager")
				}
			}()

		// =========================================
		// 3️⃣ QS MANAGER → FINAL
		// =========================================
		case models.StatusWaitingMgrQs:
			newStatus = models.StatusReadyForCapa
			extraSQL = ", tgl_approve_mgr_qs = NOW(), approver_mgr_qs_id = $3"
			actionMsg = "Approval Selesai. Masuk ke tahap Upload Bukti (Closing)."

			go func() {
				fmt.Println("✅ Final approval selesai (bisa kirim notif ke PIC)")
			}()

		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": "Status tidak valid untuk APPROVE"})
			return
		}

		if actionMsg == "" {
			actionMsg = "Approval berhasil. Lanjut ke tahap berikutnya."
		}

	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "Action unknown"})
		return
	}

	// =========================
	// UPDATE DATABASE
	// =========================
	var query string
	var errExec error

	if isReturn {
		query = fmt.Sprintf("UPDATE pelaksanaan_audit SET status_laporan = $1, note_reject = $2 %s WHERE pelaksanaan_id = $3", extraSQL)
		_, errExec = config.DB.Exec(ctx, query, newStatus, input.Comment, pelaksanaanID)
	} else {
		var nullString *string = nil
		query = fmt.Sprintf("UPDATE pelaksanaan_audit SET status_laporan = $1, note_reject = $2 %s WHERE pelaksanaan_id = $4", extraSQL)
		_, errExec = config.DB.Exec(ctx, query, newStatus, nullString, input.UserID, pelaksanaanID)
	}

	if errExec != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": errExec.Error()})
		return
	}

	helpers.CreateAuditLog(c, "APPROVAL_DECISION", "Audit Workflow", pelaksanaanID, nil, gin.H{
		"action":      input.Action,
		"prev_status": currentStatus,
		"new_status":  newStatus,
	})

	c.JSON(http.StatusOK, gin.H{
		"message":     actionMsg,
		"next_status": newStatus,
		"is_return":   isReturn,
	})
}

// ---------------------------------------------------------
// SECTION B: FINAL VERIFIKASI (ROLE: KOORDINATOR / ADMIN)
// ---------------------------------------------------------

// 4. Get List Final Verifikasi (Hanya FINAL_CLOSING)
func GetFinalVerifList(c *gin.Context) {
	ctx := context.Background()

	type FinalVerifData struct {
		PelaksanaanID  uint      `json:"id"`
		TanggalAudit   time.Time `json:"tanggal"`
		NamaSite       string    `json:"site"`
		NamaArea       string    `json:"area"`
		NamaJenisAudit string    `json:"jenis_audit"`
		NamaAuditor    string    `json:"auditor"`
		JumlahTemuan   int       `json:"jml_temuan"`
		NoFTA          *string   `json:"no_fta"`
		TglMasukFinal  *string   `json:"tgl_masuk_final"`
	}

	sqlQuery := `
		SELECT 
			p.pelaksanaan_id, p.tanggal_audit, COALESCE(s.nama_site, '-'), COALESCE(a.nama_area, '-'), 
			COALESCE(j.nama_jenis_audit, '-'), COALESCE(STRING_AGG(DISTINCT u.nama_lengkap, ', '), '-'), 
			(SELECT COUNT(*) FROM laporan_temuan lt WHERE lt.pelaksanaan_id = p.pelaksanaan_id AND lt.status = 'NOK'),
			(SELECT no_fta FROM laporan_temuan WHERE pelaksanaan_id = p.pelaksanaan_id AND no_fta IS NOT NULL LIMIT 1),
			TO_CHAR(COALESCE(p.tgl_submit_capa, p.tanggal_audit), 'DD Mon YYYY HH24:MI')
		FROM pelaksanaan_audit p
		LEFT JOIN site s ON p.site_id = s.site_id
		LEFT JOIN jenis_audit j ON p.jenis_audit_id = j.id_jenis_audit
		LEFT JOIN area a ON p.area_id = a.area_id
		LEFT JOIN users u ON u.user_id = ANY(p.auditor_ids)
		WHERE 
			p.status_laporan = 'FINAL_CLOSING'
		GROUP BY p.pelaksanaan_id, s.nama_site, a.nama_area, j.nama_jenis_audit, p.tgl_submit_capa
		ORDER BY p.tgl_submit_capa DESC
	`

	rows, err := config.DB.Query(ctx, sqlQuery)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal load data final"})
		return
	}
	defer rows.Close()

	var list []FinalVerifData
	for rows.Next() {
		var item FinalVerifData
		var noFTA, tglMasuk sql.NullString
		if err := rows.Scan(&item.PelaksanaanID, &item.TanggalAudit, &item.NamaSite, &item.NamaArea, &item.NamaJenisAudit, &item.NamaAuditor, &item.JumlahTemuan, &noFTA, &tglMasuk); err == nil {
			if noFTA.Valid {
				item.NoFTA = &noFTA.String
			}
			if tglMasuk.Valid {
				item.TglMasukFinal = &tglMasuk.String
			}
			list = append(list, item)
		}
	}
	if list == nil {
		list = []FinalVerifData{}
	}
	c.JSON(http.StatusOK, gin.H{"data": list})
}

// 5. Final Decision (Close Audit / Return to PIC)
func SubmitFinalDecision(c *gin.Context) {
	ctx := context.Background()
	pelaksanaanIDStr := c.Param("id")
	pelaksanaanID, _ := strconv.Atoi(pelaksanaanIDStr)

	var input struct {
		Action string `json:"action"`
		Reason string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Input invalid"})
		return
	}

	var nextStatus string
	var noteReject *string = nil

	if input.Action == "APPROVE" {
		nextStatus = models.StatusClosed
		config.DB.Exec(ctx, `UPDATE pelaksanaan_audit SET status_laporan=$1, tanggal_selesai=NOW(), note_reject=NULL WHERE pelaksanaan_id=$2`, nextStatus, pelaksanaanID)
	} else {
		nextStatus = "EVIDENCE_REJECTED_AUDITOR"
		reason := input.Reason
		noteReject = &reason

		config.DB.Exec(ctx, `UPDATE laporan_temuan SET hasil_verifikasi = 'REVISION', catatan_verifikasi = $1 WHERE pelaksanaan_id = $2 AND status = 'NOK'`, reason, pelaksanaanID)
		config.DB.Exec(ctx, `UPDATE pelaksanaan_audit SET status_laporan=$1, note_reject=$2 WHERE pelaksanaan_id=$3`, nextStatus, noteReject, pelaksanaanID)
	}

	helpers.CreateAuditLog(c, "FINAL_DECISION", "Audit Closing", strconv.Itoa(pelaksanaanID), nil, gin.H{"action": input.Action})
	c.JSON(http.StatusOK, gin.H{"message": "Audit processed", "next_status": nextStatus})
}
