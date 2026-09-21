'use client'

import React, { useEffect, useState, useMemo, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Toaster, toast } from 'react-hot-toast'
import { ArrowLeft, Camera, Paperclip, Save, X, Edit, CheckCircle, AlertCircle, AlertTriangle, FileText, Info } from 'lucide-react'
import Link from 'next/link'
import { fetchWithAuth } from '@/utils/api' 

// --- INTERFACES ---
interface TemuanItem {
  id?: number | string
  item_id?: number | string | any
  temuan_id?: number | string
  item_checklist_text?: string
  nama_item?: string
  judul?: string
  kategori?: string | null           
  sub_kategori?: string | null
  kategori_temuan?: string | null    
  status?: 'OK' | 'NOK' | 'N/A' | null
  deskripsi_temuan?: string | null
  lokasi_temuan?: string | null
  bukti_temuan?: string | null
  referensi_doc?: string | null
  ref_doc?: string | null
  pic_user_id?: number | null
  data_integrity?: string | null
  prinsip_5r?: string | null
  justification?: 'Temuan' | 'Observasi' | null 
  [key: string]: any
}

interface ApproverData {
    picCapaId: string | number
    qsSpv: string | number
    mgrArea: string | number
    mgrQs: string | number
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
  
  // Data Workflow Existing
  approver_qs_spv_id?: number
  approver_mgr_area_id?: number
  approver_mgr_qs_id?: number
  approver_pic_capa_ids?: number[] | string
  
  [key: string]: any
}

interface Answer {
  status: 'OK' | 'NOK' | 'N/A' | null
  deskripsi_temuan: string
  lokasi_temuan: string
  files: File[]
  existingFiles: string[]
  pic_capa?: string | number 
  kategori_temuan?: string 
  data_integrity?: string
  prinsip_5r?: string
  justification?: 'Temuan' | 'Observasi' | null 
}

type ChecklistItemWithAnswer = TemuanItem & { answer: Answer; isNew?: boolean }

/* --- 1. Audit Header --- */
const AuditHeader = ({ info, nokCount }: { info: Partial<LaporanDetail>; nokCount?: number }) => {
  const parse = (v: any) => {
    if (v == null) return '-'
    if (typeof v === 'object') {
      if ('String' in v) return v.String
      return String(v)
    }
    return String(v)
  }
  const formatDateLong = (raw?: any) => {
    const s = parse(raw)
    if (!s || s === '-') return '-'
    const d = new Date(s)
    if (!isNaN(d.getTime())) return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }).format(d)
    return s
  }
  
  const getFtaDisplay = () => {
    const fta = info.no_fta ?? info.master?.no_fta
    if (fta && fta !== '-' && fta !== '') return parse(fta)
    return parse(info.pelaksanaan_id)
  }
  return (
    <div className="bg-putih p-6 rounded-lg shadow-md mb-6 font-arial border border-grey/20">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
        <div><p className="text-sm font-medium text-grey">NO FTA</p><p className="text-lg font-bold text-hitam">{getFtaDisplay()}</p></div>
        <div><p className="text-sm font-medium text-grey">Jenis Audit</p><p className="text-lg font-bold text-hitam">{parse(info.jenis_audit ?? info.master?.nama_jenis_audit)}</p></div>
        <div><p className="text-sm font-medium text-grey">Auditor</p><p className="text-lg font-bold text-hitam">{parse(info.auditor ?? info.master?.nama_auditor)}</p></div>
        <div><p className="text-sm font-medium text-grey">Site / Area</p><p className="text-lg font-bold text-hitam">{parse(info.site ?? info.master?.nama_site)} - {parse(info.area ?? info.master?.nama_area)}</p></div>
        <div><p className="text-sm font-medium text-grey">Tgl Pelaksanaan</p><p className="text-lg font-bold text-hitam">{formatDateLong(info.tanggal_audit ?? info.master?.tanggal_audit)}</p></div>
        <div><p className="text-sm font-medium text-grey">Jumlah Temuan (NOK)</p><p className="text-lg font-bold text-hitam">{typeof nokCount === 'number' ? nokCount : '-'}</p></div>
      </div>
    </div>
  )
}

/* --- 2. File Display --- */
const FileDisplay = ({ filePath }: { filePath: string }) => {
  if (!filePath || filePath === '-') return <span>-</span>
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || ''
  let normalizedPath = filePath.replace(/\\/g, '/')
  if (normalizedPath.startsWith('/')) normalizedPath = normalizedPath.substring(1)
  const fullUrl = `${API_BASE}/${normalizedPath}`
  const extension = fullUrl.split('.').pop()?.toLowerCase()
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(extension || '')
  let displayName = normalizedPath.split('/').pop() || 'File'
  if (displayName.split('-').length >= 3) displayName = displayName.split('-').slice(2).join('-')

  if (isImage) {
    return (
      <a href={fullUrl} target="_blank" rel="noopener noreferrer" className="block group">
        <img src={fullUrl} alt={displayName} className="w-20 h-20 object-cover rounded border border-grey/30 group-hover:opacity-80 transition-opacity" onError={(e) => {(e.target as HTMLImageElement).src = 'https://placehold.co/80x80?text=Error'}}/>
        <span className="text-xs text-grey truncate block mt-1 w-20" title={displayName}>{displayName}</span>
      </a>
    )
  }
  return (
    <a href={fullUrl} target="_blank" rel="noopener noreferrer" className="flex items-center p-2 bg-grey/10 rounded hover:bg-grey/20 transition-colors text-biru text-sm group truncate max-w-[200px]" title={displayName}>
      <Paperclip className="h-4 w-4 mr-1 flex-shrink-0" /><span className="truncate">{displayName}</span>
    </a>
  )
}

/* --- 3. NOK Modal --- */
const NokModal = ({ 
    item, 
    onClose, 
    onSave, 
    userList,
    isPatrolHSE 
}: { 
    item: ChecklistItemWithAnswer; 
    onClose: () => void; 
    onSave: (id: number | string, data: any) => void;
    userList: any[];
    isPatrolHSE: boolean; 
}) => {
  const MAX_FILE_SIZE_MB = 5
  const [deskripsi, setDeskripsi] = useState(item.answer.deskripsi_temuan || '')
  const [lokasi, setLokasi] = useState(item.answer.lokasi_temuan || '')
  const [kategoriTemuan, setKategoriTemuan] = useState(item.answer.kategori_temuan || '') 
  const [dataIntegrity, setDataIntegrity] = useState(item.answer.data_integrity || '')
  const [prinsip5R, setPrinsip5R] = useState(item.answer.prinsip_5r || '')
  const [allCurrentFiles, setAllCurrentFiles] = useState<(string | File)[]>([...item.answer.existingFiles, ...item.answer.files])
  const fileRef = useRef<HTMLInputElement | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    const files = Array.from(e.target.files)
    const valid: File[] = []
    files.forEach(f => { if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) toast.error(`File max ${MAX_FILE_SIZE_MB}MB`); else valid.push(f) })
    setAllCurrentFiles(prev => [...prev, ...valid.slice(0, 5 - prev.length)])
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!deskripsi || !lokasi || !kategoriTemuan) return toast.error('Deskripsi, Lokasi, dan Kategori wajib diisi!')
    if (!isPatrolHSE) {
        if (!dataIntegrity || !prinsip5R) return toast.error('Data Integrity & 5R wajib diisi!')
    }
    if (allCurrentFiles.length === 0) return toast.error('Lampirkan minimal 1 bukti temuan')
    
    const newFiles = allCurrentFiles.filter(x => typeof x !== 'string') as File[]
    const existing = allCurrentFiles.filter(x => typeof x === 'string') as string[]
    
    onSave(item.item_id ?? item.id ?? item.temuan_id ?? 0, { 
        deskripsi_temuan: deskripsi, 
        lokasi_temuan: lokasi, 
        kategori_temuan: kategoriTemuan, 
        data_integrity: isPatrolHSE ? '-' : dataIntegrity, 
        prinsip_5r: isPatrolHSE ? '-' : prinsip5R, 
        files: newFiles, 
        existingFiles: existing 
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-hitam/50 p-4 font-arial">
      <div className="bg-putih w-full max-w-lg p-6 rounded-lg shadow-xl max-h-[90vh] overflow-y-auto animate-in zoom-in duration-200">
        <div className="flex justify-between items-center mb-4 border-b border-grey/20 pb-2">
          <h4 className="text-lg font-bold text-hitam">Detail Temuan (NOK)</h4>
          <button onClick={onClose}><X className="w-5 h-5 text-grey hover:text-hitam"/></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="text-sm font-medium text-grey block mb-1">Check Item</label><div className="p-3 bg-grey/10 rounded text-sm text-hitam border border-grey/20">{item.item_checklist_text}</div></div>
          <div><label className="text-sm font-medium text-grey block mb-1">Deskripsi Temuan <span className="text-red-600">*</span></label><textarea value={deskripsi} onChange={(e) => setDeskripsi(e.target.value)} className="w-full p-2 border border-grey/40 rounded text-hitam focus:ring-1 focus:ring-biru" rows={3} placeholder="Jelaskan ketidaksesuaian..." /></div>
          <div><label className="text-sm font-medium text-grey block mb-1">Lokasi Temuan <span className="text-red-600">*</span></label><input value={lokasi} onChange={(e) => setLokasi(e.target.value)} className="w-full p-2 border border-grey/40 rounded text-hitam focus:ring-1 focus:ring-biru" placeholder="Contoh: Line 1, Area Gudang..." /></div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="text-sm font-medium text-grey block mb-1">Kategori <span className="text-red-600">*</span></label><select value={kategoriTemuan} onChange={(e) => setKategoriTemuan(e.target.value)} className="w-full p-2 border border-grey/40 rounded bg-white text-hitam focus:ring-1 focus:ring-biru"><option value="">-- Pilih --</option><option value="Critical">Critical</option><option value="Major">Major</option><option value="Minor">Minor</option></select></div>
            {!isPatrolHSE && (
                <div><label className="text-sm font-medium text-grey block mb-1">Data Integrity<span className="text-red-600">*</span></label><select value={dataIntegrity} onChange={(e) => setDataIntegrity(e.target.value)} className="w-full p-2 border border-grey/40 rounded bg-white text-hitam focus:ring-1 focus:ring-biru"><option value="">-- Pilih --</option><option value="Attributable">Attributable</option><option value="Legible">Legible</option><option value="Contemporaneous">Contemporaneous</option><option value="Original">Original</option><option value="Accurate">Accurate</option></select></div>
            )}
          </div>
          {!isPatrolHSE && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="text-sm font-medium text-grey block mb-1">5R<span className="text-red-600">*</span></label><select value={prinsip5R} onChange={(e) => setPrinsip5R(e.target.value)} className="w-full p-2 border border-grey/40 rounded bg-white text-hitam focus:ring-1 focus:ring-biru"><option value="">-- Pilih --</option><option value="Ringkas">Ringkas</option><option value="Rapi">Rapi</option><option value="Resik">Resik</option><option value="Rawat">Rawat</option><option value="Rajin">Rajin</option></select></div>
              </div>
          )}

          <div>
             <label className="text-sm font-medium text-grey block mb-1">Bukti Temuan</label>
             <input ref={fileRef} type="file" multiple onChange={handleFileChange} className="hidden" accept="image/*,application/pdf" />
             <div className="flex gap-2">
                 <button type="button" onClick={() => fileRef.current?.click()} className="px-4 py-2 bg-grey/10 border border-grey/30 rounded flex items-center text-hitam hover:bg-grey/20 transition-colors">
                     <Camera className="w-4 h-4 mr-2"/> Upload Foto
                 </button>
             </div>
             <div className="mt-2 space-y-1">
                 {allCurrentFiles.map((f, i) => (
                     <div key={i} className="flex justify-between items-center text-xs bg-grey/5 p-2 rounded border border-grey/20">
                         <span className="truncate w-64 text-hitam">{typeof f === 'string' ? f.split('/').pop() : f.name}</span>
                         <button type="button" onClick={() => setAllCurrentFiles(prev => prev.filter(x => x !== f))}><X className="w-3 h-3 text-red-500 hover:text-red-700"/></button>
                     </div>
                 ))}
             </div>
          </div>
          
          <div className="flex justify-end gap-2 pt-4 border-t border-grey/20">
              <button type="button" onClick={onClose} className="px-4 py-2 bg-grey/10 text-hitam rounded hover:bg-grey/20 transition-colors">Batal</button>
              <button type="submit" className="px-4 py-2 bg-biru text-putih rounded font-bold hover:bg-biru/90 transition-colors shadow-md">Simpan Temuan</button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* --- 4. Submit Workflow Modal --- */
const SubmitWorkflowModal = ({ 
    isOpen, 
    onClose, 
    onConfirm, 
    userList 
}: { 
    isOpen: boolean; 
    onClose: () => void; 
    onConfirm: (data: ApproverData) => void;
    userList: any[] 
}) => {
    const [picCapaId, setPicCapaId] = useState<string | number>('')
    const [singleApprovers, setSingleApprovers] = useState({ qsSpv: '', mgrArea: '', mgrQs: '' })

    const usersPicCapaList = userList.filter(u => {
        const role = (u.role || '').toLowerCase();
        return role.includes('supervisor') || role.includes('spv');
    });

    const usersQsSpvList = userList.filter(u => {
        const role = (u.role || '').toLowerCase();
        return role.includes('qs') && (role.includes('supervisor') || role.includes('spv'));
    });

    const usersMgrArea = userList.filter(u => u.role?.toLowerCase().includes('manager') || u.role?.toLowerCase().includes('manajer'))
    const usersMgrQs = userList.filter(u => (u.role?.toLowerCase().includes('manager') && u.role?.toLowerCase().includes('qs')))
    
    const showAllIfEmpty = (list: any[]) => list.length > 0 ? list : userList
    const getUser = (id: string | number) => userList.find(u => u.id === Number(id))

    const handleSubmit = () => {
        if (!picCapaId || !singleApprovers.qsSpv || !singleApprovers.mgrArea || !singleApprovers.mgrQs) {
            toast.error('Semua Approver wajib diisi!')
            return
        }
        onConfirm({
            picCapaId: picCapaId,
            qsSpv: singleApprovers.qsSpv,
            mgrArea: singleApprovers.mgrArea,
            mgrQs: singleApprovers.mgrQs
        })
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-hitam/60 p-4 font-arial backdrop-blur-sm">
            <div className="bg-putih w-full max-w-lg p-6 rounded-lg shadow-2xl border-t-4 border-biru max-h-[90vh] overflow-y-auto animate-in zoom-in duration-200">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h4 className="text-xl font-bold text-hitam">Setup Approval Workflow</h4>
                        <p className="text-xs text-grey mt-1">Tentukan approver dan verifikasi email mereka.</p>
                    </div>
                    <button onClick={onClose}><X className="w-6 h-6 text-grey hover:text-hitam" /></button>
                </div>
                <div className="space-y-6">
                    <div>
                        <label className="text-xs font-bold text-grey uppercase tracking-wider block mb-1">Supervisor Area</label>
                        <select value={picCapaId} onChange={(e) => setPicCapaId(e.target.value)} className="w-full p-2.5 border border-grey/30 rounded bg-grey/5 text-hitam focus:ring-2 focus:ring-biru outline-none">
                            <option value="">-- Pilih User --</option>
                            {showAllIfEmpty(usersPicCapaList).map((u: any) => (<option key={u.id} value={u.id}>{u.name}</option>))}
                        </select>
                        {picCapaId && (<div className="mt-1 px-3 py-2 bg-gray-100 rounded text-xs text-gray-600 border border-gray-200 flex items-center"><span className="font-semibold mr-2">Email:</span> {getUser(picCapaId)?.email || '-'}</div>)}
                    </div>
                    <div>
                        <label className="text-xs font-bold text-grey uppercase tracking-wider block mb-1">QS Supervisor</label>
                        <select value={singleApprovers.qsSpv} onChange={(e) => setSingleApprovers({...singleApprovers, qsSpv: e.target.value})} className="w-full p-2.5 border border-grey/30 rounded bg-grey/5 text-hitam focus:ring-2 focus:ring-biru outline-none">
                            <option value="">-- Pilih User --</option>
                            {showAllIfEmpty(usersQsSpvList).map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                        {singleApprovers.qsSpv && (<div className="mt-1 px-3 py-2 bg-gray-100 rounded text-xs text-gray-600 border border-gray-200 flex items-center"><span className="font-semibold mr-2">Email:</span> {getUser(singleApprovers.qsSpv)?.email || '-'}</div>)}
                    </div>
                    <div>
                        <label className="text-xs font-bold text-grey uppercase tracking-wider block mb-1">Manager Area</label>
                        <select value={singleApprovers.mgrArea} onChange={(e) => setSingleApprovers({...singleApprovers, mgrArea: e.target.value})} className="w-full p-2.5 border border-grey/30 rounded bg-grey/5 text-hitam focus:ring-2 focus:ring-biru outline-none">
                            <option value="">-- Pilih User --</option>
                            {showAllIfEmpty(usersMgrArea).map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                        {singleApprovers.mgrArea && (<div className="mt-1 px-3 py-2 bg-gray-100 rounded text-xs text-gray-600 border border-gray-200 flex items-center"><span className="font-semibold mr-2">Email:</span> {getUser(singleApprovers.mgrArea)?.email || '-'}</div>)}
                    </div>
                    <div>
                        <label className="text-xs font-bold text-grey uppercase tracking-wider block mb-1">Manager QS</label>
                        <select value={singleApprovers.mgrQs} onChange={(e) => setSingleApprovers({...singleApprovers, mgrQs: e.target.value})} className="w-full p-2.5 border border-grey/30 rounded bg-grey/5 text-hitam focus:ring-2 focus:ring-biru outline-none">
                            <option value="">-- Pilih User --</option>
                            {showAllIfEmpty(usersMgrQs).map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                        {singleApprovers.mgrQs && (<div className="mt-1 px-3 py-2 bg-gray-100 rounded text-xs text-gray-600 border border-gray-200 flex items-center"><span className="font-semibold mr-2">Email:</span> {getUser(singleApprovers.mgrQs)?.email || '-'}</div>)}
                    </div>
                </div>
                <div className="flex justify-end gap-3 pt-6 mt-4 border-t border-grey/20">
                    <button onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-grey hover:text-hitam transition-colors">Batal</button>
                    <button onClick={handleSubmit} className="px-5 py-2.5 bg-biru hover:bg-biru/90 text-putih text-sm font-bold rounded shadow-lg flex items-center transition-colors">
                        <CheckCircle className="w-4 h-4 mr-2" /> Submit & Selesai
                    </button>
                </div>
            </div>
        </div>
    )
}

/* --- 6. REVISION CONFIRMATION MODAL --- */
const RevisionConfirmationModal = ({ 
    isOpen, 
    onClose, 
    onConfirm 
}: { 
    isOpen: boolean; 
    onClose: () => void; 
    onConfirm: () => void;
}) => {
    if (!isOpen) return null
    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-hitam/60 p-4 font-arial backdrop-blur-sm transition-all">
            <div className="bg-putih w-full max-w-md p-6 rounded-xl shadow-2xl transform transition-all scale-100 border-t-4 border-hijau animate-in zoom-in duration-200">
                <div className="flex flex-col items-center text-center">
                    <div className="w-14 h-14 bg-biru/10 text-hijau rounded-full flex items-center justify-center mb-4">
                        <FileText className="w-7 h-7" />
                    </div>
                    <h3 className="text-xl font-bold text-hitam mb-2">Submit Revisi Laporan?</h3>
                    <p className="text-sm text-grey mb-6 leading-relaxed">
                        Anda akan mengirimkan kembali laporan ini. <br/>
                        <strong>Workflow Approval</strong> akan tetap sama seperti sebelumnya (Terkunci).
                    </p>
                    <div className="flex gap-3 w-full">
                        <button onClick={onClose} className="flex-1 px-4 py-2.5 bg-grey/10 text-hitam font-bold rounded-lg hover:bg-grey/20 transition-colors">Batal</button>
                        <button onClick={onConfirm} className="flex-1 px-4 py-2.5 bg-hijau text-putih font-bold rounded-lg hover:bg-hijau/90 transition-colors shadow-lg">Ya, Kirim Revisi</button>
                    </div>
                </div>
            </div>
        </div>
    )
}

/* ==========================================================================
   MAIN PAGE COMPONENT
   ========================================================================== */

export default function LaporanTemuanDetailPage() {
  const router = useRouter()
  const params = useParams() as { temuanId?: string }
  const temuanId = params?.temuanId ?? ''

  const [isLoading, setIsLoading] = useState(true)
  const [detail, setDetail] = useState<LaporanDetail | null>(null)
  const [checklistWithAnswers, setChecklistWithAnswers] = useState<ChecklistItemWithAnswer[]>([])
  const [nokModalItemId, setNokModalItemId] = useState<number | string | null>(null)

  const [isSaving, setIsSaving] = useState(false)
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false)
  const [isRevisionConfirmOpen, setIsRevisionConfirmOpen] = useState(false)
  const [userList, setUserList] = useState<any[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)

  const normalize = (v: string) =>
    (v || '').toLowerCase().trim().replace(/\s+/g, ' ')

  const isPatrolHSE = useMemo(() => {
    if (!detail?.jenis_audit) return false
    return detail.jenis_audit.toLowerCase().includes('patrol hse')
  }, [detail?.jenis_audit])

  /* ============================================================
     ✅ FIX FINAL — CURRENT USER DARI user_data (LOGIN KAMU)
     ============================================================ */
  useEffect(() => {
    try {
      const raw = localStorage.getItem('user_data')
      if (!raw) return
      const user = JSON.parse(raw)
      setCurrentUser(user)
      console.log('DEBUG USER LOGIN (FROM user_data):', user)
    } catch (err) {
      console.error('Gagal load user_data')
    }
  }, [])

  /* ============================================================
     ✅ FIX FINAL — CAN EDIT (VERSI FINAL)
     ============================================================ */
  const canEdit = useMemo(() => {
    if (!currentUser || !detail) return false

    const userName =
      normalize(currentUser.nama_lengkap || currentUser.name || '')

    const auditorRaw =
      detail.auditor ||
      detail.master?.nama_auditor ||
      ''

    const auditorList = auditorRaw
      .split(',')
      .map((n: string) => normalize(n))

    console.log('DEBUG USER LOGIN:', userName)
    console.log('DEBUG AUDITOR RAW:', auditorRaw)
    console.log('DEBUG AUDITOR LIST:', auditorList)

    const isAuditor = auditorList.includes(userName)

    const role = (currentUser.role || '').toLowerCase()
    const isQsStaff = role.includes('qs') && role.includes('staff')

    console.log('DEBUG isAuditor:', isAuditor)
    console.log('DEBUG isQsStaff:', isQsStaff)

    return isAuditor || isQsStaff
  }, [currentUser, detail])

  /* ================= FETCH USERS ================= */
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetchWithAuth(`/api/users`, { cache: 'no-store' })
        if (res.ok) {
          const json = await res.json()
          const mappedUsers = (json.data || []).map((u: any) => ({
            id: u.id ?? u.user_id,
            name: u.name || u.nama_lengkap || u.email || 'No Name',
            email: u.email,
            role: u.role || u.role_name || ''
          }))
          setUserList(mappedUsers)
        }
      } catch (error) {
        console.error('Gagal load users', error)
      }
    }
    fetchUsers()
  }, [])

  /* ================= FETCH DETAIL ================= */
  useEffect(() => {
    if (!temuanId) return

    const fetchDetail = async () => {
      setIsLoading(true)
      try {
        const res = await fetchWithAuth(
          `/api/audit/laporan-temuan/detailed/${encodeURIComponent(temuanId)}`,
          { cache: 'no-store' }
        )

        if (!res.ok) throw new Error('Gagal load data')

        const json = await res.json()
        const payload = json.data || {}
        const m = payload.master

        setDetail({
          pelaksanaan_id: m?.pelaksanaan_id,
          no_fta: m?.no_fta,
          tanggal_audit: m?.tanggal_audit,
          nama_checklist: m?.nama_checklist,
          jenis_audit: m?.nama_jenis_audit,
          site: m?.nama_site,
          area: m?.nama_area,
          auditor: m?.nama_auditor,
          master: m,
          status_laporan: m?.status_laporan,
          note_reject: m?.note_reject,
          approver_qs_spv_id: m?.approver_qs_spv_id,
          approver_mgr_area_id: m?.approver_mgr_area_id,
          approver_mgr_qs_id: m?.approver_mgr_qs_id,
          approver_pic_capa_ids: m?.approver_pic_capa_ids
        })

        const rawItems = payload.temuan || []

        const mappedItems: ChecklistItemWithAnswer[] = rawItems.map((it: any) => {
          const groupingCategory = it.kategori || it.kategori_checklist || 'Lain-lain'

          let existingFiles: string[] = []
          try {
            if (it.bukti_temuan) {
              if (Array.isArray(it.bukti_temuan)) existingFiles = it.bukti_temuan
              else {
                const parsed = JSON.parse(it.bukti_temuan)
                existingFiles = Array.isArray(parsed) ? parsed : [it.bukti_temuan]
              }
            }
          } catch {
            existingFiles = typeof it.bukti_temuan === 'string' ? [it.bukti_temuan] : []
          }

          return {
            ...it,
            kategori: groupingCategory,
            answer: {
              status: 'NOK',
              deskripsi_temuan: it.deskripsi_temuan || '',
              lokasi_temuan: it.lokasi_temuan || '',
              pic_capa: it.pic_user_id || '',
              kategori_temuan: it.kategori_temuan || '',
              data_integrity: it.data_integrity || '',
              prinsip_5r: it.prinsip_5r || '',
              files: [],
              existingFiles: existingFiles,
              justification: it.justification || 'Temuan'
            }
          }
        })

        setChecklistWithAnswers(mappedItems)
      } catch (err) {
        console.error(err)
        toast.error('Gagal memuat detail')
      } finally {
        setIsLoading(false)
      }
    }

    fetchDetail()
  }, [temuanId])

  const groupedItems = useMemo(() => {
    const groups = new Map<string, Map<string, ChecklistItemWithAnswer[]>>()
    checklistWithAnswers.forEach(item => {
      const kategori = item.kategori || 'Lain-lain'
      const sub = item.sub_kategori || 'Umum'
      if (!groups.has(kategori)) groups.set(kategori, new Map())
      const subMap = groups.get(kategori)!
      if (!subMap.has(sub)) subMap.set(sub, [])
      subMap.get(sub)!.push(item)
    })
    return groups
  }, [checklistWithAnswers])

  /* --- Logic Update Justification --- */
  const updateJustification = (itemId: number | string, type: 'Temuan' | 'Observasi') => {
      setChecklistWithAnswers(prev => prev.map(item => {
          const currentId = item.item_id ?? item.id ?? item.temuan_id
          let safeId = currentId
          if (typeof safeId === 'object' && safeId !== null) safeId = safeId.id ?? safeId.item_id
          
          if (String(safeId) === String(itemId)) {
              return {
                  ...item,
                  answer: { ...item.answer, justification: type }
              }
          }
          return item
      }))
  }

  /* --- Logic Simpan Modal --- */
  const handleNokModalSave = async (itemId: number | string, temuanData: any) => {
    const updatedItems: ChecklistItemWithAnswer[] = checklistWithAnswers.map(it => {
        const currentId = it.item_id ?? it.id ?? it.temuan_id
        let safeItemId = currentId
        if (typeof safeItemId === 'object' && safeItemId !== null) safeItemId = safeItemId.id ?? safeItemId.item_id
        if (String(safeItemId) === String(itemId)) {
            return { ...it, answer: { ...it.answer, ...temuanData, status: 'NOK' as const } }
        }
        return it
    })
    setChecklistWithAnswers(updatedItems)
    setNokModalItemId(null)

    const toastId = toast.loading('Menyimpan ke database...')
    try {
        const currentItem = updatedItems.find(it => {
             const currentId = it.item_id ?? it.id ?? it.temuan_id
             let safeId = currentId
             if (typeof safeId === 'object' && safeId !== null) safeId = safeId.id ?? safeId.item_id
             return String(safeId) === String(itemId)
        })
        if (!currentItem) { toast.dismiss(toastId); return }

        let idToSend = currentItem.item_id;
        if (typeof idToSend === 'object' && idToSend !== null) idToSend = idToSend.id ?? idToSend.item_id;
        if (!idToSend) idToSend = currentItem.id;

        const formData = new FormData()
        const singleItemData = [{
            item_id: idToSend,
            status: 'NOK',
            deskripsi_temuan: temuanData.deskripsi_temuan,
            lokasi_temuan: temuanData.lokasi_temuan,
            pic_user_id: null, 
            kategori_temuan: temuanData.kategori_temuan, 
            data_integrity: temuanData.data_integrity,
            prinsip_5r: temuanData.prinsip_5r,
            existing_files: temuanData.existingFiles,
            justification: currentItem.answer.justification 
        }]
        formData.append('answers_data', JSON.stringify(singleItemData))
        if (temuanData.files && temuanData.files.length > 0) {
            temuanData.files.forEach((file: File) => {
                formData.append('files', file)
                formData.append('file_item_ids', String(idToSend))
            })
        }
        
        const token = localStorage.getItem('token') || ''; 
        const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || ''
        
        const res = await fetch(`${API_BASE}/api/audit/${temuanId}/save-draft-laporan`, { 
            method: 'POST', 
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData 
        })
        
        if (!res.ok) { const msg = await res.text(); throw new Error(msg) }
        toast.success('Tersimpan!', { id: toastId })
    } catch (e: any) { toast.error('Gagal simpan DB', { id: toastId }) }
  }

  /* --- 5. Logic Submit Final --- */
  const handleFinalSubmit = async (approverData: ApproverData) => {
      setIsSaving(true)
      const toastId = toast.loading('Mengirim laporan final...')
      try {
          const formData = new FormData()
          const answersData = checklistWithAnswers.map(item => {
              let idToSend = item.item_id;
              if (typeof idToSend === 'object' && idToSend !== null) idToSend = idToSend.id ?? idToSend.item_id;
              if (!idToSend) idToSend = item.id;

              return {
                item_id: idToSend,
                status: item.answer.status,
                deskripsi_temuan: item.answer.deskripsi_temuan || '',
                lokasi_temuan: item.answer.lokasi_temuan || '',
                pic_user_id: null,
                kategori_temuan: item.answer.kategori_temuan || '',
                data_integrity: item.answer.data_integrity || '',
                prinsip_5r: item.answer.prinsip_5r || '',
                existing_files: item.answer.existingFiles || [],
                justification: item.answer.justification
              }
          })
          formData.append('answers_data', JSON.stringify(answersData))
          const approversPayload = [{
              pic_capa_ids: [Number(approverData.picCapaId)], 
              qs_spv_id: Number(approverData.qsSpv),
              mgr_area_id: Number(approverData.mgrArea),
              mgr_qs_id: Number(approverData.mgrQs)
          }]
          formData.append('approvers_data', JSON.stringify(approversPayload))

          const token = localStorage.getItem('token') || '';
          const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';

          const res = await fetch(`${API_BASE}/api/audit/${temuanId}/submit-laporan`, { 
              method: 'POST', 
              headers: { 'Authorization': `Bearer ${token}` },
              body: formData 
          })
          
          if (!res.ok) { const msg = await res.text(); throw new Error(msg) }
          toast.success('Audit berhasil disubmit!', { id: toastId })
          setIsSubmitModalOpen(false)
          setIsRevisionConfirmOpen(false) 
          router.push('/laporan-temuan')
      } catch (e: any) {
          console.error(e)
          toast.error(`Gagal submit: ${e.message}`, { id: toastId })
      } finally {
          setIsSaving(false)
      }
  }

  const handleClickSubmit = () => {
      // [FIX] Cek status 'RPT_REJECTED_PIC' untuk menentukan mode revisi
      const isRevision = detail?.status_laporan === 'RPT_REJECTED_PIC';
      
      if (isRevision) { 
          setIsRevisionConfirmOpen(true); 
      } else { 
          setIsSubmitModalOpen(true); 
      }
  }

  const handleConfirmRevisionSubmit = () => {
      let picCapa = 0;
      // Parsing aman untuk ID PIC Capa
      if (Array.isArray(detail?.approver_pic_capa_ids) && detail.approver_pic_capa_ids.length > 0) {
         picCapa = detail.approver_pic_capa_ids[0];
      } else if (typeof detail?.approver_pic_capa_ids === 'string') {
         // Jika backend mengirim string JSON "[]" atau "[5]"
         try { 
             const parsed = JSON.parse(detail?.approver_pic_capa_ids);
             if (Array.isArray(parsed) && parsed.length > 0) picCapa = parsed[0];
         } catch {} 
      }
      
      const existingApprovers: ApproverData = {
          picCapaId: picCapa, 
          qsSpv: detail?.approver_qs_spv_id || 0,
          mgrArea: detail?.approver_mgr_area_id || 0,
          mgrQs: detail?.approver_mgr_qs_id || 0
      };
      
      handleFinalSubmit(existingApprovers);
  }

  /* --- Validasi All Closed --- */
  const allClosed = checklistWithAnswers.length > 0 && checklistWithAnswers.every(item => {
      const ans = item.answer
      let isFilled = !!(ans.deskripsi_temuan && ans.lokasi_temuan && ans.kategori_temuan)
      
      if (!isPatrolHSE) {
          isFilled = isFilled && !!(ans.data_integrity && ans.prinsip_5r)
      }
      return isFilled
  })

  if (isLoading) return <div className="p-12 text-center text-grey">Memuat data...</div>
  if (!temuanId) return <div className="p-12 text-center text-red-500">ID Laporan tidak valid</div>

  return (
    <>
      <Toaster position="top-center" />
      <Link href="/laporan-temuan" className="flex items-center text-sm text-biru hover:underline mb-4 font-arial">
        <ArrowLeft className="w-4 h-4 mr-1" /> Kembali ke Laporan Temuan
      </Link>
      
      {/* ALERT REVISI (TAMPIL JIKA ADA NOTE_REJECT, APAPUN STATUSNYA) */}
      {detail?.note_reject && detail.note_reject !== "" && detail.note_reject !== "-" && (
        <div className="mb-6 rounded-lg border-l-4 border-red-500 bg-red-50 p-4 shadow-sm animate-in fade-in zoom-in">
          <div className="flex items-start gap-3">
            <div className="text-red-500 mt-1"><AlertTriangle className="w-6 h-6" /></div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-red-800">Laporan Dikembalikan oleh PIC Area</h3>
              <p className="mt-1 text-sm text-red-700 font-medium">Laporan ini dikembalikan oleh PIC dengan catatan. Mohon periksa dan revisi temuan yang relevan.</p>
              <div className="mt-3 bg-white/60 p-3 rounded border border-red-100"><span className="text-xs font-bold text-red-500 uppercase tracking-wide">Catatan PIC:</span><p className="text-gray-800 italic mt-1">"{detail.note_reject}"</p></div>
            </div>
          </div>
        </div>
      )}

      {!canEdit && (<div className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-700"> Mode <b>Read Only</b>. Hanya auditor terdaftar atau QS Staff yang dapat mengubah data laporan ini.</div>)}

      {detail && <AuditHeader info={detail} nokCount={checklistWithAnswers.length} />}
      
      <div className="bg-putih p-6 rounded-lg shadow-md font-arial mb-24">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-grey/40 border-x border-grey/40">
            <thead className="bg-grey/10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-grey uppercase tracking-wider">No.</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase tracking-wider min-w-[200px]">Check Item</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase tracking-wider">Ref Doc</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase tracking-wider">Deskripsi</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase tracking-wider">Bukti Temuan</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase tracking-wider">Lokasi</th>
                {!isPatrolHSE && (<><th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase tracking-wider">Data Integrity</th><th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase tracking-wider">5R</th></>)}
                <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase tracking-wider">Kategori</th>
                <th className="px-6 py-3 text-center text-xs font-bold text-grey uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-center text-xs font-bold text-grey uppercase tracking-wider min-w-[140px]">Justifikasi</th>
                <th className="px-6 py-3 text-center text-xs font-bold text-grey uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-putih divide-y divide-grey/40">
              {Array.from(groupedItems.entries()).map(([kategori, subGroups]) => (
                <React.Fragment key={kategori}>
                  <tr className="bg-biru/5"><td colSpan={isPatrolHSE ? 10 : 12} className="px-4 py-3 text-sm font-bold text-biru uppercase tracking-wide">{kategori}</td></tr>
                  {Array.from(subGroups.entries()).map(([sub, items]) => (
                    <React.Fragment key={sub}>
                      {items.map((item, idx) => {
                        const buktiNames = [...(item.answer.existingFiles || []), ...(item.answer.files || []).map(f => f.name)]
                        
                        let isFilled = !!(item.answer.deskripsi_temuan && item.answer.lokasi_temuan && item.answer.kategori_temuan)
                        
                        if (!isPatrolHSE) {
                            isFilled = isFilled && !!(item.answer.data_integrity && item.answer.prinsip_5r)
                        }
                        
                        return (
                          <tr key={item.item_id ?? item.id} className="hover:bg-grey/5 transition-colors">
                            <td className="px-4 py-4 text-sm text-hitam text-center font-medium align-top">{idx + 1}</td>
                            <td className="px-6 py-4 text-sm text-hitam leading-relaxed align-top">{item.item_checklist_text}</td>
                            <td className="px-6 py-4 text-sm text-hitam/70 align-top">{item.referensi_doc || '-'}</td>
                            <td className="px-6 py-4 text-sm text-hitam align-top">{item.answer.deskripsi_temuan || '-'}</td>
                            <td className="px-6 py-4 text-sm text-hitam align-top"><div className="flex flex-wrap gap-2">{buktiNames.length > 0 ? buktiNames.map((n, i) => <FileDisplay key={i} filePath={n} />) : '-'}</div></td>
                            <td className="px-6 py-4 text-sm text-hitam align-top">{item.answer.lokasi_temuan || '-'}</td>
                            {!isPatrolHSE && (<><td className="px-6 py-4 text-sm text-hitam align-top">{item.answer.data_integrity || '-'}</td><td className="px-6 py-4 text-sm text-hitam align-top">{item.answer.prinsip_5r || '-'}</td></>)}
                            <td className="px-6 py-4 text-sm text-hitam align-top">{item.answer.kategori_temuan || '-'}</td>
                            <td className="px-6 py-4 text-center align-top"><span className={`px-3 py-1 rounded-full text-xs font-bold ${isFilled ? 'bg-hijau/10 text-hijau' : 'bg-biru/10 text-biru'}`}>{isFilled ? 'Close' : 'Open'}</span></td>
                            
                            <td className="px-6 py-4 text-center align-top">
                                <div className="flex flex-col gap-2 justify-center items-center">
                                    <button disabled={!canEdit} onClick={() => canEdit && updateJustification(item.item_id ?? item.id ?? item.temuan_id ?? 0, 'Temuan')} className={`px-3 py-1 text-xs font-bold rounded border transition-all w-full ${item.answer.justification === 'Temuan' ? 'bg-biru/10 text-biru' : 'bg-white text-grey border-grey/30 hover:bg-grey/10'}`}>Temuan</button>
                                    <button disabled={!canEdit} onClick={() => canEdit && updateJustification(item.item_id ?? item.id ?? item.temuan_id ?? 0, 'Observasi')} className={`px-3 py-1 text-xs font-bold rounded border transition-all w-full ${item.answer.justification === 'Observasi' ? 'bg-hijau/10 text-hijau' : 'bg-white text-grey border-grey/30 hover:bg-grey/10'}`}>Observasi</button>
                                </div>
                            </td>

                            <td className="px-6 py-4 text-center align-top">
                                <button disabled={!canEdit} onClick={() => canEdit && setNokModalItemId(item.item_id ?? item.id ?? item.temuan_id)} className={`flex items-center justify-center p-2 rounded-lg transition-all mx-auto mt-1 ${canEdit
                                ? 'bg-grey/20 text-grey hover:text-biru hover:bg-grey/40'
                                : 'bg-grey/10 text-grey/40 cursor-not-allowed'}`}> <Edit className="w-4 h-4" /></button>
                            </td>
                          </tr>
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
          <div className="w-full flex justify-between items-center px-6">
              <div className="flex items-center text-sm text-grey">{allClosed ? <span className="flex items-center text-hijau font-bold"><CheckCircle className="w-5 h-5 mr-2"/> Semua data telah lengkap. Siap submit.</span> : <span className="flex items-center text-biru font-bold"><AlertCircle className="w-5 h-5 mr-2"/> Lengkapi temuan (Status Close) untuk submit.</span>}</div>
              <div className="flex gap-3">
                  <button disabled={isSaving || !allClosed || !canEdit} onClick={handleClickSubmit} className={`flex items-center px-8 py-3 font-bold text-putih rounded shadow-lg transition-all ${allClosed ? 'bg-biru hover:bg-biru/90 transform hover:-translate-y-0.5' : 'bg-grey/40 cursor-not-allowed opacity-70'}`}>
                      <Save className="w-5 h-5 mr-2" /> 
                      {detail?.status_laporan === 'RPT_REJECTED_PIC' ? "Kirim Revisi" : "Submit & Selesai"}
                  </button>
              </div>
          </div>
      </div>
      
     {canEdit && nokModalItemId && (<NokModal item={checklistWithAnswers.find(it => { const currentId = it.item_id ?? it.id ?? it.temuan_id; let safeId = currentId; if (typeof safeId === 'object' && safeId !== null) safeId = safeId.id ?? safeId.item_id; return String(safeId) === String(nokModalItemId) })!} onClose={() => setNokModalItemId(null)} onSave={handleNokModalSave} userList={userList} isPatrolHSE={isPatrolHSE} />)}
      
      <SubmitWorkflowModal isOpen={isSubmitModalOpen} onClose={() => setIsSubmitModalOpen(false)} onConfirm={handleFinalSubmit} userList={userList} />
      <RevisionConfirmationModal isOpen={isRevisionConfirmOpen} onClose={() => setIsRevisionConfirmOpen(false)} onConfirm={handleConfirmRevisionSubmit} />
    </>
  )
}