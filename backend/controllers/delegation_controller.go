package controllers

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/vaneshadhani/e-audit-backend/config"
)

// Sub-struct untuk detail PIC per temuan
type PicCapaItem struct {
	TemuanID        string `json:"temuan_id"`
	PicUserID       int    `json:"pic_user_id"`
	PicName         string `json:"pic_name"`
	DeskripsiTemuan string `json:"deskripsi_temuan"`
}

// Struct untuk Response List (DITAMBAHKAN PicCapaList)
type DelegationListItem struct {
	PelaksanaanID string `json:"pelaksanaan_id"`
	NoFTA         string `json:"no_fta"`
	TanggalAudit  string `json:"tanggal_audit"`
	NamaArea      string `json:"nama_area"`
	StatusLaporan string `json:"status_laporan"`

	NamaSite   string `json:"nama_site"`
	JenisAudit string `json:"jenis_audit"`

	QsSpvID   *int `json:"qs_spv_id"`
	MgrAreaID *int `json:"mgr_area_id"`
	MgrQsID   *int `json:"mgr_qs_id"`

	QsSpvName   string `json:"qs_spv_name"`
	MgrAreaName string `json:"mgr_area_name"`
	MgrQsName   string `json:"mgr_qs_name"`

	// Field baru untuk menampung banyak PIC CAPA
	PicCapaList []PicCapaItem `json:"pic_capa_list"`
}

// Struct untuk Request Update (DITAMBAHKAN PicCapaUpdates)
type PicUpdateItem struct {
	TemuanID string `json:"temuan_id"`
	UserID   int    `json:"user_id"`
}

type DelegationUpdateReq struct {
	QsSpvID        *int            `json:"qs_spv_id"`
	MgrAreaID      *int            `json:"mgr_area_id"`
	MgrQsID        *int            `json:"mgr_qs_id"`
	PicCapaUpdates []PicUpdateItem `json:"pic_capa_updates"` // Data delegasi PIC CAPA
}

// 1. GET LIST AUDIT
func GetDelegationList(c *gin.Context) {
	ctx := context.Background()

	query := `
        SELECT 
            p.pelaksanaan_id::text, 
            COALESCE(
                (SELECT no_fta FROM laporan_temuan lt WHERE lt.pelaksanaan_id = p.pelaksanaan_id LIMIT 1), 
                '-'
            ) as no_fta,
            to_char(p.tanggal_audit, 'YYYY-MM-DD') as tanggal_audit,
            COALESCE(a.nama_area, '-') as nama_area,
            p.status_laporan,
            COALESCE(s.nama_site, '-') as nama_site,
            COALESCE(ja.nama_jenis_audit, '-') as jenis_audit,
            p.approver_qs_spv_id,
            p.approver_mgr_area_id,
            p.approver_mgr_qs_id,
            COALESCE(u1.nama_lengkap, '-') as qs_spv_name,
            COALESCE(u2.nama_lengkap, '-') as mgr_area_name,
            COALESCE(u3.nama_lengkap, '-') as mgr_qs_name
        FROM pelaksanaan_audit p
        LEFT JOIN area a ON p.area_id = a.area_id
        LEFT JOIN jenis_audit ja ON p.jenis_audit_id = ja.id_jenis_audit
        LEFT JOIN site s ON p.site_id = s.site_id
        LEFT JOIN users u1 ON p.approver_qs_spv_id = u1.user_id
        LEFT JOIN users u2 ON p.approver_mgr_area_id = u2.user_id
        LEFT JOIN users u3 ON p.approver_mgr_qs_id = u3.user_id
        WHERE p.status_laporan != 'CLOSED'
        ORDER BY p.tanggal_audit DESC
    `

	rows, err := config.DB.Query(ctx, query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal ambil data: " + err.Error()})
		return
	}
	defer rows.Close()

	var list []DelegationListItem
	for rows.Next() {
		var item DelegationListItem
		err := rows.Scan(
			&item.PelaksanaanID,
			&item.NoFTA,
			&item.TanggalAudit,
			&item.NamaArea,
			&item.StatusLaporan,
			&item.NamaSite,
			&item.JenisAudit,
			&item.QsSpvID, &item.MgrAreaID, &item.MgrQsID,
			&item.QsSpvName, &item.MgrAreaName, &item.MgrQsName,
		)
		if err != nil {
			continue
		}

		// --- [NEW LOGIC] AMBIL DAFTAR PIC CAPA PER TEMUAN ---
		picQuery := `
            SELECT 
                lt.temuan_id::text, 
                COALESCE(lt.pic_user_id, 0), 
                COALESCE(u.nama_lengkap, 'Belum diassign'),
                COALESCE(lt.deskripsi_temuan, '-')
            FROM laporan_temuan lt
            LEFT JOIN users u ON lt.pic_user_id = u.user_id
            WHERE lt.pelaksanaan_id = $1
        `
		picRows, _ := config.DB.Query(ctx, picQuery, item.PelaksanaanID)
		var pics []PicCapaItem
		for picRows.Next() {
			var p PicCapaItem
			picRows.Scan(&p.TemuanID, &p.PicUserID, &p.PicName, &p.DeskripsiTemuan)
			pics = append(pics, p)
		}
		picRows.Close()
		item.PicCapaList = pics
		// ---------------------------------------------------

		list = append(list, item)
	}

	c.JSON(http.StatusOK, gin.H{"data": list})
}

// 2. UPDATE APPROVER & PIC CAPA
func UpdateDelegation(c *gin.Context) {
	ctx := context.Background()
	id := c.Param("id")

	var req DelegationUpdateReq
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid data"})
		return
	}

	// Gunakan Transaction agar jika salah satu gagal, semua dibatalkan
	tx, err := config.DB.Begin(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memulai transaksi"})
		return
	}
	defer tx.Rollback(ctx)

	// 1. Update Approver Utama (Pelaksanaan Audit)
	_, err = tx.Exec(ctx, `
        UPDATE pelaksanaan_audit 
        SET approver_qs_spv_id = $1, 
            approver_mgr_area_id = $2, 
            approver_mgr_qs_id = $3 
        WHERE pelaksanaan_id = $4
    `, req.QsSpvID, req.MgrAreaID, req.MgrQsID, id)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal update approver"})
		return
	}

	// 2. Update PIC CAPA (Laporan Temuan) - Jika ada data yang dikirim
	for _, update := range req.PicCapaUpdates {
		if update.UserID != 0 {
			_, err = tx.Exec(ctx, `
                UPDATE laporan_temuan 
                SET pic_user_id = $1 
                WHERE temuan_id = $2 AND pelaksanaan_id = $3
            `, update.UserID, update.TemuanID, id)

			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal update PIC CAPA untuk temuan: " + update.TemuanID})
				return
			}
		}
	}

	err = tx.Commit(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan perubahan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Semua delegasi berhasil diperbarui!"})
}
