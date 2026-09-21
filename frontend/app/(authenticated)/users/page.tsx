'use client'

import { useState, useEffect } from 'react';
import { Toaster, toast } from 'react-hot-toast'; 

interface Site {
  site_id: number;
  nama_site: string;
}

// --- PERUBAHAN: Menambahkan interface Role ---
interface Role {
  id: number;
  nama_role: string;
}
// --- BATAS PERUBAHAN ---

interface User {
  id: number;
  username: string;
  nama_lengkap: string;
  email: string;
  role: string; 
  site: string;
  department: string;
}

const UserFilters = ({ onFilterChange }: { onFilterChange: (filters: any) => void }) => {
  const [site, setSite] = useState('');
  const [role, setRole] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [listSite, setListSite] = useState<Site[]>([]);
  
  // --- PERUBAHAN: Menghapus listRole hardcoded dan menggantinya dengan state ---
  const [listRole, setListRole] = useState<Role[]>([]);
  
  useEffect(() => {
   const token = localStorage.getItem("token");

    fetch('/api/setting/sites', {
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

      .then(res => res.json())
      .then(data => setListSite(data.data || []));

    fetch('/api/setting/roles', {
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
      },
    })

      .then(res => res.json())
      .then(data => setListRole(data.data || []));
  }, []);
  // --- BATAS PERUBAHAN ---

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
            {/* --- PERUBAHAN: Iterasi listRole dari state API --- */}
            {/* Kita kirim 'nama_role' (string) sebagai value, sesuai controller filter di backend */}
            {listRole.map(r => <option key={r.id} value={r.nama_role}>{r.nama_role}</option>)}
            {/* --- BATAS PERUBAHAN --- */}
          </select>
        </div>
        {/* Search */}
        <div>
          <label htmlFor="search" className="block text-sm font-medium text-grey">Search</label>
          <input type="text" id="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
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

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<any>({});

  const fetchUsers = async (currentFilters: any) => {
  setIsLoading(true);

  const params = new URLSearchParams();
  if (currentFilters.site) params.append('site_id', currentFilters.site);
  if (currentFilters.role) params.append('role', currentFilters.role);
  if (currentFilters.searchQuery) params.append('search', currentFilters.searchQuery);

  const url = `/api/users?${params.toString()}`;

  try {
    const token = localStorage.getItem("token");

    const response = await fetch(url, {
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

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

  return (
    <>
      <Toaster position="top-center" />
      <UserFilters onFilterChange={handleFilterChange} />

      <div className="bg-putih p-6 rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-hitam">Daftar User E-Audit</h3>
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
              </tr>
            </thead>
            <tbody className="bg-putih divide-y divide-grey/40">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-grey">Loading data...</td>
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
    </>
  );
}