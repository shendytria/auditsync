// types/audit.ts

// ==========================================
// 1. ENUM STATUS
// ==========================================
export enum AuditStatus {
  // Modul 1: Pelaksanaan Audit (Auditor)
  EXEC_OPEN = "EXEC_OPEN",
  EXEC_PROGRESS = "EXEC_PROGRESS",
  RPT_OPEN = "RPT_OPEN",
  RPT_PROGRESS = "RPT_PROGRESS",
  RPT_REJECTED_PIC = "RPT_REJECTED_PIC", // Revisi: Dikembalikan oleh PIC/QS

  // Modul 2: Review QS Supervisor
  QS_REVIEW_OPEN = "QS_REVIEW_OPEN",
  QS_REJECTED_MGR = "QS_REJECTED_MGR", // Revisi: Dikembalikan oleh Manager Area

  // Modul 3: Tindak Lanjut CAPA (PIC Area)
  CAPA_OPEN = "CAPA_OPEN",
  CAPA_IN_PROGRESS = "CAPA_IN_PROGRESS",
  CAPA_REJECTED_QSSPV = "CAPA_REJECTED_QSSPV", // Revisi: Ditolak QS SPV (Final Approve)

  // Modul 4: Approval Berjenjang (Ular Tangga)
  WAITING_QS_SPV = "WAITING_QS_SPV",   // Cek 1
  WAITING_MGR_AREA = "WAITING_MGR_AREA", // Cek 2
  WAITING_MGR_QS = "WAITING_MGR_QS",   // Cek 3

  // Modul 5: Evidence & Verifikasi
  READY_FOR_CAPA = "READY_FOR_CAPA",        // Lulus Approval -> Siap Upload Bukti
  EVIDENCE_IN_PROGRESS = "EVIDENCE_IN_PROGRESS",
  EVIDENCE_VERIFICATION = "EVIDENCE_VERIFICATION",
  EVIDENCE_REVISION = "EVIDENCE_REVISION",  // Bukti ditolak Verifikator

  // [PENTING] Dua Jenis Rejection Evidence
  EVIDENCE_REJECTED_AUDITOR = "EVIDENCE_REJECTED_AUDITOR", // Ditolak di Modul Verifikasi
  EVIDENCE_REJECTED_QSSPV = "EVIDENCE_REJECTED_QSSPV",     // Ditolak di Modul Final Verifikasi

  // Final
  FINAL_CLOSING = "FINAL_CLOSING",
  CLOSED = "CLOSED"
}

// ==========================================
// 2. DATA HEADER AUDIT
//Info Utama di Atas Halaman Detail
// ==========================================
export interface AuditHeaderInfo {
    pelaksanaan_id: number;
    laporan_id?: number; // Alias untuk backward compatibility
    tanggal_audit: string;
    nama_checklist: string;
    nama_area: string;
    nama_department: string;
    nama_jenis_audit: string;
    nama_auditor: string;
    checklist_id: number;
    status_laporan: string; 
    
    // Info Tambahan (Optional)
    no_fta?: string;
    nama_site?: string;
    note_reject?: string;
    
    // Nama-nama Approver (Untuk Footer/History)
    nama_qs_spv?: string;
    nama_mgr_area?: string;
    nama_mgr_qs?: string;
    nama_pic_capa?: string; // Supervisor Area
}

// ==========================================
// 3. ITEM CHECKLIST & TEMUAN (Modul Pelaksanaan)
// ==========================================
export interface AuditCheckItem {
    item_id: number | string; 
    item_checklist_text: string;
    referensi_doc: string | null;
    kategori: string | null;
    sub_kategori: string | null;
    
    // Status & Isian
    status: 'OK' | 'NOK' | 'N/A' | null;
    deskripsi_temuan: string | null;
    lokasi_temuan: string | null;
    bukti_temuan: string | null; // JSON String dari Backend
    
    // Flag untuk Frontend Logic
    isNew?: boolean; 
}

// ==========================================
// 4. PAYLOAD & UTILS (Submit Final)
// ==========================================
export interface ApproverSelection {
  qs_spv_id: number;      // ID User QS SPV
  pic_capa_ids: number[]; // Array ID Supervisor Area (Backend minta array)
  mgr_area_id: number;    // ID User Manager Area
  mgr_qs_id: number;      // ID User QS Manager
}

export interface UserOption {
  id: number;
  name: string;
  role: string;
  email?: string;
}

// ==========================================
// 5. LOCAL STATE (Page Auditor)
// ==========================================
export interface LocalAnswerState {
    status: 'OK' | 'NOK' | 'N/A' | null;
    deskripsi_temuan: string;
    lokasi_temuan: string;
    files: File[];          // File baru yang akan diupload
    existingFiles: string[]; // Path file lama dari DB
}

export type ChecklistItemWithAnswer = AuditCheckItem & {
    answer: LocalAnswerState;
};

// ==========================================
// 6. [BARU] RESPONSE EVIDENCE & VERIFICATION
// Digunakan untuk response baru { summary: ..., items: ... }
// ==========================================

// Interface untuk Ringkasan Progress per FTA
export interface AuditProgressSummary {
    total_items: number;
    need_action: number;    // Merah (Tugas Saya)
    waiting_other: number;  // Kuning (Menunggu Pihak Lain)
    completed: number;      // Hijau (Selesai)
    status_label: string;   // Label header
}

// Interface Detail Item untuk Modul Evidence/Verifikasi
export interface EvidenceItem {
    temuan_id: number;
    item_id: number;
    
    // Info Item Check
    item_checklist_text: string;
    deskripsi_temuan: string;
    lokasi_temuan: string;
    kategori_temuan: string;
    pic_name: string;

    // CAPA Info
    root_cause: string;
    corrective_action: string;
    due_date: string;

    // Bukti & Verifikasi
    bukti_temuan_awal: string[] | null; 
    bukti_perbaikan: string[] | null;
    catatan_perbaikan: string;
    
    bukti_verifikasi: string[] | null;
    catatan_verifikasi_bukti: string; // Catatan reject/verifikasi
    status_verifikasi: string; // 'WAITING', 'APPROVED', 'REJECTED', 'REVISION'

    // Metadata Tanggal
    tgl_upload_bukti?: string;
    tgl_verifikasi?: string;

    // Field tambahan untuk fleksibilitas (jika ada field lain dari join)
    [key: string]: any;
}

// Wrapper Response API Detailed Evidence
export interface EvidenceDetailResponse {
    summary: AuditProgressSummary;
    items: EvidenceItem[]; 
    // Jika backend mengirim 'master' info di level ini juga:
    master?: AuditHeaderInfo;
}