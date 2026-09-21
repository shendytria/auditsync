'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Toaster, toast } from 'react-hot-toast'
import { Edit, X, UserCog } from 'lucide-react'
import { fetchWithAuth } from '@/utils/api'

// --- Interfaces ---
interface PicCapaItem {
    temuan_id: string
    pic_user_id: number
    pic_name: string
    deskripsi_temuan: string
}

interface DelegationItem {
    pelaksanaan_id: string
    no_fta: string       
    tanggal_audit: string
    nama_area: string
    status_laporan: string
    site_name: string     
    jenis_audit: string   

    qs_spv_id: number | null
    mgr_area_id: number | null
    mgr_qs_id: number | null

    qs_spv_name: string
    mgr_area_name: string
    mgr_qs_name: string

    pic_capa_list: PicCapaItem[] 
}

interface UserOption {
    id: number
    name: string
    role: string
}

// --- Filter Component ---
const DelegationFilters = ({ 
    searchTerm, setSearchTerm,
    filterArea, setFilterArea,
    filterSite, setFilterSite,
    filterJenis, setFilterJenis,
    uniqueAreas,
    uniqueSites,
    uniqueJenis,
    onRefresh 
}: { 
    searchTerm: string, setSearchTerm: (val: string) => void,
    filterArea: string, setFilterArea: (val: string) => void,
    filterSite: string, setFilterSite: (val: string) => void,
    filterJenis: string, setFilterJenis: (val: string) => void,
    uniqueAreas: string[],
    uniqueSites: string[],
    uniqueJenis: string[],
    onRefresh: () => void 
}) => {
    
    const handleReset = () => {
        setSearchTerm('')
        setFilterArea('')
        setFilterSite('')
        setFilterJenis('')
        onRefresh()
    }

    return (
        <div className="bg-putih p-4 rounded-lg shadow-md mb-6 font-['Arial']">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div>
                    <label className="block text-sm font-medium text-grey">Site</label>
                    <select
                        value={filterSite}
                        onChange={(e) => setFilterSite(e.target.value)}
                        className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru text-sm"
                    >
                        <option value="">Semua Site</option>
                        {uniqueSites.map(site => (
                            <option key={site} value={site}>{site}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-grey">Jenis Audit</label>
                    <select
                        value={filterJenis}
                        onChange={(e) => setFilterJenis(e.target.value)}
                        className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru text-sm"
                    >
                        <option value="">Semua Jenis</option>
                        {uniqueJenis.map(jenis => (
                            <option key={jenis} value={jenis}>{jenis}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-grey">Area</label>
                    <select
                        value={filterArea}
                        onChange={(e) => setFilterArea(e.target.value)}
                        className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru text-sm"
                    >
                        <option value="">Semua Area</option>
                        {uniqueAreas.map(area => (
                            <option key={area} value={area}>{area}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-grey">Search</label>
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search..."
                        className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru text-sm" 
                    />
                </div>
                <div className="flex items-end space-x-2">
                    <button onClick={onRefresh} className="flex-1 px-4 py-2 font-bold text-putih rounded bg-biru hover:bg-biru/90 transition-opacity">Filter</button>
                    <button onClick={handleReset} className="flex-1 px-4 py-2 font-bold text-hitam rounded bg-grey/30 hover:bg-grey/40 transition-opacity">Reset</button>
                </div>
            </div>
        </div>
    )
}

// --- Edit Modal Component ---
const EditDelegationModal = ({
    item,
    users,
    onClose,
    onSuccess
}: {
    item: DelegationItem,
    users: UserOption[],
    onClose: () => void,
    onSuccess: () => void
}) => {
    const [formQsSpv, setFormQsSpv] = useState<number | string>(item.qs_spv_id || '')
    const [formMgrArea, setFormMgrArea] = useState<number | string>(item.mgr_area_id || '')
    const [formMgrQs, setFormMgrQs] = useState<number | string>(item.mgr_qs_id || '')
    
    const [picCapaChanges, setPicCapaChanges] = useState<Record<string, number>>({})
    const [isSaving, setIsSaving] = useState(false)

    const handlePicChange = (temuanId: string, userId: string) => {
        setPicCapaChanges(prev => ({
            ...prev,
            [temuanId]: Number(userId)
        }))
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSaving(true)
        
        try {
            const payload = {
                qs_spv_id: formQsSpv ? Number(formQsSpv) : null,
                mgr_area_id: formMgrArea ? Number(formMgrArea) : null,
                mgr_qs_id: formMgrQs ? Number(formMgrQs) : null,
                pic_capa_updates: Object.entries(picCapaChanges).map(([temuan_id, user_id]) => ({
                    temuan_id,
                    user_id
                }))
            }

            const res = await fetchWithAuth(`/api/setting/delegation/update/${item.pelaksanaan_id}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            })

            if(!res.ok) throw new Error("Gagal update")

            toast.success("Delegation berhasil diupdate!")
            onSuccess()
            onClose()
        } catch(e) {
            toast.error("Terjadi kesalahan sistem")
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-hitam/50 animate-in fade-in zoom-in duration-200 font-['Arial']">
            <div className="bg-putih p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4 border-b border-grey/10 pb-2">
                    <div>
                        <h4 className="text-xl font-bold text-hitam">Edit Delegation</h4>
                        <p className="text-xs text-grey mt-1">
                            {item.no_fta} • {item.site_name} • {item.jenis_audit}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-grey hover:text-hitam">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSave} className="space-y-6">
                    {/* Fixed Approvers Section */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-grey mb-1">QS Supervisor</label>
                            <select 
                                className="w-full p-2 border border-grey/40 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-biru"
                                value={formQsSpv}
                                onChange={e => setFormQsSpv(e.target.value)}
                            >
                                <option value="">-- Pilih --</option>
                                {users.map(u => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-grey mb-1">Mgr Area</label>
                            <select 
                                className="w-full p-2 border border-grey/40 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-biru"
                                value={formMgrArea}
                                onChange={e => setFormMgrArea(e.target.value)}
                            >
                                <option value="">-- Pilih --</option>
                                {users.map(u => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-grey mb-1">QS Manager</label>
                            <select 
                                className="w-full p-2 border border-grey/40 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-biru"
                                value={formMgrQs}
                                onChange={e => setFormMgrQs(e.target.value)}
                            >
                                <option value="">-- Pilih --</option>
                                {users.map(u => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* PIC CAPA Section */}
                    <div className="bg-grey/5 p-4 rounded-lg border border-grey/10">
                        <h5 className="text-sm font-bold text-biru flex items-center gap-2 mb-3">
                            <UserCog className="w-4 h-4" /> Delegasi PIC CAPA (Per Temuan)
                        </h5>
                        <div className="space-y-3">
                            {item.pic_capa_list?.length > 0 ? item.pic_capa_list.map((pic) => (
                                <div key={pic.temuan_id} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center border-b border-grey/10 pb-3 last:border-0 last:pb-0">
                                    <div className="md:col-span-7">
                                        <p className="text-[10px] font-bold text-grey uppercase">Temuan</p>
                                        <p className="text-xs text-hitam font-medium line-clamp-2 italic">"{pic.deskripsi_temuan}"</p>
                                    </div>
                                    <div className="md:col-span-5">
                                        <label className="text-[10px] font-bold text-grey uppercase mb-1 block">PIC Saat Ini: <span className="text-biru">{pic.pic_name}</span></label>
                                        <select 
                                            className="w-full p-1.5 border border-grey/40 rounded text-xs bg-white focus:ring-1 focus:ring-biru focus:outline-none"
                                            onChange={(e) => handlePicChange(pic.temuan_id, e.target.value)}
                                            value={picCapaChanges[pic.temuan_id] || ''}
                                        >
                                            <option value="">-- Delegasikan ke --</option>
                                            {users.map(u => (
                                                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            )) : <p className="text-xs text-grey italic">Tidak ada data temuan untuk audit ini.</p>}
                        </div>
                    </div>

                    <div className="flex justify-end space-x-2 pt-4 border-t border-grey/10">
                        <button 
                            type="button" 
                            onClick={onClose} 
                            disabled={isSaving}
                            className="px-4 py-2 font-bold text-hitam rounded bg-grey/30 hover:bg-grey/40 text-sm disabled:opacity-50"
                        >
                            Batal
                        </button>
                        <button 
                            type="submit" 
                            disabled={isSaving}
                            className="px-4 py-2 font-bold text-putih rounded bg-biru hover:bg-biru/90 text-sm disabled:bg-biru/50"
                        >
                            {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

// --- Main Page Component ---
export default function DelegationPage() {
    const [list, setList] = useState<DelegationItem[]>([])
    const [users, setUsers] = useState<UserOption[]>([])
    const [isLoading, setIsLoading] = useState(true)
    
    const [searchTerm, setSearchTerm] = useState('')
    const [filterArea, setFilterArea] = useState('')
    const [filterSite, setFilterSite] = useState('')
    const [filterJenis, setFilterJenis] = useState('')

    const [selectedAudit, setSelectedAudit] = useState<DelegationItem | null>(null)

    const initData = async () => {
        try {
            setIsLoading(true)
            const resAudit = await fetchWithAuth('/api/setting/delegation/list', { cache: 'no-store' })
            const dataAudit = await resAudit.json()
            
            const resUsers = await fetchWithAuth('/api/users', { cache: 'no-store' })
            const dataUsers = await resUsers.json()
            
            const userOpts = (Array.isArray(dataUsers) ? dataUsers : dataUsers.data).map((u: any) => ({
                id: u.user_id || u.id,
                name: u.nama_lengkap || u.name,
                role: u.role || ''
            }))

            const mappedList = (dataAudit.data || []).map((item: any) => ({
                ...item,
                site_name: item.site_name || item.nama_site || '-', 
                jenis_audit: item.jenis_audit || item.nama_jenis_audit || item.nama_jenis || '-',
                no_fta: item.no_fta || '-',
                pic_capa_list: item.pic_capa_list || [] 
            }))

            setList(mappedList)
            setUsers(userOpts)
        } catch (e) {
            console.error(e)
            toast.error("Gagal memuat data delegation")
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => { initData() }, [])

    const uniqueAreas = useMemo(() => Array.from(new Set(list.map(i => i.nama_area).filter(Boolean))).sort(), [list])
    const uniqueSites = useMemo(() => Array.from(new Set(list.map(i => i.site_name).filter(Boolean))).sort(), [list])
    const uniqueJenis = useMemo(() => Array.from(new Set(list.map(i => i.jenis_audit).filter(Boolean))).sort(), [list])

    const filteredList = list.filter(item => {
        const term = searchTerm.toLowerCase()
        const matchSearch = term === '' || 
            item.no_fta.toLowerCase().includes(term) ||
            item.qs_spv_name?.toLowerCase().includes(term) ||
            item.mgr_area_name?.toLowerCase().includes(term) ||
            item.pic_capa_list?.some(p => p.pic_name.toLowerCase().includes(term))

        const matchArea = filterArea === '' || item.nama_area === filterArea
        const matchSite = filterSite === '' || item.site_name === filterSite
        const matchJenis = filterJenis === '' || item.jenis_audit === filterJenis

        return matchSearch && matchArea && matchSite && matchJenis
    })

    return (
        <div className="font-['Arial'] pb-20">
            <Toaster position="top-center" reverseOrder={false} />
            
            <DelegationFilters 
                searchTerm={searchTerm} setSearchTerm={setSearchTerm}
                filterArea={filterArea} setFilterArea={setFilterArea}
                filterSite={filterSite} setFilterSite={setFilterSite}
                filterJenis={filterJenis} setFilterJenis={setFilterJenis}
                uniqueAreas={uniqueAreas} uniqueSites={uniqueSites} uniqueJenis={uniqueJenis}
                onRefresh={initData} 
            />

            <div className="bg-putih p-6 rounded-lg shadow-md">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-hitam">Delegation Approval Configuration</h3>
                    <div className="text-xs text-grey font-medium bg-grey/10 px-3 py-1 rounded-full">
                        Total: {filteredList.length} Item
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-grey/40">
                        <thead className="bg-grey/10 font-bold uppercase text-[10px] tracking-wider text-grey">
                            <tr>
                                <th className="px-6 py-4 text-left">No FTA</th>
                                <th className="px-6 py-4 text-left">Site</th>
                                <th className="px-6 py-4 text-left">Jenis Audit</th>
                                <th className="px-6 py-4 text-left">Area</th>
                                <th className="px-6 py-4 text-left w-1/3">Current Approver Info</th>
                                <th className="px-6 py-4 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="bg-putih divide-y divide-grey/40">
                            {isLoading ? (
                                <tr><td colSpan={6} className="text-center py-10 text-grey">Loading data...</td></tr>
                            ) : filteredList.length > 0 ? (
                                filteredList.map((item) => (
                                    <tr key={item.pelaksanaan_id} className="hover:bg-grey/5 transition-colors group">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-hitam">{item.no_fta}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-hitam">{item.site_name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-hitam italic">{item.jenis_audit}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-hitam font-medium">{item.nama_area}</td>
                                        <td className="px-6 py-4">
                                            <div className="text-xs space-y-1">
                                                <div className="flex justify-between border-b border-grey/10 pb-1">
                                                    <span className="text-grey font-bold uppercase text-[10px]">QS SPV:</span>
                                                    <span className="font-medium text-hitam">{item.qs_spv_name || '-'}</span>
                                                </div>
                                                <div className="flex justify-between border-b border-grey/10 pb-1">
                                                    <span className="text-grey font-bold uppercase text-[10px]">Mgr Area:</span>
                                                    <span className="font-medium text-hitam">{item.mgr_area_name || '-'}</span>
                                                </div>
                                                <div className="flex flex-col pt-1 bg-biru/5 p-1 rounded">
                                                    <span className="text-biru font-bold uppercase text-[10px] flex items-center gap-1">
                                                        <UserCog className="w-3 h-3" /> PIC CAPA:
                                                    </span>
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {item.pic_capa_list?.map((p, idx) => (
                                                            <span key={idx} className="bg-white border border-biru/20 text-biru px-1.5 py-0.5 rounded-sm font-bold text-[9px]">
                                                                {p.pic_name}
                                                            </span>
                                                        )) || '-'}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <button 
                                                onClick={() => setSelectedAudit(item)} 
                                                className="text-grey hover:text-biru bg-white border border-grey/30 p-2 rounded shadow-sm hover:shadow transition-all"
                                                title="Edit Delegation"
                                            >
                                                <Edit className="w-5 h-5" strokeWidth={2.5} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan={6} className="text-center py-10 text-grey">Data tidak ditemukan.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedAudit && (
                <EditDelegationModal
                    item={selectedAudit}
                    users={users}
                    onClose={() => setSelectedAudit(null)}
                    onSuccess={initData}
                />
            )}
        </div>
    )
}