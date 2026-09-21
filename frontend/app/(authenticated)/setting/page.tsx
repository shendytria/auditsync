'use client'

import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Edit, Trash2, Eye, X, Upload, AlertTriangle } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';
import { fetchWithAuth } from '@/utils/api'; // <--- PASTIKAN FILE INI ADA

// --- Interface untuk data ---
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
interface ChecklistEditData {
  nama_checklist: string;
  area_id: number;
  department_id: number | null;
  jenis_audit_id: number;
}


// --- Komponen Filter ---
const ChecklistFilters = ({ 
  allAreas, 
  allDepts, 
  allJenisAudits,
  onFilterChange 
} : { 
  allAreas: DropdownArea[], 
  allDepts: DropdownDept[], 
  allJenisAudits: DropdownJenisAudit[],
  onFilterChange: (filters: any) => void 
}) => {
  const [jenisAudit, setJenisAudit] = useState('');
  const [department, setDepartment] = useState('');
  const [area, setArea] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Opsi Department yang difilter
  const deptOptions = useMemo(() => {
    if (!jenisAudit) {
      return allDepts; 
    }
    const validDeptIds = new Set(
      allAreas
        .filter(a => a.jenis_audit_id === parseInt(jenisAudit)) 
        .map(a => a.department_id)
    );
    return allDepts.filter(d => validDeptIds.has(d.department_id));
  }, [jenisAudit, allAreas, allDepts]);

  // 2. Opsi Area yang difilter
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

  // 3. Handler saat filter di-submit
  const handleFilter = () => {
    onFilterChange({ 
      jenisAudit: jenisAudit, 
      department: department, 
      area: area, 
      searchQuery: searchQuery 
    });
  };
  
  // 4. Handler saat filter di-reset
  const handleReset = () => {
    setJenisAudit('');
    setDepartment('');
    setArea('');
    setSearchQuery('');
    onFilterChange({}); 
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

        {/* Filter Department */}
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
        
        {/* Filter Area */}
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

// --- Komponen Modal Tambah ---
const AddChecklistModal = ({ 
  onClose, 
  onRefresh,
  allJenisAudits
}: { 
  onClose: () => void, 
  onRefresh: () => void,
  allJenisAudits: DropdownJenisAudit[]
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedJenisAudit, setSelectedJenisAudit] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [deptOptions, setDeptOptions] = useState<DropdownDept[]>([]);
  const [areaOptions, setAreaOptions] = useState<DropdownArea[]>([]);
  const [isDeptLoading, setIsDeptLoading] = useState(false);
  const [isAreaLoading, setIsAreaLoading] = useState(false);

  // [UPDATE] Gunakan fetchWithAuth
  useEffect(() => {
    setSelectedDept('');
    setSelectedArea('');
    setDeptOptions([]);
    setAreaOptions([]);
    
    if (selectedJenisAudit) {
      setIsDeptLoading(true);
      fetchWithAuth(`/api/setting/departments-by-jenis/${selectedJenisAudit}`, { cache: 'no-store' })
        .then(res => res.json())
        .then(data => setDeptOptions(data.data || []))
        .finally(() => setIsDeptLoading(false));
    }
  }, [selectedJenisAudit]);

  // [UPDATE] Gunakan fetchWithAuth
  useEffect(() => {
    setSelectedArea('');
    setAreaOptions([]);

    if (selectedJenisAudit && selectedDept) {
      setIsAreaLoading(true);
      const deptId = selectedDept === "null" ? "null" : selectedDept; 
      fetchWithAuth(`/api/setting/areas-by-filter?jenis_audit_id=${selectedJenisAudit}&department_id=${deptId}`, { cache: 'no-store' })
        .then(res => res.json())
        .then(data => setAreaOptions(data.data || []))
        .finally(() => setIsAreaLoading(false));
    }
  }, [selectedJenisAudit, selectedDept]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    
    const formData = new FormData();
    formData.append('nama_checklist', (form.elements.namedItem('nama') as HTMLInputElement).value);
    formData.append('area_id', selectedArea);
    formData.append('department_id', selectedDept);
    formData.append('jenis_audit_id', selectedJenisAudit);
    
    if (selectedFile) {
      formData.append('file', selectedFile);
    } else {
      toast.error('Harap upload file Excel check items!');
      return;
    }
    
    if (!formData.get('nama_checklist') || !formData.get('area_id') || !formData.get('department_id') || !formData.get('jenis_audit_id')) {
      toast.error('Jenis Audit, Department, dan Area wajib diisi.');
      return;
    }

    // [UPDATE] Khusus FormData, kita pakai fetch manual tapi SISIPKAN TOKEN
    // Karena fetchWithAuth memaksa Content-Type: json yang bisa merusak boundary FormData
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';
    const token = localStorage.getItem('token'); // Ambil token manual

    try {
      const response = await fetch(`${API_BASE}/api/setting/checklists`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}` // Sisipkan Token
            // Jangan set Content-Type! Biarkan otomatis
        },
        body: formData, 
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Gagal menyimpan checklist');
      }

      toast.success('Checklist berhasil disimpan!');
      onClose(); 
      onRefresh();
      
    } catch (error: any) {
      console.error('Error submit:', error);
      toast.error(`Error: ${error.message}`);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-hitam/50">
      <div className="bg-putih p-6 rounded-lg shadow-xl w-full max-w-lg">
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-xl font-bold text-hitam">Tambah Checklist Baru</h4>
          <button onClick={onClose} className="text-grey hover:text-hitam">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="nama" className="block text-sm font-medium text-grey">Nama Checklist</label>
            <input type="text" id="nama" name="nama" required className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru" />
          </div>

          <div>
            <label htmlFor="jenis" className="block text-sm font-medium text-grey">Jenis Audit</label>
            <select 
              id="jenis" 
              name="jenis" 
              value={selectedJenisAudit}
              onChange={(e) => setSelectedJenisAudit(e.target.value)}
              required 
              className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru"
            >
              <option value="">1. Pilih Jenis</option>
              {allJenisAudits.map(ja => <option key={ja.jenis_audit_id} value={ja.jenis_audit_id}>{ja.nama_jenis_audit}</option>)}
            </select>
          </div>
          
          <div>
            <label htmlFor="dept" className="block text-sm font-medium text-grey">Department</label>
            <select 
              id="dept" 
              name="dept" 
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              disabled={!selectedJenisAudit || isDeptLoading}
              required 
              className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru disabled:bg-grey/10"
            >
              <option value="">{isDeptLoading ? "Memuat..." : "2. Pilih Department"}</option>
              {deptOptions.map(d => <option key={d.department_id} value={d.department_id}>{d.nama_department}</option>)}
              {selectedJenisAudit && <option value="null">(Tanpa Department)</option>}
            </select>
          </div>
          
          <div>
            <label htmlFor="area" className="block text-sm font-medium text-grey">Area Audit</label>
            <select 
              id="area" 
              name="area" 
              value={selectedArea}
              onChange={(e) => setSelectedArea(e.target.value)}
              disabled={!selectedDept || isAreaLoading}
              required 
              className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru disabled:bg-grey/10"
            >
              <option value="">{isAreaLoading ? "Memuat..." : "3. Pilih Area"}</option>
              {areaOptions.map(a => <option key={a.area_id} value={a.area_id}>{a.nama_area}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-grey">Upload Check Items (Excel)</label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-grey/40 border-dashed rounded-md">
              <div className="space-y-1 text-center">
                <Upload className="mx-auto h-12 w-12 text-grey" />
                <label htmlFor="file-upload" className="relative cursor-pointer text-sm text-biru hover:underline">
                  <span>Upload file</span>
                  <input id="file-upload" name="file-upload" type="file" className="sr-only" accept=".xlsx, .xls" required onChange={handleFileChange} />
                </label>
                <p className="text-xs text-grey">{selectedFile ? selectedFile.name : 'Drag & drop'}</p>
              </div>
            </div>
          </div>

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


// --- Modal Detail Item ---
const ChecklistDetailModal = ({ 
  checklist, 
  onClose 
}: { 
  checklist: ChecklistMaster | null, 
  onClose: () => void 
}) => {
  const [checkItems, setCheckItems] = useState<CheckItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleteLoading, setIsDeleteLoading] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<CheckItem | null>(null);
  const [itemToEdit, setItemToEdit] = useState<CheckItem | null>(null);

  // [UPDATE] Gunakan fetchWithAuth
  const fetchItems = () => {
    if (!checklist) return; 
    
    setIsLoading(true);
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

  // [UPDATE] Gunakan fetchWithAuth
  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleteLoading(true);
    try {
      const response = await fetchWithAuth(`/api/setting/checklists/items/${itemToDelete.item_id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Gagal menghapus item');
      }
      toast.success("Item berhasil dihapus.");
      setItemToDelete(null);
      fetchItems(); 
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsDeleteLoading(false);
    }
  };

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
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-grey uppercase tracking-wider w-6/12">Check Item</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-grey uppercase tracking-wider w-3/12">Reference document</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-grey uppercase tracking-wider w-2/12">Action</th>
              </tr>
            </thead>
            
            <tbody className="bg-putih divide-y divide-grey/40">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-grey">Memuat data...</td>
                </tr>
              ) : checkItems.length > 0 ? (
                Array.from(groupedItems.entries()).map(([kategori, subGroups]) => (
                  <React.Fragment key={kategori}>
                    <tr className="bg-biru/10">
                      <td colSpan={4} className="px-4 py-2 text-sm font-bold text-biru">
                        {kategori}
                      </td>
                    </tr>
                    {Array.from(subGroups.entries()).map(([subKategori, items]) => (
                      <React.Fragment key={subKategori}>
                        {subKategori !== "Umum" && (
                          <tr className="bg-grey/10">
                            <td colSpan={4} className="px-6 py-2 text-sm font-semibold text-hitam">
                              {subKategori}
                            </td>
                          </tr>
                        )}
                        {items.map((item, index) => (
                          <tr key={item.item_id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-hitam">{index + 1}</td>
                            <td className="px-6 py-4 whitespace-normal text-sm text-hitam">{item.item_checklist_text}</td>
                            <td className="px-6 py-4 whitespace-normal text-sm text-hitam">{item.referensi_doc}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                              <button onClick={() => setItemToEdit(item)} className="text-grey hover:text-biru">
                                <Edit className="w-5 h-5" strokeWidth={2.5} />
                              </button>
                              <button onClick={() => setItemToDelete(item)} className="text-grey hover:text-red-600">
                                <Trash2 className="w-5 h-5" strokeWidth={2.5} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </React.Fragment>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-grey">
                    Tidak ada item checklist ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {itemToEdit && (
        <EditItemModal
          item={itemToEdit}
          onClose={() => setItemToEdit(null)}
          onRefresh={fetchItems} 
        />
      )}
      
      {itemToDelete && (
        <ConfirmDeleteItemModal
          item={itemToDelete}
          isLoading={isDeleteLoading}
          onClose={() => setItemToDelete(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  );
};

// --- Modal Edit Item ---
const EditItemModal = ({ 
  item, 
  onClose, 
  onRefresh 
}: { 
  item: CheckItem | null, 
  onClose: () => void, 
  onRefresh: () => void 
}) => {
  const [text, setText] = useState('');
  const [refDoc, setRefDoc] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (item) {
      setText(item.item_checklist_text);
      setRefDoc(item.referensi_doc || '');
    }
  }, [item]);

  // [UPDATE] Gunakan fetchWithAuth
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;
    
    setIsLoading(true);
    
    try {
      const response = await fetchWithAuth(`/api/setting/checklists/items/${item.item_id}`, {
        method: 'PUT',
        body: JSON.stringify({
          item_checklist_text: text,
          referensi_doc: refDoc,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Gagal memperbarui item');
      }
      
      toast.success('Item berhasil diperbarui!');
      onClose();
      onRefresh();
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!item) return null; 

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-hitam/50"> 
      <div className="bg-putih p-6 rounded-lg shadow-xl w-full max-w-xl">
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-xl font-bold text-hitam">Edit Check Item</h4>
          <button onClick={onClose} className="text-grey hover:text-hitam"><X className="w-6 h-6" /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="item_text" className="block text-sm font-medium text-grey">Check Item Text</label>
            <textarea
              id="item_text" 
              name="item_text" 
              value={text}
              onChange={(e) => setText(e.target.value)}
              required 
              rows={4}
              className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru" 
            />
          </div>
          <div>
            <label htmlFor="ref_doc" className="block text-sm font-medium text-grey">Referensi Doc</label>
            <input 
              type="text" 
              id="ref_doc" 
              name="ref_doc" 
              value={refDoc}
              onChange={(e) => setRefDoc(e.target.value)}
              className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru" 
            />
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

// --- Modal Konfirmasi Hapus Item ---
const ConfirmDeleteItemModal = ({
  item,
  onClose,
  onConfirm,
  isLoading
}: {
  item: CheckItem;
  onClose: () => void;
  onConfirm: () => void;
  isLoading: boolean;
}) => {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-hitam/50"> 
      <div className="bg-putih p-6 rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center">
          <div className="mr-4 flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <h4 className="text-xl font-bold text-hitam">Hapus Item</h4>
            <p className="text-sm text-grey mt-1">
              Anda yakin ingin menghapus item ini?
            </p>
          </div>
        </div>
        <p className="text-xs text-grey mt-4 pl-16">
          "{item.item_checklist_text.substring(0, 50)}..."
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

// --- Modal Edit Master Checklist ---
const EditChecklistModal = ({ 
  checklist, 
  onClose, 
  onRefresh,
  allJenisAudits
} : { 
  checklist: ChecklistMaster | null, 
  onClose: () => void, 
  onRefresh: () => void,
  allJenisAudits: DropdownJenisAudit[]
}) => {
  const [formData, setFormData] = useState<ChecklistEditData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [deptOptions, setDeptOptions] = useState<DropdownDept[]>([]);
  const [areaOptions, setAreaOptions] = useState<DropdownArea[]>([]);
  const [isDeptLoading, setIsDeptLoading] = useState(false);
  const [isAreaLoading, setIsAreaLoading] = useState(false);

  // [UPDATE] Gunakan fetchWithAuth
  useEffect(() => {
    if (checklist) {
      setIsLoading(true);
      fetchWithAuth(`/api/setting/checklists/${checklist.checklist_id}`, { cache: 'no-store' })
        .then(res => res.json())
        .then(result => {
          if (result.data) {
            setFormData(result.data);
          } else {
            toast.error("Gagal memuat data checklist.");
            onClose();
          }
        })
        .catch(err => toast.error(`Error: ${err.message}`))
        .finally(() => setIsLoading(false));
    }
  }, [checklist, onClose]);

  // [UPDATE] Gunakan fetchWithAuth
  useEffect(() => {
    if (formData?.jenis_audit_id) {
      setIsDeptLoading(true);
      fetchWithAuth(`/api/setting/departments-by-jenis/${formData.jenis_audit_id}`, { cache: 'no-store' })
        .then(res => res.json())
        .then(data => setDeptOptions(data.data || []))
        .finally(() => setIsDeptLoading(false));
    }
  }, [formData?.jenis_audit_id]);

  // [UPDATE] Gunakan fetchWithAuth
  useEffect(() => {
    if (formData?.jenis_audit_id && (formData.department_id || formData.department_id === null)) {
      setIsAreaLoading(true);
      const deptId = formData.department_id === null ? "null" : formData.department_id;
      fetchWithAuth(`/api/setting/areas-by-filter?jenis_audit_id=${formData.jenis_audit_id}&department_id=${deptId}`, { cache: 'no-store' })
        .then(res => res.json())
        .then(data => setAreaOptions(data.data || []))
        .finally(() => setIsAreaLoading(false));
    }
  }, [formData?.jenis_audit_id, formData?.department_id]);


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    setFormData(prev => {
      if (!prev) return null;
      
      let newFormData:any = { ...prev, [name]: value };

      if (name === 'jenis_audit_id') newFormData.jenis_audit_id = parseInt(value);
      if (name === 'department_id') newFormData.department_id = value ? (value === "null" ? null : parseInt(value)) : null;
      if (name === 'area_id') newFormData.area_id = parseInt(value);
      if (name === 'jenis_audit_id') {
        newFormData.department_id = null;
        newFormData.area_id = 0; 
      }
      if (name === 'department_id') {
        newFormData.area_id = 0; 
      }
      
      return newFormData;
    });
  };
  
  // [UPDATE] Gunakan fetchWithAuth
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData || !checklist) return;
    
    setIsLoading(true);
    
    try {
      const response = await fetchWithAuth(`/api/setting/checklists/${checklist.checklist_id}`, {
        method: 'PUT',
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Gagal memperbarui checklist');
      }
      
      toast.success('Checklist berhasil diperbarui!');
      onClose();
      onRefresh();
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!formData || !checklist) {
    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center bg-hitam/50">
        <div className="bg-putih p-6 rounded-lg shadow-xl w-full max-w-lg text-center">
          Memuat data...
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-hitam/50">
      <div className="bg-putih p-6 rounded-lg shadow-xl w-full max-w-lg">
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-xl font-bold text-hitam">Edit Checklist (ID: {checklist.checklist_id})</h4>
          <button onClick={onClose} className="text-grey hover:text-hitam"><X className="w-6 h-6" /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="nama_checklist" className="block text-sm font-medium text-grey">Nama Checklist</label>
            <input type="text" id="nama_checklist" name="nama_checklist" value={formData.nama_checklist} onChange={handleChange} required className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru" />
          </div>
          <div>
            <label htmlFor="jenis_audit_id" className="block text-sm font-medium text-grey">Jenis Audit</label>
            <select 
              id="jenis_audit_id" 
              name="jenis_audit_id" 
              value={formData.jenis_audit_id}
              onChange={handleChange}
              required 
              className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru"
            >
              <option value="">1. Pilih Jenis</option>
              {allJenisAudits.map(ja => <option key={ja.jenis_audit_id} value={ja.jenis_audit_id}>{ja.nama_jenis_audit}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="department_id" className="block text-sm font-medium text-grey">Department</label>
            <select 
              id="department_id" 
              name="department_id" 
              value={formData.department_id === null ? "null" : formData.department_id || ''}
              onChange={handleChange}
              disabled={isDeptLoading}
              required 
              className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru disabled:bg-grey/10"
            >
              <option value="">{isDeptLoading ? "Memuat..." : "2. Pilih Department"}</option>
              {deptOptions.map(d => <option key={d.department_id} value={d.department_id}>{d.nama_department}</option>)}
              <option value="null">(Tanpa Department)</option>
            </select>
          </div>
          <div>
            <label htmlFor="area_id" className="block text-sm font-medium text-grey">Area Audit</label>
            <select 
              id="area_id" 
              name="area_id" 
              value={formData.area_id || ''}
              onChange={handleChange}
              disabled={isAreaLoading}
              required 
              className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru disabled:bg-grey/10"
            >
              <option value="">{isAreaLoading ? "Memuat..." : "3. Pilih Area"}</option>
              {areaOptions.map(a => <option key={a.area_id} value={a.area_id}>{a.nama_area}</option>)}
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

// --- Modal Konfirmasi Hapus Master Checklist ---
const ConfirmDeleteChecklistModal = ({
  checklist,
  onClose,
  onConfirm,
  isLoading
}: {
  checklist: ChecklistMaster;
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
            <h4 className="text-xl font-bold text-hitam">Hapus Checklist</h4>
            <p className="text-sm text-grey mt-1">
              Anda yakin ingin menghapus checklist **{checklist.nama_checklist}**?
            </p>
          </div>
        </div>
        <p className="text-xs text-grey mt-4 pl-16">
          PERINGATAN: Tindakan ini akan menghapus checklist ini beserta **semua item** di dalamnya.
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

export default function ChecklistSettingsPage() {
  const [checklists, setChecklists] = useState<ChecklistMaster[]>([]); 
  const [isLoading, setIsLoading] = useState(true); 
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedChecklist, setSelectedChecklist] = useState<ChecklistMaster | null>(null);
  const [allJenisAudits, setAllJenisAudits] = useState<DropdownJenisAudit[]>([]);
  const [checklistToEdit, setChecklistToEdit] = useState<ChecklistMaster | null>(null);
  const [checklistToDelete, setChecklistToDelete] = useState<ChecklistMaster | null>(null);
  const [isDeleteLoading, setIsDeleteLoading] = useState(false);

  const [allAreas, setAllAreas] = useState<DropdownArea[]>([]);
  const [allDepts, setAllDepts] = useState<DropdownDept[]>([]);
  const [filters, setFilters] = useState<any>({}); 

  // [UPDATE] Gunakan fetchWithAuth
  const fetchChecklists = async (currentFilters: any) => {
    setIsLoading(true);
    const params = new URLSearchParams();
    if (currentFilters.jenisAudit) params.append('jenis_audit_id', currentFilters.jenisAudit);
    if (currentFilters.department) params.append('department_id', currentFilters.department);
    if (currentFilters.area) params.append('area_id', currentFilters.area);
    if (currentFilters.searchQuery) params.append('search', currentFilters.searchQuery);
    
    // Gunakan helper, path relatif
    const endpoint = `/api/setting/checklists?${params.toString()}`;
    
    try {
      const response = await fetchWithAuth(endpoint, { cache: 'no-store' });
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

  // [UPDATE] Gunakan fetchWithAuth untuk data awal
  useEffect(() => {
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

  useEffect(() => {
    fetchChecklists(filters);
  }, [filters]); 

  const handleFilterChange = (newFilters: any) => {
    setFilters(newFilters);
  };
  
  const handleRefresh = () => {
    fetchChecklists(filters);
  }

  const handleShowDetails = (checklist: ChecklistMaster) => {
    setSelectedChecklist(checklist);
    setIsDetailModalOpen(true);
  };

  const handleEdit = (checklist: ChecklistMaster) => {
    setChecklistToEdit(checklist);
  };
  
  const handleOpenDeleteConfirm = (checklist: ChecklistMaster) => {
    setChecklistToDelete(checklist);
  };
  
  // [UPDATE] Gunakan fetchWithAuth
  const handleConfirmDelete = async () => {
    if (!checklistToDelete) return;
    setIsDeleteLoading(true);
    try {
      const response = await fetchWithAuth(`/api/setting/checklists/${checklistToDelete.checklist_id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Gagal menghapus checklist');
      }
      toast.success('Checklist berhasil dihapus.');
      setChecklistToDelete(null);
      fetchChecklists(filters); 
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsDeleteLoading(false);
    }
  };

  return (
    <>
      <Toaster position="top-center" reverseOrder={false} />
      <ChecklistFilters 
        allAreas={allAreas}
        allDepts={allDepts}
        allJenisAudits={allJenisAudits}
        onFilterChange={handleFilterChange} 
      />

      <div className="bg-putih p-6 rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-hitam">Master Checklist Inspeksi</h3>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center px-4 py-2 font-bold text-putih rounded bg-biru hover:bg-biru/90 transition-opacity">
            <Plus className="w-5 h-5 mr-2" />
            Tambah Checklist
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-grey/40">
            <thead className="bg-grey/10">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-grey uppercase tracking-wider">Nama Checklist</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-grey uppercase tracking-wider">Area Audit</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-grey uppercase tracking-wider">Department</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-grey uppercase tracking-wider">Jenis Audit</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-grey uppercase tracking-wider">Action</th>
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button onClick={() => handleShowDetails(item)} className="text-grey hover:text-hijau">
                        <Eye className="w-5 h-5" strokeWidth={2.5} />
                      </button>
                      <button onClick={() => handleEdit(item)} className="text-grey hover:text-biru">
                        <Edit className="w-5 h-5" strokeWidth={2.5} />
                      </button>
                      <button onClick={() => handleOpenDeleteConfirm(item)} className="text-grey hover:text-red-600">
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

      {/* Modal windows */}
      {isAddModalOpen && (
        <AddChecklistModal 
          onClose={() => setIsAddModalOpen(false)} 
          onRefresh={handleRefresh} 
          allJenisAudits={allJenisAudits}
        />
      )}
      
      {isDetailModalOpen && (
        <ChecklistDetailModal 
          checklist={selectedChecklist} 
          onClose={() => setIsDetailModalOpen(false)} 
        />
      )}
      
      {checklistToEdit && (
        <EditChecklistModal
          checklist={checklistToEdit}
          onClose={() => setChecklistToEdit(null)}
          onRefresh={handleRefresh} 
          allJenisAudits={allJenisAudits}
        />
      )}
      
      {checklistToDelete && (
        <ConfirmDeleteChecklistModal
          checklist={checklistToDelete}
          isLoading={isDeleteLoading}
          onClose={() => setChecklistToDelete(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </>
  );
}