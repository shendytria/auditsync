'use client'

import React, { useState, useEffect, useRef } from 'react'; 
import Image from 'next/image';
import { 
  Home, Users, CheckSquare, FileText, Settings, LogOut, ChevronDown, User, ClipboardCheck, BadgeCheck, History, 
  BarChart3,
  AlertTriangle 
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore'; 
import Link from 'next/link'; 

const Sidebar = () => {
  const { logout, user } = useAuthStore();

  const menuItems = [
    { name: 'Home', icon: Home, href: '/dashboard' },
    { name: 'Users', icon: Users, href: '/users' },
    { name: 'Checklist', icon: CheckSquare, href: '/checklist' },
    { name: 'Laporan Temuan', icon: FileText, href: '/laporan-temuan' },
    { name: 'Laporan Bukti Perbaikan', icon: ClipboardCheck, href: '/laporan-bukti-perbaikan' },
    { name: 'Verifikasi', icon: BadgeCheck, href: '/verifikasi' }, 
    { name: 'Report', icon: BarChart3, href: '/report' }, 
    { name: 'Audit Trail', icon: History, href: '/audit-trail' }, 
    { name: 'Setting', icon: Settings, href: '/setting' },
  ];

  const visibleMenuItems = menuItems.filter((item) => {
    if (item.name === 'Setting') {
      return user?.role === 'QS supervisor';
    }
    return true;
  });

  const handleLogout = () => {
    logout();
    window.location.href = '/login'; 
  };

  return (
    <div className="w-64 h-screen bg-gradient-to-b from-biru to-hijau shadow-lg fixed top-0 left-0 p-4 flex flex-col">
      <div className="flex items-center gap-2 mb-10">
        <Image 
          src="/logoOnly.png" 
          alt="Logo" 
          width={30} 
          height={30} 
          priority 
          className="flex-shrink-0" 
        />
        <div className="flex flex-col">
          <h2 className="text-2xl font-bold text-putih leading-none">AuditSync</h2>
          <p className="text-sm font-semibold text-putih/90 leading-none mt-1">Process and HSE</p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto">
        <ul>
          {/* 3. Render menggunakan variable 'visibleMenuItems' yang sudah difilter */}
          {visibleMenuItems.map((item) => (
            <li key={item.name}>
              <Link href={item.href} className="flex items-center p-3 my-2 text-putih/80 rounded-md hover:bg-white/10 hover:text-putih transition-colors">
                <item.icon className="w-5 h-5 mr-3" />
                {item.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <button onClick={handleLogout} className="flex items-center p-3 my-2 text-putih/80 rounded-md hover:bg-white/10 hover:text-putih transition-colors mt-4">
        <LogOut className="w-5 h-5 mr-3" />
        LogOut
      </button>
    </div>
  );
};

const DashboardHeader = () => {
  const { user } = useAuthStore();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownRef]);

  return (
    <div className="bg-putih border-b border-grey/20"> 
      <div className="p-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-hitam">Hello, {user?.fullName || 'User'}!</h1>
          <p className="text-grey">Aktivitas Audit Anda.</p>
        </div>
        
        <div className="relative" ref={dropdownRef}>
          <button 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-2 cursor-pointer"
          >
            <div className="text-right">
              <p className="text-sm font-medium text-hitam">{user?.fullName || 'User'}</p>
              <p className="text-xs text-grey">{user?.role || 'Role'}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-biru/10 flex items-center justify-center">
               <User className="w-6 h-6 text-biru" />
            </div>
            <ChevronDown className={`w-5 h-5 text-grey transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {isDropdownOpen && (
            <div className="absolute top-full right-0 mt-2 w-72 bg-putih rounded-md shadow-lg z-20 border border-grey/20">
              <div className="p-4 border-b border-grey/20">
                <p className="font-bold text-hitam text-base">{user?.fullName}</p>
                <p className="text-sm text-grey">{user?.email}</p>
              </div>
              <div className="p-4 border-b border-grey/20">
                <dl>
                  <dt className="text-xs text-grey uppercase font-semibold">Username</dt>
                  <dd className="text-sm text-hitam mb-2">{user?.username}</dd>
                  <dt className="text-xs text-grey uppercase font-semibold">Role</dt>
                  <dd className="text-sm text-hitam">{user?.role}</dd>
                </dl>
              </div>
              
              <div className="p-2">
                <Link 
                  href="/profile" 
                  className="flex items-center p-2 text-sm text-hitam rounded-md hover:bg-grey/10"
                  onClick={() => setIsDropdownOpen(false)} 
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Ganti Password
                </Link>
              </div>
              
            </div>
          )}
        </div>
        {/* Akhir Profile Dropdown */}
        
      </div>
    </div>
  );
};

const PasswordWarningBanner = () => {
  return (
    <div className="bg-kuning/20 text-hitam p-2 text-sm text-center animate-pulse">
      <div className="flex items-center justify-center">
        <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0" />
        <span className="font-semibold">PERINGATAN:</span>
        <span className="ml-1">Password Anda masih default. Harap segera ganti password Anda di menu profile (klik nama Anda).</span>
      </div>
    </div>
  )
}

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { isDefaultPassword } = useAuthStore();

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 ml-64 h-screen overflow-y-auto bg-putih">
        <div className="sticky top-0 z-10 bg-putih shadow-sm">
          {isDefaultPassword && <PasswordWarningBanner />}
          <DashboardHeader />
        </div>
        
        <div className="flex-1 p-8">
          {children}
        </div>

        {/* Footer */}
        <footer className="border-t border-gray-200 py-3 bg-white">
          <p className="text-xs text-gray-500 text-center leading-relaxed">
            © {new Date().getFullYear()} Quality System. Developed by Vanesha Dhani. All rights reserved.
          </p>
        </footer>
      </main>
    </div>
  );
}