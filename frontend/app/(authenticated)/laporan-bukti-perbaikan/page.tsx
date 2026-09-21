'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Toaster, toast } from 'react-hot-toast'
import { Search } from 'lucide-react'
import { fetchWithAuth } from '@/utils/api'

/* --- INTERFACES --- */
interface JenisAuditRef {
    jenis_audit_id: number
    nama_jenis_audit: string
}

interface EvidenceItem {
    id: number
    no_fta: string
    tanggal: string
    site: string
    area: string
    jenis_audit: string
    auditor: string
    status: string
    jumlah_nok: number
    jumlah_selesai: number
    count_reject?: number 
    rejector_info?: string 
}

/* --- COMPONENT: FILTER --- */
const EvidenceFilters = ({
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
export default function EvidenceListPage() {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(true)
    const [data, setData] = useState<EvidenceItem[]>([])
    const [filteredData, setFilteredData] = useState<EvidenceItem[]>([]) 
    
    const [allSites, setAllSites] = useState<string[]>([])
    const [allAreas, setAllAreas] = useState<{ site: string, area: string }[]>([])
    const [allJenisAuditRef, setAllJenisAuditRef] = useState<JenisAuditRef[]>([])
    const [filters, setFilters] = useState<any>({})

    const STATUS_UNTUK_PIC = [
    'READY_FOR_CAPA',
    'EVIDENCE_IN_PROGRESS',
    'EVIDENCE_REJECTED_AUDITOR',
    'EVIDENCE_REJECTED_QSSPV'
    ];

    const fetchJenisAuditRef = async () => {
        try {
            const res = await fetchWithAuth('/api/setting/jenis_audit', { cache: 'no-store' })
            if (res.ok) { const json = await res.json(); setAllJenisAuditRef(json.data || []) }
        } catch (e) { console.error(e) }
    }

    const fetchData = async () => {
        setIsLoading(true)
        try {
            const res = await fetchWithAuth('/api/audit/evidence/masterlist', { cache: 'no-store' })
            
            if (res.ok) {
                const json = await res.json()
                const mapped = (json.data || []).map((item: any) => ({
                    id: item.pelaksanaan_id || item.id, 
                    no_fta: item.no_fta,
                    tanggal: item.tanggal_audit || item.tanggal, 
                    site: item.site,
                    area: item.area,
                    jenis_audit: item.jenis_audit,
                    auditor: item.auditor,
                    status: item.status_evidence || item.status,
                    jumlah_nok: item.jml_temuan || 0,     
                    jumlah_selesai: item.jml_selesai || 0,
                    count_reject: item.count_reject || 0,
                    rejector_info: item.rejector_info || ''
                }))
                
                setData(mapped)
                setFilteredData(mapped)

                const sites = Array.from(new Set(mapped.map((d: any) => d.site))).filter(Boolean).sort() as string[]
                setAllSites(sites)
                const areas = mapped.map((d: any) => ({ site: d.site, area: d.area }))
                const uniqueAreas = areas.filter((v: any, i: number, a: any[]) => a.findIndex((t: any) => (t.site === v.site && t.area === v.area)) === i)
                setAllAreas(uniqueAreas)

            } else {
                toast.error("Gagal memuat data pelaporan")
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

        // --- 1. FILTER KHUSUS PIC (FRONTEND) ---
        result = result.filter(item => {
            // A. CEK REJECT (Wajib Muncul)
            // Jika ada item yang direject QS Staff/SPV, harus muncul biar diperbaiki PIC
            const isRejected = (item.count_reject && item.count_reject > 0) || 
                               item.status === 'EVIDENCE_REJECTED_AUDITOR' || 
                               item.status === 'EVIDENCE_REJECTED_QSSPV';
            
            if (isRejected) return true;

            // B. CEK PROGRES UPLOAD (Wajib Belum Beres)
            // Jika sudah 2/2, 1/1, atau 3/3, hilangkan dari list PIC
            const isNotFinished = item.jumlah_selesai < item.jumlah_nok;

            // C. FILTER STATUS MASTER YANG BOLEH DIKERJAKAN PIC
            // Kita batasi hanya status yang memang ranah PIC untuk upload bukti
            const ranahPIC = [
                'READY_FOR_CAPA', 
                'EVIDENCE_IN_PROGRESS', 
            ].includes(item.status);

            // Tampilkan jika (Belum Beres DAN di ranah PIC) ATAU (Sedang di-Reject)
            return (isNotFinished && ranahPIC) || isRejected;
        });

        // --- 2. FILTER STANDAR (Site, Area, Search) ---
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

    const handleRowClick = (item: EvidenceItem) => {
        router.push(`/laporan-bukti-perbaikan/${item.id}`)
    }

    const handleFilterChange = (f: any) => setFilters(f)
    const handleResetFilters = () => { setFilters({}); fetchData() }

    const formatDate = (dateStr: string) => {
        if (!dateStr || dateStr.startsWith('0001')) return '-'
        const d = new Date(dateStr)
        return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
    }

    // Helper Status Badge
    const getStatusBadge = (item: EvidenceItem) => {
    switch (item.status) {
        case 'READY_FOR_CAPA':
            return (
                <span className="inline-flex items-center px-4 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">
                    Ready for Evidence
                </span>
            )

        case 'EVIDENCE_IN_PROGRESS':
            return (
                <span className="inline-flex items-center px-4 py-1 rounded-full text-xs font-medium bg-hijau/10 text-hijau border-hijau/20">
                    In Progress
                </span>
            )

        case 'EVIDENCE_REJECTED_AUDITOR':
            return (
                <div className="flex flex-col items-center">
                    <span className="inline-flex items-center px-4 py-1 rounded-full text-xs font-medium 'bg-grey/10 text-grey border-grey/20">
                        Returned by QS Staff
                    </span>
                    {item.rejector_info && (
                        <span className="text-[10px] text-gray-500 mt-1 truncate max-w-[150px]">
                            {item.rejector_info}
                        </span>
                    )}
                </div>
            )

        case 'EVIDENCE_REJECTED_QSSPV':
            return (
                <div className="flex flex-col items-center">
                    <span className="inline-flex items-center px-4 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-300">
                        Returned by QS SPV
                    </span>
                    {item.rejector_info && (
                        <span className="text-[10px] text-gray-500 mt-1 truncate max-w-[150px]">
                            {item.rejector_info}
                        </span>
                    )}
                </div>
            )

        default:
            return (
                <span className="inline-flex items-center px-4 py-1 rounded-full text-xs font-medium bg-gray-50 text-gray-500 border border-gray-200">
                    {item.status}
                </span>
            )
        }
    }

    return (
        <div className="font-arial pb-20">
            <Toaster position="top-center" />
            
            <EvidenceFilters 
                allSites={allSites} 
                allAreas={allAreas} 
                allJenisAuditRef={allJenisAuditRef} 
                onFilterChange={handleFilterChange} 
                onResetFilters={handleResetFilters} 
            />

            <div className="bg-putih p-6 rounded-lg shadow-md mt-6">
                
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-hitam">Laporan Bukti Perbaikan</h3>
                    <span className="text-xs font-medium bg-grey/10 text-grey px-3 py-1 rounded-full border border-grey/20">
                        {filteredData.length} Laporan Aktif
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
                                <th className="px-6 py-3 text-center text-xs font-bold text-grey uppercase tracking-wider">Temuan</th>
                                <th className="px-6 py-3 text-center text-xs font-bold text-grey uppercase tracking-wider">Status</th>
                            </tr>
                        </thead>
                        <tbody className="bg-putih divide-y divide-grey/40 text-sm">
                            {isLoading ? (
                                <tr><td colSpan={7} className="text-center py-10 text-grey animate-pulse">Memuat data...</td></tr>
                            ) : filteredData.length === 0 ? (
                                <tr><td colSpan={7} className="text-center py-10 text-grey italic">Tidak ada tugas pelaporan bukti saat ini.</td></tr>
                            ) : (
                                filteredData.map((item, idx) => {
                                    return (
                                        <tr key={idx} className="hover:bg-biru/5 transition-colors cursor-pointer" onClick={() => handleRowClick(item)}>
                                            <td className="px-6 py-4 whitespace-nowrap font-bold text-biru hover:underline">
                                                {item.no_fta || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-hitam">{formatDate(item.tanggal)}</td>
                                            <td className="px-6 py-4 text-hitam">{item.jenis_audit}</td>
                                            <td className="px-6 py-4 text-hitam">{item.site} - {item.area}</td>
                                            <td className="px-6 py-4 text-hitam truncate max-w-[150px]" title={item.auditor}>{item.auditor}</td>
                                            <td className="px-6 py-4 text-center text-hitam font-bold">
                                                <div className="flex flex-col items-center">
                                                    <span>{item.jumlah_selesai} / {item.jumlah_nok}</span>
                                                    {/* Progress Bar Mini (Opsional biar keren) */}
                                                    <div className="w-16 h-1 bg-grey/20 rounded-full mt-1 overflow-hidden">
                                                        <div 
                                                            className="h-full bg-biru transition-all duration-500" 
                                                            style={{ width: `${(item.jumlah_selesai / item.jumlah_nok) * 100}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center align-middle">
                                                {getStatusBadge(item)}
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