'use client'

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Toaster, toast } from 'react-hot-toast'
import { 
    ArrowLeft, CheckCircle, UploadCloud, 
    ChevronDown, ChevronUp, Paperclip, 
    ShieldCheck, X, XCircle, FileEdit, CheckSquare,
    Calendar, UserX, Send, Info, RotateCcw, Lock,
    Check
} from 'lucide-react'
import Link from 'next/link'
import { fetchWithAuth } from '@/utils/api'
import { AuditHeaderInfo } from '@/types/audit'

/* --- INTERFACES --- */
interface VerificationItem {
    id?: number | string 
    item_id?: number | string | any
    temuan_id?: number | string
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
    
    justification?: 'Temuan' | 'Observasi' | null

    pic_user_id?: number | string | null 
    pic_name?: string | null 
    
    bukti_perbaikan?: string[] | null
    catatan_perbaikan?: string | null 
    tgl_upload_bukti?: string | null

    bukti_verifikasi?: string[] | null
    catatan_verifikasi?: string | null 
    tgl_verifikasi?: string | null
    verification_status?: string | null 
    catatan_verifikasi_bukti?: string | null 
    
    hasVerification?: boolean 

    capa?: {
        root_cause: string
        corrective_action: string
        due_date: string
    }
    [key: string]: any
}

const getHeaderStatusBadge = (status?: string) => {
    switch (status) {
        case 'READY_FOR_CAPA':
            return (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-biru/10 text-biru border border-biru/20">
                    Ready for Evidence
                </span>
            )

        case 'EVIDENCE_VERIF_PROGRESS':
            return (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-biru/10 text-biru border border-biru/20">
                    Menunggu Verifikasi
                </span>
            )

        case 'FINAL_CLOSING':
            return (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-hijau/10 text-hijau border border-hijau/20">
                    Final Review
                </span>
            )

        case 'CLOSED':
            return (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-hijau text-putih">
                    CLOSED
                </span>
            )

        case 'EVIDENCE_REJECTED_AUDITOR':
            return (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-600 border border-red-200">
                    Returned by QS Staff
                </span>
            )

        case 'EVIDENCE_REJECTED_QSSPV':
            return (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-600 border border-red-200">
                    Returned by QS SPV
                </span>
            )

        default:
            return (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-grey/10 text-grey border border-grey/20">
                    {status || '-'}
                </span>
            )
        }
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
                <div className="mt-1">
                    {getHeaderStatusBadge(info.status_laporan)}
                </div>
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

/* --- MODAL UPLOAD (VERIFIKASI) --- */
const VerificationUploadModal = ({ item, onClose, onSave }: { 
    item: VerificationItem; 
    onClose: () => void; 
    onSave: (id: number | string, files: File[], notes: string) => void; 
}) => {
    const [selectedFiles, setSelectedFiles] = useState<File[]>([])
    const [notes, setNotes] = useState(item.catatan_verifikasi || '') 
    const fileRef = useRef<HTMLInputElement | null>(null)

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return
        const files = Array.from(e.target.files)
        const validFiles: File[] = []
        
        files.forEach(file => {
            if (file.size > 5 * 1024 * 1024) { 
                toast.error(`File "${file.name}" terlalu besar (>5MB)`)
            } else {
                validFiles.push(file)
            }
        })

        setSelectedFiles(prev => [...prev, ...validFiles])
        if(e.target) e.target.value = '' 
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (selectedFiles.length === 0 && !notes) return toast.error('Harap lampirkan bukti verifikasi atau catatan.')
        
        const itemId = item.item_id ?? item.id ?? 0;
        onSave(itemId, selectedFiles, notes)
    }

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-hitam/60 p-4 font-arial backdrop-blur-sm">
            <div className="bg-putih w-full max-w-lg p-6 rounded-xl shadow-2xl border-t-4 border-biru animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h4 className="text-lg font-bold text-hitam flex items-center">
                        <CheckSquare className="w-6 h-6 text-biru mr-2"/> 
                        Upload Bukti Verifikasi (Opsional)
                    </h4>
                    <button onClick={onClose}><X className="w-6 h-6 text-grey hover:text-hitam" /></button>
                </div>
                
                <div className="bg-biru/5 p-4 rounded-lg mb-6 border border-biru/20 text-sm">
                    <p className="font-bold text-biru mb-1">Temuan: {item.item_checklist_text}</p>
                    <p className="text-biru/80 mb-0 text-xs leading-relaxed">{item.deskripsi_temuan}</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-xs font-bold text-grey mb-2 uppercase tracking-wide">Lampiran Bukti Verifikasi</label>
                        <input ref={fileRef} type="file" multiple onChange={handleFileChange} className="hidden" accept="image/*,application/pdf" />
                        
                        <button type="button" onClick={() => fileRef.current?.click()} className="w-full py-6 border-2 border-dashed border-biru/30 rounded-lg bg-putih hover:bg-biru/5 text-biru font-medium flex flex-col items-center justify-center transition group">
                            <div className="p-3 bg-biru/10 rounded-full shadow-sm mb-2 group-hover:scale-110 transition-transform">
                                <UploadCloud className="w-6 h-6 text-biru"/>
                            </div>
                            <span className="text-sm">Klik untuk pilih file verifikasi</span>
                        </button>
                        <p className="text-[10px] text-grey text-center mt-1">Maksimal ukuran file: 5MB per file (Format: Gambar/PDF)</p>

                        <div className="mt-3 space-y-2 max-h-24 overflow-y-auto">
                            {selectedFiles.map((f, i) => (
                                <div key={i} className="flex justify-between items-center text-sm bg-putih p-2.5 rounded border border-grey/30 shadow-sm">
                                    <span className="truncate max-w-[250px] text-hitam flex items-center">
                                        <Paperclip className="w-3 h-3 mr-2 text-grey"/> {f.name}
                                    </span>
                                    <button type="button" onClick={() => setSelectedFiles(prev => prev.filter((_, idx) => idx !== i))}><X className="w-4 h-4 text-red-500 hover:text-red-700"/></button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-grey mb-2 uppercase tracking-wide flex items-center">
                            <FileEdit className="w-3 h-3 mr-1"/> Catatan Verifikasi
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full p-3 border border-grey/40 rounded-lg text-sm focus:ring-2 focus:ring-biru/50 focus:border-biru outline-none transition shadow-sm resize-none text-hitam placeholder-grey"
                            rows={3}
                            placeholder="Tulis hasil verifikasi atau komentar..."
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-3 border-t border-grey/10">
                        <button type="button" onClick={onClose} className="px-5 py-2.5 bg-putih border border-grey/40 text-grey rounded-lg hover:bg-grey/5 font-bold text-sm transition">
                            Batal
                        </button>
                        
                        <button type="submit" className="px-6 py-2.5 bg-biru text-putih rounded-lg hover:opacity-90 font-bold shadow-md hover:shadow-lg text-sm transition flex items-center">
                            <CheckCircle className="w-4 h-4 mr-2"/> Simpan
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

/* --- MODAL REJECT (ALASAN) --- */
const RejectModal = ({ isOpen, onClose, onConfirm }: { isOpen: boolean; onClose: () => void; onConfirm: (reason: string) => void }) => {
    const [reason, setReason] = useState('')
    
    const handleSubmit = () => {
        if(!reason.trim()) return toast.error("Alasan penolakan wajib diisi!")
        onConfirm(reason)
        setReason('')
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 font-arial backdrop-blur-sm">
            <div className="bg-white w-full max-w-md p-6 rounded-xl shadow-2xl animate-in fade-in zoom-in duration-200">
                <h3 className="text-lg font-bold text-red-600 mb-2 flex items-center">
                    <XCircle className="w-5 h-5 mr-2"/> Tolak Bukti Perbaikan
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                    Item ini akan dikembalikan ke PIC. Jelaskan alasannya:
                </p>
                <textarea 
                    value={reason} 
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-red-200 outline-none text-sm"
                    rows={3}
                    placeholder="Contoh: Foto buram, tidak sesuai standar..."
                />
                <div className="flex justify-end gap-2 mt-4">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-100 rounded text-gray-700 text-sm font-bold hover:bg-gray-200">Batal</button>
                    <button onClick={handleSubmit} className="px-4 py-2 bg-red-600 text-white rounded text-sm font-bold hover:bg-red-700">Simpan Penolakan</button>
                </div>
            </div>
        </div>
    )
}

/* --- CONFIRM SUBMIT MODAL --- */
const ConfirmSubmitModal = ({ isOpen, onClose, onConfirm, hasReject }: { isOpen: boolean; onClose: () => void; onConfirm: () => void; hasReject: boolean }) => {
    if (!isOpen) return null
    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-hitam/60 p-4 font-arial backdrop-blur-sm">
            <div className={`bg-putih w-full max-w-md p-6 rounded-xl shadow-2xl border-t-4 animate-in fade-in zoom-in duration-200 ${hasReject ? 'border-orange-500' : 'border-hijau'}`}>
                <div className="flex justify-between items-center mb-4">
                    <h4 className="text-lg font-bold text-hitam flex items-center">
                        {hasReject ? <RotateCcw className="w-6 h-6 text-orange-500 mr-2"/> : <CheckCircle className="w-6 h-6 text-hijau mr-2"/>}
                        {hasReject ? 'Kembalikan ke PIC?' : 'Submit?'}
                    </h4>
                    <button onClick={onClose}><XCircle className="w-6 h-6 text-grey hover:text-hitam transition-colors" /></button>
                </div>
                <div className={`flex items-start gap-3 mb-6 p-3 rounded-lg border ${hasReject ? 'bg-orange-50 border-orange-200' : 'bg-hijau/10 border-hijau/20'}`}>
                    <Info className={`w-6 h-6 mt-0.5 flex-shrink-0 ${hasReject ? 'text-orange-500' : 'text-hijau'}`} />
                    <p className="text-sm text-hitam">
                        {hasReject 
                            ? <>Terdapat item yang <strong>DITOLAK</strong>. Laporan akan dikembalikan ke PIC untuk perbaikan ulang.</>
                            : <>Semua item telah <strong>DISETUJUI</strong>. Laporan akan masuk ke tahap Final Closing.</>
                        }
                    </p>
                </div>
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 bg-putih border border-grey/40 text-grey rounded hover:bg-grey/5 transition-colors font-medium text-sm">Batal</button>
                    <button onClick={onConfirm} className={`px-6 py-2 text-putih rounded font-bold hover:opacity-90 transition-colors shadow-md flex items-center text-sm ${hasReject ? 'bg-orange-500' : 'bg-hijau'}`}>
                        {hasReject ? 'Ya, Kembalikan' : 'Ya, Submit'}
                    </button>
                </div>
            </div>
        </div>
    )
}

/* ==========================================================================
   MAIN PAGE: Verifikasi Bukti Page
   ========================================================================== */
export default function VerifikasiBuktiPage() {
    const ApproveConfirmationModal = ({ isOpen, onClose, onConfirm }: { isOpen: boolean; onClose: () => void; onConfirm: () => void }) => {
        if (!isOpen) return null;
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-hitam/50 p-4 font-arial backdrop-blur-sm">
                <div className="bg-putih w-full max-w-sm p-8 rounded-2xl shadow-2xl animate-in fade-in zoom-in duration-200 text-center">
                    <div className="flex justify-center mb-4">
                        <div className="w-16 h-16 bg-hijau/10 rounded-full flex items-center justify-center">
                            <CheckCircle className="w-10 h-10 text-hijau" />
                        </div>
                    </div>
                    <h3 className="text-xl font-bold text-hitam mb-2">Konfirmasi Approve</h3>
                    <p className="text-sm text-grey leading-relaxed mb-8">
                        Apakah Anda yakin ingin menyetujui laporan ini?<br/>
                        Data akan diteruskan ke <span className="font-bold">PIC CAPA</span> untuk ditindaklanjuti.
                    </p>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="flex-1 py-3 bg-grey/10 text-hitam rounded-xl font-bold hover:bg-grey/20 transition-colors">
                            Batal
                        </button>
                        <button onClick={onConfirm} className="flex-1 py-3 bg-hijau text-putih rounded-xl font-bold hover:opacity-90 shadow-lg shadow-hijau/20 transition-all">
                            Ya, Setujui
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const [approveModalOpen, setApproveModalOpen] = useState(false);
    const [pendingApproveId, setPendingApproveId] = useState<number | null>(null);
    
    const router = useRouter()
    const params = useParams() as any
    const buktiId = params?.buktiId || params?.id || ''
    
    const [isLoading, setIsLoading] = useState(true)
    const [detail, setDetail] = useState<AuditHeaderInfo | null>(null)
    const [items, setItems] = useState<VerificationItem[]>([])
    
    const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})
    const [isSaving, setIsSaving] = useState(false)
    
    // Modal State
    const [modalItemId, setModalItemId] = useState<number | string | null>(null)
    const [rejectModalOpen, setRejectModalOpen] = useState(false)
    const [selectedItemId, setSelectedItemId] = useState<number | null>(null)
    
    const [userList, setUserList] = useState<any[]>([]);

    const [currentUser, setCurrentUser] = useState<any>(null)

    useEffect(() => {
        try {
            const user = localStorage.getItem('user_data')
            if (user) setCurrentUser(JSON.parse(user))
        } catch {}
    }, [])

    const normalize = (v: string) =>
        (v || '').toLowerCase().trim()

    const isQSStaff = useMemo(() => {
        if (!currentUser) return false
        const role = normalize(currentUser.role || currentUser.role_name || '')
        return role.includes('qs') && role.includes('staff')
    }, [currentUser])


    const isPatrolHSE = useMemo(() => {
        if (!detail?.nama_jenis_audit) return false;
        return detail.nama_jenis_audit.toLowerCase().includes("patrol hse");
    }, [detail?.nama_jenis_audit]);

    /* --- DATA FETCHING --- */
    const fetchData = useCallback(async () => {
        if (!buktiId) return;
        try {
            const res = await fetchWithAuth(`/api/audit/laporan-temuan/detailed/${buktiId}`, { cache: 'no-store' })
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
                    if (it.bukti_temuan) {
                         const val = String(it.bukti_temuan).trim()
                         if(val.startsWith('[')) existingFiles = JSON.parse(val)
                         else existingFiles = [val]
                    }
                    if (it.bukti_perbaikan) {
                         if (Array.isArray(it.bukti_perbaikan)) evidenceFiles = it.bukti_perbaikan
                         else {
                             const val = String(it.bukti_perbaikan).trim()
                             if(val.startsWith('[')) evidenceFiles = JSON.parse(val)
                             else if(val !== '' && val !== 'null') evidenceFiles = [val]
                         }
                    }
                    if (it.bukti_verifikasi) {
                        if (Array.isArray(it.bukti_verifikasi)) verificationFiles = it.bukti_verifikasi
                        else {
                            const val = String(it.bukti_verifikasi).trim()
                            if(val.startsWith('[')) verificationFiles = JSON.parse(val)
                            else if(val !== '' && val !== 'null') verificationFiles = [val]
                        }
                    }
                } catch { existingFiles = [] }

                // Mapping ke VerificationItem
                const itemData: VerificationItem = {
                    item_id: it.item_id,
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
                    
                    bukti_perbaikan: evidenceFiles, 
                    catatan_perbaikan: it.catatan_perbaikan || null,
                    tgl_upload_bukti: it.tgl_upload_bukti || it.TglUploadBukti || null,

                    bukti_verifikasi: verificationFiles,
                    catatan_verifikasi: it.catatan_verifikasi || null, // Catatan Upload
                    tgl_verifikasi: it.tgl_verifikasi || null, // [NEW] Tanggal Verifikasi
                    
                    // Status Verifikasi (Approval)
                    verification_status: it.hasil_verifikasi || null,   
                    catatan_verifikasi_bukti: it.catatan_verifikasi_bukti || null,

                    status_evidence: it.status_evidence || null,
                    
                    // Helper Flag
                    hasVerification: !!((it.hasil_verifikasi && it.hasil_verifikasi !== 'WAITING') || verificationFiles.length > 0),

                    pic_user_id: it.pic_user_id,
                    pic_name: it.pic_name || it.PicName || it.picName || null,
                    justification: it.justification || it.justifikasi || '-',
                    
                    status: 'NOK', // Default

                    capa: {
                        root_cause: it.root_cause || '-',
                        corrective_action: it.corrective_action || '-',
                        due_date: it.due_date ? it.due_date.split('T')[0] : ''
                    }
                }
                return itemData;
            })
            setItems(mappedItems)

        } catch (e) { console.error(e); toast.error("Gagal mengambil detail laporan") } 
        finally { setIsLoading(false) }
    }, [buktiId])

    useEffect(() => {
        if (!buktiId) return;
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
    }, [buktiId, fetchData]);

    const getPicName = (item: VerificationItem) => {
        if (item.pic_name && item.pic_name !== '-') return item.pic_name;
        const id = item.pic_user_id;
        if (id) {
            const user = userList.find((u) => String(u.id) === String(id));
            if (user) return user.name;
        }
        return '-';
    }

    const formatDateShort = (str?: string) => {
        if(!str || str === 'null') return '-'
        const d = new Date(str)
        return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    }

const visibleItems = useMemo(() => {
    if (!items || items.length === 0) return []

    return items.filter(it => 
        it.status_evidence === 'EVIDENCE_VERIF_PROGRESS'
    )
}, [items])

const groupedItems = useMemo(() => {
    const groups = new Map<string, Map<string, VerificationItem[]>>()
    
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

    const handleUploadVerification = async (itemId: number | string, files: File[], notes: string) => {
    setIsSaving(true)
    const toastId = toast.loading('Menyimpan bukti verifikasi & memproses approval...')
    try {
        const formData = new FormData()
        files.forEach(f => formData.append('files', f))
        if(notes) formData.append('catatan_verifikasi', notes)

        const token = localStorage.getItem('token'); 
        const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || ''

        // --- STEP 1: Upload File & Catatan ---
        const resUpload = await fetch(`${API_BASE}/api/audit/${buktiId}/upload-verification/${itemId}`, { 
            method: 'POST', 
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData 
        })

        if (!resUpload.ok) {
            const errJson = await resUpload.json().catch(() => ({}))
            throw new Error(errJson.error || 'Gagal upload verifikasi')
        }

        // --- STEP 2: Jalankan Fungsi Approve (Pindah Status ke FINAL_CLOSING) ---
        // Kita panggil API Approve tepat setelah upload berhasil
        const resApprove = await fetchWithAuth(`/api/audit/${buktiId}/item/${itemId}/approve`, { 
            method: 'POST' 
        })

        if (!resApprove.ok) throw new Error("Gagal mengubah status ke Final Review")
        
        toast.success('Item Berhasil Diverifikasi & Terkirim ke QS Supervisor!', { id: toastId })
        
        // Tutup modal
        setModalItemId(null)

        // Update state lokal agar item langsung hilang dari antrean "Waiting Verification" Auditor
        setItems(prev => prev.map(it => 
            String(it.item_id) === String(itemId) ? { ...it, status_evidence: 'FINAL_CLOSING' } : it
        ))

        // Refresh data dari server untuk memastikan sinkronisasi
        await fetchData(); 

    } catch (e: any) {
        toast.error(`Error: ${e.message}`, { id: toastId })
    } finally {
        setIsSaving(false)
    }
}

    // 2. Approve Item
    const openApproveModal = (itemId: number) => {
    setPendingApproveId(itemId);
    setApproveModalOpen(true);
    };

    const handleConfirmApprove = () => {
        if (!pendingApproveId) return;

        // Kita lakukan "Optimistic Update" di frontend saja
        // Status diubah ke APPROVED agar tombol upload terbuka
        setItems(prev => prev.map(it => 
            it.item_id === pendingApproveId ? { ...it, verification_status: 'APPROVED' } : it
        ));

        toast.success("Item disetujui. Silakan upload bukti verifikasi untuk mengirim.");
        setApproveModalOpen(false);
        setPendingApproveId(null);
    };

    // 3. Reject Item (Buka Modal)
    const openRejectModal = (itemId: number) => {
        setSelectedItemId(itemId)
        setRejectModalOpen(true)
    }

    // 4. Confirm Reject
    const handleRejectConfirm = async (reason: string) => {
    if(!selectedItemId) return
    const toastId = toast.loading("Mengirim alasan penolakan ke PIC...")
    try {
        const res = await fetchWithAuth(`/api/audit/${buktiId}/item/${selectedItemId}/reject`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason })
        })
        if(!res.ok) throw new Error("Gagal reject")

        // Update state lokal: Status berubah -> Item otomatis hilang dari list Auditor
        setItems(prev => prev.map(it => it.item_id === selectedItemId ? { 
            ...it, 
            status_evidence: 'EVIDENCE_REJECTED_AUDITOR', 
            verification_status: 'REJECTED', 
            catatan_verifikasi_bukti: reason 
        } : it))
        
        toast.success("Item Ditolak & Dikembalikan ke PIC", { id: toastId })
        setRejectModalOpen(false)
        setSelectedItemId(null)
    } catch (e) {
        toast.error("Gagal mengirim penolakan", { id: toastId })
    }
}

    // 5. Reset Status
    const handleReset = async (itemId: number) => {
        const toastId = toast.loading("Resetting...")
        try {
            const res = await fetchWithAuth(`/api/audit/${buktiId}/item/${itemId}/reset`, { method: 'POST' })
            if(!res.ok) throw new Error("Gagal reset")
            
            setItems(prev => prev.map(it => it.item_id === itemId ? { ...it, verification_status: null, status_evidence: 'EVIDENCE_VERIF_PROGRESS',tgl_verifikasi: null }: it))
            toast.success("Status direset", { id: toastId })
        } catch (e) {
            toast.error("Gagal reset", { id: toastId })
        }
    }

    // Helper Counts
    const countRejected = items.filter(it => it.verification_status === 'REJECTED' || it.verification_status === 'REVISION').length
    const countApproved = items.filter(it => it.verification_status === 'APPROVED').length
    const countTotal = items.length
    
    // Ready jika semua item sudah punya status (Approved/Rejected)
    const isAllVerified = countTotal > 0 && (countApproved + countRejected === countTotal);

    if (isLoading) return <div className="p-12 text-center text-grey">Memuat data...</div>
    if (!detail) return <div className="p-12 text-center text-red-500">Data tidak ditemukan.</div>

    return (
        <div className="font-arial pb-64 bg-putih min-h-screen">
            <Toaster position="top-center"/>
            <div className="px-2 mt-4">
                 <Link href="/verifikasi" className="flex items-center text-sm text-biru hover:underline mb-4 font-medium">
                    <ArrowLeft className="w-4 h-4 mr-1" /> Kembali ke Daftar
                </Link>
            </div>

            {detail && <AuditHeader info={detail} totalItems={items.length} />}
            {!isQSStaff && (
                <div className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-700">
                Mode <b>Read Only</b>. Hanya QS Staff yang dapat melakukan verifikasi.
                </div>
            )}


            {/* Container Table */}
            <div className="bg-putih p-6 rounded-lg shadow-md mb-8 border border-grey/30">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-3">
                        <h3 className="text-xl font-bold text-hitam">Verifikasi Bukti Perbaikan</h3>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border bg-grey/10 text-grey border-grey/20`}>
                            Progress Verifikasi: {countApproved + countRejected} / {items.length}
                        </span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-grey/30 border-x border-grey/30">
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
                                <th className="px-6 py-3 text-center text-xs font-bold text-grey uppercase w-10">Detail</th>
                                
                                {/* KOLOM BARU: ACTION APPROVE/REJECT */}
                                <th className="px-6 py-3 text-center text-xs font-bold text-grey uppercase min-w-[140px]">Action</th>
                                <th className="px-6 py-3 text-center text-xs font-bold text-grey uppercase w-10">Upload</th>
                            </tr>
                        </thead>
                        <tbody className="bg-putih divide-y divide-grey/30">
                            {visibleItems.length === 0 ? (
                                <tr>
                                    <td colSpan={12} className="py-20 text-center bg-grey/5">
                                        <div className="flex flex-col items-center justify-center text-grey">
                                            <div className="p-4 bg-hijau/10 rounded-full mb-3">
                                                <CheckCircle className="w-12 h-12 text-hijau" />
                                            </div>
                                            <p className="font-bold text-hitam text-lg">Semua tugas verifikasi selesai!</p>
                                            <p className="text-sm max-w-xs mx-auto">
                                                Baris item akan muncul otomatis di sini setelah PIC mengupload bukti perbaikan.
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                /* --- RENDER DATA JIKA ADA --- */
                                Array.from(groupedItems.entries()).map(([kategori, subGroups]) => (
                                    <React.Fragment key={kategori}>
                                        <tr className="bg-biru/5">
                                            <td colSpan={12} className="px-4 py-3 text-sm font-bold text-biru uppercase tracking-wide">
                                                {kategori}
                                            </td>
                                        </tr>
                                        {Array.from(subGroups.entries()).map(([sub, subItems]) => (
                                            <React.Fragment key={sub}>
                                                {subItems.map((item, idx) => {
                                                    const rowId = String(item.item_id ?? item.id)
                                                    const isExpanded = expandedRows[rowId]
                                                    const filesTemuan = Array.isArray(item.bukti_temuan) ? item.bukti_temuan : []
                                                    
                                                    const isApproved = item.verification_status === 'APPROVED'
                                                    const isRejected = item.verification_status === 'REJECTED'
                                                    const isWaiting = !isApproved && !isRejected
                                                    const isLocked = !isQSStaff || item.status_evidence === 'CLOSED';

                                                    return (
                                                        <React.Fragment key={rowId}>
                                                            <tr className={`transition-colors ${isApproved ? 'bg-green-50' : isRejected ? 'bg-red-50' : 'hover:bg-grey/5'}`}>
                                                                <td className="px-4 py-4 text-sm text-hitam text-center font-medium align-top">{idx + 1}</td>
                                                                <td className="px-6 py-4 text-sm text-hitam leading-relaxed align-top font-semibold">{item.item_checklist_text}</td>
                                                                <td className="px-6 py-4 text-sm text-hitam align-top">{item.referensi_doc || '-'}</td>
                                                                <td className="px-6 py-4 text-sm text-hitam align-top"><p className="mb-2">{item.deskripsi_temuan || '-'}</p></td>
                                                                <td className="px-6 py-4 text-sm text-hitam align-top">
                                                                    <div className="flex flex-col gap-1">
                                                                        {filesTemuan.length > 0 ? filesTemuan.map((f, i) => <FileDisplay key={i} filePath={f} />) : '-'}
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4 text-sm text-hitam align-top">{item.lokasi_temuan || '-'}</td>
                                                                <td className="px-6 py-4 text-sm text-biru font-semibold align-top">{getPicName(item)}</td>
                                                                <td className="px-6 py-4 text-sm text-hitam align-top">
                                                                    <span className="px-2 py-1 rounded text-xs font-bold bg-grey/10 border border-grey/20 text-hitam">
                                                                        {item.kategori_temuan || '-'}
                                                                    </span>
                                                                </td>
                                                                <td className="px-6 py-4 text-center align-top">
                                                                    <button onClick={() => toggleRow(rowId)} className="p-2 bg-grey/10 rounded hover:bg-grey/20">
                                                                        {isExpanded ? <ChevronUp className="w-4 h-4 text-grey" /> : <ChevronDown className="w-4 h-4 text-grey" />}
                                                                    </button>
                                                                </td>
                                                                <td className="px-6 py-4 text-center align-top">
                                                                    {isWaiting && (
                                                                        <div className="flex justify-center gap-2">
                                                                            <button 
                                                                                disabled={isLocked}
                                                                                onClick={() => openApproveModal(Number(item.item_id))}
                                                                                className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded hover:bg-green-50 hover:border-hijau text-gray-400 hover:text-hijau transition-all shadow-sm"
                                                                            ><Check className="w-5 h-5"/></button>
                                                                            <button 
                                                                                disabled={isLocked}
                                                                                onClick={() => openRejectModal(Number(item.item_id))}
                                                                                className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded hover:bg-red-50 hover:border-red-500 text-gray-400 hover:text-red-600 transition-all shadow-sm"
                                                                            ><X className="w-5 h-5"/></button>
                                                                        </div>
                                                                    )}
                                                                    {isApproved && <span className="text-hijau font-bold text-xs">OK</span>}
                                                                    {isRejected && <span className="text-red-600 font-bold text-xs">DITOLAK</span>}
                                                                </td>
                                                                <td className="px-4 py-4 text-center align-top">
                                                                    <button 
                                                                        onClick={() => setModalItemId(item.item_id ?? item.id)}
                                                                        disabled={!isApproved || isLocked}
                                                                        className={`p-2 rounded border transition shadow-sm inline-flex items-center justify-center ${isApproved ? 'bg-putih border-biru/30 hover:bg-biru/5 text-biru cursor-pointer' : 'bg-grey/10 border-grey/20 text-grey/40 cursor-not-allowed opacity-50'}`}
                                                                    ><UploadCloud className="w-4 h-4" /></button>
                                                                </td>
                                                            </tr>
                                                            {isExpanded && (
                                                                <tr className="bg-biru/5 border-b-2 border-grey/20">
                                                                    <td colSpan={2}></td>
                                                                    <td colSpan={10} className="px-6 py-4 pb-6">
                                                                        <div className="bg-putih p-5 rounded-lg border border-biru/20 shadow-sm relative">
                                                                            <div className="absolute top-0 left-0 bg-biru text-putih text-[10px] px-2 py-1 rounded-br-lg rounded-tl-lg font-bold uppercase tracking-wider">
                                                                                Data CAPA & Bukti
                                                                            </div>
                                                                            
                                                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-sm mt-4">
                                                                                
                                                                                {/* KOLOM 1: DATA CAPA (ROOT CAUSE, REMEDIAL, DUE DATE) */}
                                                                                <div className="space-y-4 border-r border-grey/10 pr-4">
                                                                                    <div>
                                                                                        <strong className="block text-grey text-[10px] uppercase tracking-wider mb-1 font-bold">Root Cause</strong>
                                                                                        <p className="text-hitam font-medium">{item.capa?.root_cause || '-'}</p>
                                                                                    </div>
                                                                                    <div>
                                                                                        <strong className="block text-grey text-[10px] uppercase tracking-wider mb-1 font-bold">Tindakan Remedial</strong>
                                                                                        <p className="text-hitam font-medium">{item.capa?.corrective_action || '-'}</p>
                                                                                    </div>
                                                                                    <div>
                                                                                        <strong className="block text-grey text-[10px] uppercase tracking-wider mb-1 font-bold">Due Date</strong>
                                                                                        <p className="text-biru font-bold flex items-center gap-1.5">
                                                                                            <Calendar className="w-3.5 h-3.5" />
                                                                                            {item.capa?.due_date ? new Date(item.capa.due_date).toLocaleDateString('id-ID') : '-'}
                                                                                        </p>
                                                                                    </div>
                                                                                </div>

                                                                                {/* KOLOM 2: BUKTI PERBAIKAN (PIC) */}
                                                                                <div className="space-y-4 border-r border-grey/10 pr-4">
                                                                                    <div>
                                                                                        <strong className="block text-[11px] uppercase tracking-wide mb-1 text-biru font-bold">Bukti Perbaikan (PIC)</strong>
                                                                                        {item.tgl_upload_bukti && item.tgl_upload_bukti !== '-' ? (
                                                                                            <p className="text-[10px] text-grey mb-2 font-medium italic">
                                                                                                Diupload pada: {formatDateShort(item.tgl_upload_bukti || "")}
                                                                                            </p>
                                                                                        ) : (
                                                                                            <p className="text-[10px] text-orange-500 mb-2 italic">Belum ada bukti</p>
                                                                                        )}
                                                                                        <div className="flex flex-col gap-1 mt-1">
                                                                                            {item.bukti_perbaikan && item.bukti_perbaikan.length > 0 ? (
                                                                                                item.bukti_perbaikan.map((f: string, i: number) => <FileDisplay key={i} filePath={f} label="Fixed" />)
                                                                                            ) : null}
                                                                                        </div>
                                                                                    </div>

                                                                                    <div>
                                                                                        <strong className="block text-grey text-[10px] uppercase tracking-wider mb-1 font-bold">Catatan PIC</strong>
                                                                                        <div className="bg-yellow-50 p-2.5 rounded border border-yellow-200 text-xs text-hitam min-h-[40px] shadow-sm">
                                                                                            {item.catatan_perbaikan && item.catatan_perbaikan !== '-' ? item.catatan_perbaikan : "-"}
                                                                                        </div>
                                                                                    </div>
                                                                                </div>

                                                                                {/* KOLOM 3: BUKTI VERIFIKASI (OPSIONAL) */}
                                                                                <div className="space-y-4">
                                                                                    <div>
                                                                                        <strong className="block text-[11px] uppercase tracking-wide mb-1 text-hijau font-bold">Bukti Verifikasi (Opsional)</strong>
                                                                                        <p className="text-[10px] text-grey mb-2 italic">
                                                                                            {item.bukti_verifikasi && item.bukti_verifikasi.length > 0 
                                                                                                ? `Diverifikasi: ${formatDateShort(item.tgl_verifikasi || "")}` 
                                                                                                : "- Tidak ada -"}
                                                                                        </p>
                                                                                        <div className="flex flex-col gap-1 mt-1">
                                                                                            {item.bukti_verifikasi && item.bukti_verifikasi.length > 0 ? (
                                                                                                item.bukti_verifikasi.map((f: string, i: number) => <FileDisplay key={i} filePath={f} label="Verif" />)
                                                                                            ) : null}
                                                                                        </div>
                                                                                    </div>

                                                                                    <div>
                                                                                        <strong className="block text-grey text-[10px] uppercase tracking-wider mb-1 font-bold">Catatan Verifikasi</strong>
                                                                                        <div className="bg-purple-50/50 p-2.5 rounded border border-purple-200 text-xs text-hitam min-h-[40px] shadow-sm">
                                                                                            {item.catatan_verifikasi_bukti || item.catatan_verifikasi || "-"}
                                                                                        </div>
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
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

           <div className="fixed bottom-0 right-0 left-0 md:left-64 bg-putih border-t-4 border-biru p-4 shadow-lg z-30">
                <div className="max-w-full px-6 flex justify-between items-center h-12">
                    <div className="text-left text-sm text-grey flex items-center gap-6">
                        <p>Total Temuan FTA: <strong>{items.length}</strong></p>
                        <p className="text-biru">Siap Diverifikasi: <strong>{visibleItems.length}</strong></p>
                        <p className="text-hijau">Menunggu PIC lain upload: <strong>{items.length - visibleItems.length}</strong></p>
                    </div>
                    <div className="text-sm text-grey italic">Action dilakukan per item.</div>
                </div>
            </div>
            {modalItemId && ( 
            <VerificationUploadModal item={items.find(it => String(it.item_id ?? it.id) === String(modalItemId))!} onClose={() => setModalItemId(null)} onSave={handleUploadVerification} />)}
            <RejectModal isOpen={rejectModalOpen} onClose={() => setRejectModalOpen(false)} onConfirm={handleRejectConfirm} />
            <ApproveConfirmationModal isOpen={approveModalOpen} onClose={() => setApproveModalOpen(false)} onConfirm={handleConfirmApprove} />
        </div>
    )
}