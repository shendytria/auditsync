'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { Toaster, toast } from 'react-hot-toast'
import { 
    ArrowLeft, 
    Check, Clock,
    Download, Loader2, FileSpreadsheet, FileText, Paperclip,
    // [FIX] Menambahkan icon yang sebelumnya missing
    ChevronDown, ChevronUp, Calendar, User, UserCheck, Briefcase, ShieldCheck
} from 'lucide-react'
import Link from 'next/link'

// --- IMPORT UNTUK PDF CLIENT SIDE ---
import { pdf } from '@react-pdf/renderer'
import { AuditPdfDocument } from '@/components/AuditPdfDocument' 

// --- IMPORT UNTUK EXCEL CLIENT SIDE ---
import * as XLSX from 'xlsx'

// [UPDATE] Import fetchWithAuth & Types
import { fetchWithAuth } from '@/utils/api'
import { getStatusColor, getStatusLabel } from '@/utils/statusHelper'
import { AuditHeaderInfo, AuditCheckItem } from '@/types/audit'

// 1. Interface Header Report
interface ReportDetail extends AuditHeaderInfo {
    tgl_approve_qs_spv?: string
    tgl_approve_mgr_area?: string
    tgl_approve_mgr_qs?: string
    tgl_submit_capa?: string 
}

// 2. [FIX] Interface Item Report
// Kita menggunakan Omit untuk "membuang" definisi bukti_temuan asli (string)
// dan menggantinya dengan string[] (Array) agar tidak error saat assignment.
interface ReportItem extends Omit<AuditCheckItem, 'bukti_temuan'> {
    // Override bukti_temuan menjadi array string
    bukti_temuan: string[] | null

    // Field Tambahan Spesifik Report
    pic_name?: string | null
    tgl_submit_bukti?: string | null
    tgl_verifikasi?: string | null
    catatan_perbaikan?: string | null
    catatan_verifikasi?: string | null
    hasil_verifikasi?: string | null // status_verifikasi
    
    // Field yang sebelumnya menyebabkan Error (Missing Properties)
    kategori_temuan?: string | null
    justification?: string | null
    bukti_perbaikan?: string[] | null
    bukti_temuan_verifikasi?: string[] | null // Alias untuk bukti_verifikasi
    
    data_integrity?: string | null
    prinsip_5r?: string | null
    
    // Object CAPA
    capa?: {
        root_cause: string
        corrective_action: string
        due_date: string
    }
}

/* --- COMPONENTS (Helpers) --- */
const AuditHeader = ({ info, totalItems }: { info: Partial<ReportDetail>; totalItems: number }) => {
    const parse = (v: any) => (v == null || v === '' || v === '-' ? '-' : String(v))
    const formatDateLong = (raw?: any) => {
        if (!raw || raw === '-' || raw === '0001-01-01T00:00:00Z') return '-'
        const d = new Date(raw)
        return isNaN(d.getTime()) || d.getFullYear() <= 1 ? '-' : new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }).format(d)
    }
    return (
      <div className="bg-putih p-6 rounded-lg shadow-md mb-6 font-arial border border-grey/20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
          <div><p className="text-sm font-medium text-grey">NO FTA</p><p className="text-lg font-bold text-hitam">{parse(info.no_fta)}</p></div>
          <div><p className="text-sm font-medium text-grey">Jenis Audit</p><p className="text-lg font-bold text-hitam">{parse(info.nama_jenis_audit)}</p></div>
          <div><p className="text-sm font-medium text-grey">Auditor</p><p className="text-lg font-bold text-hitam">{parse(info.nama_auditor)}</p></div>
          <div><p className="text-sm font-medium text-grey">Site / Area</p><p className="text-lg font-bold text-hitam">{parse(info.nama_site)} - {parse(info.nama_area)}</p></div>
          <div><p className="text-sm font-medium text-grey">Tgl Pelaksanaan</p><p className="text-lg font-bold text-hitam">{formatDateLong(info.tanggal_audit)}</p></div>
          
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
        <a href={fullUrl} target="_blank" rel="noopener noreferrer" className="flex items-center p-1.5 bg-putih rounded border border-grey/30 hover:bg-biru/5 hover:border-biru hover:text-biru transition-colors text-xs text-grey max-w-fit mb-1 group" title={fileName}>
            <Paperclip className="h-3 w-3 mr-1.5 group-hover:text-current" /> 
            <span className="truncate max-w-[150px]">{fileName}</span>
            {label && <span className={`ml-1 text-[9px] px-1 rounded border ${label === 'Verif' ? 'bg-grey/10 text-grey border-grey/20' : 'bg-hijau/10 text-hijau border-hijau/30'}`}>{label}</span>}
        </a>
    )
}

const ApproverInfo = ({ title, name, date, icon: Icon, isApproved }: any) => {
    const formatDateShort = (raw?: string) => {
        if (!raw || raw === '-' || raw.startsWith('0001')) return '-'
        return new Date(raw).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: '2-digit' })
    }

    const activeState = isApproved 
        ? 'bg-hijau/10 border-hijau/30' 
        : 'bg-white border-grey/20 opacity-70'

    const badgeColor = isApproved ? 'bg-hijau text-white' : 'bg-gray-200 text-gray-400'

    return (
        <div className={`relative flex flex-col items-center justify-between p-3 rounded-lg border min-w-[140px] md:min-w-[160px] min-h-[110px] transition-all ${activeState}`}>
            <div className={`absolute -top-2 -right-2 rounded-full p-1 border-2 border-white shadow-sm z-10 ${badgeColor}`}>
                {isApproved ? <Check className="w-3 h-3" strokeWidth={4} /> : <Clock className="w-3 h-3" />}
            </div>

            <div className="flex flex-col items-center w-full flex-grow justify-center">
                <Icon className={`w-5 h-5 mb-1 ${isApproved ? 'text-hijau' : 'text-grey'}`} />
                <span className="text-[10px] uppercase font-bold text-grey tracking-wider text-center mb-1">{title}</span>
                <span className={`text-xs font-bold text-center leading-tight w-full whitespace-normal px-1 ${isApproved ? 'text-hijau' : 'text-hitam'}`}>
                    {name || '-'}
                </span>
            </div>

            <div className="mt-2 pt-2 border-t border-black/5 w-full text-center">
                <span className="text-[10px] text-grey font-medium">
                    {isApproved ? formatDateShort(date) : "-"}
                </span>
            </div>
        </div>
    )
}

/* ==========================================================================
   MAIN PAGE
   ========================================================================== */
export default function AuditReportDetailPage() {
    const params = useParams() as any
    const reportId = params?.reportId || params?.id || ''
    
    const [isLoading, setIsLoading] = useState(true)
    const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)
    const [isDownloadingExcel, setIsDownloadingExcel] = useState(false) 
    const [showExportDropdown, setShowExportDropdown] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowExportDropdown(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])
    const [detail, setDetail] = useState<ReportDetail | null>(null)
    const [items, setItems] = useState<ReportItem[]>([])
    
    const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})

    const isPatrolHSE = useMemo(() => {
        if (!detail?.nama_jenis_audit) return false;
        return detail.nama_jenis_audit.toLowerCase().includes("patrol hse");
    }, [detail?.nama_jenis_audit]);

    /* --- DATA FETCHING --- */
    const fetchData = useCallback(async () => {
        if (!reportId) return;
        try {
            const res = await fetchWithAuth(`/api/audit/laporan-temuan/detailed/${reportId}`, { cache: 'no-store' })
            if (!res.ok) throw new Error("Gagal load data")
            
            const json = await res.json()
            const m = json.data.master
            const t = json.data.temuan || []
            
            // Map Master Data
            setDetail({
                pelaksanaan_id: m.pelaksanaan_id,
                no_fta: m.no_fta,
                tanggal_audit: m.tanggal_audit,
                nama_checklist: m.nama_checklist,
                nama_jenis_audit: m.nama_jenis_audit, 
                nama_site: m.nama_site,
                nama_area: m.nama_area,
                nama_auditor: m.nama_auditor,
                status_laporan: m.status_laporan,
                nama_qs_spv: m.nama_qs_spv,
                nama_mgr_area: m.nama_mgr_area,
                nama_mgr_qs: m.nama_mgr_qs,
                nama_pic_capa: m.approver_pic_capa_names,
                tgl_approve_qs_spv: m.tgl_approve_qs_spv,
                tgl_approve_mgr_area: m.tgl_approve_mgr_area,
                tgl_approve_mgr_qs: m.tgl_approve_mgr_qs,
                tgl_submit_capa: m.tgl_submit_capa,
                checklist_id: m.checklist_id,
                nama_department: m.nama_department 
            })

            // Map Temuan Items (Flattening data untuk report)
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

                // Construct object dengan tipe ReportItem yang sudah diperbaiki
                const itemData: ReportItem = {
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
                    
                    bukti_temuan: existingFiles, // Sekarang valid karena interface sudah di-override
                    
                    status: 'NOK',

                    // Field Tambahan untuk Report
                    bukti_perbaikan: evidenceFiles, 
                    catatan_perbaikan: it.catatan_perbaikan || null,
                    
                    bukti_temuan_verifikasi: verificationFiles,
                    catatan_verifikasi: it.catatan_verifikasi || null,
                    hasil_verifikasi: it.hasil_verifikasi || it.status_verifikasi, 

                    pic_name: it.pic_name || it.PicName || null,
                    tgl_submit_bukti: it.tgl_submit_bukti || null, 
                    tgl_verifikasi: it.tgl_verifikasi || null, 
                    justification: it.justification || it.justifikasi || '-',

                    capa: {
                        root_cause: it.root_cause || '-',
                        corrective_action: it.corrective_action || '-',
                        due_date: it.due_date ? it.due_date.split('T')[0] : ''
                    }
                };

                return itemData;
            })
            setItems(mappedItems)

        } catch (e) { console.error(e); toast.error("Gagal mengambil detail laporan") } 
        finally { setIsLoading(false) }
    }, [reportId])

    useEffect(() => {
        fetchData()
    }, [fetchData]);

    const visibleItems = items; 
    const groupedItems = useMemo(() => {
        const groups = new Map<string, Map<string, ReportItem[]>>()
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

    /* --- CLIENT SIDE PDF DOWNLOAD HANDLER --- */
    const handleDownloadPdf = async () => {
        if (!detail) return;
        setIsDownloadingPdf(true);
        const toastId = toast.loading('Sedang membuat PDF...');

        try {
            const pdfDetail = {
                ...detail,
                area: `${detail.nama_site ?? '-'} - ${detail.nama_area ?? '-'}`,
                auditor: detail.nama_auditor,
                nama_qs_staff: detail.nama_qs_spv ?? '-',
                tgl_submit_verifikasi: detail.tgl_approve_qs_spv,
            };

            const pdfItems = visibleItems.map(it => ({
                ...it,
                nama_pic_capa: it.pic_name || '-',
                status: it.hasil_verifikasi || 'Open',
                capa: {
                    ...it.capa,
                    laporan_bukti_text: it.catatan_perbaikan
                        || (it.bukti_perbaikan?.length ? `${it.bukti_perbaikan.length} file` : '-'),
                    bukti_verifikasi_text: it.catatan_verifikasi
                        || (it.bukti_temuan_verifikasi?.length ? `${it.bukti_temuan_verifikasi.length} file` : '-'),
                    tgl_submit_bukti: it.tgl_submit_bukti,
                    tgl_verifikasi: it.tgl_verifikasi,
                },
            }));

            const blob = await pdf(
                // @ts-ignore
                <AuditPdfDocument detail={pdfDetail} items={pdfItems} />
            ).toBlob();

            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Laporan_Audit_${detail.no_fta || 'Final'}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);

            toast.success('PDF Berhasil dibuat!', { id: toastId });
        } catch (error) {
            console.error('PDF Generation Error:', error);
            toast.error('Gagal membuat PDF', { id: toastId });
        } finally {
            setIsDownloadingPdf(false);
        }
    };

    /* --- CLIENT SIDE EXCEL DOWNLOAD HANDLER --- */
    const handleDownloadExcel = async () => {
        if (!detail) return;
        setIsDownloadingExcel(true);
        const toastId = toast.loading('Sedang menyiapkan Excel...');

        try {
            const excelData = visibleItems.map((item, index) => {
                const joinFiles = (files: any) => Array.isArray(files) ? files.join(', ') : (files || '-');

                const row: any = {
                    'No': index + 1,
                    'Kategori': item.kategori || '-',
                    'Sub Kategori': item.sub_kategori || '-',
                    'Check Item': item.item_checklist_text || '-',
                    'Referensi Dokumen': item.referensi_doc || '-',
                    'Deskripsi Temuan': item.deskripsi_temuan || '-',
                    'Lokasi': item.lokasi_temuan || '-',
                    'Kategori Temuan': item.kategori_temuan || '-',
                    'PIC': item.pic_name || '-',
                    'Justifikasi': item.justification || '-', 
                    'Status Verifikasi': item.hasil_verifikasi || '-',
                    'Root Cause': item.capa?.root_cause || '-',
                    'Corrective Action': item.capa?.corrective_action || '-',
                    'Due Date': item.capa?.due_date || '-',
                    'Bukti Temuan (File)': joinFiles(item.bukti_temuan),
                    'Bukti Perbaikan (File)': joinFiles(item.bukti_perbaikan),
                    'Bukti Verifikasi (File)': joinFiles(item.bukti_temuan_verifikasi) 
                };

                if (!isPatrolHSE) {
                    row['Data Integrity'] = item.data_integrity || '-';
                    row['Prinsip 5R'] = item.prinsip_5r || '-';
                }

                return row;
            });

            const worksheet = XLSX.utils.json_to_sheet(excelData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Audit");
            XLSX.writeFile(workbook, `Laporan_Audit_${detail.no_fta || 'Final'}.xlsx`);

            toast.success('Excel Berhasil diunduh!', { id: toastId });
        } catch (error) {
            console.error('Excel Generation Error:', error);
            toast.error('Gagal membuat Excel', { id: toastId });
        } finally {
            setIsDownloadingExcel(false);
        }
    };

    if (isLoading) return <div className="p-12 text-center text-grey">Memuat data...</div>
    if (!detail) return <div className="p-12 text-center text-red-500">Data tidak ditemukan.</div>

    return (
        <div className="font-arial pb-64">
            <Toaster position="top-center"/>
            <div className="px-2 mt-4">
                 <Link href="/report" className="flex items-center text-sm text-biru hover:underline mb-4 font-medium">
                    <ArrowLeft className="w-4 h-4 mr-1" /> Kembali ke Daftar
                </Link>
            </div>

            {detail && <AuditHeader info={detail} totalItems={items.length} />}

            <div className="bg-putih p-6 rounded-lg shadow-md mb-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <div className="flex items-center gap-3">
                        <h3 className="text-xl font-bold text-hitam">Detail Temuan Audit</h3>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border bg-grey/10 text-grey border-grey/20">
                            Total Item: {visibleItems.length}
                        </span>
                    </div>

                    <div className="relative" ref={dropdownRef}>
                        <button 
                            onClick={() => setShowExportDropdown(!showExportDropdown)}
                            disabled={isDownloadingPdf || isDownloadingExcel}
                            className="flex items-center gap-2 px-4 py-2 bg-biru text-white rounded-lg text-sm font-bold shadow hover:bg-biru/90 transition-all disabled:opacity-50"
                        >
                            {isDownloadingPdf || isDownloadingExcel ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            Export Report
                            <ChevronDown className={`w-4 h-4 transition-transform ${showExportDropdown ? 'rotate-180' : ''}`} />
                        </button>

                        {showExportDropdown && (
                            <div className="absolute right-0 mt-2 w-48 bg-white border border-grey/20 rounded-md shadow-xl z-50 py-1 overflow-hidden">
                                <button onClick={handleDownloadPdf} className="w-full px-4 py-3 text-left text-sm text-hitam hover:bg-biru/5 flex items-center gap-3 border-b border-grey/10">
                                    <FileText className="w-4 h-4 text-red-500" />
                                    <span>Download PDF</span>
                                </button>
                                <button onClick={handleDownloadExcel} className="w-full px-4 py-3 text-left text-sm text-hitam hover:bg-biru/5 flex items-center gap-3">
                                    <FileSpreadsheet className="w-4 h-4 text-green-600" />
                                    <span>Download Excel</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    {visibleItems.length === 0 ? (
                        <div className="p-8 text-center text-grey italic border border-dashed rounded-lg">
                            Tidak ada item.
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
                                <th className="px-6 py-3 text-center text-xs font-bold text-grey uppercase min-w-[100px]">Justifikasi</th>
                                <th className="px-6 py-3 text-center text-xs font-bold text-grey uppercase w-10">Detail</th>
                            </tr>
                        </thead>
                        <tbody className="bg-putih divide-y divide-grey/40">
                            {Array.from(groupedItems.entries()).map(([kategori, subGroups]) => (
                                <React.Fragment key={kategori}>
                                    <tr className="bg-biru/5">
                                        <td colSpan={isPatrolHSE ? 10 : 12} className="px-4 py-3 text-sm font-bold text-biru uppercase tracking-wide">{kategori}</td>
                                    </tr>
                                    {Array.from(subGroups.entries()).map(([sub, items]) => (
                                        <React.Fragment key={sub}>
                                            {items.map((item, idx) => {
                                                const rowId = String(item.item_id)
                                                const isExpanded = expandedRows[rowId]
                                                const filesTemuan = Array.isArray(item.bukti_temuan) ? item.bukti_temuan : []
                                                const filesPerbaikan = Array.isArray(item.bukti_perbaikan) ? item.bukti_perbaikan : []
                                                
                                                // Warna Justifikasi
                                                const justificationText = item.justification || '-';
                                                let justifikasiClass = "text-grey/80 italic"; 
                                                if (justificationText === 'Temuan') justifikasiClass = "text-biru font-bold not-italic";
                                                else if (justificationText === 'Observasi') justifikasiClass = "text-hijau font-bold not-italic";

                                                return (
                                                    <React.Fragment key={rowId}>
                                                        <tr className="hover:bg-grey/5 transition-colors">
                                                            <td className="px-4 py-4 text-sm text-hitam text-center font-medium align-top">{idx + 1}</td>
                                                            <td className="px-6 py-4 text-sm text-hitam leading-relaxed align-top font-semibold">
                                                                {item.item_checklist_text}
                                                            </td>
                                                            <td className="px-6 py-4 text-sm text-hitam align-top">
                                                                {item.referensi_doc || '-'}
                                                            </td>
                                                            
                                                            <td className="px-6 py-4 text-sm text-hitam align-top">
                                                                <p className="mb-2">{item.deskripsi_temuan || '-'}</p>
                                                            </td>

                                                            <td className="px-6 py-4 text-sm text-hitam align-top">
                                                                <div className="flex flex-col gap-1">
                                                                        {filesTemuan.length > 0 ? filesTemuan.map((f, i) => <FileDisplay key={i} filePath={f} />) : '-'}
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 text-sm text-hitam align-top">{item.lokasi_temuan || '-'}</td>
                                                            
                                                            <td className="px-6 py-4 text-sm text-biru font-semibold align-top">{item.pic_name || '-'}</td>
                                                            
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
                                                            
                                                            <td className="px-6 py-4 text-sm align-top text-center">
                                                                <span className={justifikasiClass}>{justificationText}</span>
                                                            </td>

                                                            <td className="px-6 py-4 text-center align-top">
                                                                <button onClick={() => toggleRow(rowId)} className="p-2 bg-grey/10 rounded hover:bg-grey/20">{isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</button>
                                                            </td>
                                                        </tr>
                                                        {isExpanded && (
                                                            <tr className="bg-grey/5">
                                                                <td colSpan={2}></td>
                                                                <td colSpan={isPatrolHSE ? 8 : 10} className="px-0 py-4">
                                                                        <div className="border border-grey/30 rounded-lg overflow-hidden mx-4 bg-putih shadow-sm">
                                                                            <table className="w-full text-sm">
                                                                                <thead className="bg-grey/10 border-b border-grey/20">
                                                                                    <tr>
                                                                                        <th className="px-4 py-2 text-left font-bold text-grey uppercase text-xs w-1/3 border-r border-grey/20">Informasi CAPA</th>
                                                                                        <th className="px-4 py-2 text-left font-bold text-grey uppercase text-xs w-1/3 border-r border-grey/20">Bukti Perbaikan</th>
                                                                                        <th className="px-4 py-2 text-left font-bold text-grey uppercase text-xs w-1/3 bg-grey/10">Bukti Verifikasi</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody className="divide-x divide-grey/20">
                                                                                    <tr>
                                                                                        <td className="px-4 py-3 align-top space-y-3">
                                                                                            <div><span className="text-[10px] uppercase font-bold text-grey block mb-0.5">Root Cause</span><p className="text-hitam text-sm">{item.capa?.root_cause || '-'}</p></div>
                                                                                            <div><span className="text-[10px] uppercase font-bold text-grey block mb-0.5">Corrective Action</span><p className="text-hitam text-sm">{item.capa?.corrective_action || '-'}</p></div>
                                                                                            <div><span className="text-[10px] uppercase font-bold text-grey block mb-0.5">Due Date</span><p className="text-biru font-bold text-sm flex items-center"><Calendar className="w-3 h-3 mr-1"/> {item.capa?.due_date || '-'}</p></div>
                                                                                        </td>
                                                                                        <td className="px-4 py-3 align-top space-y-3">
                                                                                            <div><span className="text-[10px] uppercase font-bold text-grey block mb-1">Lampiran File</span>
                                                                                                    <div className="flex flex-col gap-1">{item.bukti_perbaikan && item.bukti_perbaikan.length > 0 ? item.bukti_perbaikan.map((f: string, i: number) => <FileDisplay key={i} filePath={f} label="Fixed" />) : <span className="text-grey text-xs italic">- Tidak ada file -</span>}</div>
                                                                                            </div>
                                                                                            <div><span className="text-[10px] uppercase font-bold text-grey block mb-1">Catatan PIC</span><div className="bg-putih p-2 rounded border border-grey/20 text-xs text-hitam min-h-[30px]">{item.catatan_perbaikan || '-'}</div></div>
                                                                                        </td>
                                                                                        <td className="px-4 py-3 align-top space-y-3 bg-grey/5">
                                                                                            <div><span className="text-[10px] uppercase font-bold text-grey block mb-1">Lampiran File</span>
                                                                                                    {/* Mapping untuk bukti verifikasi (jika ada) */}
                                                                                                    <div className="flex flex-col gap-1">{item.bukti_temuan_verifikasi && item.bukti_temuan_verifikasi.length > 0 ? item.bukti_temuan_verifikasi.map((f: string, i: number) => <FileDisplay key={i} filePath={f} label="Verif" />) : <span className="text-grey text-xs italic">- Belum ada bukti verifikasi -</span>}</div>
                                                                                            </div>
                                                                                            <div><span className="text-[10px] uppercase font-bold text-grey block mb-1">Catatan Verifikator</span><div className="bg-putih p-2 rounded border border-grey/20 text-xs text-hitam min-h-[30px]">{item.catatan_verifikasi || '-'}</div></div>
                                                                                        </td>
                                                                                    </tr>
                                                                                </tbody>
                                                                            </table>
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

            {/* --- FOOTER: FINAL APPROVAL STATUS --- */}
            <div className="fixed bottom-0 right-0 left-0 md:left-64 bg-white border-t-4 border-biru p-4 shadow-lg z-30 animate-in slide-in-from-bottom-5">
                <div className="max-w-full px-6 flex justify-center items-center">
                    <div className="flex items-center gap-4 overflow-x-auto pb-2 lg:pb-0 scrollbar-hide">
                        <ApproverInfo title="Auditor" name={detail.nama_auditor} icon={User} isApproved={true} date={detail.tanggal_audit} />
                        <div className="h-0.5 w-4 bg-grey/30 shrink-0"></div>
                        
                        <ApproverInfo title="Spv Area (PIC)" name={detail.nama_pic_capa} icon={User} isApproved={true} date={detail.tgl_submit_capa || detail.tanggal_audit} /> 
                        <div className="h-0.5 w-4 bg-grey/30 shrink-0"></div>
                        
                        <ApproverInfo title="QS Supervisor" name={detail.nama_qs_spv} icon={UserCheck} isApproved={!!detail.tgl_approve_qs_spv && detail.tgl_approve_qs_spv !== ''} date={detail.tgl_approve_qs_spv} />
                        <div className="h-0.5 w-4 bg-grey/30 shrink-0"></div>
                        
                        <ApproverInfo title="Manager Area" name={detail.nama_mgr_area} icon={Briefcase} isApproved={!!detail.tgl_approve_mgr_area && detail.tgl_approve_mgr_area !== ''} date={detail.tgl_approve_mgr_area} />
                        <div className="h-0.5 w-4 bg-grey/30 shrink-0"></div>
                        
                        <ApproverInfo title="QS Manager" name={detail.nama_mgr_qs} icon={ShieldCheck} isApproved={!!detail.tgl_approve_mgr_qs && detail.tgl_approve_mgr_qs !== ''} date={detail.tgl_approve_mgr_qs} />
                    </div>
                </div>
            </div>

        </div>
    )
}