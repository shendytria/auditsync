package controllers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/vaneshadhani/e-audit-backend/config"
	"github.com/vaneshadhani/e-audit-backend/helpers"
	"github.com/vaneshadhani/e-audit-backend/models"
)

// ==========================================
// KONTROLER 3: AUDIT CAPA (SUPERVISOR AREA)
// Fokus: Assign PIC, Isi Plan CAPA, Submit ke Approval
// ==========================================

// 1. Get Masterlist CAPA
func GetCAPAMasterlist(c *gin.Context) {
	ctx := context.Background()

	sqlQuery := `
		SELECT 
			p.pelaksanaan_id, 
			p.tanggal_audit, 
			COALESCE(s.nama_site, '-') AS site, 
			COALESCE(a.nama_area, '-') AS area,
			COALESCE(j.nama_jenis_audit, '-') AS jenis_audit,
			COALESCE((
				SELECT STRING_AGG(u.nama_lengkap, ', ')
				FROM users u
				WHERE u.user_id = ANY(p.auditor_ids)
			), '-') AS auditor,
			p.status_laporan,
			(SELECT COUNT(*) FROM laporan_temuan lt WHERE lt.pelaksanaan_id = p.pelaksanaan_id AND lt.status = 'NOK') AS jumlah_temuan_nok,
			(SELECT no_fta FROM laporan_temuan lt WHERE lt.pelaksanaan_id = p.pelaksanaan_id AND no_fta IS NOT NULL LIMIT 1) AS no_fta,
			COALESCE(p.note_reject, '') AS note_reject,
			
			COALESCE(array_to_json(p.approver_pic_capa_ids)::text, '[]'),
			COALESCE(json_agg(DISTINCT lt.pic_user_id) FILTER (WHERE lt.pic_user_id IS NOT NULL)::text, '[]') as item_pic_ids

		FROM 
			pelaksanaan_audit p
		LEFT JOIN site s ON p.site_id = s.site_id
		LEFT JOIN jenis_audit j ON p.jenis_audit_id = j.id_jenis_audit
		LEFT JOIN area a ON p.area_id = a.area_id
		LEFT JOIN laporan_temuan lt ON p.pelaksanaan_id = lt.pelaksanaan_id 
		WHERE 
			p.status_laporan IN ($1, $2, $3, $4)

		GROUP BY 
			p.pelaksanaan_id, p.tanggal_audit, s.nama_site, a.nama_area, j.nama_jenis_audit, p.status_laporan, p.note_reject, p.approver_pic_capa_ids
		ORDER BY 
			p.tanggal_audit DESC
	`

	rows, err := config.DB.Query(ctx, sqlQuery,
		models.StatusCapaOpen,
		models.StatusCapaInProgress,
		models.StatusCapaRejectedQsSpv,
		"CAPA_REJECTED_MGR",
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal ambil data CAPA: " + err.Error()})
		return
	}
	defer rows.Close()

	var list []models.CapaListResponse
	for rows.Next() {
		var item models.CapaListResponse
		var noFTA *string
		var rawStatus string
		var noteReject string
		var spvIDsJson, itemPicIDsJson string

		if err := rows.Scan(
			&item.ID, &item.Tanggal, &item.Site, &item.Area, &item.JenisAudit, &item.Auditor,
			&rawStatus, &item.JumlahTemuan, &noFTA, &noteReject, &spvIDsJson, &itemPicIDsJson,
		); err != nil {
			continue
		}

		if noFTA != nil {
			item.NoFTA = *noFTA
		} else {
			item.NoFTA = "-"
		}
		if noteReject != "" {
			item.NoteReject = &noteReject
		}

		if spvIDsJson != "" {
			_ = json.Unmarshal([]byte(spvIDsJson), &item.SupervisorAreaIDs)
		}
		if itemPicIDsJson != "" {
			_ = json.Unmarshal([]byte(itemPicIDsJson), &item.ItemPicIDs)
		}

		switch rawStatus {
		case models.StatusCapaRejectedQsSpv:
			item.Status = "Returned by QS SPV"
		case "CAPA_REJECTED_MGR":
			item.Status = "Returned by QS Manager"
		case models.StatusCapaOpen:
			item.Status = "Open"
		case models.StatusCapaInProgress:
			item.Status = "In Progress"
		default:
			item.Status = rawStatus
		}

		list = append(list, item)
	}
	if list == nil {
		list = []models.CapaListResponse{}
	}

	c.JSON(http.StatusOK, gin.H{"data": list})
}

// 2. Reject Temuan (Kembalikan ke Auditor)
func RejectCapaToAuditor(c *gin.Context) {
	ctx := context.Background()
	pelaksanaanID := c.Param("id")

	uidRaw, exists := c.Get("userID")
	if !exists {
		c.JSON(401, gin.H{"error": "Unauthorized"})
		return
	}

	loginUserID, _ := strconv.Atoi(fmt.Sprintf("%v", uidRaw))

	// cek PIC AREA
	var picAreaJSON string
	err := config.DB.QueryRow(ctx,
		`SELECT COALESCE(array_to_json(approver_pic_capa_ids)::text,'[]')
		 FROM pelaksanaan_audit WHERE pelaksanaan_id=$1`,
		pelaksanaanID,
	).Scan(&picAreaJSON)

	if err != nil {
		c.JSON(500, gin.H{"error": "Gagal cek PIC Area"})
		return
	}

	var picAreaIDs []int
	json.Unmarshal([]byte(picAreaJSON), &picAreaIDs)

	isPICAREA := false
	for _, id := range picAreaIDs {
		if id == loginUserID {
			isPICAREA = true
			break
		}
	}

	if !isPICAREA {
		c.JSON(403, gin.H{"error": "Hanya PIC Area boleh reject"})
		return
	}

	var input models.RejectInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Input reason invalid"})
		return
	}

	sqlQuery := `UPDATE pelaksanaan_audit SET status_laporan=$1, note_reject=$2 WHERE pelaksanaan_id=$3`
	_, err = config.DB.Exec(ctx, sqlQuery, models.StatusRptRejectedPic, input.Reason, pelaksanaanID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal update status: " + err.Error()})
		return
	}

	helpers.CreateAuditLog(c, "REJECT_TO_AUDITOR", "Audit Workflow", pelaksanaanID, nil, gin.H{"reason": input.Reason})
	c.JSON(http.StatusOK, gin.H{"message": "Laporan dikembalikan ke Auditor"})
}

// 3. Assign PIC CAPA
func AssignPICAndStart(c *gin.Context) {
	ctx := context.Background()
	pelaksanaanID := c.Param("id")

	uidRaw, exists := c.Get("userID")
	if !exists {
		c.JSON(401, gin.H{"error": "Unauthorized"})
		return
	}

	loginUserID, _ := strconv.Atoi(fmt.Sprintf("%v", uidRaw))

	var picAreaJSON string
	err := config.DB.QueryRow(ctx,
		`SELECT COALESCE(array_to_json(approver_pic_capa_ids)::text,'[]')
		FROM pelaksanaan_audit WHERE pelaksanaan_id=$1`,
		pelaksanaanID,
	).Scan(&picAreaJSON)

	if err != nil {
		c.JSON(500, gin.H{"error": "Gagal cek PIC Area"})
		return
	}

	var picAreaIDs []int
	json.Unmarshal([]byte(picAreaJSON), &picAreaIDs)

	isPICAREA := false
	for _, id := range picAreaIDs {
		if id == loginUserID {
			isPICAREA = true
			break
		}
	}

	if !isPICAREA {
		c.JSON(403, gin.H{"error": "Hanya PIC Area boleh assign PIC CAPA"})
		return
	}

	var req models.AssignPicRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Data invalid: " + err.Error()})
		return
	}

	tx, err := config.DB.Begin(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal transaksi"})
		return
	}
	defer tx.Rollback(ctx)

	sqlItem := `UPDATE laporan_temuan SET pic_user_id = $1 WHERE pelaksanaan_id = $2 AND item_id = $3`
	for _, assign := range req.Assignments {
		var itemID int
		switch v := assign.ItemID.(type) {
		case float64:
			itemID = int(v)
		case string:
			itemID, _ = strconv.Atoi(v)
		}

		_, err := tx.Exec(ctx, sqlItem, assign.PicID, pelaksanaanID, itemID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal assign PIC: " + err.Error()})
			return
		}
	}

	_, err = tx.Exec(ctx, "UPDATE pelaksanaan_audit SET status_laporan = $1 WHERE pelaksanaan_id = $2",
		models.StatusCapaInProgress, pelaksanaanID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal update status audit"})
		return
	}

	tx.Commit(ctx)
	c.JSON(http.StatusOK, gin.H{"message": "PIC berhasil ditunjuk. Status audit berubah menjadi In Progress."})
}

// 4. Save Draft Item CAPA
func SaveCapaItemDraft(c *gin.Context) {
	ctx := context.Background()
	pelaksanaanID := c.Param("id")
	itemID := c.Param("itemId")

	uidRaw, exists := c.Get("userID")
	if !exists {
		c.JSON(401, gin.H{"error": "Unauthorized"})
		return
	}

	loginUserID, _ := strconv.Atoi(fmt.Sprintf("%v", uidRaw))

	var assignedPIC int
	var picAreaIDs []int

	// ambil PIC item
	err := config.DB.QueryRow(ctx,
		`SELECT pic_user_id FROM laporan_temuan 
     WHERE pelaksanaan_id=$1 AND item_id=$2`,
		pelaksanaanID, itemID,
	).Scan(&assignedPIC)

	if err != nil {
		c.JSON(500, gin.H{"error": "Gagal cek PIC item"})
		return
	}

	// ambil PIC AREA dari header audit
	var picAreaJSON string
	err = config.DB.QueryRow(ctx,
		`SELECT COALESCE(array_to_json(approver_pic_capa_ids)::text,'[]')
     FROM pelaksanaan_audit WHERE pelaksanaan_id=$1`,
		pelaksanaanID,
	).Scan(&picAreaJSON)

	json.Unmarshal([]byte(picAreaJSON), &picAreaIDs)

	// cek apakah login user PIC CAPA atau PIC AREA
	isPICCAPA := loginUserID == assignedPIC
	isPICAREA := false
	for _, id := range picAreaIDs {
		if id == loginUserID {
			isPICAREA = true
			break
		}
	}

	if !isPICCAPA && !isPICAREA {
		c.JSON(403, gin.H{"error": "Anda bukan PIC CAPA atau PIC Area"})
		return
	}

	var input models.CapaInputData
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	sqlQuery := `
		UPDATE laporan_temuan 
		SET 
			penyebab_terdekat = $1,    
			tindakan_remedial = $2,
			due_date = $3              
		WHERE pelaksanaan_id = $4 AND item_id = $5
	`

	var dueDate *string
	if input.DueDate != "" {
		dueDate = &input.DueDate
	}

	_, err = config.DB.Exec(ctx, sqlQuery,
		input.RootCause, input.CorrectiveAction, dueDate,
		pelaksanaanID, itemID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal simpan draft: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Draft item tersimpan"})
}

// 5. Submit CAPA Proposal
// [UPDATED] Memastikan history revisi dihapus saat submit ulang
func SubmitCAPA(c *gin.Context) {
	ctx := context.Background()
	pelaksanaanID := c.Param("id")

	uidRaw, exists := c.Get("userID")
	if !exists {
		c.JSON(401, gin.H{"error": "Unauthorized"})
		return
	}

	loginUserID, _ := strconv.Atoi(fmt.Sprintf("%v", uidRaw))

	// ambil PIC AREA
	var picAreaJSON string
	config.DB.QueryRow(ctx,
		`SELECT COALESCE(array_to_json(approver_pic_capa_ids)::text,'[]')
			FROM pelaksanaan_audit WHERE pelaksanaan_id=$1`,
		pelaksanaanID,
	).Scan(&picAreaJSON)

	var picAreaIDs []int
	json.Unmarshal([]byte(picAreaJSON), &picAreaIDs)

	isPICAREA := false
	for _, id := range picAreaIDs {
		if id == loginUserID {
			isPICAREA = true
			break
		}
	}

	// cek PIC CAPA
	rows, err := config.DB.Query(ctx,
		`SELECT DISTINCT pic_user_id FROM laporan_temuan WHERE pelaksanaan_id=$1`,
		pelaksanaanID,
	)
	if err != nil {
		c.JSON(500, gin.H{"error": "Gagal cek PIC CAPA"})
		return
	}
	defer rows.Close()

	isPICCAPA := false
	for rows.Next() {
		var pid int
		rows.Scan(&pid)
		if pid == loginUserID {
			isPICCAPA = true
		}
	}

	if !isPICAREA && !isPICCAPA {
		c.JSON(403, gin.H{"error": "Hanya PIC CAPA atau PIC Area boleh submit"})
		return
	}

	var req models.SubmitCapaRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Data invalid: " + err.Error()})
		return
	}

	// 1. Cek Status Saat Ini
	var currentStatus string
	err = config.DB.QueryRow(ctx, `SELECT status_laporan FROM pelaksanaan_audit WHERE pelaksanaan_id = $1`, pelaksanaanID).Scan(&currentStatus)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Audit tidak ditemukan"})
		return
	}
	currentStatus = strings.TrimSpace(currentStatus)

	tx, err := config.DB.Begin(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal transaksi"})
		return
	}
	defer tx.Rollback(ctx)

	// 2. Update Items Data + CLEANING PER ITEM
	// PENTING: hasil_verifikasi = NULL dan catatan_verifikasi = NULL
	sqlItem := `
		UPDATE laporan_temuan 
		SET 
			penyebab_terdekat = $1,
			tindakan_remedial = $2,
			due_date = $3,
			status = 'Responded',         
			hasil_verifikasi = NULL,      -- Reset merah/hijau jadi netral
			catatan_verifikasi = NULL     -- Hapus catatan revisi lama
		WHERE pelaksanaan_id = $4 AND item_id = $5
	`

	for _, item := range req.CapaItems {
		var itemID int
		switch v := item.ItemID.(type) {
		case float64:
			itemID = int(v)
		case string:
			itemID, _ = strconv.Atoi(v)
		}

		var dueDate *string
		if item.DueDate != "" {
			dueDate = &item.DueDate
		}

		_, err := tx.Exec(ctx, sqlItem,
			item.RootCause, item.CorrectiveAction, dueDate,
			pelaksanaanID, itemID,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal update item: " + err.Error()})
			return
		}
	}

	// 3. Tentukan Next Status (Logic Shortcut)
	var nextStatus string

	if currentStatus == "CAPA_REJECTED_MGR" {
		// Jika Ditolak QS Manager -> Balik Langsung ke QS Manager
		nextStatus = models.StatusWaitingMgrQs
	} else {
		// Flow Normal / Ditolak QS SPV -> Masuk ke QS Supervisor
		nextStatus = models.StatusWaitingQsSpv
	}

	// 4. Update Header + CLEANING HEADER NOTE
	// PENTING: note_reject = NULL
	sqlUpdateHeader := `
		UPDATE pelaksanaan_audit 
		SET status_laporan = $1, 
			tgl_submit_capa = NOW(), 
			note_reject = NULL        -- Hapus catatan global revisi
		WHERE pelaksanaan_id = $2
	`

	if _, errHeader := tx.Exec(ctx, sqlUpdateHeader, nextStatus, pelaksanaanID); errHeader != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal update status audit: " + errHeader.Error()})
		return
	}

	if err := tx.Commit(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal commit transaksi"})
		return
	}

	helpers.CreateAuditLog(c, "SUBMIT_CAPA_PLAN", "Audit Workflow", pelaksanaanID, nil, gin.H{
		"prev_status": currentStatus,
		"next_status": nextStatus,
	})

	c.JSON(http.StatusOK, gin.H{
		"message":     "Proposal CAPA berhasil disubmit.",
		"next_status": nextStatus,
	})
}

func GetAssignableUsersForCAPA(c *gin.Context) {
	ctx := context.Background()
	pelaksanaanID := c.Param("id")

	var deptID *int

	// 1️⃣ ambil department audit (nullable safe)
	err := config.DB.QueryRow(ctx, `
		SELECT department_id
		FROM pelaksanaan_audit
		WHERE pelaksanaan_id=$1
	`, pelaksanaanID).Scan(&deptID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal ambil department audit"})
		return
	}

	if deptID == nil {
		c.JSON(http.StatusOK, gin.H{"data": []any{}})
		return
	}

	// 2️⃣ ambil users sesuai department
	rows, err := config.DB.Query(ctx, `
		SELECT 
			user_id,
			COALESCE(nama_lengkap,email)
		FROM users
		WHERE department_id=$1
		ORDER BY nama_lengkap
	`, *deptID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":  "Query users gagal",
			"detail": err.Error(),
		})
		return
	}
	defer rows.Close()

	type User struct {
		ID   int    `json:"id"`
		Name string `json:"name"`
	}

	var list []User

	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.Name); err != nil {
			continue
		}
		list = append(list, u)
	}

	if list == nil {
		list = []User{}
	}

	c.JSON(http.StatusOK, gin.H{"data": list})
}
