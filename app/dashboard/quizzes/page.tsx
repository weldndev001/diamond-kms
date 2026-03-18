'use client'

import { useEffect, useState } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { getQuizzesAction, deleteQuizAction, updateQuizAction, updateQuizNoteAction } from '@/lib/actions/quiz.actions'
import { Plus, Search, HelpCircle, Trash2, Clock, CheckCircle, FileQuestion, MessageSquare, AlertCircle, Trophy, Medal, Award, TrendingUp, Sparkles, Pencil, X, LayoutGrid, List, FileText, ChevronDown, Check } from 'lucide-react'
import Link from 'next/link'
import { getLeaderboardAction } from '@/lib/actions/leaderboard.actions'
import { getDivisionsAction } from '@/lib/actions/user.actions'
import { useSearchParams } from 'next/navigation'

export default function QuizzesPage() {
    const { organization, role, division, user } = useCurrentUser()
    const searchParams = useSearchParams()
    const view = searchParams.get('view')
    const [quizzes, setQuizzes] = useState<any[]>([])
    const [leaders, setLeaders] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
    const [selectedDivision, setSelectedDivision] = useState<string>('ALL')
    const [selectedQuiz, setSelectedQuiz] = useState<string>('ALL')
    const [divisions, setDivisions] = useState<any[]>([])
    const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
    const [noteValue, setNoteValue] = useState("");
    const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
    const [isSubmittingNote, setIsSubmittingNote] = useState(false);
    const activeTab = view === 'leaderboard' ? 'Leaderboard' : 'Kuis'

    const userRole = role?.toUpperCase() || ''
    const isStaff = userRole === 'STAFF'
    const isSupervisor = userRole === 'SUPERVISOR'
    const isGroupAdmin = userRole === 'GROUP_ADMIN'
    const isSuperAdmin = userRole === 'SUPER_ADMIN'

    const loadData = async () => {
        if (!organization?.id) return
        setLoading(true)
        setError(null)
        const divFilter = isStaff ? division?.id : (selectedDivision !== 'ALL' ? selectedDivision : undefined)
        const quizFilter = selectedQuiz !== 'ALL' ? selectedQuiz : undefined

        try {
            const [quizRes, leaderRes, divRes] = await Promise.all([
                getQuizzesAction(organization.id, isStaff ? division?.id : undefined),
                getLeaderboardAction(organization.id, 50, divFilter, quizFilter),
                getDivisionsAction(organization.id)
            ])

            if (quizRes.success) {
                setQuizzes(quizRes.data || [])
            } else {
                setError(quizRes.error || 'Gagal memuat kuis')
            }

            if (leaderRes.success) setLeaders(leaderRes.data || [])
            if (divRes.success) setDivisions(divRes.data || [])
        } catch (err: any) {
            setError(err.message || 'Terjadi kesalahan sistem')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadData()
    }, [organization?.id, selectedDivision, selectedQuiz])

    const handleDelete = async (id: string) => {
        if (!confirm('Apakah Anda yakin ingin menghapus kuis ini?')) return
        const res = await deleteQuizAction(id)
        if (res.success) {
            loadData()
        } else {
            alert(res.error || 'Gagal menghapus kuis')
        }
    }

    const filteredQuizzes = quizzes.filter(q => {
        const matchesSearch = q.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            q.description?.toLowerCase().includes(searchTerm.toLowerCase())
        // Perbaikan: gunakan division_id (snake_case)
        const matchesDivision = selectedDivision === 'ALL' || q.division_id === selectedDivision
        return matchesSearch && matchesDivision
    })

    const handleApprove = async (id: string) => {
        if (!confirm('Approve kuis ini untuk dipublikasikan?')) return
        const res = await updateQuizAction(id, { is_published: true, created_by: user?.id })
        if (res.success) loadData()
    }

    const handleAddNote = (id: string, currentNote: string) => {
        setSelectedQuizId(id);
        setNoteValue(currentNote || "");
        setIsNoteModalOpen(true);
    };

    const handleSaveNote = async () => {
        if (!selectedQuizId) return;
        setIsSubmittingNote(true);
        
        // Panggil fungsi spesifik yang baru dibuat
        const res = await updateQuizNoteAction(selectedQuizId, noteValue);
        
        if (res.success) {
            setIsNoteModalOpen(false);
            setNoteValue("");
            loadData();
        } else {
            alert(res.error);
        }
        setIsSubmittingNote(false);
    };

    const handleUpdateQuickNote = async (id: string, newNote: string) => {
        if (!confirm('Lanjutkan tindakan ini?')) return;
        const res = await updateQuizNoteAction(id, newNote);
        if (res.success) {
            loadData();
        } else {
            alert(res.error);
        }
    };

    const renderRankIcon = (index: number) => {
        switch (index) {
            case 0: return <Trophy className="text-amber-400 drop-shadow-sm" size={24} />
            case 1: return <Medal className="text-slate-300 drop-shadow-sm" size={22} />
            case 2: return <Medal className="text-amber-700 drop-shadow-sm" size={20} />
            default: return <div className="w-8 h-8 rounded-full bg-surface-100 flex items-center justify-center text-xs font-bold font-display text-text-500 border border-surface-200">{index + 1}</div>
        }
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-[32px] font-black font-display text-text-900 leading-tight tracking-tight">
                        {activeTab === 'Leaderboard' ? 'Leaderboard' : 'Quiz Management'}
                    </h1>
                    <p className="text-sm text-text-500 mt-1.5 font-medium">
                        {activeTab === 'Leaderboard' ? 'Pantau peringkat dan pencapaian Anda.' : 'Uji pemahaman Anda melalui modul pelatihan interaktif.'}
                    </p>
                </div>
                {['SUPER_ADMIN', 'GROUP_ADMIN', 'MAINTAINER', 'SUPERVISOR'].includes(role || '') && (
                    <Link
                        href="/dashboard/quizzes/create"
                        className="btn btn-primary shadow-xl shadow-navy-600/20 px-6 py-3 rounded-xl hover:scale-[1.02] active:scale-95 transition-all"
                    >
                        <Plus size={18} /> Create Quiz
                    </Link>
                )}
            </div>

            {error && (
                <div className="p-4 bg-danger-bg border border-red-200 dark:border-red-900/30 text-danger rounded-2xl flex items-center gap-3">
                    <AlertCircle size={20} />
                    <div className="flex-1">
                        <p className="font-bold text-sm">Error Memuat Data</p>
                        <p className="text-xs opacity-80">{error}</p>
                    </div>
                    <button onClick={() => loadData()} className="btn btn-primary py-1.5 px-4 text-xs rounded-lg">Coba Lagi</button>
                </div>
            )}

            {activeTab === 'Kuis' ? (
                <div className="space-y-8">
                    {/* 1. PENYEDERHANAAN AREA PENCARIAN & TOGGLE */}
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-3xl">
                            <div className="relative flex-[2] group">
                                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-text-400 group-focus-within:text-navy-500 transition-colors" size={18} />
                                <input
                                    type="text"
                                    placeholder="Cari kuis cerdas..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-white dark:bg-slate-800 border border-surface-200 dark:border-slate-700 py-3.5 pl-12 pr-4 rounded-2xl outline-none focus:ring-4 focus:ring-navy-600/5 focus:border-navy-500 transition-all shadow-sm text-sm font-medium"
                                />
                            </div>

                            <div className="relative flex-1 group w-full sm:w-auto">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                                    <Sparkles className="text-navy-500 w-4 h-4" />
                                    <span className="text-[10px] font-black uppercase tracking-wider text-text-400 dark:text-slate-500 hidden lg:inline-block">Filter:</span>
                                </div>
                                <select
                                    value={selectedDivision}
                                    onChange={(e) => setSelectedDivision(e.target.value)}
                                    className="w-full bg-white dark:bg-slate-800 border border-surface-200 dark:border-slate-700 py-3.5 pl-12 lg:pl-20 pr-10 rounded-2xl outline-none focus:ring-4 focus:ring-navy-600/5 focus:border-navy-500 dark:focus:border-indigo-500/30 hover:border-navy-400 dark:hover:border-indigo-500/50 transition-all shadow-sm text-sm font-bold text-text-700 dark:text-slate-300 cursor-pointer appearance-none"
                                    disabled={isStaff}
                                >
                                    <option value="ALL">Semua Divisi</option>
                                    {divisions.map(d => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-text-400 pointer-events-none group-hover:text-navy-500 transition-colors" size={16} />
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-3 bg-surface-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-surface-200 dark:border-slate-700 shadow-sm">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-2 rounded-xl transition-all flex items-center gap-2 text-xs font-bold ${viewMode === 'grid' ? 'bg-white dark:bg-navy-600 text-navy-600 dark:text-white shadow-md' : 'text-text-400 hover:text-text-600 hover:bg-surface-200 dark:hover:bg-slate-700'}`}
                            >
                                <LayoutGrid size={16} /> <span className={viewMode === 'grid' ? 'block' : 'hidden'}>Grid</span>
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-2 rounded-xl transition-all flex items-center gap-2 text-xs font-bold ${viewMode === 'list' ? 'bg-white dark:bg-navy-600 text-navy-600 dark:text-white shadow-md' : 'text-text-400 hover:text-text-600 hover:bg-surface-200 dark:hover:bg-slate-700'}`}
                            >
                                <List size={16} /> <span className={viewMode === 'list' ? 'block' : 'hidden'}>List</span>
                            </button>
                        </div>
                    </div>

                    <div className="min-h-[50vh]">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-32">
                                <div className="w-14 h-14 border-4 border-navy-100 border-t-navy-600 rounded-full animate-spin mb-6"></div>
                                <p className="text-text-400 font-black uppercase tracking-[0.2em] text-[11px]">Syncing Knowledge Base...</p>
                            </div>
                        ) : filteredQuizzes.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-32 text-center">
                                <div className="w-24 h-24 bg-surface-100 dark:bg-slate-800 text-text-300 dark:text-slate-600 rounded-[40px] flex items-center justify-center mb-8 shadow-inner rotate-12">
                                    <FileQuestion size={48} />
                                </div>
                                <h3 className="font-display text-2xl font-black text-text-900 mb-3 tracking-tight">Belum ada modul kuis</h3>
                                <p className="text-text-500 max-w-sm text-sm leading-relaxed">
                                    {searchTerm
                                        ? `Modul dengan kata kunci "${searchTerm}" tidak ditemukan.`
                                        : "Kuis yang dipublikasikan oleh tim pengajar akan muncul di sini secara otomatis."}
                                </p>
                            </div>
                        ) : (
                            <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" : "flex flex-col gap-5"}>
                                {filteredQuizzes.map((q) => (
                                    viewMode === 'grid' ? (
                                        <div key={q.id} className="group relative flex flex-col bg-white dark:bg-slate-800 rounded-[32px] border border-surface-200 dark:border-slate-700/50 shadow-xl shadow-navy-900/5 dark:shadow-slate-950/30 overflow-hidden transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-navy-600/10 dark:hover:shadow-indigo-500/10">
                                            <div className="p-6 flex-1">
                                                <div className="flex justify-between items-start mb-5">
                                                    <div className="w-14 h-14 rounded-2xl bg-navy-50 dark:bg-indigo-950/50 flex items-center justify-center text-navy-600 dark:text-indigo-400 border border-navy-100 dark:border-indigo-500/20 group-hover:scale-110 transition-transform duration-500 shadow-sm">
                                                        <FileText size={28} />
                                                    </div>
                                                    {/* Badge Status */}
                                                    <span className={`text-[10px] font-black px-3 py-1.5 rounded-xl border uppercase tracking-[0.1em] ${q.is_published ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20' : 'bg-slate-500/10 text-slate-500 border-slate-500/20'}`}>
                                                        {q.is_published ? 'PUBLISHED' : 'DRAFT'}
                                                    </span>
                                                </div>

                                                {/* Alert Box Catatan Admin */}
                                                {q.notes && (
                                                    <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-3 animate-in slide-in-from-top duration-500 relative group/note">
                                                        <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                                                            <AlertCircle size={16} />
                                                        </div>
                                                        <div className="flex-1 pr-4">
                                                            <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-[0.1em] mb-1">
                                                                Catatan Revisi Admin
                                                            </p>
                                                            <p className="text-xs text-amber-900 dark:text-amber-200/90 font-medium leading-relaxed italic">
                                                                {q.notes}
                                                            </p>
                                                            
                                                            {/* Tombol Tandai Selesai (Hanya untuk Owner) */}
                                                            {user?.id === q.created_by && !q.notes.startsWith("[DONE]") && (
                                                                <button 
                                                                    onClick={() => handleUpdateQuickNote(q.id, "[DONE] " + q.notes)}
                                                                    className="mt-3 py-1.5 px-3 bg-green-500 hover:bg-green-600 text-white rounded-xl transition-all flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider shadow-lg shadow-green-500/20"
                                                                >
                                                                    <Check size={12} /> Tandai Selesai
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                                
                                                <h3 className="font-extrabold font-display text-text-900 text-[19px] leading-tight mb-3 group-hover:text-navy-600 dark:group-hover:text-indigo-400 transition-colors">
                                                    {(isSupervisor || isGroupAdmin || isSuperAdmin) ? (
                                                        <Link href={`/dashboard/quizzes/create?edit=${q.id}`}>{q.title}</Link>
                                                    ) : q.title}
                                                </h3>
                                                
                                                <p className="text-sm text-text-500 dark:text-slate-400 line-clamp-2 mb-6 leading-relaxed font-medium">
                                                    {q.description || 'Pelajari materi ini dan uji pengetahuan Anda untuk mendapatkan poin prestasi.'}
                                                </p>

                                                <div className="flex flex-wrap gap-2.5">
                                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 rounded-xl text-[11px] font-bold border border-slate-100 dark:border-slate-700/50">
                                                        <HelpCircle size={14} className="text-navy-500" /> {q._count?.questions || 0} Soal
                                                    </div>
                                                    {q.time_limit_minutes && (
                                                        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 rounded-xl text-[11px] font-bold border border-slate-100 dark:border-slate-700/50">
                                                            <Clock size={14} className="text-amber-500" /> {q.time_limit_minutes} Min
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="px-6 pb-6 pt-2">
                                                <div className="flex flex-col gap-4">
                                                    {(isGroupAdmin || isSuperAdmin || isSupervisor) ? (
                                                        <>
                                                            {/* BARIS UTAMA (Utama & Feedback) */}
                                                            {(isGroupAdmin || isSuperAdmin) && !q.is_published && (
                                                                <div className="flex gap-2 w-full">
                                                                    <button
                                                                        onClick={() => handleApprove(q.id)}
                                                                        className="flex-1 py-3.5 bg-green-600 hover:bg-green-700 text-white font-black text-[11px] uppercase tracking-[0.15em] rounded-2xl transition-all shadow-lg shadow-green-600/20 active:scale-95 flex items-center justify-center gap-2"
                                                                    >
                                                                        <CheckCircle size={16} /> PUBLISH
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleAddNote(q.id, q.notes)}
                                                                        className="w-12 h-12 flex items-center justify-center bg-amber-500/20 hover:bg-amber-500/30 text-amber-600 dark:text-amber-400 rounded-2xl border border-amber-500/30 transition-all shrink-0"
                                                                        title="Beri Catatan Revisi"
                                                                    >
                                                                        <MessageSquare size={18} />
                                                                    </button>
                                                                    {/* Tombol Hapus Catatan (Hanya Admin) */}
                                                                    {q.notes && (
                                                                        <button
                                                                            onClick={() => handleUpdateQuickNote(q.id, "")}
                                                                            className="w-12 h-12 flex items-center justify-center bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-2xl border border-red-500/20 transition-all shrink-0"
                                                                            title="Hapus Catatan"
                                                                        >
                                                                            <Trash2 size={18} />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )}
                                                            
                                                            {/* BARIS UTILITAS (Edit & Hapus) - Container Terpisah */}
                                                            <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800/50">
                                                                <div className="flex gap-4 px-2">
                                                                    <Link
                                                                        href={`/dashboard/quizzes/create?edit=${q.id}`}
                                                                        className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 transition-all hover:scale-110"
                                                                        title="Edit Modul"
                                                                    >
                                                                        <Pencil size={18} />
                                                                    </Link>
                                                                    <button
                                                                        onClick={() => handleDelete(q.id)}
                                                                        className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-red-500 dark:hover:text-red-400 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 transition-all hover:scale-110"
                                                                        title="Hapus"
                                                                    >
                                                                        <Trash2 size={18} />
                                                                    </button>
                                                                </div>
                                                                <div className="pr-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] opacity-60">
                                                                    Management
                                                                </div>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <Link
                                                            href={`/dashboard/quizzes/${q.id}`}
                                                            className={`w-full py-4 flex items-center justify-center rounded-2xl font-black text-[12px] uppercase tracking-[0.2em] transition-all duration-300 ${q.is_published
                                                                ? 'bg-gradient-to-br from-navy-700 to-navy-900 text-white shadow-xl shadow-navy-900/20 hover:scale-[1.02] active:scale-95'
                                                                : 'bg-surface-200 dark:bg-slate-900 text-text-300 dark:text-slate-600 cursor-not-allowed opacity-50'
                                                                }`}
                                                        >
                                                            {q.is_published ? '🚀 Mulai Kuis' : 'Segera Hadir'}
                                                        </Link>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div key={q.id} className="group flex items-center justify-between p-5 bg-white dark:bg-slate-800 rounded-[28px] border border-surface-200 dark:border-slate-700/50 shadow-lg shadow-navy-900/5 transition-all hover:border-navy-400 dark:hover:border-indigo-500/30">
                                            <div className="flex items-center gap-5 flex-1 min-w-0">
                                                <div className="w-14 h-14 rounded-2xl bg-navy-50 dark:bg-indigo-950/50 flex items-center justify-center shrink-0 border border-navy-100 dark:border-indigo-500/20 group-hover:rotate-6 transition-transform duration-300">
                                                    <FileText className="text-navy-600 dark:text-indigo-400" size={24} />
                                                </div>
                                                <div className="min-w-0">
                                                    <h3 className="font-extrabold text-text-900 text-[16px] truncate tracking-tight mb-1">
                                                        {(isSupervisor || isGroupAdmin || isSuperAdmin) ? (
                                                            <Link href={`/dashboard/quizzes/create?edit=${q.id}`} className="hover:text-navy-600 dark:hover:text-indigo-400">{q.title}</Link>
                                                        ) : q.title}
                                                    </h3>
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-text-400">
                                                            <HelpCircle size={14} className="text-navy-400" /> {q._count?.questions || 0} Soal
                                                        </div>
                                                        {q.time_limit_minutes && (
                                                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-text-400">
                                                                <Clock size={14} className="text-amber-400" /> {q.time_limit_minutes} Min
                                                            </div>
                                                        )}
                                                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border uppercase tracking-tighter ${q.is_published ? 'bg-green-50 dark:bg-indigo-950/40 text-green-700 dark:text-indigo-300 border-green-200 dark:border-indigo-500/20' : 'bg-slate-50 dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700'}`}>
                                                            {q.is_published ? 'PUBLISHED' : 'DRAFT'}
                                                        </span>
                                                    </div>
                                                    {/* Alert Tampilan List */}
                                                    {q.notes && (
                                                        <div className="mt-2 flex flex-wrap items-center gap-3">
                                                            <div className="text-[10px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-2">
                                                                <AlertCircle size={12} /> Catatan Revisi: <span className="italic">{q.notes}</span>
                                                            </div>
                                                            {/* Tombol Tandai Selesai (Hanya untuk Owner) */}
                                                            {user?.id === q.created_by && !q.notes.startsWith("[DONE]") && (
                                                                <button 
                                                                    onClick={() => handleUpdateQuickNote(q.id, "[DONE] " + q.notes)}
                                                                    className="py-1 px-2 bg-green-500/10 hover:bg-green-500 text-green-600 dark:text-green-400 hover:text-white rounded-lg transition-all text-[8px] font-black uppercase tracking-wider border border-green-500/20"
                                                                >
                                                                    Tandai Selesai
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4 min-w-fit ml-4">
                                                {(isGroupAdmin || isSuperAdmin || isSupervisor) ? (
                                                    <div className="flex items-center gap-3">
                                                        {/* GRUP 1: AKSI UTAMA (Approve & Note) */}
                                                        {(isGroupAdmin || isSuperAdmin) && !q.is_published && (
                                                            <>
                                                                <div className="flex items-center gap-3">
                                                                    <button
                                                                        onClick={() => handleApprove(q.id)}
                                                                        className="px-8 h-10 bg-green-600 hover:bg-green-700 text-white font-black text-[10px] uppercase tracking-[0.15em] rounded-xl transition-all shadow-lg shadow-green-600/20 active:scale-95 flex items-center justify-center gap-2 shrink-0"
                                                                    >
                                                                        <CheckCircle size={14} /> APPROVE
                                                                    </button>
                                                                    <div className="flex bg-amber-500/10 rounded-xl border border-amber-500/20 p-0.5">
                                                                        <button
                                                                            onClick={() => handleAddNote(q.id, q.notes)}
                                                                            className="w-9 h-9 flex items-center justify-center text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 rounded-lg transition-all"
                                                                            title="Beri Catatan Revisi"
                                                                        >
                                                                            <MessageSquare size={16} />
                                                                        </button>
                                                                        {/* Tombol Hapus Catatan (Hanya Admin) */}
                                                                        {q.notes && (
                                                                            <button
                                                                                onClick={() => handleUpdateQuickNote(q.id, "")}
                                                                                className="w-9 h-9 flex items-center justify-center text-red-500 hover:bg-red-500/20 rounded-lg transition-all"
                                                                                title="Hapus Catatan"
                                                                            >
                                                                                <X size={16} />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                
                                                                {/* DIVIDER */}
                                                                <div className="w-[1px] h-6 bg-slate-200 dark:bg-slate-700 mx-2" />
                                                            </>
                                                        )}

                                                        {/* GRUP 2: UTILITAS (Edit & Hapus) */}
                                                        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/50 p-1 rounded-xl border border-slate-100 dark:border-slate-800/50">
                                                            <Link
                                                                href={`/dashboard/quizzes/create?edit=${q.id}`}
                                                                className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-all"
                                                                title="Edit Modul"
                                                            >
                                                                <Pencil size={18} />
                                                            </Link>
                                                            <button
                                                                onClick={() => handleDelete(q.id)}
                                                                className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-all"
                                                                title="Hapus"
                                                            >
                                                                <Trash2 size={18} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    q.is_published && (
                                                        <Link
                                                            href={`/dashboard/quizzes/${q.id}`}
                                                            className="px-8 h-10 bg-navy-600 hover:bg-navy-700 text-white font-black text-[10px] uppercase tracking-[0.15em] rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                                                        >
                                                            START
                                                        </Link>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    )
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="space-y-10 animate-in fade-in zoom-in-95 duration-700">
                    {/* 1. LAYOUT CARDS (Poin & Info) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-full">
                        <div className="card p-8 flex flex-col h-full bg-white dark:bg-slate-800/80 backdrop-blur-xl border-surface-200 dark:border-slate-700 shadow-2xl shadow-navy-900/5 rounded-[40px]">
                            <h3 className="font-black font-display text-text-900 text-xl mb-6 flex items-center gap-3">
                                <div className="p-2 bg-navy-50 dark:bg-indigo-950/50 rounded-xl">
                                    <Award size={24} className="text-navy-600 dark:text-indigo-400" />
                                </div> 
                                Bagaimana Poin Didapat?
                            </h3>
                            <div className="flex-1 p-6 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-inner">
                                <ul className="text-xs text-text-500 space-y-5 font-bold">
                                    <li className="flex justify-between items-center border-b border-white/50 dark:border-slate-800/50 pb-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                            <span>Skor Sempurna (&gt; 90)</span>
                                        </div>
                                        <span className="text-green-600 dark:text-green-400 font-black text-sm">+200 PTS</span>
                                    </li>
                                    <li className="flex justify-between items-center border-b border-white/50 dark:border-slate-800/50 pb-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                            <span>Skor Standar (60-90)</span>
                                        </div>
                                        <span className="text-amber-600 dark:text-amber-400 font-black text-sm">+100 PTS</span>
                                    </li>
                                    <li className="flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-navy-500" />
                                            <span>Membaca Materi</span>
                                        </div>
                                        <span className="text-navy-600 dark:text-indigo-400 font-black text-sm">+20 PTS</span>
                                    </li>
                                </ul>
                            </div>
                        </div>

                        {!loading && user ? (
                            <div className="banner-primary p-10 rounded-[40px] text-white relative overflow-hidden shadow-2xl shadow-navy-900/30 flex flex-col justify-center h-full group">
                                <div className="relative z-10">
                                    <h3 className="text-white/60 text-[11px] font-black uppercase tracking-[0.4em] mb-4">Personal Points Radar</h3>
                                    <div className="flex items-end gap-4">
                                        <span className="text-[80px] font-black leading-none drop-shadow-2xl group-hover:scale-105 transition-transform duration-700">
                                            {leaders.find(l => l.userId === user.id)?.points || 0}
                                        </span>
                                        <span className="text-white/40 text-xl font-black mb-4 uppercase tracking-tighter">Points</span>
                                    </div>
                                    <div className="mt-8 flex items-center gap-4">
                                        <div className="h-3 flex-1 bg-white/10 rounded-full overflow-hidden backdrop-blur-xl ring-1 ring-white/10">
                                            <div className="h-full bg-gradient-to-r from-amber-400 via-amber-300 to-amber-200 w-2/3 shadow-[0_0_25px_rgba(251,191,36,0.8)]" />
                                        </div>
                                        <div className="bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 text-[11px] font-black tracking-widest uppercase">
                                            ELITE L4
                                        </div>
                                    </div>
                                </div>
                                <Sparkles className="absolute -bottom-10 -right-10 text-white/10 rotate-12 group-hover:scale-110 transition-transform duration-1000" size={240} />
                                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2" />
                            </div>
                        ) : (
                            <div className="card p-8 flex flex-col items-center justify-center bg-surface-50 dark:bg-slate-800 h-full border-dashed border-2 dark:border-slate-700 animate-pulse rounded-[40px]">
                                <div className="w-12 h-12 border-4 border-navy-100 dark:border-slate-700 border-t-navy-500 dark:border-t-indigo-500 rounded-full animate-spin mb-4"></div>
                                <p className="text-text-400 text-[11px] font-black uppercase tracking-widest">Synchronizing Leaderboard...</p>
                            </div>
                        )}
                    </div>

                    {/* 2. AREA FILTER (Dropdown Divisi & Kuis) */}
                    <div className="bg-white dark:bg-slate-800 p-8 rounded-[40px] border border-surface-200 dark:border-slate-700 shadow-xl shadow-navy-900/5">
                        <div className="flex flex-col lg:flex-row items-end gap-8">
                            <div className="flex flex-col gap-3 w-full lg:w-72">
                                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-text-400 ml-2">Radar Filter: Divisi</label>
                                <select
                                    value={selectedDivision}
                                    onChange={(e) => setSelectedDivision(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 py-3.5 px-5 text-xs font-bold text-text-700 dark:text-slate-300 rounded-2xl outline-none focus:ring-4 focus:ring-navy-600/5 focus:border-navy-500 transition-all cursor-pointer appearance-none"
                                    disabled={isStaff}
                                >
                                    <option value="ALL">Semua Divisi Aktif</option>
                                    {divisions.map(d => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                            </div>
                            
                            <div className="flex flex-col gap-3 w-full lg:w-72">
                                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-text-400 ml-2">Radar Filter: Modul</label>
                                <select
                                    value={selectedQuiz}
                                    onChange={(e) => setSelectedQuiz(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 py-3.5 px-5 text-xs font-bold text-text-700 dark:text-slate-300 rounded-2xl outline-none focus:ring-4 focus:ring-navy-600/5 focus:border-navy-500 transition-all cursor-pointer appearance-none"
                                >
                                    <option value="ALL">Semua Modul Pembelajaran</option>
                                    {quizzes.map(q => (
                                        <option key={q.id} value={q.id}>{q.title}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="lg:ml-auto w-full lg:w-auto">
                                <button
                                    onClick={() => { setSelectedDivision('ALL'); setSelectedQuiz('ALL') }}
                                    className="w-full lg:w-auto px-8 py-3.5 text-[11px] font-black uppercase tracking-widest text-navy-600 dark:text-indigo-400 hover:bg-navy-50 dark:hover:bg-indigo-950/30 rounded-2xl transition-all border border-transparent hover:border-navy-200 dark:hover:border-indigo-500/30 flex items-center justify-center gap-2 group"
                                >
                                    <X size={16} className="group-hover:rotate-90 transition-transform duration-500" /> Reset Parameter
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* 3. TABLE LEADERBOARD */}
                    <div className="bg-white dark:bg-slate-800 rounded-[40px] border border-surface-200 dark:border-slate-700 shadow-2xl shadow-navy-900/10 overflow-hidden">
                        <div className="p-8 border-b border-surface-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/30">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-2xl">
                                    <Trophy size={26} className="text-amber-500" />
                                </div>
                                <div>
                                    <h2 className="font-black font-display text-text-900 text-lg leading-tight uppercase tracking-tight">Hall of Fame</h2>
                                    <p className="text-[10px] font-bold text-text-400 tracking-widest uppercase mt-1">Global Organization Ranking</p>
                                </div>
                            </div>
                            <span className="text-[10px] font-black text-navy-600 dark:text-indigo-400 uppercase tracking-widest bg-navy-50 dark:bg-indigo-950/50 px-4 py-2 rounded-xl border border-navy-100 dark:border-indigo-500/20">
                                {leaders.length} Members Tracked
                            </span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="text-text-400 text-[10px] font-black uppercase tracking-[0.2em]">
                                        <th className="p-8 w-24 text-center">RANK</th>
                                        <th className="p-8">PERFORMER</th>
                                        <th className="p-8">DOMAIN</th>
                                        <th className="p-8">TARGET MODUL</th>
                                        <th className="p-8 text-right">POINTS</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-surface-100 dark:divide-slate-700">
                                    {leaders.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="py-24 text-center">
                                                <div className="flex flex-col items-center gap-4 opacity-30 grayscale">
                                                    <TrendingUp size={60} />
                                                    <p className="text-sm font-bold italic">No data detected for current radar parameters.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        leaders.map((leader, index) => {
                                            const isMe = user?.id === leader.userId
                                            return (
                                                <tr key={leader.id} className={`group transition-all duration-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 ${isMe ? 'bg-navy-50/30 dark:bg-indigo-950/20' : ''}`}>
                                                    <td className="p-8 text-center">
                                                        <div className="flex justify-center group-hover:scale-110 transition-transform">
                                                            {renderRankIcon(index)}
                                                        </div>
                                                    </td>
                                                    <td className="p-8">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-bold text-xs text-text-600 border border-slate-200">
                                                                {leader.name.substring(0, 2).toUpperCase()}
                                                            </div>
                                                            <div className="flex flex-col min-w-0">
                                                                <span className={`text-[15px] font-extrabold truncate ${isMe ? 'text-navy-700 dark:text-indigo-400' : 'text-text-900 group-hover:text-navy-600 dark:group-hover:text-indigo-400 transition-colors'}`}>{leader.name}</span>
                                                                {isMe && <span className="text-[9px] font-black text-navy-500/80 uppercase tracking-widest mt-1">Current User</span>}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-8">
                                                        <span className="text-[11px] font-black text-text-500 dark:text-slate-400 bg-surface-100 dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-surface-200 dark:border-slate-700/50">
                                                            {leader.division}
                                                        </span>
                                                    </td>
                                                    <td className="p-8">
                                                        <p className="text-xs text-text-400 font-bold max-w-xs truncate italic group-hover:text-text-600 transition-colors">
                                                            {leader.quizTitle}
                                                        </p>
                                                    </td>
                                                    <td className="p-8 text-right">
                                                        <div className="flex flex-col items-end">
                                                            <div className="flex items-baseline gap-1.5">
                                                                <span className={`text-2xl font-black tabular-nums tracking-tighter ${leader.points >= 80 ? 'text-green-600 dark:text-green-400' : leader.points >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-text-900 dark:text-slate-300'}`}>
                                                                    {leader.points.toLocaleString()}
                                                                </span>
                                                                <span className="text-[10px] font-black text-text-300 uppercase tracking-widest">PTS</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
            {/* CUSTOM MODAL: CATATAN REVISI */}
            {isNoteModalOpen && (
                <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
                    {/* Backdrop dengan Blur */}
                    <div 
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                        onClick={() => !isSubmittingNote && setIsNoteModalOpen(false)}
                    />
                    
                    {/* Container Modal */}
                    <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl border border-surface-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                        <div className="p-8">
                            {/* Header */}
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20">
                                    <MessageSquare size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-text-900 dark:text-white tracking-tight">Catatan Revisi</h3>
                                    <p className="text-xs text-text-400 font-bold uppercase tracking-widest">Berikan feedback untuk kuis ini</p>
                                </div>
                            </div>

                            {/* Input Textarea */}
                            <textarea
                                value={noteValue}
                                onChange={(e) => setNoteValue(e.target.value)}
                                placeholder="Tuliskan alasan revisi atau instruksi tambahan di sini..."
                                className="w-full h-40 bg-surface-50 dark:bg-slate-950/50 border border-surface-200 dark:border-slate-800 rounded-2xl p-5 text-sm text-text-900 dark:text-slate-100 placeholder:text-text-300 dark:placeholder:text-slate-600 outline-none focus:border-amber-500/50 focus:ring-4 focus:ring-amber-500/5 transition-all resize-none font-medium"
                                autoFocus
                            />

                            {/* Action Buttons */}
                            <div className="grid grid-cols-2 gap-4 mt-8">
                                <button
                                    onClick={() => setIsNoteModalOpen(false)}
                                    disabled={isSubmittingNote}
                                    className="py-4 px-6 rounded-2xl border border-surface-200 dark:border-slate-800 text-text-500 dark:text-slate-400 font-black text-[12px] uppercase tracking-widest hover:bg-surface-50 dark:hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={handleSaveNote}
                                    disabled={isSubmittingNote}
                                    className="py-4 px-6 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black text-[12px] uppercase tracking-widest shadow-xl shadow-amber-500/20 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {isSubmittingNote ? (
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <CheckCircle size={16} /> Simpan Catatan
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
