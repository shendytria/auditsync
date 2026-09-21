'use client'

import { useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, Lock, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { Toaster, toast } from 'react-hot-toast';

export default function ProfilePage() {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  
  const { user, updatePasswordStatus } = useAuthStore();

  const passwordIsValid = newPassword.length >= 8 && /[A-Z]/.test(newPassword) && /\d/.test(newPassword);
  const passwordsMatch = newPassword && newPassword === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast.error("Password Baru dan Konfirmasi Password tidak cocok.");
      return;
    }
    if (!passwordIsValid) {
      toast.error("Password Baru tidak memenuhi syarat.");
      return;
    }
    if (!user) {
      toast.error("Sesi Anda tidak valid. Silakan login ulang.");
      return;
    }
    
    setIsLoading(true);

    try {
      const response = await fetch(`/api/users/${user.id}/change-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          old_password: oldPassword,
          new_password: newPassword
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Gagal mengganti password');
      }
      
      toast.success('Password berhasil diperbarui!');
      
      updatePasswordStatus();
      
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');

    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Toaster position="top-center" />
      
      <div className="mb-4">
        <Link 
          href="/dashboard" 
          className="flex items-center text-biru hover:underline mb-4 font-arial"><ArrowLeft className="w-4 h-4 mr-1" />Kembali ke Beranda
        </Link>
      </div>

      <div className="bg-putih p-6 rounded-lg shadow-md max-w-2xl mx-auto">
        <h3 className="text-xl font-bold text-hitam mb-4">Ganti Password</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label 
              htmlFor="old_password" 
              className="block text-sm font-medium text-grey">Password Saat Ini (atau Default)</label>
            <div className="relative">
              <input
                id="old_password"
                name="old_password"
                type={showOld ? 'text' : 'password'}
                required
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full px-4 py-2 border rounded border-grey/40 focus:outline-none focus:ring-2 focus:ring-biru"
                disabled={isLoading}/>
              <button
                type="button"
                onClick={() => setShowOld(!showOld)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-grey">
                {showOld ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          
          <div>
            <label 
              htmlFor="new_password" 
              className="block text-sm font-medium text-grey"
            >
              Password Baru
            </label>
            <div className="relative">
              <input
                id="new_password"
                name="new_password"
                type={showNew ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={`w-full px-4 py-2 border rounded border-grey/40 focus:outline-none focus:ring-2 ${
                  newPassword && !passwordIsValid ? 'ring-red-500 border-red-500' : 'focus:ring-biru'
                }`}
                disabled={isLoading}/>
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-grey">
                {showNew ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-F5" />}
              </button>
            </div>
            <ul className="text-xs text-grey mt-2 list-disc list-inside">
              <li className={newPassword.length >= 8 ? 'text-hijau' : ''}>Minimal 8 karakter</li>
              <li className={/[A-Z]/.test(newPassword) ? 'text-hijau' : ''}>Minimal 1 huruf besar</li>
              <li className={/\d/.test(newPassword) ? 'text-hijau' : ''}>Minimal 1 angka</li>
            </ul>
          </div>
          
          <div>
            <label 
              htmlFor="confirm_password" 
              className="block text-sm font-medium text-grey">Konfirmasi Password Baru</label>
            <div className="relative">
              <input
                id="confirm_password"
                name="confirm_password"
                type={showConfirm ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`w-full px-4 py-2 border rounded border-grey/40 focus:outline-none focus:ring-2 ${
                  confirmPassword && !passwordsMatch ? 'ring-red-500 border-red-500' : 'focus:ring-biru'
                }`}
                disabled={isLoading}/>
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-grey">
                {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {confirmPassword && !passwordsMatch && (
              <p className="text-xs text-red-500 mt-1">Password tidak cocok.</p>
            )}
          </div>
          
          <div className="flex justify-end pt-4">
            <button
              type="submit"
              className="flex items-center px-4 py-2 font-bold text-putih rounded bg-biru hover:bg-biru/90 transition-opacity disabled:bg-biru-400"
              disabled={isLoading || !passwordIsValid || !passwordsMatch}
            >
              <Lock className="w-4 h-4 mr-2" />
              {isLoading ? 'Menyimpan...' : 'Simpan Password'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}