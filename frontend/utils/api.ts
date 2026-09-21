// utils/api.ts
import toast from 'react-hot-toast';

export const fetchWithAuth = async (endpoint: string, options: RequestInit = {}) => {
  // 1. Ambil Token dari LocalStorage
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  // 2. Tentukan Base URL (Default ke localhost jika env belum diset)
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';

  // 3. Gabungkan Header Bawaan dengan Header Authorization
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers, // Merge jika ada header tambahan dari luar
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}), // Tambah token jika ada
  } as HeadersInit; // Casting type agar aman

  // 4. Lakukan Fetch
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    // 5. Handle Error Global (Misal Token Expired / 401)
    if (res.status === 401) {
      // Opsional: Redirect ke login jika token hangus
      // window.location.href = '/login'; 
      toast.error("Sesi habis, silakan login kembali.");
      throw new Error("Unauthorized");
    }

    return res;
  } catch (error) {
    throw error;
  }
};