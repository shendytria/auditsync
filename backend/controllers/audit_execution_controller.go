package controllers

import (
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
	"github.com/vaneshadhani/e-audit-backend/config"
	"github.com/vaneshadhani/e-audit-backend/helpers"
	"github.com/vaneshadhani/e-audit-backend/models"
)

// ==========================================
// KONTROLER 1: AUDIT EXECUTION (AUDITOR)
// Fokus: Create, Isi Temuan, Save Draft, Submit ke Laporan Auditor (RPT_OPEN)
// ==========================================

// 1. Create Audit Baru
func CreateAudit(c *gin.Context) {
	var input models.AuditCreateInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Data input tidak valid: " + err.Error()})
		return
	}
	if len(input.AuditorIDs) > 5 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Maksimal 5 auditor diperbolehkan"})
		return
	}

	ctx := context.Background()

	// Default status awal: EXEC_OPEN
	sqlQuery := `
		INSERT INTO pelaksanaan_audit 
			(tanggal_audit, status_laporan, area_id, site_id, jenis_audit_id, department_id, auditor_ids, created_by)
		VALUES 
			($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING pelaksanaan_id 
	`
	var pelaksanaanID uint64
	err := config.DB.QueryRow(ctx, sqlQuery,
		time.Now(), models.StatusExecOpen, input.AreaID,
		input.SiteID, input.JenisAuditID, input.DepartmentID, input.AuditorIDs, input.CreatedBy,
	).Scan(&pelaksanaanID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan audit: " + err.Error()})
		return
	}

	helpers.CreateAuditLog(c, "CREATE", "Audit Execution", strconv.FormatUint(pelaksanaanID, 10), nil, input)

	// 📩 KIRIM EMAIL KE SEMUA AUDITOR
	if len(input.AuditorIDs) > 0 {
		go func(auditorIDs []int) {

			// 🔥 Ambil data audit (site, jenis audit, area)
			var site, jenisAudit, area string
			err := config.DB.QueryRow(ctx, `
			SELECT s.nama_site, j.nama_jenis_audit, a.nama_area
			FROM pelaksanaan_audit p
			LEFT JOIN site s ON p.site_id = s.site_id
			LEFT JOIN jenis_audit j ON p.jenis_audit_id = j.id_jenis_audit
			LEFT JOIN area a ON p.area_id = a.area_id
			WHERE p.pelaksanaan_id = $1
		`, pelaksanaanID).Scan(&site, &jenisAudit, &area)

			if err != nil {
				fmt.Println("❌ Gagal ambil data audit:", err)
				return
			}

			// 🔥 Format tanggal (custom sesuai request kamu)
			tanggalAudit := fmt.Sprintf(
				"Anda sudah dapat memulai audit mulai tanggal %s hingga waktu yang akan disepakati melalui diskusi internal.",
				time.Now().Format("02 January 2006"),
			)

			for _, auditorID := range auditorIDs {

				var email, nama string

				err := config.DB.QueryRow(ctx, `
				SELECT email, nama_lengkap 
				FROM users 
				WHERE user_id = $1
			`, auditorID).Scan(&email, &nama)

				if err != nil {
					fmt.Println("❌ Gagal ambil data auditor:", err)
					continue
				}

				// 🚀 Kirim email (6 parameter sesuai helper)
				err = helpers.SendAuditAssignedEmail(
					email,
					nama,
					site,
					jenisAudit,
					area,
					tanggalAudit,
				)

				if err != nil {
					fmt.Println("❌ Gagal kirim email ke:", email)
				}
			}
		}(input.AuditorIDs)
	}
	c.JSON(http.StatusOK, gin.H{"message": "Audit baru berhasil dibuat", "pelaksanaan_id": pelaksanaanID})
}

// 2. Get Data Audit Aktif (Dashboard Auditor - Eksekusi)
func GetAuditAktif(c *gin.Context) {
	ctx := context.Background()
	sqlQuery := `
		SELECT 
			p.pelaksanaan_id AS id, 
			p.tanggal_audit,
			COALESCE(s.nama_site, '-') AS site, 
			COALESCE(j.nama_jenis_audit, '-') AS jenisAudit,
			COALESCE(d.nama_department, '-') AS department, 
			COALESCE(a.nama_area, '-') AS area, 
			COALESCE(STRING_AGG(DISTINCT u.nama_lengkap, ', '), '-') AS auditor,
			p.status_laporan AS status,
			p.tanggal_dibuat,
			COALESCE(creator.nama_lengkap, '-') AS pembuat,
			COALESCE(p.created_by, 0) AS created_by,
			COALESCE(array_to_json(p.auditor_ids)::text, '[]') AS auditor_ids_json
		FROM pelaksanaan_audit p
		LEFT JOIN site s ON p.site_id = s.site_id
		LEFT JOIN jenis_audit j ON p.jenis_audit_id = j.id_jenis_audit
		LEFT JOIN department d ON p.department_id = d.department_id
		LEFT JOIN area a ON p.area_id = a.area_id
		LEFT JOIN users u ON u.user_id = ANY(p.auditor_ids)
		LEFT JOIN users creator ON p.created_by = creator.user_id
	`

	// [UPDATE LOGIC] Hapus models.StatusRptRejectedPic dari filter
	whereClause := fmt.Sprintf(" WHERE p.status_laporan IN ('%s', '%s')",
		models.StatusExecOpen, models.StatusExecProgress)

	var args []interface{}
	if siteID := c.Query("site_id"); siteID != "" {
		whereClause += fmt.Sprintf(" AND p.site_id = $%d", len(args)+1)
		args = append(args, siteID)
	}
	groupByClause := `
		GROUP BY p.pelaksanaan_id, p.tanggal_audit, s.nama_site, j.nama_jenis_audit, d.nama_department, a.nama_area, p.status_laporan, p.tanggal_dibuat, creator.nama_lengkap, p.created_by, p.auditor_ids
		ORDER BY p.tanggal_dibuat DESC
	`

	rows, err := config.DB.Query(ctx, sqlQuery+whereClause+groupByClause, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data: " + err.Error()})
		return
	}
	defer rows.Close()

	var audits []models.AuditAktifResponse
	for rows.Next() {
		var audit models.AuditAktifResponse
		var tglDibuat time.Time
		var tglAudit time.Time
		var auditorJSON string

		if err := rows.Scan(&audit.ID, &tglAudit, &audit.Site, &audit.JenisAudit, &audit.Department, &audit.Area, &audit.Auditor, &audit.Status, &tglDibuat, &audit.Pembuat, &audit.CreatedBy, &auditorJSON); err == nil {
			if auditorJSON != "" {
				_ = json.Unmarshal([]byte(auditorJSON), &audit.AuditorIDs)
			}
			audit.TanggalDibuat = tglDibuat.Format("02 January 2006")
			audits = append(audits, audit)
		}
	}
	c.JSON(http.StatusOK, gin.H{"data": audits})
}

// 3. Get Detail Halaman Eksekusi (Header + Checklist Items)
func GetAuditExecutionData(c *gin.Context) {
	ctx := context.Background()
	pelaksanaanID := c.Param("id")
	var response models.AuditExecutionPageData

	sqlHeader := `
	SELECT 
		p.pelaksanaan_id, p.tanggal_audit, p.status_laporan, 
		COALESCE(STRING_AGG(DISTINCT u.nama_lengkap, ', '), '-') AS nama_auditor,
		COALESCE(a.nama_area, '-') AS nama_area,
		COALESCE(d.nama_department, '-') AS nama_department,
		COALESCE(j.nama_jenis_audit, '-') AS nama_jenis_audit,
		c.checklist_id,
		COALESCE(c.nama_checklist, '-') AS nama_checklist
	FROM pelaksanaan_audit p
	LEFT JOIN users u ON u.user_id = ANY(p.auditor_ids)
	LEFT JOIN area a ON p.area_id = a.area_id
	LEFT JOIN department d ON p.department_id = d.department_id
	LEFT JOIN jenis_audit j ON p.jenis_audit_id = j.id_jenis_audit
	LEFT JOIN checklists c ON p.area_id = c.area_id 
		AND COALESCE(p.department_id, 0) = COALESCE(c.department_id, 0) 
		AND p.jenis_audit_id = c.jenis_audit_id
	WHERE p.pelaksanaan_id = $1
	GROUP BY p.pelaksanaan_id, p.tanggal_audit, p.status_laporan, a.nama_area, d.nama_department, j.nama_jenis_audit, c.checklist_id, c.nama_checklist
	`
	var checklistIDsql sql.NullInt64
	var rawStatus string
	err := config.DB.QueryRow(ctx, sqlHeader, pelaksanaanID).Scan(
		&response.AuditInfo.PelaksanaanID, &response.AuditInfo.TanggalAudit, &rawStatus,
		&response.AuditInfo.NamaAuditor,
		&response.AuditInfo.NamaArea, &response.AuditInfo.NamaDepartment, &response.AuditInfo.NamaJenisAudit,
		&checklistIDsql, &response.AuditInfo.NamaChecklist,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil detail audit: " + err.Error()})
		return
	}
	response.AuditInfo.StatusLaporan = rawStatus

	if checklistIDsql.Valid {
		response.AuditInfo.ChecklistID = uint(checklistIDsql.Int64)
	} else {
		response.AuditInfo.ChecklistID = 0
	}

	sqlItems := `
		SELECT 
			ci.item_id, ci.item_checklist_text, ci.referensi_doc, ci.kategori, ci.sub_kategori,
			lt.status, lt.deskripsi_temuan, lt.lokasi_temuan, lt.bukti_temuan::text
		FROM checklist_items ci
		LEFT JOIN laporan_temuan lt ON ci.item_id = lt.item_id AND lt.pelaksanaan_id = $1
		WHERE ci.checklist_id = $2
		ORDER BY ci.item_id ASC
	`
	rows, err := config.DB.Query(ctx, sqlItems, pelaksanaanID, response.AuditInfo.ChecklistID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal items: " + err.Error()})
		return
	}
	defer rows.Close()
	for rows.Next() {
		var item models.AuditCheckItem
		var bukti sql.NullString
		if err := rows.Scan(
			&item.ItemID, &item.ItemChecklistText, &item.ReferensiDoc, &item.Kategori, &item.SubKategori,
			&item.Status, &item.DeskripsiTemuan, &item.LokasiTemuan, &bukti,
		); err == nil {
			if bukti.Valid {
				item.BuktiTemuan = &bukti.String
			} else {
				item.BuktiTemuan = nil
			}
			response.CheckItems = append(response.CheckItems, item)
		}
	}

	c.JSON(http.StatusOK, gin.H{"data": response})
}

// 4. Save Draft & Submit Final
func SaveAuditDraft(c *gin.Context)   { processAuditSave(c, false) }
func SubmitAuditFinal(c *gin.Context) { processAuditSave(c, true) }

// Logic Inti Penyimpanan
func processAuditSave(c *gin.Context, isFinal bool) {
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

	// Parsing Jawaban Checklist
	answersJSONSlice, ok := form.Value["answers_data"]
	if !ok || len(answersJSONSlice) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Field 'answers_data' tidak ditemukan"})
		return
	}
	var answers []models.AuditItemAnswer
	if err := json.Unmarshal([]byte(answersJSONSlice[0]), &answers); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Data JSON tidak valid: " + err.Error()})
		return
	}

	approverJSON := form.Value["approver_data"]
	var approver models.ApproverInput

	if len(approverJSON) > 0 {
		if err := json.Unmarshal([]byte(approverJSON[0]), &approver); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Format approver tidak valid"})
			return
		}
	}

	// Handle File Uploads
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

	tx, err := config.DB.Begin(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal transaksi"})
		return
	}
	defer tx.Rollback(ctx)

	// Ambil Checklist ID
	var checklistID uint
	tx.QueryRow(ctx, `SELECT c.checklist_id FROM pelaksanaan_audit p JOIN checklists c ON p.area_id = c.area_id AND COALESCE(p.department_id, 0) = COALESCE(c.department_id, 0) AND p.jenis_audit_id = c.jenis_audit_id WHERE p.pelaksanaan_id = $1`, pelaksanaanID).Scan(&checklistID)

	// Logic Generator No. FTA
	var finalFTAForThisSession *string = nil
	var generatedFTAs []string
	var existingFTA string

	if err := tx.QueryRow(ctx, `SELECT no_fta FROM laporan_temuan WHERE pelaksanaan_id = $1 AND no_fta IS NOT NULL LIMIT 1`, pelaksanaanID).Scan(&existingFTA); err == nil && existingFTA != "" {
		finalFTAForThisSession = &existingFTA
		if isFinal {
			generatedFTAs = append(generatedFTAs, existingFTA)
		}
	} else if isFinal {
		hasNOK := false
		for _, a := range answers {
			if a.Status == "NOK" {
				hasNOK = true
				break
			}
		}
		if hasNOK {
			var namaSite, namaJenisAudit, namaArea string
			var kodeAreaDB *string
			if err := tx.QueryRow(ctx, `SELECT s.nama_site, j.nama_jenis_audit, a.nama_area, a.kode_area FROM pelaksanaan_audit p JOIN site s ON p.site_id = s.site_id JOIN jenis_audit j ON p.jenis_audit_id = j.id_jenis_audit JOIN area a ON p.area_id = a.area_id WHERE p.pelaksanaan_id = $1`, pelaksanaanID).Scan(&namaSite, &namaJenisAudit, &namaArea, &kodeAreaDB); err == nil {
				codeType := "APS"
				if namaJenisAudit == "Audit Internal HSE" || namaJenisAudit == "Patrol HSE" {
					codeType = "HSE"
				}
				codeSite := "CKR"
				if namaSite == "Pulogadung" {
					codeSite = "PLG"
				}
				codeArea := "XX"
				if kodeAreaDB != nil && *kodeAreaDB != "" {
					codeArea = *kodeAreaDB
				} else {
					clean := strings.ReplaceAll(namaArea, " ", "")
					if len(clean) >= 3 {
						codeArea = strings.ToUpper(clean[0:3])
					} else {
						codeArea = strings.ToUpper(clean)
					}
				}
				now := time.Now()
				codeDate := now.Format("0106")
				yearDigits := now.Format("06")
				searchPattern := fmt.Sprintf("FTA/%s/%s/%%/%%%s/%%", codeType, codeSite, yearDigits)
				var lastSeq int
				tx.QueryRow(ctx, `SELECT COALESCE(MAX(CAST(SUBSTRING(no_fta FROM '[0-9]+$') AS INTEGER)), 0) FROM laporan_temuan WHERE no_fta LIKE $1`, searchPattern).Scan(&lastSeq)
				newSeq := lastSeq + 1
				ftaString := fmt.Sprintf("FTA/%s/%s/%s/%s/%03d", codeType, codeSite, codeArea, codeDate, newSeq)
				finalFTAForThisSession = &ftaString
				generatedFTAs = append(generatedFTAs, ftaString)
			}
		}
	}

	if isFinal {
		tx.Exec(ctx, `DELETE FROM laporan_temuan WHERE pelaksanaan_id = $1 AND status != 'NOK'`, pelaksanaanID)
	}

	batch := &pgx.Batch{}
	queued := 0
	sqlUpsert := `
		INSERT INTO laporan_temuan (
			pelaksanaan_id, item_id, status, deskripsi_temuan, lokasi_temuan, bukti_temuan, no_fta,
			pic_user_id, kategori_temuan, data_integrity, prinsip_5r
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		ON CONFLICT (pelaksanaan_id, item_id) DO UPDATE SET
			status = EXCLUDED.status, 
			deskripsi_temuan = EXCLUDED.deskripsi_temuan, 
			lokasi_temuan = EXCLUDED.lokasi_temuan,
			bukti_temuan = EXCLUDED.bukti_temuan,
			no_fta = EXCLUDED.no_fta,
			pic_user_id = EXCLUDED.pic_user_id,
			kategori_temuan = EXCLUDED.kategori_temuan,
			data_integrity = EXCLUDED.data_integrity,
			prinsip_5r = EXCLUDED.prinsip_5r
	`

	for _, item := range answers {
		if isFinal && item.Status != "NOK" {
			continue // Skip OK/NA di Final agar tidak masuk laporan temuan
		}
		if !isFinal && item.Status == "" {
			continue // Skip kosong di Draft
		}

		var finalItemID uint64
		var itemKey string

		if item.IsNew {
			tx.QueryRow(ctx, `INSERT INTO checklist_items (checklist_id, item_checklist_text, referensi_doc, kategori, sub_kategori) VALUES ($1, $2, $3, $4, $5) RETURNING item_id`, checklistID, item.ItemChecklistText, item.ReferensiDoc, item.Kategori, "Tambahan").Scan(&finalItemID)
			itemKey = fmt.Sprintf("%v", item.ItemID)
		} else {
			var id_num uint64
			switch v := item.ItemID.(type) {
			case float64:
				id_num = uint64(v)
			case int:
				id_num = uint64(v)
			case string:
				id_num, _ = strconv.ParseUint(v, 10, 64)
			}
			finalItemID = id_num
			itemKey = fmt.Sprintf("%d", finalItemID)
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

		var itemFTA *string = nil
		if item.Status == "NOK" {
			itemFTA = finalFTAForThisSession
		}

		batch.Queue(sqlUpsert,
			pelaksanaanID, finalItemID, item.Status, item.DeskripsiTemuan, item.LokasiTemuan, string(filePathsJSON), itemFTA,
			item.PicUserID, item.KategoriTemuan, item.DataIntegrity, item.Prinsip5R,
		)
		queued++
	}

	if queued > 0 {
		br := tx.SendBatch(ctx, batch)
		if _, err := br.Exec(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal batch upsert: " + err.Error()})
			return
		}
		br.Close()
	}

	// [UPDATE LOGIC] Update Header Status
	if isFinal {
		// Ubah status ke RPT_OPEN (Laporan Auditor)
		sqlFinalUpdate := `
			UPDATE pelaksanaan_audit 
			SET 
				status_laporan = $2, 
				tanggal_selesai = NOW()
			WHERE pelaksanaan_id = $1
		`
		_, err := tx.Exec(ctx, sqlFinalUpdate, pelaksanaanID, models.StatusRptOpen) // "RPT_OPEN"
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal update status submit: " + err.Error()})
			return
		}
	} else {
		// Save Draft: Tetap EXEC_PROGRESS
		tx.Exec(ctx, "UPDATE pelaksanaan_audit SET status_laporan = $2 WHERE pelaksanaan_id = $1", pelaksanaanID, models.StatusExecProgress)
	}

	if isFinal {
		_, err := tx.Exec(ctx, `
		UPDATE pelaksanaan_audit 
		SET 
			approver_qs_spv_id = $2,
			approver_mgr_area_id = $3,
			approver_mgr_qs_id = $4
		WHERE pelaksanaan_id = $1
	`, pelaksanaanID, approver.QsSpvID, approver.MgrAreaID, approver.MgrQsID)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal simpan approver"})
			return
		}
	}

	tx.Commit(ctx)

	if isFinal && approver.QsSpvID != 0 {
		go func(qsID int, auditID uint64) {
			var email, nama string

			err := config.DB.QueryRow(ctx, `
			SELECT email, nama_lengkap 
			FROM users 
			WHERE user_id = $1
		`, qsID).Scan(&email, &nama)

			if err != nil {
				fmt.Println("❌ Gagal ambil QS SPV:", err)
				return
			}

			err = helpers.SendQSReviewNotification(
				email,
				nama,
				strconv.FormatUint(auditID, 10),
			)

			if err != nil {
				fmt.Println("❌ Gagal kirim notif QS:", err)
			}

		}(approver.QsSpvID, pelaksanaanID)
	}

	actionLog := "SAVE_DRAFT"
	if isFinal {
		actionLog = "SUBMIT_AUDIT"
	}
	helpers.CreateAuditLog(c, actionLog, "Audit Execution", strconv.FormatUint(pelaksanaanID, 10), nil, gin.H{
		"is_final": isFinal,
		"status":   "Updated/Submitted",
	})

	if isFinal {
		c.JSON(http.StatusOK, gin.H{"message": "Audit berhasil disubmit ke Laporan Auditor", "generated_ftas": generatedFTAs})
	} else {
		c.JSON(http.StatusOK, gin.H{"message": "Draf tersimpan"})
	}
}

// 5. Get List History/Status Audit (Untuk Masterlist Auditor - Modul 2)
// [UPDATED] Menampilkan RPT_OPEN, RPT_PROGRESS, dan RPT_REJECTED_PIC
func GetAuditorMasterlist(c *gin.Context) {
	ctx := context.Background()

	sqlQuery := `
		SELECT 
			p.pelaksanaan_id, 
			p.tanggal_audit, 
			COALESCE(s.nama_site, '-') AS site, 
			COALESCE(a.nama_area, '-') AS area,
			COALESCE(j.nama_jenis_audit, '-') AS jenis_audit,
			COALESCE(STRING_AGG(DISTINCT u.nama_lengkap, ', '), '-') AS auditor,
			p.status_laporan,
			COUNT(DISTINCT lt.temuan_id) FILTER (WHERE lt.status = 'NOK') AS jumlah_temuan_nok,
			(SELECT no_fta FROM laporan_temuan WHERE pelaksanaan_id = p.pelaksanaan_id AND no_fta IS NOT NULL LIMIT 1) AS no_fta,
			COALESCE(p.note_reject, '') AS note_reject,
			COALESCE(array_to_json(p.auditor_ids)::text, '[]') AS auditor_ids_json
		FROM 
			pelaksanaan_audit p
		LEFT JOIN laporan_temuan lt ON p.pelaksanaan_id = lt.pelaksanaan_id
		LEFT JOIN site s ON p.site_id = s.site_id
		LEFT JOIN jenis_audit j ON p.jenis_audit_id = j.id_jenis_audit
		LEFT JOIN area a ON p.area_id = a.area_id
		LEFT JOIN users u ON u.user_id = ANY(p.auditor_ids)
		WHERE 
			-- Tampilkan yang statusnya OPEN, PROGRESS, atau REVISION (Rejected PIC)
			p.status_laporan IN ($1, $2, $3)
		GROUP BY 
			p.pelaksanaan_id, p.tanggal_audit, s.nama_site, a.nama_area, j.nama_jenis_audit, p.status_laporan, p.note_reject, p.auditor_ids
		ORDER BY 
			p.tanggal_audit DESC
	`

	rows, err := config.DB.Query(ctx, sqlQuery, models.StatusRptOpen, models.StatusRptProgress, models.StatusRptRejectedPic)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil masterlist auditor: " + err.Error()})
		return
	}
	defer rows.Close()

	var masterlist []models.MasterlistAudit
	for rows.Next() {
		var item models.MasterlistAudit
		var tglAudit time.Time
		var noFTA *string
		var auditorIDsJson string

		err := rows.Scan(
			&item.PelaksanaanID, &tglAudit, &item.NamaSite, &item.NamaArea, &item.NamaJenisAudit, &item.NamaAuditor,
			&item.StatusLaporan, &item.JumlahTemuanNOK, &noFTA, &item.NoteReject, &auditorIDsJson,
		)

		if err != nil {
			continue
		}

		item.TanggalAudit = tglAudit
		if noFTA != nil {
			item.NoFTA = noFTA
		}

		if auditorIDsJson != "" {
			_ = json.Unmarshal([]byte(auditorIDsJson), &item.AuditorIDs)
		} else {
			item.AuditorIDs = []int64{}
		}
		masterlist = append(masterlist, item)
	}

	if masterlist == nil {
		masterlist = []models.MasterlistAudit{}
	}
	c.JSON(http.StatusOK, gin.H{"data": masterlist})
}
