'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Toaster, toast } from 'react-hot-toast'
import { Search, Download, FileText, Table as TableIcon, ChevronDown, Loader2 } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { fetchWithAuth } from '@/utils/api' 

/* --- INTERFACES --- */
interface JenisAuditRef {
    jenis_audit_id: number
    nama_jenis_audit: string
}

interface ReportItem {
    id: number
    no_fta: string
    tanggal_audit: string
    tanggal_selesai: string
    site: string
    area: string
    jenis_audit: string
    auditor: string
    total_temuan: number
    status_laporan: string
}

/* --- HELPER STATUS LABEL (MAPPING BERDASARKAN MODUL) --- */
const getStatusDisplay = (status: string) => {
    const s = (status || '').toUpperCase().trim();
    
    switch (s) {
        // 1. Modul Pelaksanaan Audit
        case 'EXEC_OPEN':
        case 'EXEC_PROGRESS':
            return { label: 'Pelaksanaan Audit', color: 'bg-gray-100 text-gray-800 border-gray-200' };

        // 2. Modul Laporan Auditor
        case 'RPT_OPEN':
        case 'RPT_PROGRESS':
        case 'RPT_REJECTED_PIC':
            return { label: 'Laporan Auditor', color: 'bg-blue-50 text-blue-700 border-blue-200' };

        // 3. Modul Review QS Supervisor
        case 'QS_REVIEW':
        case 'QS_REJECTED_MGR':
            return { label: 'Review QS Spv', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' };

        // 4. Modul Tindak Lanjut PIC Area
        case 'CAPA_OPEN':
        case 'CAPA_IN_PROGRESS':
        case 'CAPA_REJECTED_QSSPV':
        case 'CAPA_REJECTED_MGR':
            return { label: 'Tindak Lanjut PIC Area', color: 'bg-orange-100 text-orange-800 border-orange-200' };

        // 5. Modul Laporan Bukti Perbaikan
        case 'READY_FOR_CAPA':
        case 'EVIDENCE_IN_PROGRESS':
        case 'EVIDENCE_REJECTED_AUDITOR':
        case 'EVIDENCE_REJECTED_QSSPV':
            return { label: 'Laporan Bukti Perbaikan', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' };

        // 6. Modul Verifikasi Bukti Perbaikan
        case 'EVIDENCE_VERIF':
        case 'EVIDENCE_VERIF_PROGRESS':
            return { label: 'Verifikasi Bukti (Auditor)', color: 'bg-purple-100 text-purple-800 border-purple-200' };

        // 7. Modul Final Verifikasi
        case 'FINAL_CLOSING':
            return { label: 'Final Verifikasi (QS SPV)', color: 'bg-cyan-100 text-cyan-800 border-cyan-200' };

        // 8. Modul Final Approve (Approval Berjenjang)
        case 'WAITING_QS_SPV':
            return { label: 'Approve QS Supervisor', color: 'bg-teal-100 text-teal-800 border-teal-200' };
        case 'WAITING_MGR_AREA':
            return { label: 'Approve Manager Area', color: 'bg-teal-100 text-teal-800 border-teal-200' };
        case 'WAITING_MGR_QS':
            return { label: 'Approve Manager QS', color: 'bg-teal-100 text-teal-800 border-teal-200' };

        // 9. Selesai / Report
        case 'CLOSED':
            return { label: 'CLOSED', color: 'bg-green-100 text-green-800 border-green-200' };

        default:
            return { label: s || '-', color: 'bg-gray-100 text-gray-800 border-gray-200' };
    }
}

/* --- COMPONENT: FILTER --- */
const ReportFilters = ({
    allSites,
    allAreas,
    allJenisAuditRef,
    onFilterChange,
    onResetFilters
}: {
    allSites: string[],
    allAreas: { site: string, area: string }[],
    allJenisAuditRef: JenisAuditRef[],
    onFilterChange: (filters: any) => void,
    onResetFilters: () => void
}) => {
    const [site, setSite] = useState('')
    const [area, setArea] = useState('')
    const [jenisAuditId, setJenisAuditId] = useState('')
    const [bulan, setBulan] = useState('')
    const [searchQuery, setSearchQuery] = useState('')

    const areaOptions = useMemo(() => {
        let filtered = allAreas || []
        if (site) filtered = filtered.filter(a => a.site === site)
        return Array.from(new Set(filtered.map(a => a.area))).sort()
    }, [site, allAreas])

    const handleFilter = () => onFilterChange({ site, area, jenisAuditId, bulan, searchQuery })
    
    const handleReset = () => {
        setSite(''); setArea(''); setJenisAuditId(''); setBulan(''); setSearchQuery('')
        onResetFilters()
    }

    const labelClass = "block text-sm font-medium text-grey"
    const inputClass = "w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru text-sm font-medium text-hitam"

    return (
        <div className="bg-putih p-5 rounded-lg shadow-md mb-6 font-arial">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
                <div className="lg:col-span-2">
                    <label htmlFor="site" className={labelClass}>Site</label>
                    <select id="site" value={site} onChange={(e) => { setSite(e.target.value); setArea('') }} className={inputClass}>
                        <option value="">Semua Site</option>
                        {allSites.map((s, idx) => <option key={idx} value={s}>{s}</option>)}
                    </select>
                </div>
                <div className="lg:col-span-2">
                    <label htmlFor="area" className={labelClass}>Area Audit</label>
                    <select id="area" value={area} onChange={(e) => setArea(e.target.value)} className={inputClass}>
                        <option value="">Semua Area</option>
                        {areaOptions.map((a, idx) => <option key={idx} value={a}>{a}</option>)}
                    </select>
                </div>
                <div className="lg:col-span-2">
                    <label htmlFor="jenisAudit" className={labelClass}>Jenis Audit</label>
                    <select id="jenisAudit" value={jenisAuditId} onChange={(e) => setJenisAuditId(e.target.value)} className={inputClass}>
                        <option value="">Semua Jenis</option>
                        {allJenisAuditRef.map((ref) => <option key={ref.jenis_audit_id} value={ref.jenis_audit_id}>{ref.nama_jenis_audit}</option>)}
                    </select>
                </div>
                <div className="lg:col-span-2">
                    <label htmlFor="bulan" className={labelClass}>Bulan Audit</label>
                    <input type="month" id="bulan" value={bulan} onChange={(e) => setBulan(e.target.value)} className={inputClass} />
                </div>
                <div className="lg:col-span-2">
                    <label htmlFor="search" className={labelClass}>Search</label>
                    <input type="text" id="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="No FTA / Auditor..." className={inputClass} />
                </div>
                <div className="lg:col-span-2 flex gap-2">
                    <button onClick={handleFilter} className="flex-1 px-4 py-2 font-bold text-putih rounded bg-biru hover:bg-biru/90 transition-opacity text-sm">Filter</button>
                    <button onClick={handleReset} className="flex-1 px-4 py-2 font-bold text-hitam rounded bg-grey/30 hover:bg-grey/40 transition-opacity text-sm">Refresh</button>
                </div>
            </div>
        </div>
    )
}

/* --- MAIN PAGE --- */
export default function AuditReportListPage() {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(true)
    const [isExporting, setIsExporting] = useState(false)
    const [data, setData] = useState<ReportItem[]>([])
    const [filteredData, setFilteredData] = useState<ReportItem[]>([]) 
    const [showDownloadOpt, setShowDownloadOpt] = useState(false)
    
    const [allSites, setAllSites] = useState<string[]>([])
    const [allAreas, setAllAreas] = useState<{ site: string, area: string }[]>([])
    const [allJenisAuditRef, setAllJenisAuditRef] = useState<JenisAuditRef[]>([])
    const [filters, setFilters] = useState<any>({})

    const fetchJenisAuditRef = async () => {
        try {
            const res = await fetchWithAuth('/api/setting/jenis_audit', { cache: 'no-store' })
            if (res.ok) { const json = await res.json(); setAllJenisAuditRef(json.data || []) }
        } catch (e) { console.error(e) }
    }

    const fetchData = async () => {
        setIsLoading(true)
        try {
            const res = await fetchWithAuth('/api/audit/report/masterlist', { cache: 'no-store' })
            if (res.ok) {
                const json = await res.json()
                const mapped = (json.data || []).map((item: any) => ({
                    id: item.id || item.pelaksanaan_id, 
                    no_fta: item.no_fta || '-',
                    tanggal_audit: item.tanggal_audit,
                    tanggal_selesai: item.tanggal_selesai,
                    site: item.site || item.nama_site || '-',
                    area: item.area || item.nama_area || '-',
                    jenis_audit: item.jenis_audit || item.nama_jenis_audit || '-',
                    auditor: item.auditor || item.nama_auditor || '-',
                    total_temuan: item.total_temuan,
                    status_laporan: item.status || item.status_laporan || '-' 
                }))
                
                setData(mapped); setFilteredData(mapped)
                
                const sites = Array.from(new Set(mapped.map((d: any) => d.site))).filter(s => s !== '-').sort() as string[]
                setAllSites(sites)
                
                const uniqueAreas = mapped.map((d: any) => ({ site: d.site, area: d.area })).filter((v: any, i: number, a: any[]) => a.findIndex((t: any) => (t.site === v.site && t.area === v.area)) === i)
                setAllAreas(uniqueAreas)
            }
        } catch (error) { toast.error("Gagal koneksi ke server") } finally { setIsLoading(false) }
    }

    useEffect(() => { fetchJenisAuditRef(); fetchData() }, [])

    useEffect(() => {
        let result = [...data]
        if (filters.site) result = result.filter(i => i.site === filters.site)
        if (filters.area) result = result.filter(i => i.area === filters.area)
        if (filters.jenisAuditId) {
            const ref = allJenisAuditRef.find(r => String(r.jenis_audit_id) === String(filters.jenisAuditId))
            if (ref) result = result.filter(i => i.jenis_audit === ref.nama_jenis_audit)
        }
        if (filters.bulan) result = result.filter(i => (i.tanggal_audit || '').startsWith(filters.bulan))
        if (filters.searchQuery) {
            const q = filters.searchQuery.toLowerCase()
            result = result.filter(i => 
                (i.no_fta || '').toLowerCase().includes(q) || 
                (i.auditor || '').toLowerCase().includes(q) ||
                (i.site || '').toLowerCase().includes(q) ||
                (i.area || '').toLowerCase().includes(q)
            )
        }
        setFilteredData(result)
    }, [filters, data, allJenisAuditRef])

    const formatDate = (dateStr: string) => {
        if (!dateStr || dateStr.startsWith('0001') || dateStr === '-') return '-'
        const d = new Date(dateStr)
        return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
    }

    /* --- EXPORT FUNCTIONS --- */
    const fetchDetailForExport = async (id: number) => {
        try {
            const res = await fetchWithAuth(`/api/audit/laporan-temuan/detailed/${id}`)
            if (!res.ok) return null
            const json = await res.json()
            return json.data 
        } catch (e) {
            console.error("Gagal fetch detail untuk PDF", e)
            return null
        }
    }

    const downloadPdf = async () => {
        setIsExporting(true)
        const toastId = toast.loading("Memproses PDF...") 

        try {
            const doc = new jsPDF('l', 'mm', 'a4') 
            doc.text('Monitoring Laporan Audit', 14, 15)
            
            const summaryData = filteredData.map(item => [
                item.no_fta || '-',
                item.jenis_audit,
                `${item.site} - ${item.area}`,
                item.auditor,
                formatDate(item.tanggal_audit),
                // Logika Tgl Close untuk PDF
                item.status_laporan === 'CLOSED' ? formatDate(item.tanggal_selesai) : '-',
                getStatusDisplay(item.status_laporan).label,
                item.total_temuan
            ])

            autoTable(doc, {
                head: [['No. FTA', 'Jenis Audit', 'Site / Area', 'Auditor', 'Tgl Audit', 'Tgl Selesai', 'Posisi Saat Ini', 'Temuan']],
                body: summaryData,
                startY: 20,
                styles: { fontSize: 8 },
                headStyles: { fillColor: [41, 128, 185] }
            })

            for (let i = 0; i < filteredData.length; i++) {
                const item = filteredData[i];
                toast.loading(`Mengambil detail ${i+1}/${filteredData.length}...`, { id: toastId })
                const detailData = await fetchDetailForExport(item.id)
                if (detailData && detailData.temuan && detailData.temuan.length > 0) {
                    doc.addPage()
                    doc.setFontSize(14); doc.text(`Detail: ${item.no_fta}`, 14, 15)
                    doc.setFontSize(10); doc.text(`Status: ${getStatusDisplay(item.status_laporan).label}`, 14, 22)
                    const detailRows = detailData.temuan.map((t: any, idx: number) => [
                        idx + 1, t.item_checklist_text || '-', t.deskripsi_temuan || '-', t.kategori_temuan || '-', t.status_verifikasi || t.hasil_verifikasi || '-'
                    ])
                    autoTable(doc, {
                        head: [['No', 'Item', 'Temuan', 'Kategori', 'Status Item']],
                        body: detailRows, startY: 28, styles: { fontSize: 8 }, headStyles: { fillColor: [52, 73, 94] }
                    })
                }
            }

            doc.save(`Monitoring_Audit_Report_${Date.now()}.pdf`)
            toast.success("PDF berhasil diunduh!", { id: toastId })
        } catch (error) { 
            console.error(error); 
            toast.error("Gagal membuat PDF", { id: toastId }) 
        } finally { 
            setIsExporting(false) 
        }
    }

    const downloadExcel = () => {
        const excelData = filteredData.map(item => ({
            'No. FTA': item.no_fta || '-',
            'Jenis Audit': item.jenis_audit,
            'Site': item.site,
            'Area': item.area,
            'Auditor': item.auditor,
            'Posisi Saat Ini': getStatusDisplay(item.status_laporan).label,
            'Tanggal Pelaksanaan': formatDate(item.tanggal_audit),
            // Logika Tgl Close untuk Excel
            'Tanggal Selesai': item.status_laporan === 'CLOSED' ? formatDate(item.tanggal_selesai) : '-',
            'Total Temuan': item.total_temuan
        }))
        const worksheet = XLSX.utils.json_to_sheet(excelData)
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, "Audit Summary")
        XLSX.writeFile(workbook, `Monitoring_Report_${Date.now()}.xlsx`)
        toast.success("Excel berhasil diunduh")
    }

    return (
        <div className="font-arial pb-10">
            <Toaster position="top-center" />
            
            <ReportFilters 
                allSites={allSites} allAreas={allAreas} allJenisAuditRef={allJenisAuditRef} 
                onFilterChange={(f) => setFilters(f)} onResetFilters={() => { setFilters({}); fetchData() }} 
            />

            <div className="bg-putih p-6 rounded-lg shadow-md mt-6">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-hitam">Monitoring Report</h3>
                    <div className="relative">
                        <button disabled={filteredData.length === 0 || isLoading || isExporting} onClick={() => setShowDownloadOpt(!showDownloadOpt)} className="flex items-center gap-2 px-4 py-2 bg-biru text-putih text-sm font-bold rounded shadow hover:bg-biru/90 transition-colors disabled:opacity-50">
                            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            <span>{isExporting ? 'Processing...' : 'Export'}</span>
                            {!isExporting && <ChevronDown className={`w-4 h-4 transition-transform ${showDownloadOpt ? 'rotate-180' : ''}`} />}
                        </button>
                        {showDownloadOpt && !isExporting && (
                            <div className="absolute right-0 mt-2 w-56 bg-putih border border-grey/20 rounded-md shadow-xl z-20 py-1 overflow-hidden">
                                <button onClick={() => { downloadPdf(); setShowDownloadOpt(false) }} className="w-full px-4 py-3 text-left text-sm text-hitam hover:bg-biru/10 flex items-center gap-3"><FileText className="w-4 h-4 text-red-600" /><div className="flex flex-col"><span className="font-bold">Export as PDF</span><span className="text-[10px] text-grey">All Details</span></div></button>
                                <hr className="border-grey/10" />
                                <button onClick={() => { downloadExcel(); setShowDownloadOpt(false) }} className="w-full px-4 py-3 text-left text-sm text-hitam hover:bg-biru/10 flex items-center gap-3"><TableIcon className="w-4 h-4 text-green-700" /><div className="flex flex-col"><span className="font-bold">Export as Excel</span><span className="text-[10px] text-grey">Summary Only</span></div></button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-grey/40">
                        <thead className="bg-grey/10">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase tracking-wider">No. FTA</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase tracking-wider">Jenis Audit</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase tracking-wider">Site / Area</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase tracking-wider">Auditor</th>
                                <th className="px-6 py-3 text-center text-xs font-bold text-grey uppercase tracking-wider">Status</th> 
                                <th className="px-6 py-3 text-center text-xs font-bold text-grey uppercase tracking-wider">Tgl Pelaksanaan</th>
                                <th className="px-6 py-3 text-center text-xs font-bold text-grey uppercase tracking-wider">Tgl Close</th>
                                <th className="px-6 py-3 text-center text-xs font-bold text-grey uppercase tracking-wider">Temuan</th>
                            </tr>
                        </thead>
                        <tbody className="bg-putih divide-y divide-grey/40 text-sm">
                            {isLoading ? (
                                <tr><td colSpan={8} className="text-center py-10 text-grey animate-pulse">Memuat histori laporan...</td></tr>
                            ) : filteredData.length === 0 ? (
                                <tr><td colSpan={8} className="text-center py-10 text-grey italic">Tidak ada data ditemukan.</td></tr>
                            ) : (
                                filteredData.map((item, idx) => {
                                    const statusStyle = getStatusDisplay(item.status_laporan);
                                    return (
                                        <tr key={idx} className="hover:bg-biru/5 transition-colors border-b border-grey/10">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <button 
                                                    onClick={() => router.push(`/report/${item.id}`)}
                                                    className="font-bold text-biru hover:underline text-left transition-all"
                                                >
                                                    {item.no_fta || '-'}
                                                </button>
                                            </td>
                                            
                                            <td className="px-6 py-4 font-semibold text-hitam">{item.jenis_audit}</td>
                                            <td className="px-6 py-4 text-hitam">{item.site} - {item.area}</td>
                                            <td className="px-6 py-4 text-hitam truncate max-w-[150px]" title={item.auditor}>{item.auditor}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`inline-block px-2 py-1 rounded text-[10px] font-bold uppercase border ${statusStyle.color}`}>
                                                    {statusStyle.label}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center text-hitam font-medium">{formatDate(item.tanggal_audit)}</td>
                                            {/* Logika Tgl Close di Tabel */}
                                            <td className="px-6 py-4 text-center text-hitam font-medium">
                                                {item.status_laporan === 'CLOSED' ? formatDate(item.tanggal_selesai) : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-center text-hitam font-bold">{item.total_temuan}</td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}