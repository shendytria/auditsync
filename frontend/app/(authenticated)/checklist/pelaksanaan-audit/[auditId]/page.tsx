'use client'

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast, Toaster } from 'react-hot-toast';
import { ArrowLeft, Camera, Paperclip, Save, X, Edit, Plus, FileText, CheckCircle, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { fetchWithAuth } from '@/utils/api';
import { getStatusColor, getStatusLabel } from '@/utils/statusHelper';
import { AuditCheckItem, AuditHeaderInfo } from '@/types/audit';

// --- INTERFACES LOKAL ---
interface Answer {
    status: 'OK' | 'NOK' | 'N/A' | null;
    deskripsi_temuan: string;
    lokasi_temuan: string;
    files: File[];
    existingFiles: string[];
}

type ChecklistItemWithAnswer = AuditCheckItem & {
    answer: Answer;
};

// --- KOMPONEN HEADER ---
const AuditHeader = ({ info }: { info: AuditHeaderInfo }) => {
    return (
        <div className="bg-putih p-6 rounded-lg shadow-md mb-6 border border-grey/20">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
                <div>
                    <p className="text-sm font-medium text-grey">Nama Checklist</p>
                    <p className="text-lg font-bold text-hitam">{info.nama_checklist}</p>
                </div>
                <div>
                    <p className="text-sm font-medium text-grey">Auditor</p>
                    <p className="text-lg font-bold text-hitam">{info.nama_auditor}</p>
                </div>
                <div>
                    <p className="text-sm font-medium text-grey">Tanggal Pelaksanaan</p>
                    <p className="text-lg font-bold text-hitam">
                        {new Date(info.tanggal_audit).toLocaleDateString('id-ID', {
                            day: '2-digit', month: 'long', year: 'numeric'
                        })}
                    </p>
                </div>
                <div>
                    <p className="text-sm font-medium text-grey">Jenis Audit</p>
                    <p className="text-lg font-bold text-hitam">{info.nama_jenis_audit}</p>
                </div>
                <div>
                    <p className="text-sm font-medium text-grey">Department</p>
                    <p className="text-lg font-bold text-hitam">{info.nama_department}</p>
                </div>
                <div>
                    <p className="text-sm font-medium text-grey">Status</p>
                    <span className={`inline-flex px-2 py-1 rounded text-xs font-bold mt-1 ${getStatusColor(info.status_laporan)}`}>
                        {getStatusLabel(info.status_laporan)}
                    </span>
                </div>
            </div>
        </div>
    );
};

// --- KOMPONEN NOK MODAL ---
interface NokModalProps { 
    item: ChecklistItemWithAnswer;
    onClose: () => void;
    onSave: (itemId: number | string, temuanData: Pick<Answer, 'deskripsi_temuan' | 'lokasi_temuan' | 'files'>) => void;
}

const NokModal = ({ item, onClose, onSave }: NokModalProps) => { 
    const MAX_FILE_SIZE_MB = 5;
    const MAX_FILES = 5;
    const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

    const [deskripsi, setDeskripsi] = useState(item.answer.deskripsi_temuan);
    const [lokasi, setLokasi] = useState(item.answer.lokasi_temuan);

    const initialFiles: (string | File)[] = [
        ...item.answer.existingFiles,
        ...item.answer.files
    ];
    const [allCurrentFiles, setAllCurrentFiles] = useState<(string | File)[]>(initialFiles);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const totalFiles = allCurrentFiles.length;

        if (!deskripsi || !lokasi) {
            toast.error('Deskripsi temuan dan Lokasi wajib diisi.', { icon: '⚠️' });
            return;
        }
        if (totalFiles === 0) {
            toast.error('Bukti temuan (Foto/Dokumen) wajib dilampirkan.', { icon: '⚠️' });
            return;
        }

        onSave(item.item_id, {
            deskripsi_temuan: deskripsi,
            lokasi_temuan: lokasi,
            files: allCurrentFiles as any 
        });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        const filesArray = Array.from(e.target.files);
        const currentTotalFiles = allCurrentFiles.length;
        const validFiles: File[] = [];
        let sizeError = false;

        filesArray.forEach(file => {
            if (file.size > MAX_FILE_SIZE_BYTES) {
                sizeError = true;
            } else if (currentTotalFiles + validFiles.length < MAX_FILES) {
                validFiles.push(file);
            }
        });

        if (sizeError) {
            toast.error(`File terlalu besar (Max ${MAX_FILE_SIZE_MB}MB).`, { icon: '⚠️' });
        }

        const spaceLeft = MAX_FILES - currentTotalFiles;
        setAllCurrentFiles(prev => [...prev, ...validFiles.slice(0, spaceLeft)]);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const removeFile = (fileToRemove: string | File) => {
        setAllCurrentFiles(prev => prev.filter(f => f !== fileToRemove));
    };

    const triggerCameraInput = () => {
    if (allCurrentFiles.length >= MAX_FILES) return;
    cameraInputRef.current?.click();
    };

    const triggerFileInput = () => {
        if (allCurrentFiles.length >= MAX_FILES) return;
        fileInputRef.current?.click();
    };

    const isSaveDisabled = !deskripsi || !lokasi || (allCurrentFiles.length === 0);

    return (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-hitam/60 p-4">
            <div className="bg-putih p-6 rounded-lg shadow-xl w-full max-w-lg animate-in zoom-in duration-200">
                <div className="flex justify-between items-center mb-4 border-b border-grey/20 pb-2">
                    <h4 className="text-xl font-bold text-hitam">Detail Temuan (NOK)</h4>
                    <button onClick={onClose} className="text-grey hover:text-hitam"><X className="w-6 h-6" /></button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-grey">Check Item</label>
                        <p className="text-sm text-hitam p-3 bg-grey/10 rounded mt-1 border border-grey/20">{item.item_checklist_text}</p>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-grey">
                            Deskripsi Temuan <span className="text-red-600">*</span>
                        </label>
                        <textarea
                            rows={3}
                            value={deskripsi}
                            onChange={(e) => setDeskripsi(e.target.value)}
                            className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru text-hitam"
                            placeholder="Jelaskan temuan ketidaksesuaian..."
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-grey">
                            Lokasi Temuan <span className="text-red-600">*</span>
                        </label>
                        <input
                            type="text"
                            value={lokasi}
                            onChange={(e) => setLokasi(e.target.value)}
                            className="w-full mt-1 p-2 border border-grey/40 rounded focus:outline-none focus:ring-2 focus:ring-biru text-hitam"
                            placeholder="Contoh: Area Blending, Mesin 02"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-grey">
                            Upload Bukti (Max {MAX_FILES} File / {MAX_FILE_SIZE_MB}MB per file)
                            <span className="text-red-600">*</span>
                        </label>
                            <input type="file" ref={cameraInputRef} multiple onChange={handleFileChange} className="hidden" accept="image/*" capture="environment"/>
                            <input type="file" ref={fileInputRef} multiple onChange={handleFileChange} className="hidden" accept="image/*,application/pdf"/>
                        <div className="mt-2 flex gap-2">
                            <button
                                type="button"
                                onClick={triggerCameraInput}
                                disabled={allCurrentFiles.length >= MAX_FILES}
                                className="flex items-center px-3 py-2 text-sm bg-biru text-putih border border-biru rounded hover:bg-biru/90 disabled:opacity-50"
                            >
                                <Camera className="w-4 h-4 mr-2" />
                                Ambil Foto
                            </button>

                            <button
                                type="button"
                                onClick={triggerFileInput}
                                disabled={allCurrentFiles.length >= MAX_FILES}
                                className="flex items-center px-3 py-2 text-sm bg-grey/10 text-hitam border border-grey/20 rounded hover:bg-grey/20 disabled:opacity-50"
                            >
                                <Paperclip className="w-4 h-4 mr-2" />
                                Upload File
                            </button>
                        </div>
                        {allCurrentFiles.length > 0 && (
                            <div className="mt-3 space-y-2">
                                {allCurrentFiles.map((fileOrPath, index) => {
                                    const isExisting = typeof fileOrPath === 'string';
                                    const fileName = isExisting ? (fileOrPath.split('/').pop() || 'File lama') : (fileOrPath as File).name;
                                    return (
                                        <div key={index} className={`flex items-center justify-between text-sm p-2 rounded border ${isExisting ? 'bg-hijau/5 border-hijau/20 text-hijau' : 'bg-grey/5 border-grey/20 text-hitam'}`}>
                                            <span className="truncate w-64">
                                                {fileName}
                                                {typeof fileOrPath !== 'string' && (
                                                    <span className="text-grey ml-2 text-[10px]">
                                                    ({((fileOrPath as File).size / 1024 / 1024).toFixed(2)} MB ({fileOrPath.type}))
                                                    </span>
                                                )}
                                            </span>
                                            <button type="button" onClick={() => removeFile(fileOrPath)} className="text-red-600 hover:text-red-800"><X className="w-4 h-4" /></button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end space-x-2 pt-4 border-t border-grey/20">
                        <button type="button" onClick={onClose} className="px-4 py-2 font-bold text-hitam rounded bg-grey/20 hover:bg-grey/30">Batal</button>
                        <button type="submit" disabled={isSaveDisabled} className="px-4 py-2 font-bold text-putih rounded bg-biru hover:bg-biru/90 disabled:opacity-50 disabled:cursor-not-allowed">Simpan Temuan</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- KOMPONEN AD HOC MODAL ---
const AddAdHocItemModal = ({ onClose, onSave }: { onClose: () => void; onSave: (itemData: any) => void }) => {
    const [checkItemText, setCheckItemText] = useState('');
    const [refDoc, setRefDoc] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!checkItemText) { toast.error('Check Item wajib diisi.'); return; }
        onSave({ item_checklist_text: checkItemText, referensi_doc: refDoc || null });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-hitam/60 p-4">
            <div className="bg-putih p-6 rounded-lg shadow-xl w-full max-w-lg">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="text-xl font-bold text-hitam">Tambah Item Baru (Ad-Hoc)</h4>
                    <button onClick={onClose} className="text-grey hover:text-hitam"><X className="w-6 h-6" /></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-grey">Check Item <span className="text-red-600">*</span></label>
                        <textarea rows={3} value={checkItemText} onChange={(e) => setCheckItemText(e.target.value)} className="w-full mt-1 p-2 border border-grey/40 rounded focus:ring-2 focus:ring-biru outline-none text-hitam" placeholder="Tuliskan check item..." />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-grey">Referensi Dokumen</label>
                        <input type="text" value={refDoc} onChange={(e) => setRefDoc(e.target.value)} className="w-full mt-1 p-2 border border-grey/40 rounded focus:ring-2 focus:ring-biru outline-none text-hitam" placeholder="Contoh: SOP-XXX" />
                    </div>
                    <div className="flex justify-end space-x-2 pt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 font-bold text-hitam rounded bg-grey/20 hover:bg-grey/30">Batal</button>
                        <button type="submit" className="px-4 py-2 font-bold text-putih rounded bg-biru hover:bg-biru/90">Tambah</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- KOMPONEN FILE DISPLAY ---
const FileDisplay = ({ filePath }: { filePath: string }) => {
    if (!filePath || filePath === '-') return <span>-</span>
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || ''
    let normalizedPath = String(filePath).replace(/\\/g, '/')
    if (normalizedPath.startsWith('/')) normalizedPath = normalizedPath.substring(1)
    const fullUrl = `${API_BASE}/${normalizedPath}`
    const fileName = normalizedPath.split('/').pop() || 'File'

    return (
        <a href={fullUrl} target="_blank" rel="noopener noreferrer" className="flex items-center p-1.5 bg-grey/5 rounded border border-grey/20 hover:bg-biru/5 hover:text-biru hover:border-biru/30 transition-colors text-xs text-grey max-w-fit group" title={fileName}>
            <FileText className="h-3 w-3 mr-1.5 flex-shrink-0 group-hover:text-biru" />
            <span className="truncate max-w-[100px]">{fileName}</span>
        </a>
    )
}

// --- 5. HALAMAN UTAMA PENGISIAN CHECKLIST ---
export default function PengisianChecklistPage() {
    const router = useRouter();
    const params = useParams();
    const auditId = params.auditId as string;

    const [auditInfo, setAuditInfo] = useState<AuditHeaderInfo | null>(null);
    const [checklistWithAnswers, setChecklistWithAnswers] = useState<ChecklistItemWithAnswer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    // State Modal
    const [nokModalItemId, setNokModalItemId] = useState<number | string | null>(null);
    const [isAdHocModalOpen, setIsAdHocModalOpen] = useState(false);

    // Grouping Logic
    const groupedItems = useMemo(() => {
        const groups = new Map<string, Map<string, ChecklistItemWithAnswer[]>>();
        const KATEGORI_UMUM = "Lain-lain";
        const SUB_KATEGORI_UMUM = "Umum";

        checklistWithAnswers.forEach(item => {
            const kategori = item.kategori || KATEGORI_UMUM;
            const subKategori = item.sub_kategori || SUB_KATEGORI_UMUM;

            if (!groups.has(kategori)) groups.set(kategori, new Map());
            const subGroups = groups.get(kategori)!;
            if (!subGroups.has(subKategori)) subGroups.set(subKategori, []);
            subGroups.get(subKategori)!.push(item);
        });
        return groups;
    }, [checklistWithAnswers]);

    // FETCH DATA UTAMA
    const fetchAuditDetails = useCallback(async () => {
        if (!auditId) return;
        try {
            const res = await fetchWithAuth(`/api/audit/${auditId}/details`, { cache: 'no-store' });
            if (!res.ok) throw new Error("Gagal load data audit");
            const result = await res.json();
            
            if (result.data) {
                setAuditInfo(result.data.audit_info);
                const items = result.data.check_items.map((item: any) => {
                    let existingFiles: string[] = [];
                    try {
                        if (item.bukti_temuan) {
                            const parsed = JSON.parse(item.bukti_temuan);
                            if (Array.isArray(parsed)) existingFiles = parsed;
                        }
                    } catch {}
                    
                    return {
                        ...item,
                        answer: {
                            status: item.status || null,
                            deskripsi_temuan: item.deskripsi_temuan || '',
                            lokasi_temuan: item.lokasi_temuan || '',
                            existingFiles: existingFiles,
                            files: []
                        }
                    };
                });
                setChecklistWithAnswers(items);
            }
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [auditId]);

    useEffect(() => {
        fetchAuditDetails();
    }, [fetchAuditDetails]);

    // --- HANDLERS ---
    const handleSaveDraft = async () => {
        setIsSaving(true);
        const formData = new FormData();
        const answersPayload = checklistWithAnswers.map(item => ({
            item_id: item.item_id,
            status: item.answer.status,
            deskripsi_temuan: item.answer.deskripsi_temuan,
            lokasi_temuan: item.answer.lokasi_temuan,
            is_new: item.isNew || false,
            item_checklist_text: item.isNew ? item.item_checklist_text : null,
            referensi_doc: item.isNew ? item.referensi_doc : null,
            kategori: item.isNew ? item.kategori : null,
            existing_files: item.answer.existingFiles,
        }));
        formData.append('answers_data', JSON.stringify(answersPayload));

        checklistWithAnswers.forEach(item => {
            item.answer.files.forEach(file => {
                formData.append('files', file);
                formData.append('file_item_ids', item.item_id.toString());
            });
        });

        try {
            const token = localStorage.getItem('token') || '';
            const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';
            const response = await fetch(`${API_BASE}/api/audit/${auditId}/save-draft`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData,
            });

            if (!response.ok) throw new Error('Gagal menyimpan draf');
            toast.success('Draft berhasil disimpan!');
            router.push('/checklist/pelaksanaan-audit');
        } catch (error: any) {
            toast.error(`Error: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    // [UPDATED] Submit Final -> Validasi & Kirim (TANPA POPUP WORKFLOW)
    const handleSubmitFinal = async () => {
        // 1. Validasi
        const unconfirmedItems = checklistWithAnswers.filter(item => item.answer.status === null);
        if (unconfirmedItems.length > 0) return toast.error(`Lengkapi ${unconfirmedItems.length} item checklist terlebih dahulu.`, { icon: '⚠️' });

        const invalidNokItems = checklistWithAnswers.filter(item => 
            item.answer.status === 'NOK' && (!item.answer.deskripsi_temuan || (!item.answer.existingFiles.length && !item.answer.files.length))
        );
        if (invalidNokItems.length > 0) return toast.error(`Ada ${invalidNokItems.length} temuan NOK belum lengkap (Deskripsi/Bukti).`, { icon: '⚠️' });

        // 2. Prepare Data
        setIsSaving(true);
        const formData = new FormData();
        
        const answersPayload = checklistWithAnswers.map(item => ({
            item_id: item.item_id,
            status: item.answer.status,
            deskripsi_temuan: item.answer.deskripsi_temuan,
            lokasi_temuan: item.answer.lokasi_temuan,
            is_new: item.isNew || false,
            item_checklist_text: item.isNew ? item.item_checklist_text : null,
            referensi_doc: item.isNew ? item.referensi_doc : null,
            kategori: item.isNew ? item.kategori : null,
            existing_files: item.answer.existingFiles,
        }));
        formData.append('answers_data', JSON.stringify(answersPayload));

        checklistWithAnswers.forEach(item => {
            item.answer.files.forEach(file => {
                formData.append('files', file);
                formData.append('file_item_ids', item.item_id.toString());
            });
        });

        // 3. Send
        try {
            const token = localStorage.getItem('token') || '';
            const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';
            const response = await fetch(`${API_BASE}/api/audit/${auditId}/submit-final`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData,
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Gagal submit final');

            if (result.generated_ftas && result.generated_ftas.length > 0) {
                toast.success(`Sukses! FTA Terbentuk: ${result.generated_ftas.join(", ")}`, { duration: 6000 });
            } else {
                toast.success('Audit Clean Sheet Berhasil Disubmit!');
            }
            router.push('/checklist/pelaksanaan-audit');

        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleStatusChange = (itemId: number | string, status: 'OK' | 'NOK' | 'N/A' | null) => {
        setChecklistWithAnswers(prev => prev.map(item => {
            if (item.item_id === itemId) {
                if (item.answer.status === status) return { ...item, answer: { ...item.answer, status: null } };
                
                const resetAnswer = { deskripsi_temuan: '', lokasi_temuan: '', files: [], existingFiles: [] };
                if (status === 'OK' || status === 'N/A') {
                    return { ...item, answer: { ...item.answer, status, ...resetAnswer } };
                }
                return { ...item, answer: { ...item.answer, status } };
            }
            return item;
        }));
        if (status === 'NOK') setNokModalItemId(itemId);
    };

    const handleNokModalSave = (itemId: number | string, temuanData: any) => {
        const newFiles = temuanData.files.filter((f: any) => f instanceof File);
        const existing = temuanData.files.filter((f: any) => typeof f === 'string');

        setChecklistWithAnswers(prev => prev.map(item => 
            item.item_id === itemId 
                ? { ...item, answer: { ...item.answer, ...temuanData, files: newFiles, existingFiles: existing } } 
                : item
        ));
        setNokModalItemId(null);
        toast.success('Data temuan tersimpan sementara.');
    };

    const handleAddItemSave = (itemData: any) => {
        const newItem: ChecklistItemWithAnswer = {
            item_id: `temp-${Date.now()}`,
            item_checklist_text: itemData.item_checklist_text,
            referensi_doc: itemData.referensi_doc,
            kategori: 'Temuan Baru',
            sub_kategori: 'Tambahan',
            isNew: true,
            status: null,
            deskripsi_temuan: null,
            lokasi_temuan: null,
            bukti_temuan: null,
            answer: { status: null, deskripsi_temuan: '', lokasi_temuan: '', files: [], existingFiles: [] }
        };
        setChecklistWithAnswers(prev => [...prev, newItem]);
        toast.success('Item tambahan berhasil dibuat.');
    };

    const getButtonClass = (currentStatus: string | null, btnType: string) => {
        if (currentStatus === btnType) return 'bg-grey text-putih border-grey-dark shadow-inner font-bold';
        return 'bg-putih text-grey border-grey/30 hover:bg-grey/10 hover:border-grey/50';
    };

    if (isLoading) return <div className="p-12 text-center text-grey font-medium">Sedang memuat checklist...</div>;
    if (!auditInfo) return <div className="p-12 text-center text-red-500 font-bold">Data audit tidak ditemukan.</div>;

    const itemForModal = checklistWithAnswers.find(i => i.item_id === nokModalItemId);

    return (
        <div className="font-arial pb-32">
            <Toaster position="top-center" />

            <Link href="/checklist/pelaksanaan-audit" className="flex items-center text-sm text-biru hover:underline mb-4 font-medium">
                <ArrowLeft className="w-4 h-4 mr-1" /> Kembali ke List
            </Link>

            <AuditHeader info={auditInfo} />

            <div className="bg-putih p-6 rounded-lg shadow-md border border-grey/20">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-hitam">Checklist Eksekusi</h3>
                    <button onClick={() => setIsAdHocModalOpen(true)} className="flex items-center px-4 py-2 text-sm font-bold text-putih rounded bg-biru hover:bg-biru/90 transition-all shadow-sm">
                        <Plus className="w-4 h-4 mr-2" /> Item Tambahan
                    </button>
                </div>

                <div className="overflow-x-auto rounded-lg border border-grey/30">
                    <table className="min-w-full divide-y divide-grey/30">
                        <thead className="bg-grey/10">
                            <tr>
                                <th className="px-4 py-3 text-center text-xs font-bold text-grey uppercase w-10">No</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase w-1/3">Item Cek</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-grey uppercase">Ref Doc</th>
                                <th className="px-4 py-3 text-center text-xs font-bold text-grey uppercase w-24">OK</th>
                                <th className="px-4 py-3 text-center text-xs font-bold text-grey uppercase w-24">NOK</th>
                                <th className="px-4 py-3 text-center text-xs font-bold text-grey uppercase w-24">N/A</th>
                            </tr>
                        </thead>
                        <tbody className="bg-putih divide-y divide-grey/20">
                            {Array.from(groupedItems.entries()).map(([kategori, subMap]) => (
                                <React.Fragment key={kategori}>
                                    <tr className="bg-biru/5">
                                        <td colSpan={6} className="px-4 py-2.5 text-sm font-bold text-biru border-b border-biru/10">{kategori}</td>
                                    </tr>
                                    {Array.from(subMap.entries()).map(([sub, items]) => (
                                        <React.Fragment key={sub}>
                                            {sub !== "Umum" && (
                                                <tr className="bg-grey/5">
                                                    <td colSpan={6} className="px-6 py-2 text-xs font-bold text-hitam/70 uppercase tracking-wide">{sub}</td>
                                                </tr>
                                            )}
                                            {items.map((item, idx) => (
                                                <React.Fragment key={item.item_id}>
                                                    <tr className="hover:bg-grey/5 transition-colors">
                                                        <td className="px-4 py-4 text-center text-sm text-hitam font-medium">{idx + 1}</td>
                                                        <td className="px-6 py-4 text-sm text-hitam font-medium">{item.item_checklist_text}</td>
                                                        <td className="px-6 py-4 text-sm text-grey">{item.referensi_doc || '-'}</td>
                                                        <td className="px-4 py-4 text-center"><button onClick={() => handleStatusChange(item.item_id, 'OK')} className={`w-10 h-10 rounded-lg border text-xs transition-all ${getButtonClass(item.answer.status, 'OK')}`}>OK</button></td>
                                                        <td className="px-4 py-4 text-center"><button onClick={() => handleStatusChange(item.item_id, 'NOK')} className={`w-10 h-10 rounded-lg border text-xs transition-all ${getButtonClass(item.answer.status, 'NOK')}`}>NOK</button></td>
                                                        <td className="px-4 py-4 text-center"><button onClick={() => handleStatusChange(item.item_id, 'N/A')} className={`w-10 h-10 rounded-lg border text-xs transition-all ${getButtonClass(item.answer.status, 'N/A')}`}>N/A</button></td>
                                                    </tr>
                                                    {/* Row Detail NOK */}
                                                    {item.answer.status === 'NOK' && (item.answer.deskripsi_temuan || item.answer.existingFiles.length > 0 || item.answer.files.length > 0) && (
                                                        <tr className="bg-red-50/50 border-l-4 border-red-500">
                                                            <td></td>
                                                            <td colSpan={5} className="px-6 py-3 text-sm text-hitam">
                                                                <p className="font-semibold">Temuan:</p>
                                                                <p className="ml-4"><strong>Deskripsi:</strong> {item.answer.deskripsi_temuan}</p>
                                                                <p className="ml-4"><strong>Lokasi:</strong> {item.answer.lokasi_temuan}</p>
                                                                {(item.answer.existingFiles.length > 0 || item.answer.files.length > 0) && (
                                                                    <div className="ml-4 mt-2">
                                                                        <p className="font-medium text-xs text-grey">Bukti Tersimpan:</p>
                                                                        <ul className="list-disc list-inside pl-2">
                                                                            {[...item.answer.existingFiles, ...item.answer.files].map((f, i) => (
                                                                                <li key={i} className="text-xs text-hitam truncate">
                                                                                    {typeof f === 'string' ? (f.split('/').pop() || 'File lama') : (f as File).name}
                                                                                    {typeof f !== 'string' && ' (Baru)'}
                                                                                </li>
                                                                            ))}
                                                                        </ul>
                                                                    </div>
                                                                )}
                                                                <button
                                                                    onClick={() => setNokModalItemId(item.item_id)}
                                                                    className="flex items-center text-biru hover:text-biru/80 text-xs mt-4 ml-4 font-medium"
                                                                >
                                                                    <Edit className="w-4 h-4 mr-1" /> Edit Temuan
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            ))}
                                        </React.Fragment>
                                    ))}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* FLOATING FOOTER ACTION */}
            <div className="fixed bottom-0 left-0 right-0 md:left-64 bg-putih border-t-2 border-biru p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] flex justify-end gap-4 z-30">
                <button 
                    onClick={handleSaveDraft} 
                    disabled={isSaving} 
                    className="px-6 py-2.5 font-bold text-hitam bg-grey/10 hover:bg-grey/20 rounded-lg transition-colors border border-grey/20"
                >
                    {isSaving ? "Menyimpan..." : "Simpan Draft"}
                </button>
                <button 
                    onClick={handleSubmitFinal} 
                    disabled={isSaving} 
                    className="flex items-center px-8 py-2.5 font-bold text-putih bg-biru hover:bg-biru/90 rounded-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-70"
                >
                    <Save className="w-5 h-5 mr-2" />
                    Selesai & Submit
                </button>
            </div>

            {nokModalItemId && itemForModal && (
                <NokModal 
                    item={itemForModal} 
                    onClose={() => {
                        const item = checklistWithAnswers.find(i => i.item_id === nokModalItemId);
                        if (item && !item.answer.deskripsi_temuan && !item.answer.existingFiles.length && !item.answer.files.length) {
                            handleStatusChange(item.item_id, null);
                        }
                        setNokModalItemId(null);
                    }}
                    onSave={handleNokModalSave} 
                />
            )}

            {isAdHocModalOpen && (
                <AddAdHocItemModal 
                    onClose={() => setIsAdHocModalOpen(false)} 
                    onSave={handleAddItemSave} 
                />
            )}
        </div>
    );
}