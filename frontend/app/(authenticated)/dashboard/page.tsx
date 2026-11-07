'use client'

import React, { useState, useEffect, useCallback } from 'react'; 
import { fetchWithAuth } from '@/utils/api';
import { useRouter } from 'next/navigation';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { LayoutDashboard, RefreshCw, XCircle } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';

// --- Interfaces ---
interface DashboardData {
  total_audit: number;
  temuan_major: number;
  audit_selesai: number;
  outstanding: {
    audit_id: number;
    judul_audit: string;
    auditors: string; 
    progress: string; 
  }[];
  top_area: {
    nama_area: string;
    total_temuan: number;
    closed: number;
    on_progress: number;
    overdue: number;
    open: number;
    major: number; 
    minor: number; 
    critical: number;
  }[];
  distribusi_temuan: {
    jenis: string;
    count: number;
  }[];
  monitoring_capa: {
    id: number;
    area: string;
    pic: string;
    hari_overdue: number;
    deskripsi: string;
  }[];
  dashboard_report: {
    check_item: string;
    deskripsi: string;
    tindakan_remedial: string;
    pic: string;
    due_date: string;
  }[];
}

interface FilterProps {
  onFilter: (filters: any) => void;
  resetArea: () => void;
  currentFilters: any;
}

const DashboardControls = ({ onFilter, resetArea, currentFilters }: FilterProps) => {
  const [site, setSite] = useState(currentFilters.site_id || '');
  const [jenisAudit, setJenisAudit] = useState(currentFilters.jenis_audit_id || '');
  const [month, setMonth] = useState(currentFilters.month || '');
  const [year, setYear] = useState(currentFilters.year || '');
  const [listSites, setListSites] = useState<any[]>([]);
  const [listJenis, setListJenis] = useState<any[]>([]);

  useEffect(() => {
    fetchWithAuth('/api/setting/sites').then(res => res.json()).then(d => setListSites(d.data || []));
    fetchWithAuth('/api/setting/jenis_audit').then(res => res.json()).then(d => setListJenis(d.data || []));
  }, []);

  return (
    <div className="bg-white p-4 rounded-lg shadow-md mb-6 font-['Arial']">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-grey">Site Location</label>
          <select value={site} onChange={(e) => setSite(e.target.value)} className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru text-sm bg-white font-bold">
            <option value="">Semua Site</option>
            {listSites.map(s => <option key={s.site_id} value={s.site_id}>{s.nama_site}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-grey">Jenis Audit</label>
          <select value={jenisAudit} onChange={(e) => setJenisAudit(e.target.value)} className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru text-sm bg-white font-bold">
            <option value="">Semua Jenis Audit</option>
            {listJenis.map(j => <option key={j.jenis_audit_id} value={j.jenis_audit_id}>{j.nama_jenis_audit}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-grey">Periode</label>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <select value={month} onChange={(e) => setMonth(e.target.value)} className="w-full p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru text-sm bg-white font-bold">
              <option value="">Bulan</option>
              {Array.from({length: 12}, (_, i) => (
                <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('id-ID', {month: 'long'})}</option>
              ))}
            </select>
            <select value={year} onChange={(e) => setYear(e.target.value)} className="w-full p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru text-sm bg-white font-bold">
              <option value="">Tahun</option>
              {[2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-end space-x-2">
          <button onClick={() => onFilter({site_id: site, jenis_audit_id: jenisAudit, month, year})} className="flex-1 px-4 py-2 font-bold text-white rounded bg-biru hover:bg-biru/90 transition-opacity">Filter</button>
          <button onClick={() => { setSite(''); setJenisAudit(''); setMonth(''); setYear(''); resetArea(); onFilter({}); }} className="flex-1 px-4 py-2 font-bold text-hitam rounded bg-grey/30 hover:bg-grey/40 transition-opacity">Reset</button>
        </div>
      </div>
    </div>
  );
};

export default function HomePage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [currentFilters, setCurrentFilters] = useState<any>({});
  const router = useRouter();

  const fetchData = useCallback(async (filters: any, areaName: string | null, status: string | null) => {
    if (!areaName && !status) setLoading(true); 
    const params = new URLSearchParams();
    Object.keys(filters).forEach(key => { if (filters[key]) params.append(key, filters[key]); });
    if (areaName) params.append('area_name', areaName);
    if (status) params.append('status_filter', status);

    try {
      const res = await fetchWithAuth(`/api/dashboard?${params.toString()}`);
      const json = await res.json();
      setData(json.data);
    } catch (err) {
      toast.error("Gagal sinkronisasi data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { 
    // Initial fetch saat halaman diakses atau user berubah
    fetchData({}, null, null); 
  }, [fetchData]);

  // Handler Klik Bar yang sync ke Doughnut dan Table
  const handleManualClick = (areaName: string) => {
    setSelectedArea(areaName);
    setSelectedStatus(null); 
    fetchData(currentFilters, areaName, null);
    toast.success(`Filter Area: ${areaName}`);
  };

  const clearDrillDown = () => {
    setSelectedArea(null);
    setSelectedStatus(null);
    fetchData(currentFilters, null, null);
  };

  // --- Fungsi Export Excel ---
  const handleExportExcel = () => {
    if (!data) return;

    // 1. Persiapkan data untuk Excel
    const excelData = data.top_area.map((area) => {
      // Kita coba cari data major/minor dari distribusi_temuan jika tersedia, 
      // atau gunakan data yang ada di interface top_area
      return {
        'Nama Area': area.nama_area,
        'Total Temuan': area.total_temuan,
        'In Progress': area.on_progress,
        'Closed': area.closed,
        'Overdue': area.overdue,
        'Open': area.open,
        'Major': area.major,
        'Minor': area.minor,
        'Critical': area.critical,
        // Catatan: Jika major/minor ada di level area, masukkan di sini.
        // Jika hanya global, kamu bisa menambahkan kolom info tambahan.
      };
    });

    // 2. Buat Worksheet & Workbook
    const XLSX = require('xlsx');
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Summary Area");

    // 3. Download File
    XLSX.writeFile(workbook, `Report_Dashboard_${new Date().getTime()}.xlsx`);
    toast.success("Excel berhasil diunduh");
  };

  const PIE_COLORS = ['#343694', '#81C040', '#F59E0B', '#EF4444', '#A9A9A9'];

  if (loading && !data) return (
    <div className="flex h-screen items-center justify-center font-bold text-biru animate-pulse text-sm font-['Arial'] bg-grey/5">
       <RefreshCw className="w-5 h-5 mr-3 animate-spin" /> MENARIK DATA DASHBOARD...
    </div>
  );

  const getModulePath = (progress: string, auditId: number) => {
    const text = progress.toUpperCase();
    
    if (text.includes('BUKTI PERBAIKAN')) {
      return `/laporan-bukti-perbaikan/${auditId}`;
    } 
    if (text.includes('TINDAK LANJUT')) {
      return `/laporan-temuan/tindak-lanjut/${auditId}`;
    }
    if (text.includes('LAPORAN AUDITOR')) {
      return `/laporan-temuan/${auditId}`;
    }
    if (text.includes('REVIEW QS')) {
    return `/laporan-temuan/review-qs/${auditId}`;
    }
    if (text.includes('APPROVE')) {
    return `/laporan-temuan/final-approve/${auditId}`;
    }
    return `/checklist/pelaksanaan-audit/${auditId}`;
  };

  return (
    <div className="pb-20 bg-grey/5 min-h-screen p-4 md:p-6 text-hitam font-['Arial']">
      <Toaster position="top-center" />
      
      <DashboardControls 
        currentFilters={currentFilters}
        onFilter={(f: any) => { 
          setCurrentFilters(f); 
          fetchData(f, null, null); 
          setSelectedArea(null); 
          setSelectedStatus(null); 
        }} 
        resetArea={clearDrillDown} 
      />
      
      {data && (
        <div className="animate-in fade-in duration-500">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow-md border-t-4 border-biru">
              <h3 className="text-xs font-bold text-grey uppercase italic tracking-wider">Total Audit (Aktif)</h3>
              <p className="text-3xl font-bold mt-2">{data.total_audit}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md border-t-4 border-red-500">
              <h3 className="text-xs font-bold text-grey uppercase italic tracking-wider">Temuan Major</h3>
              <p className="text-3xl font-bold text-red-600 mt-2">{data.temuan_major}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md border-t-4 border-hijau">
              <h3 className="text-xs font-bold text-grey uppercase italic tracking-wider">Audit Selesai</h3>
              <p className="text-3xl font-bold text-hijau mt-2">{data.audit_selesai}</p>
            </div>
          </div>

          {/* Tombol Export */}
          <div className="flex justify-end mb-4">
            <button 
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-4 py-2 bg-hijau hover:bg-hijau text-white rounded shadow-md transition-all font-bold text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              EXPORT EXCEL
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* --- ACTION REQUIRED TABLE --- */}
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-md font-bold mb-4 uppercase tracking-tight">Outstanding</h3>
                <div className="overflow-x-auto max-h-72">
                  <table className="min-w-full text-sm divide-y divide-grey/20">
                    <thead className="bg-grey/10 font-bold text-xs uppercase text-grey">
                      <tr><th className="px-4 py-2 text-left">Audit Info</th><th className="px-4 py-2 text-right">Pending Modul</th></tr>
                    </thead>
                    <tbody className="divide-y divide-grey/20">
                      {data.outstanding?.length > 0 ? data.outstanding.map((item, i) => (
                        <tr key={i} className="hover:bg-biru/5 cursor-pointer" onClick={() => {const path = getModulePath(item.progress, item.audit_id);router.push(path);}}>
                          <td className="px-4 py-3">
                            <div className="font-bold text-sm">{item.judul_audit}</div>
                            <div className="text-[10px] text-grey uppercase font-medium">{item.auditors}</div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="px-2 py-1 bg-biru text-white font-bold rounded text-[10px] uppercase shadow-sm">{item.progress}</span>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                           <td colSpan={2} className="py-10 text-center text-grey italic text-xs font-bold uppercase tracking-widest">Tidak ada tugas tertahan di Anda</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* --- MONITORING CAPA TABLE --- */}
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-md font-bold mb-4 uppercase tracking-tight">Monitoring PIC</h3>
                <div className="overflow-x-auto max-h-72">
                  <table className="min-w-full text-sm divide-y divide-grey/20">
                    <thead className="bg-grey/10 font-bold text-[10px] uppercase text-grey">
                      <tr><th className="px-4 py-2 text-left">Area</th><th className="px-4 py-2 text-left">PIC</th><th className="px-4 py-2 text-right">Overdue</th></tr>
                    </thead>
                    <tbody className="divide-y divide-grey/20 font-bold">
                      {data.monitoring_capa?.map((item, i) => (
                        <tr key={i} className="hover:bg-red-50">
                          <td className="px-4 py-3 text-biru text-xs uppercase">{item.area}</td>
                          <td className="px-4 py-3 text-xs font-medium">{item.pic}</td>
                          <td className="px-4 py-3 text-right">
                            <span className="bg-red-500 text-white px-2 py-1 rounded text-[10px] font-bold uppercase">{item.hari_overdue} Hari</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Doughnut Chart */}
            <div className="lg:col-span-1 bg-white rounded-lg shadow-md border border-grey/20 overflow-hidden">
              <div className="bg-grey/10 px-4 py-2 text-xs font-bold border-b border-grey/20 uppercase text-grey text-center">
                Kategori Temuan {selectedArea ? `Area ${selectedArea}` : 'Total'}
              </div>
              <div className="h-72 p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={data.distribusi_temuan || []} 
                        innerRadius={60} 
                        outerRadius={80} 
                        paddingAngle={5} 
                        dataKey="count" 
                        nameKey="jenis"
                      >
                        {(data.distribusi_temuan || []).map((_, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{fontSize: '11px', fontWeight: '600'}} />
                    </PieChart>
                  </ResponsiveContainer>
              </div>
            </div>

            {/* Bar Chart Area */}
            <div className="lg:col-span-2 bg-white rounded-lg shadow-md border border-grey/20 overflow-hidden">
              <div className="bg-grey/10 px-4 py-2 text-xs font-bold border-b border-grey/20 uppercase text-grey flex justify-between items-center">
                Jumlah CAPA per Area
                {(selectedArea || selectedStatus) && (
                  <button onClick={clearDrillDown} className="text-red-500 hover:text-red-700 flex items-center gap-1 text-[10px] font-bold pr-2 uppercase">
                    <XCircle className="w-3 h-3" /> RESET DRILL-DOWN
                  </button>
                )}
              </div>
              <div className="h-72 p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.top_area || []} margin={{top: 20, right: 10, left: -20, bottom: 0}}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                    <XAxis dataKey="nama_area" fontSize={11} tick={{fill: '#666'}} axisLine={false} tickLine={false} />
                    <YAxis fontSize={11} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{fill: 'rgba(0,0,0,0.02)'}} wrapperStyle={{ pointerEvents: 'none' }} />
                    <Legend 
                      verticalAlign="top" align="right" iconType="rect" 
                      wrapperStyle={{fontSize: '11px', paddingBottom: '10px', fontWeight: '600', cursor: 'pointer'}} 
                      onClick={(e: any) => {
                        const statusParam = String(e.dataKey).toUpperCase();
                        setSelectedStatus(statusParam);
                        setSelectedArea(null);
                        fetchData(currentFilters, null, statusParam);
                      }}
                    />
                    
                    {['closed', 'on_progress', 'overdue', 'open'].map((key) => (
                      <Bar 
                        key={key} 
                        dataKey={key} 
                        stackId="a" 
                        fill={key === 'closed' ? '#81C040' : key === 'on_progress' ? '#F59E0B' : key === 'overdue' ? '#EF4444' : '#343694'} 
                        barSize={30}
                      >
                        {data.top_area.map((entry, index) => (
                          <Cell 
                            key={`cell-${key}-${index}`} 
                            style={{ cursor: 'pointer' }}
                            onClick={() => handleManualClick(entry.nama_area)}
                            fillOpacity={selectedArea === null || selectedArea === entry.nama_area ? 1 : 0.15} 
                          />
                        ))}
                      </Bar>
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Table Report Detail */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden border border-grey/20">
            <div className="p-4 border-b border-grey/20 bg-grey/5">
              <h3 className="font-bold uppercase text-sm italic tracking-tight">
                Data Report {selectedArea && `- Area: ${selectedArea}`} {selectedStatus && `(${selectedStatus})`}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm divide-y divide-grey/20">
                <thead className="bg-grey/10 font-bold text-[10px] uppercase text-grey">
                  <tr>
                    <th className="px-4 py-3 text-center border-r border-grey/20">NO</th>
                    <th className="px-4 py-3 text-left border-r border-grey/20">Check Item</th>
                    <th className="px-4 py-3 text-left border-r border-grey/20">Deskripsi</th>
                    <th className="px-4 py-3 text-left border-r border-grey/20">Tindakan Remedial</th>
                    <th className="px-4 py-3 text-center border-r border-grey/20">PIC</th>
                    <th className="px-4 py-3 text-center">Due Date</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-grey/20 text-xs font-bold">
                  {data.dashboard_report?.length > 0 ? data.dashboard_report.map((report, idx) => (
                    <tr key={idx} className="hover:bg-grey/5 transition-colors">
                      <td className="px-4 py-3 text-center border-r border-grey/10">{idx + 1}.</td>
                      <td className="px-4 py-3 font-bold text-biru uppercase border-r border-grey/10">{report.check_item}</td>
                      <td className="px-4 py-3 border-r border-grey/10 font-medium leading-relaxed">{report.deskripsi}</td>
                      <td className="px-4 py-3 italic text-biru border-r border-grey/10 font-medium leading-relaxed">{report.tindakan_remedial}</td>
                      <td className="px-4 py-3 text-center border-r border-grey/10 uppercase tracking-tighter">{report.pic}</td>
                      <td className="px-4 py-3 text-center italic text-grey font-medium">{report.due_date}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={6} className="py-20 text-center text-grey italic font-bold">
                        {selectedArea 
                          ? `Tidak ada data temuan untuk area ${selectedArea}` 
                          : "Silakan klik batang grafik pada area tertentu untuk melihat detail laporan."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}