'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Toaster, toast } from 'react-hot-toast'
import { Download, ChevronDown, FileText, Table as TableIcon } from 'lucide-react'
import { fetchWithAuth } from '@/utils/api'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

/* --- INTERFACES --- */
interface LeadtimeItem {
    id: number
    no_fta: string
    site: string
    area: string
    pic: string
    tgl_create: string | null
    tgl_verif: string | null
    due_date: string | null
    tgl_upload: string | null
    status_item: string
}

/* --- COMPONENT: FILTER --- */
const LeadtimeFilters = ({
    uniqueSites,
    onFilterChange,
    onResetFilters
}: {
    uniqueSites: string[],
    onFilterChange: (filters: any) => void,
    onResetFilters: () => void
}) => {
    const [site, setSite] = useState('')
    const [month, setMonth] = useState('') 
    const [searchQuery, setSearchQuery] = useState('')

    const handleFilter = () => onFilterChange({ site, month, searchQuery })
    const handleReset = () => {
        setSite(''); setMonth(''); setSearchQuery('')
        onResetFilters()
    }

    const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]
    const labelClass = "block text-sm font-medium text-grey"
    const inputClass = "w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru text-sm font-medium text-hitam"

    return (
        <div className="bg-putih p-5 rounded-lg shadow-md mb-6 font-['Arial']">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
                <div className="lg:col-span-3">
                    <label className={labelClass}>Site</label>
                    <select value={site} onChange={(e) => setSite(e.target.value)} className={inputClass}>
                        <option value="">All Site</option>
                        {uniqueSites.map((s, idx) => <option key={idx} value={s}>{s}</option>)}
                    </select>
                </div>
                <div className="lg:col-span-3">
                    <label className={labelClass}>Month (Create Date)</label>
                    <select value={month} onChange={(e) => setMonth(e.target.value)} className={inputClass}>
                        <option value="">All Month</option>
                        {months.map((m, idx) => <option key={idx} value={idx.toString()}>{m}</option>)}
                    </select>
                </div>
                <div className="lg:col-span-4">
                    <label className={labelClass}>Search</label>
                    <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="No. FTA / Nama PIC..." className={inputClass} />
                </div>
                <div className="lg:col-span-2 flex gap-2">
                    <button onClick={handleFilter} className="flex-1 px-4 py-2 font-bold text-putih rounded bg-biru hover:bg-biru/90 transition-opacity text-sm shadow-sm">Filter</button>
                    <button onClick={handleReset} className="flex-1 px-4 py-2 font-bold text-hitam rounded bg-grey/30 hover:bg-grey/40 transition-opacity text-sm shadow-sm">Reset</button>
                </div>
            </div>
        </div>
    )
}

export default function LeadtimePage() {
    const [data, setData] = useState<LeadtimeItem[]>([])
    const [filteredData, setFilteredData] = useState<LeadtimeItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [showExportDropdown, setShowExportDropdown] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const [uniqueSites, setUniqueSites] = useState<string[]>([])
    const [filters, setFilters] = useState<any>({})

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setShowExportDropdown(false)
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const fetchData = async () => {
        setIsLoading(true)
        try {
            const res = await fetchWithAuth('/api/audit/log/leadtime', { cache: 'no-store' })
            if (res.ok) {
                const json = await res.json()
                const items: LeadtimeItem[] = json.data || []
                setData(items); setFilteredData(items)
                setUniqueSites(Array.from(new Set(items.map(d => d.site))).filter(Boolean).sort())
            }
        } catch (error) { toast.error("Gagal memuat data leadtime") } finally { setIsLoading(false) }
    }

    useEffect(() => { fetchData() }, [])

    useEffect(() => {
        let result = [...data]
        if (filters.site) result = result.filter(i => i.site === filters.site)
        if (filters.month) result = result.filter(i => i.tgl_create && new Date(i.tgl_create).getMonth().toString() === filters.month)
        if (filters.searchQuery) {
            const q = filters.searchQuery.toLowerCase()
            result = result.filter(i => (i.no_fta || '').toLowerCase().includes(q) || (i.pic || '').toLowerCase().includes(q))
        }
        setFilteredData(result)
    }, [filters, data])

    /* --- HELPERS CALCULATION --- */
    const formatDate = (dateStr: string | null) => {
        if (!dateStr || dateStr.startsWith('0001')) return '-'
        return new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
    }

    const getDiffDays = (start: string | null, end: string | null) => {
        if (!start) return 0
        const d1 = new Date(start)
        const d2 = end ? new Date(end) : new Date()
        const diff = Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24))
        return diff < 0 ? 0 : diff
    }

    const calculateOverdue = (item: LeadtimeItem) => {
        if (!item.due_date) return 0
        const dueDate = new Date(item.due_date)
        const compareDate = item.tgl_verif ? new Date(item.tgl_verif) : new Date()
        const diffTime = compareDate.getTime() - dueDate.getTime()
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        return diffDays > 0 ? diffDays : 0
    }

    const getStatusInfo = (item: LeadtimeItem, overdueDays: number) => {
        if (!item.tgl_verif) return overdueDays > 0 ? { label: 'OVERDUE', class: 'bg-red-100 text-red-700' } : { label: 'PENDING', class: 'bg-yellow-100 text-yellow-700' }
        return overdueDays > 0 ? { label: 'OVERDUE', class: 'bg-red-100 text-red-700' } : { label: 'ON TIME', class: 'bg-green-100 text-green-700' }
    }

    /* --- EXPORT FUNCTIONS --- */
    const handleDownloadPDF = () => {
        try {
            const doc = new jsPDF('l', 'mm', 'a4')
            doc.setFontSize(14); doc.text('Leadtime Analysis Report', 14, 15)
            doc.setFontSize(8); doc.text(`Generated: ${new Date().toLocaleString('id-ID')}`, 14, 20)

            const tableColumn = ["NO FTA", "SITE", "AREA", "CREATE", "CLOSED", "LT", "DUE DATE", "OVERDUE", "STATUS", "PIC"]
            const tableRows = filteredData.map(item => {
                const lt = getDiffDays(item.tgl_create, item.tgl_verif)
                const ov = calculateOverdue(item)
                const st = getStatusInfo(item, ov)
                return [
                    item.no_fta, item.site, item.area, formatDate(item.tgl_create), formatDate(item.tgl_verif),
                    `${lt} Hari`, formatDate(item.due_date), `${ov} Hari`, st.label, item.pic
                ]
            })

            autoTable(doc, {
                head: [tableColumn], body: tableRows, startY: 25,
                styles: { fontSize: 7, cellPadding: 2 },
                headStyles: { fillColor: [41, 128, 185] }
            })
            doc.save(`Leadtime_Report_${Date.now()}.pdf`)
            toast.success("PDF berhasil diunduh")
        } catch (err) { toast.error("Gagal export PDF") }
        setShowExportDropdown(false)
    }

    const handleDownloadExcel = () => {
        try {
            const exportData = filteredData.map(item => {
                const lt = getDiffDays(item.tgl_create, item.tgl_verif)
                const ov = calculateOverdue(item)
                const st = getStatusInfo(item, ov)
                return {
                    "No. FTA": item.no_fta, "Site": item.site, "Area": item.area,
                    "Create Date": formatDate(item.tgl_create), "Closed Date": formatDate(item.tgl_verif),
                    "Leadtime (Hari)": lt, "Due Date": formatDate(item.due_date),
                    "Overdue (Hari)": ov, "Status": st.label, "PIC": item.pic
                }
            })
            const ws = XLSX.utils.json_to_sheet(exportData)
            const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Leadtime")
            XLSX.writeFile(wb, `Leadtime_Audit_${Date.now()}.xlsx`)
            toast.success("Excel berhasil diunduh")
        } catch (err) { toast.error("Gagal export Excel") }
        setShowExportDropdown(false)
    }

    return (
        <>
            <Toaster position="top-center" />
            <LeadtimeFilters uniqueSites={uniqueSites} onFilterChange={(f) => setFilters(f)} onResetFilters={() => { setFilters({}); fetchData() }} />

            <div className="bg-putih p-6 rounded-lg shadow-md mt-6 font-['Arial']">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-hitam">Leadtime Analysis Monitoring</h3>
                    <div className="relative" ref={dropdownRef}>
                        <button onClick={() => setShowExportDropdown(!showExportDropdown)} disabled={filteredData.length === 0} className="flex items-center gap-2 px-4 py-2 bg-biru text-putih text-sm font-bold rounded shadow hover:bg-biru/90 transition-all disabled:opacity-50">
                            <Download className="w-4 h-4" /> Export Data <ChevronDown className={`w-4 h-4 transition-transform ${showExportDropdown ? 'rotate-180' : ''}`} />
                        </button>
                        {showExportDropdown && (
                            <div className="absolute right-0 mt-2 w-48 bg-white border border-grey/20 rounded-md shadow-lg z-50 overflow-hidden font-['Arial']">
                                <button onClick={handleDownloadPDF} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-hitam hover:bg-biru/5 transition-colors text-left font-medium border-b border-grey/10">
                                    <FileText className="w-4 h-4 text-red-500" /> Export PDF
                                </button>
                                <button onClick={handleDownloadExcel} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-hitam hover:bg-biru/5 transition-colors text-left font-medium">
                                    <TableIcon className="w-4 h-4 text-green-600" /> Export Excel
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-grey/40">
                        <thead className="bg-grey/10">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase tracking-wider">No. FTA</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase tracking-wider">Site</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase tracking-wider">Area</th>
                                <th className="px-6 py-3 text-center text-xs font-bold text-grey uppercase tracking-wider">Create Date</th>
                                <th className="px-6 py-3 text-center text-xs font-bold text-grey uppercase tracking-wider">Closed Date</th>
                                <th className="px-6 py-3 text-center text-xs font-bold text-grey uppercase tracking-wider">Leadtime</th>
                                <th className="px-6 py-3 text-center text-xs font-bold text-grey uppercase tracking-wider">Due Date</th>
                                <th className="px-6 py-3 text-center text-xs font-bold text-grey uppercase tracking-wider">Overdue</th>
                                <th className="px-6 py-3 text-center text-xs font-bold text-grey uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase tracking-wider">PIC</th>
                            </tr>
                        </thead>
                        <tbody className="bg-putih divide-y divide-grey/40 text-sm">
                            {isLoading ? (
                                <tr><td colSpan={10} className="text-center py-10 text-grey animate-pulse font-medium">Memuat data monitoring...</td></tr>
                            ) : filteredData.length === 0 ? (
                                <tr><td colSpan={10} className="text-center py-10 text-grey italic">Tidak ada data ditemukan.</td></tr>
                            ) : (
                                filteredData.map((item, idx) => {
                                    const ltDays = getDiffDays(item.tgl_create, item.tgl_verif);
                                    const overdueDays = calculateOverdue(item);
                                    const status = getStatusInfo(item, overdueDays);

                                    return (
                                        <tr key={idx} className="hover:bg-biru/5 transition-colors">
                                            <td className="px-6 py-4 font-bold text-biru text-xs">{item.no_fta}</td>
                                            <td className="px-6 py-4 font-bold text-hitam text-xs uppercase">{item.site}</td>
                                            <td className="px-6 py-4 font-bold text-hitam text-xs uppercase">{item.area}</td>
                                            <td className="px-6 py-4 text-center font-medium text-xs italic text-hitam">{formatDate(item.tgl_create)}</td>
                                            <td className="px-6 py-4 text-center font-medium text-xs text-green-700 italic">{formatDate(item.tgl_verif)}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="px-2 py-1 bg-biru/10 text-biru rounded-full font-bold text-[10px]">{ltDays} Hari</span>
                                            </td>
                                            <td className="px-6 py-4 text-center font-bold text-red-600 text-xs">{formatDate(item.due_date)}</td>
                                            <td className="px-6 py-4 text-center font-bold">
                                                <span className={overdueDays > 0 ? "text-red-600" : "text-green-600"}>{overdueDays} Hari</span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-2 py-1 rounded-full font-bold text-[10px] ${status.class}`}>{status.label}</span>
                                            </td>
                                            <td className="px-6 py-4 font-bold text-hitam text-[10px] uppercase italic tracking-tight">{item.pic}</td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    )
}