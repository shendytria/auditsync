'use client'

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, X, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';
import { fetchWithAuth } from '@/utils/api'; // <--- IMPORT HELPER

interface Site {
  site_id: number;
  nama_site: string;
}

interface Role {
  id: number;
  nama_role: string;
}

interface Department {
  department_id: number;
  nama_department: string;
}

interface User {
  id: number;
  username: string;
  nama_lengkap: string;
  email: string;
  role: string; 
  site: string; 
  department: string;
}

interface UserEditData {
  id: number;
  username: string;
  nama_lengkap: string;
  email: string;
  role_id: number; 
  site_id: number;
  department_id: number;
}

const UserFilters = ({ onFilterChange }: { onFilterChange: (filters: any) => void }) => {
  const [site, setSite] = useState('');
  const [role, setRole] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [listSite, setListSite] = useState<Site[]>([]);
  const [listRole, setListRole] = useState<Role[]>([]);
  
  // [UPDATE] Gunakan fetchWithAuth agar Dropdown Muncul (Lolos Auth)
  useEffect(() => {
    // Fetch Sites
    fetchWithAuth('/api/setting/sites', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => setListSite(data.data || []));

    // Fetch Roles
    fetchWithAuth('/api/setting/roles', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => setListRole(data.data || []));
  }, []);

  const handleFilter = () => {
    onFilterChange({ site, role, searchQuery });
  };
  
  const handleReset = () => {
    setSite('');
    setRole('');
    setSearchQuery('');
    onFilterChange({ site: '', role: '', searchQuery: '' });
  };

  return (
    <div className="bg-putih p-4 rounded-lg shadow-md mb-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Filter Site */}
        <div>
          <label htmlFor="site" className="block text-sm font-medium text-grey">Site</label>
          <select id="site" value={site} onChange={(e) => setSite(e.target.value)}
            className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru">
            <option value="">Semua Site</option>
            {listSite.map(s => <option key={s.site_id} value={s.site_id}>{s.nama_site}</option>)}
          </select>
        </div>
        
        {/* Filter Role */}
        <div>
          <label htmlFor="role" className="block text-sm font-medium text-grey">Role</label>
          <select id="role" value={role} onChange={(e) => setRole(e.target.value)}
            className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru">
            <option value="">Semua Role</option>
            {listRole.map(r => <option key={r.id} value={r.nama_role}>{r.nama_role}</option>)}
          </select>
        </div>
        
        {/* Search Input */}
        <div>
          <label htmlFor="search" className="block text-sm font-medium text-grey">Search</label>
          <input 
            type="text"
            id="search"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)} 
            className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru" 
          />
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

const AddUserModal = ({ onClose, onRefresh }: { onClose: () => void, onRefresh: () => void }) => {
  const [listSite, setListSite] = useState<Site[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [listRole, setListRole] = useState<Role[]>([]);
  const [listDepartment, setListDepartment] = useState<Department[]>([]);

  // [UPDATE] Gunakan fetchWithAuth
  useEffect(() => {
    fetchWithAuth('/api/setting/sites', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => setListSite(data.data || []));

    fetchWithAuth('/api/setting/roles', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => setListRole(data.data || []));

     fetchWithAuth('/api/setting/departments', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => setListDepartment(data.data || [])); 
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const form = e.target as HTMLFormElement;
    
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;
    const confirmPassword = (form.elements.namedItem('confirm_password') as HTMLInputElement).value;

    const dataToSend = {
      username: (form.elements.namedItem('username') as HTMLInputElement).value,
      password: password,
      nama_lengkap: (form.elements.namedItem('nama_lengkap') as HTMLInputElement).value,
      email: (form.elements.namedItem('email') as HTMLInputElement).value,
      role_id: parseInt((form.elements.namedItem('role_id') as HTMLSelectElement).value, 10), 
      site_id: parseInt((form.elements.namedItem('site_id') as HTMLSelectElement).value, 10),
      department_id: parseInt((form.elements.namedItem('department_id') as HTMLSelectElement).value, 10),
    };

    if (password !== "Bintang7") {
      toast.error("Password default harus 'Bintang7'");
      setIsLoading(false);
      return;
    }
    
    if (password !== confirmPassword) {
      toast.error("Password dan Konfirmasi Password tidak cocok.");
      setIsLoading(false);
      return;
    }

    if (!dataToSend.username || !dataToSend.password || !dataToSend.nama_lengkap || !dataToSend.email || !dataToSend.role_id || !dataToSend.site_id || !dataToSend.department_id) {
      toast.error("Semua field wajib diisi.");
      setIsLoading(false);
      return;
    }

    try {
      // [UPDATE] Gunakan fetchWithAuth (URL relatif, tanpa http localhost)
      const response = await fetchWithAuth('/api/users', {
        method: 'POST',
        // fetchWithAuth otomatis set Content-Type: application/json
        body: JSON.stringify(dataToSend), 
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Gagal menyimpan user');
      }
      
      toast.success(
        (t) => (
          <div className="flex flex-col text-hitam">
            <span className="font-bold">User Berhasil Dibuat!</span>
            <span className="text-sm mt-2">
              Harap informasikan user baru:
              <br />
              Username: <strong className="text-biru">@{dataToSend.username}</strong>
              <br />
              Password: <strong className="text-biru">Bintang7</strong>
            </span>
            <button
              onClick={() => toast.dismiss(t.id)}
              className="mt-3 p-1 w-full text-sm font-medium rounded text-putih bg-biru hover:bg-biru/90">Oke</button>
          </div>
        ),
        {
          duration: 30000,
        }
      );

      onClose();
      onRefresh();
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-hitam/50">
      <div className="bg-putih p-6 rounded-lg shadow-xl w-full max-w-lg">
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-xl font-bold text-hitam">Tambah User Baru</h4>
          <button onClick={onClose} className="text-grey hover:text-hitam"><X className="w-6 h-6" /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-grey">Username</label>
            <input type="text" id="username" name="username" required className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-grey">Password (Default: Bintang7)</label>
              <div className="relative">
                <input 
                  id="password" 
                  name="password" 
                  type={showPassword ? 'text' : 'password'} 
                  required 
                  className="w-full px-4 py-2 border rounded border-grey/40 focus:outline-none focus:ring-2 focus:ring-biru" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-grey">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            
            <div>
              <label htmlFor="confirm_password" className="block text-sm font-medium text-grey">Konfirmasi Password</label>
              <div className="relative">
                <input 
                  id="confirm_password" 
                  name="confirm_password" 
                  type={showConfirmPassword ? 'text' : 'password'} 
                  required 
                  className="w-full px-4 py-2 border rounded border-grey/40 focus:outline-none focus:ring-2 focus:ring-biru" />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-grey">
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="nama_lengkap" className="block text-sm font-medium text-grey">Nama Lengkap</label>
            <input type="text" id="nama_lengkap" name="nama_lengkap" required className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru" />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-grey">Email</label>
            <input type="email" id="email" name="email" required className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="role_id" className="block text-sm font-medium text-grey">Role (Jabatan)</label>
              <select id="role_id" name="role_id" required className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru">
                <option value="">Pilih Role</option>
                {listRole.map(r => (
                  <option key={r.id} value={r.id}>{r.nama_role}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="department_id" className="block text-sm font-medium text-grey">Department</label>
              <select id="department_id" name="department_id" required
                className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru">
                <option value="">Pilih Department</option>
                {listDepartment.map(d => (
                  <option key={d.department_id} value={d.department_id}>{d.nama_department}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="site_id" className="block text-sm font-medium text-grey">Site</label>
              <select id="site_id" name="site_id" required className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru">
                <option value="">Pilih Site</option>
                {listSite.map(s => (
                  <option key={s.site_id} value={s.site_id}>{s.nama_site}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end space-x-2 pt-4">
            <button type="button" onClick={onClose} disabled={isLoading} className="px-4 py-2 font-bold text-hitam rounded bg-grey/30 hover:bg-grey/40 disabled:opacity-50">
              Batal
            </button>
            <button type="submit" disabled={isLoading} className="px-4 py-2 font-bold text-putih rounded bg-biru hover:bg-biru/90 disabled:bg-biru-400">
              {isLoading ? "Menyimpan..." : "Simpan User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ConfirmDeleteModal = ({
  user,
  onClose,
  onConfirm,
  isLoading
}: {
  user: User;
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
            <h4 className="text-xl font-bold text-hitam">Hapus User</h4>
            <p className="text-sm text-grey mt-1">
              Anda yakin ingin menghapus user **{user.nama_lengkap}** (@{user.username})?
            </p>
          </div>
        </div>
        <p className="text-xs text-grey mt-4 pl-16">
          PERINGATAN: Tindakan ini tidak dapat dibatalkan.
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

const EditUserModal = ({ 
  user, 
  onClose, 
  onRefresh 
}: { 
  user: User | null, 
  onClose: () => void, 
  onRefresh: () => void 
}) => {
  const [formData, setFormData] = useState<UserEditData | null>(null);
  const [listSite, setListSite] = useState<Site[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [listRole, setListRole] = useState<Role[]>([]);
  const [listDepartment, setListDepartment] = useState<Department[]>([]);

  // [UPDATE] Gunakan fetchWithAuth
  useEffect(() => {
    fetchWithAuth('/api/setting/sites', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => setListSite(data.data || []));

    fetchWithAuth('/api/setting/roles', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => setListRole(data.data || []));

    fetchWithAuth('/api/setting/departments', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => setListDepartment(data.data || [])); 
  }, []);

  useEffect(() => {
    if (user) {
      setIsLoading(true);
      // [UPDATE] Gunakan fetchWithAuth untuk detail user
      fetchWithAuth(`/api/users/${user.id}`, { cache: 'no-store' })
        .then(res => res.json())
        .then(result => {
          if (result.data) {
            setFormData(result.data); 
          } else {
            toast.error("Gagal memuat data user.");
            onClose();
          }
        })
        .catch(err => {
          toast.error(`Error: ${err.message}`);
          onClose();
        })
        .finally(() => setIsLoading(false));
    }
  }, [user, onClose]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => prev ? ({
      ...prev,
      [name]: (name === 'site_id' || name === 'role_id' || name === 'department_id') ? parseInt(value) : value
    }) : null);
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData) return;
    
    setIsLoading(true);
    
    try {
      // [UPDATE] Gunakan fetchWithAuth untuk PUT
      const response = await fetchWithAuth(`/api/users/${formData.id}`, {
        method: 'PUT',
        body: JSON.stringify(formData), 
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Gagal memperbarui user');
      }
      
      toast.success('User berhasil diperbarui!');
      onClose();
      onRefresh();
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-hitam/50">
      <div className="bg-putih p-6 rounded-lg shadow-xl w-full max-w-lg">
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-xl font-bold text-hitam">Edit User</h4>
          <button onClick={onClose} className="text-grey hover:text-hitam"><X className="w-6 h-6" /></button>
        </div>
        
        {(!formData || isLoading) ? (
          <div className="text-center py-10">Memuat data user...</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-grey">Username</label>
                <input type="text" id="username" name="username" value={formData.username} onChange={handleChange} required className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru" />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-grey">Password</label>
                <input type="password" id="password" name="password" disabled placeholder="(Tidak dapat diubah)" className="w-full mt-1 p-2 border border-grey/40 rounded bg-grey/10 text-grey" />
              </div>
            </div>
            <div>
              <label htmlFor="nama_lengkap" className="block text-sm font-medium text-grey">Nama Lengkap</label>
              <input type="text" id="nama_lengkap" name="nama_lengkap" value={formData.nama_lengkap} onChange={handleChange} required className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru" />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-grey">Email</label>
              <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} required className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="role_id" className="block text-sm font-medium text-grey">Role (Jabatan)</label>
                <select id="role_id" name="role_id" value={formData.role_id} onChange={handleChange} required className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru">
                  <option value="">Pilih Role</option>
                  {listRole.map(r => (
                    <option key={r.id} value={r.id}>{r.nama_role}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="department_id" className="block text-sm font-medium text-grey">Department</label>
                <select
                  id="department_id"
                  name="department_id"
                  value={formData.department_id}
                  onChange={handleChange}
                  required
                  className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru"
                >
                  <option value="">Pilih Department</option>
                  {listDepartment.map(d => (
                    <option key={d.department_id} value={d.department_id}>{d.nama_department}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="site_id" className="block text-sm font-medium text-grey">Site</label>
                <select id="site_id" name="site_id" value={formData.site_id} onChange={handleChange} required className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru">
                  <option value="">Pilih Site</option>
                  {listSite.map(s => (
                    <option key={s.site_id} value={s.site_id}>{s.nama_site}</option>
                  ))}
                </select>
              </div>
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
        )}
      </div>
    </div>
  );
};

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<any>({});
  
  const [isDeleteLoading, setIsDeleteLoading] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false); 
  const [userToEdit, setUserToEdit] = useState<User | null>(null); 

  // [UPDATE] Gunakan fetchWithAuth
  const fetchUsers = async (currentFilters: any) => {
    setIsLoading(true);
    const params = new URLSearchParams();
    if (currentFilters.site) params.append('site_id', currentFilters.site);
    if (currentFilters.role) params.append('role', currentFilters.role); 
    if (currentFilters.searchQuery) params.append('search', currentFilters.searchQuery);
    
    // URL Relatif
    const endpoint = `/api/users?${params.toString()}`;

    try {
      const response = await fetchWithAuth(endpoint, { cache: 'no-store' });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Gagal mengambil data users');
      }
      const result = await response.json();
      setUsers(result.data || []);
    } catch (error: any) {
      console.error(error);
      toast.error(`Gagal memuat data: ${error.message}`);
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(filters);
  }, [filters]);
  
  const handleFilterChange = (newFilters: any) => {
    setFilters(newFilters);
  };
  
  const handleRefresh = () => {
    setFilters((prevFilters: any )=> ({...prevFilters}));
  }

  const handleAdd = () => setIsAddModalOpen(true);
  const handleEdit = (user: User) => setUserToEdit(user);
  const handleOpenDeleteConfirm = (user: User) => {
    setUserToDelete(user);
  };
  
  // [UPDATE] Gunakan fetchWithAuth
  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    setIsDeleteLoading(true);

    try {
      const response = await fetchWithAuth(`/api/users/${userToDelete.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Gagal menghapus user');
      }
      
      toast.success(`User "${userToDelete.nama_lengkap}" berhasil dihapus.`);
      setUserToDelete(null);
      handleRefresh(); 
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsDeleteLoading(false);
    }
  };

  return (
    <>
      <Toaster position="top-center" />
      <UserFilters onFilterChange={handleFilterChange} />

      <div className="bg-putih p-6 rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-hitam">Master User Management</h3>
          <button
            onClick={handleAdd}
            className="flex items-center px-4 py-2 font-bold text-putih rounded bg-biru hover:bg-biru/90 transition-opacity">
            <Plus className="w-5 h-5 mr-2" />Tambah User</button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-grey/40">
            <thead className="bg-grey/10">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-grey uppercase tracking-wider">Username</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-grey uppercase tracking-wider">Nama Lengkap</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-grey uppercase tracking-wider">Email</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-grey uppercase tracking-wider">Role</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-grey uppercase tracking-wider">Department</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-grey uppercase tracking-wider">Site</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-grey uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-putih divide-y divide-grey/40">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-grey">Loading data...</td>
                </tr>
              ) : users.length > 0 ? (
                users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-hitam">{user.username}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-hitam">{user.nama_lengkap}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-hitam">{user.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-hitam">{user.role}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-hitam">{user.department}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-hitam">{user.site}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button onClick={() => handleEdit(user)} className="text-grey hover:text-biru">
                        <Edit className="w-5 h-5" strokeWidth={2.5} />
                      </button>
                      <button onClick={() => handleOpenDeleteConfirm(user)} className="text-grey hover:text-red-600">
                        <Trash2 className="w-5 h-5" strokeWidth={2.5} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-grey">
                    Data tidak ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {isAddModalOpen && (
        <AddUserModal
          onClose={() => setIsAddModalOpen(false)}
          onRefresh={handleRefresh}
        />
      )}

      {userToDelete && (
        <ConfirmDeleteModal
          user={userToDelete}
          isLoading={isDeleteLoading}
          onClose={() => setUserToDelete(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
      
      {userToEdit && (
        <EditUserModal
          user={userToEdit}
          onClose={() => setUserToEdit(null)}
          onRefresh={handleRefresh}
        />
      )}
    </>
  );
}