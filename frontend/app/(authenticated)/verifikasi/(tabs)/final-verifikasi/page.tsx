'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Toaster, toast } from 'react-hot-toast'
import { CheckCircle, Search, Clock, UserCheck, ShieldCheck, Briefcase } from 'lucide-react'
import { fetchWithAuth } from '@/utils/api' 
import { getStatusColor, getStatusLabel } from '@/utils/statusHelper'

/* --- INTERFACES --- */
interface JenisAuditRef {
    jenis_audit_id: number
    nama_jenis_audit: string
}

interface FinalVerificationItem {
    id: number
    no_fta: string
    tanggal: string
    site: string
    area: string
    jenis_audit: string
    auditor: string
    status: string 
    jumlah_temuan: number
    tgl_masuk_final?: string 
}

/* --- COMPONENT: FILTER --- */
const FinalVerificationFilters = ({
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
export default function FinalVerificationMasterlistPage() {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(true)
    const [data, setData] = useState<FinalVerificationItem[]>([])
    const [filteredData, setFilteredData] = useState<FinalVerificationItem[]>([]) 
    
    // State Filter
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
            // [UPDATE] Endpoint masterlist Final Verification
            const res = await fetchWithAuth('/api/audit/final-verification/masterlist', { cache: 'no-store' })
            
            if (res.ok) {
                const json = await res.json()
                const mapped = (json.data || []).map((item: any) => ({
                    id: item.id,
                    no_fta: item.no_fta || '-', 
                    tanggal: item.tanggal,
                    site: item.site,
                    area: item.area,
                    jenis_audit: item.jenis_audit,
                    auditor: item.auditor,
                    status: item.status_laporan || item.status, 
                    jumlah_temuan: item.jml_temuan || 0,
                    tgl_masuk_final: item.tgl_masuk_final 
                }))
                
                setData(mapped)
                setFilteredData(mapped)

                const sites = Array.from(new Set(mapped.map((d: any) => d.site))).filter(Boolean).sort() as string[]
                setAllSites(sites)
                const areas = mapped.map((d: any) => ({ site: d.site, area: d.area }))
                const uniqueAreas = areas.filter((v: any, i: number, a: any[]) => a.findIndex((t: any) => (t.site === v.site && t.area === v.area)) === i)
                setAllAreas(uniqueAreas)

            } else {
                toast.error("Gagal memuat data Final Verifikasi")
            }
        } catch (error) {
            console.error(error)
            toast.error("Gagal koneksi ke server")
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchJenisAuditRef()
        fetchData()
    }, [])

    useEffect(() => {
    let result = [...data]

    // FILTER: Hanya laporan yang statusnya FINAL_CLOSING (di meja Supervisor)
    result = result.filter(item => {
        const isFinalStage = item.status === 'FINAL_CLOSING';
        const isNotClosed = item.status !== 'CLOSED';
        
        return isFinalStage && isNotClosed;
    });

    // --- Filter Standar (Site, Area, Search) ---
    if (filters.site) result = result.filter(i => i.site === filters.site)
    if (filters.area) result = result.filter(i => i.area === filters.area)
    if (filters.jenisAuditId) {
        const ref = allJenisAuditRef.find(r => String(r.jenis_audit_id) === String(filters.jenisAuditId))
        if (ref) result = result.filter(i => i.jenis_audit === ref.nama_jenis_audit)
    }
    if (filters.bulan) result = result.filter(i => (i.tanggal || '').startsWith(filters.bulan))
    if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase()
        result = result.filter(i => 
            (i.no_fta || '').toLowerCase().includes(q) || 
            (i.auditor || '').toLowerCase().includes(q)
        )
    }

    setFilteredData(result)
}, [filters, data, allJenisAuditRef])

    const handleRowClick = (id: number) => {
        // [FIX] Redirect ke halaman detail Final Verifikasi
        router.push(`/verifikasi/final-verifikasi/${id}`) 
    }

    const handleFilterChange = (f: any) => setFilters(f)
    const handleResetFilters = () => { setFilters({}); fetchData() }

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '-'
        const d = new Date(dateStr)
        return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
    }

    return (
        <div className="font-arial pb-20">
            <Toaster position="top-center"/>
            
            <FinalVerificationFilters 
                allSites={allSites} 
                allAreas={allAreas} 
                allJenisAuditRef={allJenisAuditRef} 
                onFilterChange={handleFilterChange} 
                onResetFilters={handleResetFilters} 
            />

            <div className="bg-putih p-6 rounded-lg shadow-md font-arial">
                
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-hitam">Final Verifikasi & Approval</h3>
                    
                    <span className="text-xs font-medium bg-grey/10 text-grey px-3 py-1 rounded-full border border-grey/20">
                        {filteredData.length} Laporan Pending
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
                                <th className="px-6 py-3 text-center text-xs font-bold text-grey uppercase tracking-wider">Jml Temuan</th>
                                <th className="px-6 py-3 text-center text-xs font-bold text-grey uppercase tracking-wider">Status</th>
                            </tr>
                        </thead>
                        <tbody className="bg-putih divide-y divide-grey/40 text-sm">
                            {isLoading ? (
                                <tr><td colSpan={7} className="text-center py-10 text-grey animate-pulse">Memuat antrian...</td></tr>
                            ) : filteredData.length === 0 ? (
                                <tr><td colSpan={7} className="text-center py-10 text-grey italic">Tidak ada laporan yang perlu difinalisasi saat ini.</td></tr>
                            ) : (
                                filteredData.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-green-50 transition-colors cursor-pointer">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <button 
                                                onClick={() => handleRowClick(item.id)}
                                                className="font-bold text-biru hover:underline hover:text-blue-800 text-left"
                                            >
                                                {item.no_fta || '-'}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 text-hitam">{formatDate(item.tanggal)}</td>
                                        <td className="px-6 py-4 text-hitam">{item.jenis_audit}</td>
                                        <td className="px-6 py-4 text-hitam">{item.site} - {item.area}</td>
                                        <td className="px-6 py-4 text-hitam truncate max-w-[150px]" title={item.auditor}>{item.auditor}</td>
                                        <td className="px-6 py-4 text-center text-hitam font-semibold">{item.jumlah_temuan}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold border border-transparent ${getStatusColor(item.status)}`}>
                                                {getStatusLabel(item.status)}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}