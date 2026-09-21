'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Toaster, toast } from 'react-hot-toast'
import { 
  ArrowLeft, X, Edit, CheckCircle, Calendar, FileText, Plus, 
  AlertTriangle, XCircle, MessageSquare, UserPlus, Send, 
  AlertCircle, Info, RefreshCw, PenTool 
} from 'lucide-react'
import Link from 'next/link'
import { fetchWithAuth } from '@/utils/api' 

/* --- INTERFACES --- */
interface TemuanItem {
  id?: number | string
  item_id?: number | string | any
  temuan_id?: number | string
  item_checklist_text?: string
  deskripsi_temuan?: string | null
  lokasi_temuan?: string | null
  bukti_temuan?: string | null
  kategori_temuan?: string | null
  referensi_doc?: string | null
  data_integrity?: string | null
  prinsip_5r?: string | null
  pic_user_id?: number | null
  
  // Kategori & Sub Kategori
  kategori?: string | null 
  sub_kategori?: string | null

  // Status Verifikasi (Penting untuk filter)
  status_verifikasi?: string
  catatan_verifikasi?: string

  // Justification
  justification?: 'Temuan' | 'Observasi' | null

  root_cause?: string
  corrective_action?: string
  preventive_action?: string
  due_date?: string
  [key: string]: any
}

interface LaporanDetail {
  pelaksanaan_id?: number | string
  no_fta?: string | null
  tanggal_audit?: string
  nama_checklist?: string
  jenis_audit?: string
  site?: string
  area?: string
  auditor?: string
  department?: string
  status_laporan?: string 
  master?: any
  note_reject?: string | null
  approver_pic_capa_names?: string
  approver_qs_spv_id?: number
  approver_mgr_area_id?: number 
  approver_mgr_qs_id?: number 
  approver_pic_capa_ids?: number[] | string 
  [key: string]: any
}

interface CapaInput {
  root_cause: string       
  corrective_action: string 
  due_date: string
}

type CapaItemWithInput = TemuanItem & { 
    capa: CapaInput; 
    existingFiles: string[] 
}

/* --- 1. AUDIT HEADER --- */
const AuditHeader = ({ info, totalItems }: { info: Partial<LaporanDetail>; totalItems: number }) => {
  const parse = (v: any) => (v == null || v === '' ? '-' : String(v))
  
  const formatDateLong = (raw?: any) => {
    const s = parse(raw)
    if (!s || s === '-') return '-'
    const d = new Date(s)
    if (!isNaN(d.getTime())) return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }).format(d)
    return s
  }

  return (
    <div className="bg-putih p-6 rounded-lg shadow-md mb-6 font-arial border border-gray-100">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
        <div><p className="text-sm font-medium text-grey">NO FTA</p><p className="text-lg font-bold text-hitam">{parse(info.no_fta)}</p></div>
        <div><p className="text-sm font-medium text-grey">Jenis Audit</p><p className="text-lg font-bold text-hitam">{parse(info.jenis_audit)}</p></div>
        <div><p className="text-sm font-medium text-grey">Auditor</p><p className="text-lg font-bold text-hitam">{parse(info.auditor)}</p></div>
        <div><p className="text-sm font-medium text-grey">Site / Area</p><p className="text-lg font-bold text-hitam">{parse(info.site)} - {parse(info.area)}</p></div>
        <div><p className="text-sm font-medium text-grey">Tgl Pelaksanaan</p><p className="text-lg font-bold text-hitam">{formatDateLong(info.tanggal_audit)}</p></div>
        <div><p className="text-sm font-medium text-grey">Jumlah Temuan</p><p className="text-lg font-bold text-hitam">{totalItems}</p></div>
        <div><p className="text-sm font-medium text-grey">PIC Area</p> <p className="text-lg font-bold text-hitam"> {info.approver_pic_capa_names || '-'}</p></div>
      </div>
    </div>
  )
}

/* --- 2. FILE DISPLAY --- */
const FileDisplay = ({ filePath }: { filePath: string }) => {
    if (!filePath || filePath === '-') return <span>-</span>
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || ''
    let normalizedPath = String(filePath).replace(/\\/g, '/')
    if (normalizedPath.startsWith('/')) normalizedPath = normalizedPath.substring(1)
    const fullUrl = `${API_BASE}/${normalizedPath}`
    const fileName = normalizedPath.split('/').pop() || 'File'
    
    return (
        <a href={fullUrl} target="_blank" rel="noopener noreferrer" className="flex items-center p-1.5 bg-gray-50 rounded border border-gray-200 hover:bg-blue-50 hover:text-blue-600 transition-colors text-xs text-gray-600 max-w-fit" title={fileName}>
            <FileText className="h-3 w-3 mr-1.5 flex-shrink-0" /><span className="truncate max-w-[100px]">{fileName}</span>
        </a>
    )
}

/* --- 3. ASSIGN PIC MODAL --- */
const AssignPicModal = ({ 
    items, 
    userList,
    onClose, 
    onConfirm 
}: { 
    items: CapaItemWithInput[]; 
    userList: any[];
    onClose: () => void; 
    onConfirm: (assignments: { item_id: number|string, pic_id: number }[]) => void;
}) => {
    const [assignments, setAssignments] = useState<Record<string, string>>({})

    const handleChange = (itemId: string | number, userId: string) => {
        setAssignments(prev => ({ ...prev, [String(itemId)]: userId }))
    }

    const handleSubmit = () => {
        const missing = items.filter(it => !assignments[String(it.item_id ?? it.id ?? it.temuan_id)])
        if (missing.length > 0) {
            return toast.error(`Mohon pilih PIC untuk semua temuan.`)
        }

        const payload = items.map(it => ({
            item_id: it.item_id ?? it.id ?? it.temuan_id,
            pic_id: Number(assignments[String(it.item_id ?? it.id ?? it.temuan_id)])
        }))
        
        onConfirm(payload)
    }

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-hitam/60 p-4 font-arial backdrop-blur-sm">
            <div className="bg-putih w-full max-w-4xl p-6 rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto border-t-4 border-biru animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h4 className="text-xl font-bold text-hitam flex items-center"><UserPlus className="w-6 h-6 text-biru mr-2"/> Assign PIC Tindakan Remedial</h4>
                        <p className="text-sm text-grey mt-1">Tentukan PIC tindakan remedial (Supervisor Area / QS Supervisor) untuk setiap temuan.</p>
                    </div>
                    <button onClick={onClose}><X className="w-6 h-6 text-grey hover:text-hitam" /></button>
                </div>

                <div className="overflow-x-auto mb-6 border rounded-lg">
                    <table className="min-w-full divide-y divide-grey/30">
                        <thead className="bg-grey/5">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-bold text-grey uppercase w-10">No</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-grey uppercase w-1/2">Temuan / Masalah</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-grey uppercase w-1/3">Pilih PIC CAPA</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-grey/20">
                            {items.map((item, idx) => (
                                <tr key={idx}>
                                    <td className="px-4 py-3 text-sm text-center align-top pt-4">{idx + 1}</td>
                                    <td className="px-4 py-3 text-sm align-top">
                                        <div className="font-semibold text-hitam mb-1">{item.item_checklist_text}</div>
                                        <div className="text-grey text-xs bg-grey/5 p-2 rounded border border-grey/10">{item.deskripsi_temuan}</div>
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                        <select 
                                            className="w-full p-2.5 border border-grey/30 rounded text-sm text-hitam focus:ring-2 focus:ring-biru outline-none bg-white"
                                            value={assignments[String(item.item_id ?? item.id ?? item.temuan_id)] || ''}
                                            onChange={(e) => handleChange(item.item_id ?? item.id ?? item.temuan_id, e.target.value)}
                                        >
                                            <option value="">-- Pilih PIC --</option>
                                            {userList.map((u: any) => (
                                                <option key={u.id} value={u.id}>{u.name}</option>
                                            ))}
                                        </select>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="flex justify-end gap-3 border-t border-grey/20 pt-4">
                    <button onClick={onClose} className="px-5 py-2.5 bg-grey/10 text-hitam font-bold rounded-lg hover:bg-grey/20 transition-colors">Batal</button>
                    <button onClick={handleSubmit} className="px-5 py-2.5 bg-biru text-putih font-bold rounded-lg hover:bg-blue-800 transition-colors shadow-lg flex items-center">
                        <CheckCircle className="w-4 h-4 mr-2" /> Simpan & Lanjut
                    </button>
                </div>
            </div>
        </div>
    )
}

/* --- 4. MODAL ISI CAPA --- */
const CapaModal = ({ 
    item, 
    detail, 
    onClose, 
    onSave 
}: { 
    item: CapaItemWithInput; 
    detail?: LaporanDetail | null; 
    onClose: () => void; 
    onSave: (id: number | string, data: CapaInput) => void;
}) => {
    const [directCause, setDirectCause] = useState(item.capa.root_cause || '')
    const [remedialAction, setRemedialAction] = useState(item.capa.corrective_action || '')
    const [dueDate, setDueDate] = useState(item.capa.due_date || '')

    const isObservasi = item.justification === 'Observasi';

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        
        if (!isObservasi) {
            if (!directCause || !remedialAction || !dueDate) {
                return toast.error('Untuk TEMUAN, semua field CAPA wajib diisi.')
            }
        }

        onSave(item.item_id ?? item.id ?? item.temuan_id ?? 0, {
            root_cause: directCause,
            corrective_action: remedialAction,
            due_date: dueDate
        })
    }

    // [STRICT CHECK] Hanya tampilkan jika status benar-benar REVISION (Ditolak)
    // Jika 'APPROVED' atau null, jangan tampilkan catatan
    const isRejectedItem = item.status_verifikasi === 'REVISION';
    const rejectReason = item.catatan_verifikasi;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-hitam/60 p-4 font-arial backdrop-blur-sm">
            <div className="bg-putih w-full max-w-2xl p-6 rounded-lg shadow-2xl max-h-[90vh] overflow-y-auto border-t-4 border-biru">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-2">
                        <Edit className="w-6 h-6 text-biru" />
                        <h4 className="text-xl font-bold text-hitam">Form Tindak Lanjut (CAPA)</h4>
                    </div>
                    <button onClick={onClose}><X className="w-6 h-6 text-grey hover:text-hitam" /></button>
                </div>

                {/* --- ALERT REVISI (Hanya jika isRejectedItem = true) --- */}
                {isRejectedItem && rejectReason && (
                     <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r-lg shadow-sm">
                        <div className="flex items-start">
                            <AlertTriangle className="w-5 h-5 text-red-600 mr-2 mt-0.5" />
                            <div>
                                <h5 className="font-bold text-red-800 text-sm">ITEM INI DITOLAK (REJECTED)</h5>
                                <p className="text-sm text-red-700 mt-1">Catatan Verifikator (QS SPV):</p>
                                <p className="text-sm text-hitam font-medium italic mt-2 bg-white p-2 border border-red-100 rounded">
                                    "{rejectReason}"
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {isObservasi && (
                    <div className="bg-green-50 border border-green-200 text-green-800 p-3 rounded-lg mb-4 text-sm flex items-center">
                        <AlertCircle className="w-4 h-4 mr-2"/>
                        <span><strong>OBSERVASI</strong> - Pengisian tindakan remedial bersifat opsional.</span>
                    </div>
                )}

                <div className="bg-grey/5 p-4 rounded-lg mb-6 border border-grey/20 text-sm space-y-2">
                    <div><span className="font-bold text-grey">Check Item:</span> <span className="text-hitam">{item.item_checklist_text}</span></div>
                    <div><span className="font-bold text-grey">Temuan:</span> <span className="text-hitam">{item.deskripsi_temuan}</span></div>
                    <div className="flex gap-4 pt-2">
                        <span className="bg-grey/10 text-hitam px-2 py-1 rounded font-semibold border border-grey/20 text-xs">Kategori: {item.kategori_temuan || '-'}</span>
                        <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded font-semibold border border-blue-100 text-xs">Lokasi: {item.lokasi_temuan || '-'}</span>
                        <span className={`px-2 py-1 rounded font-semibold border text-xs 
                            ${item.justification === 'Temuan' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-green-100 text-green-700 border-green-200'}`}>
                            {item.justification || 'Temuan'}
                        </span>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="text-sm font-bold text-hitam block mb-1">1. Direct Cause {isObservasi ? '(Opsional)' : '*'}</label>
                        <textarea 
                            value={directCause} 
                            onChange={(e) => setDirectCause(e.target.value)} 
                            className="w-full p-3 border border-grey/30 rounded-lg text-hitam focus:ring-2 focus:ring-biru outline-none transition-all bg-white" 
                            rows={3} 
                            placeholder={isObservasi ? "Opsional..." : "Jelaskan penyebab langsung dari temuan ini..."} 
                        />
                    </div>

                    <div>
                        <label className="text-sm font-bold text-hitam block mb-1">2. Tindakan Remidial {isObservasi ? '(Opsional)' : '*'}</label>
                        <textarea 
                            value={remedialAction} 
                            onChange={(e) => setRemedialAction(e.target.value)} 
                            className="w-full p-3 border border-grey/30 rounded-lg text-hitam focus:ring-2 focus:ring-biru outline-none transition-all bg-white" 
                            rows={3} 
                            placeholder={isObservasi ? "Opsional..." : "Apa tindakan perbaikan yang dilakukan?"} 
                        />
                    </div>

                    <div>
                        <label className="text-sm font-bold text-hitam block mb-1">3. Due Date (Batas Waktu) {isObservasi ? '(Opsional)' : '*'}</label>
                        <div className="relative">
                            <input 
                                type="date" 
                                value={dueDate} 
                                onChange={(e) => setDueDate(e.target.value)} 
                                className="w-full p-3 border border-grey/30 rounded-lg text-hitam focus:ring-2 focus:ring-biru outline-none pl-10 bg-white" 
                            />
                            <Calendar className="w-5 h-5 text-grey absolute left-3 top-3.5 pointer-events-none" />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-grey/20">
                        <button type="button" onClick={onClose} className="px-5 py-2.5 bg-grey/10 text-hitam rounded-lg hover:bg-grey/20">Batal</button>
                        <button type="submit" className="px-5 py-2.5 bg-biru text-putih font-bold rounded-lg hover:bg-biru/90 shadow-lg">Simpan</button>
                    </div>
                </form>
            </div>
        </div>
    )
}

/* --- 5. REJECT MODAL --- */
const RejectModal = ({ isOpen, onClose, onConfirm }: { isOpen: boolean; onClose: () => void; onConfirm: (reason: string) => void }) => {
    const [reason, setReason] = useState('')
    const handleSubmit = () => {
        if (!reason.trim()) return toast.error('Wajib diisi.')
        onConfirm(reason)
    }
    if (!isOpen) return null
    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-hitam/60 p-4 font-arial backdrop-blur-sm">
            <div className="bg-putih w-full max-w-md p-6 rounded-xl shadow-2xl border-t-4 border-red-500 animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="text-lg font-bold text-hitam flex items-center"><XCircle className="w-5 h-5 text-red-500 mr-2"/> Reject / Kembalikan</h4>
                    <button onClick={onClose}><X className="w-5 h-5 text-grey hover:text-hitam" /></button>
                </div>
                <p className="text-sm text-grey mb-4">Temuan akan dikembalikan ke <strong>Auditor (Pelapor)</strong> untuk direvisi.</p>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} className="w-full p-3 border border-grey/30 rounded-lg text-hitam focus:ring-2 focus:ring-red-200 outline-none mb-4" rows={3} placeholder="Alasan pengembalian..." />
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 bg-grey/10 text-hitam rounded hover:bg-grey/20">Batal</button>
                    <button onClick={handleSubmit} className="px-4 py-2 bg-black text-white rounded font-bold hover:bg-gray-800 shadow-md">Kirim Reject</button>
                </div>
            </div>
        </div>
    )
}

/* --- 6. SUBMIT CONFIRMATION MODAL --- */
const SubmitConfirmationModal = ({ 
    isOpen, 
    onClose, 
    onConfirm,
    isRevision 
}: { 
    isOpen: boolean; 
    onClose: () => void; 
    onConfirm: () => void;
    isRevision: boolean;
}) => {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-hitam/60 p-4 font-arial backdrop-blur-sm transition-all">
            <div className="bg-putih w-full max-w-md p-6 rounded-xl shadow-2xl transform transition-all scale-100 border-t-4 border-hijau animate-in fade-in zoom-in duration-200">
                <div className="flex flex-col items-center text-center">
                    <div className="w-14 h-14 bg-biru/10 text-hijau rounded-full flex items-center justify-center mb-4">
                        <Send className="w-7 h-7 ml-1" />
                    </div>
                    
                    <h3 className="text-xl font-bold text-hitam mb-2">
                        {isRevision ? "Submit Revisi Perbaikan?" : "Submit CAPA Sekarang?"}
                    </h3>
                    <p className="text-sm text-grey mb-6 leading-relaxed">
                        {isRevision 
                            ? "Data akan dikirim LANGSUNG ke Manager QS (Shortcut) jika semua sudah OK."
                            : "Pastikan data perbaikan yang wajib sudah terisi dengan benar."
                        }
                    </p>

                    <div className="flex gap-3 w-full">
                        <button 
                            onClick={onClose} 
                            className="flex-1 px-4 py-2.5 bg-grey/10 text-hitam font-bold rounded-lg hover:bg-grey/20 transition-colors"
                        >
                            Batal
                        </button>
                        <button 
                            onClick={onConfirm} 
                            className="flex-1 px-4 py-2.5 bg-hijau text-putih font-bold rounded-lg hover:bg-hijau/90 transition-colors shadow-lg"
                        >
                            Ya, Kirim
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

/* ==========================================================================
   MAIN PAGE
   ========================================================================== */
export default function TindakLanjutDetailPage() {
    const router = useRouter()
    const params = useParams() as { capaId?: string }
    const capaId = params?.capaId ?? ''
    
    const [isLoading, setIsLoading] = useState(true)
    const [detail, setDetail] = useState<LaporanDetail | null>(null)
    const [items, setItems] = useState<CapaItemWithInput[]>([])
    const [modalItemId, setModalItemId] = useState<number | string | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [userList, setUserList] = useState<any[]>([]) 

    // State Flow
    const [isFindingsAccepted, setIsFindingsAccepted] = useState(false) 
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false)
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false) 
    const [isSubmitConfirmOpen, setIsSubmitConfirmOpen] = useState(false)

    /* --- Logic Deteksi Patrol HSE --- */
    const isPatrolHSE = useMemo(() => {
        if (!detail?.jenis_audit) return false;
        return detail.jenis_audit.toLowerCase().includes("patrol hse");
    }, [detail?.jenis_audit]);

/* ===============================
   CURRENT USER (WAJIB ADA)
================================= */
/* ===============================
   CURRENT USER
================================= */
const [currentUser, setCurrentUser] = useState<any>(null)

useEffect(() => {
  try {
    const user = localStorage.getItem('user_data')
    if (user) setCurrentUser(JSON.parse(user))
  } catch {}
}, [])

/* ===============================
   PIC AREA IDS (PARSE JSON)
================================= */
const picAreaIds = useMemo(() => {
  if (Array.isArray(detail?.approver_pic_capa_ids))
    return detail.approver_pic_capa_ids

  if (typeof detail?.approver_pic_capa_ids === 'string') {
    const raw = detail.approver_pic_capa_ids.trim()

    if (!raw || raw === 'null' || raw === 'undefined') return []

    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch (e) {
      console.warn('Invalid approver_pic_capa_ids JSON:', raw)
      return []
    }
  }

  return []
}, [detail?.approver_pic_capa_ids])

/* ===============================
   CHECK PIC AREA
================================= */
const isPicArea = useMemo(() => {
  if (!currentUser) return false
  const userId = Number(currentUser.id || currentUser.user_id)
  return picAreaIds.map(Number).includes(userId)
}, [currentUser, picAreaIds])

/* ===============================
   CHECK PIC CAPA
================================= */
const isPicCapa = useMemo(() => {
  if (!currentUser || !items.length) return false
  const userId = Number(currentUser.id || currentUser.user_id)
  return items.some(it => Number(it.pic_user_id) === userId)
}, [currentUser, items])

/* ===============================
   MASTER ACCESS CAPA
================================= */
const canEditCapa = useMemo(() => {
  if (!isFindingsAccepted) return false
  if (isPicArea) return true
  if (isPicCapa) return true
  return false
}, [isFindingsAccepted, isPicArea, isPicCapa])

const canEditItem = (item: CapaItemWithInput) => {
  if (!currentUser) return false

  // belum fase CAPA → semua disable
  if (!isFindingsAccepted) return false

  const userId = Number(currentUser.id || currentUser.user_id)

  // PIC AREA boleh edit semua item saat CAPA aktif
  if (isPicArea) return true

  // PIC CAPA hanya boleh edit item miliknya
  if (!item.pic_user_id) return false

  return Number(item.pic_user_id) === userId
}

    /* --- 1. Fetch Users --- */
    useEffect(() => {
        const fetchUsers = async () => {
          try {
            const res = await fetchWithAuth(`/api/audit/${capaId}/assignable-users`, { cache: 'no-store' })
            if (res.ok) { 
                const json = await res.json(); 
                const allUsers = json.data || [];
                
                const supervisors = (json.data || []).map((u:any)=>({
                    id: u.id,
                    name: u.name
                }))
                
                setUserList(supervisors);
            }
          } catch (error) { console.error('Gagal load users', error) }
        }
        fetchUsers()
    }, [])

    const getPicName = (id: any) => {
        if (!id) return '-'
        const user = userList.find((u) => u.id === Number(id))
        return user ? user.name : '-'
    }

    /* --- 2. Fetch Data & Logic Grouping --- */
    useEffect(() => {
        if (!capaId) return
        const fetchDetail = async () => {
            setIsLoading(true)
            try {
                const res = await fetchWithAuth(`/api/audit/laporan-temuan/detailed/${encodeURIComponent(capaId)}`, { cache: 'no-store' })
                if (!res.ok) throw new Error('Gagal load data')
                const json = await res.json()
                const payload = json.data || {}
                const m = payload.master

                setDetail({
                    pelaksanaan_id: m?.pelaksanaan_id,
                    no_fta: m?.no_fta,
                    tanggal_audit: m?.tanggal_audit,
                    nama_checklist: m?.nama_checklist,
                    jenis_audit: m?.nama_jenis_audit || m?.jenis_audit,
                    site: m?.nama_site || m?.site,
                    area: m?.nama_area || m?.area,
                    auditor: m?.nama_auditor || m?.auditor,
                    department: m?.nama_department || m?.department,
                    status_laporan: m?.status_laporan,
                    master: m,
                    note_reject: m?.note_reject,
                    approver_qs_spv_id: m?.approver_qs_spv_id,
                    approver_pic_capa_ids: m?.approver_pic_capa_ids,
                    approver_pic_capa_names: m?.approver_pic_capa_names
                })

                // [LOGIC FIX] 
                const status = m?.status_laporan || '';
                const isStatusProgress = 
                    status === 'CAPA_IN_PROGRESS' || 
                    status === 'In Progress' || 
                    status === 'IN_PROGRESS' || 
                    status === 'WAITING_QS_SPV' || 
                    status === 'CAPA_REJECTED_QSSPV' ||  // QS Supervisor Reject
                    status === 'CAPA_REJECTED_MGR';     // QS Manager Reject
                
                const rawItems = payload.temuan || []
                const hasPicAssigned = rawItems.some((it: any) => Number(it.pic_user_id) > 0);

                setIsFindingsAccepted(isStatusProgress || hasPicAssigned);

                const mappedItems = rawItems.map((it: any) => {
                    let existingFiles: string[] = []
                    try {
                        if (it.bukti_temuan) {
                             const val = String(it.bukti_temuan).trim()
                             if(val.startsWith('[')) existingFiles = JSON.parse(val)
                             else existingFiles = [val]
                        }
                    } catch { existingFiles = [] }

                    const groupingCategory = it.kategori || it.kategori_checklist || 'Lain-lain';

                    return {
                        ...it,
                        kategori: groupingCategory,
                        sub_kategori: it.sub_kategori || 'Umum',
                        
                        referensi_doc: it.referensi_doc || '-',
                        data_integrity: it.data_integrity || '-',
                        prinsip_5r: it.prinsip_5r || '-',
                        pic_user_id: it.pic_user_id,
                        
                        status_verifikasi: it.hasil_verifikasi || it.status_verifikasi, 
                        catatan_verifikasi: it.catatan_verifikasi,

                        justification: it.justification || 'Temuan',

                        existingFiles,
                        capa: {
                            root_cause: it.root_cause || '',
                            corrective_action: it.corrective_action || '',
                            preventive_action: it.preventive_action || '-', 
                            due_date: it.due_date ? it.due_date.split('T')[0] : ''
                        }
                    }
                })
                let finalItems = mappedItems
                if (status === 'CAPA_REJECTED_QSSPV') {
                    finalItems = mappedItems.filter((it: CapaItemWithInput) => it.status_verifikasi === 'REVISION')
                }
                if (status === 'CAPA_REJECTED_MGR') {
                    finalItems = mappedItems
                }
                setItems(finalItems)
            } catch (err) { console.error(err); toast.error('Gagal memuat detail audit.') } 
            finally { setIsLoading(false) }
        }
        fetchDetail()
    }, [capaId])

    // Grouping
    const groupedItems = useMemo(() => {
        const groups = new Map<string, Map<string, CapaItemWithInput[]>>()
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

    /* --- 3. ACTIONS --- */
    const handleApproveClick = () => { setIsAssignModalOpen(true) }

    const handleAssignAndStart = async (assignments: { item_id: number|string, pic_id: number }[]) => {
        setIsSaving(true)
        const toastId = toast.loading('Menyimpan PIC...')
        try {
            const res = await fetchWithAuth(`/api/audit/${capaId}/assign-pic-start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ assignments })
            })
            if (!res.ok) throw new Error('Gagal assign PIC')

            toast.success('PIC Ditunjuk. Status: In Progress', { id: toastId })
            setIsAssignModalOpen(false)
            window.location.reload()
        } catch (e: any) {
            toast.error(`Gagal: ${e.message}`, { id: toastId })
        } finally {
            setIsSaving(false)
        }
    }

    const handleRejectFindings = async (reason: string) => {
        setIsSaving(true)
        const toastId = toast.loading('Mengembalikan laporan...')
        try {
            const res = await fetchWithAuth(`/api/audit/${capaId}/reject-capa`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason })
            })
            if (!res.ok) throw new Error('Gagal reject')
            toast.success('Dikembalikan ke Auditor.', { id: toastId })
            router.push('/laporan-temuan/tindak-lanjut')
        } catch (e: any) { toast.error(`Error: ${e.message}`, { id: toastId }) } 
        finally { setIsSaving(false); setIsRejectModalOpen(false) }
    }

    const handleSaveCapa = async (itemId: number | string, data: CapaInput) => {
        const currentItem = items.find(it => {
             const rawId = it.item_id ?? it.id ?? it.temuan_id;
             let safeId = rawId;
             if (typeof rawId === 'object' && rawId !== null) {
                 safeId = rawId.id ?? rawId.item_id;
             }
             return String(safeId) === String(itemId)
        })
        if (!currentItem) return

        let idToSend = currentItem.item_id;
        if (typeof idToSend === 'object' && idToSend !== null) {
            idToSend = idToSend.item_id ?? idToSend.id;
        }
        if (!idToSend) idToSend = currentItem.id;

        const toastId = toast.loading('Menyimpan draft...')
        try {
            const res = await fetchWithAuth(`/api/audit/${capaId}/capa-item/${idToSend}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            })

            if (!res.ok) throw new Error('Gagal simpan ke DB')

            setItems(prev => prev.map(it => {
                 const rawId = it.item_id ?? it.id ?? it.temuan_id;
                 let safeId = rawId;
                 if (typeof rawId === 'object' && rawId !== null) safeId = rawId.id ?? rawId.item_id;
                 
                 if (String(safeId) === String(itemId)) {
                     return { 
                         ...it, 
                         capa: { ...data } 
                     }
                 }
                 return it
            }))
            
            setModalItemId(null)
            toast.success('Draft tersimpan di database.', { id: toastId })
        } catch(e: any) {
            toast.error(`Gagal simpan: ${e.message}`, { id: toastId })
        }
    }

    const handleFinalSubmit = () => {
        const incomplete = items.filter(it => {
            const isObservasi = it.justification === 'Observasi';
            if (isObservasi) return false;
            const isFilled = it.capa.root_cause && it.capa.corrective_action && it.capa.due_date;
            return !isFilled; 
        })

        if (incomplete.length > 0) return toast.error(`Harap lengkapi CAPA untuk item berstatus 'Temuan'.`)
        
        setIsSubmitConfirmOpen(true)
    }

    const executeFinalSubmit = async () => {
        setIsSaving(true)
        const toastId = toast.loading('Mengirim CAPA...')
        try {
            const payload = {
                capa_items: items.map(it => {
                      let safeId = it.item_id;
                      if (typeof safeId === 'object' && safeId !== null) {
                        safeId = safeId.item_id ?? safeId.id;
                      }
                      if (!safeId) safeId = it.id ?? it.temuan_id;

                      return { item_id: safeId, ...it.capa }
                })
            }
            const res = await fetchWithAuth(`/api/audit/${capaId}/submit-capa`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            if (!res.ok) throw new Error('Gagal submit')
            toast.success('CAPA Berhasil Disubmit!', { id: toastId })
            setIsSubmitConfirmOpen(false)
            router.push('/laporan-temuan/tindak-lanjut')
        } catch (e: any) { 
            toast.error(`Gagal submit: ${e.message}`, { id: toastId }) 
            setIsSubmitConfirmOpen(false)
        } finally { setIsSaving(false) }
    }

    if (isLoading) return <div className="p-12 text-center text-grey flex justify-center items-center gap-2"><RefreshCw className="animate-spin"/> Memuat data...</div>
    if (!capaId) return <div className="p-12 text-center text-red-500">ID tidak valid</div>
    
    const isReadyToSubmit = items.length > 0 && items.every(it => {
        if (it.justification === 'Observasi') return true; 
        return it.capa.root_cause && it.capa.corrective_action && it.capa.due_date;
    });

    const isRevision = Boolean(detail?.approver_qs_spv_id && detail?.approver_qs_spv_id !== 0);

    return (
        <div className="font-arial pb-10">
            <Toaster position="top-center" />
            <Link href="/laporan-temuan/tindak-lanjut" className="flex items-center text-sm text-biru hover:underline mb-4 font-arial">
                <ArrowLeft className="w-4 h-4 mr-1" /> Kembali ke Daftar Tindak Lanjut
            </Link>

            {detail && <AuditHeader info={detail} totalItems={items.length} />}

            {/* --- ALERT GLOBAL REJECT (Manager) --- */}
            {detail?.note_reject && detail.status_laporan === 'CAPA_REJECTED_MGR' && (
                 <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded shadow-sm mx-0">
                     <div className="flex">
                         <AlertCircle className="h-6 w-6 text-red-500 mr-4 flex-shrink-0" />
                         <div>
                             <p className="font-bold text-red-700">Dikembalikan oleh QS Manager (Global Reject)</p>
                             <p className="text-sm text-red-600 mt-1">Catatan: "{detail.note_reject}"</p>
                         </div>
                     </div>
                 </div>
            )}
            
            {/* --- ALERT REVISI QS SPV --- */}
            {detail?.status_laporan === 'CAPA_REJECTED_QSSPV' && (
                <div className="bg-orange-50 border-l-4 border-orange-500 p-4 mb-6 rounded shadow-sm mx-0">
                    <div className="flex">
                        <Info className="h-6 w-6 text-orange-500 mr-4 flex-shrink-0" />
                        <div>
                            <p className="font-bold text-orange-700">Revisi Diperlukan (QS Supervisor)</p>
                            <p className="text-sm text-orange-600 mt-1">Beberapa item telah ditolak. Silakan cek detail item berwarna merah di bawah.</p>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-putih p-6 rounded-lg shadow-md font-arial mb-24">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-hitam">Pengisian PIC Tindakan Remedial</h3>
                    
                    {!isFindingsAccepted && isPicArea && (
                        <div className="flex gap-2">
                            <button onClick={() => setIsRejectModalOpen(true)}
                                className="flex items-center px-4 py-2 text-hitam rounded bg-grey/30 hover:bg-grey/40">
                                <XCircle className="w-4 h-4 mr-2" /> Reject
                            </button>

                            <button onClick={handleApproveClick}
                                className="flex items-center px-4 py-2 bg-biru text-putih rounded text-sm font-bold hover:bg-blue-800 transition">
                                <CheckCircle className="w-4 h-4 mr-2" /> Approve
                            </button>
                        </div>
                        )}

                    {isFindingsAccepted && (
                        <span className={`text-xs px-3 py-1 rounded border font-bold flex items-center
                            ${detail?.status_laporan === 'CAPA_REJECTED_QSSPV' || detail?.status_laporan === 'CAPA_REJECTED_MGR' 
                                ? 'bg-red-100 text-red-700 border-red-200' 
                                : 'bg-hijau/10 text-hijau border-hijau/20'}`}>
                            {detail?.status_laporan === 'CAPA_REJECTED_QSSPV' ? (
                                <><AlertTriangle className="w-3 h-3 mr-1" /> Revisi (Per Item)</>
                            ) : detail?.status_laporan === 'CAPA_REJECTED_MGR' ? (
                                <><XCircle className="w-3 h-3 mr-1" /> Revisi (Global)</>
                            ) : (
                                <><CheckCircle className="w-3 h-3 mr-1" /> CAPA In Progress</>
                            )}
                        </span>
                    )}
                </div>

                {!isFindingsAccepted && isPicArea && (
                    <div className="bg-blue-50 border border-blue-200 p-3 rounded text-sm text-blue-800 mb-4 flex items-start">
                        <MessageSquare className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
                        <div><strong>Konfirmasi Temuan:</strong> Silakan review temuan di bawah ini. Klik "Approve" untuk memilih PIC tindakan remedial dan memulai proses.</div>
                    </div>
                )}

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-grey/40 border-x border-grey/40">
                        <thead className="bg-grey/10">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-bold text-grey uppercase w-10">No</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase w-1/4">Temuan (Problem)</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase tracking-wider">Ref Doc</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase tracking-wider">Deskripsi</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase tracking-wider">Bukti</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase tracking-wider">Lokasi</th>
                                
                                {!isPatrolHSE && (
                                    <>
                                            <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase tracking-wider">Data Int.</th>
                                            <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase tracking-wider">5R</th>
                                    </>
                                )}

                                <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase tracking-wider">PIC</th>
                                <th className="px-6 py-3 text-center text-xs font-bold text-grey uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-center text-xs font-bold text-grey uppercase tracking-wider min-w-[140px]">Justifikasi</th>
                                <th className="px-6 py-3 text-center text-xs font-bold text-grey uppercase tracking-wider w-1/12">Action</th>
                            </tr>
                        </thead>
                        <tbody className="bg-putih divide-y divide-grey/40">
                            {Array.from(groupedItems.entries()).map(([kategori, subGroups]) => (
                                <React.Fragment key={kategori}>
                                    <tr className="bg-biru/5">
                                        <td colSpan={isPatrolHSE ? 11 : 13} className="px-4 py-3 text-sm font-bold text-biru uppercase tracking-wide">{kategori}</td>
                                    </tr>
                                    {Array.from(subGroups.entries()).map(([sub, items]) => (
                                        <React.Fragment key={sub}>
                                            {items.map((item, idx) => {
                                                const isObservasi = item.justification === 'Observasi';
                                                const checkStr = (s?: string) => s && s.trim() !== '' && s !== '-';
                                                const hasData = checkStr(item.capa.root_cause) || checkStr(item.capa.corrective_action);
                                                const isStatusClose = isObservasi || hasData; 
                                                const rejectReason = item.catatan_verifikasi;
                                                
                                                // [CRITICAL LOGIC] Hanya anggap REJECTED jika status = REVISION
                                                const isRejected = item.status_verifikasi === 'REVISION';

                                                return (
                                                    <React.Fragment key={idx}>
                                                        <tr className={`hover:bg-grey/5 transition-colors ${isRejected ? 'bg-red-50' : ''}`}>
                                                            <td className="px-4 py-4 text-sm text-hitam text-center font-medium align-top">{idx + 1}</td>
                                                            
                                                            <td className="px-6 py-4 text-sm text-hitam align-top">
                                                                <p className="font-semibold mb-1">{item.item_checklist_text}</p>
                                                                {isRejected ? (
                                                                    <div className="mt-2 mb-2 p-2 bg-red-100 border-l-4 border-red-500 rounded text-xs text-red-800">
                                                                        <div className="flex items-center font-bold mb-1"><AlertCircle className="w-3 h-3 mr-1.5"/> Ditolak:</div>
                                                                        <p className="italic">"Cek detail di tombol edit"</p>
                                                                    </div>
                                                                ) : (
                                                                    <div className="text-grey text-xs bg-grey/5 p-2 rounded border border-grey/10">{item.deskripsi_temuan}</div>
                                                                )}
                                                            </td>

                                                            <td className="px-6 py-4 text-sm text-hitam/70 align-top">{item.referensi_doc || '-'}</td>
                                                            <td className="px-6 py-4 text-sm text-hitam align-top">{item.deskripsi_temuan || '-'}</td>
                                                            <td className="px-6 py-4 text-sm text-hitam align-top"><div className="flex flex-wrap gap-2">{item.existingFiles.length > 0 ? item.existingFiles.map((f: string, i: number) => <FileDisplay key={i} filePath={f} />) : '-'}</div></td>
                                                            <td className="px-6 py-4 text-sm text-hitam align-top">{item.lokasi_temuan || '-'}</td>
                                                            {!isPatrolHSE && (<><td className="px-6 py-4 text-sm text-hitam align-top">{item.data_integrity || '-'}</td><td className="px-6 py-4 text-sm text-hitam align-top">{item.prinsip_5r || '-'}</td></>)}
                                                            
                                                            <td className="px-6 py-4 text-sm text-blue-700 font-semibold align-top">{getPicName(item.pic_user_id)}</td>

                                                            <td className="px-6 py-4 text-center align-top">
                                                                {isRejected ? (
                                                                    <span className="px-2 py-1 rounded text-xs font-bold bg-red-100 text-red-600 border border-red-200">Revisi</span>
                                                                ) : (
                                                                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${isStatusClose ? 'bg-hijau/10 text-hijau' : 'bg-biru/10 text-biru'}`}>
                                                                        {isStatusClose ? 'Close' : 'Open'}
                                                                    </span>
                                                                )}
                                                            </td>
                                                            
                                                            <td className="px-6 py-4 text-center align-top">
                                                                <span className={`px-2 py-1 rounded text-xs font-bold border inline-block w-full text-center
                                                                    ${isObservasi ? 'bg-hijau/10 text-hijau border-hijau/20' : 'bg-biru/10 text-biru border-biru/20'}`}>
                                                                    {item.justification || 'Temuan'}
                                                                </span>
                                                            </td>

                                                            <td className="px-6 py-4 text-center align-top">
                                                                <button 
                                                                    disabled={!canEditItem(item) || isSaving}
                                                                    onClick={() => setModalItemId(item.item_id ?? item.id ?? item.temuan_id)}
                                                                    className={`p-2 rounded transition-all mx-auto bg-grey/20 text-grey hover:text-biru hover:bg-grey/40 
                                                                    ${!canEditItem(item) ? 'text-grey/40 cursor-not-allowed opacity-50' : ''}`}
                                                                    title={!canEditItem(item) ? 'Bukan PIC Anda' : 'Isi CAPA'}
                                                                >
                                                                    {isStatusClose || isRejected ? <PenTool className="w-5 h-5 text-hijau" /> : <Plus className="w-5 h-5" />}
                                                                </button>
                                                            </td>
                                                        </tr>

                                                        {/* [DISPLAY DATA IF EXISTS & NOT REJECTED] */}
                                                        {(isObservasi || hasData) && !isRejected && (
                                                            <tr className="bg-blue-50/30 border-b-2 border-grey/20">
                                                                <td colSpan={2}></td>
                                                                <td colSpan={isPatrolHSE ? 9 : 11} className="px-6 py-3 pb-5">
                                                                    {isObservasi && !hasData ? (
                                                                         <div className="flex items-center justify-center p-4 bg-white rounded-lg border border-blue-100 shadow-sm">
                                                                            <Info className="w-4 h-4 text-biru mr-2" />
                                                                            <span className="text-sm text-grey"><strong>OBSERVASI</strong>.</span>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm bg-white p-4 rounded-lg border border-blue-100 shadow-sm">
                                                                            <div>
                                                                                <strong className="block text-grey text-xs uppercase tracking-wide mb-1">Direct Cause</strong>
                                                                                <p className="text-hitam font-medium">{item.capa.root_cause}</p>
                                                                            </div>
                                                                            <div>
                                                                                <strong className="block text-grey text-xs uppercase tracking-wide mb-1">Tindakan Remidial</strong>
                                                                                <p className="text-hitam font-medium">{item.capa.corrective_action}</p>
                                                                            </div>
                                                                            <div>
                                                                                <strong className="block text-grey text-xs uppercase tracking-wide mb-1">Due Date</strong>
                                                                                <p className="text-biru font-bold flex items-center">
                                                                                    <Calendar className="w-3 h-3 mr-1" /> 
                                                                                    {item.capa.due_date ? new Date(item.capa.due_date).toLocaleDateString('id-ID') : '-'}
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                    )}
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

            <div className="fixed bottom-0 right-0 left-0 md:left-64 bg-putih border-t border-grey/30 p-4 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] z-30">
                <div className="w-full flex justify-end items-center px-6 gap-4">
                    {isReadyToSubmit ? (
                        <span className="text-hijau font-bold flex items-center"><CheckCircle className="w-5 h-5 mr-2" /> Data Lengkap & Siap Submit</span>
                    ) : (
                        <span className="text-blue-500 font-bold text-sm flex items-center"><AlertCircle className="w-5 h-5 mr-2" /> Lengkapi semua item berstatus 'Temuan'</span>
                    )}
                    
                    {isReadyToSubmit && (
                        <button
                            disabled={isSaving || !canEditCapa }
                            onClick={handleFinalSubmit} className={`flex items-center px-8 py-3 font-bold text-putih rounded shadow-lg transition-all transform hover:-translate-y-0.5 bg-biru hover:bg-biru/90`}>
                            <CheckCircle className="w-5 h-5 mr-2" /> {detail?.status_laporan?.includes('REJECTED') ? 'Submit Revisi' : 'Submit Final CAPA'}
                        </button>
                    )}
                </div>
            </div>

            {modalItemId && canEditCapa && (<CapaModal item={items.find(it => String(it.item_id ?? it.id ?? it.temuan_id) === String(modalItemId))!} detail={detail} onClose={() => setModalItemId(null)} onSave={handleSaveCapa} />)}
            <RejectModal isOpen={isRejectModalOpen} onClose={() => setIsRejectModalOpen(false)} onConfirm={handleRejectFindings} />
            {isAssignModalOpen && <AssignPicModal items={items} userList={userList} onClose={() => setIsAssignModalOpen(false)} onConfirm={handleAssignAndStart} />}
            <SubmitConfirmationModal isOpen={isSubmitConfirmOpen} onClose={() => setIsSubmitConfirmOpen(false)} onConfirm={executeFinalSubmit} isRevision={isRevision} />
        </div>
    )
}