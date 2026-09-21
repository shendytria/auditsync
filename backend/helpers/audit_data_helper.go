package helpers

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/vaneshadhani/e-audit-backend/config"
	"github.com/vaneshadhani/e-audit-backend/models"
)

// FetchAuditDetailFull menangani logic query database yang rumit
func FetchAuditDetailFull(pelaksanaanIDStr string) (models.TemuanByPelaksanaanResponse, error) {
	ctx := context.Background()
	pelaksanaanID, err := strconv.Atoi(pelaksanaanIDStr)
	if err != nil {
		return models.TemuanByPelaksanaanResponse{}, fmt.Errorf("ID tidak valid")
	}

	var response models.TemuanByPelaksanaanResponse
	var rawStatus string
	var siteID uint
	var noFTASql, noteRejectSql, namaQsSpv, namaMgrArea, namaMgrQs, approverPicNames sql.NullString
	var idQsSpv, idMgrArea, idMgrQs sql.NullInt64
	var tglQsSpv, tglMgrArea, tglMgrQs, tglSubmitCapa sql.NullTime
	var picCapaJSON string

	// 1. QUERY HEADER
	sqlHeader := `
		SELECT 
			p.pelaksanaan_id, p.tanggal_audit, p.status_laporan, 
			COALESCE(STRING_AGG(DISTINCT u.nama_lengkap, ', '), '-') AS nama_auditor,
			COALESCE(a.nama_area, '-'), 
			COALESCE(d.nama_department, '-'), 
			COALESCE(j.nama_jenis_audit, '-'), 
			COALESCE(s.nama_site, '-'), 
			p.site_id, 
			(SELECT no_fta FROM laporan_temuan WHERE pelaksanaan_id = p.pelaksanaan_id AND no_fta IS NOT NULL LIMIT 1), 
			p.note_reject, 
			COALESCE(u_qs.nama_lengkap, u_qs.email), 
			COALESCE(u_ma.nama_lengkap, u_ma.email), 
			COALESCE(u_mq.nama_lengkap, u_mq.email), 
			COALESCE(( SELECT STRING_AGG(COALESCE(u_pic.nama_lengkap, u_pic.email), ', ') FROM users u_pic WHERE u_pic.user_id = ANY(p.approver_pic_capa_ids) ), '-') AS approver_pic_capa_names,
			p.tgl_approve_qs_spv, p.tgl_approve_mgr_area, p.tgl_approve_mgr_qs, p.tgl_submit_capa,
			p.approver_qs_spv_id, p.approver_mgr_area_id, p.approver_mgr_qs_id,
			COALESCE(array_to_json(p.approver_pic_capa_ids)::text, '[]')
		FROM pelaksanaan_audit p
		LEFT JOIN users u ON u.user_id = ANY(p.auditor_ids)
		LEFT JOIN area a ON p.area_id = a.area_id
		LEFT JOIN department d ON p.department_id = d.department_id
		LEFT JOIN jenis_audit j ON p.jenis_audit_id = j.id_jenis_audit
		LEFT JOIN site s ON p.site_id = s.site_id
		LEFT JOIN users u_qs ON p.approver_qs_spv_id = u_qs.user_id
		LEFT JOIN users u_ma ON p.approver_mgr_area_id = u_ma.user_id
		LEFT JOIN users u_mq ON p.approver_mgr_qs_id = u_mq.user_id
		WHERE p.pelaksanaan_id = $1
		GROUP BY 
			p.pelaksanaan_id, p.tanggal_audit, p.status_laporan, a.nama_area, d.nama_department, 
			j.nama_jenis_audit, s.nama_site, p.site_id, p.note_reject, 
			u_qs.nama_lengkap, u_qs.email, u_ma.nama_lengkap, u_ma.email, u_mq.nama_lengkap, u_mq.email, 
			p.approver_pic_capa_ids, p.approver_qs_spv_id, p.approver_mgr_area_id, p.approver_mgr_qs_id, p.tgl_submit_capa
	`

	err = config.DB.QueryRow(ctx, sqlHeader, pelaksanaanID).Scan(
		&response.Master.PelaksanaanID, &response.Master.TanggalAudit, &rawStatus,
		&response.Master.NamaAuditor, &response.Master.NamaArea, &response.Master.NamaDepartment,
		&response.Master.NamaJenisAudit, &response.Master.NamaSite, &siteID, &noFTASql, &noteRejectSql,
		&namaQsSpv, &namaMgrArea, &namaMgrQs, &approverPicNames,
		&tglQsSpv, &tglMgrArea, &tglMgrQs, &tglSubmitCapa,
		&idQsSpv, &idMgrArea, &idMgrQs, &picCapaJSON,
	)

	if err != nil {
		return models.TemuanByPelaksanaanResponse{}, err
	}

	response.Master.StatusLaporan = rawStatus
	response.Master.ChecklistID = siteID
	if noFTASql.Valid {
		response.Master.NoFTA = &noFTASql.String
	}
	if noteRejectSql.Valid {
		response.Master.NoteReject = &noteRejectSql.String
	}
	if namaQsSpv.Valid {
		response.Master.NamaQsSpv = namaQsSpv.String
	}
	if namaMgrArea.Valid {
		response.Master.NamaMgrArea = namaMgrArea.String
	}
	if namaMgrQs.Valid {
		response.Master.NamaMgrQs = namaMgrQs.String
	}
	if approverPicNames.Valid {
		response.Master.ApproverPicCapaNames = approverPicNames.String
	}
	if idQsSpv.Valid {
		response.Master.ApproverQsSpvID = int(idQsSpv.Int64)
	}
	if idMgrArea.Valid {
		response.Master.ApproverMgrAreaID = int(idMgrArea.Int64)
	}
	if idMgrQs.Valid {
		response.Master.ApproverMgrQsID = int(idMgrQs.Int64)
	}

	var picIDs []int
	if picCapaJSON != "" && picCapaJSON != "[]" {
		_ = json.Unmarshal([]byte(picCapaJSON), &picIDs)
	}
	response.Master.ApproverPicCapaIDs = picIDs

	if tglQsSpv.Valid {
		response.Master.TglApproveQsSpv = tglQsSpv.Time.Format(time.RFC3339)
	}
	if tglMgrArea.Valid {
		response.Master.TglApproveMgrArea = tglMgrArea.Time.Format(time.RFC3339)
	}
	if tglMgrQs.Valid {
		response.Master.TglApproveMgrQs = tglMgrQs.Time.Format(time.RFC3339)
	}
	if tglSubmitCapa.Valid {
		response.Master.TglSubmitCapa = tglSubmitCapa.Time.Format(time.RFC3339)
	}

	// 2. QUERY DETAIL ITEMS
	sqlDetail := `
		SELECT 
			lt.temuan_id, lt.item_id, lt.status, 
			COALESCE(lt.deskripsi_temuan, '-'), 
			COALESCE(ci.kategori, 'Lain-lain'), 
			COALESCE(ci.sub_kategori, 'Umum'), 
			COALESCE(lt.lokasi_temuan, '-'), 
			lt.hasil_verifikasi,
			lt.catatan_verifikasi, 
			COALESCE(ci.item_checklist_text, '-'), 
			ci.referensi_doc, 
			lt.bukti_temuan::text, 
			lt.pic_user_id, 
			COALESCE(u.nama_lengkap, u.email, '-') AS pic_name,
			lt.kategori_temuan, 
			lt.data_integrity, 
			lt.prinsip_5r, 
			lt.penyebab_terdekat, 
			lt.tindakan_remedial, 
			TO_CHAR(lt.due_date, 'YYYY-MM-DD') as due_date, 
			lt.pelaporan_bukti_perbaikan::text, 
			lt.catatan_perbaikan, 
			lt.bukti_verifikasi::text, 
			lt.catatan_verifikasi_bukti, 
			lt.justification,
			lt.status_evidence
		FROM laporan_temuan lt 
		LEFT JOIN checklist_items ci ON lt.item_id = ci.item_id 
		LEFT JOIN users u ON u.user_id = lt.pic_user_id
		WHERE lt.pelaksanaan_id = $1 
		ORDER BY lt.temuan_id ASC
	`

	rows, err := config.DB.Query(ctx, sqlDetail, pelaksanaanID)
	if err != nil {
		return response, err
	}
	defer rows.Close()

	response.Temuan = []models.TemuanItemResponse{}

	for rows.Next() {
		var item models.TemuanItemResponse

		// Variable Penampung
		var ref, bukti, katTem, datInt, p5r, root, corr, due, catVerif, statusVerif sql.NullString
		var buktiPerbaikan, catPerbaikan, buktiVerif, catVerifBukti, justif sql.NullString
		var statusEvidence sql.NullString
		var pic sql.NullInt64
		var picName sql.NullString

		if err := rows.Scan(
			&item.TemuanID, &item.ItemID, &item.Status, &item.DeskripsiTemuan, &item.Kategori, &item.SubKategori,
			&item.LokasiTemuan, &statusVerif, &catVerif, &item.ItemChecklistText, &ref, &bukti,
			&pic, &picName, &katTem, &datInt, &p5r, &root, &corr, &due, &buktiPerbaikan, &catPerbaikan,
			&buktiVerif, &catVerifBukti, &justif, &statusEvidence,
		); err == nil {

			// === MAPPING DATA (Ini yang tadi kurang lengkap) ===
			if bukti.Valid {
				_ = json.Unmarshal([]byte(bukti.String), &item.BuktiTemuan)
			}
			if pic.Valid {
				id := int(pic.Int64)
				item.PicUserID = &id
			}

			// Mapping Informasi Detail (CAPA, 5R, dll)
			if ref.Valid {
				item.ReferensiDoc = &ref.String
			}
			if katTem.Valid {
				item.KategoriTemuan = &katTem.String
			}
			if datInt.Valid {
				item.DataIntegrity = &datInt.String
			}
			if p5r.Valid {
				item.Prinsip5R = &p5r.String
			}
			if root.Valid {
				item.RootCause = &root.String
			}
			if corr.Valid {
				item.CorrectiveAction = &corr.String
			}
			if due.Valid {
				item.DueDate = &due.String
			}
			if justif.Valid {
				item.Justification = &justif.String
			}
			if picName.Valid {
				item.PicName = picName.String
			}
			// Mapping Perbaikan & Verifikasi
			if catPerbaikan.Valid {
				val := catPerbaikan.String
				item.CatatanPerbaikan = &val
			}
			if buktiPerbaikan.Valid && buktiPerbaikan.String != "null" {
				_ = json.Unmarshal([]byte(buktiPerbaikan.String), &item.BuktiPerbaikan)
			}

			if catVerif.Valid && catVerif.String != "" {
				item.CatatanVerifikasi = &catVerif.String
			}
			if catVerifBukti.Valid {
				val := catVerifBukti.String
				item.CatatanVerifikasiBukti = &val
			}
			if statusVerif.Valid {
				item.StatusVerifikasi = statusVerif.String
			} else {
				item.StatusVerifikasi = "WAITING"
			}
			if statusEvidence.Valid {
				item.StatusEvidence = statusEvidence.String
			}
			if buktiVerif.Valid && buktiVerif.String != "null" {
				_ = json.Unmarshal([]byte(buktiVerif.String), &item.BuktiVerifikasi)
			}

			response.Temuan = append(response.Temuan, item)
		}
	}

	return response, nil
}

func FetchAuditReportList() ([]models.ReportListData, error) {
	ctx := context.Background()

	// [FIX] Mengembalikan p.tanggal_audit dan p.tanggal_selesai ke format asli (tanpa TO_CHAR)
	// agar sesuai dengan tipe data time.Time di struct models.ReportListData
	sqlQuery := `
		SELECT 
			p.pelaksanaan_id, 
			p.tanggal_audit, 
			p.tanggal_selesai,
			COALESCE(s.nama_site, '-') AS site, 
			COALESCE(a.nama_area, '-') AS area, 
			COALESCE(j.nama_jenis_audit, '-') AS jenis_audit,
			COALESCE(STRING_AGG(DISTINCT u.nama_lengkap, ', '), '-') AS auditor, 
			p.status_laporan,
			(SELECT no_fta FROM laporan_temuan WHERE pelaksanaan_id = p.pelaksanaan_id AND no_fta IS NOT NULL AND no_fta != '' LIMIT 1) AS no_fta,
			(SELECT COUNT(*) FROM laporan_temuan WHERE pelaksanaan_id = p.pelaksanaan_id AND status != 'OK') AS total_temuan
		FROM pelaksanaan_audit p
		LEFT JOIN site s ON p.site_id = s.site_id
		LEFT JOIN jenis_audit j ON p.jenis_audit_id = j.id_jenis_audit
		LEFT JOIN area a ON p.area_id = a.area_id
		LEFT JOIN users u ON u.user_id = ANY(p.auditor_ids)
		
		-- [PENTING] Filter status dihapus agar data DRAFT, REVIEW, dll tetap muncul (Helicopter View)
		-- WHERE p.status_laporan IS NOT NULL 

		GROUP BY p.pelaksanaan_id, s.nama_site, a.nama_area, j.nama_jenis_audit
		ORDER BY 
			CASE WHEN p.status_laporan = 'CLOSED' THEN 1 ELSE 0 END ASC, 
			p.tanggal_audit DESC
	`

	rows, err := config.DB.Query(ctx, sqlQuery)
	if err != nil {
		return nil, fmt.Errorf("gagal query report: %w", err)
	}
	defer rows.Close()

	var list []models.ReportListData
	for rows.Next() {
		var item models.ReportListData
		// Scan sekarang aman karena tipe data SQL (Timestamp) cocok dengan struct (time.Time)
		err := rows.Scan(
			&item.PelaksanaanID,
			&item.TanggalAudit,
			&item.TanggalSelesai,
			&item.NamaSite,
			&item.NamaArea,
			&item.NamaJenisAudit,
			&item.NamaAuditor,
			&item.StatusLaporan,
			&item.NoFTA,
			&item.TotalTemuan,
		)
		if err != nil {
			// Jika ada error scan, log dan lewati baris tersebut
			fmt.Printf("Error scan row ID %v: %v\n", item.PelaksanaanID, err)
			continue
		}
		list = append(list, item)
	}

	if list == nil {
		list = []models.ReportListData{}
	}

	return list, nil
}

func FetchVerificationMasterlist() ([]models.VerifMasterData, error) {
	// ... (Kode fungsi ini tetap sama seperti sebelumnya, tidak perlu diubah)
	// Silakan paste ulang fungsi FetchVerificationMasterlist dari kode Anda sebelumnya jika perlu,
	// tapi fungsi FetchAuditDetailFull di atas adalah kuncinya.

	// Agar kode lengkap, saya sertakan placeholder aman jika Anda copy-paste
	ctx := context.Background()
	sqlQuery := `
        SELECT 
            p.pelaksanaan_id, p.tanggal_audit, COALESCE(s.nama_site, '-'), COALESCE(a.nama_area, '-'),
            COALESCE(j.nama_jenis_audit, '-'), COALESCE(STRING_AGG(DISTINCT u.nama_lengkap, ', '), '-'),
            p.status_laporan, COUNT(DISTINCT lt.temuan_id) FILTER (WHERE lt.status IN ('NOK', 'Open CAPA', 'Responded')),
            (SELECT no_fta FROM laporan_temuan WHERE pelaksanaan_id = p.pelaksanaan_id AND no_fta IS NOT NULL LIMIT 1)
        FROM pelaksanaan_audit p
        LEFT JOIN laporan_temuan lt ON p.pelaksanaan_id = lt.pelaksanaan_id
        LEFT JOIN site s ON p.site_id = s.site_id
        LEFT JOIN jenis_audit j ON p.jenis_audit_id = j.id_jenis_audit
        LEFT JOIN area a ON p.area_id = a.area_id
        LEFT JOIN users u ON u.user_id = ANY(p.auditor_ids)
        WHERE p.status_laporan IN ('WAITING_QS_SPV', 'WAITING_MGR_AREA', 'WAITING_MGR_QS')
        GROUP BY p.pelaksanaan_id, p.tanggal_audit, s.nama_site, a.nama_area, j.nama_jenis_audit, p.status_laporan
        ORDER BY p.tanggal_audit DESC
    `
	rows, err := config.DB.Query(ctx, sqlQuery)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.VerifMasterData
	for rows.Next() {
		var item models.VerifMasterData
		var noFTA *string
		if err := rows.Scan(&item.PelaksanaanID, &item.TanggalAudit, &item.NamaSite, &item.NamaArea, &item.NamaJenisAudit, &item.NamaAuditor, &item.StatusLaporan, &item.JumlahTemuanNOK, &noFTA); err == nil {
			item.NoFTA = noFTA
			list = append(list, item)
		}
	}
	if list == nil {
		list = []models.VerifMasterData{}
	}
	return list, nil
}
