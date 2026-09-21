'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Toaster, toast } from 'react-hot-toast'
import { 
    ArrowLeft, CheckCircle, XCircle, 
    ChevronDown, ChevronUp, Paperclip, 
    ShieldCheck, Calendar, AlertCircle, Check, X, Clock, Send, UserCheck, Briefcase
} from 'lucide-react'
import Link from 'next/link'
import { fetchWithAuth } from '@/utils/api'
import { AuditHeaderInfo, AuditCheckItem } from '@/types/audit'
import { getStatusColor, getStatusLabel } from '@/utils/statusHelper'

interface ApprovalHistory {
    role: string
    name: string
    date?: string
    status: 'APPROVED' | 'PENDING' | 'REJECTED'
}

interface FinalVerifItem extends Omit<AuditCheckItem, 'bukti_temuan' | 'item_id'> { 
    bukti_temuan: string[] | null
    id?: number | string
    item_id?: number | string 
    temuan_id?: number | string 
    pic_name?: string | null
    pic_user_id?: number | string | null 
    
    capa?: {
        root_cause: string
        corrective_action: string
        due_date: string
    }
    
    // Perbaikan (PIC)
    bukti_perbaikan?: string[] | null
    catatan_perbaikan?: string | null
    tgl_upload_bukti?: string | null
    
    // Verifikasi (Auditor)
    bukti_verifikasi?: string[] | null
    catatan_verifikasi?: string | null
    tgl_verifikasi?: string | null
    status_verifikasi_auditor?: string | null
    
    justification?: 'Temuan' | 'Observasi' | null
    kategori_temuan?: string | null
    data_integrity?: string | null
    prinsip_5r?: string | null

    // Final Approval (QS SPV)
    hasil_verifikasi?: string | null 
    catatan_verifikasi_bukti?: string | null 
    status_evidence?: string | null;
}

interface LaporanDetailWithApproval extends AuditHeaderInfo {
    tgl_submit_capa?: string
}

/* --- COMPONENTS (Helpers) --- */
const AuditHeader = ({ info, totalItems }: { info: Partial<AuditHeaderInfo>; totalItems: number }) => {
    const parse = (v: any) => (v == null || v === '' || v === '-' ? '-' : String(v))
    const formatDateLong = (raw?: string) => {
        if (!raw || raw === '0001-01-01T00:00:00Z') return '-'
        const d = new Date(raw)
        return isNaN(d.getTime()) ? '-' : new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }).format(d)
    }
    return (
      <div className="bg-putih p-6 rounded-lg shadow-md mb-6 font-arial border border-grey/30">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
          <div><p className="text-sm font-medium text-grey">NO FTA</p><p className="text-lg font-bold text-hitam">{parse(info.no_fta)}</p></div>
          <div><p className="text-sm font-medium text-grey">Jenis Audit</p><p className="text-lg font-bold text-hitam">{parse(info.nama_jenis_audit)}</p></div>
          <div><p className="text-sm font-medium text-grey">Auditor</p><p className="text-lg font-bold text-hitam">{parse(info.nama_auditor)}</p></div>
          <div><p className="text-sm font-medium text-grey">Site / Area</p><p className="text-lg font-bold text-hitam">{parse(info.nama_site)} - {parse(info.nama_area)}</p></div>
          <div><p className="text-sm font-medium text-grey">Tgl Pelaksanaan</p><p className="text-lg font-bold text-hitam">{formatDateLong(info.tanggal_audit)}</p></div>
          <div><p className="text-sm font-medium text-grey">Total Temuan</p><p className="text-lg font-bold text-biru">{totalItems}</p></div>
          
          <div>
            <p className="text-sm font-medium text-grey">Status</p>
            <span className={`inline-block px-2 py-1 rounded text-xs font-bold mt-1 ${getStatusColor(info.status_laporan || '')}`}>
                {getStatusLabel(info.status_laporan || '')}
            </span>
          </div>
        </div>
      </div>
    )
}

const FileDisplay = ({ filePath, label }: { filePath: string, label?: string }) => {
    if (!filePath || filePath === '-') return <span>-</span>
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || ''
    let normalizedPath = String(filePath).replace(/\\/g, '/')
    if (normalizedPath.startsWith('/')) normalizedPath = normalizedPath.substring(1)
    
    const fullUrl = `${API_BASE}/${normalizedPath}`
    const fileName = normalizedPath.split('/').pop() || 'File'

    return (
        <a href={fullUrl} target="_blank" rel="noopener noreferrer" className="flex items-center p-1.5 bg-putih rounded border border-grey/40 hover:bg-biru/5 hover:border-biru hover:text-biru transition-colors text-xs text-grey max-w-fit mb-1 group" title={fileName}>
            <Paperclip className="h-3 w-3 mr-1.5 group-hover:text-current" /> 
            <span className="truncate max-w-[150px]">{fileName}</span>
            {label && <span className={`ml-1 text-[9px] px-1 rounded border ${label === 'Verif' ? 'bg-grey/10 text-grey border-grey/30' : 'bg-hijau/10 text-hijau border-hijau/30'}`}>{label}</span>}
        </a>
    )
}

// Modal Reject
const RejectModal = ({ isOpen, onClose, onConfirm }: { isOpen: boolean; onClose: () => void; onConfirm: (reason: string) => void; }) => {
    const [reason, setReason] = useState('')
    if (!isOpen) return null
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!reason.trim()) return toast.error("Alasan reject wajib diisi!")
        onConfirm(reason)
        setReason('')
    }

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-hitam/60 p-4 font-arial backdrop-blur-sm">
            <div className="bg-putih w-full max-w-md p-6 rounded-xl shadow-2xl border-t-4 border-red-500 animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="text-lg font-bold text-hitam flex items-center"><XCircle className="w-6 h-6 text-red-500 mr-2"/> Reject Item</h4>
                    <button onClick={onClose}><X className="w-6 h-6 text-grey hover:text-hitam" /></button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-sm font-bold text-grey mb-2">Alasan Penolakan</label>
                        <textarea 
                            className="w-full p-3 border border-grey/30 rounded-lg text-sm focus:ring-2 focus:ring-red-200 outline-none text-hitam"
                            rows={3}
                            placeholder="Tulis alasan kenapa item ini ditolak..."
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            autoFocus
                        />
                        <p className="text-xs text-red-500 mt-2 font-medium bg-red-50 p-2 rounded border border-red-100">
                            *Peringatan: Item ini akan dikembalikan ke PIC untuk perbaikan ulang.
                        </p>
                    </div>
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-putih border border-grey/30 text-grey rounded hover:bg-grey/10 transition-colors font-medium text-sm">Batal</button>
                        <button type="submit" className="px-6 py-2 bg-black text-white rounded font-bold hover:bg-gray-800 transition-colors shadow-md text-sm">Submit Reject</button>
                    </div>
                </form>
            </div>
        </div>
    )
}

// Modal Konfirmasi Final (Close / Return)
const ConfirmSubmitModal = ({ isOpen, onClose, onConfirm, type }: { isOpen: boolean; onClose: () => void; onConfirm: () => void; type: 'APPROVE' | 'REJECT' }) => {
    if (!isOpen) return null
    
    const isApprove = type === 'APPROVE';
    
    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-hitam/60 p-4 font-arial backdrop-blur-sm">
            <div className={`bg-putih w-full max-w-md p-6 rounded-xl shadow-2xl border-t-4 ${isApprove ? 'border-biru' : 'border-red-500'} animate-in fade-in zoom-in duration-200`}>
                <div className="flex justify-between items-center mb-4">
                    <h4 className="text-lg font-bold text-hitam flex items-center">
                        {isApprove ? <ShieldCheck className="w-6 h-6 text-biru mr-2"/> : <AlertCircle className="w-6 h-6 text-red-500 mr-2"/>}
                        {isApprove ? 'Close Audit' : 'Return to PIC'}
                    </h4>
                    <button onClick={onClose}><X className="w-6 h-6 text-grey hover:text-hitam transition-colors" /></button>
                </div>
                <div className={`flex items-start gap-3 mb-6 p-3 rounded-lg border ${isApprove ? 'bg-biru/10 border-biru/20' : 'bg-red-50 border-red-100'}`}>
                    <AlertCircle className={`w-6 h-6 mt-0.5 flex-shrink-0 ${isApprove ? 'text-biru' : 'text-red-500'}`} />
                    <p className="text-sm text-hitam">
                        {isApprove 
                            ? "Apakah anda yakin ingin menutup (CLOSE) audit ini? Pastikan semua temuan telah selesai. Status akan berubah menjadi CLOSED."
                            : "Terdapat item yang ditolak (REJECTED). Laporan akan dikembalikan ke PIC untuk perbaikan ulang. Lanjutkan?"
                        }
                    </p>
                </div>
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 bg-putih border border-grey/30 text-grey rounded hover:bg-grey/10 transition-colors font-medium text-sm">Batal</button>
                    <button onClick={onConfirm} className={`px-6 py-2 rounded font-bold hover:opacity-90 transition-colors shadow-md flex items-center text-sm text-white ${isApprove ? 'bg-biru' : 'bg-red-600'}`}>
                        {isApprove ? <><Check className="w-4 h-4 mr-2"/> Ya, Close Audit</> : <><Send className="w-4 h-4 mr-2"/> Ya, Return to PIC</>}
                    </button>
                </div>
            </div>
        </div>
    )
}

const ApproveConfirmationModal = ({ isOpen, onClose, onConfirm }: { isOpen: boolean; onClose: () => void; onConfirm: () => void }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-hitam/50 p-4 font-arial backdrop-blur-sm">
            <div className="bg-putih w-full max-w-sm p-8 rounded-2xl shadow-2xl animate-in fade-in zoom-in duration-200 text-center border-t-[6px] border-[#8cc63f]">
                <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 bg-[#f4f9eb] rounded-full flex items-center justify-center border-2 border-[#8cc63f]/20">
                        <CheckCircle className="w-10 h-10 text-[#8cc63f]" />
                    </div>
                </div>
                
                <h3 className="text-xl font-bold text-hitam mb-3">Konfirmasi Approve</h3>
                <p className="text-sm text-grey leading-relaxed mb-10 px-2">
                    Apakah Anda yakin ingin menyetujui laporan ini?<br/>
                    Data akan diteruskan ke <span className="font-bold">PIC CAPA</span> untuk ditindaklanjuti.
                </p>

                <div className="flex gap-4">
                    <button onClick={onClose} className="flex-1 py-3 bg-[#f5f5f5] text-hitam rounded-xl font-bold hover:bg-grey/10 transition-colors shadow-sm">
                        Batal
                    </button>
                    <button onClick={onConfirm} className="flex-1 py-3 bg-[#8cc63f] text-white rounded-xl font-bold hover:opacity-90 shadow-md shadow-green-200 transition-all transform active:scale-95">
                        Ya, Setujui
                    </button>
                </div>
            </div>
        </div>
    );
};
/* ==========================================================================
   MAIN PAGE
   ========================================================================== */
export default function FinalVerifikasiPage() {
    const router = useRouter()
    const params = useParams() as any
    const finalId = params?.finalId || params?.id || ''
    
    // --- STATE ---
    const [isLoading, setIsLoading] = useState(true)
    const [detail, setDetail] = useState<LaporanDetailWithApproval | null>(null)
    const [items, setItems] = useState<FinalVerifItem[]>([])
    
    const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})
    const [isProcessing, setIsProcessing] = useState(false)
    const [isSaving, setIsSaving] = useState(false) 
    
    // Modal States
    const [rejectModalOpen, setRejectModalOpen] = useState(false)
    const [selectedRejectId, setSelectedRejectId] = useState<string | number | null>(null)
    const [approveModalOpen, setApproveModalOpen] = useState(false);
    const [pendingItem, setPendingItem] = useState<FinalVerifItem | null>(null);
    
    const [userList, setUserList] = useState<any[]>([]);

        // ===== ADD ROLE ACCESS STATE =====
        const [currentUser, setCurrentUser] = useState<any>(null)

        useEffect(() => {
            try {
                const user = localStorage.getItem('user_data')
                if (user) setCurrentUser(JSON.parse(user))
            } catch {}
        }, [])


    const isPatrolHSE = useMemo(() => {
        if (!detail?.nama_jenis_audit) return false;
        return detail.nama_jenis_audit.toLowerCase().includes("patrol hse");
    }, [detail?.nama_jenis_audit]);

    const normalize = (v: string) =>
        (v || '').toLowerCase().trim()

    const isQSSupervisor = useMemo(() => {
        if (!currentUser) return false
        const role = normalize(currentUser.role || currentUser.role_name || '')
        return role.includes('qs') && role.includes('supervisor')
    }, [currentUser])

    const isLocked = !isQSSupervisor


    /* --- DATA FETCHING --- */
    const fetchData = useCallback(async () => {
        if (!finalId) return;
        try {
            const res = await fetchWithAuth(`/api/audit/laporan-temuan/detailed/${finalId}?mode=final`, { cache: 'no-store' })
            if (!res.ok) throw new Error("Gagal load data")
            
            const json = await res.json()
            const m = json.data.master
            const t = json.data.temuan || []
            
            setDetail(m)

            const mappedItems = t.map((it: any) => {
                let existingFiles: string[] = []
                let evidenceFiles: string[] = []
                let verificationFiles: string[] = []
                try {
                    if (it.bukti_temuan) { const val = String(it.bukti_temuan).trim(); if(val.startsWith('[')) existingFiles = JSON.parse(val); else existingFiles = [val] }
                    if (it.bukti_perbaikan) { if (Array.isArray(it.bukti_perbaikan)) evidenceFiles = it.bukti_perbaikan; else { const val = String(it.bukti_perbaikan).trim(); if(val.startsWith('[')) evidenceFiles = JSON.parse(val); else if(val !== '' && val !== 'null') evidenceFiles = [val] } }
                    if (it.bukti_verifikasi) { if (Array.isArray(it.bukti_verifikasi)) verificationFiles = it.bukti_verifikasi; else { const val = String(it.bukti_verifikasi).trim(); if(val.startsWith('[')) verificationFiles = JSON.parse(val); else if(val !== '' && val !== 'null') verificationFiles = [val] } }
                } catch { existingFiles = [] }

                const itemData: FinalVerifItem = {
                    item_id: it.item_id, 
                    temuan_id: it.temuan_id || it.id, 
                    id: it.temuan_id || it.id,
                    
                    item_checklist_text: it.item_checklist_text,
                    deskripsi_temuan: it.deskripsi_temuan,
                    lokasi_temuan: it.lokasi_temuan,
                    kategori_temuan: it.kategori_temuan,
                    kategori: it.kategori || 'Lain-lain',
                    sub_kategori: it.sub_kategori || 'Umum',
                    data_integrity: it.data_integrity || '-',
                    prinsip_5r: it.prinsip_5r || '-',
                    referensi_doc: it.referensi_doc,
                    bukti_temuan: existingFiles,
                    
                    // --- CAPA & PERBAIKAN ---
                    bukti_perbaikan: evidenceFiles, 
                    catatan_perbaikan: it.catatan_perbaikan || null,
                    tgl_upload_bukti: it.tgl_upload_bukti || null, 
                    
                    // --- VERIFIKASI AUDITOR ---
                    bukti_verifikasi: verificationFiles,
                    catatan_verifikasi: it.catatan_verifikasi || null,
                    tgl_verifikasi: it.tgl_verifikasi || null, 
                    status_verifikasi_auditor: it.status_verifikasi_auditor || it.status_verifikasi || '-',
                    status_evidence: it.status_evidence,
                    hasil_verifikasi: it.hasil_verifikasi || null, 
                    catatan_verifikasi_bukti: it.catatan_verifikasi_bukti,
                    
                    status: 'NOK', 
                    pic_user_id: it.pic_user_id,
                    pic_name: it.pic_name || null,
                    justification: it.justification || 'Temuan',

                    capa: {
                        root_cause: it.root_cause || '-',
                        corrective_action: it.corrective_action || '-',
                        due_date: it.due_date ? it.due_date.split('T')[0] : ''
                    }
                }
                return itemData
            })
            setItems(mappedItems)

        } catch (e) { console.error(e); toast.error("Gagal mengambil detail laporan") } 
        finally { setIsLoading(false) }
    }, [finalId])

    useEffect(() => {
        if (!finalId) return;
        const fetchUsers = async () => {
          try {
            const res = await fetchWithAuth(`/api/users`, { cache: 'no-store' })
            if (res.ok) { 
                const json = await res.json(); 
                const rawUsers = Array.isArray(json) ? json : (json.data || json.users || []);
                const allUsers = rawUsers.map((u: any) => ({
                    id: String(u.id || u.user_id), 
                    name: u.name || u.nama_lengkap || u.username || u.email || 'No Name',
                }));
                setUserList(allUsers);
            }
          } catch (error) { console.error('Gagal load users', error) }
        }
        fetchUsers()
        fetchData()
    }, [finalId, fetchData]);

    const getPicName = (item: FinalVerifItem) => {
        if (item.pic_name && item.pic_name !== '-') return item.pic_name;
        const id = item.pic_user_id;
        if (id) {
            const user = userList.find((u) => String(u.id) === String(id));
            if (user) return user.name;
        }
        return '-';
    }

    const formatDateShort = (str?: string | null) => {
        if(!str || str === 'null' || str === '' || str.startsWith('0001')) return '-'
        const d = new Date(str)
        return isNaN(d.getTime()) ? str : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    }

    const groupedItems = useMemo(() => {
        const groups = new Map<string, Map<string, FinalVerifItem[]>>()
        items.forEach(item => {
            const kategori = item.kategori || 'Lain-lain'
            const sub = item.sub_kategori || 'Umum'
            if (!groups.has(kategori)) groups.set(kategori, new Map())
            const subMap = groups.get(kategori)!
            if (!subMap.has(sub)) subMap.set(sub, [])
            subMap.get(sub)!.push(item)
        })
        return groups
    }, [items])

    const toggleRow = (id: string | number) => setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }))

    const handleApproveItem = async (item: FinalVerifItem) => {
    const cleanId = String(item.item_id);
    setIsSaving(true); 
    const toastId = toast.loading("Sedang memproses approval...");
    
    try {
        const res = await fetchWithAuth(`/api/audit/${finalId}/item/${cleanId}/final-approve`, { 
            method: 'POST'
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || 'Gagal approve final');
        }

        // [FIX LOGIC] Update HANYA satu item yang cocok dengan ID
        // Dan pastikan state lokal sinkron dengan status CLOSED
        setItems(prev => prev.map(it => 
            String(it.item_id) === cleanId 
            ? { ...it, hasil_verifikasi: 'APPROVED', status_verifikasi_auditor: 'APPROVED' } 
            : it
        ));
        
        toast.success('Item Berhasil Disetujui!', { id: toastId });
        
        // Refresh data dari server agar statistik di footer terupdate akurat
        fetchData(); 

    } catch (e: any) {
        toast.error(e.message, { id: toastId });
    } finally { 
        setIsSaving(false);
    }
}

    const openRejectModal = (id: string | number) => {
        setSelectedRejectId(id)
        setRejectModalOpen(true)
    }

    const handleRejectConfirm = async (reason: string) => {
    if (!selectedRejectId) return;
    
    // [FIX 500] Pastikan itemId murni angka, hapus ":" jika terbawa dari params
    const itemId = String(selectedRejectId).replace(':', '').trim(); 
    const executionId = String(finalId).replace(':', '').trim();

    setRejectModalOpen(false);
    setIsSaving(true);
    const toastId = toast.loading("Mengirim alasan penolakan...");
    
    try {
        const res = await fetchWithAuth(`/api/audit/${executionId}/item/${itemId}/final-reject`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: reason }) 
        });
        
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || 'Gagal reject item (Server Error)');
        }

        // Update state lokal secara spesifik
        setItems(prev => prev.map(it => 
            String(it.item_id) === itemId 
            ? { ...it, hasil_verifikasi: 'REJECTED', status_evidence: 'EVIDENCE_REJECTED_QSSPV', catatan_verifikasi_bukti: reason } 
            : it
        ));

        toast.success('Item dikembalikan ke PIC!', { id: toastId });
        await fetchData(); // Sinkronisasi ulang data terbaru
    } catch (e: any) {
        console.error("Reject Error Detail:", e);
        toast.error(`Gagal: ${e.message}`, { id: toastId });
    } finally {
        setIsSaving(false);
        setSelectedRejectId(null);
    }
}

    const handleConfirmApprove = async () => {
    if (pendingItem) {
        // 1. Jalankan proses approve untuk item tersebut
        await handleApproveItem(pendingItem); 
        
        // 2. Tutup modal konfirmasi
        setApproveModalOpen(false);
        setPendingItem(null);

        // 3. Jeda 1 detik agar database backend selesai melakukan UPDATE & COMMIT
        setTimeout(async () => {
            try {
                // Ambil data terbaru langsung dari server
                const res = await fetchWithAuth(`/api/audit/laporan-temuan/detailed/${finalId}?mode=final`);
                if (!res.ok) return;
                
                const json = await res.json();
                // Pastikan mengambil array temuan yang benar dari response
                const latestTemuan = json.data.temuan || [];
                
                // [CRITICAL FIX] Hitung item yang BENAR-BENAR masih butuh tindakan Supervisor
                // Laporan TIDAK BOLEH ditutup jika masih ada item dengan status 'FINAL_CLOSING'
                const stillNeedsAction = latestTemuan.filter((t: any) => 
                    String(t.status_evidence).toUpperCase() === 'FINAL_CLOSING'
                );

                console.log("Sisa item yang butuh action SPV:", stillNeedsAction.length);

                if (stillNeedsAction.length === 0) {
                    // JIKA SUDAH NOL: Baru redirect ke Masterlist
                    toast.success("Seluruh item telah divalidasi. Menutup laporan...");
                    setTimeout(() => {
                        router.push('/verifikasi/final-verifikasi');
                    }, 1000);
                } else {
                    // JIKA MASIH ADA: Segarkan tampilan tabel saja
                    toast.success("Item disetujui. Selesaikan sisa item lainnya.");
                    await fetchData(); 
                }
            } catch (error) {
                console.error("Gagal verifikasi sisa item:", error);
                await fetchData();
            }
        }, 1000); 
    }
};

    const openApproveModal = (item: FinalVerifItem) => {
    setPendingItem(item);
    setApproveModalOpen(true);
    };

    const auditDecision = useMemo(() => {
        if (!items || items.length === 0) return { show: false, type: 'APPROVE' };
        
        const allDecided = items.every(it => {
            if (it.justification === 'Observasi') return true; 
            const status = String(it.hasil_verifikasi || '').toUpperCase().trim();
            return ['APPROVED', 'REJECTED', 'REVISION'].includes(status);
        });

        const hasRejectedItem = items.some(it => {
            const status = String(it.hasil_verifikasi || '').toUpperCase().trim();
            return status === 'REJECTED' || status === 'REVISION';
        });

        return {
            show: allDecided, 
            type: hasRejectedItem ? 'REJECT' : 'APPROVE' 
        };
    }, [items]);

    if (isLoading) return <div className="p-12 text-center text-grey">Memuat data...</div>
    if (!detail) return <div className="p-12 text-center text-red-500">Data tidak ditemukan.</div>

    return (
        <div className="font-arial pb-64 bg-putih min-h-screen">
            <Toaster position="top-center"/>
            <div className="px-2 mt-4">
                 <Link href="/verifikasi/final-verifikasi" className="flex items-center text-sm text-biru hover:underline mb-4 font-medium">
                    <ArrowLeft className="w-4 h-4 mr-1" /> Kembali ke Daftar Final
                </Link>
            </div>

            {detail && <AuditHeader info={detail} totalItems={items.length} />}

            {isLocked && (
                <div className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-700">
                    Mode <b>Read Only</b>. Hanya QS Supervisor yang dapat melakukan Final Verifikasi.
                </div>
            )}

            <div className="bg-putih p-6 rounded-lg shadow-md mb-8 border border-grey/30">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-3">
                        <h3 className="text-xl font-bold text-hitam">Final Verifikasi (QS Supervisor)</h3>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-grey/30 border-x border-grey/30">
                        {/* TABLE HEADER */}
                        <thead className="bg-grey/10">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-bold text-grey uppercase w-10">No.</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase w-48">Check Item</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase w-24">Ref Doc</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase w-64">Deskripsi Temuan</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase">Bukti Temuan</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase">Lokasi</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase">PIC</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase">Kategori</th>
                                <th className="px-6 py-3 text-center text-xs font-bold text-grey uppercase min-w-[100px]">Justifikasi</th>
                                <th className="px-6 py-3 text-center text-xs font-bold text-grey uppercase w-10">Detail</th>
                                <th className="px-6 py-3 text-center text-xs font-bold text-grey uppercase w-28">Action</th>
                            </tr>
                        </thead>
                        <tbody className="bg-putih divide-y divide-grey/30">
                            {Array.from(groupedItems.entries()).map(([kategori, subGroups]) => (
                                <React.Fragment key={kategori}>
                                    <tr className="bg-biru/5">
                                        <td colSpan={isPatrolHSE ? 10 : 12} className="px-4 py-3 text-sm font-bold text-biru uppercase tracking-wide">{kategori}</td>
                                    </tr>
                                    {Array.from(subGroups.entries()).map(([sub, items]) => (
                                        <React.Fragment key={sub}>
                                            {items.map((item, idx) => {
                                                const rowId = String(item.temuan_id ?? item.id)
                                                const isExpanded = expandedRows[rowId]
                                                const filesTemuan = Array.isArray(item.bukti_temuan) ? item.bukti_temuan : []
                                                const justificationText = item.justification || '-';
                                                let justifikasiClass = "text-grey italic";
                                                if (justificationText === 'Temuan') justifikasiClass = "text-biru font-bold not-italic";
                                                else if (justificationText === 'Observasi') justifikasiClass = "text-hijau font-bold not-italic";
                                                const status = String(item.hasil_verifikasi || '').toUpperCase().trim();
                                                const isApproved = status === 'APPROVED';
                                                const isRejected = status === 'REJECTED' || status === 'REVISION';

                                                return (
                                                    <React.Fragment key={rowId}>
                                                        <tr className={`transition-colors ${isApproved ? 'bg-hijau/5' : isRejected ? 'bg-red-50' : 'hover:bg-grey/5'}`}>
                                                            <td className="px-4 py-4 text-sm text-hitam text-center font-medium align-top">{idx + 1}</td>
                                                            <td className="px-6 py-4 text-sm text-hitam leading-relaxed align-top font-semibold">{item.item_checklist_text}</td>
                                                            <td className="px-6 py-4 text-sm text-hitam align-top">{item.referensi_doc || '-'}</td>
                                                            <td className="px-6 py-4 text-sm text-hitam align-top">{item.deskripsi_temuan || '-'}</td>
                                                            <td className="px-6 py-4 text-sm text-hitam align-top"><div className="flex flex-col gap-1">{filesTemuan.length > 0 ? filesTemuan.map((f, i) => <FileDisplay key={i} filePath={f} />) : '-'}</div></td>
                                                            <td className="px-6 py-4 text-sm text-hitam align-top">{item.lokasi_temuan || '-'}</td>
                                                            <td className="px-6 py-4 text-sm text-biru font-semibold align-top">{getPicName(item)}</td>
                                                            <td className="px-6 py-4 text-sm text-hitam align-top"><span className="px-2 py-1 rounded text-xs font-bold bg-grey/10 border border-grey/20 text-hitam">{item.kategori_temuan || '-'}</span></td>
                                                            <td className="px-6 py-4 text-sm align-top"><span className={justifikasiClass}>{justificationText}</span></td>
                                                            <td className="px-6 py-4 text-center align-top"><button onClick={() => toggleRow(rowId)} className="p-2 bg-grey/10 rounded hover:bg-grey/20">{isExpanded ? <ChevronUp className="w-4 h-4 text-grey" /> : <ChevronDown className="w-4 h-4 text-grey" />}</button></td>
                                                            <td className="px-6 py-4 text-center align-top">
                                                            {item.status_evidence === 'CLOSED' ? (
                                                                <div className="flex flex-col items-center justify-center animate-in fade-in duration-300">
                                                                    <div className="px-3 py-[3px] rounded-md bg-hijau/15 border border-hijau/30 text-hijau text-[11px] font-semibold tracking-wide select-none uppercase">
                                                                        APPROVED
                                                                    </div>
                                                                </div>
                                                            ) : (item.status_evidence === 'EVIDENCE_REJECTED_QSSPV' || item.hasil_verifikasi === 'REJECTED') ? (
                                                                <div className="flex flex-col items-center animate-in fade-in duration-300">
                                                                    <div className="px-3 py-[3px] rounded-md bg-red-50 border border-red-200 text-red-600 text-[11px] font-bold uppercase tracking-wide select-none">
                                                                        REJECTED
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                /* Tombol Aksi muncul hanya jika item belum CLOSED atau REJECTED */
                                                                <div className="flex justify-center items-center gap-2">
                                                                    <button
                                                                        disabled={isSaving || isLocked}
                                                                        onClick={() => openApproveModal(item)}
                                                                        className="w-8 h-8 rounded border border-grey/30 bg-putih flex items-center justify-center text-grey hover:text-hijau hover:border-hijau hover:bg-hijau/10 transition-all shadow-sm group" 
                                                                        title="Approve Item"
                                                                    >
                                                                        <Check className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                                                    </button>
                                                                    <button
                                                                        disabled={isSaving || isLocked}
                                                                        onClick={() => openRejectModal(item.item_id ?? 0)}
                                                                        className="w-8 h-8 rounded border border-grey/30 bg-putih flex items-center justify-center text-grey hover:text-red-600 hover:border-red-500 hover:bg-red-50 transition-all shadow-sm group" 
                                                                        title="Reject Item"
                                                                    >
                                                                        <X className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </td>
                                                        </tr>
                                                        {isExpanded && (
                                                            <tr className="bg-grey/5">
                                                                <td colSpan={2}></td>
                                                                {/* Colspan dinamis berdasarkan jenis audit agar tabel tidak pecah */}
                                                                <td colSpan={isPatrolHSE ? 10 : 12} className="px-0 py-4">
                                                                    <div className="border border-grey/30 rounded-xl overflow-hidden mx-4 bg-putih shadow-lg relative">
                                                                        {/* Badge Header Detail */}
                                                                        <div className="absolute top-0 left-0 bg-biru text-putih text-[10px] px-3 py-1 rounded-br-lg font-bold uppercase tracking-wider z-10">
                                                                            Data Riwayat Perbaikan & Verifikasi
                                                                        </div>

                                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 text-sm mt-4 divide-x divide-grey/20">
                                                                            
                                                                            {/* KOLOM 1: INFORMASI CAPA */}
                                                                            <div className="p-5 space-y-4">
                                                                                <strong className="block text-grey text-[11px] uppercase tracking-widest mb-2 font-bold items-center">
                                                                                    <AlertCircle className="w-3.5 h-3.5 mr-1.5 text-biru"/> Informasi CAPA
                                                                                </strong>
                                                                                <div className="space-y-3">
                                                                                    <div className="bg-grey/5 p-2.5 rounded-lg border border-grey/10">
                                                                                        <span className="text-[10px] uppercase font-bold text-grey block mb-1">Root Cause</span>
                                                                                        <p className="text-hitam text-sm leading-relaxed">{item.capa?.root_cause || '-'}</p>
                                                                                    </div>
                                                                                    <div className="bg-grey/5 p-2.5 rounded-lg border border-grey/10">
                                                                                        <span className="text-[10px] uppercase font-bold text-grey block mb-1">Remedial Action</span>
                                                                                        <p className="text-hitam text-sm leading-relaxed">{item.capa?.corrective_action || '-'}</p>
                                                                                    </div>
                                                                                    <div className="flex items-center gap-2 px-1">
                                                                                        <Calendar className="w-4 h-4 text-biru"/>
                                                                                        <div>
                                                                                            <span className="text-[10px] uppercase font-bold text-grey block">Due Date</span>
                                                                                            <p className="text-biru font-bold text-sm">{item.capa?.due_date || '-'}</p>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            </div>

                                                                            {/* KOLOM 2: BUKTI PERBAIKAN (PIC) */}
                                                                            <div className="p-5 space-y-4 bg-yellow-50/30">
                                                                                <strong className="block text-biru text-[11px] uppercase tracking-widest mb-2 font-bold items-center">
                                                                                    <Briefcase className="w-3.5 h-3.5 mr-1.5"/> Progres PIC
                                                                                </strong>
                                                                                <div className="space-y-3">
                                                                                    <div>
                                                                                        <span className="text-[10px] uppercase font-bold text-grey block mb-1">Lampiran File PIC</span>
                                                                                        <div className="flex flex-col gap-1.5">
                                                                                            {item.bukti_perbaikan && item.bukti_perbaikan.length > 0 ? (
                                                                                                item.bukti_perbaikan.map((f: string, i: number) => <FileDisplay key={i} filePath={f} label="Fixed" />)
                                                                                            ) : (
                                                                                                <span className="text-orange-500 text-xs italic bg-orange-50 px-2 py-1 rounded border border-orange-100 w-fit">Belum ada file</span>
                                                                                            )}
                                                                                        </div>
                                                                                        {item.tgl_upload_bukti && (
                                                                                            <div className="text-[10px] text-grey flex items-center mt-2 font-medium">
                                                                                                <Clock className="w-3 h-3 mr-1"/> Selesai pada: {formatDateShort(item.tgl_upload_bukti)}
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                    <div>
                                                                                        <span className="text-[10px] uppercase font-bold text-grey block mb-1">Catatan PIC</span>
                                                                                        <div className="bg-putih p-3 rounded-lg border border-yellow-200 text-xs text-hitam min-h-[50px] shadow-sm italic leading-relaxed">
                                                                                            "{item.catatan_perbaikan || 'Tidak ada catatan'}"
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            </div>

                                                                            {/* KOLOM 3: HASIL VERIFIKASI (AUDITOR) */}
                                                                            <div className="p-5 space-y-4 bg-grey/5">
                                                                                <div className="flex justify-between items-start">
                                                                                    <strong className="block text-hijau text-[11px] uppercase tracking-widest mb-2 font-bold items-center">
                                                                                        <UserCheck className="w-3.5 h-3.5 mr-1.5"/> Review Auditor
                                                                                    </strong>
                                                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                                                                        item.status_verifikasi_auditor === 'APPROVED' 
                                                                                        ? 'bg-hijau text-putih border-hijau' 
                                                                                        : 'bg-red-50 text-red-600 border-red-200'
                                                                                    }`}>
                                                                                        {item.status_verifikasi_auditor || 'WAITING'}
                                                                                    </span>
                                                                                </div>
                                                                                
                                                                                <div className="space-y-3">
                                                                                    <div>
                                                                                        <span className="text-[10px] uppercase font-bold text-grey block mb-1">Bukti Verifikasi Auditor</span>
                                                                                        <div className="flex flex-col gap-1.5">
                                                                                            {item.bukti_verifikasi && item.bukti_verifikasi.length > 0 ? (
                                                                                                item.bukti_verifikasi.map((f: string, i: number) => <FileDisplay key={i} filePath={f} label="Verif" />)
                                                                                            ) : (
                                                                                                <span className="text-grey text-xs italic">N/A (Cek Catatan)</span>
                                                                                            )}
                                                                                        </div>
                                                                                        {item.tgl_verifikasi && (
                                                                                            <div className="text-[10px] text-grey flex items-center mt-2">
                                                                                                <Clock className="w-3 h-3 mr-1"/> Diverifikasi: {formatDateShort(item.tgl_verifikasi)}
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                    <div>
                                                                                        <span className="text-[10px] uppercase font-bold text-grey block mb-1">Catatan Auditor</span>
                                                                                        <div className="bg-putih p-3 rounded-lg border border-grey/20 text-xs text-hitam min-h-[50px] shadow-sm leading-relaxed">
                                                                                            {item.catatan_verifikasi || '-'}
                                                                                        </div>
                                                                                    </div>

                                                                                    {/* ALERT KHUSUS JIKA SUPERVISOR PERNAH REJECT (Layer Final) */}
                                                                                    {item.hasil_verifikasi === 'REJECTED' && item.catatan_verifikasi_bukti && (
                                                                                        <div className="mt-3 p-3 bg-red-600 text-white rounded-lg text-xs flex items-start animate-bounce-short shadow-md">
                                                                                            <XCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                                                                                            <div>
                                                                                                <span className="font-bold block mb-0.5">Alasan Reject Terakhir (Supervisor):</span>
                                                                                                "{item.catatan_verifikasi_bukti}"
                                                                                            </div>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </div>

                                                                        </div>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </React.Fragment>
                                                )
                                            })}
                                        </React.Fragment>
                                    ))}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

{/* --- AFTER: Hanya Satu Footer Statistik di Paling Bawah --- */}
            <div className="fixed bottom-0 right-0 left-0 md:left-64 bg-putih border-t-4 border-biru p-4 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] z-30 font-arial">
                <div className="max-w-full px-6 flex justify-between items-center h-12">
                    
                    <div className="text-left text-sm text-grey flex items-center gap-8">
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase font-bold text-grey/60 tracking-wider">Total Temuan</span>
                            <p className="text-hitam font-bold">{items.length} <span className="font-medium text-grey">Item</span></p>
                        </div>
                        <div className="w-px h-8 bg-grey/20"></div>
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase font-bold text-biru/60 tracking-wider">Pending SPV</span>
                            <p className="text-biru font-bold">
                                {items.filter(it => !it.hasil_verifikasi || it.hasil_verifikasi === 'WAITING' || it.hasil_verifikasi === '-').length} 
                            </p>
                        </div>
                        <div className="w-px h-8 bg-grey/20"></div>
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase font-bold text-hijau/60 tracking-wider">Sudah Validasi</span>
                            <p className="text-hijau font-bold">
                                {items.filter(it => it.hasil_verifikasi === 'APPROVED' || it.hasil_verifikasi === 'REJECTED').length} 
                            </p>
                        </div>
                    </div>

                    <div className="text-xs text-grey italic flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-biru"/>
                        Laporan otomatis selesai jika semua item divalidasi.
                    </div>
                </div>
            </div>

            {/* Letakkan Modal Konfirmasi di SINI (di luar footer) */}
            <ApproveConfirmationModal 
                isOpen={approveModalOpen} 
                onClose={() => setApproveModalOpen(false)} 
                onConfirm={handleConfirmApprove} 
            />
            
            {/* Modal Reject Tetap Di Sini */}
            <RejectModal isOpen={rejectModalOpen} onClose={() => setRejectModalOpen(false)} onConfirm={handleRejectConfirm} />
        </div>
    )
}   