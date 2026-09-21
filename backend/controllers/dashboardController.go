package controllers

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/vaneshadhani/e-audit-backend/config"
)

type DashboardStats struct {
	TotalAudit       int              `json:"total_audit"`
	TemuanMajor      int              `json:"temuan_major"`
	AuditSelesai     int              `json:"audit_selesai"`
	Outstanding      []Outstanding    `json:"outstanding"`
	TopArea          []TopAreaStat    `json:"top_area"`
	DistribusiTemuan []Distribution   `json:"distribusi_temuan"`
	MonitoringCapa   []CapaMonitoring `json:"monitoring_capa"`
	DashboardReport  []DetailReport   `json:"dashboard_report"`
}

type Outstanding struct {
	AuditID    uint   `json:"audit_id"`
	JudulAudit string `json:"judul_audit"`
	Auditors   string `json:"auditors"`
	Progress   string `json:"progress"`
}

type TopAreaStat struct {
	NamaArea    string `json:"nama_area"`
	TotalTemuan int    `json:"total_temuan"`
	Closed      int    `json:"closed"`
	OnProgress  int    `json:"on_progress"`
	Overdue     int    `json:"overdue"`
	Open        int    `json:"open"`
}

type Distribution struct {
	Jenis string `json:"jenis"`
	Count int    `json:"count"`
}

type CapaMonitoring struct {
	ID          uint   `json:"id"`
	Area        string `json:"area"`
	PIC         string `json:"pic"`
	HariOverdue int    `json:"hari_overdue"`
	Deskripsi   string `json:"deskripsi"`
}

type DetailReport struct {
	CheckItem        string `json:"check_item"`
	Deskripsi        string `json:"deskripsi"`
	TindakanRemedial string `json:"tindakan_remedial"`
	PIC              string `json:"pic"`
	DueDate          string `json:"due_date"`
}

func GetDashboardData(c *gin.Context) {
	ctx := context.Background()
	userIDValue, _ := c.Get("userID")
	userID, _ := strconv.Atoi(fmt.Sprintf("%v", userIDValue))

	// Ambil role user login untuk menentukan pending task secara akurat
	var userRole string
	config.DB.QueryRow(ctx, "SELECT r.nama_role FROM users u JOIN role r ON u.role_id = r.id WHERE u.user_id = $1", userID).Scan(&userRole)

	siteID := c.Query("site_id")
	jenisAuditID := c.Query("jenis_audit_id")
	month := c.Query("month")
	year := c.Query("year")
	statusFilter := strings.ToUpper(c.Query("status_filter"))
	areaFilter := c.Query("area_name")

	// --- LOGIKA FILTER GLOBAL ---
	baseWhere := " WHERE 1=1 "
	var baseArgs []interface{}
	argCount := 1

	if siteID != "" {
		baseWhere += fmt.Sprintf(" AND ae.site_id = $%d", argCount)
		baseArgs = append(baseArgs, siteID)
		argCount++
	}
	if jenisAuditID != "" {
		baseWhere += fmt.Sprintf(" AND ae.jenis_audit_id = $%d", argCount)
		baseArgs = append(baseArgs, jenisAuditID)
		argCount++
	}
	if year != "" {
		baseWhere += fmt.Sprintf(" AND EXTRACT(YEAR FROM ae.tanggal_audit) = $%d", argCount)
		baseArgs = append(baseArgs, year)
		argCount++
	}
	if month != "" {
		baseWhere += fmt.Sprintf(" AND EXTRACT(MONTH FROM ae.tanggal_audit) = $%d", argCount)
		baseArgs = append(baseArgs, month)
		argCount++
	}

	stats := DashboardStats{
		Outstanding: []Outstanding{}, TopArea: []TopAreaStat{}, DistribusiTemuan: []Distribution{},
		MonitoringCapa: []CapaMonitoring{}, DashboardReport: []DetailReport{},
	}

	// --- 1. STAT CARDS ---
	config.DB.QueryRow(ctx, `SELECT COUNT(*) FROM pelaksanaan_audit ae`+baseWhere+` AND ae.status_laporan != 'CLOSED'`, baseArgs...).Scan(&stats.TotalAudit)
	config.DB.QueryRow(ctx, `SELECT COUNT(*) FROM pelaksanaan_audit ae`+baseWhere+` AND ae.status_laporan = 'CLOSED'`, baseArgs...).Scan(&stats.AuditSelesai)
	config.DB.QueryRow(ctx, `SELECT COUNT(lt.temuan_id) FROM laporan_temuan lt JOIN pelaksanaan_audit ae ON lt.pelaksanaan_id = ae.pelaksanaan_id `+baseWhere+` AND lt.kategori_temuan = 'MAJOR'`, baseArgs...).Scan(&stats.TemuanMajor)

	// --- 2. OUTSTANDING (COMPREHENSIVE ACTIONABLE TASKS) ---
	// Menggabungkan filter global dengan filter giliran (turn-based) user login
	sqlOut := `
		SELECT 
			ae.pelaksanaan_id, 
			COALESCE(c.nama_checklist, 'Audit #' || ae.pelaksanaan_id::text),
			COALESCE((SELECT STRING_AGG(u_sub.nama_lengkap, ', ') FROM users u_sub WHERE u_sub.user_id = ANY(ae.auditor_ids)), '-'),
			ae.status_laporan
		FROM pelaksanaan_audit ae
		LEFT JOIN checklists c ON ae.area_id = c.area_id AND ae.jenis_audit_id = c.jenis_audit_id
		` + baseWhere + fmt.Sprintf(` AND (
			-- GILIRAN AUDITOR
			(ae.status_laporan IN ('EXEC_OPEN', 'EXEC_PROGRESS', 'RPT_OPEN', 'RPT_PROGRESS', 'EVIDENCE_REJECTED_AUDITOR') AND $%d = ANY(ae.auditor_ids)) OR
			
			-- GILIRAN QS SUPERVISOR
			(ae.status_laporan IN ('QS_REVIEW', 'WAITING_QS_SPV', 'CAPA_REJECTED_QSSPV', 'EVIDENCE_REJECTED_QSSPV') AND '%s' = 'QS supervisor') OR
			
			-- GILIRAN MANAGER AREA
			(ae.status_laporan IN ('WAITING_MGR_AREA', 'QS_REJECTED_MGR', 'CAPA_REJECTED_MGR') AND '%s' = 'Manager area') OR
			
			-- GILIRAN MANAGER QS
			(ae.status_laporan = 'WAITING_MGR_QS' AND '%s' = 'QS Manager') OR
			
			-- GILIRAN PIC AREA
			(ae.status_laporan IN ('CAPA_OPEN', 'CAPA_IN_PROGRESS', 'READY_FOR_CAPA', 'EVIDENCE_IN_PROGRESS', 'RPT_REJECTED_PIC') 
			 AND EXISTS (SELECT 1 FROM laporan_temuan lt WHERE lt.pelaksanaan_id = ae.pelaksanaan_id AND lt.pic_user_id = $%d))
		)`, argCount, userRole, userRole, userRole, argCount)

	outArgs := append(baseArgs, userID)
	rowsOut, _ := config.DB.Query(ctx, sqlOut+" ORDER BY ae.tanggal_audit ASC", outArgs...)
	if rowsOut != nil {
		defer rowsOut.Close()
		for rowsOut.Next() {
			var o Outstanding
			var rawStatus string
			rowsOut.Scan(&o.AuditID, &o.JudulAudit, &o.Auditors, &rawStatus)
			o.Progress = mapPendingLocation(rawStatus)
			stats.Outstanding = append(stats.Outstanding, o)
		}
	}

	// --- 3. BAR CHART ---
	barWhere := baseWhere
	barArgs := append([]interface{}{}, baseArgs...)
	if statusFilter != "" {
		switch statusFilter {
		case "CLOSED":
			barWhere += " AND ae.status_laporan = 'CLOSED'"
		case "OVERDUE":
			barWhere += " AND lt.due_date < CURRENT_DATE AND ae.status_laporan != 'CLOSED'"
		case "PROGRESS", "ON_PROGRESS":
			barWhere += " AND ae.status_laporan IN ('CAPA_IN_PROGRESS', 'WAITING_QS_SPV')"
		case "OPEN":
			barWhere += " AND ae.status_laporan LIKE '%OPEN%'"
		}
	}
	sqlStacked := `SELECT a.nama_area, COUNT(lt.temuan_id), COUNT(CASE WHEN ae.status_laporan = 'CLOSED' THEN 1 END), COUNT(CASE WHEN ae.status_laporan IN ('CAPA_IN_PROGRESS', 'WAITING_QS_SPV') THEN 1 END), COUNT(CASE WHEN lt.due_date < CURRENT_DATE AND ae.status_laporan != 'CLOSED' THEN 1 END), COUNT(CASE WHEN ae.status_laporan LIKE '%OPEN%' THEN 1 END) FROM laporan_temuan lt JOIN pelaksanaan_audit ae ON lt.pelaksanaan_id = ae.pelaksanaan_id JOIN area a ON ae.area_id = a.area_id ` + barWhere + ` GROUP BY a.nama_area`
	rowsStack, _ := config.DB.Query(ctx, sqlStacked, barArgs...)
	if rowsStack != nil {
		defer rowsStack.Close()
		for rowsStack.Next() {
			var t TopAreaStat
			rowsStack.Scan(&t.NamaArea, &t.TotalTemuan, &t.Closed, &t.OnProgress, &t.Overdue, &t.Open)
			stats.TopArea = append(stats.TopArea, t)
		}
	}

	// --- 4. DOUGHNUT CHART ---
	distWhere := baseWhere
	distArgs := append([]interface{}{}, baseArgs...)
	if areaFilter != "" {
		distWhere += fmt.Sprintf(" AND a.nama_area = $%d", len(distArgs)+1)
		distArgs = append(distArgs, areaFilter)
	}
	sqlDist := `SELECT COALESCE(lt.kategori_temuan, 'LAIN-LAIN'), COUNT(lt.temuan_id) FROM laporan_temuan lt JOIN pelaksanaan_audit ae ON lt.pelaksanaan_id = ae.pelaksanaan_id JOIN area a ON ae.area_id = a.area_id ` + distWhere + ` GROUP BY lt.kategori_temuan`
	rowsDist, _ := config.DB.Query(ctx, sqlDist, distArgs...)
	if rowsDist != nil {
		defer rowsDist.Close()
		for rowsDist.Next() {
			var d Distribution
			rowsDist.Scan(&d.Jenis, &d.Count)
			stats.DistribusiTemuan = append(stats.DistribusiTemuan, d)
		}
	}

	// --- 5. REPORT TABLE ---
	if areaFilter != "" {
		reportWhere := baseWhere
		reportArgs := append([]interface{}{}, baseArgs...)
		reportWhere += fmt.Sprintf(" AND a.nama_area = $%d", len(reportArgs)+1)
		reportArgs = append(reportArgs, areaFilter)
		sqlReport := `SELECT COALESCE(ci.item_checklist_text, lt.deskripsi_temuan), lt.deskripsi_temuan, COALESCE(lt.tindakan_remedial, '-'), COALESCE(u.nama_lengkap, 'Unassigned'), TO_CHAR(lt.due_date, 'DD-Mon-YYYY') FROM laporan_temuan lt JOIN pelaksanaan_audit ae ON lt.pelaksanaan_id = ae.pelaksanaan_id JOIN area a ON ae.area_id = a.area_id LEFT JOIN users u ON lt.pic_user_id = u.user_id LEFT JOIN checklist_items ci ON lt.item_id = ci.item_id ` + reportWhere + ` ORDER BY lt.due_date DESC`
		rowsRep, _ := config.DB.Query(ctx, sqlReport, reportArgs...)
		if rowsRep != nil {
			defer rowsRep.Close()
			for rowsRep.Next() {
				var r DetailReport
				rowsRep.Scan(&r.CheckItem, &r.Deskripsi, &r.TindakanRemedial, &r.PIC, &r.DueDate)
				stats.DashboardReport = append(stats.DashboardReport, r)
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"data": stats})
}

// Mapping Pending Modul Sesuai Alur Sistem (Action Required)
func mapPendingLocation(status string) string {
	switch status {
	case "EXEC_OPEN", "EXEC_PROGRESS":
		return "Pelaksanaan Audit (Auditor)"
	case "RPT_OPEN", "RPT_PROGRESS", "RPT_REJECTED_PIC":
		return "Laporan Auditor (Auditor)"
	case "QS_REVIEW", "QS_REJECTED_MGR":
		return "Review QS Supervisor"
	case "CAPA_OPEN", "CAPA_IN_PROGRESS", "CAPA_REJECTED_QSSPV", "CAPA_REJECTED_MGR":
		return "Tindak Lanjut PIC Area"
	case "WAITING_QS_SPV", "WAITING_MGR_AREA", "WAITING_MGR_QS":
		return "Final Approve"
	case "READY_FOR_CAPA", "EVIDENCE_IN_PROGRESS", "EVIDENCE_REJECTED_AUDITOR", "EVIDENCE_REJECTED_QSSPV":
		return "Laporan Bukti Perbaikan"
	case "EVIDENCE_VERIF", "EVIDENCE_VERIF_PROGRESS":
		return "Verifikasi Bukti Perbaikan"
	default:
		return "In Progress"
	}
}
