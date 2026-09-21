'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Toaster, toast } from 'react-hot-toast'
import { 
    ArrowLeft, CheckCircle, XCircle, 
    AlertTriangle, User, Calendar, ChevronDown, ChevronUp, Paperclip, UserCheck, ShieldCheck, Briefcase,
    Check, X, RefreshCw, Clock, Send, Info, AlertCircle, FileCheck
} from 'lucide-react'
import Link from 'next/link'
import { fetchWithAuth } from '@/utils/api' 

/* --- INTERFACES --- */
interface CapaData {
    root_cause: string
    corrective_action: string
    due_date: string
}

interface TemuanItem {
    id?: number | string 
    item_id?: number | string
    item_checklist_text?: string
    deskripsi_temuan?: string
    lokasi_temuan?: string
    bukti_temuan?: string | string[]
    
    kategori?: string | null           
    sub_kategori?: string | null
    kategori_temuan?: string | null   
    referensi_doc?: string | null
    data_integrity?: string | null
    prinsip_5r?: string | null
    pic_user_id?: number | null 
    
    status_verifikasi?: 'WAITING' | 'APPROVED' | 'REVISION' | 'REJECTED'
    catatan_verifikasi?: string 
    status?: string 

    justification?: 'Temuan' | 'Observasi' | null

    capa?: CapaData

    localDecision?: 'APPROVED' | 'REJECTED' | null
    localReason?: string 
}

interface LaporanDetail {
    pelaksanaan_id: number
    no_fta: string
    tanggal_audit: string
    nama_checklist: string
    jenis_audit: string
    site: string
    area: string
    auditor: string
    status_laporan: string
    master?: any
    
    nama_qs_spv?: string
    nama_mgr_area?: string
    nama_mgr_qs?: string
    nama_pic_capa?: string 
    
    approver_qs_spv_id?: number
    approver_mgr_area_id?: number
    approver_mgr_qs_id?: number

    tgl_approve_qs_spv?: string
    tgl_approve_mgr_area?: string
    tgl_approve_mgr_qs?: string
    tgl_submit_capa?: string 
}

/* --- COMPONENTS --- */
const AuditHeader = ({ info, totalItems }: { info: Partial<LaporanDetail>; totalItems: number }) => {
    const parse = (v: any) => (v == null || v === '' || v === '-' ? '-' : String(v))
    const formatDateLong = (raw?: any) => {
        if (!raw || raw === '-' || raw === '0001-01-01T00:00:00Z') return '-'
        const d = new Date(raw)
        return isNaN(d.getTime()) || d.getFullYear() <= 1 ? '-' : new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }).format(d)
    }
    return (
      <div className="bg-putih p-6 rounded-lg shadow-md mb-6 font-arial border border-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
          <div><p className="text-sm font-medium text-grey">NO FTA</p><p className="text-lg font-bold text-hitam">{parse(info.no_fta)}</p></div>
          <div><p className="text-sm font-medium text-grey">Jenis Audit</p><p className="text-lg font-bold text-hitam">{parse(info.jenis_audit)}</p></div>
          <div><p className="text-sm font-medium text-grey">Auditor</p><p className="text-lg font-bold text-hitam">{parse(info.auditor)}</p></div>
          <div><p className="text-sm font-medium text-grey">Site / Area</p><p className="text-lg font-bold text-hitam">{parse(info.site)} - {parse(info.area)}</p></div>
          <div><p className="text-sm font-medium text-grey">Tgl Pelaksanaan</p><p className="text-lg font-bold text-hitam">{formatDateLong(info.tanggal_audit)}</p></div>
          <div><p className="text-sm font-medium text-grey">Status Saat Ini</p>
            <div className="flex items-center gap-2 mt-1">
                <span className="inline-block px-2 py-1 rounded bg-blue-100 text-blue-800 text-xs font-bold">
                    {info.status_laporan}
                </span>
                <span className="text-xs text-gray-500 font-medium">({totalItems} Item)</span>
            </div>
          </div>
        </div>
      </div>
    )
}

const FileDisplay = ({ filePath }: { filePath: string }) => {
    if (!filePath || filePath === '-') return <span>-</span>
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || ''
    let normalizedPath = String(filePath).replace(/\\/g, '/')
    if (normalizedPath.startsWith('/')) normalizedPath = normalizedPath.substring(1)
    const fullUrl = `${API_BASE}/${normalizedPath}`
    const fileName = normalizedPath.split('/').pop() || 'File'
    return (
        <a href={fullUrl} target="_blank" rel="noopener noreferrer" className="flex items-center p-1.5 bg-gray-50 rounded border border-gray-200 hover:bg-blue-50 hover:text-blue-600 transition-colors text-xs text-gray-600 max-w-fit" title={fileName}>
            <Paperclip className="h-3 w-3 mr-1.5" /> <span className="truncate max-w-[100px]">{fileName}</span>
        </a>
    )
}

const ApproverInfo = ({ title, name, date, icon: Icon, isApproved, isCurrent }: any) => {
    const formatDateShort = (raw?: string) => {
        if (!raw || raw === '-' || raw.startsWith('0001')) return '-'
        return new Date(raw).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: '2-digit' })
    }

    return (
        <div className={`relative flex flex-col items-center justify-between p-3 rounded-lg border min-w-[160px] min-h-[110px] transition-all
            ${isApproved 
                ? 'bg-hijau/10 border-hijau/30' 
                : isCurrent 
                    ? 'bg-biru/10 border-biru/30 ring-2 ring-biru/20 shadow-md transform scale-105' 
                    : 'bg-white border-grey/20 opacity-70'
            }
        `}>
            <div className={`absolute -top-2 -right-2 rounded-full p-1 border-2 border-white shadow-sm z-10
                ${isApproved ? 'bg-hijau text-white' : isCurrent ? 'bg-biru text-white' : 'bg-gray-200 text-gray-400'}`}>
                {isApproved ? <Check className="w-3 h-3" strokeWidth={4} /> : isCurrent ? <Clock className="w-3 h-3 animate-spin-slow" /> : <Clock className="w-3 h-3" />}
            </div>

            <div className="flex flex-col items-center w-full flex-grow justify-center">
                <Icon className={`w-5 h-5 mb-1 ${isApproved ? 'text-hijau' : isCurrent ? 'text-biru' : 'text-grey'}`} />
                <span className="text-[10px] uppercase font-bold text-grey tracking-wider text-center mb-1">{title}</span>
                <span className={`text-xs font-bold text-center leading-tight w-full whitespace-normal px-1 ${isApproved ? 'text-hijau' : 'text-hitam'}`}>
                    {name || '-'}
                </span>
            </div>

            <div className="mt-2 pt-2 border-t border-black/5 w-full text-center">
                <span className="text-[10px] text-grey font-medium">
                    {isApproved ? formatDateShort(date) : (isCurrent ? "Sedang Proses" : "Menunggu")}
                </span>
            </div>
        </div>
    )
}

/* --- MODALS --- */
const ItemRejectModal = ({ isOpen, onClose, onConfirm, item }: { isOpen: boolean; onClose: () => void; onConfirm: (reason: string) => void; item: TemuanItem | null }) => {
    const [reason, setReason] = useState('')
    useEffect(() => { if(isOpen) setReason('') }, [isOpen])
    
    const handleSubmit = () => { 
        if (!reason.trim()) return toast.error('Alasan penolakan wajib diisi.')
        onConfirm(reason) 
    }
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-hitam/60 p-4 font-arial backdrop-blur-sm">
            <div className="bg-putih w-full max-w-sm p-6 rounded-xl shadow-2xl border-t-4 border-red-500 animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="text-lg font-bold text-hitam flex items-center"><XCircle className="w-5 h-5 text-red-600 mr-2"/> Reject Item?</h4>
                    <button onClick={onClose}><X className="w-5 h-5 text-grey hover:text-hitam" /></button>
                </div>
                <p className="text-sm text-grey mb-4 leading-relaxed">Item ini akan ditandai <strong>REJECT</strong>.</p>
                <label className="block text-xs font-bold text-hitam mb-1">Alasan Penolakan <span className="text-red-500">*</span></label>
                <textarea 
                    value={reason} onChange={(e) => setReason(e.target.value)} 
                    className="w-full p-3 border border-grey/30 rounded-lg text-sm focus:ring-2 focus:ring-red-200 outline-none mb-4 bg-white" 
                    rows={3} placeholder="Contoh: Bukti perbaikan kurang jelas..." autoFocus 
                />
                <div className="flex justify-end gap-2 pt-2 border-t border-grey/10">
                    <button onClick={onClose} className="px-4 py-2 bg-grey/10 text-hitam rounded-lg text-sm font-medium hover:bg-grey/20 transition-colors">Batal</button>
                    <button onClick={handleSubmit} className="px-4 py-2 bg-red-600 text-putih rounded-lg text-sm font-bold hover:bg-red-700 shadow-md transition-colors">Simpan Reject</button>
                </div>
            </div>
        </div>
    )
}

const BundleRejectModal = ({ isOpen, onClose, onConfirm }: { isOpen: boolean; onClose: () => void; onConfirm: (reason: string) => void }) => {
    const [reason, setReason] = useState('')
    useEffect(() => { if(isOpen) setReason('') }, [isOpen])
    if (!isOpen) return null
    return (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-hitam/60 p-4 font-arial backdrop-blur-sm">
             <div className="bg-putih w-full max-w-md p-6 rounded-xl shadow-2xl border-t-4 border-red-500 animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="text-lg font-bold text-hitam flex items-center"><AlertTriangle className="w-6 h-6 text-red-600 mr-2"/> Return Laporan (Bundle)</h4>
                    <button onClick={onClose}><X className="w-5 h-5 text-grey hover:text-hitam" /></button>
                </div>
                <div className="bg-red-50 border border-red-100 p-3 rounded mb-4 text-sm text-red-800">
                    Anda akan me-reject laporan ini secara keseluruhan. Semua item temuan akan dikembalikan untuk direvisi.
                </div>
                <label className="block text-xs font-bold text-hitam mb-1">Alasan Return Global <span className="text-red-500">*</span></label>
                <textarea 
                    value={reason} onChange={(e) => setReason(e.target.value)} 
                    className="w-full p-3 border border-grey/30 rounded-lg text-sm focus:ring-2 focus:ring-red-200 outline-none mb-4 bg-white" 
                    rows={4} placeholder="Contoh: Mohon perbaiki bukti temuan pada area produksi..." autoFocus 
                />
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 bg-grey/10 text-hitam rounded-lg font-medium">Batal</button>
                    <button onClick={() => { if(!reason.trim()) return toast.error("Alasan wajib diisi"); onConfirm(reason); }} className="px-4 py-2 bg-red-600 text-putih rounded-lg font-bold hover:bg-red-700 shadow-md">
                        Submit Return
                    </button>
                </div>
            </div>
        </div>
    )
}

const MainApproveModal = ({ isOpen, onClose, onConfirm, currentRole, hasRejections }: any) => {
    if (!isOpen) return null
    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-hitam/60 p-4 font-arial backdrop-blur-sm">
            <div className="bg-putih w-full max-w-md p-6 rounded-xl shadow-2xl border-t-4 border-biru animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="text-lg font-bold text-hitam flex items-center"><Send className="w-6 h-6 text-biru mr-2"/> Konfirmasi Final</h4>
                    <button onClick={onClose}><XCircle className="w-6 h-6 text-grey hover:text-hitam transition-colors" /></button>
                </div>
                {hasRejections ? (
                    <div className="flex items-start gap-3 mb-6 bg-red-50 p-3 rounded-lg border border-red-100">
                        <AlertTriangle className="w-6 h-6 text-red-600 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-red-800">
                            <strong>Perhatian:</strong> Terdapat item yang Anda <strong>REJECT</strong>.<br/>
                            Laporan ini akan <strong>DIKEMBALIKAN (RETURN)</strong> ke tahap sebelumnya untuk direvisi.
                        </div>
                    </div>
                ) : (
                    <div className="flex items-start gap-3 mb-6 bg-blue-50 p-3 rounded-lg border border-blue-100">
                        <ShieldCheck className="w-6 h-6 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-blue-800">
                            Semua item <strong>APPROVED</strong>.<br/>
                            Laporan akan diteruskan ke tahap approval selanjutnya sebagai <strong>{currentRole}</strong>.
                        </div>
                    </div>
                )}
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 bg-grey/10 text-hitam rounded hover:bg-grey/20 transition-colors font-medium">Batal</button>
                    <button onClick={onConfirm} className={`px-6 py-2 text-putih rounded font-bold transition-colors shadow-md flex items-center ${hasRejections ? 'bg-red-600 hover:bg-red-700' : 'bg-hijau hover:bg-hijau-800'}`}>
                        {hasRejections ? <><XCircle className="w-4 h-4 mr-2"/> Return Laporan</> : <><CheckCircle className="w-4 h-4 mr-2"/> Approve Laporan</>}
                    </button>
                </div>
            </div>
        </div>
    )
}

/* --- MAIN PAGE --- */
export default function FinalApprovalDetailPage() {
    const router = useRouter()
    const params = useParams() as any
    const approveId = params?.approveId || params?.id || ''
    
    const [isLoading, setIsLoading] = useState(true)
    const [detail, setDetail] = useState<LaporanDetail | null>(null)
    const [items, setItems] = useState<TemuanItem[]>([])
    const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})
    const [isProcessing, setIsProcessing] = useState(false)
    
    // Modals
    const [rejectItemModal, setRejectItemModal] = useState<string | null>(null)
    const [mainApproveModal, setMainApproveModal] = useState(false)
    const [bundleRejectModal, setBundleRejectModal] = useState(false) 
    
    const [currentUserId, setCurrentUserId] = useState<number>(0);
    const [currentUserRole, setCurrentUserRole] = useState<string>(""); 
    const [userList, setUserList] = useState<any[]>([]); 

    // Helper Status Matcher
    const isStatusMatch = (actual: string | undefined, ...expected: string[]) => {
        if (!actual) return false;
        const normActual = actual.toUpperCase().replace(/_/g, ' ').trim();
        return expected.some(exp => normActual === exp.toUpperCase().replace(/_/g, ' ').trim());
    }

    const isPatrolHSE = useMemo(() => {
        if (!detail?.jenis_audit) return false;
        return detail.jenis_audit.toLowerCase().includes("patrol hse");
    }, [detail?.jenis_audit]);

    const isBundlingMode = useMemo(() => {
        if (!detail?.status_laporan) return false;
        return isStatusMatch(detail.status_laporan, "WAITING_MGR_AREA", "WAITING_MGR_QS");
    }, [detail?.status_laporan]);

    useEffect(() => {
        if (!approveId) return;
        const storageKey = "auth-storage"; 
        const storageStr = localStorage.getItem(storageKey); 
        if (storageStr) {
            try {
                const parsedStorage = JSON.parse(storageStr);
                const userData = parsedStorage.state?.user;
                if (userData) {
                    const extractedId = userData.id || userData.user_id;
                    const extractedRole = userData.role_name || userData.role;
                    if (extractedId) setCurrentUserId(Number(extractedId));
                    if (extractedRole) setCurrentUserRole(String(extractedRole));
                }
            } catch (e) { console.error("Error parsing auth storage", e); }
        }
        
        const fetchUsers = async () => {
          try {
            const res = await fetchWithAuth(`/api/users`, { cache: 'no-store' })
            if (res.ok) { 
                const json = await res.json(); 
                const allUsers = (json.data || []).map((u: any) => ({
                    id: u.id ?? u.user_id,
                    name: u.name || u.nama_lengkap || u.email || 'No Name',
                }));
                setUserList(allUsers);
            }
          } catch (error) { console.error('Gagal load users', error) }
        }
        fetchUsers()
        fetchData()
    }, [approveId]);

    const getPicName = (id: any) => {
        if (!id) return '-'
        const user = userList.find((u) => u.id === Number(id))
        return user ? user.name : `ID: ${id}`
    }

    const fetchData = async () => {
        try {
            const res = await fetchWithAuth(`/api/audit/laporan-temuan/detailed/${approveId}`, { cache: 'no-store' })
            if (!res.ok) throw new Error("Gagal load data")
            
            const json = await res.json()
            const m = json.data.master
            const t = json.data.temuan || []

            setDetail({
                pelaksanaan_id: m.pelaksanaan_id,
                no_fta: m.no_fta,
                tanggal_audit: m.tanggal_audit,
                nama_checklist: m.nama_checklist,
                jenis_audit: m.nama_jenis_audit, 
                site: m.nama_site,
                area: m.nama_area,
                auditor: m.nama_auditor,
                status_laporan: m.status_laporan,
                nama_qs_spv: m.nama_qs_spv,
                nama_mgr_area: m.nama_mgr_area,
                nama_mgr_qs: m.nama_mgr_qs,
                nama_pic_capa: m.nama_pic_capa,
                approver_qs_spv_id: m.approver_qs_spv_id,
                approver_mgr_area_id: m.approver_mgr_area_id,
                approver_mgr_qs_id: m.approver_mgr_qs_id,
                tgl_approve_qs_spv: m.tgl_approve_qs_spv,
                tgl_approve_mgr_area: m.tgl_approve_mgr_area,
                tgl_approve_mgr_qs: m.tgl_approve_mgr_qs,
                tgl_submit_capa: m.tgl_submit_capa,
            })

            const mappedItems = t.map((it: any) => {
                let files: string[] = []
                try { if (it.bukti_temuan) { const val = String(it.bukti_temuan).trim(); if(val.startsWith('[')) files = JSON.parse(val); else files = [val] } } catch { files = [] }
                
                const dbStatus = it.status_verifikasi || it.hasil_verifikasi || 'WAITING';
                let initLocalDecision: 'APPROVED' | 'REJECTED' | null = null;

                if (dbStatus === 'APPROVED') {
                    if (isStatusMatch(m.status_laporan, "WAITING_MGR_AREA", "WAITING_MGR_QS")) {
                        initLocalDecision = null; 
                    } else {
                        initLocalDecision = 'APPROVED';
                    }
                } else if (dbStatus === 'REVISION' || dbStatus === 'REJECTED') {
                    initLocalDecision = null; 
                }

                return {
                    id: it.temuan_id, 
                    item_id: it.item_id,
                    item_checklist_text: it.item_checklist_text,
                    deskripsi_temuan: it.deskripsi_temuan,
                    lokasi_temuan: it.lokasi_temuan,
                    kategori_temuan: it.kategori_temuan,
                    kategori: it.kategori || 'Lain-lain',
                    sub_kategori: it.sub_kategori || 'Umum',
                    data_integrity: it.data_integrity || '-',
                    prinsip_5r: it.prinsip_5r || '-',
                    pic_user_id: it.pic_user_id,
                    referensi_doc: it.referensi_doc,
                    bukti_temuan: files,
                    status_verifikasi: dbStatus, 
                    catatan_verifikasi: it.catatan_verifikasi, 
                    status: it.status,
                    justification: it.justification || 'Temuan',
                    capa: {
                        root_cause: it.root_cause || '-',
                        corrective_action: it.corrective_action || '-',
                        due_date: it.due_date || '-'
                    },
                    localDecision: initLocalDecision,
                    localReason: '' 
                }
            })
            setItems(mappedItems)

        } catch (e) { console.error(e); toast.error("Gagal mengambil detail laporan") } 
        finally { setIsLoading(false) }
    }

    const visibleItems = useMemo(() => items, [items])

    const groupedItems = useMemo(() => {
        const groups = new Map<string, Map<string, TemuanItem[]>>()
        visibleItems.forEach(item => {
            const kategori = item.kategori || 'Lain-lain'
            const sub = item.sub_kategori || 'Umum'
            if (!groups.has(kategori)) groups.set(kategori, new Map())
            const subMap = groups.get(kategori)!
            if (!subMap.has(sub)) subMap.set(sub, [])
            subMap.get(sub)!.push(item)
        })
        return groups
    }, [visibleItems])

    const toggleRow = (id: string | number) => setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }))

    const getAccessStatus = () => {
        if (!detail) return { canAct: false, message: "Memuat...", role: "" }
        if (currentUserId === 0) return { canAct: false, message: "Menunggu data user...", role: "" }
        
        const myID = String(currentUserId);
        const myRole = currentUserRole.toLowerCase();
        const status = detail.status_laporan;

        if (isStatusMatch(status, "WAITING_QS_SPV")) {
             const approverID = String(detail.approver_qs_spv_id || 0);
             if (myID === approverID || ((approverID === '0' || approverID === 'null') && (myRole.includes("qs supervisor") || myRole.includes("admin")))) {
                 return { canAct: true, role: "QS Supervisor" }
             }
             return { canAct: false, message: "Menunggu QS Supervisor", role: "QS Supervisor" }
        }

        if (isStatusMatch(status, "WAITING_MGR_AREA")) {
             const approverID = String(detail.approver_mgr_area_id || 0);
             if (myID === approverID || ((approverID === '0' || approverID === 'null') && (myRole.includes("manager area") || myRole.includes("admin")))) {
                 return { canAct: true, role: "Manager Area" }
             }
             return { canAct: false, message: "Menunggu Manager Area", role: "Manager Area" }
        }

        if (isStatusMatch(status, "WAITING_MGR_QS")) {
             const approverID = String(detail.approver_mgr_qs_id || 0);
             if (myID === approverID || ((approverID === '0' || approverID === 'null') && (myRole.includes("qs manager") || myRole.includes("admin")))) {
                 return { canAct: true, role: "QS Manager" }
             }
             return { canAct: false, message: "Menunggu QS Manager", role: "QS Manager" }
        }

        return { canAct: false, message: `Status: ${status}`, role: "" }
    }
    const access = getAccessStatus()

    /* --- ACTIONS (UPDATED: REDIRECT AFTER SUCCESS) --- */
    
    // [FIX] Redirect ke Masterlist setelah sukses (bukan Reload)
    const handleBundlingSubmit = async (actionType: 'APPROVE' | 'REJECT', globalReason: string = '') => {
        if (!currentUserId || currentUserId === 0) return toast.error("User invalid");
        setIsProcessing(true);
        const toastId = toast.loading("Memproses...");

        try {
            const payload = { 
                action: actionType, 
                comment: actionType === 'APPROVE' ? "Approved via Bundle" : globalReason, 
                user_id: currentUserId 
            };
            const resFinal = await fetchWithAuth(`/api/audit/verification-final-submit/${approveId}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!resFinal.ok) throw new Error(await resFinal.text() || "Gagal final submit");
            
            toast.success("Berhasil diproses!", { id: toastId });
            
            // [REDIRECT HERE]
            setTimeout(() => {
                router.push('/laporan-temuan/final-approve');
            }, 1500);

        } catch (e: any) {
            console.error(e);
            toast.error(`Gagal: ${e.message}`, { id: toastId });
        } finally {
            setIsProcessing(false);
            setBundleRejectModal(false);
        }
    }

    const handleBatchSubmitQS = async () => {
         if (!currentUserId || currentUserId === 0) {
            toast.error("Sesi Anda tidak valid.");
            setMainApproveModal(false);
            return;
        }
        setIsProcessing(true);
        const toastId = toast.loading("Menyimpan keputusan item...");

        try {
            const promises = items.map(async (it) => {
            if (it.localDecision) {
                const realId = it.item_id ?? it.id;
                const status = it.localDecision === 'APPROVED' ? 'APPROVED' : 'REVISION';

                return fetchWithAuth(`/api/audit/verify-item-status/${approveId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    item_id: Number(realId),
                    status: status,
                    comment: status === 'REVISION' ? it.localReason : ""
                })
                });
            }
            });
            await Promise.all(promises);

            const anyRejected = items.some(it => it.localDecision === 'REJECTED');
            const finalAction = anyRejected ? "REJECT" : "APPROVE"; 
            
            const payload = { 
                action: finalAction, 
                comment: anyRejected ? "Return (QS SPV)" : "Approve (QS SPV)", 
                user_id: currentUserId 
            };
            
            const resFinal = await fetchWithAuth(`/api/audit/verification-final-submit/${approveId}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!resFinal.ok) throw new Error("Gagal final submit");
            toast.success("Laporan berhasil diproses!", { id: toastId });
            
            // [REDIRECT HERE]
            setTimeout(() => {
                router.push('/laporan-temuan/final-approve');
            }, 1500);

        } catch (e: any) {
            console.error(e);
            toast.error(`Gagal: ${e.message}`, { id: toastId });
        } finally {
            setIsProcessing(false);
            setMainApproveModal(false);
        }
    }

    const handleRejectItemLocal = (reason: string) => {
        if (!rejectItemModal) return;
        const targetIdString = String(rejectItemModal);
        setItems(prev => prev.map(it => {
            const curId = String(it.item_id ?? it.id);
            if (curId === targetIdString) {
                return { ...it, localDecision: 'REJECTED', localReason: reason };
            }
            return it;
        }));
        setRejectItemModal(null);
        toast.success("Item ditandai REJECT (Draft)");
    }

    const handleApproveItemLocal = (itemId: string | number) => {
        const targetIdString = String(itemId);
        setItems(prev => prev.map(it => {
            const curId = String(it.item_id ?? it.id);
            if (curId === targetIdString) {
                return { ...it, localDecision: 'APPROVED', localReason: '' };
            }
            return it;
        }));
    }

    const handleResetItemLocal = (itemId: string | number) => {
        const targetIdString = String(itemId);
        setItems(prev => prev.map(it => {
            const curId = String(it.item_id ?? it.id);
            if (curId === targetIdString) {
                return { ...it, localDecision: null, localReason: '' };
            }
            return it;
        }));
    }

    const totalItems = items.length;
    const approvedCount = items.filter(it => it.localDecision === 'APPROVED').length;
    const pendingCount = items.filter(it => it.localDecision === null).length;
    const isReadyToFinalQS = pendingCount === 0 && totalItems > 0; 
    const hasRejections = items.some(it => it.localDecision === 'REJECTED');
    const itemBeingRejected = items.find(it => String(it.item_id ?? it.id) === String(rejectItemModal)) || null;

    if (isLoading) return <div className="p-12 text-center text-grey">Memuat data...</div>
    if (!detail) return <div className="p-12 text-center text-red-500">Data tidak ditemukan.</div>

    return (
        <div className="font-arial pb-64">
            <Toaster position="top-center"/>
            <Link href="/laporan-temuan/final-approve" className="flex items-center text-sm text-biru hover:underline mb-4 font-medium">
                <ArrowLeft className="w-4 h-4 mr-1" /> Kembali ke Antrian Approval
            </Link>

            {detail && <AuditHeader info={detail} totalItems={visibleItems.length} />}

            <div className="bg-putih p-6 rounded-lg shadow-md mb-8">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-3">
                        <h3 className="text-xl font-bold text-hitam">Approval Temuan</h3>
                        
                        {isBundlingMode ? (
                            <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-0.5 rounded-full border border-blue-200 flex items-center">
                               <FileCheck className="w-3 h-3 mr-1"/> Approve All / Reject All
                            </span>
                        ) : (
                            !isReadyToFinalQS ? (
                                <span className="bg-orange-100 text-orange-800 text-xs font-bold px-2.5 py-0.5 rounded-full border border-orange-200">
                                    Selesaikan Review: {pendingCount} Item
                                </span>
                            ) : (
                                <span className="bg-green-100 text-green-800 text-xs font-bold px-2.5 py-0.5 rounded-full border border-green-200">
                                    Siap Submit
                                </span>
                            )
                        )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                         <button onClick={fetchData} className="p-2 bg-gray-50 rounded-full hover:bg-gray-100 text-grey transition" title="Refresh Data"><RefreshCw className="w-4 h-4"/></button>
                        <span className={`text-xs font-medium px-3 py-1 rounded-full border ${access.canAct ? 'bg-biru/10 text-biru border-biru/20' : 'bg-grey/10 text-grey border-grey/20'}`}>
                            {access.canAct ? "Giliran Anda" : "View Only Mode"}
                        </span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-grey/40 border-x border-grey/40">
                        <thead className="bg-grey/10">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-bold text-grey uppercase w-10">No.</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase w-1/4">Check Item</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase">Ref Doc</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase">Deskripsi</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase">Bukti Temuan</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase">Lokasi</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase">PIC</th>
                                {!isPatrolHSE && (<><th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase">Data Int.</th><th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase">5R</th></>)}
                                <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase">Kategori</th>
                                <th className="px-6 py-3 text-center text-xs font-bold text-grey uppercase w-28">Justifikasi</th>
                                <th className="px-6 py-3 text-center text-xs font-bold text-grey uppercase w-40">Action</th>
                                <th className="px-6 py-3 text-center text-xs font-bold text-grey uppercase">Detail</th>
                            </tr>
                        </thead>
                        <tbody className="bg-putih divide-y divide-grey/40">
                            {Array.from(groupedItems.entries()).map(([kategori, subGroups]) => (
                                <React.Fragment key={kategori}>
                                    <tr className="bg-biru/5"><td colSpan={isPatrolHSE ? 11 : 13} className="px-4 py-3 text-sm font-bold text-biru uppercase tracking-wide">{kategori}</td></tr>
                                    {Array.from(subGroups.entries()).map(([sub, items]) => (
                                        <React.Fragment key={sub}>
                                            {items.map((item, idx) => {
                                                const rowId = String(item.item_id ?? item.id)
                                                const isExpanded = expandedRows[rowId]
                                                const files = Array.isArray(item.bukti_temuan) ? item.bukti_temuan : []
                                                
                                                const currentDecision = item.localDecision; 
                                                const isApproved = currentDecision === 'APPROVED';
                                                const isRejected = currentDecision === 'REJECTED';
                                                const isObservasi = item.justification === 'Observasi'
                                                const hasCapaData = item.capa?.root_cause && item.capa?.root_cause !== '-' && item.capa?.root_cause !== '';

                                                return (
                                                    <React.Fragment key={rowId}>
                                                        <tr className={`transition-colors ${isApproved ? 'bg-green-50/30' : isRejected ? 'bg-red-50/30' : 'hover:bg-grey/5'}`}>
                                                            <td className="px-4 py-4 text-sm text-hitam text-center font-medium align-top">{idx + 1}</td>
                                                            <td className="px-6 py-4 text-sm text-hitam leading-relaxed align-top">
                                                                <p className="font-semibold">{item.item_checklist_text}</p>
                                                                {item.catatan_verifikasi && (
                                                                    <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800 flex items-start">
                                                                        <AlertCircle className="w-3 h-3 mr-1.5 mt-0.5 flex-shrink-0" />
                                                                        <div><strong>History Revisi:</strong> "{item.catatan_verifikasi}"</div>
                                                                    </div>
                                                                )}
                                                                {isRejected && item.localReason && (
                                                                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800 flex items-start animate-in fade-in slide-in-from-top-1">
                                                                        <XCircle className="w-3 h-3 mr-1.5 mt-0.5 flex-shrink-0" />
                                                                        <div><strong>Alasan Reject (Draft):</strong> "{item.localReason}"</div>
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="px-6 py-4 text-sm text-hitam/70 align-top">{item.referensi_doc || '-'}</td>
                                                            <td className="px-6 py-4 text-sm text-biru font-semibold align-top">{item.deskripsi_temuan || '-'}</td>
                                                            <td className="px-6 py-4 text-sm text-hitam align-top">
                                                                <div className="flex flex-wrap gap-2">{files.length > 0 ? files.map((f, i) => <FileDisplay key={i} filePath={f} />) : '-'}</div>
                                                            </td>
                                                            <td className="px-6 py-4 text-sm text-hitam align-top">{item.lokasi_temuan || '-'}</td>
                                                            <td className="px-6 py-4 text-sm text-biru font-semibold align-top">{getPicName(item.pic_user_id)}</td>
                                                            {!isPatrolHSE && (<><td className="px-6 py-4 text-sm text-hitam align-top">{item.data_integrity || '-'}</td><td className="px-6 py-4 text-sm text-hitam align-top">{item.prinsip_5r || '-'}</td></>)}
                                                            <td className="px-6 py-4 text-sm text-hitam align-top"><span className="px-2 py-1 rounded text-xs font-bold bg-grey/10 border border-grey/20 text-hitam">{item.kategori_temuan || '-'}</span></td>
                                                            
                                                            <td className="px-6 py-4 text-center align-top">
                                                                <span className={`px-2 py-1 rounded text-xs font-bold border inline-block ${isObservasi ? 'bg-hijau/10 text-hijau border-hijau/20' : 'bg-biru/10 text-biru border-biru/20'}`}>
                                                                            {item.justification || 'Temuan'}
                                                                </span>
                                                            </td>

                                                            <td className="px-4 py-4 text-center align-top">
                                                                {access.canAct ? (
                                                                    isBundlingMode ? (
                                                                         <span className="text-xs text-gray-400 italic">Pending Review</span>
                                                                    ) : (
                                                                        isApproved ? (
                                                                            <div className="flex flex-col items-center gap-1 animate-in fade-in zoom-in duration-300">
                                                                                <span className="inline-flex items-center px-3 py-1.5 rounded-md text-xs font-bold bg-hijau/10 text-hijau border border-hijau/20 select-none shadow-sm">APPROVED</span>
                                                                                <button onClick={() => handleResetItemLocal(rowId)} className="text-[10px] font-medium text-grey/60 hover:text-red-500 hover:underline decoration-red-500/30 transition-colors mt-1" title="Batalkan status ini">(Batal)</button>
                                                                            </div>
                                                                        ) : isRejected ? (
                                                                            <div className="flex flex-col items-center gap-1 animate-in fade-in zoom-in duration-300">
                                                                                <span className="inline-flex items-center px-3 py-1.5 rounded-md text-xs font-bold bg-red-100 text-red-600 border border-red-200 select-none shadow-sm">REJECTED</span>
                                                                                <button onClick={() => handleResetItemLocal(rowId)} className="text-[10px] font-medium text-grey/60 hover:text-red-500 hover:underline decoration-red-500/30 transition-colors mt-1" title="Batalkan status ini">(Batal)</button>
                                                                            </div>
                                                                        ) : (
                                                                            <div className="flex justify-center items-center gap-2">
                                                                                <button onClick={() => handleApproveItemLocal(rowId)} className="w-8 h-8 flex items-center justify-center rounded-md border border-grey/30 bg-putih text-grey hover:text-hijau hover:border-hijau hover:bg-hijau/10 transition-all duration-200 shadow-sm" title="Approve">
                                                                                    <Check className="w-5 h-5" strokeWidth={3} />
                                                                                </button>
                                                                                <button onClick={() => setRejectItemModal(rowId)} className="w-8 h-8 flex items-center justify-center rounded-md border border-grey/30 bg-putih text-grey hover:text-hitam hover:border-grey hover:bg-grey/10 transition-all duration-200 shadow-sm" title="Reject">
                                                                                    <X className="w-5 h-5" strokeWidth={3} />
                                                                                </button>
                                                                            </div>
                                                                        )
                                                                    )
                                                                ) : <span className="text-xs font-bold">{item.status_verifikasi || 'WAITING'}</span>}
                                                            </td>
                                                            <td className="px-6 py-4 text-center align-top">
                                                                <button onClick={() => toggleRow(rowId)} className="p-2 bg-grey/10 rounded">{isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</button>
                                                            </td>
                                                        </tr>
                                                        {isExpanded && (
                                                            <tr className="bg-biru/5 border-b-2 border-grey/20">
                                                                <td colSpan={2}></td>
                                                                <td colSpan={isPatrolHSE ? 9 : 11} className="px-6 py-4 pb-6">
                                                                    <div className="bg-white p-5 rounded-lg border border-biru/20 shadow-sm relative">
                                                                        <div className="absolute top-0 left-0 bg-biru text-putih text-[10px] px-2 py-1 rounded-br-lg rounded-tl-lg font-bold">DATA CAPA</div>
                                                                        {isObservasi && !hasCapaData ? (
                                                                            <div className="flex items-center justify-center p-6 bg-biru/5 rounded mt-4 border border-biru/10">
                                                                                <div className="flex items-center text-biru">
                                                                                    <Info className="w-5 h-5 mr-3" />
                                                                                    <span className="font-medium text-sm"> <strong>OBSERVASI</strong></span>
                                                                                </div>
                                                                            </div>
                                                                        ) : (
                                                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm mt-4">
                                                                                <div><strong className="block text-grey text-xs uppercase tracking-wide mb-1">Direct Cause</strong><p className="text-hitam font-medium">{item.capa?.root_cause}</p></div>
                                                                                <div><strong className="block text-grey text-xs uppercase tracking-wide mb-1">Tindakan Remidial</strong><p className="text-hitam font-medium">{item.capa?.corrective_action}</p></div>
                                                                                <div><strong className="block text-grey text-xs uppercase tracking-wide mb-1">Due Date</strong><p className="text-biru font-bold flex items-center"><Calendar className="w-3 h-3 mr-1" /> {item.capa?.due_date ? new Date(item.capa.due_date).toLocaleDateString('id-ID') : '-'}</p></div>
                                                                            </div>
                                                                        )}
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

            {/* --- FOOTER: FINAL ACTION --- */}
            <div className="fixed bottom-0 right-0 left-0 md:left-64 bg-white border-t-4 border-biru p-4 shadow-lg z-30">
                <div className="max-w-full px-6 flex justify-between items-end">
                    <div className="flex items-center gap-4 overflow-x-auto pb-2 lg:pb-0 scrollbar-hide mr-4">
                        <ApproverInfo title="Auditor" name={detail.auditor} icon={User} isApproved={true} date={detail.tanggal_audit} />
                        <div className="h-0.5 w-4 bg-grey/30"></div>
                        <ApproverInfo title="Spv Area (PIC)" name={detail.nama_pic_capa} icon={User} isApproved={true} date={detail.tgl_submit_capa || detail.tanggal_audit} /> 
                        <div className="h-0.5 w-4 bg-grey/30"></div>
                        
                        {/* [FIX] Gunakan isStatusMatch untuk logika isCurrent agar lingkaran biru muncul */}
                        <ApproverInfo 
                            title="QS Supervisor" 
                            name={detail.nama_qs_spv} 
                            icon={UserCheck} 
                            isApproved={!!detail.tgl_approve_qs_spv && detail.tgl_approve_qs_spv !== ''} 
                            date={detail.tgl_approve_qs_spv} 
                            isCurrent={isStatusMatch(detail.status_laporan, "WAITING_QS_SPV", "WAITING QS SPV")} 
                        />
                        <div className="h-0.5 w-4 bg-grey/30"></div>
                        
                        <ApproverInfo 
                            title="Manager Area" 
                            name={detail.nama_mgr_area} 
                            icon={Briefcase} 
                            isApproved={!!detail.tgl_approve_mgr_area && detail.tgl_approve_mgr_area !== ''} 
                            date={detail.tgl_approve_mgr_area} 
                            isCurrent={isStatusMatch(detail.status_laporan, "WAITING_MGR_AREA", "WAITING MGR AREA")} 
                        />
                        <div className="h-0.5 w-4 bg-grey/30"></div>
                        
                        <ApproverInfo 
                            title="QS Manager" 
                            name={detail.nama_mgr_qs} 
                            icon={ShieldCheck} 
                            isApproved={!!detail.tgl_approve_mgr_qs && detail.tgl_approve_mgr_qs !== ''} 
                            date={detail.tgl_approve_mgr_qs} 
                            isCurrent={isStatusMatch(detail.status_laporan, "WAITING_MGR_QS", "WAITING MGR QS")} 
                        />
                    </div>

                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        {access.canAct ? (
                            isBundlingMode ? (
                                /* TOMBOL BUNDLING ATAS BAWAH (STACK) */
                                <div className="flex flex-col gap-2 min-w-[220px]">
                                    <button 
                                        onClick={() => handleBundlingSubmit('APPROVE')}
                                        disabled={isProcessing}
                                        className="flex items-center justify-center px-6 py-2 rounded-lg font-bold shadow-lg transition-all bg-biru text-putih hover:bg-blue-800 disabled:opacity-50 w-full"
                                    >
                                        {isProcessing ? "Processing..." : <><CheckCircle className="w-5 h-5 mr-2"/> Approve All</>}
                                    </button>
                                    
                                    <button 
                                        onClick={() => setBundleRejectModal(true)}
                                        disabled={isProcessing}
                                        className="flex items-center justify-center px-4 py-2 rounded-lg font-bold shadow-sm transition-all bg-red-600 text-putih hover:bg-red-700 disabled:opacity-50 w-full"
                                    >
                                        <XCircle className="w-5 h-5 mr-2"/>Reject All
                                    </button>
                                </div>
                            ) : (
                                /* TOMBOL PER ITEM UNTUK QS SPV */
                                <>
                                    <div className="text-right text-xs text-grey flex flex-col items-end">
                                        <p className="mb-1">Keputusan: <strong className="text-hijau">{approvedCount} Approve</strong> / <strong className="text-red-500">{totalItems - approvedCount - pendingCount} Reject</strong></p>
                                        {!isReadyToFinalQS && <p className="text-orange-500 font-medium">Selesaikan {pendingCount} item lagi.</p>}
                                    </div>
                                    <button 
                                        disabled={!isReadyToFinalQS || isProcessing}
                                        onClick={() => setMainApproveModal(true)}
                                        className={`flex items-center px-6 py-3 rounded-lg font-bold shadow-lg transition-all 
                                            ${!isReadyToFinalQS 
                                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                                                : hasRejections 
                                                    ? 'bg-red-600 text-putih hover:bg-red-700' 
                                                    : 'bg-biru text-putih hover:bg-blue-800'}`}
                                    >
                                        {isProcessing ? "Processing..." : <><CheckCircle className="w-5 h-5 mr-2"/> {hasRejections ? "Submit & Return" : "Submit & Approve"}</>}
                                    </button>
                                </>
                            )
                        ) : (
                            <div className="bg-grey/10 px-4 py-2 rounded text-grey text-sm font-bold border border-grey/20">{access.message}</div>
                        )}
                    </div>
                </div>
            </div>

            <ItemRejectModal isOpen={!!rejectItemModal} onClose={() => setRejectItemModal(null)} onConfirm={handleRejectItemLocal} item={itemBeingRejected} />
            <BundleRejectModal isOpen={bundleRejectModal} onClose={() => setBundleRejectModal(false)} onConfirm={(r) => handleBundlingSubmit('REJECT', r)} />
            <MainApproveModal isOpen={mainApproveModal} onClose={() => setMainApproveModal(false)} onConfirm={handleBatchSubmitQS} currentRole={access.role || "Approver"} hasRejections={hasRejections} />
        </div>
    )
}