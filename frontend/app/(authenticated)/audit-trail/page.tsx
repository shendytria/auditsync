'use client'

import React, { useState, useEffect } from 'react'
import { Toaster, toast } from 'react-hot-toast'
import { Download } from 'lucide-react' // Import Icon Download
import jsPDF from 'jspdf'              // Import jsPDF
import autoTable from 'jspdf-autotable' // Import AutoTable

/* --- INTERFACES --- */
interface AuditLogItem {
    id: string
    actor: string
    role: string
    site: string
    action: string
    entity: string
    target_name: string
    description: string
    time: string
    changes: any
}

/* --- COMPONENT: FILTER --- */
const LogFilters = ({
    uniqueModules,
    uniqueActions,
    uniqueSites,
    onFilterChange,
    onResetFilters
}: {
    uniqueModules: string[],
    uniqueActions: string[],
    uniqueSites: string[],
    onFilterChange: (filters: any) => void,
    onResetFilters: () => void
}) => {
    const [moduleName, setModuleName] = useState('')
    const [site, setSite] = useState('')
    const [action, setAction] = useState('')
    const [searchQuery, setSearchQuery] = useState('')

    const handleFilter = () => onFilterChange({ moduleName, site, action, searchQuery })
    
    const handleReset = () => {
        setModuleName(''); setSite(''); setAction(''); setSearchQuery('')
        onResetFilters()
    }

    const labelClass = "block text-sm font-medium text-grey"
    const inputClass = "w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru text-sm font-medium text-hitam"

    return (
        <div className="bg-putih p-5 rounded-lg shadow-md mb-6 font-['Arial']">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
                
                {/* 1. Filter Site */}
                <div className="lg:col-span-2">
                    <label htmlFor="site" className={labelClass}>Site</label>
                    <select id="site" value={site} onChange={(e) => setSite(e.target.value)} className={inputClass}>
                        <option value="">All Site</option>
                        {uniqueSites.map((s, idx) => <option key={idx} value={s}>{s}</option>)}
                    </select>
                </div>

                {/* 2. Filter Modul */}
                <div className="lg:col-span-3">
                    <label htmlFor="module" className={labelClass}>Modul</label>
                    <select id="module" value={moduleName} onChange={(e) => setModuleName(e.target.value)} className={inputClass}>
                        <option value="">All Modul</option>
                        {uniqueModules.map((m, idx) => <option key={idx} value={m}>{m}</option>)}
                    </select>
                </div>

                {/* 3. Filter Action */}
                <div className="lg:col-span-3">
                    <label htmlFor="action" className={labelClass}>Action</label>
                    <select id="action" value={action} onChange={(e) => setAction(e.target.value)} className={inputClass}>
                        <option value="">All Action</option>
                        {uniqueActions.map((a, idx) => <option key={idx} value={a}>{a}</option>)}
                    </select>
                </div>

                {/* 4. Search */}
                <div className="lg:col-span-2">
                    <label htmlFor="search" className={labelClass}>Search</label>
                    <div className="relative">
                        <input 
                            type="text" 
                            id="search" 
                            value={searchQuery} 
                            onChange={(e) => setSearchQuery(e.target.value)} 
                            placeholder="User / Description..." 
                            className={inputClass} 
                        />
                    </div>
                </div>

                {/* 5. Buttons */}
                <div className="lg:col-span-2 flex gap-2">
                    <button onClick={handleFilter} className="flex-1 px-4 py-2 font-bold text-putih rounded bg-biru hover:bg-biru/90 transition-opacity text-sm">
                        Filter
                    </button>
                    <button onClick={handleReset} className="flex-1 px-4 py-2 font-bold text-hitam rounded bg-grey/30 hover:bg-grey/40 transition-opacity text-sm">
                        Reset
                    </button>
                </div>
            </div>
        </div>
    )
}

/* --- MAIN PAGE --- */
export default function AuditTrailPage() {
    const [isLoading, setIsLoading] = useState(true)
    const [data, setData] = useState<AuditLogItem[]>([])
    const [filteredData, setFilteredData] = useState<AuditLogItem[]>([]) 
    
    // State untuk Dropdown Filter
    const [uniqueModules, setUniqueModules] = useState<string[]>([])
    const [uniqueActions, setUniqueActions] = useState<string[]>([])
    const [uniqueSites, setUniqueSites] = useState<string[]>([])
    
    const [filters, setFilters] = useState<any>({})

    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || ''

    // Helper Mapping Modul
    const getModuleInfo = (item: AuditLogItem) => {
        const ent = item.entity.toLowerCase()
        const role = item.role.toLowerCase()
        const act = item.action.toUpperCase()

        if (ent.includes('user') || ent.includes('auth')) return 'Setting: Users'
        if (ent.includes('area')) return 'Setting: Area'
        if (ent.includes('checklist') && !ent.includes('item')) return 'Setting: Checklist Inspeksi'
        if (ent.includes('audit') && !ent.includes('log')) return 'Checklist: Pelaksanaan Audit'
        if (ent.includes('temuan') || ent.includes('laporan')) {
            if (role.includes('auditor')) return 'Laporan Temuan: Laporan Auditor'
            if (role.includes('qs')) return 'Laporan Temuan: Revisi QS Supervisor'
            if (role.includes('pic')) return 'Laporan Temuan: Tindak Lanjut PIC Area'
            if (act.includes('APPROVE') && role.includes('manager')) return 'Laporan Temuan: Final Approval'
            return 'Laporan Temuan'
        }
        if (ent.includes('evidence') || ent.includes('bukti')) return 'Pelaporan Bukti Perbaikan'
        if (ent.includes('verification') || ent.includes('verifikasi')) {
             if (act.includes('FINAL')) return 'Verifikasi: Final Verifikasi'
             return 'Verifikasi: Verifikasi Bukti'
        }
        return item.entity 
    }

    const fetchData = async () => {
        setIsLoading(true)
        try {
            const token = localStorage.getItem('token') 
            
            const res = await fetch(`${API_BASE}/api/audit/system-logs?limit=100`, { 
                cache: 'no-store',
                headers: {
                    'Authorization': `Bearer ${token}` 
                }
            })

            if (res.ok) {
                const json = await res.json()
                const logs: AuditLogItem[] = json.data || []
                
                setData(logs)
                setFilteredData(logs)

                const modules = Array.from(new Set(logs.map(log => getModuleInfo(log)))).filter(Boolean).sort()
                setUniqueModules(modules)

                const actions = Array.from(new Set(logs.map(d => d.action))).filter(Boolean).sort()
                setUniqueActions(actions)

                const sites = Array.from(new Set(logs.map(d => d.site))).filter(Boolean).sort()
                setUniqueSites(sites)

            } else {
                if(res.status === 401) toast.error("Sesi habis, silakan login kembali")
                else toast.error("Gagal mengambil data log")
            }
        } catch (error) { 
            console.error(error)
            toast.error("Gagal koneksi ke server") 
        } finally { 
            setIsLoading(false) 
        }
    }

    useEffect(() => { fetchData() }, [])

    useEffect(() => {
        let result = [...data]
        if (filters.moduleName) result = result.filter(i => getModuleInfo(i) === filters.moduleName)
        if (filters.site) result = result.filter(i => i.site === filters.site)
        if (filters.action) result = result.filter(i => i.action === filters.action)
        if (filters.searchQuery) {
            const q = filters.searchQuery.toLowerCase()
            result = result.filter(i => 
                (i.actor || '').toLowerCase().includes(q) || 
                (i.description || '').toLowerCase().includes(q)
            )
        }
        setFilteredData(result)
    }, [filters, data])

    const getActionBadgeClass = (action: string) => {
        const up = action.toUpperCase()
        if (up.includes('CREATE')) return 'bg-green-100 text-green-800'
        if (up.includes('UPDATE')) return 'bg-blue-100 text-blue-800'
        if (up.includes('DELETE')) return 'bg-red-100 text-red-800'
        if (up.includes('LOGIN')) return 'bg-purple-100 text-purple-800'
        if (up.includes('APPROVE')) return 'bg-blue-100 text-blue-800'
        if (up.includes('REJECT')) return 'bg-red-100 text-red-800'
        return 'bg-gray-100 text-gray-800'
    }

    // --- FUNGSI DOWNLOAD PDF ---
    const handleDownloadPDF = () => {
        const doc = new jsPDF('l', 'mm', 'a4') // Landscape orientation

        // Header Dokumen
        doc.setFontSize(14)
        doc.text('Audit Trail Report', 14, 15)
        doc.setFontSize(8)
        doc.text(`Generated at: ${new Date().toLocaleString('id-ID')}`, 14, 20)

        // Persiapan Kolom dan Baris
        const tableColumn = ["Waktu", "User", "Role", "Aksi", "Modul", "Deskripsi", "Site"]
        const tableRows: any[] = []

        filteredData.forEach(item => {
            const rowData = [
                item.time,
                item.actor,
                item.role,
                item.action,
                getModuleInfo(item), // Pakai helper yang sama
                item.description,
                item.site
            ]
            tableRows.push(rowData)
        })

        // Generate Tabel
        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 25,
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [41, 128, 185] }, // Warna Header Biru
            columnStyles: {
                0: { cellWidth: 25 }, // Waktu
                1: { cellWidth: 30 }, // User
                2: { cellWidth: 20 }, // Role
                3: { cellWidth: 20 }, // Aksi
                4: { cellWidth: 40 }, // Modul
                5: { cellWidth: 'auto' }, // Deskripsi (Sisa space)
                6: { cellWidth: 25 }, // Site
            }
        })

        // Save
        doc.save(`Audit_Trail_Report_${new Date().getTime()}.pdf`)
        toast.success("PDF berhasil diunduh")
    }

    return (
        <>
            <Toaster position="top-center" />
            
            <LogFilters 
                uniqueModules={uniqueModules} 
                uniqueActions={uniqueActions} 
                uniqueSites={uniqueSites}
                onFilterChange={(f) => setFilters(f)} 
                onResetFilters={() => { setFilters({}); fetchData() }} 
            />

            <div className="bg-putih p-6 rounded-lg shadow-md mt-6 font-['Arial']">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-lg font-bold text-hitam">Riwayat Aktivitas</h3>
                    </div>
                    {/* TOMBOL DOWNLOAD (Menggantikan text Total Logs) */}
                    <div className="text-right">
                        <button 
                            onClick={handleDownloadPDF}
                            disabled={filteredData.length === 0}
                            className="flex items-center gap-2 px-4 py-2 bg-biru text-putih text-sm font-bold rounded shadow hover:bg-biru/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Download className="w-4 h-4" />
                            Export PDF
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-grey/40">
                        <thead className="bg-grey/10">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase tracking-wider">Time</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase tracking-wider">User Name</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase tracking-wider">Action</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase tracking-wider">Modul</th> 
                                <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase tracking-wider">Description</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase tracking-wider">Site</th>
                            </tr>
                        </thead>
                        <tbody className="bg-putih divide-y divide-grey/40 text-sm">
                            {isLoading ? (
                                <tr><td colSpan={6} className="text-center py-10 text-grey animate-pulse">Memuat log aktivitas...</td></tr>
                            ) : filteredData.length === 0 ? (
                                <tr><td colSpan={6} className="text-center py-10 text-grey italic">Tidak ada aktivitas ditemukan.</td></tr>
                            ) : (
                                filteredData.map((item) => (
                                    <tr key={item.id} className="hover:bg-biru/5 transition-colors">
                                        {/* 1. Waktu */}
                                        <td className="px-6 py-4 whitespace-nowrap text-hitam font-medium w-[15%]">
                                            {item.time}
                                        </td>
                                        
                                        {/* 2. Nama User */}
                                        <td className="px-6 py-4 w-[15%]">
                                            <div className="font-bold text-hitam">{item.actor}</div>
                                            <div className="text-xs text-grey">{item.role}</div>
                                        </td>
                                        
                                        {/* 3. Aksi */}
                                        <td className="px-6 py-4 w-[10%]">
                                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getActionBadgeClass(item.action)}`}>
                                                {item.action}
                                            </span>
                                        </td>
                                        
                                        {/* 4. Modul */}
                                        <td className="px-6 py-4 w-[20%] text-biru font-semibold text-xs">
                                            {getModuleInfo(item)}
                                        </td>
                                        
                                        {/* 5. Deskripsi */}
                                        <td className="px-6 py-4 w-[30%] text-hitam">
                                            {item.description}
                                        </td>

                                        {/* 6. Site */}
                                        <td className="px-6 py-4 text-hitam w-[10%]">
                                            {item.site}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    )
}