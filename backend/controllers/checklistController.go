package controllers

import (
	"context"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/vaneshadhani/e-audit-backend/config"
	"github.com/vaneshadhani/e-audit-backend/helpers" // <--- IMPORT HELPER AUDIT
	"github.com/xuri/excelize/v2"
)

// --- STRUCTS ---
type ChecklistResponse struct {
	ChecklistID   uint   `json:"checklist_id"`
	NamaChecklist string `json:"nama_checklist"`
	AreaAudit     string `json:"area_audit"`
	Department    string `json:"department"`
	JenisAudit    string `json:"jenis_audit"`
}
type ChecklistItemResponse struct {
	ItemID            uint   `json:"item_id"`
	ItemChecklistText string `json:"item_checklist_text"`
	ReferensiDoc      string `json:"referensi_doc"`
	Kategori          string `json:"kategori"`
	SubKategori       string `json:"sub_kategori"`
}

// --- HELPER FUNCTION ---
func getCell(row []string, index int) string {
	if len(row) > index {
		return strings.TrimSpace(row[index])
	}
	return ""
}

// --- HANDLERS ---

// 1. CreateChecklist: Membuat checklist baru & upload Excel
func CreateChecklist(c *gin.Context) {
	// --- Bagian 1: Simpan Master Checklist (Tidak berubah) ---
	namaChecklist := c.PostForm("nama_checklist")
	areaIDStr := c.PostForm("area_id")
	departmentIDStr := c.PostForm("department_id")
	jenisAuditIDStr := c.PostForm("jenis_audit_id")

	if namaChecklist == "" || areaIDStr == "" || departmentIDStr == "" || jenisAuditIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Semua field wajib diisi (termasuk jenis_audit_id)"})
		return
	}
	areaID, _ := strconv.ParseUint(areaIDStr, 10, 32)
	departmentID, _ := strconv.ParseUint(departmentIDStr, 10, 32)
	jenisAuditID, _ := strconv.ParseUint(jenisAuditIDStr, 10, 32)
	ctx := context.Background()
	tx, err := config.DB.Begin(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memulai transaksi database"})
		return
	}
	defer tx.Rollback(ctx)

	var checklistID uint
	sqlChecklist := `
        INSERT INTO checklists (nama_checklist, area_id, department_id, jenis_audit_id) 
        VALUES ($1, $2, $3, $4) 
        RETURNING checklist_id
    `
	err = tx.QueryRow(ctx, sqlChecklist, namaChecklist, uint(areaID), uint(departmentID), uint(jenisAuditID)).Scan(&checklistID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Gagal menyimpan master checklist: %v", err)})
		return
	}

	// --- Bagian 2: Proses File Excel ---
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "File Excel tidak ditemukan"})
		return
	}
	src, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuka file"})
		return
	}
	defer src.Close()
	f, err := excelize.OpenReader(src)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membaca file Excel. Pastikan formatnya benar (.xlsx)"})
		return
	}
	sheetName := f.GetSheetName(0)

	rows, err := f.Rows(sheetName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membaca iterator baris Excel"})
		return
	}
	defer rows.Close()

	var currentKategori *string
	var currentSubKategori *string
	var itemsToInsert [][]interface{}

	reKategori, _ := regexp.Compile(`^([A-Z])\.\s(.+)`)
	reSubKategori, _ := regexp.Compile(`^([A-Z])\.(\d+)\.\s(.+)`)

	rowIndex := 0
	for rows.Next() {
		rowIndex++
		// Hanya lewati 1 baris header
		if rowIndex < 2 {
			continue
		}

		row, err := rows.Columns()
		if err != nil {
			fmt.Println("Error membaca kolom:", err)
			continue
		}

		cellA := getCell(row, 0) // Kolom A (No / Judul)
		cellB := getCell(row, 1) // Kolom B (Check Item)
		cellC := getCell(row, 2) // Kolom C (Ref Doc)

		_, errAIsNumber := strconv.Atoi(cellA)

		// ATURAN 1: Ini adalah ITEM
		if errAIsNumber == nil && cellB != "" {
			if currentKategori == nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Format Excel Salah: Ditemukan item (No. %s) di baris %d sebelum Judul Kategori (Contoh: 'A. JUDUL') didefinisikan.", cellA, rowIndex)})
				return
			}
			text := cellB
			doc := cellC
			itemsToInsert = append(itemsToInsert, []interface{}{
				checklistID,
				text,
				doc,
				currentKategori,
				currentSubKategori,
			})
			continue
		}

		// ATURAN 2: Ini adalah JUDUL
		if errAIsNumber != nil && cellA != "" && cellB == "" {
			if reSubKategori.MatchString(cellA) {
				cleanText := strings.TrimSpace(cellA)
				currentSubKategori = &cleanText
			} else if reKategori.MatchString(cellA) {
				cleanText := strings.TrimSpace(cellA)
				currentKategori = &cleanText
				currentSubKategori = nil
			}
			continue
		}
	}

	if len(itemsToInsert) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tidak ada item checklist yang ditemukan di file Excel. Pastikan format sudah benar."})
		return
	}

	if len(itemsToInsert) > 0 {
		_, err = tx.CopyFrom(
			ctx,
			pgx.Identifier{"checklist_items"},
			[]string{"checklist_id", "item_checklist_text", "referensi_doc", "kategori", "sub_kategori"},
			pgx.CopyFromRows(itemsToInsert),
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Gagal menyimpan item checklist: %v", err)})
			return
		}
	}

	if err = tx.Commit(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal melakukan commit transaksi"})
		return
	}

	// === [AUDIT LOG] CREATE CHECKLIST MASTER ===
	logData := gin.H{
		"nama_checklist": namaChecklist,
		"area_id":        areaID,
		"department_id":  departmentID,
		"jenis_audit_id": jenisAuditID,
		"total_items":    len(itemsToInsert),
	}
	helpers.CreateAuditLog(c, "CREATE", "Checklist Master", strconv.FormatUint(uint64(checklistID), 10), nil, logData)

	c.JSON(http.StatusOK, gin.H{
		"message":      "Checklist berhasil dibuat",
		"checklist_id": checklistID,
		"items_count":  len(itemsToInsert),
	})
}

// 2. GetChecklists: Mengambil semua master checklist
func GetChecklists(c *gin.Context) {
	ctx := context.Background()
	jenisAuditID := c.Query("jenis_audit_id")
	departmentID := c.Query("department_id")
	areaID := c.Query("area_id")
	searchQuery := c.Query("search")

	sqlQuery := `
        SELECT 
            c.checklist_id, 
            c.nama_checklist, 
            COALESCE(a.nama_area, '-') AS area_audit, 
            COALESCE(d.nama_department, '-') AS department, 
            COALESCE(ja.nama_jenis_audit, '-') AS jenis_audit 
        FROM checklists c
        LEFT JOIN area a ON c.area_id = a.area_id
        LEFT JOIN department d ON c.department_id = d.department_id
        LEFT JOIN jenis_audit ja ON c.jenis_audit_id = ja.id_jenis_audit
        WHERE 1=1
    `
	var args []interface{}
	argCount := 1
	if jenisAuditID != "" {
		sqlQuery += fmt.Sprintf(" AND c.jenis_audit_id = $%d", argCount)
		args = append(args, jenisAuditID)
		argCount++
	}
	if departmentID != "" {
		sqlQuery += fmt.Sprintf(" AND c.department_id = $%d", argCount)
		args = append(args, departmentID)
		argCount++
	}
	if areaID != "" {
		sqlQuery += fmt.Sprintf(" AND c.area_id = $%d", argCount)
		args = append(args, areaID)
		argCount++
	}
	if searchQuery != "" {
		sqlQuery += fmt.Sprintf(" AND c.nama_checklist ILIKE $%d", argCount)
		args = append(args, "%"+searchQuery+"%")
		argCount++
	}
	sqlQuery += " ORDER BY c.checklist_id DESC"

	rows, err := config.DB.Query(ctx, sqlQuery, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data checklist: " + err.Error()})
		return
	}
	defer rows.Close()
	var checklists []ChecklistResponse
	for rows.Next() {
		var chk ChecklistResponse
		if err := rows.Scan(&chk.ChecklistID, &chk.NamaChecklist, &chk.AreaAudit, &chk.Department, &chk.JenisAudit); err != nil {
			continue
		}
		checklists = append(checklists, chk)
	}
	c.JSON(http.StatusOK, gin.H{"data": checklists})
}

// 3. GetChecklistItems: Mengambil detail item berdasarkan ID checklist
func GetChecklistItems(c *gin.Context) {
	checklistID := c.Param("id")
	ctx := context.Background()
	sqlQuery := `
        SELECT item_id, item_checklist_text, referensi_doc, kategori, sub_kategori
        FROM checklist_items
        WHERE checklist_id = $1
        ORDER BY item_id ASC
    `
	rows, err := config.DB.Query(ctx, sqlQuery, checklistID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil detail item: " + err.Error()})
		return
	}
	defer rows.Close()
	var items []ChecklistItemResponse
	for rows.Next() {
		var item ChecklistItemResponse
		var refDoc, kategori, subKategori *string
		if err := rows.Scan(
			&item.ItemID,
			&item.ItemChecklistText,
			&refDoc,
			&kategori,
			&subKategori,
		); err != nil {
			continue
		}
		if refDoc != nil {
			item.ReferensiDoc = *refDoc
		}
		if kategori != nil {
			item.Kategori = *kategori
		}
		if subKategori != nil {
			item.SubKategori = *subKategori
		}

		items = append(items, item)
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

// --- Handler untuk Dropdown Bertingkat ---

func GetDepartmentsByJenis(c *gin.Context) {
	ctx := context.Background()
	jenisAuditID := c.Param("id")

	if jenisAuditID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID Jenis Audit tidak valid"})
		return
	}
	sqlQuery := `
        SELECT DISTINCT
            d.department_id,
            d.nama_department
        FROM department d
        JOIN area a ON d.department_id = a.department_id
        WHERE a.jenis_audit_id = $1
        ORDER BY d.nama_department
    `
	rows, err := config.DB.Query(ctx, sqlQuery, jenisAuditID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data department: " + err.Error()})
		return
	}
	defer rows.Close()
	var departments []gin.H
	for rows.Next() {
		var id int
		var name string
		if err := rows.Scan(&id, &name); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memindai data department"})
			return
		}
		departments = append(departments, gin.H{"department_id": id, "nama_department": name})
	}
	c.JSON(http.StatusOK, gin.H{"data": departments})
}

func GetAreasByFilter(c *gin.Context) {
	ctx := context.Background()
	jenisAuditID := c.Query("jenis_audit_id")
	departmentID := c.Query("department_id")

	if jenisAuditID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Jenis Audit ID wajib diisi"})
		return
	}

	var sqlQuery string
	var rows pgx.Rows
	var err error

	if departmentID == "null" || departmentID == "" {
		sqlQuery = `
            SELECT area_id, nama_area
            FROM area
            WHERE jenis_audit_id = $1 AND department_id IS NULL
            ORDER BY nama_area
        `
		rows, err = config.DB.Query(ctx, sqlQuery, jenisAuditID)
	} else {
		sqlQuery = `
            SELECT area_id, nama_area
            FROM area
            WHERE jenis_audit_id = $1 AND department_id = $2
            ORDER BY nama_area
        `
		rows, err = config.DB.Query(ctx, sqlQuery, jenisAuditID, departmentID)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data area: " + err.Error()})
		return
	}
	defer rows.Close()
	var areas []gin.H
	for rows.Next() {
		var id int
		var name string
		if err := rows.Scan(&id, &name); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memindai data area"})
			return
		}
		areas = append(areas, gin.H{"area_id": id, "nama_area": name})
	}
	c.JSON(http.StatusOK, gin.H{"data": areas})
}

// --- Handler untuk Edit/Delete Item Checklist ---

type UpdateItemInput struct {
	ItemChecklistText string `json:"item_checklist_text" binding:"required"`
	ReferensiDoc      string `json:"referensi_doc"`
}

func UpdateChecklistItem(c *gin.Context) {
	ctx := context.Background()
	itemID := c.Param("id")

	var input UpdateItemInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Data input tidak valid: " + err.Error()})
		return
	}

	// 1. [AUDIT LOG] AMBIL DATA LAMA
	var oldData UpdateItemInput
	sqlGetOld := `SELECT item_checklist_text, COALESCE(referensi_doc, '') FROM checklist_items WHERE item_id = $1`
	err := config.DB.QueryRow(ctx, sqlGetOld, itemID).Scan(&oldData.ItemChecklistText, &oldData.ReferensiDoc)
	if err != nil {
		// Abaikan error jika data tidak ditemukan
	}

	// 2. UPDATE DATABASE
	sqlUpdate := `
        UPDATE checklist_items
        SET item_checklist_text = $1, referensi_doc = $2
        WHERE item_id = $3
    `
	cmdTag, err := config.DB.Exec(ctx, sqlUpdate, input.ItemChecklistText, input.ReferensiDoc, itemID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui item: " + err.Error()})
		return
	}
	if cmdTag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Item checklist tidak ditemukan"})
		return
	}

	// 3. [AUDIT LOG] UPDATE
	helpers.CreateAuditLog(c, "UPDATE", "ChecklistItem", itemID, oldData, input)

	c.JSON(http.StatusOK, gin.H{"message": "Item checklist berhasil diperbarui"})
}

func DeleteChecklistItem(c *gin.Context) {
	ctx := context.Background()
	itemID := c.Param("id")

	if itemID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID Item tidak valid"})
		return
	}

	// 1. [AUDIT LOG] AMBIL DATA SEBELUM DELETE
	var deletedData struct {
		Text string
		Ref  *string
	}
	sqlGet := `SELECT item_checklist_text, referensi_doc FROM checklist_items WHERE item_id = $1`
	_ = config.DB.QueryRow(ctx, sqlGet, itemID).Scan(&deletedData.Text, &deletedData.Ref)

	// 2. DELETE DATABASE
	sqlDelete := `DELETE FROM checklist_items WHERE item_id = $1`
	cmdTag, err := config.DB.Exec(ctx, sqlDelete, itemID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus item: " + err.Error()})
		return
	}
	if cmdTag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Item checklist tidak ditemukan"})
		return
	}

	// 3. [AUDIT LOG] DELETE
	helpers.CreateAuditLog(c, "DELETE", "ChecklistItem", itemID, deletedData, nil)

	c.JSON(http.StatusOK, gin.H{"message": "Item checklist berhasil dihapus"})
}

// GetChecklist mengambil data master checklist untuk form edit
func GetChecklist(c *gin.Context) {
	ctx := context.Background()
	checklistID := c.Param("id")

	var data struct {
		NamaChecklist string `json:"nama_checklist"`
		AreaID        int    `json:"area_id"`
		DepartmentID  *int   `json:"department_id"`
		JenisAuditID  int    `json:"jenis_audit_id"`
	}

	sqlQuery := `
        SELECT nama_checklist, area_id, department_id, jenis_audit_id
        FROM checklists
        WHERE checklist_id = $1
    `
	err := config.DB.QueryRow(ctx, sqlQuery, checklistID).Scan(
		&data.NamaChecklist,
		&data.AreaID,
		&data.DepartmentID,
		&data.JenisAuditID,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Checklist tidak ditemukan"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data checklist: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": data})
}

// UpdateChecklistInput struct untuk validasi update master
type UpdateChecklistInput struct {
	NamaChecklist string `json:"nama_checklist" binding:"required"`
	AreaID        int    `json:"area_id" binding:"required"`
	DepartmentID  *int   `json:"department_id"` // Bisa null
	JenisAuditID  int    `json:"jenis_audit_id" binding:"required"`
}

// UpdateChecklist memperbarui data master checklist
func UpdateChecklist(c *gin.Context) {
	ctx := context.Background()
	checklistID := c.Param("id")

	var input UpdateChecklistInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Data input tidak valid: " + err.Error()})
		return
	}

	// 1. [AUDIT LOG] AMBIL DATA LAMA
	var oldData UpdateChecklistInput
	sqlGetOld := `SELECT nama_checklist, area_id, department_id, jenis_audit_id FROM checklists WHERE checklist_id = $1`
	err := config.DB.QueryRow(ctx, sqlGetOld, checklistID).Scan(&oldData.NamaChecklist, &oldData.AreaID, &oldData.DepartmentID, &oldData.JenisAuditID)

	// 2. UPDATE DATABASE
	sqlUpdate := `
        UPDATE checklists
        SET nama_checklist = $1, area_id = $2, department_id = $3, jenis_audit_id = $4
        WHERE checklist_id = $5
    `
	cmdTag, err := config.DB.Exec(ctx, sqlUpdate,
		input.NamaChecklist,
		input.AreaID,
		input.DepartmentID,
		input.JenisAuditID,
		checklistID,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui checklist: " + err.Error()})
		return
	}

	if cmdTag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Checklist tidak ditemukan"})
		return
	}

	// 3. [AUDIT LOG] UPDATE
	helpers.CreateAuditLog(c, "UPDATE", "Checklist Master", checklistID, oldData, input)

	c.JSON(http.StatusOK, gin.H{"message": "Checklist berhasil diperbarui"})
}

// DeleteChecklist menghapus master checklist dan semua item di dalamnya
func DeleteChecklist(c *gin.Context) {
	ctx := context.Background()
	checklistID := c.Param("id")

	if checklistID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID Checklist tidak valid"})
		return
	}

	// 1. [AUDIT LOG] AMBIL NAMA SEBELUM DELETE
	var deletedName string
	config.DB.QueryRow(ctx, "SELECT nama_checklist FROM checklists WHERE checklist_id = $1", checklistID).Scan(&deletedName)

	tx, err := config.DB.Begin(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memulai transaksi"})
		return
	}
	defer tx.Rollback(ctx)

	// Hapus Item
	sqlDeleteItems := `DELETE FROM checklist_items WHERE checklist_id = $1`
	_, err = tx.Exec(ctx, sqlDeleteItems, checklistID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus item terkait: " + err.Error()})
		return
	}

	// Hapus Master
	sqlDeleteMaster := `DELETE FROM checklists WHERE checklist_id = $1`
	cmdTag, err := tx.Exec(ctx, sqlDeleteMaster, checklistID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus master checklist: " + err.Error()})
		return
	}

	if cmdTag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Checklist tidak ditemukan"})
		return
	}

	if err = tx.Commit(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal commit transaksi"})
		return
	}

	// 3. [AUDIT LOG] DELETE
	helpers.CreateAuditLog(c, "DELETE", "Checklist Master", checklistID, gin.H{"nama": deletedName}, nil)

	c.JSON(http.StatusOK, gin.H{"message": "Checklist berhasil dihapus (termasuk semua item)"})
}
