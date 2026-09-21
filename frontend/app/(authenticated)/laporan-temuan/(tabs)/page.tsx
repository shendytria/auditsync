'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Toaster, toast } from 'react-hot-toast'
import { AlertCircle, Search } from 'lucide-react'
import { fetchWithAuth } from '@/utils/api'
import { getStatusColor, getStatusLabel } from '@/utils/statusHelper'

/* --- INTERFACES --- */
interface JenisAuditRef {
    jenis_audit_id: number
    nama_jenis_audit: string
}

interface MasterAudit {
    pelaksanaan_id: number
    tanggal_audit: string
    jenis_audit_id?: number
    jenis_audit: string
    site: string
    area: string
    auditor: string
    jumlah_nok: number
    no_fta: string
    status_laporan: string 
    note_reject?: string | null
    auditor_ids?: number[]
}

/* --- COMPONENT: FILTER --- */
const LaporanFilters = ({
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
                    <label htmlFor="bulan" className={labelClass}>Bulan</label>
                    <input type="month" id="bulan" value={bulan} onChange={(e) => setBulan(e.target.value)} className={inputClass} />
                </div>
                <div className="lg:col-span-2">
                    <label htmlFor="search" className={labelClass}>Search</label>
                    <input type="text" id="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="No FTA / Auditor..." className={inputClass} />
                </div>
                <div className="lg:col-span-2 flex gap-2">
                    <button onClick={handleFilter} className="flex-1 px-4 py-2 font-bold text-putih rounded bg-biru hover:bg-biru/90 transition-opacity text-sm flex items-center justify-center gap-2">
                        <Search className="w-4 h-4"/> Filter
                    </button>
                    <button onClick={handleReset} className="flex-1 px-4 py-2 font-bold text-hitam rounded bg-grey/30 hover:bg-grey/40 transition-opacity text-sm">Refresh</button>
                </div>
            </div>
        </div>
    )
}

/* --- MAIN PAGE --- */
export default function LaporanAuditorPage() {
    const router = useRouter()
    const [data, setData] = useState<MasterAudit[]>([])
    const [filteredData, setFilteredData] = useState<MasterAudit[]>([])
    const [isLoading, setIsLoading] = useState(true)
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
            // [UPDATE] Menggunakan endpoint backend baru untuk Masterlist Auditor
            const res = await fetchWithAuth('/api/audit/laporan-temuan/auditor-masterlist', { cache: 'no-store' })
            
            if (res.ok) {
                const json = await res.json()
                const rawData = json.data || []
                
                // Mapping data response backend (models.MasterlistAudit)
                const normalized = rawData.map((item: any) => ({
                    pelaksanaan_id: item.pelaksanaan_id || item.id, // Fallback ID
                    tanggal_audit: item.tanggal_audit || item.tanggal,
                    jenis_audit: item.jenis_audit || item.nama_jenis_audit || '-',
                    site: item.site || item.nama_site || '-',
                    area: item.area || item.nama_area || '-',
                    auditor: item.auditor || item.nama_auditor || '-',
                    jumlah_nok: item.jumlah_temuan_nok || item.jml_temuan || 0,
                    no_fta: item.no_fta,
                    status_laporan: item.status_laporan || item.status, 
                    note_reject: item.note_reject || null,
                    auditor_ids: item.auditor_ids || [] 
                }))

                setData(normalized)
                setFilteredData(normalized)

                const sites = Array.from(new Set(normalized.map((d: any) => d.site))).filter(Boolean).sort() as string[]
                setAllSites(sites)
                const areas = normalized.map((d: any) => ({ site: d.site, area: d.area }))
                const uniqueAreas = areas.filter((v: any, i: number, a: any[]) => a.findIndex((t: any) => (t.site === v.site && t.area === v.area)) === i)
                setAllAreas(uniqueAreas)
            } else {
                toast.error("Gagal memuat data")
            }
        } catch (e) {
            toast.error("Koneksi gagal"); console.error(e)
        } finally {
            setIsLoading(false)
        }
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
            result = result.filter(i => (i.no_fta||'').toLowerCase().includes(q) || (i.auditor||'').toLowerCase().includes(q))
        }
        setFilteredData(result)
    }, [filters, data, allJenisAuditRef])

    const formatDate = (s?: string) => {
        if(!s || s==='-' || s.startsWith('0001')) return '-'; const d=new Date(s); 
        return isNaN(d.getTime()) ? s : d.toLocaleDateString('id-ID', {day:'2-digit', month:'long', year:'numeric'})
    }

    const handleRowClick = (item: MasterAudit) => { 
        if(!item.pelaksanaan_id) return;
        // [FIX] Mengarahkan ke halaman Detail Laporan Temuan
        router.push(`/laporan-temuan/${item.pelaksanaan_id}`) 
    }

    const handleFilterChange = (f: any) => setFilters(f)
    const handleResetFilters = () => { setFilters({}); fetchData() }

    return (
        <div className="font-arial pb-10">
            <Toaster position="top-center" />
            
            <LaporanFilters allSites={allSites} allAreas={allAreas} allJenisAuditRef={allJenisAuditRef} onFilterChange={handleFilterChange} onResetFilters={handleResetFilters} />

            <div className="bg-putih p-6 rounded-lg shadow-md mt-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-hitam">Laporan Auditor (History)</h3>
                    <span className="text-xs font-medium bg-grey/10 text-grey px-3 py-1 rounded-full border border-grey/20">
                        Total: {filteredData.length} Data
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-grey/40">
                        <thead className="bg-grey/10">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase tracking-wider">No. FTA</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase tracking-wider">Tanggal</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase tracking-wider">Jenis Audit</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase tracking-wider">Site / Area</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase tracking-wider">Auditor</th>
                                <th className="px-6 py-3 text-center text-xs font-bold text-grey uppercase tracking-wider">Temuan NOK</th>
                                <th className="px-6 py-3 text-center text-xs font-bold text-grey uppercase tracking-wider">Status</th>
                            </tr>
                        </thead>
                        <tbody className="bg-putih divide-y divide-grey/40 text-sm">
                            {isLoading ? (
                                <tr><td colSpan={7} className="text-center py-12 text-grey animate-pulse">Memuat data...</td></tr>
                            ) : filteredData.length === 0 ? (
                                <tr><td colSpan={7} className="text-center py-12 text-grey italic">Tidak ada laporan yang sesuai.</td></tr>
                            ) : (
                                filteredData.map((item, idx) => {
                                    // Logic tooltip Reject
                                    // Cek apakah status mengandung 'REJECTED' atau 'REVISION'
                                    const isRejected = item.status_laporan?.includes('REJECT') || item.status_laporan?.includes('REVISION'); 

                                    return (
                                        <tr key={idx} className="hover:bg-biru/5 transition-colors group cursor-pointer" onClick={() => handleRowClick(item)}>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <button 
                                                    type="button" 
                                                    className="font-bold text-biru hover:underline hover:text-blue-800 text-left"
                                                >
                                                    {item.no_fta || '-'}
                                                </button>
                                            </td>
                                            <td className="px-6 py-4 text-hitam whitespace-nowrap">{formatDate(item.tanggal_audit)}</td>
                                            <td className="px-6 py-4 text-hitam whitespace-nowrap">{item.jenis_audit || '-'}</td>
                                            <td className="px-6 py-4 text-hitam whitespace-nowrap">{item.site} - {item.area}</td>
                                            <td className="px-6 py-4 text-hitam max-w-[200px] truncate" title={item.auditor}>{item.auditor || '-'}</td>
                                            <td className="px-6 py-4 text-center text-red-600 font-bold">{item.jumlah_nok}</td>
                                            
                                            <td className="px-6 py-4 text-center align-middle">
                                                <div className="flex flex-col items-center gap-1">
                                                    {/* [UPDATE] Pakai Helper Global */}
                                                    <span className={`px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full ${getStatusColor(item.status_laporan)}`}>
                                                        {getStatusLabel(item.status_laporan)}
                                                    </span>

                                                    {/* Tooltip Reject */}
                                                    {isRejected && item.note_reject && (
                                                        <div className="group/tooltip relative cursor-help mt-1">
                                                            <div className="flex items-center gap-1 bg-red-50 border border-red-200 text-red-600 px-2 py-0.5 rounded text-[10px] font-bold shadow-sm">
                                                                <AlertCircle className="w-3 h-3" />
                                                                <span>Ditolak</span>
                                                            </div>
                                                            <div className="absolute z-50 bottom-full mb-2 left-1/2 -translate-x-1/2 w-56 p-3 bg-gray-800 text-white text-xs rounded-md shadow-xl opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none text-left">
                                                                <span className="font-bold block text-red-300 mb-1 border-b border-gray-600 pb-1">Alasan Penolakan:</span>
                                                                <p className="italic text-gray-200">"{item.note_reject}"</p>
                                                                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-800"></div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
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