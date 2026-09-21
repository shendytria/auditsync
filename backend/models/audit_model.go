package models

import (
	"database/sql"
	"time"

	"gorm.io/datatypes"
)

// ==========================================
// 1. CONSTANTS (STATUS & ENUM)
// ==========================================

const (
	// --- Modul 1: Pelaksanaan Audit (Auditor) ---
	StatusExecOpen       = "EXEC_OPEN"
	StatusExecProgress   = "EXEC_PROGRESS"
	StatusRptOpen        = "RPT_OPEN"
	StatusRptProgress    = "RPT_PROGRESS"
	StatusRptRejectedPic = "RPT_REJECTED_PIC" // Revisi: Dikembalikan oleh PIC/QS

	// --- Modul 2: Review QS Supervisor ---
	StatusQsReview      = "QS_REVIEW_OPEN"
	StatusQsRejectedMgr = "QS_REJECTED_MGR" // Revisi: Dikembalikan oleh Manager Area

	// --- Modul 3: Tindak Lanjut CAPA (PIC Area) ---
	StatusCapaOpen          = "CAPA_OPEN"           // Baru diapprove QS, siap didistribusikan
	StatusCapaInProgress    = "CAPA_IN_PROGRESS"    // Sedang dikerjakan PIC CAPA
	StatusCapaRejectedQsSpv = "CAPA_REJECTED_QSSPV" // Revisi: Ditolak QS SPV (Balik ke PIC)

	// --- Modul 4: Approval Berjenjang (Final Approve) ---
	StatusWaitingQsSpv   = "WAITING_QS_SPV"   // Cek 1: QS Supervisor
	StatusWaitingMgrArea = "WAITING_MGR_AREA" // Cek 2: Manager Area
	StatusWaitingMgrQs   = "WAITING_MGR_QS"   // Cek 3: QS Manager

	// --- Modul 5: Pengerjaan & Verifikasi Bukti ---
	StatusReadyForCapa = "READY_FOR_CAPA"

	StatusEvidenceProgress   = "EVIDENCE_IN_PROGRESS"
	StatusEvidenceInProgress = "EVIDENCE_IN_PROGRESS"
	StatusEvidenceRevision   = "EVIDENCE_REJECTED_AUDITOR"

	StatusEvidenceVerif           = "EVIDENCE_VERIF"
	StatusEvidenceVerifProgress   = "EVIDENCE_VERIF_PROGRESS"
	StatusEvidenceRejectedAuditor = "EVIDENCE_REJECTED_AUDITOR"
	StatusEvidenceRejectedQsSpv   = "EVIDENCE_REJECTED_QSSPV"
	// --- Modul 6: Final Closing ---
	StatusFinalClosing = "FINAL_CLOSING" // Antrian Closing Admin
	StatusClosed       = "CLOSED"        // Selesai
)

// ==========================================
// 2. CORE STRUCTS (Database Representation)
// ==========================================

// AuditTemuan merepresentasikan satu baris temuan (laporan_temuan)
type AuditTemuan struct {
	TemuanID        int    `json:"temuan_id" gorm:"primaryKey"`
	NoFTA           string `json:"no_fta"`
	Status          string `json:"status"`
	DeskripsiTemuan string `json:"deskripsi_temuan"`
	LokasiTemuan    string `json:"lokasi_temuan"`
	Kategori        string `json:"kategori"`
	BuktiTemuan     string `json:"bukti_temuan"`
	PICUserID       int    `json:"pic_user_id"`
	PICName         string `json:"pic_name" gorm:"-"`
}

// AuditHeaderInfo untuk informasi utama di bagian atas halaman detail
type AuditHeaderInfo struct {
	PelaksanaanID        uint      `json:"pelaksanaan_id"`
	TanggalAudit         time.Time `json:"tanggal_audit"`
	NamaChecklist        string    `json:"nama_checklist"`
	NamaArea             string    `json:"nama_area"`
	NamaDepartment       string    `json:"nama_department"`
	NamaJenisAudit       string    `json:"nama_jenis_audit"`
	NamaAuditor          string    `json:"nama_auditor"`
	ChecklistID          uint      `json:"checklist_id"`
	StatusLaporan        string    `json:"status_laporan"`
	NoFTA                *string   `json:"no_fta"`
	NamaSite             string    `json:"nama_site"`
	NoteReject           *string   `json:"note_reject"`
	NamaQsSpv            string    `json:"nama_qs_spv"`
	NamaMgrArea          string    `json:"nama_mgr_area"`
	NamaMgrQs            string    `json:"nama_mgr_qs"`
	NamaPicCapa          string    `json:"nama_pic_capa"`
	ApproverQsSpvID      int       `json:"approver_qs_spv_id"`
	ApproverMgrAreaID    int       `json:"approver_mgr_area_id"`
	ApproverMgrQsID      int       `json:"approver_mgr_qs_id"`
	ApproverPicCapaIDs   []int     `json:"approver_pic_capa_ids"`
	ApproverPicCapaNames string    `json:"approver_pic_capa_names"`
	TglApproveQsSpv      string    `json:"tgl_approve_qs_spv"`
	TglApproveMgrArea    string    `json:"tgl_approve_mgr_area"`
	TglApproveMgrQs      string    `json:"tgl_approve_mgr_qs"`
	TglSubmitCapa        string    `json:"tgl_submit_capa"`
}

// ==========================================
// 3. INPUT STRUCTS (Request Body)
// ==========================================

// AuditCreateInput untuk payload pembuatan audit baru
type AuditCreateInput struct {
	SiteID       int   `json:"site_id" binding:"required"`
	JenisAuditID int   `json:"jenis_audit_id" binding:"required"`
	DepartmentID *int  `json:"department_id"`
	AreaID       int   `json:"area_id" binding:"required"`
	AuditorIDs   []int `json:"auditor_ids" binding:"required"`
	CreatedBy    int   `json:"created_by"`
}

// AuditItemAnswer untuk payload jawaban checklist dari Auditor
type AuditItemAnswer struct {
	ItemID            interface{} `json:"item_id"` // Bisa int atau string (jika item baru "temp-123")
	Status            string      `json:"status"`  // OK, NOK, NA
	DeskripsiTemuan   string      `json:"deskripsi_temuan"`
	LokasiTemuan      string      `json:"lokasi_temuan"`
	IsNew             bool        `json:"is_new"`
	ItemChecklistText string      `json:"item_checklist_text"`
	ReferensiDoc      string      `json:"referensi_doc"`
	Kategori          string      `json:"kategori"`
	Files             []string    `json:"files"`
	ExistingFiles     []string    `json:"existing_files"`
	PicUserID         *int        `json:"pic_user_id"`
	KategoriTemuan    string      `json:"kategori_temuan"`
	DataIntegrity     string      `json:"data_integrity"`
	Prinsip5R         string      `json:"prinsip_5r"`
	Justification     string      `json:"justification"`
}

// ApproverInput untuk payload pemilihan Approver saat Submit
type ApproverInput struct {
	PicCapaIDs []int `json:"pic_capa_ids"` // Supervisor Area
	QsSpvID    int   `json:"qs_spv_id"`
	MgrAreaID  int   `json:"mgr_area_id"`
	MgrQsID    int   `json:"mgr_qs_id"`
}

// QSReviewInput untuk payload edit temuan oleh QS Supervisor
type QSReviewInput struct {
	DeskripsiTemuan string `json:"deskripsi_temuan"`
	LokasiTemuan    string `json:"lokasi_temuan"`
	PicUserID       int    `json:"pic_user_id"`
	KategoriTemuan  string `json:"kategori_temuan"`
	DataIntegrity   string `json:"data_integrity"`
	Prinsip5R       string `json:"prinsip_5r"`
}

// SubmitCapaRequest untuk payload submit proposal CAPA oleh PIC
type SubmitCapaRequest struct {
	CapaItems []CapaInputData `json:"capa_items"`
}

// CapaInputData detail per item saat submit CAPA
type CapaInputData struct {
	ItemID           interface{} `json:"item_id"`
	RootCause        string      `json:"root_cause"`
	CorrectiveAction string      `json:"corrective_action"`
	PreventiveAction string      `json:"preventive_action"`
	DueDate          string      `json:"due_date"`
}

// AssignPicRequest untuk payload Supervisor menunjuk PIC CAPA
type AssignPicRequest struct {
	Assignments []PicAssignment `json:"assignments"`
}

type PicAssignment struct {
	ItemID interface{} `json:"item_id"`
	PicID  int         `json:"pic_id"`
}

// Generic Inputs
type RejectInput struct {
	Reason string `json:"reason"`
}

type VerifyRejectRequest struct {
	Reason string `json:"reason"`
}

type FinalDecisionInput struct {
	Action string `json:"action"` // "APPROVE" atau "REJECT"
	Reason string `json:"reason"` // Wajib jika REJECT
}

type ApprovalInput struct {
	Action  string `json:"action"`  // "APPROVE" atau "REJECT"
	Comment string `json:"comment"` // Wajib diisi
	UserID  int    `json:"user_id"`
}

// ==========================================
// 4. RESPONSE STRUCTS (Data Output)
// ==========================================

// AuditCheckItem untuk list checklist di halaman eksekusi
type AuditCheckItem struct {
	ItemID            uint    `json:"item_id"`
	ItemChecklistText string  `json:"item_checklist_text"`
	ReferensiDoc      *string `json:"referensi_doc"`
	Kategori          *string `json:"kategori"`
	SubKategori       *string `json:"sub_kategori"`
	Status            *string `json:"status"`
	DeskripsiTemuan   *string `json:"deskripsi_temuan"`
	LokasiTemuan      *string `json:"lokasi_temuan"`
	BuktiTemuan       *string `json:"bukti_temuan"`
}

// AuditExecutionPageData wrapper response halaman eksekusi
type AuditExecutionPageData struct {
	AuditInfo  AuditHeaderInfo  `json:"audit_info"`
	CheckItems []AuditCheckItem `json:"check_items"`
}

// AuditAktifResponse untuk Dashboard Auditor
type AuditAktifResponse struct {
	ID            uint    `json:"id"`
	Site          string  `json:"site"`
	JenisAudit    string  `json:"jenisAudit"`
	Department    string  `json:"department"`
	Area          string  `json:"area"`
	Auditor       string  `json:"auditor"`
	Status        string  `json:"status"`
	TanggalDibuat string  `json:"tanggal_dibuat"`
	Pembuat       string  `json:"pembuat"`
	CreatedBy     int     `json:"created_by"`
	AuditorIDs    []int64 `json:"auditor_ids"`
}

// models/audit_model.go

type TemuanItemResponse struct {
	TemuanID          int         `json:"temuan_id"`
	ItemID            int         `json:"item_id"`
	Status            string      `json:"status"`
	DeskripsiTemuan   string      `json:"deskripsi_temuan"`
	Kategori          string      `json:"kategori"`
	SubKategori       string      `json:"sub_kategori"`
	LokasiTemuan      string      `json:"lokasi_temuan"`
	StatusVerifikasi  string      `json:"status_verifikasi"`
	ItemChecklistText string      `json:"item_checklist_text"`
	ReferensiDoc      *string     `json:"referensi_doc"`
	BuktiTemuan       interface{} `json:"bukti_temuan"`
	PicUserID         *int        `json:"pic_user_id"`
	PicName           string      `json:"pic_name"`
	StatusEvidence    string      `json:"status_evidence"`

	// Kita hapus PicName pointer yang bikin error, kita pakai logic manual di controller/helper nanti jika perlu
	// Atau biarkan kosong dulu biar aman.

	KategoriTemuan   *string     `json:"kategori_temuan"`
	DataIntegrity    *string     `json:"data_integrity"`
	Prinsip5R        *string     `json:"prinsip_5r"`
	RootCause        *string     `json:"root_cause"`
	CorrectiveAction *string     `json:"corrective_action"`
	PreventiveAction *string     `json:"preventive_action"`
	DueDate          *string     `json:"due_date"`
	BuktiPerbaikan   interface{} `json:"bukti_perbaikan"`
	CatatanPerbaikan *string     `json:"catatan_perbaikan"`

	CatatanVerifikasi      *string     `json:"catatan_verifikasi"`
	BuktiVerifikasi        interface{} `json:"bukti_verifikasi"`
	CatatanVerifikasiBukti *string     `json:"catatan_verifikasi_bukti"`
	Justification          *string     `json:"justification"`

	// HAPUS FIELD TANGGAL BARU SEMENTARA AGAR TIDAK ERROR SCAN
}

// TemuanByPelaksanaanResponse wrapper detail audit
type TemuanByPelaksanaanResponse struct {
	Master               AuditHeaderInfo      `json:"master"`
	Temuan               []TemuanItemResponse `json:"temuan"`
	ApproverPicCapaNames string               `json:"approver_pic_capa_names"`
}

// MasterUserDropdown untuk dropdown user
type MasterUserDropdown struct {
	ID     int    `json:"id"`
	Name   string `json:"name"`
	Role   string `json:"role"`
	RoleID int    `json:"role_id"`
	Email  string `json:"email"`
}

// MasterlistAudit untuk tabel list di Auditor
type MasterlistAudit struct {
	PelaksanaanID   uint      `json:"id"`
	TanggalAudit    time.Time `json:"tanggal"`
	NamaSite        string    `json:"site"`
	NamaArea        string    `json:"area"`
	NamaJenisAudit  string    `json:"jenis_audit"`
	NamaAuditor     string    `json:"auditor"`
	StatusLaporan   string    `json:"status"`
	JumlahTemuanNOK int       `json:"jml_temuan"`
	NoFTA           *string   `json:"no_fta"`
	NoteReject      string    `json:"note_reject"`
	AuditorIDs      []int64   `json:"auditor_ids"`
}

// ReviewQSData untuk tabel list di QS Review
type ReviewQSData struct {
	PelaksanaanID   uint      `json:"id"`
	TanggalAudit    time.Time `json:"tanggal"`
	NamaSite        string    `json:"site"`
	NamaArea        string    `json:"area"`
	NamaJenisAudit  string    `json:"jenis_audit"`
	NamaAuditor     string    `json:"auditor"`
	StatusLaporan   string    `json:"status"`
	JumlahTemuanNOK int       `json:"jml_temuan"`
	NoFTA           *string   `json:"no_fta"`
	NoteReject      *string   `json:"note_reject"`
}

// CapaListResponse untuk tabel list di PIC Area
type CapaListResponse struct {
	ID                int       `json:"id"`
	Tanggal           time.Time `json:"tanggal"`
	Site              string    `json:"site"`
	Area              string    `json:"area"`
	JenisAudit        string    `json:"jenis_audit"`
	Auditor           string    `json:"auditor"`
	Status            string    `json:"status"`
	JumlahTemuan      int       `json:"jumlah_nok"`
	NoFTA             string    `json:"no_fta"`
	NoteReject        *string   `json:"note_reject"`
	SupervisorAreaIDs []int64   `json:"supervisor_ids"`
	ItemPicIDs        []int64   `json:"item_pic_ids"`
}

// EvidenceListResponse untuk tabel list Bukti
type EvidenceListResponse struct {
	PelaksanaanID     uint      `json:"id"`
	TanggalAudit      time.Time `json:"tanggal"`
	NamaSite          string    `json:"site"`
	NamaArea          string    `json:"area"`
	NamaJenisAudit    string    `json:"jenis_audit"`
	NamaAuditor       string    `json:"auditor"`
	StatusLaporan     string    `json:"status"`
	JumlahTemuan      int       `json:"jml_temuan"`
	JumlahSelesai     int       `json:"jml_selesai"`
	NoFTA             string    `json:"no_fta"`
	CountReject       int       `json:"count_reject"`
	RejectorInfo      string    `json:"rejector_info"`
	SupervisorAreaIDs []int64   `json:"supervisor_ids"`
	ItemPicIDs        []int64   `json:"item_pic_ids"`
	TglSubmitEvidence string    `json:"tgl_submit_evidence"`
}

// EvidenceVerifData untuk tabel list Verifikasi
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
}

// FinalVerifData untuk tabel list Final Closing
type FinalVerifData struct {
	PelaksanaanID  uint      `json:"id"`
	TanggalAudit   time.Time `json:"tanggal"`
	NamaSite       string    `json:"site"`
	NamaArea       string    `json:"area"`
	NamaJenisAudit string    `json:"jenis_audit"`
	NamaAuditor    string    `json:"auditor"`
	StatusLaporan  string    `json:"status_laporan"`
	JumlahSelesai  int       `json:"jml_selesai"`
	JumlahTemuan   int       `json:"jml_temuan"`
	NoFTA          *string   `json:"no_fta"`
	TglMasukFinal  *string   `json:"tgl_masuk_final"`
}

// ReportListData untuk tabel report
type ReportListData struct {
	PelaksanaanID  uint       `json:"id"`
	TanggalAudit   time.Time  `json:"tanggal_audit"`
	TanggalSelesai *time.Time `json:"tanggal_selesai"`
	NamaSite       string     `json:"site"`
	NamaArea       string     `json:"area"`
	NamaJenisAudit string     `json:"jenis_audit"`
	NamaAuditor    string     `json:"auditor"`
	JumlahSelesai  int        `json:"jml_selesai"` // TAMBAHKAN INI
	JumlahTemuan   int        `json:"jml_temuan"`
	StatusLaporan  string     `json:"status"`
	NoFTA          *string    `json:"no_fta"`
	TotalTemuan    int        `json:"total_temuan"`
}

// AuditLogResponse untuk log aktivitas
type AuditLogResponse struct {
	ID          string      `json:"id"`
	Actor       string      `json:"actor"`
	Role        string      `json:"role"`
	Site        string      `json:"site"`
	Action      string      `json:"action"`
	Entity      string      `json:"entity"`
	EntityID    string      `json:"entity_id"`
	TargetName  string      `json:"target_name"`
	Description string      `json:"description"`
	Time        string      `json:"time"`
	Changes     interface{} `json:"changes"`
}

// AuditDetailRaw (Helper struct)
type AuditDetailRaw struct {
	SiteID       int   `json:"site_id"`
	JenisAuditID int   `json:"jenis_audit_id"`
	DepartmentID *int  `json:"department_id"`
	AreaID       int   `json:"area_id"`
	AuditorIDs   []int `json:"auditor_ids"`
}

// TemuanRow (Helper struct for basic queries)
type TemuanRow struct {
	PelaksanaanID     int            `json:"pelaksanaan_id"`
	ItemID            int            `json:"item_id"`
	Status            string         `json:"status"`
	Deskripsi         string         `json:"deskripsi"`
	Lokasi            string         `json:"lokasi"`
	BuktiRaw          sql.NullString `json:"-"`
	Bukti             interface{}    `json:"bukti"`
	NoFTA             sql.NullString `json:"no_fta"`
	ItemChecklistText string         `json:"item_checklist_text"`
	ReferensiDoc      *string        `json:"referensi_doc"`
	PicUserID         sql.NullInt64  `json:"pic_user_id"`
	KategoriTemuan    sql.NullString `json:"kategori_temuan"`
	DataIntegrity     sql.NullString `json:"data_integrity"`
	Prinsip5R         sql.NullString `json:"prinsip_5r"`
}

// AuditLog GORM Model (dari file audit_log.go sebelumnya, disatukan agar tidak duplicate)
type AuditLog struct {
	ID         string         `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	UserID     string         `gorm:"type:uuid;not null" json:"user_id"`
	Action     string         `gorm:"type:varchar(50);not null" json:"action"`
	EntityName string         `gorm:"type:varchar(100);not null" json:"entity_name"`
	EntityID   string         `gorm:"type:varchar(100);not null" json:"entity_id"`
	OldValues  datatypes.JSON `gorm:"type:jsonb" json:"old_values"`
	NewValues  datatypes.JSON `gorm:"type:jsonb" json:"new_values"`
	IPAddress  string         `gorm:"type:varchar(45)" json:"ip_address"`
	UserAgent  string         `gorm:"type:text" json:"user_agent"`
	CreatedAt  time.Time      `json:"created_at"`
}

type VerifMasterData struct {
	PelaksanaanID   uint      `json:"id"`
	TanggalAudit    time.Time `json:"tanggal"`
	NamaSite        string    `json:"site"`
	NamaArea        string    `json:"area"`
	NamaJenisAudit  string    `json:"jenis_audit"`
	NamaAuditor     string    `json:"auditor"`
	StatusLaporan   string    `json:"status"`
	JumlahTemuanNOK int       `json:"jml_temuan"`
	NoFTA           *string   `json:"no_fta"`
}
type AuditProgressSummary struct {
	TotalItems   int    `json:"total_items"`
	NeedAction   int    `json:"need_action"`   // Item yang harus dikerjakan user saat ini (Merah)
	WaitingOther int    `json:"waiting_other"` // Item di meja orang lain (Kuning)
	Completed    int    `json:"completed"`     // Item selesai (Hijau)
	StatusLabel  string `json:"status_label"`  // Label header
}

type FullEvidenceComparison struct {
	TemuanID int `json:"temuan_id"`
	ItemID   int `json:"item_id"`

	// Info Item
	ItemChecklistText string `json:"item_checklist_text"`
	DeskripsiTemuan   string `json:"deskripsi_temuan"`
	LokasiTemuan      string `json:"lokasi_temuan"`
	KategoriTemuan    string `json:"kategori_temuan"`
	PicName           string `json:"pic_name"`

	// CAPA Info
	RootCause        string `json:"root_cause"`
	CorrectiveAction string `json:"corrective_action"`
	DueDate          string `json:"due_date"`

	// Bukti & Verifikasi
	BuktiTemuanAwal   interface{} `json:"bukti_temuan_awal"`
	BuktiPerbaikan    interface{} `json:"bukti_perbaikan"`
	CatatanPerbaikan  string      `json:"catatan_perbaikan"`
	BuktiVerifikasi   interface{} `json:"bukti_verifikasi"`
	CatatanVerifikasi string      `json:"catatan_verifikasi_bukti"`
	StatusVerifikasi  string      `json:"status_verifikasi"`

	// Metadata Tanggal (Pointer agar bisa null)
	TglUploadBukti *string `json:"tgl_upload_bukti"`
	TglVerifikasi  *string `json:"tgl_verifikasi"`
}

type EvidenceDetailResponse struct {
	Summary AuditProgressSummary     `json:"summary"`
	Items   []FullEvidenceComparison `json:"items"`
}
