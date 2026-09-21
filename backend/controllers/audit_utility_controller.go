package controllers

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jung-kurt/gofpdf"
	"github.com/vaneshadhani/e-audit-backend/config"
	"github.com/vaneshadhani/e-audit-backend/helpers"
	"github.com/vaneshadhani/e-audit-backend/models"
)

// ==========================================
// KONTROLER 6: UTILITY & LEGACY SUPPORT
// ==========================================

// 1. Get Audit By ID (Basic Info - untuk Edit/Setup awal)
func GetAuditByID(c *gin.Context) {
	ctx := context.Background()
	pelaksanaanID := c.Param("id")
	var auditDetail models.AuditDetailRaw

	// Query simple tetap di sini karena hanya 1 tabel
	sqlQuery := `SELECT site_id, jenis_audit_id, department_id, area_id, auditor_ids FROM pelaksanaan_audit WHERE pelaksanaan_id = $1`
	err := config.DB.QueryRow(ctx, sqlQuery, pelaksanaanID).Scan(&auditDetail.SiteID, &auditDetail.JenisAuditID, &auditDetail.DepartmentID, &auditDetail.AreaID, &auditDetail.AuditorIDs)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Audit tidak ditemukan"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": auditDetail})
}

// 2. Update Basic Info Audit
func UpdateAudit(c *gin.Context) {
	ctx := context.Background()
	pelaksanaanID := c.Param("id")
	var input models.AuditCreateInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Input invalid"})
		return
	}
	sqlQuery := `UPDATE pelaksanaan_audit SET site_id=$1, jenis_audit_id=$2, department_id=$3, area_id=$4, auditor_ids=$5, status_laporan=$6 WHERE pelaksanaan_id=$7`
	config.DB.Exec(ctx, sqlQuery, input.SiteID, input.JenisAuditID, input.DepartmentID, input.AreaID, input.AuditorIDs, models.StatusExecOpen, pelaksanaanID)
	c.JSON(http.StatusOK, gin.H{"message": "Updated"})
}

// 3. Delete Audit
func DeleteAudit(c *gin.Context) {
	ctx := context.Background()
	pelaksanaanID := c.Param("id")
	sqlQuery := `DELETE FROM pelaksanaan_audit WHERE pelaksanaan_id = $1`
	res, err := config.DB.Exec(ctx, sqlQuery, pelaksanaanID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal hapus"})
		return
	}
	if res.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

// 4. Ping
func PingLaporan(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "OK"})
}

// 5. Get Detail Temuan (SAFE VERSION - USE HELPER)
func GetTemuanByPelaksanaanDetailed(c *gin.Context) {
	id := c.Param("id")
	data, err := helpers.FetchAuditDetailFull(id) // PANGGIL HELPER

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil detail audit: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": data})
}

// 6. Action Legacy: Approve Temuan ke PIC
func ApproveTemuanToPIC(c *gin.Context) {
	ctx := context.Background()
	pelaksanaanID := c.Param("id")
	itemID := c.Param("itemId")
	sqlQuery := `UPDATE laporan_temuan SET status='Open CAPA' WHERE pelaksanaan_id=$1 AND item_id=$2`
	config.DB.Exec(ctx, sqlQuery, pelaksanaanID, itemID)
	c.JSON(http.StatusOK, gin.H{"message": "Approved"})
}

// 7. Aliases (Mapping ke Controller Baru)
func UpdateLaporanItemQS(c *gin.Context) { UpdateItemQS(c) }

// =======================================================
// MODUL LAPORAN AUDITOR (Save Draft & Submit)
// =======================================================

// 8. Save Draft Laporan
func SaveLaporanDraft(c *gin.Context) {
	processLaporanSave(c, false)
}

// 9. Submit Laporan Final
func SubmitLaporanFinal(c *gin.Context) {
	processLaporanSave(c, true)
}

// Logic Inti Penyimpanan Laporan Auditor
func processLaporanSave(c *gin.Context, isFinal bool) {
	ctx := context.Background()
	pelaksanaanIDStr := c.Param("id")
	pelaksanaanID, err := strconv.ParseUint(pelaksanaanIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID pelaksanaan tidak valid"})
		return
	}

	form, err := c.MultipartForm()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal parsing form-data: " + err.Error()})
		return
	}

	// Parsing Items
	answersJSONSlice, ok := form.Value["answers_data"]
	if !ok || len(answersJSONSlice) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Field 'answers_data' tidak ditemukan"})
		return
	}
	var answers []models.AuditItemAnswer
	if err := json.Unmarshal([]byte(answersJSONSlice[0]), &answers); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Data JSON item tidak valid: " + err.Error()})
		return
	}

	// Parsing Approvers
	var approvers []models.ApproverInput
	approversJSON, hasApprover := form.Value["approvers_data"]
	if isFinal && hasApprover && len(approversJSON) > 0 {
		json.Unmarshal([]byte(approversJSON[0]), &approvers)
	}

	// Handle Files
	uploadedFilesMap := make(map[string][]string)
	files := form.File["files"]
	fileItemIDs := form.Value["file_item_ids"]
	if len(files) > 0 {
		for i, fileHeader := range files {
			var itemIDKey string
			if i < len(fileItemIDs) {
				itemIDKey = fileItemIDs[i]
			} else {
				itemIDKey = fmt.Sprintf("unknown_%d", i)
			}
			uniqueFilename := fmt.Sprintf("%d-%s-%s", time.Now().Unix(), uuid.New().String(), filepath.Base(fileHeader.Filename))
			saveDir := filepath.Join("uploads", fmt.Sprintf("audit_%d", pelaksanaanID), fmt.Sprintf("item_%s", itemIDKey))
			os.MkdirAll(saveDir, os.ModePerm)
			savePath := filepath.Join(saveDir, uniqueFilename)
			c.SaveUploadedFile(fileHeader, savePath)
			uploadedFilesMap[itemIDKey] = append(uploadedFilesMap[itemIDKey], savePath)
		}
	}

	// Database Transaction
	tx, err := config.DB.Begin(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal transaksi"})
		return
	}
	defer tx.Rollback(ctx)

	batch := &pgx.Batch{}
	queued := 0

	sqlUpsert := `
		INSERT INTO laporan_temuan (
			pelaksanaan_id, item_id, status, deskripsi_temuan, lokasi_temuan, bukti_temuan, 
			pic_user_id, kategori_temuan, data_integrity, prinsip_5r, justification
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		ON CONFLICT (pelaksanaan_id, item_id) DO UPDATE SET
			status = EXCLUDED.status, 
			deskripsi_temuan = EXCLUDED.deskripsi_temuan, 
			lokasi_temuan = EXCLUDED.lokasi_temuan,
			bukti_temuan = EXCLUDED.bukti_temuan,
			pic_user_id = EXCLUDED.pic_user_id,
			kategori_temuan = EXCLUDED.kategori_temuan,
			data_integrity = EXCLUDED.data_integrity,
			prinsip_5r = EXCLUDED.prinsip_5r,
			justification = EXCLUDED.justification
	`

	for _, item := range answers {
		var finalItemID uint64
		var itemKey string

		switch v := item.ItemID.(type) {
		case float64:
			finalItemID = uint64(v)
			itemKey = fmt.Sprintf("%d", finalItemID)
		case int:
			finalItemID = uint64(v)
			itemKey = fmt.Sprintf("%d", finalItemID)
		case string:
			parsed, _ := strconv.ParseUint(v, 10, 64)
			finalItemID = parsed
			itemKey = v
		}

		newFilePaths := uploadedFilesMap[itemKey]
		var finalFilePaths []string
		if len(item.ExistingFiles) > 0 {
			finalFilePaths = append(finalFilePaths, item.ExistingFiles...)
		}
		if len(newFilePaths) > 0 {
			finalFilePaths = append(finalFilePaths, newFilePaths...)
		}
		filePathsJSON, _ := json.Marshal(finalFilePaths)

		justif := item.Justification
		if justif == "" {
			justif = "Temuan"
		}

		batch.Queue(sqlUpsert,
			pelaksanaanID, finalItemID, item.Status, item.DeskripsiTemuan, item.LokasiTemuan, string(filePathsJSON),
			item.PicUserID, item.KategoriTemuan, item.DataIntegrity, item.Prinsip5R, justif,
		)
		queued++
	}

	if queued > 0 {
		br := tx.SendBatch(ctx, batch)
		if _, err := br.Exec(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal update items: " + err.Error()})
			return
		}
		br.Close()
	}

	// Update Header Status
	if isFinal {
		var qsSpvID, mgrAreaID, mgrQsID int
		var picCapaArrString string = "{}"

		if len(approvers) > 0 {
			data := approvers[0]
			qsSpvID = data.QsSpvID
			mgrAreaID = data.MgrAreaID
			mgrQsID = data.MgrQsID

			if len(data.PicCapaIDs) > 0 {
				strIDs := make([]string, len(data.PicCapaIDs))
				for i, id := range data.PicCapaIDs {
					strIDs[i] = strconv.Itoa(id)
				}
				picCapaArrString = "{" + strings.Join(strIDs, ",") + "}"
			}
		}

		sqlUpdateHeader := `
			UPDATE pelaksanaan_audit 
			SET 
				status_laporan = $2, 
				approver_pic_capa_ids = $3,
				approver_qs_spv_id = $4,
				approver_mgr_area_id = $5,
				approver_mgr_qs_id = $6,
				note_reject = NULL,
				tanggal_selesai = NOW()
			WHERE pelaksanaan_id = $1
		`

		_, err = tx.Exec(ctx, sqlUpdateHeader,
			pelaksanaanID,
			models.StatusQsReview,
			picCapaArrString,
			qsSpvID,
			mgrAreaID,
			mgrQsID,
		)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal update status header: " + err.Error()})
			return
		}

	} else {
		tx.Exec(ctx, "UPDATE pelaksanaan_audit SET status_laporan = $2 WHERE pelaksanaan_id = $1",
			pelaksanaanID, models.StatusRptProgress)
	}

	tx.Commit(ctx)

	action := "SAVE_DRAFT_REPORT"
	if isFinal {
		action = "SUBMIT_REPORT_TO_QS"
	}
	helpers.CreateAuditLog(c, action, "Audit Report", strconv.FormatUint(pelaksanaanID, 10), nil, nil)

	if isFinal {
		c.JSON(http.StatusOK, gin.H{"message": "Laporan berhasil disubmit ke Review QS"})
	} else {
		c.JSON(http.StatusOK, gin.H{"message": "Draf laporan tersimpan"})
	}
}

// 10. Reporting Exports
func DownloadReportExcel(c *gin.Context) {
	c.JSON(200, gin.H{"message": "Fitur Excel sedang dikembangkan"})
}

func GenerateAuditPDF(id string) ([]byte, error) {
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.AddPage()
	pdf.SetFont("Arial", "B", 16)
	pdf.Cell(40, 10, fmt.Sprintf("Laporan Audit Detail (ID: %s)", id))
	var buf bytes.Buffer
	err := pdf.Output(&buf)
	if err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func DownloadReportPDF(c *gin.Context) {
	idStr := c.Query("id")
	if idStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID parameter is required"})
		return
	}
	pdfBytes, err := GenerateAuditPDF(idStr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Gagal generate PDF: %v", err)})
		return
	}
	filename := fmt.Sprintf("Laporan_Audit_%s.pdf", idStr)
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	c.Header("Content-Length", fmt.Sprintf("%d", len(pdfBytes)))
	c.Data(http.StatusOK, "application/pdf", pdfBytes)
}

// 11. Activity Logs (VERSION: NO ROLES + NO LOGIN)
func GetActivityLogs(c *gin.Context) {
	ctx := context.Background()
	limit := c.DefaultQuery("limit", "100")

	sqlQuery := `
		SELECT 
			COALESCE(CAST(al.id AS TEXT), '-'),
			COALESCE(u.nama_lengkap, 'System/Unknown') as actor_name,
			'-' as role_name,
			COALESCE(s.nama_site, '-') as site_name,
			COALESCE(al.action, '-'),
			COALESCE(al.entity_name, '-'),
			COALESCE(al.entity_id, '-'),
			TO_CHAR(al.created_at, 'DD Mon YYYY HH24:MI') as time_formatted,
			
			COALESCE(CAST(al.old_values AS TEXT), '{}'),
			COALESCE(CAST(al.new_values AS TEXT), '{}')
		FROM audit_logs al
		
		LEFT JOIN users u ON CAST(al.user_id AS TEXT) = CAST(u.user_id AS TEXT)
		LEFT JOIN site s ON u.site_id = s.site_id
		
		-- [FILTER BARU] Sembunyikan Action yang mengandung kata 'LOGIN'
		WHERE al.action NOT ILIKE '%LOGIN%'

		ORDER BY al.created_at DESC LIMIT $1
	`

	rows, err := config.DB.Query(ctx, sqlQuery, limit)
	if err != nil {
		fmt.Println("❌ [GetActivityLogs] Query Error:", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database Query Failed: " + err.Error()})
		return
	}
	defer rows.Close()

	var logs []models.AuditLogResponse

	for rows.Next() {
		var l models.AuditLogResponse
		var oldValJSON, newValJSON string

		err := rows.Scan(
			&l.ID,
			&l.Actor,
			&l.Role,
			&l.Site,
			&l.Action,
			&l.Entity,
			&l.EntityID,
			&l.Time,
			&oldValJSON,
			&newValJSON,
		)

		if err != nil {
			continue // Skip error row
		}

		var oldObj, newObj interface{}
		if oldValJSON != "" {
			_ = json.Unmarshal([]byte(oldValJSON), &oldObj)
		}
		if newValJSON != "" {
			_ = json.Unmarshal([]byte(newValJSON), &newObj)
		}

		l.Changes = map[string]interface{}{"old": oldObj, "new": newObj}
		l.Description = fmt.Sprintf("%s %s", l.Action, l.Entity)

		logs = append(logs, l)
	}

	if logs == nil {
		logs = []models.AuditLogResponse{}
	}

	c.JSON(http.StatusOK, gin.H{"data": logs})
}

// 12. Audit Report List (MENGGUNAKAN HELPER)
// Logic query dipindahkan ke helpers.FetchAuditReportList
func GetAuditReportList(c *gin.Context) {
	list, err := helpers.FetchAuditReportList()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": list})
}

// 12. Get Leadtime Analysis (FIXED COLUMN NAME & SCAN)
func GetLeadtimeAnalysis(c *gin.Context) {
	ctx := context.Background()

	// Update Query: Menggunakan tanggal_dibuat sesuai database Anda
	sqlQuery := `
		SELECT 
			p.pelaksanaan_id,
			lt.item_id,
			COALESCE(lt.no_fta, p.no_fta, '-') as no_fta,
			COALESCE(s.nama_site, '-') as site,
			COALESCE(a.nama_area, '-') as area,
			COALESCE(lt.deskripsi_temuan, '-') as deskripsi,
			COALESCE(u.nama_lengkap, '-') as pic_name,
			
			-- MILESTONES (Timestamps)
			TO_CHAR(p.tanggal_dibuat, 'YYYY-MM-DD HH24:MI') as tgl_create,      -- Menggunakan tanggal_dibuat
			TO_CHAR(p.tgl_approve_mgr_qs, 'YYYY-MM-DD HH24:MI') as tgl_approve_mgr, 
			TO_CHAR(lt.due_date, 'YYYY-MM-DD') as due_date,
			TO_CHAR(lt.tgl_upload_bukti, 'YYYY-MM-DD HH24:MI') as tgl_upload, 
			TO_CHAR(lt.tgl_verifikasi, 'YYYY-MM-DD HH24:MI') as tgl_verif,
			
			COALESCE(lt.status, 'OPEN') as status_item,
			COALESCE(lt.hasil_verifikasi, '-') as status_verif

		FROM laporan_temuan lt
		JOIN pelaksanaan_audit p ON lt.pelaksanaan_id = p.pelaksanaan_id
		LEFT JOIN site s ON p.site_id = s.site_id
		LEFT JOIN area a ON p.area_id = a.area_id
		LEFT JOIN users u ON lt.pic_user_id = u.user_id
		WHERE lt.status != 'OK'
		ORDER BY p.tanggal_dibuat DESC
	`

	rows, err := config.DB.Query(ctx, sqlQuery)
	if err != nil {
		fmt.Println("❌ [GetLeadtimeAnalysis] Query Error:", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Query Error: " + err.Error()})
		return
	}
	defer rows.Close()

	type LeadtimeItem struct {
		ID            int     `json:"id"`
		ItemID        int     `json:"item_id"`
		NoFTA         string  `json:"no_fta"`
		Site          string  `json:"site"`
		Area          string  `json:"area"`
		Deskripsi     string  `json:"deskripsi"`
		PIC           string  `json:"pic"`
		PicName       string  `json:"pic_name"`
		TglCreate     *string `json:"tgl_create"`
		TglApproveMgr *string `json:"tgl_approve_mgr"`
		DueDate       *string `json:"due_date"`
		TglUpload     *string `json:"tgl_upload"`
		TglVerif      *string `json:"tgl_verif"`
		StatusItem    string  `json:"status_item"`
		StatusVerif   string  `json:"status_verif"`
	}

	var list []LeadtimeItem

	for rows.Next() {
		var item LeadtimeItem
		var tCreate, tApprove, dDate, tUpload, tVerif sql.NullString

		// Scan 14 kolom hasil SELECT secara berurutan
		err := rows.Scan(
			&item.ID,
			&item.ItemID,
			&item.NoFTA,
			&item.Site,
			&item.Area,
			&item.Deskripsi,
			&item.PIC,
			&tCreate,  // Hasil dari p.tanggal_dibuat
			&tApprove, // Hasil dari p.tgl_approve_mgr_qs
			&dDate,
			&tUpload,
			&tVerif,
			&item.StatusItem,
			&item.StatusVerif,
		)

		if err != nil {
			fmt.Println("❌ [GetLeadtimeAnalysis] Scan Error:", err)
			continue
		}

		if tCreate.Valid {
			item.TglCreate = &tCreate.String
		}
		if tApprove.Valid {
			item.TglApproveMgr = &tApprove.String
		}
		if dDate.Valid {
			item.DueDate = &dDate.String
		}
		if tUpload.Valid {
			item.TglUpload = &tUpload.String
		}
		if tVerif.Valid {
			item.TglVerif = &tVerif.String
		}

		list = append(list, item)
	}

	if list == nil {
		list = []LeadtimeItem{}
	}

	c.JSON(http.StatusOK, gin.H{"data": list})
}
