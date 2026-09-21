'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Toaster, toast } from 'react-hot-toast'
import { ArrowLeft, X, CheckCircle, FileText, UserCheck, AlertCircle, Edit } from 'lucide-react'
import Link from 'next/link'
import { fetchWithAuth } from '@/utils/api' 
import { getStatusColor, getStatusLabel } from '@/utils/statusHelper'
import { AuditHeaderInfo, AuditCheckItem } from '@/types/audit'

// --- INTERFACES LOCAL ---
interface ReviewForm {
  status: 'OK' | 'NOK' | 'N/A' | null
  deskripsi_temuan: string
  lokasi_temuan: string
  files: File[]
  existingFiles: string[]
  kategori_temuan: string
  data_integrity: string
  prinsip_5r: string
  justification?: 'Temuan' | 'Observasi' | null
}

type ChecklistItemWithAnswer = AuditCheckItem & {
    answer: ReviewForm;
    catatan_verifikasi?: string | null;
    status_verifikasi?: string | null;
    pic_user_id?: number | null;
}

/* --- 1. Audit Header --- */
const AuditHeader = ({ info, nokCount }: { info: Partial<AuditHeaderInfo>; nokCount?: number }) => {
  const parse = (v: any) => (v == null || v === '' ? '-' : String(v))
  const formatDateLong = (raw?: string) => {
    if (!raw || raw === '0001-01-01T00:00:00Z') return '-'
    const d = new Date(raw)
    return isNaN(d.getTime()) ? '-' : new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }).format(d)
  }

  return (
    <div className="bg-putih p-6 rounded-lg shadow-md mb-6 font-arial border border-gray-100">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
        <div><p className="text-sm font-medium text-grey">NO FTA</p><p className="text-lg font-bold text-hitam">{parse(info.no_fta)}</p></div>
        <div><p className="text-sm font-medium text-grey">Jenis Audit</p><p className="text-lg font-bold text-hitam">{parse(info.nama_jenis_audit)}</p></div>
        <div><p className="text-sm font-medium text-grey">Auditor</p><p className="text-lg font-bold text-hitam">{parse(info.nama_auditor)}</p></div>
        <div><p className="text-sm font-medium text-grey">Site / Area</p><p className="text-lg font-bold text-hitam">{parse(info.nama_site)} - {parse(info.nama_area)}</p></div>
        <div><p className="text-sm font-medium text-grey">Tgl Pelaksanaan</p><p className="text-lg font-bold text-hitam">{formatDateLong(info.tanggal_audit)}</p></div>
        <div><p className="text-sm font-medium text-grey">Jumlah Temuan (NOK)</p><p className="text-lg font-bold text-hitam">{typeof nokCount === 'number' ? nokCount : '-'}</p></div>
        
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

/* --- 2. File Display --- */
const FileDisplay = ({ filePath }: { filePath: string }) => {
  if (!filePath || filePath === '-') return <span>-</span>
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || ''
  let normalizedPath = String(filePath).replace(/\\/g, '/')
  if (normalizedPath.startsWith('/')) normalizedPath = normalizedPath.substring(1)
  const fullUrl = `${API_BASE}/${normalizedPath}`
  const fileName = normalizedPath.split('/').pop() || 'File'

  return (
    <a href={fullUrl} target="_blank" rel="noopener noreferrer" className="flex items-center p-1.5 bg-gray-50 rounded border border-gray-200 hover:bg-blue-50 hover:text-blue-600 transition-colors text-xs text-gray-600 max-w-fit" title={fileName}>
      <FileText className="h-3 w-3 mr-1.5 flex-shrink-0" /><span className="truncate max-w-[120px]">{fileName}</span>
    </a>
  )
}

/* --- 3. REVIEW MODAL --- */
const ReviewModal = ({ 
    item, 
    onClose, 
    onSave,
    isPatrolHSE 
}: { 
    item: ChecklistItemWithAnswer; 
    onClose: () => void; 
    onSave: (id: number | string, data: Partial<ReviewForm>) => void;
    isPatrolHSE: boolean;
}) => {
  const [deskripsi, setDeskripsi] = useState(item.answer.deskripsi_temuan || '')
  const [lokasi, setLokasi] = useState(item.answer.lokasi_temuan || '')
  const [kategoriTemuan, setKategoriTemuan] = useState(item.answer.kategori_temuan || '') 
  const [dataIntegrity, setDataIntegrity] = useState(item.answer.data_integrity || '')
  const [prinsip5R, setPrinsip5R] = useState(item.answer.prinsip_5r || '')
  const [justification, setJustification] = useState<'Temuan' | 'Observasi'>(item.answer.justification || 'Temuan')

  useEffect(() => {
      if (item) {
          setDeskripsi(item.answer.deskripsi_temuan || '')
          setLokasi(item.answer.lokasi_temuan || '')
          setKategoriTemuan(item.answer.kategori_temuan || '')
          setDataIntegrity(item.answer.data_integrity || '')
          setPrinsip5R(item.answer.prinsip_5r || '')
          setJustification(item.answer.justification || 'Temuan')
      }
  }, [item])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!deskripsi || !lokasi || !kategoriTemuan) {
       return toast.error('Deskripsi, Lokasi, dan Kategori wajib diisi.')
    }

    if (!isPatrolHSE) {
        if (!dataIntegrity || !prinsip5R) {
            return toast.error('Data Integrity & 5R wajib dilengkapi.')
        }
    }

    onSave(item.item_id, { 
        deskripsi_temuan: deskripsi, 
        lokasi_temuan: lokasi, 
        kategori_temuan: kategoriTemuan, 
        data_integrity: isPatrolHSE ? '-' : dataIntegrity, 
        prinsip_5r: isPatrolHSE ? '-' : prinsip5R,
        justification: justification
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-hitam/50 p-4 font-arial backdrop-blur-sm">
      <div className="bg-putih w-full max-w-lg p-6 rounded-lg shadow-xl max-h-[90vh] overflow-y-auto border-t-4 border-biru animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-biru" />
            <h4 className="text-lg font-bold text-hitam">Review QS Supervisor</h4>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-grey hover:text-hitam" /></button>
        </div>
        
        <div className="bg-blue-50 p-3 rounded mb-4 text-xs text-biru border border-blue-100">
            <strong>Instruksi QS:</strong> Periksa data yang diinput Auditor. Anda dapat mengubah detail dan justifikasi temuan di sini.
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-grey block mb-1">Check Item</label>
            <div className="p-3 bg-grey/5 rounded text-sm text-hitam border border-grey/20">{item.item_checklist_text}</div>
          </div>
          
          <div>
             <label className="text-sm font-medium text-grey block mb-1">Justifikasi</label>
             <select 
                value={justification} 
                onChange={(e) => setJustification(e.target.value as 'Temuan' | 'Observasi')} 
                className={`w-full p-2 border rounded font-bold outline-none focus:ring-1 focus:ring-biru
                    ${justification === 'Temuan' ? 'bg-biru/10 text-biru border-biru/30' : 'bg-hijau/10 text-hijau border-hijau/30'}
                `}
             >
                 <option value="Temuan">Temuan</option>
                 <option value="Observasi">Observasi</option>
             </select>
          </div>

          <div>
            <label className="text-sm font-medium text-grey block mb-1">Deskripsi Temuan</label>
            <textarea value={deskripsi} onChange={(e) => setDeskripsi(e.target.value)} className="w-full p-2 border rounded text-hitam focus:ring-1 focus:ring-biru bg-white" rows={3} />
          </div>
          
          <div>
            <label className="text-sm font-medium text-grey block mb-1">Lokasi Temuan</label>
            <input value={lokasi} onChange={(e) => setLokasi(e.target.value)} className="w-full p-2 border rounded text-hitam focus:ring-1 focus:ring-biru bg-white" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="text-sm font-medium text-grey block mb-1">Kategori</label>
                <select value={kategoriTemuan} onChange={(e) => setKategoriTemuan(e.target.value)} className="w-full p-2 border rounded bg-white text-hitam focus:ring-1 focus:ring-biru">
                    <option value="">- Pilih -</option>
                    <option value="Critical">Critical</option>
                    <option value="Major">Major</option>
                    <option value="Minor">Minor</option>
                </select>
            </div>
            
            {!isPatrolHSE && (
                <div>
                    <label className="text-sm font-medium text-grey block mb-1">Data Integrity</label>
                    <select value={dataIntegrity} onChange={(e) => setDataIntegrity(e.target.value)} className="w-full p-2 border rounded bg-white text-hitam focus:ring-1 focus:ring-biru">
                        <option value="">- Pilih -</option>
                        <option value="Attributable">Attributable</option>
                        <option value="Legible">Legible</option>
                        <option value="Contemporaneous">Contemporaneous</option>
                        <option value="Original">Original</option>
                        <option value="Accurate">Accurate</option>
                        <option value="-">-</option>
                    </select>
                </div>
            )}
          </div>
          
          {!isPatrolHSE && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-grey block mb-1">5R</label>
                    <select value={prinsip5R} onChange={(e) => setPrinsip5R(e.target.value)} className="w-full p-2 border rounded bg-white text-hitam focus:ring-1 focus:ring-biru">
                        <option value="">- Pilih -</option>
                        <option value="Ringkas">Ringkas</option>
                        <option value="Rapi">Rapi</option>
                        <option value="Resik">Resik</option>
                        <option value="Rawat">Rawat</option>
                        <option value="Rajin">Rajin</option>
                        <option value="-">-</option>
                    </select>
                  </div>
              </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-grey/20">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-grey/10 text-hitam border border-grey/20 rounded hover:bg-grey/20 text-sm font-medium">Batal</button>
            <button type="submit" className="px-4 py-2 bg-biru text-putih rounded font-bold hover:opacity-90 flex items-center shadow-md text-sm">
                <CheckCircle className="w-4 h-4 mr-2" /> Simpan Perubahan
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* --- 4. CONFIRMATION MODAL --- */
const ConfirmationModal = ({ 
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-hitam/60 p-4 font-arial backdrop-blur-sm transition-all">
            <div className="bg-putih w-full max-w-md p-6 rounded-xl shadow-2xl transform transition-all scale-100 border-t-4 border-hijau animate-in fade-in zoom-in duration-200">
                <div className="flex flex-col items-center text-center">
                    <div className="w-14 h-14 bg-hijau/10 text-hijau rounded-full flex items-center justify-center mb-4">
                        <CheckCircle className="w-8 h-8" />
                    </div>
                    
                    <h3 className="text-xl font-bold text-hitam mb-2">Konfirmasi Approve</h3>
                    <p className="text-sm text-grey mb-6 leading-relaxed">
                        Apakah Anda yakin ingin menyetujui laporan ini? <br/>
                        Data akan diteruskan ke <strong>PIC CAPA</strong> untuk ditindaklanjuti.
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
                            className="flex-1 px-4 py-2.5 bg-hijau text-putih font-bold rounded-lg hover:bg-hijau/90 transition-colors shadow-lg shadow-hijau/20"
                        >
                            Ya, Setujui
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

/* ==========================================================================
   MAIN PAGE COMPONENT: ReviewQSDetailPage
   ========================================================================== */

export default function ReviewQSDetailPage() {
  const router = useRouter()
  const params = useParams() as any
  const reviewId = params?.reviewId || params?.id || ''
  
  const [isLoading, setIsLoading] = useState(true)
  const [detail, setDetail] = useState<AuditHeaderInfo | null>(null)
  const [checklistWithAnswers, setChecklistWithAnswers] = useState<ChecklistItemWithAnswer[]>([])
  const [reviewModalItemId, setReviewModalItemId] = useState<number | string | null>(null)
  
  const [isSaving, setIsSaving] = useState(false)
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)

const normalize = (v: string) =>
  (v || '').toLowerCase().trim()

const isQSSupervisor = useMemo(() => {
  if (!currentUser) return false

  const role = normalize(currentUser.role || currentUser.role_name || '')
  return role.includes('qs') && (role.includes('spv') || role.includes('supervisor'))
}, [currentUser])


  const isPatrolHSE = useMemo(() => {
    if (!detail?.nama_jenis_audit) return false;
    return detail.nama_jenis_audit.toLowerCase().includes("patrol hse");
  }, [detail?.nama_jenis_audit]);

  useEffect(() => {
    if (!reviewId) return
    const fetchDetail = async () => {
      setIsLoading(true)
      try {
        const res = await fetchWithAuth(`/api/audit/laporan-temuan/detailed/${encodeURIComponent(reviewId)}`, { cache: 'no-store' })
        if (!res.ok) throw new Error('Gagal load data')
        const json = await res.json()
        const payload = json.data || {}

        setDetail(payload.master)

        const rawItems = payload.temuan || []
        const mappedItems: ChecklistItemWithAnswer[] = rawItems.map((it: any) => {
             const groupingCategory = it.kategori || it.kategori_checklist || 'Lain-lain';
             let severity = it.kategori_temuan;
             if (!severity && it.item_id && typeof it.item_id === 'object') severity = it.item_id.kategori_temuan;

             let existingFiles: string[] = []
             try {
                if (it.bukti_temuan) {
                   if (Array.isArray(it.bukti_temuan)) existingFiles = it.bukti_temuan
                   else if (typeof it.bukti_temuan === 'string') {
                      const parsed = JSON.parse(it.bukti_temuan)
                      if (Array.isArray(parsed)) existingFiles = parsed
                      else existingFiles = [it.bukti_temuan]
                   }
                }
             } catch { existingFiles = typeof it.bukti_temuan === 'string' ? [it.bukti_temuan] : [] }

             return {
                 item_id: it.item_id,
                 item_checklist_text: it.item_checklist_text,
                 referensi_doc: it.referensi_doc,
                 kategori: groupingCategory,
                 sub_kategori: it.sub_kategori || 'Umum',
                 catatan_verifikasi: it.catatan_verifikasi || null, 
                 status_verifikasi: it.status_verifikasi || null, 
                 
                 answer: {
                     status: 'NOK',
                     deskripsi_temuan: it.deskripsi_temuan || '',
                     lokasi_temuan: it.lokasi_temuan || '',
                     kategori_temuan: it.kategori_temuan || severity || '', 
                     data_integrity: it.data_integrity || '',
                     prinsip_5r: it.prinsip_5r || '',
                     files: [],
                     existingFiles: existingFiles,
                     justification: it.justification || 'Temuan' 
                 }
             }
        })
        setChecklistWithAnswers(mappedItems)
      } catch (err) { console.error(err); toast.error('Gagal memuat detail') } finally { setIsLoading(false) }
    }
    fetchDetail()
  }, [reviewId])

  useEffect(() => {
  try {
    const user = localStorage.getItem('user_data')
    if (user) {
      setCurrentUser(JSON.parse(user))
    }
  } catch {}
}, [])

  const groupedItems = useMemo(() => {
    const groups = new Map<string, Map<string, ChecklistItemWithAnswer[]>>()
    checklistWithAnswers.forEach(item => {
      if (item.status_verifikasi === 'APPROVED') return;

      const kategori = item.kategori || 'Lain-lain'
      const sub = item.sub_kategori || 'Umum'
      if (!groups.has(kategori)) groups.set(kategori, new Map())
      const subMap = groups.get(kategori)!
      if (!subMap.has(sub)) subMap.set(sub, [])
      subMap.get(sub)!.push(item)
    })
    return groups
  }, [checklistWithAnswers])

  const handleReviewSave = async (itemId: number | string, data: Partial<ReviewForm>) => {
      const toastId = toast.loading('Menyimpan perubahan...')
      try {
          const item = checklistWithAnswers.find(it => String(it.item_id) === String(itemId))
          let idToSend = itemId;
          
          const formData = new FormData()

          const singleItemData = [{
            item_id: idToSend,
            status: 'NOK',
            deskripsi_temuan: data.deskripsi_temuan,
            lokasi_temuan: data.lokasi_temuan,
            kategori_temuan: data.kategori_temuan, 
            data_integrity: data.data_integrity,
            prinsip_5r: data.prinsip_5r,
            existing_files: item?.answer.existingFiles || [],
            justification: data.justification || item?.answer.justification
          }]

          formData.append('answers_data', JSON.stringify(singleItemData))

          const token = localStorage.getItem('token')
          const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || ''
          
          const res2 = await fetch(`${API_BASE}/api/audit/${reviewId}/update-item-qs`, { 
              method: 'POST', 
              headers: { 'Authorization': `Bearer ${token}` },
              body: formData 
          })

          if (!res2.ok) {
              const msg = await res2.text().catch(() => 'Unknown error')
              throw new Error(`Gagal update item: ${msg}`)
          }

          setChecklistWithAnswers(prev => prev.map(it => {
              if (String(it.item_id) === String(itemId)) {
                  return { 
                      ...it, 
                      answer: { ...it.answer, ...data } as ReviewForm,
                      status_verifikasi: null, 
                      catatan_verifikasi: null 
                  }
              }
              return it
          }))

          setReviewModalItemId(null)
          toast.success('Item berhasil diverifikasi', { id: toastId })

      } catch (e: any) {
          console.error(e)
          toast.error(`Error: ${e.message}`, { id: toastId })
      }
  }

  const handleApproveClick = () => {
      const incomplete = checklistWithAnswers.filter(item => {
          if (item.status_verifikasi === 'APPROVED') return false;

          const ans = item.answer;
          if (ans.justification === 'Observasi') return false;
          const basic = ans.deskripsi_temuan && ans.lokasi_temuan && ans.kategori_temuan;
          if (!isPatrolHSE) {
              return !(basic && ans.data_integrity && ans.prinsip_5r);
          }
          return !basic; 
      })

      if (incomplete.length > 0) {
          toast.error(`Ada ${incomplete.length} temuan (belum approved) yang belum lengkap.`)
          return
      }
      setIsConfirmModalOpen(true)
  }


  const executeApprove = async () => {
    if (!isQSSupervisor) return
      setIsSaving(true)
      const toastId = toast.loading('Memproses persetujuan...')
      try {
          const res = await fetchWithAuth(`/api/audit/review-qs-approve-full/${reviewId}`, { method: 'POST' })
          if (!res.ok) { const msg = await res.text(); throw new Error(msg) }
          toast.success('Laporan disetujui!', { id: toastId })
          setIsConfirmModalOpen(false) 
          router.push('/laporan-temuan/review-qs')
          router.refresh()
      } catch (e: any) {
          toast.error(`Gagal approve: ${e.message}`, { id: toastId })
          setIsConfirmModalOpen(false) 
      } finally { setIsSaving(false) }
  }

  const pendingCount = useMemo(() => {
      return checklistWithAnswers.filter(item => item.status_verifikasi !== 'APPROVED').length;
  }, [checklistWithAnswers]);

  const allClosed = useMemo(() => {
        const pendingItems = checklistWithAnswers.filter(item => item.status_verifikasi !== 'APPROVED');
        if (pendingItems.length === 0) return true;

        return pendingItems.every(item => {
             const ans = item.answer;
             if (ans.justification === 'Observasi') return true;
             
             const basic = !!(ans.deskripsi_temuan && ans.lokasi_temuan && ans.kategori_temuan);
             
             if (!isPatrolHSE) {
                 return basic && !!(ans.data_integrity && ans.prinsip_5r);
             }
             return basic;
        });
  }, [checklistWithAnswers, isPatrolHSE]);

  if (isLoading) return <div className="p-12 text-center text-grey">Memuat data review...</div>
  if (!reviewId) return <div className="p-12 text-center text-red-500">ID Laporan tidak valid</div>

  // [FIX] Strict Check: Hanya Tampilkan Note Reject jika Status Laporan adalah QS_REJECTED_MGR
  const isReturnedFromManager = detail?.status_laporan === 'QS_REJECTED_MGR';
  const hasRejectNote = detail?.note_reject && detail.note_reject !== '' && detail.note_reject !== '-';
  const showRejectBanner = isReturnedFromManager && hasRejectNote;

  return (
    <>
      <Toaster position="top-center" />
      <Link href="/laporan-temuan/review-qs" className="flex items-center text-sm text-biru hover:underline mb-4 font-arial">
        <ArrowLeft className="w-4 h-4 mr-1" /> Kembali ke Antrian Review
      </Link>

      {!isQSSupervisor && (
        <div className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-700">
            Mode <b>Read Only</b>. Hanya QS Supervisor yang dapat melakukan review & approve.
        </div>
        )}

      {detail && <AuditHeader info={detail} nokCount={pendingCount} />}

      {/* [FIX] Tampilkan hanya jika dikembalikan oleh Manager Area & Ada Spacing mt-8 */}
      {showRejectBanner && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 mt-8 rounded shadow-sm">
              <div className="flex">
                  <AlertCircle className="h-6 w-6 text-red-500 mr-4 flex-shrink-0" />
                  <div>
                      <p className="font-bold text-red-700">Dikembalikan oleh Manager Area</p>
                      <p className="text-sm text-red-600 mt-1">Catatan: "{detail?.note_reject}"</p>
                  </div>
              </div>
          </div>
      )}

      <div className="bg-putih p-6 rounded-lg shadow-md font-arial mb-24">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-hitam">Review QS Supervisor</h3>
            {checklistWithAnswers.length > pendingCount && (
                <span className="text-xs text-green-600 font-medium px-2 py-1 bg-green-50 rounded border border-green-200">
                    <CheckCircle className="w-3 h-3 inline mr-1"/>
                    {checklistWithAnswers.length - pendingCount} Item sudah Approved (Hidden)
                </span>
            )}
        </div>

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
                
                {!isPatrolHSE && (
                    <>
                        <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase tracking-wider">Data Int.</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase tracking-wider">5R</th>
                    </>
                )}

                <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase tracking-wider">Kategori</th>
                <th className="px-6 py-3 text-center text-xs font-bold text-grey uppercase tracking-wider min-w-[100px]">Justifikasi</th>
                <th className="px-6 py-3 text-center text-xs font-bold text-grey uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-putih divide-y divide-grey/40">
              {pendingCount === 0 && checklistWithAnswers.length > 0 && (
                  <tr>
                      <td colSpan={isPatrolHSE ? 9 : 11} className="py-12 text-center text-gray-500 italic">
                          <CheckCircle className="w-8 h-8 mx-auto text-green-500 mb-2"/>
                          Semua item sudah Approved. Silakan klik tombol "Approve" di bawah.
                      </td>
                  </tr>
              )}
              {Array.from(groupedItems.entries()).map(([kategori, subGroups]) => (
                <React.Fragment key={kategori}>
                  <tr className="bg-biru/5"><td colSpan={isPatrolHSE ? 10 : 12} className="px-4 py-3 text-sm font-bold text-biru uppercase tracking-wide">{kategori}</td></tr>
                  {Array.from(subGroups.entries()).map(([sub, items]) => (
                    <React.Fragment key={sub}>
                      {items.map((item, idx) => {
                        const justificationVal = item.answer.justification || 'Temuan';
                        const isTemuan = justificationVal === 'Temuan';

                        return (
                          <tr key={item.item_id} className="hover:bg-grey/5 transition-colors">
                            <td className="px-4 py-4 text-sm text-hitam text-center font-medium align-top">{idx + 1}</td>
                            <td className="px-6 py-4 text-sm text-hitam leading-relaxed align-top">{item.item_checklist_text}</td>
                            <td className="px-6 py-4 text-sm text-hitam/70 align-top">{item.referensi_doc || '-'}</td>
                            <td className="px-6 py-4 text-sm text-hitam align-top">{item.answer.deskripsi_temuan || '-'}</td>
                            <td className="px-6 py-4 text-sm text-hitam align-top">
                                <div className="flex flex-wrap gap-2">{item.answer.existingFiles.length > 0 ? item.answer.existingFiles.map((f: string, i: number) => <FileDisplay key={i} filePath={f} />) : '-'}</div>
                            </td>
                            <td className="px-6 py-4 text-sm text-hitam align-top">{item.answer.lokasi_temuan || '-'}</td>
                            {!isPatrolHSE && (<><td className="px-6 py-4 text-sm text-hitam align-top">{item.answer.data_integrity || '-'}</td><td className="px-6 py-4 text-sm text-hitam align-top">{item.answer.prinsip_5r || '-'}</td></>)}
                            <td className="px-6 py-4 text-sm text-hitam align-top"><span className={`px-2 py-1 rounded text-xs font-bold ${item.answer.kategori_temuan === 'Critical' ? 'text-hitam' : item.answer.kategori_temuan === 'Major' ? 'text-hitam' : 'bg-yellow-100 text-yellow-700'}`}>{item.answer.kategori_temuan}</span></td>
                            
                            <td className="px-6 py-4 text-center align-top">
                                <span className={`px-3 py-1 rounded text-xs font-bold border inline-block w-full text-center
                                    ${isTemuan ? 'bg-biru/10 text-biru border-biru/20' : 'bg-hijau/10 text-hijau border-hijau/20'}`}>
                                    {justificationVal}
                                </span>
                            </td>

                            <td className="px-6 py-4 text-center align-top"><button disabled={!isQSSupervisor} onClick={() => isQSSupervisor && setReviewModalItemId(item.item_id)} className={`flex items-center justify-center p-2 rounded-lg transition-all mx-auto mt-1 ${isQSSupervisor ? 'bg-grey/20 text-grey hover:text-biru hover:bg-grey/40': 'bg-grey/10 text-grey/40 cursor-not-allowed'}`} title="Edit temuan "><Edit className="w-4 h-4" /></button></td>
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
          <div className="w-full flex justify-end items-center px-6">
              <button disabled={isSaving || !allClosed || !isQSSupervisor} onClick={handleApproveClick} className={`flex items-center px-8 py-3 font-bold text-putih rounded shadow-lg transition-all transform hover:-translate-y-0.5 ${allClosed && isQSSupervisor ? 'bg-biru hover:bg-biru/90': 'bg-grey/40 cursor-not-allowed opacity-70'}`}><CheckCircle className="w-5 h-5 mr-2" /> {detail?.note_reject ? "Submit Ulang" : "Approve"}</button>
          </div>
      </div>

      {reviewModalItemId && (<ReviewModal item={checklistWithAnswers.find(it => String(it.item_id) === String(reviewModalItemId))!} onClose={() => setReviewModalItemId(null)} onSave={handleReviewSave} isPatrolHSE={isPatrolHSE} />)}
      <ConfirmationModal isOpen={isConfirmModalOpen} onClose={() => setIsConfirmModalOpen(false)} onConfirm={executeApprove} />
    </>
  )
}