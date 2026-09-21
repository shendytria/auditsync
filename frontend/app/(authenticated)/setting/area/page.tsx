'use client'

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, X, AlertTriangle } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';
import { fetchWithAuth } from '@/utils/api'; // <--- IMPORT HELPER

interface JenisAudit {
    jenis_audit_id: number;
    nama_jenis_audit: string;
}
interface Department {
    department_id: number;
    nama_department: string;
}
interface Area {
    area_id: number;
    nama_area: string;
    kode_area: string | null;
    jenis_audit: string;
    department: string;
    department_id: number | null;
    jenis_audit_id: number;
}
interface AreaEditData {
    nama_area: string;
    kode_area: string;
    jenis_audit_id: number;
    department_id: number | null;
}

const AreaFilters = ({ onFilterChange }: { onFilterChange: (filters: any) => void }) => {
    const [jenisAudit, setJenisAudit] = useState('');
    const [department, setDepartment] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [listJenisAudit, setListJenisAudit] = useState<JenisAudit[]>([]);
    const [listDept, setListDept] = useState<Department[]>([]);

    // [UPDATE] Gunakan fetchWithAuth
    useEffect(() => {
        fetchWithAuth('/api/setting/jenis_audit', { cache: 'no-store' })
            .then(res => res.json())
            .then(data => setListJenisAudit(data.data || []));

        fetchWithAuth('/api/setting/departments', { cache: 'no-store' })
            .then(res => res.json())
            .then(data => setListDept(data.data || []));
    }, []);

    const handleFilter = () => {
        onFilterChange({ jenisAudit, department, searchQuery });
    };

    const handleReset = () => {
        setJenisAudit('');
        setDepartment('');
        setSearchQuery('');
        onFilterChange({ jenisAudit: '', department: '', searchQuery: '' });
    };

    return (
        <div className="bg-putih p-4 rounded-lg shadow-md mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Filter Jenis Audit */}
                <div>
                    <label htmlFor="jenisAudit" className="block text-sm font-medium text-grey">Jenis Audit</label>
                    <select
                        id="jenisAudit"
                        value={jenisAudit}
                        onChange={(e) => setJenisAudit(e.target.value)}
                        className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru">
                        <option value="">Semua Jenis Audit</option>
                        {listJenisAudit.map(ja => (
                            <option key={ja.jenis_audit_id} value={ja.jenis_audit_id}>
                                {ja.nama_jenis_audit}
                            </option>
                        ))}
                    </select>
                </div>
                {/* Filter Department */}
                <div>
                    <label htmlFor="department" className="block text-sm font-medium text-grey">Department</label>
                    <select id="department" value={department} onChange={(e) => setDepartment(e.target.value)}
                        className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru">
                        <option value="">Semua Department</option>
                        {listDept.map(d => (
                            <option key={d.department_id} value={d.department_id}>{d.nama_department}</option>
                        ))}
                    </select>
                </div>
                {/* Search */}
                <div>
                    <label htmlFor="search" className="block text-sm font-medium text-grey">Search</label>
                    <input
                        type="text"
                        id="search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search..."
                        className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru" />
                </div>
                {/* Tombol Aksi */}
                <div className="flex items-end space-x-2">
                    <button onClick={handleFilter} className="flex-1 px-4 py-2 font-bold text-putih rounded bg-biru hover:bg-biru/90 transition-opacity">
                        Filter
                    </button>
                    <button onClick={handleReset} className="flex-1 px-4 py-2 font-bold text-hitam rounded bg-grey/30 hover:bg-grey/40 transition-opacity">
                        Refresh
                    </button>
                </div>
            </div>
        </div>
    );
};

const AddAreaModal = ({ onClose, onRefresh }: { onClose: () => void, onRefresh: () => void }) => {
    const [listJenisAudit, setListJenisAudit] = useState<JenisAudit[]>([]);
    const [listDept, setListDept] = useState<Department[]>([]);
    const [selectedDept, setSelectedDept] = useState('');
    const [newDeptName, setNewDeptName] = useState('');

    // [UPDATE] Gunakan fetchWithAuth
    useEffect(() => {
        fetchWithAuth('/api/setting/jenis_audit', { cache: 'no-store' })
            .then(res => res.json())
            .then(data => setListJenisAudit(data.data || []));

        fetchWithAuth('/api/setting/departments', { cache: 'no-store' })
            .then(res => res.json())
            .then(data => setListDept(data.data || []));
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;

        const dataToSend: any = {
            nama_area: (form.elements.namedItem('nama_area') as HTMLInputElement).value,
            kode_area: (form.elements.namedItem('kode_area') as HTMLInputElement).value,
            jenis_audit_id: (form.elements.namedItem('jenis_audit_id') as HTMLSelectElement).value,
        };

        if (!dataToSend.nama_area) {
            toast.error("Nama Area wajib diisi!");
            return;
        }
        if (!dataToSend.kode_area) {
            toast.error("Kode Area wajib diisi (Max 10 Huruf)!");
            return;
        }
        if (!dataToSend.jenis_audit_id) {
            toast.error("Jenis Audit wajib diisi!");
            return;
        }
        dataToSend.jenis_audit_id = parseInt(dataToSend.jenis_audit_id, 10);

        if (selectedDept === 'lainnya') {
            if (!newDeptName.trim()) {
                toast.error("Nama Department Baru wajib diisi jika memilih 'Lainnya'.");
                return;
            }
            dataToSend.new_department_name = newDeptName.trim();
        } else if (selectedDept) {
            dataToSend.department_id = parseInt(selectedDept, 10);
        } else {
            toast.error("Department wajib diisi (pilih atau 'Lainnya').");
            return;
        }

        try {
            // [UPDATE] Gunakan fetchWithAuth
            const response = await fetchWithAuth('/api/setting/areas', {
                method: 'POST',
                // Content-Type otomatis di-set helper
                body: JSON.stringify(dataToSend),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Gagal menyimpan area');
            }

            toast.success('Area berhasil disimpan!');
            onClose();
            onRefresh();
        } catch (error: any) {
            toast.error(`Error: ${error.message}`);
        }
    };

    return (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-hitam/50">
            <div className="bg-putih p-6 rounded-lg shadow-xl w-full max-w-lg">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="text-xl font-bold text-hitam">Tambah Area Baru</h4>
                    <button onClick={onClose} className="text-grey hover:text-hitam"><X className="w-6 h-6" /></button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="nama_area" className="block text-sm font-medium text-grey">Nama Area Audit</label>
                        <input type="text" id="nama_area" name="nama_area" required className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru" placeholder="Contoh: Produksi Line 1" />
                    </div>

                    <div>
                        <label htmlFor="kode_area" className="block text-sm font-medium text-grey">Kode Area (Max 10 Karakter)</label>
                        <input type="text" id="kode_area" name="kode_area" maxLength={10} required className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru" placeholder="Contoh: PROD1" />
                    </div>

                    <div>
                        <label htmlFor="jenis_audit_id" className="block text-sm font-medium text-grey">Jenis Audit</label>
                        <select id="jenis_audit_id" name="jenis_audit_id" required className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru">
                            <option value="">Pilih Jenis Audit</option>
                            {listJenisAudit.map(ja => (
                                <option key={ja.jenis_audit_id} value={ja.jenis_audit_id}>{ja.nama_jenis_audit}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label htmlFor="department_id" className="block text-sm font-medium text-grey">Department</label>
                        <select
                            id="department_id"
                            name="department_id"
                            value={selectedDept}
                            onChange={(e) => setSelectedDept(e.target.value)}
                            required
                            className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru"
                        >
                            <option value="">Pilih Department</option>
                            {listDept.map(d => (
                                <option key={d.department_id} value={d.department_id}>{d.nama_department}</option>
                            ))}
                            <option value="lainnya">Lainnya (Input Baru)...</option>
                        </select>
                    </div>

                    {selectedDept === 'lainnya' && (
                        <div className="animate-fadeIn">
                            <label htmlFor="new_department_name" className="block text-sm font-medium text-grey">Nama Department Baru</label>
                            <input
                                type="text"
                                id="new_department_name"
                                name="new_department_name"
                                value={newDeptName}
                                onChange={(e) => setNewDeptName(e.target.value)}
                                placeholder="Mis: Departemen X"
                                required
                                className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru"
                            />
                        </div>
                    )}

                    <div className="flex justify-end space-x-2 pt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 font-bold text-hitam rounded bg-grey/30 hover:bg-grey/40">
                            Batal
                        </button>
                        <button type="submit" className="px-4 py-2 font-bold text-putih rounded bg-biru hover:bg-biru/90">
                            Simpan
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const ConfirmDeleteModal = ({
    area,
    onClose,
    onConfirm,
    isLoading
}: {
    area: Area;
    onClose: () => void;
    onConfirm: () => void;
    isLoading: boolean;
}) => {
    return (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-hitam/50">
            <div className="bg-putih p-6 rounded-lg shadow-xl w-full max-w-md">
                <div className="flex items-center">
                    <div className="mr-4 flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                        <AlertTriangle className="h-6 w-6 text-red-600" />
                    </div>
                    <div>
                        <h4 className="text-xl font-bold text-hitam">Hapus Area</h4>
                        <p className="text-sm text-grey mt-1">
                            Anda yakin ingin menghapus area **{area.nama_area}** (Dept: {area.department})?
                        </p>
                    </div>
                </div>
                <p className="text-xs text-grey mt-4 pl-16">
                    PERINGATAN: Ini akan menghapus area ini secara permanen.
                </p>

                <div className="flex justify-end space-x-2 pt-6">
                    <button type="button" onClick={onClose} disabled={isLoading} className="px-4 py-2 font-bold text-hitam rounded bg-grey/30 hover:bg-grey/40 disabled:opacity-50">
                        Batal
                    </button>

                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isLoading}
                        className="px-4 py-2 font-bold text-putih rounded bg-hitam hover:bg-hitam/80 disabled:bg-hitam/40">
                        {isLoading ? "Menghapus..." : "Ya, Hapus"}
                    </button>

                </div>
            </div>
        </div>
    );
};

const EditAreaModal = ({
    area,
    onClose,
    onRefresh
}: {
    area: Area | null;
    onClose: () => void;
    onRefresh: () => void;
}) => {
    const [formData, setFormData] = useState<AreaEditData | null>(null);
    const [listJenisAudit, setListJenisAudit] = useState<JenisAudit[]>([]);
    const [listDept, setListDept] = useState<Department[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // [UPDATE] Gunakan fetchWithAuth
    useEffect(() => {
        fetchWithAuth('/api/setting/jenis_audit', { cache: 'no-store' })
            .then(res => res.json())
            .then(data => setListJenisAudit(data.data || []));

        fetchWithAuth('/api/setting/departments', { cache: 'no-store' })
            .then(res => res.json())
            .then(data => setListDept(data.data || []));
    }, []);

    useEffect(() => {
        if (area) {
            setFormData({
                nama_area: area.nama_area,
                kode_area: area.kode_area || '',
                jenis_audit_id: area.jenis_audit_id,
                department_id: area.department_id,
            });
        }
    }, [area]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => prev ? ({
            ...prev,
            [name]: (name === 'jenis_audit_id' || name === 'department_id') ? (value ? parseInt(value) : null) : value
        }) : null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData || !area) return;

        if (!formData.nama_area || !formData.kode_area || !formData.jenis_audit_id || !formData.department_id) {
            toast.error("Nama Area, Kode Area, Jenis Audit, dan Department wajib diisi.");
            return;
        }

        setIsLoading(true);
        try {
            // [UPDATE] Gunakan fetchWithAuth untuk PUT
            const response = await fetchWithAuth(`/api/setting/areas/${area.area_id}`, {
                method: 'PUT',
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Gagal memperbarui area');
            }

            toast.success('Area berhasil diperbarui!');
            onClose();
            onRefresh();
        } catch (error: any) {
            toast.error(`Error: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    if (!formData) return null;

    return (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-hitam/50">
            <div className="bg-putih p-6 rounded-lg shadow-xl w-full max-w-lg">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="text-xl font-bold text-hitam">Edit Area</h4>
                    <button onClick={onClose} className="text-grey hover:text-hitam"><X className="w-6 h-6" /></button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="nama_area" className="block text-sm font-medium text-grey">Nama Area Audit</label>
                        <input
                            type="text"
                            id="nama_area"
                            name="nama_area"
                            value={formData.nama_area}
                            onChange={handleChange}
                            required
                            className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru" />
                    </div>

                    <div>
                        <label htmlFor="kode_area" className="block text-sm font-medium text-grey">Kode Area (Max 10 Karakter)</label>
                        <input
                            type="text"
                            id="kode_area"
                            name="kode_area"
                            maxLength={10}
                            value={formData.kode_area}
                            onChange={handleChange}
                            required
                            className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru" />
                    </div>

                    <div>
                        <label htmlFor="jenis_audit_id" className="block text-sm font-medium text-grey">Jenis Audit</label>
                        <select
                            id="jenis_audit_id"
                            name="jenis_audit_id"
                            value={formData.jenis_audit_id || ''}
                            onChange={handleChange}
                            required
                            className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru">
                            <option value="">Pilih Jenis Audit</option>
                            {listJenisAudit.map(ja => (
                                <option key={ja.jenis_audit_id} value={ja.jenis_audit_id}>{ja.nama_jenis_audit}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label htmlFor="department_id" className="block text-sm font-medium text-grey">Department</label>
                        <select
                            id="department_id"
                            name="department_id"
                            value={formData.department_id || ''}
                            onChange={handleChange}
                            required
                            className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru"
                        >
                            <option value="">Pilih Department</option>
                            {listDept.map(d => (
                                <option key={d.department_id} value={d.department_id}>{d.nama_department}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex justify-end space-x-2 pt-4">
                        <button type="button" onClick={onClose} disabled={isLoading} className="px-4 py-2 font-bold text-hitam rounded bg-grey/30 hover:bg-grey/40 disabled:opacity-50">
                            Batal
                        </button>
                        <button type="submit" disabled={isLoading} className="px-4 py-2 font-bold text-putih rounded bg-biru hover:bg-biru/90 disabled:bg-biru-400">
                            {isLoading ? "Menyimpan..." : "Simpan Perubahan"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default function AreaConfigurationPage() {
    const [areas, setAreas] = useState<Area[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [filters, setFilters] = useState<any>({});

    const [isDeleteLoading, setIsDeleteLoading] = useState(false);
    const [areaToEdit, setAreaToEdit] = useState<Area | null>(null);
    const [areaToDelete, setAreaToDelete] = useState<Area | null>(null);

    // [UPDATE] Gunakan fetchWithAuth
    const fetchAreas = async (currentFilters: any) => {
        setIsLoading(true);

        const params = new URLSearchParams();
        if (currentFilters.jenisAudit) params.append('jenis_audit_id', currentFilters.jenisAudit);
        if (currentFilters.department) params.append('department_id', currentFilters.department);
        if (currentFilters.searchQuery) params.append('search', currentFilters.searchQuery);

        // URL Relatif
        const endpoint = `/api/setting/areas?${params.toString()}`;

        try {
            const response = await fetchWithAuth(endpoint, { cache: 'no-store' });
            if (!response.ok) throw new Error('Gagal mengambil data');
            const result = await response.json();
            setAreas(result.data || []);
        } catch (error: any) {
            console.error(error);
            setAreas([]);
            toast.error(`Gagal memuat data: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAreas(filters);
    }, [filters]);

    const handleFilterChange = (newFilters: any) => {
        setFilters(newFilters);
    };

    const handleRefresh = () => {
        setFilters((prevFilters: any) => ({ ...prevFilters }));
    }

    const handleAdd = () => setIsAddModalOpen(true);
    const handleEdit = (area: Area) => setAreaToEdit(area);
    const handleOpenDeleteConfirm = (area: Area) => setAreaToDelete(area);

    // [UPDATE] Gunakan fetchWithAuth
    const handleConfirmDelete = async () => {
        if (!areaToDelete) return;

        setIsDeleteLoading(true);

        try {
            const response = await fetchWithAuth(`/api/setting/areas/${areaToDelete.area_id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Gagal menghapus area');
            }

            toast.success("Area berhasil dihapus permanen.");
            setAreaToDelete(null);
            handleRefresh();
        } catch (error: any) {
            toast.error(`Error: ${error.message}`);
        } finally {
            setIsDeleteLoading(false);
        }
    };

    return (
        <>
            <Toaster position="top-center" reverseOrder={false} />
            <AreaFilters onFilterChange={handleFilterChange} />

            <div className="bg-putih p-6 rounded-lg shadow-md">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-hitam">Master Area Configuration</h3>
                    <button
                        onClick={handleAdd}
                        className="flex items-center px-4 py-2 font-bold text-putih rounded bg-biru hover:bg-biru/90 transition-opacity">
                        <Plus className="w-5 h-5 mr-2" />
                        Tambah Area
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-grey/40">
                        <thead className="bg-grey/10">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-grey uppercase tracking-wider">Jenis Audit</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-grey uppercase tracking-wider">Department</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-grey uppercase tracking-wider">Kode</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-grey uppercase tracking-wider">Area Audit</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-grey uppercase tracking-wider">Action</th>
                            </tr>
                        </thead>
                        <tbody className="bg-putih divide-y divide-grey/40">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-10 text-grey">Loading data...</td>
                                </tr>
                            ) : areas.length > 0 ? (
                                areas.map((area) => (
                                    <tr key={area.area_id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-hitam">{area.jenis_audit}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-hitam">{area.department}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-hitam">{area.kode_area || '-'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-hitam">{area.nama_area}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                            <button onClick={() => handleEdit(area)} className="text-grey hover:text-biru">
                                                <Edit className="w-5 h-5" strokeWidth={2.5} />
                                            </button>
                                            <button onClick={() => handleOpenDeleteConfirm(area)} className="text-grey hover:text-red-600">
                                                <Trash2 className="w-5 h-5" strokeWidth={2.5} />
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

            {isAddModalOpen && (
                <AddAreaModal
                    onClose={() => setIsAddModalOpen(false)}
                    onRefresh={handleRefresh}
                />
            )}

            {areaToEdit && (
                <EditAreaModal
                    area={areaToEdit}
                    onClose={() => setAreaToEdit(null)}
                    onRefresh={handleRefresh}
                />
            )}

            {areaToDelete && (
                <ConfirmDeleteModal
                    area={areaToDelete}
                    isLoading={isDeleteLoading}
                    onClose={() => setAreaToDelete(null)}
                    onConfirm={handleConfirmDelete}
                />
            )}
        </>
    );
}