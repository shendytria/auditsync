'use client'

import React, { useState, useEffect, useMemo } from 'react';
import { Eye, X } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';
import { fetchWithAuth } from '@/utils/api'; // [UPDATE] Import fetchWithAuth

interface CheckItem {
    item_id: number;
    item_checklist_text: string;
    referensi_doc: string | null;
    kategori: string | null;
    sub_kategori: string | null;
}
interface DropdownArea {
    area_id: number;
    nama_area: string;
    department_id: number | null; 
    jenis_audit_id: number | null; 
}
interface DropdownDept {
    department_id: number;
    nama_department: string;
}
interface DropdownJenisAudit {
    jenis_audit_id: number;
    nama_jenis_audit: string;
}
interface ChecklistMaster {
    checklist_id: number;
    nama_checklist: string;
    area_audit: string;
    department: string;
    jenis_audit: string;
}

const ChecklistFilters = ({ 
    allAreas, 
    allDepts, 
    allJenisAudits,
    onFilterChange,
    onResetFilters
} : { 
    allAreas: DropdownArea[], 
    allDepts: DropdownDept[], 
    allJenisAudits: DropdownJenisAudit[],
    onFilterChange: (filters: any) => void,
    onResetFilters: () => void
}) => {
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

    const handleFilter = () => {
        onFilterChange({ 
            jenisAudit: jenisAudit, 
            department: department, 
            area: area, 
            searchQuery: searchQuery 
        });
    };
    
    const handleReset = () => {
        setJenisAudit('');
        setDepartment('');
        setArea('');
        setSearchQuery('');
        onResetFilters();
    };
    
    const handleJenisAuditChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setJenisAudit(e.target.value);
        setDepartment('');
        setArea('');
    };
    
    const handleDepartmentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setDepartment(e.target.value);
        setArea('');
    };

    return (
        <div className="bg-putih p-4 rounded-lg shadow-md mb-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                
                {/* Filter Jenis Audit */}
                <div>
                    <label htmlFor="jenisAudit" className="block text-sm font-medium text-grey">Jenis Audit</label>
                    <select id="jenisAudit" value={jenisAudit} onChange={handleJenisAuditChange}
                        className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru">
                        <option value="">Semua Jenis</option>
                        {allJenisAudits.map(ja => <option key={ja.jenis_audit_id} value={ja.jenis_audit_id}>{ja.nama_jenis_audit}</option>)}
                    </select>
                </div>
        
                {/* Filter Department (opsinya dinamis) */}
                <div>
                    <label htmlFor="department" className="block text-sm font-medium text-grey">Department</label>
                    <select 
                        id="department" 
                        value={department} 
                        onChange={handleDepartmentChange}
                        className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru"
                    >
                        <option value="">Semua Department</option>
                        {deptOptions.map(d => <option key={d.department_id} value={d.department_id}>{d.nama_department}</option>)}
                        {jenisAudit && <option value="null">(Tanpa Department)</option>}
                    </select>
                </div>
                
                {/* Filter Area (opsinya dinamis) */}
                <div>
                    <label htmlFor="area" className="block text-sm font-medium text-grey">Area Audit</label>
                    <select 
                        id="area" 
                        value={area} 
                        onChange={(e) => setArea(e.target.value)}
                        className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru"
                    >
                        <option value="">Semua Area</option>
                        {areaOptions.map(a => <option key={a.area_id} value={a.area_id}>{a.nama_area}</option>)}
                    </select>
                </div>

                {/* Search */}
                <div>
                    <label htmlFor="search" className="block text-sm font-medium text-grey">Search</label>
                    <input type="text" id="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder=" Search..."
                        className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru" />
                </div>

                {/* Tombol Aksi */}
                <div className="flex items-end space-x-2">
                    <button onClick={handleFilter} className="flex-1 px-4 py-2 font-bold text-putih rounded bg-biru hover:bg-biru/90 
                    transition-opacity">Filter</button> 
                    <button onClick={handleReset} className="flex-1 px-4 py-2 font-bold text-hitam rounded bg-grey/30 hover:bg-grey/40 transition-opacity">Refresh</button>
                </div>
            </div>
        </div>
    );
};

const ChecklistDetailModal = ({ 
    checklist, 
    onClose 
}: { 
    checklist: ChecklistMaster | null, 
    onClose: () => void 
}) => {
    const [checkItems, setCheckItems] = useState<CheckItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    const fetchItems = () => {
        if (!checklist) return; 
        
        setIsLoading(true);
        // [UPDATE] Menggunakan fetchWithAuth
        fetchWithAuth(`/api/setting/checklists/${checklist.checklist_id}/items`, { cache: 'no-store' })
            .then(res => res.json())
            .then(result => setCheckItems(result.data || []))
            .catch(err => toast.error("Terjadi kesalahan saat mengambil detail item."))
            .finally(() => setIsLoading(false));
    };
    
    useEffect(() => {
        fetchItems();
    }, [checklist]);

    const groupedItems = useMemo(() => {
        const groups = new Map<string, Map<string, CheckItem[]>>();
        const KATEGORI_UMUM = "Lain-lain";
        const SUB_KATEGORI_UMUM = "Umum";
        for (const item of checkItems) {
            const kategori = item.kategori || KATEGORI_UMUM;
            let subKategori: string;
            if (kategori === KATEGORI_UMUM) {
                subKategori = SUB_KATEGORI_UMUM;
            } else {
                subKategori = item.sub_kategori || SUB_KATEGORI_UMUM;
            }
            if (!groups.has(kategori)) {
                groups.set(kategori, new Map<string, CheckItem[]>());
            }
            const subGroups = groups.get(kategori)!;
            if (!subGroups.has(subKategori)) {
                subGroups.set(subKategori, []);
            }
            const itemsList = subGroups.get(subKategori)!;
            itemsList.push(item);
        }
        return groups;
    }, [checkItems]);

    return (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-hitam/50">
            <div className="bg-putih p-6 rounded-lg shadow-xl w-full max-w-4xl"> 
                <div className="flex justify-between items-center mb-4">
                    <h4 className="text-xl font-bold text-hitam">Detail Check Items ({checklist?.nama_checklist})</h4>
                    <button onClick={onClose} className="text-grey hover:text-hitam">
                        <X className="w-6 h-6" />
                    </button>
                </div>
                
                <div className="overflow-x-auto max-h-[70vh] overflow-y-auto"> 
                    <table className="min-w-full divide-y divide-grey/40">
                        <thead className="bg-gray-100 sticky top-0 z-10">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-grey uppercase tracking-wider w-1/12">No.</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-grey uppercase tracking-wider w-7/12">Check Item</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-grey uppercase tracking-wider w-4/12">Reference document</th>
                            </tr>
                        </thead>
                        
                        <tbody className="bg-putih divide-y divide-grey/40">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={3} className="px-6 py-4 text-center text-grey">Memuat data...</td>
                                </tr>
                            ) : checkItems.length > 0 ? (
                                Array.from(groupedItems.entries()).map(([kategori, subGroups]) => (
                                    <React.Fragment key={kategori}>
                                        <tr className="bg-biru/10">
                                            <td colSpan={3} className="px-4 py-2 text-sm font-bold text-biru">
                                                {kategori}
                                            </td>
                                        </tr>
                                        {Array.from(subGroups.entries()).map(([subKategori, items]) => (
                                            <React.Fragment key={subKategori}>
                                                {subKategori !== "Umum" && (
                                                    <tr className="bg-grey/10">
                                                        <td colSpan={3} className="px-6 py-2 text-sm font-semibold text-hitam">
                                                            {subKategori}
                                                        </td>
                                                    </tr>
                                                )}
                                                {items.map((item, index) => (
                                                    <tr key={item.item_id}>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-hitam">{index + 1}</td>
                                                        <td className="px-6 py-4 whitespace-normal text-sm text-hitam">{item.item_checklist_text}</td>
                                                        <td className="px-6 py-4 whitespace-normal text-sm text-hitam">{item.referensi_doc}</td>
                                                    </tr>
                                                ))}
                                            </React.Fragment>
                                        ))}
                                    </React.Fragment>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={3} className="px-6 py-4 text-center text-grey">
                                        Tidak ada item checklist ditemukan.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};


// --- Halaman Utama "Daftar Checklist" ---
export default function DaftarChecklistPage() {
    const [checklists, setChecklists] = useState<ChecklistMaster[]>([]); 
    const [isLoading, setIsLoading] = useState(true); 
    
    const [allJenisAudits, setAllJenisAudits] = useState<DropdownJenisAudit[]>([]);
    const [allAreas, setAllAreas] = useState<DropdownArea[]>([]);
    const [allDepts, setAllDepts] = useState<DropdownDept[]>([]);
    const [filters, setFilters] = useState<any>({}); 
    
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedChecklist, setSelectedChecklist] = useState<ChecklistMaster | null>(null);

    // FIX: Memberi nilai default {} pada currentFilters di sini
    const fetchChecklists = async (currentFilters: any = {}) => {
        setIsLoading(true);
        const params = new URLSearchParams();
        // FIX: currentFilters dijamin objek, jadi akses properti aman
        if (currentFilters.jenisAudit) params.append('jenis_audit_id', currentFilters.jenisAudit);
        if (currentFilters.department) params.append('department_id', currentFilters.department);
        if (currentFilters.area) params.append('area_id', currentFilters.area);
        if (currentFilters.searchQuery) params.append('search', currentFilters.searchQuery);
        
        // [UPDATE] Menggunakan fetchWithAuth
        const url = `/api/setting/checklists?${params.toString()}`;
        
        try {
            const response = await fetchWithAuth(url, { cache: 'no-store' });
            const result = await response.json();
            if (response.ok) {
                setChecklists(result.data || []); 
            } else {
                throw new Error(result.error || 'Gagal mengambil data');
            }
        } catch (error: any) {
            console.error("Fetch error:", error);
            toast.error(`Error: ${error.message}`);
            setChecklists([]); 
        } finally {
            setIsLoading(false);
        }
    }; 

    // Fetch dropdown data saat komponen dimuat
    useEffect(() => {
        // [UPDATE] Menggunakan fetchWithAuth
        fetchWithAuth('/api/setting/jenis_audit', { cache: 'no-store' })
            .then(res => res.json())
            .then(data => setAllJenisAudits(data.data || []));
        
        fetchWithAuth('/api/setting/areas', { cache: 'no-store' })
            .then(res => res.json())
            .then(data => setAllAreas(data.data || []));
            
        fetchWithAuth('/api/setting/departments', { cache: 'no-store' })
            .then(res => res.json())
            .then(data => setAllDepts(data.data || []));

    }, []);

    // Efek untuk fetch checklist saat filters berubah
    useEffect(() => {
        fetchChecklists(filters);
    }, [filters]); 

    // Handler yang dipanggil oleh ChecklistFilters saat filter di-apply
    const handleFilterChange = (newFilters: any) => {
        setFilters(newFilters);
    };

    // Handler yang dipanggil oleh ChecklistFilters saat Reset
    const handleResetFilters = () => {
        setFilters({});
    };
    
    // Handler untuk menampilkan modal detail
    const handleShowDetails = (checklist: ChecklistMaster) => {
        setSelectedChecklist(checklist);
        setIsDetailModalOpen(true);
    };

    return (
        <>
            <Toaster position="top-center" reverseOrder={false} />
            
            {/* Filter */}
            <ChecklistFilters 
                allAreas={allAreas}
                allDepts={allDepts}
                allJenisAudits={allJenisAudits}
                onFilterChange={handleFilterChange} 
                onResetFilters={handleResetFilters} 
            />

            <div className="bg-putih p-6 rounded-lg shadow-md mt-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-hitam">Daftar Checklist Inspeksi</h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-grey/40">
                        <thead className="bg-grey/10">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-grey uppercase tracking-wider">Nama Checklist</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-grey uppercase tracking-wider">Area Audit</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-grey uppercase tracking-wider">Department</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-grey uppercase tracking-wider">Jenis Audit</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-grey uppercase tracking-wider">Detail</th>
                            </tr>
                        </thead>
                        <tbody className="bg-putih divide-y divide-grey/40">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-10 text-grey">Loading data...</td>
                                </tr>
                            ) : checklists.length > 0 ? (
                                checklists.map((item) => (
                                    <tr key={item.checklist_id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-hitam">{item.nama_checklist}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-hitam">{item.area_audit}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-hitam">{item.department}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-hitam">{item.jenis_audit}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            <button onClick={() => handleShowDetails(item)} className="text-grey hover:text-hijau">
                                                <Eye className="w-5 h-5" strokeWidth={2.5} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="text-center py-10 text-grey">
                                        Data tidak ditemukan.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            
            {isDetailModalOpen && (
                <ChecklistDetailModal 
                    checklist={selectedChecklist} 
                    onClose={() => setIsDetailModalOpen(false)} 
                />
            )}
        </>
    );
}