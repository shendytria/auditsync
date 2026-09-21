'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, ArrowRightCircle, Edit, Trash2, AlertTriangle } from 'lucide-react';
import { toast, Toaster } from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { fetchWithAuth } from '@/utils/api';
import { getStatusColor, getStatusLabel } from '@/utils/statusHelper'; // [UPDATE] Import Helper Status

// ==========================================
// 1. TYPES & INTERFACES
// ==========================================
interface Site { site_id: number; nama_site: string; }
interface DropdownJenisAudit { jenis_audit_id: number; nama_jenis_audit: string; }
interface DropdownDept { department_id: number; nama_department: string; }
interface DropdownArea { area_id: number; nama_area: string; department_id: number | null; jenis_audit_id: number | null; }
interface User { id: number; nama_lengkap: string; }

// Interface Utama untuk List
interface AuditAktif { 
    id: number; 
    site: string; 
    jenisAudit: string; 
    department: string; 
    area: string; 
    auditor: string; 
    status: string; // [UPDATE] Backend mengirim RAW status (EXEC_OPEN, dll)
    tanggal_dibuat: string; 
    pembuat: string; 
    created_by: number; 
    auditor_ids: number[];
}

interface AuditDetailRaw { site_id: number; jenis_audit_id: number; department_id: number | null; area_id: number; auditor_ids: number[]; }

// ==========================================
// 2. COMPONENT: FILTER
// ==========================================
const AuditFilters = ({ allJenisAudits, allDepts, allAreas, listSite, onFilterChange, onReset }: { allJenisAudits: DropdownJenisAudit[], allDepts: DropdownDept[], allAreas: DropdownArea[], listSite: Site[], onFilterChange: (filters: any) => void, onReset: () => void }) => {
    const [site, setSite] = useState('');
    const [jenisAudit, setJenisAudit] = useState('');
    const [department, setDepartment] = useState('');
    const [area, setArea] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    const deptOptions = useMemo(() => {
        if (!jenisAudit) return allDepts;
        const validDeptIds = new Set(
            allAreas
                .filter(a => a.jenis_audit_id === parseInt(jenisAudit))
                .map(a => a.department_id)
        );
        return allDepts.filter(d => validDeptIds.has(d.department_id));
    }, [jenisAudit, allAreas, allDepts]);

    const areaOptions = useMemo(() => {
        let filteredAreas = allAreas;
        if (jenisAudit) {
            filteredAreas = filteredAreas.filter(a =>
                a.jenis_audit_id === parseInt(jenisAudit)
            );
        }
        if (department) {
            const deptId = department === "null" ? null : parseInt(department);
            filteredAreas = filteredAreas.filter(a =>
                a.department_id === deptId
            );
        }
        return filteredAreas;
    }, [jenisAudit, department, allAreas]);

    const handleFilter = () => { onFilterChange({ site, jenisAudit, department, area, searchQuery }); };
    const handleReset = () => { setSite(''); setJenisAudit(''); setDepartment(''); setArea(''); setSearchQuery(''); onReset(); };
    const handleJenisAuditChange = (e: React.ChangeEvent<HTMLSelectElement>) => { setJenisAudit(e.target.value); setDepartment(''); setArea(''); };
    const handleDepartmentChange = (e: React.ChangeEvent<HTMLSelectElement>) => { setDepartment(e.target.value); setArea(''); };

    return (
        <div className="bg-putih p-4 rounded-lg shadow-md mb-6 font-arial">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                {/* Filter Site */}
                <div>
                    <label className="block text-sm font-medium text-grey">Site</label>
                    <select value={site} onChange={(e) => setSite(e.target.value)} className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru">
                        <option value="">Semua Site</option>
                        {listSite.map(s => <option key={s.site_id} value={s.site_id}>{s.nama_site}</option>)}
                    </select>
                </div>

                {/* Filter Jenis Audit */}
                <div>
                    <label className="block text-sm font-medium text-grey">Jenis Audit</label>
                    <select value={jenisAudit} onChange={handleJenisAuditChange} className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru">
                        <option value="">Semua Jenis</option>
                        {allJenisAudits.map(j => <option key={j.jenis_audit_id} value={j.jenis_audit_id}>{j.nama_jenis_audit}</option>)}
                    </select>
                </div>

                {/* Filter Department */}
                <div>
                    <label className="block text-sm font-medium text-grey">Department</label>
                    <select value={department} onChange={handleDepartmentChange} className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru">
                        <option value="">Semua Dept</option>
                        {deptOptions.map(d => <option key={d.department_id} value={d.department_id}>{d.nama_department}</option>)}
                        {jenisAudit && <option value="null">(Tanpa Dept)</option>}
                    </select>
                </div>

                {/* Filter Area */}
                <div>
                    <label className="block text-sm font-medium text-grey">Area Audit</label>
                    <select value={area} onChange={(e) => setArea(e.target.value)} className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru">
                        <option value="">Semua Area</option>
                        {areaOptions.map(a => <option key={a.area_id} value={a.area_id}>{a.nama_area}</option>)}
                    </select>
                </div>

                {/* Search */}
                <div>
                    <label className="block text-sm font-medium text-grey">Search</label>
                    <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search..." className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru" />
                </div>

                {/* Tombol Aksi */}
                <div className="flex items-end space-x-2">
                    <button onClick={handleFilter} className="flex-1 px-4 py-2 font-bold text-putih rounded bg-biru hover:bg-biru/90 transition-opacity">Filter</button>
                    <button onClick={handleReset} className="flex-1 px-4 py-2 font-bold text-hitam rounded bg-grey/30 hover:bg-grey/40 transition-opacity">Refresh</button>
                </div>
            </div>
        </div>
    );
};

// ==========================================
// 3. COMPONENT: MODAL ADD AUDIT
// ==========================================
const AddAuditModal = ({ onClose, onRefresh, allJenisAudits, allDepts, allAreas, listAuditors, listSite }: { onClose: () => void, onRefresh: () => void, allJenisAudits: DropdownJenisAudit[], allDepts: DropdownDept[], allAreas: DropdownArea[], listAuditors: User[], listSite: Site[] }) => {
    const { user } = useAuthStore();
    const [selectedJenisAudit, setSelectedJenisAudit] = useState('');
    const [selectedDept, setSelectedDept] = useState('');
    const [selectedArea, setSelectedArea] = useState('');
    const [selectedSite, setSelectedSite] = useState('');
    const [selectedAuditors, setSelectedAuditors] = useState<string[]>([]);

    const deptOptions = useMemo(() => {
        if (!selectedJenisAudit) return [];
        const validDeptIds = new Set(allAreas.filter(a => a.jenis_audit_id === parseInt(selectedJenisAudit)).map(a => a.department_id));
        return allDepts.filter(d => validDeptIds.has(d.department_id));
    }, [selectedJenisAudit, allAreas, allDepts]);

    const areaOptions = useMemo(() => {
        if (!selectedJenisAudit) return [];
        let filtered = allAreas.filter(a => a.jenis_audit_id === parseInt(selectedJenisAudit));
        if (selectedDept) {
            const deptId = selectedDept === "null" ? null : parseInt(selectedDept);
            filtered = filtered.filter(a => a.department_id === deptId);
        }
        return filtered;
    }, [selectedJenisAudit, selectedDept, allAreas]);

    const handleJenisAuditChange = (e: React.ChangeEvent<HTMLSelectElement>) => { setSelectedJenisAudit(e.target.value); setSelectedDept(''); setSelectedArea(''); };
    const handleDepartmentChange = (e: React.ChangeEvent<HTMLSelectElement>) => { setSelectedDept(e.target.value); setSelectedArea(''); };

    const handleAddAuditor = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        if (val && !selectedAuditors.includes(val)) {
            if (selectedAuditors.length >= 5) { toast.error("Maksimal 5 auditor."); return; }
            setSelectedAuditors([...selectedAuditors, val]);
        }
    };
    const handleRemoveAuditor = (idToRemove: string) => { setSelectedAuditors(selectedAuditors.filter(id => id !== idToRemove)); };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const dataToSend = { site_id: parseInt(selectedSite, 10), jenis_audit_id: parseInt(selectedJenisAudit, 10), department_id: selectedDept === "null" ? null : parseInt(selectedDept, 10), area_id: parseInt(selectedArea, 10), auditor_ids: selectedAuditors.map(id => parseInt(id, 10)), created_by: Number(user?.id)};
        if (!dataToSend.site_id || !dataToSend.jenis_audit_id || !dataToSend.area_id || selectedAuditors.length === 0 || !selectedDept) { toast.error("Semua field wajib diisi."); return; }
        try {
            const response = await fetchWithAuth('/api/audit/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dataToSend), });
            if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error || 'Gagal membuat audit baru'); }
            toast.success('Audit baru berhasil dibuat!'); onClose(); onRefresh();
        } catch (error: any) { toast.error(`Error: ${error.message}`); }
    };

    return (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-hitam/50">
            <div className="bg-putih p-6 rounded-lg shadow-xl w-full max-w-lg">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="text-xl font-bold text-hitam">Buat Audit Baru</h4>
                    <button onClick={onClose} className="text-grey hover:text-hitam"><X className="w-6 h-6" /></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-grey">Site</label>
                        <select value={selectedSite} onChange={(e) => setSelectedSite(e.target.value)} required className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru">
                            <option value="">Pilih Site</option>
                            {listSite.map(s => <option key={s.site_id} value={s.site_id}>{s.nama_site}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-grey">Jenis Audit</label>
                        <select value={selectedJenisAudit} onChange={handleJenisAuditChange} required className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru">
                            <option value="">1. Pilih Jenis Audit</option>
                            {allJenisAudits.map(j => <option key={j.jenis_audit_id} value={j.jenis_audit_id}>{j.nama_jenis_audit}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-grey">Department</label>
                        <select value={selectedDept} onChange={handleDepartmentChange} disabled={!selectedJenisAudit} required className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru disabled:bg-grey/10">
                            <option value="">2. Pilih Department</option>
                            {deptOptions.map(d => <option key={d.department_id} value={d.department_id}>{d.nama_department}</option>)}
                            {selectedJenisAudit && <option value="null">(Tanpa Department)</option>}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-grey">Area Audit</label>
                        <select value={selectedArea} onChange={(e) => setSelectedArea(e.target.value)} disabled={!selectedDept} required className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru disabled:bg-grey/10">
                            <option value="">3. Pilih Area Audit</option>
                            {areaOptions.map(a => <option key={a.area_id} value={a.area_id}>{a.nama_area}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-grey mb-1">Auditor (Max 5)</label>
                        <select onChange={handleAddAuditor} value="" disabled={selectedAuditors.length >= 5} className="w-full p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru disabled:bg-grey/10">
                            <option value="">+ Tambah Auditor</option>
                            {listAuditors.map(a => (<option key={a.id} value={a.id.toString()} disabled={selectedAuditors.includes(a.id.toString())}>{a.nama_lengkap}</option>))}
                        </select>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {selectedAuditors.map(auditId => {
                                const auditor = listAuditors.find(a => a.id.toString() === auditId);
                                return (
                                    <span key={auditId} className="inline-flex items-center px-2 py-1 rounded bg-biru/10 text-biru text-sm font-medium">
                                        {auditor?.nama_lengkap}
                                        <button type="button" onClick={() => handleRemoveAuditor(auditId)} className="ml-2 text-biru hover:text-red-600"> <X className="w-3 h-3" /> </button>
                                    </span>
                                );
                            })}
                        </div>
                    </div>
                    <div className="flex justify-end space-x-2 pt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 font-bold text-hitam rounded bg-grey/30 hover:bg-grey/40">Batal</button>
                        <button type="submit" className="px-4 py-2 font-bold text-putih rounded bg-biru hover:bg-biru/90">Buat Audit</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ==========================================
// 4. COMPONENT: MODAL EDIT AUDIT
// ==========================================
const EditAuditModal = ({ onClose, onRefresh, audit, allJenisAudits, allDepts, allAreas, listAuditors, listSite }: { onClose: () => void; onRefresh: () => void; audit: AuditAktif; allJenisAudits: DropdownJenisAudit[]; allDepts: DropdownDept[]; allAreas: DropdownArea[]; listAuditors: User[]; listSite: Site[]; }) => {
    const [selectedJenisAudit, setSelectedJenisAudit] = useState('');
    const [selectedDept, setSelectedDept] = useState<string | null>('');
    const [selectedArea, setSelectedArea] = useState('');
    const [selectedSite, setSelectedSite] = useState('');
    const [selectedAuditors, setSelectedAuditors] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        setIsLoading(true);
        fetchWithAuth(`/api/audit/${audit.id}`, { cache: 'no-store' })
            .then(res => res.json())
            .then(result => {
                if (result.error) throw new Error(result.error);
                const data = result.data as AuditDetailRaw;
                setSelectedSite(data.site_id.toString());
                setSelectedJenisAudit(data.jenis_audit_id.toString());
                setSelectedDept(data.department_id === null ? "null" : data.department_id.toString());
                setSelectedArea(data.area_id.toString());
                setSelectedAuditors(data.auditor_ids ? data.auditor_ids.map(id => id.toString()) : []);
            })
            .catch(err => toast.error(`Gagal memuat data edit: ${err.message}`))
            .finally(() => setIsLoading(false));
    }, [audit.id]);

    const deptOptions = useMemo(() => {
        if (!selectedJenisAudit) return [];
        const validDeptIds = new Set(allAreas.filter(a => a.jenis_audit_id === parseInt(selectedJenisAudit)).map(a => a.department_id));
        return allDepts.filter(d => validDeptIds.has(d.department_id));
    }, [selectedJenisAudit, allAreas, allDepts]);

    const areaOptions = useMemo(() => {
        if (!selectedJenisAudit) return [];
        let filtered = allAreas.filter(a => a.jenis_audit_id === parseInt(selectedJenisAudit));
        if (selectedDept) {
            const deptId = selectedDept === "null" ? null : parseInt(selectedDept);
            filtered = filtered.filter(a => a.department_id === deptId);
        }
        return filtered;
    }, [selectedJenisAudit, selectedDept, allAreas]);

    const handleJenisAuditChange = (e: React.ChangeEvent<HTMLSelectElement>) => { setSelectedJenisAudit(e.target.value); setSelectedDept(''); setSelectedArea(''); };
    const handleDepartmentChange = (e: React.ChangeEvent<HTMLSelectElement>) => { setSelectedDept(e.target.value); setSelectedArea(''); };
    const handleAddAuditor = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        if (val && !selectedAuditors.includes(val) && selectedAuditors.length < 5) { setSelectedAuditors([...selectedAuditors, val]); }
    };
    const handleRemoveAuditor = (idToRemove: string) => { setSelectedAuditors(selectedAuditors.filter(id => id !== idToRemove)); };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const dataToSend = { site_id: parseInt(selectedSite, 10), jenis_audit_id: parseInt(selectedJenisAudit, 10), department_id: selectedDept === "null" ? null : (selectedDept ? parseInt(selectedDept, 10) : null), area_id: parseInt(selectedArea, 10), auditor_ids: selectedAuditors.map(id => parseInt(id, 10)),  };
        if (!dataToSend.site_id || !dataToSend.jenis_audit_id || !dataToSend.area_id || selectedAuditors.length === 0 || !selectedDept) { toast.error("Semua field wajib diisi."); return; }
        
        try {
            const response = await fetchWithAuth(`/api/audit/${audit.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dataToSend), });
            if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error || 'Gagal memperbarui audit'); }
            toast.success('Audit berhasil diperbarui!');
            onClose(); onRefresh();
        } catch (error: any) { toast.error(`Error: ${error.message}`); }
    };

    return (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-hitam/50">
            <div className="bg-putih p-6 rounded-lg shadow-xl w-full max-w-lg">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="text-xl font-bold text-hitam">Edit Audit (ID: {audit.id})</h4>
                    <button onClick={onClose} className="text-grey hover:text-hitam"><X className="w-6 h-6" /></button>
                </div>
                {isLoading ? (
                    <p className="text-center text-grey py-8">Memuat data...</p>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-grey">Site</label>
                            <select name="site" value={selectedSite} onChange={(e) => setSelectedSite(e.target.value)} required className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru">
                                <option value="">Pilih Site</option>
                                {listSite.map(s => <option key={s.site_id} value={s.site_id}>{s.nama_site}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-grey">Jenis Audit</label>
                            <select name="jenisAudit" value={selectedJenisAudit} onChange={handleJenisAuditChange} required className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru">
                                <option value="">1. Pilih Jenis Audit</option>
                                {allJenisAudits.map(j => <option key={j.jenis_audit_id} value={j.jenis_audit_id}>{j.nama_jenis_audit}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-grey">Department</label>
                            <select name="department" value={selectedDept || ''} onChange={handleDepartmentChange} required className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru">
                                <option value="">2. Pilih Department</option>
                                {deptOptions.map(d => <option key={d.department_id} value={d.department_id}>{d.nama_department}</option>)}
                                {selectedJenisAudit && <option value="null">(Tanpa Department)</option>}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-grey">Area Audit</label>
                            <select name="area" value={selectedArea} onChange={(e) => setSelectedArea(e.target.value)} required className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru">
                                <option value="">3. Pilih Area Audit</option>
                                {areaOptions.map(a => <option key={a.area_id} value={a.area_id}>{a.nama_area}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-grey mb-1">Auditor (Max 5)</label>
                            <select onChange={handleAddAuditor} value="" disabled={selectedAuditors.length >= 5} className="w-full p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru disabled:bg-grey/10">
                                <option value="">+ Tambah Auditor</option>
                                {listAuditors.map(a => (<option key={a.id} value={a.id.toString()} disabled={selectedAuditors.includes(a.id.toString())}>{a.nama_lengkap}</option>))}
                            </select>
                            <div className="flex flex-wrap gap-2 mt-2">
                                {selectedAuditors.map(auditId => {
                                    const auditor = listAuditors.find(a => a.id.toString() === auditId);
                                    return (
                                        <span key={auditId} className="inline-flex items-center px-2 py-1 rounded bg-biru/10 text-biru text-sm font-medium">
                                            {auditor?.nama_lengkap}
                                            <button type="button" onClick={() => handleRemoveAuditor(auditId)} className="ml-2 text-biru hover:text-red-600"> <X className="w-3 h-3" /> </button>
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="flex justify-end space-x-2 pt-4">
                            <button type="button" onClick={onClose} className="px-4 py-2 font-bold text-hitam rounded bg-grey/30 hover:bg-grey/40">Batal</button>
                            <button type="submit" className="px-4 py-2 font-bold text-putih rounded bg-biru hover:bg-biru/90">Simpan Perubahan</button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

// ==========================================
// 5. COMPONENT: MODAL CONFIRM DELETE
// ==========================================
const ConfirmDeleteModal = ({ audit, onClose, onConfirm, isLoading }: { audit: AuditAktif; onClose: () => void; onConfirm: () => void; isLoading: boolean; }) => {
    return (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-hitam/50">
            <div className="bg-putih p-6 rounded-lg shadow-xl w-full max-w-md">
                <div className="flex">
                    <div className="mr-4 flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                        <AlertTriangle className="h-6 w-6 text-red-600" />
                    </div>
                    <div>
                        <h4 className="text-xl font-bold text-hitam">Hapus Audit</h4>
                        <p className="text-sm text-grey mt-1"> Anda yakin ingin menghapus audit untuk area **{audit.area}**? </p>
                        <p className="text-xs text-hitam mt-2"> Tindakan ini bersifat permanen dan akan menghapus semua temuan terkait. </p>
                    </div>
                </div>
                <div className="flex justify-end space-x-2 pt-6">
                    <button type="button" onClick={onClose} disabled={isLoading} className="px-4 py-2 font-bold text-hitam rounded bg-grey/30 hover:bg-grey/40 disabled:opacity-50"> Batal </button>
                    <button type="button" onClick={onConfirm} disabled={isLoading} className="px-4 py-2 font-bold text-putih rounded bg-hitam hover:bg-hitam/80 disabled:bg-hitam/40">
                        {isLoading ? "Menghapus..." : "Ya, Hapus"}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ==========================================
// 6. MAIN PAGE: PELAKSANAAN AUDIT
// ==========================================
export default function PelaksanaanAuditPage() {
    const { user } = useAuthStore();
    const [filters, setFilters] = useState<any>({}); 
    const [listAuditAktif, setListAuditAktif] = useState<AuditAktif[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    const [listSite, setListSite] = useState<Site[]>([]);
    const [listJenisAudit, setListJenisAudit] = useState<DropdownJenisAudit[]>([]);
    const [listDepts, setListDepts] = useState<DropdownDept[]>([]);
    const [listAreas, setListAreas] = useState<DropdownArea[]>([]);
    const [listAuditors, setListAuditors] = useState<User[]>([]);

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedAudit, setSelectedAudit] = useState<AuditAktif | null>(null);
    const [isDeleteLoading, setIsDeleteLoading] = useState(false);

    const fetchAuditAktif = useCallback((currentFilters: any = {}) => {
        setIsLoading(true);
        const params = new URLSearchParams();
        if (currentFilters.site) params.append('site_id', currentFilters.site);
        if (currentFilters.jenisAudit) params.append('jenis_audit_id', currentFilters.jenisAudit);
        if (currentFilters.department) params.append('department_id', currentFilters.department);
        if (currentFilters.area) params.append('area_id', currentFilters.area);
        if (currentFilters.searchQuery) params.append('search', currentFilters.searchQuery);

        const API_URL = `/api/audit/aktif?${params.toString()}`;

        fetchWithAuth(API_URL, { cache: 'no-store' })
            .then(res => {
                if (!res.ok) {
                    console.warn(`Gagal memuat audit aktif: Server merespon ${res.status}`);
                    return { data: [] };
                }
                return res.json();
            })
            .then(result => {
                const rawData = result.data || [];
                setListAuditAktif(rawData);
            })
            .catch(err => {
                console.error("Fetch error:", err);
                setListAuditAktif([]);
            })
            .finally(() => setIsLoading(false));
    }, []);

    const fetchDropdownData = () => {
        Promise.all([
            fetchWithAuth('/api/setting/sites', { cache: 'no-store' }),
            fetchWithAuth('/api/setting/areas/all-relations', { cache: 'no-store' }),
            fetchWithAuth('/api/setting/jenis_audit', { cache: 'no-store' }),
            fetchWithAuth('/api/users', { cache: 'no-store' }),
            fetchWithAuth('/api/setting/departments', { cache: 'no-store' })
        ])
            .then(async ([resSites, resAreas, resJenisAudit, resAuditors, resDepts]) => {
                const dataSites = await resSites.json();
                const dataAreas = await resAreas.json();
                const dataJenisAudit = await resJenisAudit.json();
                const dataAuditors = await resAuditors.json();
                const dataDepts = await resDepts.json();

                setListSite(dataSites.data || []);
                setListAreas(dataAreas.data || []);
                setListJenisAudit(dataJenisAudit.data || []);
                setListAuditors(dataAuditors.data || []);
                setListDepts(dataDepts.data || []);
            })
            .catch(err => {
                console.error("Gagal memuat data dropdown:", err);
                toast.error("Gagal memuat data filter, periksa koneksi ke API.");
            });
    };

    useEffect(() => {
        fetchDropdownData();
    }, []);

    useEffect(() => {
        fetchAuditAktif(filters);
    }, [filters, fetchAuditAktif]);

    const handleFilterChange = (newFilters: any) => {
        setFilters(newFilters); 
    };
    
    const handleLaksanakan = (auditId: number) => {
        router.push(`/checklist/pelaksanaan-audit/${auditId}`);
    };
    
    const handleEditAudit = (audit: AuditAktif) => {
        setSelectedAudit(audit);
        setIsEditModalOpen(true);
    };

    const handleDeleteAudit = (audit: AuditAktif) => {
        setSelectedAudit(audit);
        setIsDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!selectedAudit) return;
        
        setIsDeleteLoading(true);
        try {
            const response = await fetchWithAuth(`/api/audit/${selectedAudit.id}`, { method: 'DELETE', });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Gagal menghapus audit');
            }
            toast.success(`Audit untuk area ${selectedAudit.area} berhasil dihapus.`);
            setIsDeleteModalOpen(false);
            setSelectedAudit(null);
            fetchAuditAktif(filters);
        } catch (error: any) {
            toast.error(`Error: ${error.message}`);
        } finally {
            setIsDeleteLoading(false);
        }
    };

    return (
        <div className="bg-putih p-6 rounded-lg shadow-md min-h-[500px] font-arial">
            <Toaster position="top-center" />
            <AuditFilters
                allJenisAudits={listJenisAudit}
                allDepts={listDepts}
                allAreas={listAreas}
                listSite={listSite}
                onFilterChange={handleFilterChange} 
                onReset={() => setFilters({})} 
            />

            <div className="flex justify-between items-center mb-4 mt-6">
                <h3 className="text-xl font-bold text-hitam">Daftar Audit Aktif</h3>
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="flex items-center px-4 py-2 font-bold text-putih rounded bg-biru hover:bg-biru/90 transition-opacity"
                >
                    <Plus className="w-5 h-5 mr-2" />
                    Buat Audit Baru
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-grey/40">
                    <thead className="bg-grey/10">
                        <tr>
                             <th className="px-6 py-3 text-left text-xs font-medium text-grey uppercase tracking-wider">ID</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-grey uppercase tracking-wider">Create Date</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-grey uppercase tracking-wider">Create By</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-grey uppercase tracking-wider">Site</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-grey uppercase tracking-wider">Jenis Audit</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-grey uppercase tracking-wider">Department</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-grey uppercase tracking-wider">Area Audit</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-grey uppercase tracking-wider">Auditor</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-grey uppercase tracking-wider">Status</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-grey uppercase tracking-wider">Action</th>
                        </tr>
                    </thead>
                    <tbody className="bg-putih divide-y divide-grey/40">
                        {isLoading ? (
                            <tr>
                                <td colSpan={10} className="px-6 py-4 text-center text-grey">Memuat data audit...</td>
                            </tr>
                        ) : (listAuditAktif.length === 0 ? (
                            <tr>
                                <td colSpan={10} className="px-6 py-4 text-center text-grey">Tidak ada audit aktif yang ditemukan.</td>
                            </tr>
                        ) : (
                            listAuditAktif.map((audit) => {
                                const currentUserId = Number(user?.id);
                                const isCreator = user && Number(user.id) === audit.created_by;
                                const isAuditor = user && audit.auditor_ids && audit.auditor_ids.includes(currentUserId);

                                return (
                                    <tr key={audit.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-hitam">#{audit.id}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-hitam">{audit.tanggal_dibuat}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-hitam capitalize">{audit.pembuat}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-hitam">{audit.site}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-hitam">{audit.jenisAudit}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-hitam">{audit.department}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-hitam">{audit.area}</td>
                                        <td className="px-6 py-4 text-sm text-hitam max-w-xs truncate" title={audit.auditor}>{audit.auditor}</td>
                                        
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {/* [UPDATE] Menggunakan Helper Status */}
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(audit.status)}`}>
                                                {getStatusLabel(audit.status)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            <div className="flex space-x-2">
                                                
                                                {/* TOMBOL LAKSANAKAN AUDIT */}
                                                {isAuditor && (
                                                    <button 
                                                        onClick={() => handleLaksanakan(audit.id)} 
                                                        title="Laksanakan Audit" 
                                                        className="text-grey hover:text-hijau/80"
                                                    >
                                                        <ArrowRightCircle className="w-5 h-5" />
                                                    </button>
                                                )}

                                                {/* Jika bukan auditor, tampilkan info disabled */}
                                                {!isAuditor && (
                                                    <span className="text-xs text-grey/30 flex items-center cursor-not-allowed" title="Anda bukan auditor untuk area ini">
                                                        <ArrowRightCircle className="w-5 h-5 opacity-20" />
                                                    </span>
                                                )}

                                                {/* TOMBOL EDIT & DELETE (Hanya Creator) */}
                                                {isCreator && (
                                                    <>
                                                        <button onClick={() => handleEditAudit(audit)} title="Edit Audit" className="text-grey hover:text-biru/80">
                                                            <Edit className="w-5 h-5" />
                                                        </button>
                                                        <button onClick={() => handleDeleteAudit(audit)} title="Hapus Audit" className="text-grey hover:text-red/80">
                                                            <Trash2 className="w-5 h-5" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modals */}
            {isAddModalOpen && (
                <AddAuditModal
                    onClose={() => setIsAddModalOpen(false)}
                    onRefresh={() => fetchAuditAktif(filters)}
                    allJenisAudits={listJenisAudit}
                    allDepts={listDepts}
                    allAreas={listAreas}
                    listAuditors={listAuditors}
                    listSite={listSite}
                />
            )}

            {isEditModalOpen && selectedAudit && (
                <EditAuditModal
                    onClose={() => setIsEditModalOpen(false)}
                    onRefresh={() => fetchAuditAktif(filters)}
                    audit={selectedAudit}
                    allJenisAudits={listJenisAudit}
                    allDepts={listDepts}
                    allAreas={listAreas}
                    listAuditors={listAuditors}
                    listSite={listSite}
                />
            )}

            {isDeleteModalOpen && selectedAudit && (
                <ConfirmDeleteModal
                    audit={selectedAudit}
                    onClose={() => setIsDeleteModalOpen(false)}
                    onConfirm={handleConfirmDelete}
                    isLoading={isDeleteLoading}
                />
            )}
        </div>
    );
}