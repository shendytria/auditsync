// utils/statusHelper.ts
import { AuditStatus } from "@/types/audit";

// 1. MENDAPATKAN WARNA BADGE (Sesuai Tailwind Config Anda)
export const getStatusColor = (status: string): string => {
  const s = status ? status.toUpperCase() : "";

  switch (s) {
    // --- STATUS BIRU (Open / Draft) ---
    // Menggunakan warna custom 'biru' dengan opacity rendah untuk background
    case AuditStatus.EXEC_OPEN:
    case AuditStatus.RPT_OPEN:
    case "OPEN":
      return 'bg-biru/10 text-biru border-biru/20';
      
    // --- STATUS KUNING/ORANGE (Progress) ---
    // Menggunakan default Tailwind orange/yellow karena belum ada custom yellow
    case AuditStatus.EXEC_PROGRESS:
    case AuditStatus.RPT_PROGRESS:
    case AuditStatus.CAPA_IN_PROGRESS:
    case AuditStatus.EVIDENCE_IN_PROGRESS:
    case "IN PROGRESS":
      return 'bg-hijau/10 text-hijau border-hijau/20';

    // --- STATUS UNGU/BIRU TUA (Waiting Approval) ---
    // Menggunakan 'biru' untuk branding yang konsisten saat menunggu
    case AuditStatus.QS_REVIEW_OPEN:
    case AuditStatus.CAPA_OPEN:
    case AuditStatus.WAITING_QS_SPV:
    case AuditStatus.WAITING_MGR_AREA:
    case AuditStatus.WAITING_MGR_QS:
    case AuditStatus.EVIDENCE_VERIFICATION:
    case "SUBMITTED":
      return 'bg-biru/20 text-biru border-biru/30 font-semibold';

    // --- STATUS MERAH (Reject / Revisi) ---
    // Menggunakan default Tailwind red (Universal Error Color)
    case AuditStatus.RPT_REJECTED_PIC:
    case AuditStatus.QS_REJECTED_MGR:
    case AuditStatus.CAPA_REJECTED_QSSPV:
    case AuditStatus.EVIDENCE_REVISION:
    case "REVISION":
    case "REJECTED":
      return 'bg-red-100 text-red-700 border-red-200';

    // --- STATUS HIJAU (Selesai / Approved) ---
    // Menggunakan warna custom 'hijau'
    case AuditStatus.READY_FOR_CAPA: 
    case AuditStatus.FINAL_CLOSING:
    case AuditStatus.CLOSED:
    case "CLOSED":
      return 'bg-hijau/10 text-hijau border-hijau/20';

    // Default (Abu-abu custom)
    default:
      return 'bg-grey/10 text-grey border-grey/20';
  }
};

// 2. MENDAPATKAN LABEL MANUSIA
export const getStatusLabel = (status: string): string => {
    if (!status) return "-";
    
    const map: Record<string, string> = {
        // Auditor
        [AuditStatus.EXEC_OPEN]: 'Open (Draft)',
        [AuditStatus.EXEC_PROGRESS]: 'In Progress',
        [AuditStatus.RPT_REJECTED_PIC]: 'Revisi (Ditolak PIC/QS)',

        // QS Review
        [AuditStatus.QS_REVIEW_OPEN]: 'Menunggu Review QS',
        [AuditStatus.QS_REJECTED_MGR]: 'Revisi (Ditolak Manager)',

        // CAPA
        [AuditStatus.CAPA_OPEN]: 'Open CAPA (Belum Dimulai)',
        [AuditStatus.CAPA_IN_PROGRESS]: 'Pengerjaan CAPA',
        [AuditStatus.CAPA_REJECTED_QSSPV]: 'Revisi CAPA (Ditolak QS SPV)',

        // Approval Berjenjang
        [AuditStatus.WAITING_QS_SPV]: 'Approval: Menunggu QS SPV',
        [AuditStatus.WAITING_MGR_AREA]: 'Approval: Menunggu Manager Area',
        [AuditStatus.WAITING_MGR_QS]: 'Approval: Menunggu QS Manager',

        // Evidence
        [AuditStatus.READY_FOR_CAPA]: 'Approved (Siap Upload Bukti)',
        [AuditStatus.EVIDENCE_IN_PROGRESS]: 'Upload Bukti Berjalan',
        [AuditStatus.EVIDENCE_VERIFICATION]: 'Verifikasi Bukti (Verifikator)',
        [AuditStatus.EVIDENCE_REVISION]: 'Revisi Bukti (Ditolak)',
        
        // Final
        [AuditStatus.FINAL_CLOSING]: 'Final Closing (Admin)',
        [AuditStatus.CLOSED]: 'CLOSED (Selesai)'
    };

    return map[status] || status.replace(/_/g, ' ');
};