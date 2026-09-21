package controllers

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/vaneshadhani/e-audit-backend/config"
	"github.com/vaneshadhani/e-audit-backend/helpers"
	"github.com/vaneshadhani/e-audit-backend/models"
)

// ==========================================
// KONTROLER 5: EVIDENCE & VERIFICATION (PIC & INSPEKTOR)
// ==========================================

// 1. Get Masterlist Upload Bukti (PIC)
func GetEvidenceMasterlist(c *gin.Context) {
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
        COUNT(DISTINCT lt.temuan_id) FILTER (
            WHERE lt.status_evidence IN ('EVIDENCE_VERIF_PROGRESS', 'FINAL_CLOSING', 'CLOSED')
        ) AS jml_selesai,
        COUNT(DISTINCT lt.temuan_id) FILTER (WHERE lt.status != 'OK') AS jml_temuan,
        -- Gunakan COALESCE ekstra kuat di sini
		COALESCE((SELECT no_fta FROM laporan_temuan WHERE pelaksanaan_id = p.pelaksanaan_id AND no_fta IS NOT NULL LIMIT 1), '-') AS no_fta,
        COALESCE(MAX(lt.updated_at_evidence)::text, '-') AS tgl_submit
    FROM pelaksanaan_audit p
    LEFT JOIN laporan_temuan lt ON p.pelaksanaan_id = lt.pelaksanaan_id
    LEFT JOIN site s ON p.site_id = s.site_id
    LEFT JOIN jenis_audit j ON p.jenis_audit_id = j.id_jenis_audit
    LEFT JOIN area a ON p.area_id = a.area_id
    LEFT JOIN users u ON u.user_id = ANY(p.auditor_ids)
    WHERE p.status_laporan NOT IN ('CLOSED', 'RPT_OPEN')
    GROUP BY p.pelaksanaan_id, p.tanggal_audit, s.nama_site, a.nama_area, j.nama_jenis_audit, p.status_laporan
    ORDER BY p.tanggal_audit DESC
    `

	rows, err := config.DB.Query(ctx, sqlQuery)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var list []models.EvidenceListResponse
	for rows.Next() {
		var item models.EvidenceListResponse

		// --- SOLUSI UTAMA: Gunakan sql.NullString ---
		var noFTANull sql.NullString
		var tglSubmitNull sql.NullString

		err := rows.Scan(
				&item.PelaksanaanID,  // 0
				&item.TanggalAudit,   // 1
				&item.NamaSite,       // 2
				&item.NamaArea,       // 3
				&item.NamaJenisAudit, // 4
				&item.NamaAuditor,    // 5
				&item.StatusLaporan,  // 6
				&item.JumlahSelesai,  // 7
				&item.JumlahTemuan,   // 8
				&noFTANull,           // 9 (Kolom no_fta)
				&tglSubmitNull,       // 10 (Kolom tgl_submit)
		)

		if err != nil {
			fmt.Println("Error Scan Masterlist detail:", err)
			continue
		}

		// Konversi dari sql.NullString ke string biasa untuk JSON
		if noFTANull.Valid {
			item.NoFTA = noFTANull.String
		} else {
			item.NoFTA = "-"
		}

		if tglSubmitNull.Valid {
			item.TglSubmitEvidence = tglSubmitNull.String
		} else {
			item.TglSubmitEvidence = "-"
		}

		list = append(list, item)
	}

	c.JSON(200, gin.H{"data": list})
}

// 2. Upload Evidence (PIC)
func UploadEvidence(c *gin.Context) {
	ctx := context.Background()
	pelaksanaanID := c.Param("id")
	itemID := strings.Split(c.Param("itemId"), ":")[0]

	notes := c.PostForm("catatan_perbaikan")
	if notes == "" {
		notes = c.PostForm("notes")
	}

	form, _ := c.MultipartForm()
	var files []*multipart.FileHeader
	if form != nil {
		files = form.File["files"]
	}

	var filePaths []string
	if len(files) > 0 {
		saveDir := filepath.Join("uploads", fmt.Sprintf("audit_%s", pelaksanaanID), fmt.Sprintf("evidence_%s", itemID))
		os.MkdirAll(saveDir, os.ModePerm)
		for _, fileHeader := range files {
			uniqueName := fmt.Sprintf("%d-%s", time.Now().Unix(), fileHeader.Filename)
			savePath := filepath.Join(saveDir, uniqueName)
			c.SaveUploadedFile(fileHeader, savePath)
			filePaths = append(filePaths, savePath)
		}
	}

	tx, err := config.DB.Begin(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal transaksi"})
		return
	}
	defer tx.Rollback(ctx)

	var existingBuktiJSON sql.NullString
	tx.QueryRow(ctx, `SELECT pelaporan_bukti_perbaikan FROM laporan_temuan WHERE pelaksanaan_id=$1 AND item_id=$2`, pelaksanaanID, itemID).Scan(&existingBuktiJSON)

	var finalFiles []string
	if existingBuktiJSON.Valid && existingBuktiJSON.String != "" && existingBuktiJSON.String != "null" {
		json.Unmarshal([]byte(existingBuktiJSON.String), &finalFiles)
	}
	finalFiles = append(finalFiles, filePaths...)
	finalJSON, _ := json.Marshal(finalFiles)

	_, err = tx.Exec(ctx, `
        UPDATE laporan_temuan 
    SET pelaporan_bukti_perbaikan = $1, 
        catatan_perbaikan = $2, 
        tgl_upload_bukti = NOW(), 
        hasil_verifikasi = NULL, 
        catatan_verifikasi = NULL,
        status_evidence = 'EVIDENCE_VERIF_PROGRESS',
        updated_at_evidence = NOW()
    WHERE pelaksanaan_id = $3 AND item_id = $4
    `, string(finalJSON), notes, pelaksanaanID, itemID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal update item: " + err.Error()})
		return
	}

	_, err = tx.Exec(ctx, `
        UPDATE pelaksanaan_audit 
        SET status_laporan = 'EVIDENCE_VERIF_PROGRESS' 
        WHERE pelaksanaan_id = $1
    `, pelaksanaanID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal update status header: " + err.Error()})
		return
	}

	tx.Commit(ctx)
	c.JSON(http.StatusOK, gin.H{"message": "Bukti berhasil diupload"})
}

func SubmitPerbaikanToVerification(c *gin.Context) {
	c.JSON(http.StatusBadRequest, gin.H{
		"error": "Submit global sudah tidak digunakan. Sistem sekarang menggunakan verifikasi per item.",
	})
}

// 4. Get Masterlist Verifikasi (Inspektor)
func GetEvidenceVerifList(c *gin.Context) {
	ctx := context.Background()
	type EvidenceVerifData struct {
		PelaksanaanID  uint      `json:"id"`
		TanggalAudit   time.Time `json:"tanggal"`
		NamaSite       string    `json:"site"`
		NamaArea       string    `json:"area"`
		NamaJenisAudit string    `json:"jenis_audit"`
		NamaAuditor    string    `json:"auditor"`
		JumlahTemuan   int       `json:"jml_temuan"`
		NoFTA          *string   `json:"no_fta"`
		TglSubmitEvd   *string   `json:"tgl_submit_evidence"`
		Status         string    `json:"status"`
	}

	sqlQuery := `
        SELECT 
            p.pelaksanaan_id, p.tanggal_audit, COALESCE(s.nama_site, '-'), COALESCE(a.nama_area, '-'), 
            COALESCE(j.nama_jenis_audit, '-'), COALESCE(STRING_AGG(DISTINCT u.nama_lengkap, ', '), '-'),
            (SELECT COUNT(*) FROM laporan_temuan lt WHERE lt.pelaksanaan_id = p.pelaksanaan_id AND lt.status != 'OK'),
            (SELECT no_fta FROM laporan_temuan WHERE pelaksanaan_id = p.pelaksanaan_id AND no_fta IS NOT NULL LIMIT 1),
            p.tgl_submit_capa::text, p.status_laporan
        FROM pelaksanaan_audit p
        LEFT JOIN site s ON p.site_id = s.site_id
        LEFT JOIN area a ON p.area_id = a.area_id
        LEFT JOIN jenis_audit j ON p.jenis_audit_id = j.id_jenis_audit
        LEFT JOIN users u ON u.user_id = ANY(p.auditor_ids)
        WHERE EXISTS ( SELECT 1 FROM laporan_temuan lt
		WHERE lt.pelaksanaan_id = p.pelaksanaan_id AND lt.status_evidence = 'EVIDENCE_VERIF_PROGRESS')
        GROUP BY p.pelaksanaan_id, p.tanggal_audit, s.nama_site, a.nama_area, j.nama_jenis_audit, p.tgl_submit_capa, p.status_laporan
        ORDER BY p.tgl_submit_capa DESC
    `

	rows, err := config.DB.Query(ctx, sqlQuery)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal ambil list verifikasi"})
		return
	}
	defer rows.Close()

	var list []EvidenceVerifData
	for rows.Next() {
		var item EvidenceVerifData
		var tglSub, noFTA sql.NullString
		if err := rows.Scan(&item.PelaksanaanID, &item.TanggalAudit, &item.NamaSite, &item.NamaArea, &item.NamaJenisAudit, &item.NamaAuditor, &item.JumlahTemuan, &noFTA, &tglSub, &item.Status); err == nil {
			if tglSub.Valid {
				item.TglSubmitEvd = &tglSub.String
			}
			if noFTA.Valid {
				item.NoFTA = &noFTA.String
			}
			list = append(list, item)
		}
	}
	if list == nil {
		list = []EvidenceVerifData{}
	}
	c.JSON(http.StatusOK, gin.H{"data": list})
}

func GetFinalVerificationList(c *gin.Context) {
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
        COUNT(DISTINCT lt.temuan_id) FILTER (WHERE lt.status_evidence IN ('EVIDENCE_VERIF_PROGRESS', 'FINAL_CLOSING')) AS jml_selesai,
        COUNT(DISTINCT lt.temuan_id) FILTER (WHERE lt.status != 'OK') AS jml_temuan,
        (SELECT no_fta FROM laporan_temuan WHERE pelaksanaan_id = p.pelaksanaan_id AND no_fta IS NOT NULL LIMIT 1) AS no_fta,
        COALESCE(MAX(lt.updated_at_evidence)::text, '-') AS tgl_submit_evidence
    FROM pelaksanaan_audit p
    LEFT JOIN laporan_temuan lt ON p.pelaksanaan_id = lt.pelaksanaan_id
    LEFT JOIN site s ON p.site_id = s.site_id
    LEFT JOIN area a ON p.area_id = a.area_id
    LEFT JOIN jenis_audit j ON p.jenis_audit_id = j.id_jenis_audit
    LEFT JOIN users u ON u.user_id = ANY(p.auditor_ids)
	-- DEBUG: Hapus WHERE EXISTS sementara untuk melihat apakah data muncul
    GROUP BY p.pelaksanaan_id, p.tanggal_audit, s.nama_site, a.nama_area, j.nama_jenis_audit, p.status_laporan
    ORDER BY p.tanggal_audit DESC
`

	rows, err := config.DB.Query(ctx, sqlQuery)
	if err != nil {
		fmt.Println("Error SQL Final Verif:", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var list []models.FinalVerifData

	for rows.Next() {
		var item models.FinalVerifData
		var noFTA, tglMasuk sql.NullString
		var jmlSelesai, jmlTemuan int // Variabel penampung count

		// URUTAN SCAN HARUS SAMA DENGAN SELECT (1 s/d 10)
		err := rows.Scan(
			&item.PelaksanaanID,  // 1
			&item.TanggalAudit,   // 2
			&item.NamaSite,       // 3
			&item.NamaArea,       // 4
			&item.NamaJenisAudit, // 5
			&item.NamaAuditor,    // 6
			&item.StatusLaporan,
			&jmlSelesai, // 7 (Baru ditambahkan)
			&jmlTemuan,  // 8 (jml_temuan)
			&noFTA,      // 9
			&tglMasuk,   // 10
		)

		if err != nil {
			fmt.Println("Error Scan Row:", err)
			continue
		}

		item.JumlahSelesai = jmlSelesai
		item.JumlahTemuan = jmlTemuan

		if noFTA.Valid {
			val := noFTA.String
			item.NoFTA = &val
		}
		if tglMasuk.Valid {
			val := tglMasuk.String
			item.TglMasukFinal = &val
		}

		list = append(list, item)
	}

	if list == nil {
		list = []models.FinalVerifData{}
	}

	c.JSON(http.StatusOK, gin.H{"data": list})
}

// 5. Get Detail Verifikasi (Filtered by Module - TYPE SAFE)
func GetEvidenceVerifDetail(c *gin.Context) {
	id := c.Param("id")
	module := strings.ToLower(c.Query("module"))

	data, err := helpers.FetchAuditDetailFull(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal ambil detail: " + err.Error()})
		return
	}

	// =====================================
	// FILTER ITEM BERDASARKAN status_evidence
	// =====================================

	var filtered []models.TemuanItemResponse

	for _, t := range data.Temuan {

		status := strings.ToUpper(t.StatusEvidence)

		switch module {

		case "pic":
			if status == "READY_FOR_CAPA" ||
				status == "EVIDENCE_IN_PROGRESS" ||
				status == "EVIDENCE_REJECTED_AUDITOR" ||
				status == "EVIDENCE_REJECTED_QSSPV" {
				filtered = append(filtered, t)
			}

		case "qs":
			if status == "EVIDENCE_VERIF_PROGRESS" {
				filtered = append(filtered, t)
			}

		case "spv":
			if status == "FINAL_CLOSING" {
				filtered = append(filtered, t)
			}

		case "report":
			filtered = append(filtered, t)

		default:
			filtered = append(filtered, t)
		}
	}

	data.Temuan = filtered

	summary := models.AuditProgressSummary{
		TotalItems:  len(filtered),
		StatusLabel: fmt.Sprintf("Mode: %s", strings.ToUpper(module)),
	}

	c.JSON(http.StatusOK, gin.H{
		"data": gin.H{
			"master":  data.Master,
			"temuan":  data.Temuan,
			"summary": summary,
		},
	})
}

// 6. Action Verifikasi: Upload Bukti Verifikator (Inspektor)
func UploadVerificatorEvidence(c *gin.Context) {
	ctx := context.Background()
	pelaksanaanID := c.Param("id")
	itemID := strings.Split(c.Param("itemId"), ":")[0]
	notes := c.PostForm("catatan_verifikasi")
	if notes == "" {
		notes = c.PostForm("notes")
	}

	form, _ := c.MultipartForm()
	var files []*multipart.FileHeader
	if form != nil {
		files = form.File["files"]
	}

	var uploadedFiles []string
	if len(files) > 0 {
		saveDir := filepath.Join("uploads", fmt.Sprintf("audit_%s", pelaksanaanID), fmt.Sprintf("verif_evidence_%s", itemID))
		os.MkdirAll(saveDir, os.ModePerm)
		for _, file := range files {
			uniqueName := fmt.Sprintf("VERIF-%d-%s", time.Now().Unix(), file.Filename)
			savePath := filepath.Join(saveDir, uniqueName)
			c.SaveUploadedFile(file, savePath)
			uploadedFiles = append(uploadedFiles, savePath)
		}
	}

	var cmd pgconn.CommandTag
	var err error
	if len(uploadedFiles) > 0 {
		finalJSON, _ := json.Marshal(uploadedFiles)
		cmd, err = config.DB.Exec(ctx, `UPDATE laporan_temuan SET bukti_verifikasi = $1, catatan_verifikasi = $2 WHERE pelaksanaan_id = $3 AND item_id = $4`, string(finalJSON), notes, pelaksanaanID, itemID)
	} else {
		cmd, err = config.DB.Exec(ctx, `UPDATE laporan_temuan SET catatan_verifikasi = $1 WHERE pelaksanaan_id = $2 AND item_id = $3`, notes, pelaksanaanID, itemID)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal simpan verifikasi"})
		return
	}
	if cmd.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Item tidak ditemukan"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Data verifikasi tersimpan"})
}

// 7. SUBMIT HEADER KE FINAL (DENGAN LOGIKA PEMBEDAAN STATUS)
func SubmitVerifikasiToFinal(c *gin.Context) {
	c.JSON(http.StatusBadRequest, gin.H{
		"error": "Submit header tidak digunakan lagi. Final Closing dilakukan otomatis per item.",
	})
}

// 8. APPROVE ITEM (Wrapper)
func ApproveVerificationItem(c *gin.Context) {
	updateVerificationStatus(c, "APPROVED", "")
}

// ==========================================
// REVISI CONTROLLER 9 & 10
// ==========================================

// 9. REJECT ITEM (Wrapper - FIX ERROR 400 & LOGIC FINAL)
func RejectVerificationItem(c *gin.Context) {
	// Struktuk input untuk menangkap alasan
	var input struct {
		Reason string `json:"reason" form:"reason"` // Tambahkan form tag agar support FormData
	}

	// 1. Coba Bind JSON (untuk request application/json)
	if err := c.ShouldBindJSON(&input); err != nil {
		// 2. Jika gagal JSON, coba ambil dari PostForm (untuk request multipart/form-data)
		input.Reason = c.PostForm("reason")

		// 3. Jika masih kosong, set default (jangan return error 400 agar tidak memblokir proses)
		if input.Reason == "" {
			input.Reason = "Ditolak (Tidak ada catatan spesifik)"
		}
	}

	// Panggil fungsi update status dengan status REJECTED
	updateVerificationStatus(c, "REJECTED", input.Reason)
}

func updateVerificationStatus(c *gin.Context, action string, reason string) {
	ctx := context.Background()

	paramID := c.Param("id")
	paramItemID := c.Param("itemId")

	var pelaksanaanID, itemID string

	if strings.Contains(paramID, ":") {
		parts := strings.Split(paramID, ":")
		pelaksanaanID = parts[0]
		itemID = parts[1]
	} else {
		pelaksanaanID = paramID
		itemID = strings.Split(paramItemID, ":")[0]
	}

	if pelaksanaanID == "" || itemID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID tidak valid"})
		return
	}

	// =========================
	// RESET
	// =========================
	if action == "NULL" {
		_, err := config.DB.Exec(ctx, `
			UPDATE laporan_temuan
			SET hasil_verifikasi = NULL,
			    catatan_verifikasi = NULL,
			    catatan_verifikasi_bukti = NULL,
			    tgl_verifikasi = NULL
			WHERE pelaksanaan_id = $1 AND item_id = $2
		`, pelaksanaanID, itemID)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal reset status"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Status berhasil direset"})
		return
	}

	// =========================
	// CEK STATUS EVIDENCE SAAT INI
	// =========================
	var currentEvidenceStatus string
	err := config.DB.QueryRow(ctx, `
		SELECT status_evidence 
		FROM laporan_temuan 
		WHERE pelaksanaan_id = $1 AND item_id = $2
	`, pelaksanaanID, itemID).Scan(&currentEvidenceStatus)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Item tidak ditemukan"})
		return
	}

	var newEvidenceStatus string

	// =========================
	// LAYER 1 (QS STAFF)
	// =========================
	if currentEvidenceStatus == "EVIDENCE_VERIF_PROGRESS" {

		if action == "APPROVED" {
			newEvidenceStatus = "FINAL_CLOSING"
		}

		if action == "REJECTED" {
			newEvidenceStatus = "EVIDENCE_REJECTED_AUDITOR"
		}
	}

	// =========================
	// LAYER 2 (QS SPV)
	// =========================
	if currentEvidenceStatus == "FINAL_CLOSING" {

		if action == "APPROVED" {
			newEvidenceStatus = "CLOSED"
		}

		if action == "REJECTED" {
			newEvidenceStatus = "EVIDENCE_REJECTED_QSSPV"
		}
	}

	if newEvidenceStatus == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Transisi status tidak valid"})
		return
	}

	// =========================
	// UPDATE ITEM
	// =========================
	_, err = config.DB.Exec(ctx, `
		UPDATE laporan_temuan
		SET hasil_verifikasi = $1,
		    catatan_verifikasi_bukti = $2,
		    status_evidence = $3,
		    tgl_verifikasi = NOW(),
		    updated_at_evidence = NOW()
		WHERE pelaksanaan_id = $4 AND item_id = $5
	`, action, reason, newEvidenceStatus, pelaksanaanID, itemID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal update status"})
		return
	}

	// =========================
	// SYNC STATUS HEADER
	// =========================
	syncPelaksanaanStatus(ctx, pelaksanaanID)

	// =========================
	// AUTO CLOSE HEADER (SUMMARY ONLY)
	// =========================
	checkAndCloseFTA(ctx, pelaksanaanID)

	c.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Item berhasil di-update ke %s", newEvidenceStatus),
	})
}

func checkAndCloseFTA(ctx context.Context, pelaksanaanID string) {
	var count int

	config.DB.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM laporan_temuan
		WHERE pelaksanaan_id = $1
		AND status != 'OK'
		AND status_evidence != 'CLOSED'
	`, pelaksanaanID).Scan(&count)

	if count == 0 {
		config.DB.Exec(ctx, `
			UPDATE pelaksanaan_audit
			SET status_laporan = 'CLOSED', tanggal_selesai = NOW()
			WHERE pelaksanaan_id = $1
		`, pelaksanaanID)
	}
}

// FUNGSI BARU: Sinkronisasi status_laporan header berdasarkan status_evidence item-item di dalamnya
func syncPelaksanaanStatus(ctx context.Context, pelaksanaanID string) {
	var countFinalClosing int
	config.DB.QueryRow(ctx, `
		SELECT COUNT(*) FROM laporan_temuan
		WHERE pelaksanaan_id = $1 AND status != 'OK' AND status_evidence = 'FINAL_CLOSING'
	`, pelaksanaanID).Scan(&countFinalClosing)

	var countRejected int
	config.DB.QueryRow(ctx, `
		SELECT COUNT(*) FROM laporan_temuan
		WHERE pelaksanaan_id = $1 AND status != 'OK' AND status_evidence IN ('EVIDENCE_REJECTED_AUDITOR', 'EVIDENCE_REJECTED_QSSPV')
	`, pelaksanaanID).Scan(&countRejected)

	var countInProgress int
	config.DB.QueryRow(ctx, `
		SELECT COUNT(*) FROM laporan_temuan
		WHERE pelaksanaan_id = $1 AND status != 'OK' AND status_evidence = 'EVIDENCE_VERIF_PROGRESS'
	`, pelaksanaanID).Scan(&countInProgress)

	if countRejected > 0 {
		config.DB.Exec(ctx, `UPDATE pelaksanaan_audit SET status_laporan = 'EVIDENCE_REJECTED_AUDITOR' WHERE pelaksanaan_id = $1`, pelaksanaanID)
	} else if countFinalClosing > 0 {
		config.DB.Exec(ctx, `UPDATE pelaksanaan_audit SET status_laporan = 'FINAL_CLOSING' WHERE pelaksanaan_id = $1`, pelaksanaanID)
	} else if countInProgress > 0 {
		config.DB.Exec(ctx, `UPDATE pelaksanaan_audit SET status_laporan = 'EVIDENCE_VERIF_PROGRESS' WHERE pelaksanaan_id = $1`, pelaksanaanID)
	}
}

// --- KHUSUS FINAL VERIFIKASI (SUPERVISOR) ---

// 1. Final Approve (Menutup Item)
func FinalApproveItem(c *gin.Context) {
	pelaksanaanID := c.Param("id")
	itemID := c.Param("itemId")

	ctx := context.Background()

	// Langsung set ke CLOSED karena ini tahap akhir
	_, err := config.DB.Exec(ctx, `
        UPDATE laporan_temuan
        SET hasil_verifikasi = 'APPROVED',
            status_evidence = 'CLOSED',
            tgl_verifikasi = NOW(),
            updated_at_evidence = NOW()
        WHERE pelaksanaan_id = $1 AND item_id = $2
    `, pelaksanaanID, itemID)

	if err != nil {
		c.JSON(500, gin.H{"error": "Gagal Close Item: " + err.Error()})
		return
	}

	// SYNC STATUS HEADER
	syncPelaksanaanStatus(ctx, pelaksanaanID)

	checkAndCloseFTA(ctx, pelaksanaanID)

	c.JSON(200, gin.H{"message": "Item Berhasil di CLOSE"})
}

// 2. Final Reject (Mengembalikan ke PIC dengan status QSSPV)
func FinalRejectItem(c *gin.Context) {
	pelaksanaanID := c.Param("id")
	itemID := c.Param("itemId")

	var input struct {
		Reason string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		input.Reason = c.PostForm("reason")
	}

	ctx := context.Background()

	// Set ke REJECTED_QSSPV agar PIC tahu ini reject dari level atas
	_, err := config.DB.Exec(ctx, `
        UPDATE laporan_temuan
        SET hasil_verifikasi = 'REJECTED',
            catatan_verifikasi_bukti = $1,
            status_evidence = 'EVIDENCE_REJECTED_QSSPV', 
            tgl_verifikasi = NOW(),
            updated_at_evidence = NOW()
        WHERE pelaksanaan_id = $1 AND item_id = $2
    `, input.Reason, pelaksanaanID, itemID)

	if err != nil {
		c.JSON(500, gin.H{"error": "Gagal Reject Item: " + err.Error()})
		return
	}

	// SYNC STATUS HEADER
	syncPelaksanaanStatus(ctx, pelaksanaanID)

	c.JSON(200, gin.H{"message": "Item dikembalikan ke PIC oleh Supervisor"})
}

// Alias
func VerifyItemApprove(c *gin.Context) { ApproveVerificationItem(c) }
func VerifyItemReject(c *gin.Context)  { RejectVerificationItem(c) }
func VerifyItemReset(c *gin.Context)   { updateVerificationStatus(c, "NULL", "") }
