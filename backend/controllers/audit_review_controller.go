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
	"github.com/vaneshadhani/e-audit-backend/config"
	"github.com/vaneshadhani/e-audit-backend/helpers"
	"github.com/vaneshadhani/e-audit-backend/models"
)

// ==========================================
// KONTROLER 3: REVIEW QS (SUPERVISOR)
// Fokus: QS Supervisor melakukan review, edit temuan, dan approval ke PIC
// ==========================================

// 1. Get Masterlist Review QS
// Menampilkan:
// - Data Baru dari Auditor (QS_REVIEW_OPEN)
// - Data Return dari Manager Area (QS_REJECTED_MGR)
func GetReviewQSMasterlist(c *gin.Context) {
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
			COUNT(DISTINCT lt.temuan_id) FILTER (WHERE lt.status IN ('NOK', 'Open CAPA', 'Responded')) AS jumlah_temuan_nok,
			(SELECT no_fta FROM laporan_temuan WHERE pelaksanaan_id = p.pelaksanaan_id AND no_fta IS NOT NULL LIMIT 1) AS no_fta,
			COALESCE(p.note_reject, '') AS note_reject
		FROM 
			pelaksanaan_audit p
		LEFT JOIN laporan_temuan lt ON p.pelaksanaan_id = lt.pelaksanaan_id
		LEFT JOIN site s ON p.site_id = s.site_id
		LEFT JOIN jenis_audit j ON p.jenis_audit_id = j.id_jenis_audit
		LEFT JOIN area a ON p.area_id = a.area_id
		LEFT JOIN users u ON u.user_id = ANY(p.auditor_ids)
		WHERE 
			-- LOGIC FILTER: Ambil yang statusnya QS_REVIEW_OPEN atau QS_REJECTED_MGR
			p.status_laporan IN ($1, $2)

		GROUP BY 
			p.pelaksanaan_id, p.tanggal_audit, s.nama_site, a.nama_area, j.nama_jenis_audit, p.status_laporan, p.note_reject
		ORDER BY 
			p.tanggal_audit DESC
	`

	rows, err := config.DB.Query(ctx, sqlQuery, models.StatusQsReview, models.StatusQsRejectedMgr)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data review QS: " + err.Error()})
		return
	}
	defer rows.Close()

	var list []models.ReviewQSData
	for rows.Next() {
		var item models.ReviewQSData
		var tglAudit time.Time
		var noFTA *string
		var noteReject string

		err := rows.Scan(
			&item.PelaksanaanID, &tglAudit, &item.NamaSite, &item.NamaArea, &item.NamaJenisAudit, &item.NamaAuditor,
			&item.StatusLaporan, &item.JumlahTemuanNOK, &noFTA, &noteReject,
		)

		if err != nil {
			continue
		}

		item.TanggalAudit = tglAudit
		if noFTA != nil {
			item.NoFTA = noFTA
		}
		if noteReject != "" {
			item.NoteReject = &noteReject
		}

		list = append(list, item)
	}

	if list == nil {
		list = []models.ReviewQSData{}
	}
	c.JSON(http.StatusOK, gin.H{"data": list})
}

// 2. Update Data Temuan (Simple Edit - JSON)
// Edit deskripsi/kategori tanpa upload file baru (Backup method)
func UpdateTemuanQS(c *gin.Context) {
	ctx := context.Background()
	pelaksanaanID := c.Param("id")
	itemID := c.Param("itemId")

	var input models.QSReviewInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	sqlQuery := `
		UPDATE laporan_temuan 
		SET deskripsi_temuan=$1, lokasi_temuan=$2, pic_user_id=$3, kategori_temuan=$4, data_integrity=$5, prinsip_5r=$6 
		WHERE pelaksanaan_id=$7 AND item_id=$8
	`
	_, err := config.DB.Exec(ctx, sqlQuery,
		input.DeskripsiTemuan, input.LokasiTemuan, input.PicUserID,
		input.KategoriTemuan, input.DataIntegrity, input.Prinsip5R,
		pelaksanaanID, itemID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal update: " + err.Error()})
		return
	}

	// Log aktivitas edit
	helpers.CreateAuditLog(c, "UPDATE_TEMUAN_QS", "Audit Item", fmt.Sprintf("%s-%s", pelaksanaanID, itemID), nil, input)

	c.JSON(http.StatusOK, gin.H{"message": "Data temuan berhasil diperbarui"})
}

// 3. Update Item Full (Multipart - Edit Mandiri + File)
// QS Supervisor bisa mengganti file bukti jika Auditor salah upload
func UpdateItemQS(c *gin.Context) {
	ctx := context.Background()
	pelaksanaanID := c.Param("id")

	// Parse Multipart Form
	if err := c.Request.ParseMultipartForm(32 << 20); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal parse form: " + err.Error()})
		return
	}

	answersData := c.PostForm("answers_data")
	if answersData == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Data jawaban kosong"})
		return
	}

	// Struct lokal untuk parsing JSON dari form-data
	type ItemUpdateQS struct {
		ItemID        interface{} `json:"item_id"`
		Deskripsi     string      `json:"deskripsi_temuan"`
		Lokasi        string      `json:"lokasi_temuan"`
		Kategori      string      `json:"kategori_temuan"`
		DataIntegrity string      `json:"data_integrity"`
		Prinsip5R     string      `json:"prinsip_5r"`
		Justification string      `json:"justification"`
		ExistingFiles []string    `json:"existing_files"`
	}

	var items []ItemUpdateQS
	if err := json.Unmarshal([]byte(answersData), &items); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format data item salah: " + err.Error()})
		return
	}

	// Handle File Uploads (jika ada file baru yang disisipkan QS)
	form, _ := c.MultipartForm()
	files := form.File["files"]
	fileItemIDs := form.Value["file_item_ids"]
	uploadedFilesMap := make(map[string][]string)

	if len(files) > 0 {
		for i, fileHeader := range files {
			var itemIDKey string
			if i < len(fileItemIDs) {
				itemIDKey = fileItemIDs[i]
			} else {
				itemIDKey = fmt.Sprintf("qs_%d", i)
			}
			// Gunakan penanda 'qs' di nama file
			uniqueFilename := fmt.Sprintf("%d-qs-%s", time.Now().Unix(), fileHeader.Filename)
			saveDir := filepath.Join("uploads", fmt.Sprintf("audit_%s", pelaksanaanID), fmt.Sprintf("item_%s", itemIDKey))
			os.MkdirAll(saveDir, os.ModePerm)
			savePath := filepath.Join(saveDir, uniqueFilename)
			c.SaveUploadedFile(fileHeader, savePath)
			uploadedFilesMap[itemIDKey] = append(uploadedFilesMap[itemIDKey], savePath)
		}
	}

	tx, err := config.DB.Begin(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal start transaksi"})
		return
	}
	defer tx.Rollback(ctx)

	// Query Update
	// [FIX] Mengubah 'status_verifikasi' menjadi 'hasil_verifikasi' sesuai database
	sqlQuery := `
		UPDATE laporan_temuan 
		SET 
			deskripsi_temuan = $1,
			lokasi_temuan = $2,
			kategori_temuan = $3,
			data_integrity = $4,
			prinsip_5r = $5,
			bukti_temuan = $6,
			justification = $7,
			
			-- Reset Status Verifikasi agar dicek ulang jika sebelumnya ada status
			hasil_verifikasi = NULL,    
			catatan_verifikasi = NULL
			
		WHERE pelaksanaan_id = $8 AND item_id = $9
	`

	for _, item := range items {
		var finalID int
		var itemKey string

		switch v := item.ItemID.(type) {
		case float64:
			finalID = int(v)
			itemKey = fmt.Sprintf("%d", finalID)
		case string:
			finalID, _ = strconv.Atoi(v)
			itemKey = v
		case int:
			finalID = v
			itemKey = fmt.Sprintf("%d", finalID)
		}

		// Gabungkan File Existing + File Baru
		finalFiles := item.ExistingFiles
		if newFiles, ok := uploadedFilesMap[itemKey]; ok {
			finalFiles = append(finalFiles, newFiles...)
		}
		buktiJson, _ := json.Marshal(finalFiles)

		justif := item.Justification
		if justif == "" {
			justif = "Temuan"
		}

		_, err := tx.Exec(ctx, sqlQuery,
			item.Deskripsi, item.Lokasi, item.Kategori, item.DataIntegrity, item.Prinsip5R,
			string(buktiJson), justif, pelaksanaanID, finalID,
		)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal update item ID " + strconv.Itoa(finalID) + ": " + err.Error()})
			return
		}
	}

	if err := tx.Commit(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal commit transaksi"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Data temuan berhasil diperbarui oleh QS Supervisor"})
}

// 4. Approve Review QS
// 4. Approve Review QS (Submit ke Next Step)
// [UPDATED] Menambahkan logic CLEANING (Hapus history revisi) sebelum kirim
func ApproveReviewQS(c *gin.Context) {
	ctx := context.Background()
	pelaksanaanID := c.Param("id")

	// 1. Cek Status Saat Ini
	var currentStatus string
	var noteReject sql.NullString
	queryCheck := `SELECT status_laporan, note_reject FROM pelaksanaan_audit WHERE pelaksanaan_id = $1`

	err := config.DB.QueryRow(ctx, queryCheck, pelaksanaanID).Scan(&currentStatus, &noteReject)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data tidak ditemukan: " + err.Error()})
		return
	}
	currentStatus = strings.TrimSpace(currentStatus)

	var nextStatus string
	var message string
	var queryUpdate string

	// 2. [PENTING] CLEANING DATA ITEM
	// Hapus status 'REVISION' dan catatan 'catatan_verifikasi' pada item
	// Agar saat sampai di Manager Area/PIC, tampilan bersih (tidak merah lagi)
	cleanItemsQuery := `
		UPDATE laporan_temuan 
		SET 
			hasil_verifikasi = NULL,    -- Reset status item (jadi netral)
			catatan_verifikasi = NULL   -- Hapus history catatan revisi item
		WHERE pelaksanaan_id = $1
	`
	if _, err := config.DB.Exec(ctx, cleanItemsQuery, pelaksanaanID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membersihkan data item: " + err.Error()})
		return
	}

	// 3. Logic Status Flow
	isReturnedFromMgr := currentStatus == models.StatusQsRejectedMgr

	if isReturnedFromMgr {
		// [SHORTCUT] Balik ke Manager Area
		nextStatus = models.StatusWaitingMgrArea
		message = "Revisi disetujui. Laporan dikembalikan ke Manager Area."

		// Reset note_reject header (Global Note)
		queryUpdate = `
			UPDATE pelaksanaan_audit 
			SET status_laporan = $1, note_reject = NULL, tgl_approve_qs_spv = NOW() 
			WHERE pelaksanaan_id = $2
		`
	} else {
		// [NORMAL] Kirim ke PIC Area
		nextStatus = models.StatusCapaOpen
		message = "Review selesai. Laporan diteruskan ke PIC Area untuk pengisian CAPA."

		queryUpdate = `
			UPDATE pelaksanaan_audit 
			SET status_laporan = $1, note_reject = NULL 
			WHERE pelaksanaan_id = $2
		`
	}

	// 4. Eksekusi Update Header
	_, err = config.DB.Exec(ctx, queryUpdate, nextStatus, pelaksanaanID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal update status: " + err.Error()})
		return
	}

	helpers.CreateAuditLog(c, "APPROVE_REVIEW_QS", "Audit Workflow", pelaksanaanID, nil, gin.H{
		"prev_status": currentStatus,
		"next_status": nextStatus,
	})

	c.JSON(http.StatusOK, gin.H{
		"message":     message,
		"next_status": nextStatus,
	})
}
