'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Toaster, toast } from 'react-hot-toast'
import { 
    ArrowLeft, CheckCircle, UploadCloud, 
    ChevronDown, ChevronUp, Paperclip, 
    X, Calendar, FileEdit,
    UserX, AlertTriangle, Lock,
    Clock
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
    
    // Kolom Justifikasi
    justifikasi?: string | null

    pic_user_id?: number | string | null 
    pic_name?: string | null 
    
    bukti_perbaikan?: string[] | null
    catatan_perbaikan?: string | null 
    
    // [UPDATE] Field Tanggal Upload
    tgl_upload_bukti?: string | null

    verification_status?: string | null
    status?: string | null
    status_evidence?: string | null
    catatan_verifikasi?: string | null
    rejector_name?: string | null

    capa?: CapaData
    [key: string]: any

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
    
    tgl_approve_qs_spv?: string
    tgl_approve_mgr_area?: string
    tgl_approve_mgr_qs?: string
    tgl_submit_capa?: string 
    note_reject?: string
}

/* --- COMPONENTS (Helpers) --- */
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
          <div><p className="text-sm font-medium text-grey">Total Temuan</p><p className="text-lg font-bold text-biru">{totalItems}</p></div>
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
        <a href={fullUrl} target="_blank" rel="noopener noreferrer" className="flex items-center p-1.5 bg-gray-50 rounded border border-gray-200 hover:bg-biru/10 hover:text-biru transition-colors text-xs text-grey max-w-fit mb-1 group" title={fileName}>
            <Paperclip className="h-3 w-3 mr-1.5 text-grey group-hover:text-biru" /> 
            <span className="truncate max-w-[150px]">{fileName}</span>
            {label && <span className="ml-1 text-[9px] px-1 bg-hijau/20 text-hijau rounded border border-hijau/30">{label}</span>}
        </a>
    )
}

/* --- MODAL UPLOAD --- */
const EvidenceUploadModal = ({ item, onClose, onSave }: { 
    item: TemuanItem; 
    onClose: () => void; 
    onSave: (id: number | string, files: File[], notes: string) => void; 
}) => {
    const [selectedFiles, setSelectedFiles] = useState<File[]>([])
    const [notes, setNotes] = useState(item.catatan_perbaikan || '') 
    const fileRef = useRef<HTMLInputElement | null>(null)

    // [UPDATE] Logic Validasi Size 5MB
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return
        const files = Array.from(e.target.files)
        const validFiles: File[] = []
        const MAX_SIZE = 5 * 1024 * 1024 // 5 MB

        files.forEach(file => {
            if (file.size > MAX_SIZE) {
                toast.error(`File "${file.name}" terlalu besar (Max 5MB)`)
            } else {
                validFiles.push(file)
            }
        })

        if (validFiles.length > 0) {
            setSelectedFiles(prev => [...prev, ...validFiles])
        }

        // Reset value agar bisa select file yang sama jika dihapus lalu dipilih lagi
        if (e.target) e.target.value = ''
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (selectedFiles.length === 0) return toast.error('Harap lampirkan minimal 1 bukti perbaikan.')
        onSave(item.item_id ?? item.id ?? item.temuan_id ?? 0, selectedFiles, notes)
    }

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-hitam/60 p-4 font-arial backdrop-blur-sm">
            <div className="bg-putih w-full max-w-lg p-6 rounded-xl shadow-2xl border-t-4 border-biru animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h4 className="text-lg font-bold text-hitam flex items-center">
                        <UploadCloud className="w-6 h-6 text-biru mr-2"/> 
                        Upload Bukti Perbaikan
                    </h4>
                    <button onClick={onClose}><X className="w-6 h-6 text-grey hover:text-hitam" /></button>
                </div>
                
                <div className="bg-biru/5 p-4 rounded-lg mb-6 border border-biru/20 text-sm">
                    <p className="font-bold text-biru mb-1">Temuan: {item.item_checklist_text}</p>
                    <p className="text-biru/80 mb-0 text-xs leading-relaxed">{item.deskripsi_temuan}</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-xs font-bold text-grey mb-2 uppercase tracking-wide">
                            Lampiran Bukti (Foto/Dokumen) <span className="text-red-500 normal-case ml-1 font-normal text-[10px]">*Max 5MB</span>
                        </label>
                        <input ref={fileRef} type="file" multiple onChange={handleFileChange} className="hidden" accept="image/*,application/pdf" />
                        
                        <button type="button" onClick={() => fileRef.current?.click()} className="w-full py-6 border-2 border-dashed border-biru/40 rounded-lg bg-biru/5 hover:bg-biru/10 text-biru font-medium flex flex-col items-center justify-center transition group">
                            <div className="p-3 bg-putih rounded-full shadow-sm mb-2 group-hover:scale-110 transition-transform">
                                <UploadCloud className="w-6 h-6 text-biru"/>
                            </div>
                            <span className="text-sm font-bold">Klik untuk pilih file</span>
                            <span className="text-xs text-grey/70 mt-1 font-normal">Maksimal 5 MB per file (Foto/PDF)</span>
                        </button>

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
                            <FileEdit className="w-3 h-3 mr-1"/> Catatan / Komentar (Opsional)
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full p-3 border border-grey/30 rounded-lg text-sm focus:ring-2 focus:ring-biru/50 focus:border-biru outline-none transition shadow-sm resize-none text-hitam placeholder-grey/50"
                            rows={3}
                            placeholder="Tulis keterangan tambahan mengenai perbaikan yang dilakukan..."
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-3 border-t border-grey/10">
                        <button type="button" onClick={onClose} className="px-5 py-2.5 bg-putih border border-grey/30 text-grey rounded-lg hover:bg-grey/10 font-bold text-sm transition">
                            Batal
                        </button>
                        
                        <button type="submit" className="px-6 py-2.5 bg-biru text-putih rounded-lg hover:opacity-90 font-bold shadow-md hover:shadow-lg text-sm transition flex items-center">
                            <CheckCircle className="w-4 h-4 mr-2"/> Simpan Perbaikan
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

/* ==========================================================================
   MAIN PAGE
   ========================================================================== */
export default function EvidenceDetailPage() {
    const router = useRouter()
    const params = useParams() as any
    const perbaikanId = params?.perbaikanId || params?.id || ''
    
    const [isLoading, setIsLoading] = useState(true)
    const [detail, setDetail] = useState<LaporanDetail | null>(null)
    const [items, setItems] = useState<TemuanItem[]>([])
    
    const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})
    const [isSaving, setIsSaving] = useState(false)
    const [modalItemId, setModalItemId] = useState<number | string | null>(null)
    
    const [userList, setUserList] = useState<any[]>([]);

    const [currentUser, setCurrentUser] = useState<any>(null)

    useEffect(() => {
    try {
        const user = localStorage.getItem('user_data')
        if (user) setCurrentUser(JSON.parse(user))
    } catch {}
    }, [])


    const isPatrolHSE = useMemo(() => {
        if (!detail?.jenis_audit) return false;
        return detail.jenis_audit.toLowerCase().includes("patrol hse");
    }, [detail?.jenis_audit]);


    const isItemPicCapa = (item: TemuanItem) => {
    if (!currentUser) return false
    const userId = Number(currentUser.id || currentUser.user_id)
    return Number(item.pic_user_id) === userId
    }


    // Helper Date Format
    const formatDateShort = (str?: string | null) => {
        if(!str || str === 'null') return '-'
        const d = new Date(str)
        return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    }

    // FETCH DATA
    useEffect(() => {
        if (!perbaikanId) return;

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

        const fetchData = async () => {
            try {
                setIsLoading(true)
                const res = await fetchWithAuth(`/api/audit/laporan-temuan/detailed/${perbaikanId}`, { cache: 'no-store' })
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
                    tgl_approve_qs_spv: m.tgl_approve_qs_spv,
                    tgl_approve_mgr_area: m.tgl_approve_mgr_area,
                    tgl_approve_mgr_qs: m.tgl_approve_mgr_qs,
                    tgl_submit_capa: m.tgl_submit_capa,
                    note_reject: m.note_reject,
                })
    
                const mappedItems = t.map((it: any) => {
                    let existingFiles: string[] = []
                    let evidenceFiles: string[] = [] 
                    
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
                    } catch { existingFiles = [] }
    
                    return {
                        id: it.temuan_id, 
                        item_id: it.item_id,
                        status_evidence: it.status_evidence,
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
                        
                        // Mapping Justifikasi
                        justifikasi: it.justifikasi || it.justification || '-',

                        catatan_perbaikan: it.catatan_perbaikan || null,
                        // [UPDATE] Mapping Tanggal Upload
                        tgl_upload_bukti: it.tgl_upload_bukti,

                        verification_status: it.hasil_verifikasi || it.status_verifikasi,
                        status: it.status || it.status_temuan || null,
                        catatan_verifikasi: it.catatan_verifikasi,
                        rejector_name: it.verifikator_name || it.rejected_by_name || 'Verifikator',

                        pic_user_id: it.pic_user_id,
                        pic_name: it.pic_name || it.PicName || it.picName || null,

                        capa: {
                            root_cause: it.root_cause || '-',
                            corrective_action: it.corrective_action || '-',
                            due_date: it.due_date ? it.due_date.split('T')[0] : ''
                        }
                    }
                })
                setItems(mappedItems)
    
            } catch (e) { console.error(e); toast.error("Gagal mengambil detail laporan") } 
            finally { setIsLoading(false) }
        }

        fetchUsers()
        fetchData()
    }, [perbaikanId]);

    const getPicName = (item: TemuanItem) => {
        if (item.pic_name && item.pic_name !== '-') {
            return item.pic_name;
        }
        const id = item.pic_user_id;
        if (id) {
            const user = userList.find((u) => String(u.id) === String(id));
            if (user) return user.name;
        }
        return '-';
    }

    const visibleItems = useMemo(() => {
    if (!items || items.length === 0) return []

    return items.filter(it => {
        const status = it.status_evidence;

        return (
            status === 'READY_FOR_CAPA' ||
            status === 'EVIDENCE_IN_PROGRESS' ||
            status === 'EVIDENCE_REJECTED_AUDITOR' ||
            status === 'EVIDENCE_REJECTED_QSSPV' ||
            status === null || 
            status === ''
        )
    })
}, [items])

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

    const handleUploadEvidence = async (itemId: number | string, files: File[], notes: string) => {
        setIsSaving(true)
        const toastId = toast.loading('Mengupload bukti...')
        try {
            const formData = new FormData()
            files.forEach(f => formData.append('files', f))
            if(notes) formData.append('catatan_perbaikan', notes)

            const token = localStorage.getItem('token') || ''; 
            const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';

            const res = await fetch(`${API_BASE}/api/audit/${perbaikanId}/upload-evidence/${itemId}`, { 
                method: 'POST', 
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
                body: formData 
            })

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || 'Gagal upload file');
            }
            
            setItems(prev => prev.map(it => {
                const currentId = it.item_id ?? it.id
                if(String(currentId) === String(itemId)) {
                    return {
                        ...it,
                        bukti_perbaikan: files.map(f => f.name),
                        catatan_perbaikan: notes,
                        tgl_upload_bukti: new Date().toISOString(),
                        status: 'EVIDENCE_VERIF_PROGRESS',
                        verification_status: null 
                    }
                }
                return it
            }))
            
            toast.success('Bukti berhasil disimpan!', { id: toastId })
            setModalItemId(null)
        } catch (e: any) {
            console.error(e)
            toast.error(`Error: ${e.message}`, { id: toastId })
        } finally {
            setIsSaving(false)
        }
    }


    const evidenceCount = visibleItems.filter(it => it.status_evidence === 'EVIDENCE_IN_PROGRESS').length
    const isAllVisibleUploaded = visibleItems.length > 0 && evidenceCount === visibleItems.length;

    if (isLoading) return <div className="p-12 text-center text-grey">Memuat data...</div>
    if (!detail) return <div className="p-12 text-center text-red-500">Data tidak ditemukan.</div>

    return (
        <div className="font-arial pb-64">
            <Toaster position="top-center"/>
            <div className="px-2 mt-4">
                 <Link href="/laporan-bukti-perbaikan" className="flex items-center text-sm text-biru hover:underline mb-4 font-medium">
                    <ArrowLeft className="w-4 h-4 mr-1" /> Kembali ke Daftar
                </Link>
            </div>

            {detail && <AuditHeader info={detail} totalItems={items.length} />}

            {/* Info Box if Rejected */}
            {detail.note_reject && detail.status_laporan?.includes('REJECTED') && (
                <div className="mx-0 mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded shadow-sm flex items-start gap-3">
                    <AlertTriangle className="w-6 h-6 text-red-600 mt-0.5 flex-shrink-0" />
                    <div>
                        <h4 className="font-bold text-red-700">Laporan Dikembalikan (Revisi)</h4>
                        <p className="text-sm text-red-600 mt-1">
                            Verifikator menolak beberapa bukti perbaikan. Silakan perbaiki item yang berwarna merah dan upload ulang buktinya.
                        </p>
                        <div className="mt-2 text-xs font-mono bg-red-100 p-2 rounded text-red-800">
                            Catatan Global: "{detail.note_reject}"
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-putih p-6 rounded-lg shadow-md mb-8">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-3">
                        <h3 className="text-xl font-bold text-hitam">Upload Bukti Perbaikan </h3>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border 
                            ${isAllVisibleUploaded ? 'bg-hijau/10 text-hijau border-hijau/20' : 'bg-orange-100 text-orange-800 border-orange-200'}`}>
                            Progress: {evidenceCount} / {visibleItems.length}
                        </span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    {visibleItems.length === 0 ? (
                        <div className="p-8 text-center text-grey border border-dashed rounded-lg">
                            <CheckCircle className="w-10 h-10 mx-auto text-hijau mb-2"/>
                            <p>Semua item telah disetujui (Approved).</p>
                        </div>
                    ) : (
                    <table className="min-w-full divide-y divide-grey/40 border-x border-grey/40">
                        <thead className="bg-grey/10">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-bold text-grey uppercase w-10">No.</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase w-48">Check Item</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase w-24">Ref Doc</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase w-64">Deskripsi Temuan</th>
                                
                                <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase">Bukti Temuan</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase">Lokasi</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase">PIC</th>
                                
                                {!isPatrolHSE && (
                                    <>
                                            <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase">Data Int.</th>
                                            <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase">5R</th>
                                    </>
                                )}
                                
                                <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase">Kategori</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase w-32">Justifikasi</th>

                                <th className="px-6 py-3 text-center text-xs font-bold text-grey uppercase w-10">Detail</th>
                                <th className="px-6 py-3 text-center text-xs font-bold text-grey uppercase w-20">Action</th>
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
                                                const rowId = String(item.item_id ?? item.id)
                                                const isExpanded = expandedRows[rowId]
                                                const filesTemuan = Array.isArray(item.bukti_temuan) ? item.bukti_temuan : []
                                                const filesPerbaikan = Array.isArray(item.bukti_perbaikan) ? item.bukti_perbaikan : []
                                                const hasEvidence = filesPerbaikan.length > 0
                                                
                                                const status = String(item.verification_status || '').toUpperCase();
                                                const isRejected = status === 'REJECTED' || status === 'REVISION';
                                                
                                                // GANTI baris isLocked yang lama dengan ini:
                                                const isLocked = !isItemPicCapa(item) || (
                                                    item.status_evidence !== null && 
                                                    item.status_evidence !== '' &&
                                                    item.status_evidence !== 'READY_FOR_CAPA' && 
                                                    item.status_evidence !== 'EVIDENCE_IN_PROGRESS' && 
                                                    item.status_evidence !== 'EVIDENCE_REJECTED_AUDITOR' &&
                                                    item.status_evidence !== 'EVIDENCE_REJECTED_QSSPV'
                                                );
                                                // Logic Warna Justifikasi
                                                const justificationText = item.justifikasi || '-';
                                                let justifikasiClass = "text-grey/80 italic"; 
                                                if (justificationText === 'Temuan') justifikasiClass = "text-biru font-bold not-italic";
                                                else if (justificationText === 'Observasi') justifikasiClass = "text-hijau font-bold not-italic";


                                                return (
                                                    <React.Fragment key={rowId}>
                                                        <tr className={`transition-colors ${isRejected ? 'bg-red-50' : (hasEvidence ? 'bg-hijau/5' : 'hover:bg-grey/5')}`}>
                                                            <td className="px-4 py-4 text-sm text-hitam text-center font-medium align-top">{idx + 1}</td>
                                                            <td className="px-6 py-4 text-sm text-hitam leading-relaxed align-top font-semibold">
                                                                {item.item_checklist_text}
                                                            </td>
                                                            <td className="px-6 py-4 text-sm text-hitam align-top">
                                                                {item.referensi_doc || '-'}
                                                            </td>
                                                            
                                                            <td className="px-6 py-4 text-sm text-hitam align-top">
                                                                <p className="mb-2">{item.deskripsi_temuan || '-'}</p>
                                                                {isRejected && (
                                                                    <div className="mt-2 p-3 bg-red-100 border border-red-200 rounded-lg text-xs animate-in fade-in zoom-in duration-300">
                                                                                <div className="flex items-center gap-1 font-bold text-red-700 mb-1">
                                                                                    <UserX className="w-3 h-3"/> 
                                                                                    Ditolak oleh: {item.rejector_name || 'Verifikator'}
                                                                                </div>
                                                                                <div className="text-red-600 italic border-t border-red-200 pt-1 mt-1">
                                                                                        "{item.catatan_verifikasi || 'Mohon diperbaiki sesuai standar.'}"
                                                                                </div>
                                                                    </div>
                                                                )}
                                                            </td>

                                                            <td className="px-6 py-4 text-sm text-hitam align-top">
                                                                <div className="flex flex-col gap-1">
                                                                        {filesTemuan.length > 0 ? filesTemuan.map((f, i) => <FileDisplay key={i} filePath={f} />) : '-'}
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 text-sm text-hitam align-top">{item.lokasi_temuan || '-'}</td>
                                                            
                                                            <td className="px-6 py-4 text-sm text-biru font-semibold align-top">{getPicName(item)}</td>
                                                            
                                                            {!isPatrolHSE && (
                                                                <>
                                                                        <td className="px-6 py-4 text-sm text-hitam align-top">{item.data_integrity || '-'}</td>
                                                                        <td className="px-6 py-4 text-sm text-hitam align-top">{item.prinsip_5r || '-'}</td>
                                                                </>
                                                            )}
                                                            
                                                            <td className="px-6 py-4 text-sm text-hitam align-top">
                                                                <span className="px-2 py-1 rounded text-xs font-bold bg-grey/10 border border-grey/20 text-hitam">
                                                                        {item.kategori_temuan || '-'}
                                                                </span>
                                                            </td>

                                                            <td className="px-6 py-4 text-sm align-top">
                                                                <span className={justifikasiClass}>{justificationText}</span>
                                                            </td>
                                                            
                                                            <td className="px-6 py-4 text-center align-top">
                                                                <button onClick={() => toggleRow(rowId)} className="p-2 bg-grey/10 rounded hover:bg-grey/20">{isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</button>
                                                            </td>
                                                            <td className="px-4 py-4 text-center align-top">
                                                                {isLocked ? (
                                                                    <button 
                                                                        disabled 
                                                                        className="p-2 rounded border border-hijau/30 bg-hijau/10 text-hijau cursor-not-allowed opacity-80"
                                                                        title="Sudah diapprove, tidak dapat diedit"
                                                                    >
                                                                        <Lock className="w-4 h-4" />
                                                                    </button>
                                                                ) : (
                                                                    <button 
                                                                        disabled={isLocked}
                                                                        onClick={() => {
                                                                        if (isLocked) return
                                                                            setModalItemId(item.item_id ?? item.id)
                                                                            }}
                                                                        className={`p-2 rounded border transition shadow-sm inline-flex items-center justify-center 
                                                                        ${isLocked 
                                                                            ? 'bg-grey/10 text-grey/40 border-grey/20 cursor-not-allowed'
                                                                            : 'bg-putih border-grey/30 hover:bg-biru/5 hover:border-biru hover:text-biru text-grey'}
                                                                        ${isRejected ? 'border-red-300 text-red-500 hover:bg-red-50 hover:border-red-500 hover:text-red-600' : ''}`}

                                                                        title={hasEvidence ? 'Edit Bukti' : 'Upload Bukti'}
                                                                    >
                                                                        <UploadCloud className="w-4 h-4" />
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                        {isExpanded && (
                                                            <tr className="bg-biru/5 border-b-2 border-grey/20">
                                                                <td colSpan={2}></td>
                                                                <td colSpan={isPatrolHSE ? 9 : 11} className="px-6 py-4 pb-6">
                                                                    <div className="bg-putih p-5 rounded-lg border border-biru/20 shadow-sm relative">
                                                                        <div className="absolute top-0 left-0 bg-biru text-putih text-[10px] px-2 py-1 rounded-br-lg rounded-tl-lg font-bold">DATA CAPA & BUKTI</div>
                                                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-sm mt-4">
                                                                            <div className="col-span-1 space-y-3 border-r border-grey/10 pr-4">
                                                                                <div><strong className="block text-grey text-xs uppercase tracking-wide mb-1">Root Cause</strong><p className="text-hitam font-medium">{item.capa?.root_cause}</p></div>
                                                                                <div><strong className="block text-grey text-xs uppercase tracking-wide mb-1">Tindakan Remedial</strong><p className="text-hitam font-medium">{item.capa?.corrective_action}</p></div>
                                                                                <div><strong className="block text-grey text-xs uppercase tracking-wide mb-1">Due Date</strong><p className="text-biru font-bold flex items-center"><Calendar className="w-3 h-3 mr-1" /> {item.capa?.due_date ? new Date(item.capa.due_date).toLocaleDateString('id-ID') : '-'}</p></div>
                                                                            </div>
                                                                            <div className="col-span-1 space-y-3 border-r border-grey/10 pr-4">
                                                                                <div>
                                                                                    <strong className="block text-xs uppercase tracking-wide mb-1 text-biru">Bukti Perbaikan (PIC)</strong>
                                                                                    {/* [DISPLAY TANGGAL UPLOAD] */}
                                                                                    {item.tgl_upload_bukti && (
                                                                                        <span className="text-[10px] text-grey mb-1 block items-center">
                                                                                            <Clock className="w-3 h-3 mr-1"/> {formatDateShort(item.tgl_upload_bukti)}
                                                                                        </span>
                                                                                    )}
                                                                                    <div className="flex flex-col gap-1 mt-1">{item.bukti_perbaikan && item.bukti_perbaikan.length > 0 ? item.bukti_perbaikan.map((f: string, i: number) => <FileDisplay key={i} filePath={f} label="Fixed" />) : <span className="text-orange-500 text-xs italic">Belum ada bukti</span>}</div>
                                                                                </div>
                                                                                <div><strong className="block text-grey text-xs uppercase tracking-wide mb-1">Catatan PIC</strong><div className="bg-yellow-50 p-2 rounded border border-yellow-200 text-xs text-hitam italic">"{item.catatan_perbaikan || '-'}"</div></div>
                                                                            </div>
                                                                            <div className="col-span-1 space-y-3">
                                                                                <div>
                                                                                    <strong className="block text-xs uppercase tracking-wide mb-1 text-hijau">Bukti Verifikasi (Opsional)</strong>
                                                                                    <div className="flex flex-col gap-1 mt-1">{item.bukti_verifikasi && item.bukti_verifikasi.length > 0 ? item.bukti_verifikasi.map((f: string, i: number) => <FileDisplay key={i} filePath={f} label="Verif" />) : <span className="text-grey text-xs italic">- Tidak ada -</span>}</div>
                                                                                </div>
                                                                                <div><strong className="block text-grey text-xs uppercase tracking-wide mb-1">Catatan Verifikasi</strong><div className="bg-purple-50 p-2 rounded border border-purple-200 text-xs text-hitam">{item.catatan_verifikasi || '-'}</div></div>
                                                                            </div>
                                                                            {isRejected && item.catatan_verifikasi_bukti && (
                                                                                <div className="col-span-1 bg-red-50 p-3 rounded border border-red-200"><strong className="block text-red-600 text-xs uppercase tracking-wide mb-1">Alasan Penolakan</strong><p className="text-red-700 italic text-xs">"{item.catatan_verifikasi_bukti}"</p></div>
                                                                            )}
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
                    )}
                </div>
            </div>



            {modalItemId && items.find(it => String(it.item_id ?? it.id) === String(modalItemId)) && isItemPicCapa(items.find(it => String(it.item_id ?? it.id) === String(modalItemId))!) && (
                <EvidenceUploadModal 
                    item={items.find(it => String(it.item_id ?? it.id) === String(modalItemId))!} 
                    onClose={() => setModalItemId(null)} 
                    onSave={handleUploadEvidence} 
                />
            )}
        </div>
    )
}