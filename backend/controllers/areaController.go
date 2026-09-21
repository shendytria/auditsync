package controllers

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/vaneshadhani/e-audit-backend/config"
	"github.com/vaneshadhani/e-audit-backend/helpers" // IMPORT HELPER AUDIT
)

// AreaCreate
type AreaCreate struct {
	NamaArea          string  `json:"nama_area" binding:"required"`
	KodeArea          string  `json:"kode_area" binding:"required"`
	JenisAuditID      int     `json:"jenis_audit_id" binding:"required"`
	DepartmentID      *int    `json:"department_id"`
	NewDepartmentName *string `json:"new_department_name"`
}

// AreaResponse
type AreaResponse struct {
	AreaID       uint    `json:"area_id"`
	NamaArea     string  `json:"nama_area"`
	KodeArea     *string `json:"kode_area"`
	JenisAudit   string  `json:"jenis_audit"`
	Department   string  `json:"department"`
	DepartmentID *int    `json:"department_id"`
	JenisAuditID *int    `json:"jenis_audit_id"`
}

// AreaUpdate
type AreaUpdate struct {
	NamaArea     string `json:"nama_area" binding:"required"`
	KodeArea     string `json:"kode_area" binding:"required"`
	JenisAuditID int    `json:"jenis_audit_id" binding:"required"`
	DepartmentID *int   `json:"department_id"`
}

// GetAreas
func GetAreas(c *gin.Context) {
	ctx := context.Background()

	jenisAuditID := c.Query("jenis_audit_id")
	departmentID := c.Query("department_id")
	searchQuery := c.Query("search")

	sqlQuery := `
        SELECT 
            a.area_id,
            a.nama_area,
            a.kode_area, 
            COALESCE(j.nama_jenis_audit, '-') AS jenis_audit,
            COALESCE(d.nama_department, '-') AS department,
            a.department_id,
            a.jenis_audit_id
        FROM 
            area a
        LEFT JOIN 
            jenis_audit j ON a.jenis_audit_id = j.id_jenis_audit
        LEFT JOIN 
            department d ON a.department_id = d.department_id
        WHERE 1=1
    `
	var args []interface{}
	argCount := 1

	if jenisAuditID != "" {
		sqlQuery += fmt.Sprintf(" AND a.jenis_audit_id = $%d", argCount)
		args = append(args, jenisAuditID)
		argCount++
	}

	if departmentID != "" {
		sqlQuery += fmt.Sprintf(" AND a.department_id = $%d", argCount)
		args = append(args, departmentID)
		argCount++
	}

	if searchQuery != "" {
		sqlQuery += fmt.Sprintf(" AND (a.nama_area ILIKE $%d OR a.kode_area ILIKE $%d)", argCount, argCount+1)
		args = append(args, "%"+searchQuery+"%", "%"+searchQuery+"%")
		argCount += 2
	}

	sqlQuery += " ORDER BY a.nama_area"

	rows, err := config.DB.Query(ctx, sqlQuery, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data area: " + err.Error()})
		return
	}
	defer rows.Close()

	var areas []AreaResponse
	for rows.Next() {
		var area AreaResponse
		if err := rows.Scan(
			&area.AreaID,
			&area.NamaArea,
			&area.KodeArea,
			&area.JenisAudit,
			&area.Department,
			&area.DepartmentID,
			&area.JenisAuditID,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memindai data area: " + err.Error()})
			return
		}
		areas = append(areas, area)
	}

	c.JSON(http.StatusOK, gin.H{"data": areas})
}

// CreateArea
func CreateArea(c *gin.Context) {
	var input AreaCreate
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Data input tidak valid: " + err.Error()})
		return
	}

	if input.DepartmentID == nil && (input.NewDepartmentName == nil || *input.NewDepartmentName == "") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Department wajib diisi (pilih atau 'Lainnya')."})
		return
	}

	ctx := context.Background()
	tx, err := config.DB.Begin(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memulai transaksi"})
		return
	}
	defer tx.Rollback(ctx)

	var finalDepartmentID *int

	if input.NewDepartmentName != nil && *input.NewDepartmentName != "" {
		var newDeptID int
		sqlInsertDept := `
            INSERT INTO department (nama_department) 
            VALUES ($1) 
            ON CONFLICT (nama_department) DO UPDATE SET nama_department = EXCLUDED.nama_department 
            RETURNING department_id
        `
		err := tx.QueryRow(ctx, sqlInsertDept, input.NewDepartmentName).Scan(&newDeptID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan department baru: " + err.Error()})
			return
		}
		finalDepartmentID = &newDeptID
	} else {
		finalDepartmentID = input.DepartmentID
	}

	sqlInsertArea := `
        INSERT INTO area (nama_area, kode_area, jenis_audit_id, department_id) 
        VALUES ($1, $2, $3, $4)
        RETURNING area_id
    `
	var areaID uint
	err = tx.QueryRow(ctx, sqlInsertArea, input.NamaArea, strings.ToUpper(input.KodeArea), input.JenisAuditID, finalDepartmentID).Scan(&areaID)
	if err != nil {
		if pgErr, ok := err.(*pgconn.PgError); ok && pgErr.Code == "23505" {
			c.JSON(http.StatusConflict, gin.H{"error": "Area dengan data tersebut sudah ada."})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan area baru: " + err.Error()})
		}
		return
	}

	if err = tx.Commit(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal commit transaksi"})
		return
	}

	// === [AUDIT LOG] CREATE ===
	// Kita catat log setelah commit berhasil
	helpers.CreateAuditLog(c, "CREATE", "Area", strconv.Itoa(int(areaID)), nil, input)

	c.JSON(http.StatusOK, gin.H{"message": "Area berhasil ditambahkan", "area_id": areaID})
}

// GetArea
func GetArea(c *gin.Context) {
	ctx := context.Background()
	areaID := c.Param("id")

	var data AreaResponse
	sqlQuery := `
        SELECT 
            a.area_id,
            a.nama_area,
            a.kode_area,
            COALESCE(j.nama_jenis_audit, '-') AS jenis_audit,
            COALESCE(d.nama_department, '-') AS department,
            a.department_id,
            a.jenis_audit_id
        FROM area a
        LEFT JOIN jenis_audit j ON a.jenis_audit_id = j.id_jenis_audit
        LEFT JOIN department d ON a.department_id = d.department_id
        WHERE a.area_id = $1
    `
	err := config.DB.QueryRow(ctx, sqlQuery, areaID).Scan(
		&data.AreaID,
		&data.NamaArea,
		&data.KodeArea,
		&data.JenisAudit,
		&data.Department,
		&data.DepartmentID,
		&data.JenisAuditID,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Area tidak ditemukan"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data area: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": data})
}

// UpdateArea
func UpdateArea(c *gin.Context) {
	ctx := context.Background()
	areaID := c.Param("id")

	var input AreaUpdate
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Data input tidak valid: " + err.Error()})
		return
	}

	if input.DepartmentID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Department wajib diisi."})
		return
	}

	// 1. [AUDIT LOG] AMBIL DATA LAMA (SNAPSHOT SEBELUM EDIT)
	// Kita ambil field yang relevan untuk dibandingkan
	var oldData AreaUpdate
	sqlGetOld := `SELECT nama_area, COALESCE(kode_area, ''), jenis_audit_id, department_id FROM area WHERE area_id = $1`
	err := config.DB.QueryRow(ctx, sqlGetOld, areaID).Scan(
		&oldData.NamaArea,
		&oldData.KodeArea,
		&oldData.JenisAuditID,
		&oldData.DepartmentID,
	)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Area tidak ditemukan"})
		return
	}

	// 2. LAKUKAN UPDATE
	sqlUpdate := `
        UPDATE area 
        SET nama_area = $1, kode_area = $2, jenis_audit_id = $3, department_id = $4
        WHERE area_id = $5
    `
	cmdTag, err := config.DB.Exec(ctx, sqlUpdate, input.NamaArea, strings.ToUpper(input.KodeArea), input.JenisAuditID, input.DepartmentID, areaID)
	if err != nil {
		if pgErr, ok := err.(*pgconn.PgError); ok && pgErr.Code == "23505" {
			c.JSON(http.StatusConflict, gin.H{"error": "Area dengan data tersebut sudah ada."})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal update area: " + err.Error()})
		}
		return
	}

	if cmdTag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Area tidak ditemukan"})
		return
	}

	// 3. [AUDIT LOG] UPDATE
	// Mencatat perubahan: ID, Data Lama, dan Data Baru
	helpers.CreateAuditLog(c, "UPDATE", "Area", areaID, oldData, input)

	c.JSON(http.StatusOK, gin.H{"message": "Area berhasil diperbarui"})
}

// DeleteArea
func DeleteArea(c *gin.Context) {
	ctx := context.Background()
	areaID := c.Param("id")

	if areaID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID Area tidak valid"})
		return
	}

	// 1. [AUDIT LOG] AMBIL DATA SEBELUM DIHAPUS
	// Agar di log terlihat "Menghapus Area Gudang A", bukan cuma ID-nya saja
	var deletedData struct {
		AreaID       string
		NamaArea     string
		KodeArea     *string
		DepartmentID *int
	}
	sqlGetDeleted := `SELECT area_id, nama_area, kode_area, department_id FROM area WHERE area_id = $1`
	err := config.DB.QueryRow(ctx, sqlGetDeleted, areaID).Scan(&deletedData.AreaID, &deletedData.NamaArea, &deletedData.KodeArea, &deletedData.DepartmentID)

	if err != nil {
		if err == pgx.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Area tidak ditemukan"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil info area: " + err.Error()})
		return
	}

	// Mulai Transaksi
	tx, err := config.DB.Begin(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memulai transaksi"})
		return
	}
	defer tx.Rollback(ctx)

	// 2. Hapus Area
	sqlDeleteArea := `DELETE FROM area WHERE area_id = $1`
	cmdTag, err := tx.Exec(ctx, sqlDeleteArea, areaID)
	if err != nil {
		if strings.Contains(err.Error(), "violates foreign key constraint") {
			c.JSON(http.StatusConflict, gin.H{"error": "Gagal menghapus: Area ini masih digunakan di data audit atau checklist."})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus area: " + err.Error()})
		return
	}
	if cmdTag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Area tidak ditemukan (saat proses delete)"})
		return
	}

	// 3. Cek Department Yatim (jika tidak NULL)
	if deletedData.DepartmentID != nil {
		var areaCount int
		var checklistCount int

		sqlCheckArea := `SELECT COUNT(*) FROM area WHERE department_id = $1`
		errArea := tx.QueryRow(ctx, sqlCheckArea, *deletedData.DepartmentID).Scan(&areaCount)
		if errArea != nil {
			fmt.Println("Gagal mengecek sisa area: " + errArea.Error())
			areaCount = 1
		}

		sqlCheckChecklist := `SELECT COUNT(*) FROM checklists WHERE department_id = $1`
		errChecklist := tx.QueryRow(ctx, sqlCheckChecklist, *deletedData.DepartmentID).Scan(&checklistCount)
		if errChecklist != nil {
			fmt.Println("Gagal mengecek sisa checklist: " + errChecklist.Error())
			checklistCount = 1
		}

		// 4. Hapus department HANYA JIKA kedua count = 0
		if areaCount == 0 && checklistCount == 0 {
			sqlDeleteDept := `DELETE FROM department WHERE department_id = $1`
			_, errDeleteDept := tx.Exec(ctx, sqlDeleteDept, *deletedData.DepartmentID)
			if errDeleteDept != nil {
				fmt.Println("Gagal menghapus department yatim: " + errDeleteDept.Error())
			} else {
				fmt.Println("Berhasil menghapus department yatim dengan ID:", *deletedData.DepartmentID)
			}
		}
	}

	if err = tx.Commit(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal commit transaksi"})
		return
	}

	// === [AUDIT LOG] DELETE ===
	// NewData diisi nil karena data sudah hilang
	helpers.CreateAuditLog(c, "DELETE", "Area", areaID, deletedData, nil)

	c.JSON(http.StatusOK, gin.H{"message": "Area berhasil dihapus permanen"})
}

// GetSites (Tetap)
func GetSites(c *gin.Context) {
	ctx := context.Background()
	rows, err := config.DB.Query(ctx, "SELECT site_id, nama_site FROM site ORDER BY nama_site")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data site"})
		return
	}
	defer rows.Close()

	var sites []gin.H
	for rows.Next() {
		var id int
		var name string
		if err := rows.Scan(&id, &name); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memindai data site"})
			return
		}
		sites = append(sites, gin.H{"site_id": id, "nama_site": name})
	}
	c.JSON(http.StatusOK, gin.H{"data": sites})
}

func GetDepartments(c *gin.Context) {
	ctx := context.Background()
	rows, err := config.DB.Query(ctx, "SELECT department_id, nama_department FROM department ORDER BY nama_department")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data department"})
		return
	}
	defer rows.Close()

	var departments []gin.H
	for rows.Next() {
		var id int
		var name string
		if err := rows.Scan(&id, &name); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "GGagal memindai data department"})
			return
		}
		departments = append(departments, gin.H{"department_id": id, "nama_department": name})
	}
	c.JSON(http.StatusOK, gin.H{"data": departments})
}

// GetJenisAudit (Tetap)
func GetJenisAudit(c *gin.Context) {
	ctx := context.Background()
	rows, err := config.DB.Query(ctx, "SELECT id_jenis_audit, nama_jenis_audit FROM jenis_audit ORDER BY nama_jenis_audit")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data jenis audit"})
		return
	}
	defer rows.Close()

	var allJenisAudit []gin.H
	for rows.Next() {
		var id int
		var name string
		if err := rows.Scan(&id, &name); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memindai data jenis audit"})
			return
		}
		allJenisAudit = append(allJenisAudit, gin.H{"jenis_audit_id": id, "nama_jenis_audit": name})
	}
	c.JSON(http.StatusOK, gin.H{"data": allJenisAudit})
}

type AreaWithRelations struct {
	AreaID       uint   `json:"area_id"`
	NamaArea     string `json:"nama_area"`
	DepartmentID *int   `json:"department_id"`
	JenisAuditID *int   `json:"jenis_audit_id"`
}

func GetAreasWithRelations(c *gin.Context) {
	ctx := context.Background()
	sqlQuery := `
        SELECT 
            area_id, 
            nama_area, 
            department_id, 
            jenis_audit_id
        FROM area
    `

	rows, err := config.DB.Query(ctx, sqlQuery)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data relasi area: " + err.Error()})
		return
	}
	defer rows.Close()

	var areas []AreaWithRelations
	for rows.Next() {
		var area AreaWithRelations
		if err := rows.Scan(
			&area.AreaID,
			&area.NamaArea,
			&area.DepartmentID,
			&area.JenisAuditID,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memindai data relasi area: " + err.Error()})
			return
		}
		areas = append(areas, area)
	}

	c.JSON(http.StatusOK, gin.H{"data": areas})
}
