'use client'

import React from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

const SettingsNav = () => {
  const pathname = usePathname();

  const navItems = [
    { name: 'Checklist Settings', href: '/setting' },
    { name: 'User Management', href: '/setting/users' },
    { name: 'Area Configuration', href: '/setting/area' },
    { name: 'Delegation Approval', href: '/setting/delegation' },
  ];

  return (
    <nav className="flex space-x-2 border-b border-grey/20 px-8">
      {navItems.map((item) => (
        <Link
          key={item.name}
          href={item.href}
          className={`px-4 py-3 font-medium
            ${pathname === item.href ? 'bg-hijau text-putih' : 'text-grey hover:text-hitam'
            }
          `}
        >
          <span>{item.name}</span>
        </Link>
      ))}
    </nav>
  );
};

export default function SettingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="-mt-8 -mx-8">
      <SettingsNav />
      
      {}
      <div className="p-8">
        {children}
      </div>
    </div>
  );
}