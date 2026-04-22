'use client'

import { useEffect, useState } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useTranslation } from '@/hooks/useTranslation'
import { getQuizzesAction, deleteQuizAction, updateQuizAction, updateQuizNoteAction } from '@/lib/actions/quiz.actions'
import { Plus, Search, HelpCircle, Trash2, Clock, CheckCircle, FileQuestion, MessageSquare, AlertCircle, Trophy, Medal, Award, TrendingUp, Sparkles, Pencil, X, LayoutGrid, List, FileText, ChevronDown, Check } from 'lucide-react'
import Link from 'next/link'
import { getLeaderboardAction } from '@/lib/actions/leaderboard.actions'
import { getGroupsAction } from '@/lib/actions/user.actions'
import { useSearchParams } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'

function QuizzesSkeleton({ viewMode }: { viewMode: 'grid' | 'list' }) {
    return (
        <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" : "flex flex-col gap-5"}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className={`bg-white dark:bg-slate-800 rounded-[32px] border border-surface-200 dark:border-slate-700/50 shadow-xl overflow-hidden ${viewMode === 'list' ? 'flex items-center p-5 gap-5' : 'flex flex-col'}`}>
                    {viewMode === 'grid' ? (
                        <>
                            <Skeleton className="h-32 w-full" />
                            <div className="p-6 flex-1 space-y-4">
                                <div className="flex justify-between items-start">
                                    <Skeleton className="w-14 h-14 rounded-2xl" />
                                    <Skeleton className="h-6 w-20 rounded-xl" />
                                </div>
                                <div className="space-y-2">
                                    <Skeleton className="h-5 w-full rounded-md" />
                                    <Skeleton className="h-5 w-2/3 rounded-md" />
                                </div>
                                <Skeleton className="h-4 w-1/3 rounded-md" />
                                <div className="flex gap-2">
                                    <Skeleton className="h-6 w-24 rounded-xl" />
                                    <Skeleton className="h-6 w-20 rounded-xl" />
                                </div>
                                <div className="pt-4">
                                    <Skeleton className="h-12 w-full rounded-2xl" />
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <Skeleton className="w-14 h-14 rounded-2xl shrink-0" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-5 w-1/3 rounded-md" />
                                <div className="flex gap-3">
                                    <Skeleton className="h-4 w-20 rounded-md" />
                                    <Skeleton className="h-4 w-16 rounded-md" />
                                    <Skeleton className="h-4 w-24 rounded-md" />
                                </div>
                            </div>
                            <Skeleton className="h-10 w-32 rounded-xl" />
                        </>
                    )}
                </div>
            ))}
        </div>
    )
}

function LeaderboardSkeleton() {
    return (
        <div className="bg-white dark:bg-slate-800 rounded-[40px] border border-surface-200 dark:border-slate-700 shadow-2xl overflow-hidden">
            <div className="p-8 border-b flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <Skeleton className="p-3 w-12 h-12 rounded-2xl" />
                    <div className="space-y-2">
                        <Skeleton className="h-6 w-40 rounded-md" />
                        <Skeleton className="h-3 w-32 rounded-md" />
                    </div>
                </div>
                <Skeleton className="h-10 w-44 rounded-xl" />
            </div>
            <div className="p-8">
                <div className="space-y-4">
                    <div className="flex justify-between border-b pb-4">
                        <Skeleton className="h-4 w-12" />
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-16" />
                    </div>
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="flex justify-between items-center py-4 border-b last:border-0">
                            <Skeleton className="w-8 h-8 rounded-full" />
                            <div className="flex items-center gap-4 w-48">
                                <Skeleton className="w-10 h-10 rounded-full" />
                                <Skeleton className="h-4 w-32" />
                            </div>
                            <Skeleton className="h-6 w-24 rounded-xl" />
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-6 w-16 rounded-md" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default function QuizzesPage() {
    const { organization, role, group, user } = useCurrentUser()
    const { t } = useTranslation()
    const searchParams = useSearchParams()
    const view = searchParams.get('view')
    const [quizzes, setQuizzes] = useState<any[]>([])
    const [leaders, setLeaders] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
    const [selectedGroup, setSelectedGroup] = useState<string>('ALL')
    const [selectedQuiz, setSelectedQuiz] = useState<string>('ALL')
    const [groups, setGroups] = useState<any[]>([])
    const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
    const [noteValue, setNoteValue] = useState("");
    const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
    const [isSubmittingNote, setIsSubmittingNote] = useState(false);
    const activeTab = view === 'leaderboard' ? 'Leaderboard' : 'Quizzes'

    const userRole = role?.toUpperCase() || ''
    const isStaff = userRole === 'STAFF'
    const isSupervisor = userRole === 'SUPERVISOR'
    const isGroupAdmin = userRole === 'GROUP_ADMIN'
    const isSuperAdmin = userRole === 'SUPER_ADMIN'

    const loadData = async () => {
        if (!organization?.id) return
        setLoading(true)
        setError(null)
        const grpFilter = isStaff ? group?.id : (selectedGroup !== 'ALL' ? selectedGroup : undefined)
        const quizFilter = selectedQuiz !== 'ALL' ? selectedQuiz : undefined

        try {
            const [quizRes, leaderRes, grpRes] = await Promise.all([
                getQuizzesAction(organization.id, isStaff ? group?.id : undefined),
                getLeaderboardAction(organization.id, 50, grpFilter, quizFilter),
                getGroupsAction(organization.id)
            ])

            if (quizRes.success) {
                setQuizzes(quizRes.data || [])
            } else {
                setError(quizRes.error || t('quizzes.error_loading'))
            }

            if (leaderRes.success) setLeaders(leaderRes.data || [])
            if (grpRes.success) setGroups(grpRes.data || [])
        } catch (err: any) {
            setError(err.message || t('common.error'))
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (group?.id && !isSuperAdmin) {
            setSelectedGroup(group.id)
        }
    }, [group, isSuperAdmin])

    useEffect(() => {
        loadData()
    }, [organization?.id, selectedGroup, selectedQuiz])

    const handleDelete = async (id: string) => {
        if (!confirm(t('common.confirm_delete'))) return
        const res = await deleteQuizAction(id)
        if (res.success) {
            loadData()
        } else {
            alert(res.error || t('common.error'))
        }
    }

    const filteredQuizzes = quizzes.filter(q => {
        const matchesSearch = q.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            q.description?.toLowerCase().includes(searchTerm.toLowerCase())
        // Perbaikan: gunakan group_id (snake_case)
        const matchesGroup = selectedGroup === 'ALL' || q.group_id === selectedGroup
        return matchesSearch && matchesGroup
    })

    const handleApprove = async (id: string) => {
        if (!confirm(t('approvals.confirm_approve'))) return
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
        if (!confirm(t('common.continue'))) return;
        const res = await updateQuizNoteAction(id, newNote);
        if (res.success) {
            loadData();
        } else {
            alert(res.error);
        }
    };

    const renderRankIcon = (index: number) => {
        switch (index) {
            case 0: return <Trophy className="text-amber-400 drop-shadow-sm" size={24} />;
            case 1: return <Medal className="text-slate-300 drop-shadow-sm" size={22} />;
            case 2: return <Medal className="text-amber-700 drop-shadow-sm" size={20} />;
            default: return <div className="w-8 h-8 rounded-full bg-surface-100 flex items-center justify-center text-xs font-bold font-display text-text-500 border border-surface-200">{index + 1}</div>;
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-[32px] font-black font-display text-text-900 leading-tight tracking-tight">
                        {activeTab === 'Leaderboard' ? t('quizzes.leaderboard_title') : t('quizzes.management_title')}
                    </h1>
                    <p className="text-sm text-text-500 mt-1.5 font-medium">
                        {activeTab === 'Leaderboard' ? t('quizzes.leaderboard_desc') : t('quizzes.quizzes_desc')}
                    </p>
                </div>
                {['SUPER_ADMIN', 'GROUP_ADMIN', 'MAINTAINER', 'SUPERVISOR'].includes(role || '') && (
                    <Link
                        href="/dashboard/quizzes/create"
                        className="btn btn-primary shadow-xl shadow-navy-600/20 px-6 py-3 rounded-xl hover:scale-[1.02] active:scale-95 transition-all"
                    >
                        <Plus size={18} /> {t('quizzes.create_btn')}
                    </Link>
                )}
            </div>

            {error && (
                <div className="p-4 bg-danger-bg border border-red-200 dark:border-red-900/30 text-danger rounded-2xl flex items-center gap-3">
                    <AlertCircle size={20} />
                    <div className="flex-1">
                        <p className="font-bold text-sm">{t('quizzes.error_loading')}</p>
                        <p className="text-xs opacity-80">{error}</p>
                    </div>
                    <button onClick={() => loadData()} className="btn btn-primary py-1.5 px-4 text-xs rounded-lg">{t('quizzes.try_again')}</button>
                </div>
            )}

            {activeTab === 'Quizzes' ? (
                <div className="space-y-8">
                    {/* 1. PENYEDERHANAAN AREA PENCARIAN & TOGGLE */}
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-3xl">
                            <div className="relative flex-[2] group">
                                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-text-400 group-focus-within:text-navy-500 transition-colors" size={18} />
                                <input
                                    type="text"
                                    placeholder={t('quizzes.search_placeholder')}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-white dark:bg-slate-800 border border-surface-200 dark:border-slate-700 py-3.5 pl-12 pr-4 rounded-2xl outline-none focus:ring-4 focus:ring-navy-600/5 focus:border-navy-500 transition-all shadow-sm text-sm font-medium"
                                />
                            </div>

                            <div className="relative flex-1 group w-full sm:w-auto">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                                    <Sparkles className="text-navy-500 w-4 h-4" />
                                    <span className="text-[10px] font-black uppercase tracking-wider text-text-400 dark:text-slate-500 hidden lg:inline-block">{t('quizzes.filter_label')}</span>
                                </div>
                                <select
                                    value={selectedGroup}
                                    onChange={(e) => setSelectedGroup(e.target.value)}
                                    className="w-full bg-white dark:bg-slate-800 border border-surface-200 dark:border-slate-700 py-3.5 pl-12 lg:pl-20 pr-10 rounded-2xl outline-none focus:ring-4 focus:ring-navy-600/5 focus:border-navy-500 dark:focus:border-indigo-500/30 hover:border-navy-400 dark:hover:border-indigo-500/50 transition-all shadow-sm text-sm font-bold text-text-700 dark:text-slate-300 cursor-pointer appearance-none"
                                    disabled={!isSuperAdmin}
                                >
                                    <option value="ALL">{t('quizzes.all_active_groups')}</option>
                                    {groups.map(d => (
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
                                <LayoutGrid size={16} /> <span className={viewMode === 'grid' ? 'block' : 'hidden'}>{t('quizzes.view_grid')}</span>
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-2 rounded-xl transition-all flex items-center gap-2 text-xs font-bold ${viewMode === 'list' ? 'bg-white dark:bg-navy-600 text-navy-600 dark:text-white shadow-md' : 'text-text-400 hover:text-text-600 hover:bg-surface-200 dark:hover:bg-slate-700'}`}
                            >
                                <List size={16} /> <span className={viewMode === 'list' ? 'block' : 'hidden'}>{t('quizzes.view_list')}</span>
                            </button>
                        </div>
                    </div>

                    <div className="min-h-[50vh]">
                        {loading ? (
                            <QuizzesSkeleton viewMode={viewMode} />
                        ) : filteredQuizzes.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-32 text-center">
                                <div className="w-24 h-24 bg-surface-100 dark:bg-slate-800 text-text-300 dark:text-slate-600 rounded-[40px] flex items-center justify-center mb-8 shadow-inner rotate-12">
                                    <FileQuestion size={48} />
                                </div>
                                <h3 className="font-display text-2xl font-black text-text-900 mb-3 tracking-tight">{t('quizzes.empty_title')}</h3>
                                <p className="text-text-500 max-w-sm text-sm leading-relaxed">
                                    {searchTerm
                                        ? t('quizzes.empty_search').replace('{term}', searchTerm)
                                        : t('quizzes.empty_default')}
                                </p>
                            </div>
                        ) : (
                            <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" : "flex flex-col gap-5"}>
                                {filteredQuizzes.map((q) => (
                                    viewMode === 'grid' ? (
                                        <div key={q.id} className="group relative flex flex-col bg-white dark:bg-slate-800 rounded-[32px] border border-surface-200 dark:border-slate-700/50 shadow-xl shadow-navy-900/5 dark:shadow-slate-950/30 overflow-hidden transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-navy-600/10 dark:hover:shadow-indigo-500/10">
                                            {/* Header Image for Grid */}
                                            {q.header_image && (
                                                <div className="h-32 w-full overflow-hidden border-b border-surface-100 dark:border-slate-700">
                                                    <img 
                                                        src={q.header_image} 
                                                        alt={q.title} 
                                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                                                    />
                                                </div>
                                            )}
                                            <div className="p-6 flex-1">
                                                <div className="flex justify-between items-start mb-5">
                                                    <div className="w-14 h-14 rounded-2xl bg-navy-50 dark:bg-indigo-950/50 flex items-center justify-center text-navy-600 dark:text-indigo-400 border border-navy-100 dark:border-indigo-500/20 group-hover:scale-110 transition-transform duration-500 shadow-sm">
                                                        <FileText size={28} />
                                                    </div>
                                                    {/* Badge Status */}
                                                    <span className={`text-[10px] font-black px-3 py-1.5 rounded-xl border uppercase tracking-[0.1em] ${q.is_published ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20' : 'bg-slate-500/10 text-slate-500 border-slate-500/20'}`}>
                                                        {q.is_published ? t('quizzes.status_published') : t('quizzes.status_draft')}
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
                                                                {t('quizzes.admin_note')}
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
                                                                    <Check size={12} /> {t('quizzes.mark_done')}
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
                                                    {q.description || t('quizzes.default_desc')}
                                                </p>

                                                <div className="flex flex-wrap gap-2.5">
                                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 rounded-xl text-[11px] font-bold border border-slate-100 dark:border-slate-700/50">
                                                        <HelpCircle size={14} className="text-navy-500" /> {q._count?.questions || 0} {t('quizzes.th_questions')}
                                                    </div>
                                                    {q.time_limit_minutes && (
                                                        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 rounded-xl text-[11px] font-bold border border-slate-100 dark:border-slate-700/50">
                                                            <Clock size={14} className="text-amber-500" /> {q.time_limit_minutes} {t('quizzes.th_min')}
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
                                                                        <CheckCircle size={16} /> {t('quizzes.publish_btn')}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleAddNote(q.id, q.notes)}
                                                                        className="w-12 h-12 flex items-center justify-center bg-amber-500/20 hover:bg-amber-500/30 text-amber-600 dark:text-amber-400 rounded-2xl border border-amber-500/30 transition-all shrink-0"
                                                                        title={t('quizzes.revision_note_btn')}
                                                                    >
                                                                        <MessageSquare size={18} />
                                                                    </button>
                                                                    {/* Delete Note Button (Admin Only) */}
                                                                    {q.notes && (
                                                                        <button
                                                                            onClick={() => handleUpdateQuickNote(q.id, "")}
                                                                            className="w-12 h-12 flex items-center justify-center bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-2xl border border-red-500/20 transition-all shrink-0"
                                                                            title={t('quizzes.delete_note_btn')}
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
                                                                        title={t('quizzes.edit_module')}
                                                                    >
                                                                        <Pencil size={18} />
                                                                    </Link>
                                                                    <button
                                                                        onClick={() => handleDelete(q.id)}
                                                                        className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-red-500 dark:hover:text-red-400 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 transition-all hover:scale-110"
                                                                        title={t('common.delete')}
                                                                    >
                                                                        <Trash2 size={18} />
                                                                    </button>
                                                                </div>
                                                                <div className="pr-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] opacity-60">
                                                                    {t('quizzes.management')}
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
                                                            {q.is_published ? t('quizzes.start_btn') : t('quizzes.coming_soon')}
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
                                                            <HelpCircle size={14} className="text-navy-400" /> {q._count?.questions || 0} {t('quizzes.th_questions')}
                                                        </div>
                                                        {q.time_limit_minutes && (
                                                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-text-400">
                                                                <Clock size={14} className="text-amber-400" /> {q.time_limit_minutes} {t('quizzes.th_min')}
                                                            </div>
                                                        )}
                                                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border uppercase tracking-tighter ${q.is_published ? 'bg-green-50 dark:bg-indigo-950/40 text-green-700 dark:text-indigo-300 border-green-200 dark:border-indigo-500/20' : 'bg-slate-50 dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700'}`}>
                                                            {q.is_published ? t('quizzes.status_published') : t('quizzes.status_draft')}
                                                        </span>
                                                    </div>
                                                    {/* Alert Tampilan List */}
                                                    {q.notes && (
                                                        <div className="mt-2 flex flex-wrap items-center gap-3">
                                                            <div className="text-[10px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-2">
                                                                <AlertCircle size={12} /> {t('quizzes.rev_note_label')} <span className="italic">{q.notes}</span>
                                                            </div>
                                                            {/* Tombol Tandai Selesai (Hanya untuk Owner) */}
                                                            {user?.id === q.created_by && !q.notes.startsWith("[DONE]") && (
                                                                <button 
                                                                    onClick={() => handleUpdateQuickNote(q.id, "[DONE] " + q.notes)}
                                                                    className="py-1 px-2 bg-green-500/10 hover:bg-green-500 text-green-600 dark:text-green-400 hover:text-white rounded-lg transition-all text-[8px] font-black uppercase tracking-wider border border-green-500/20"
                                                                >
                                                                    {t('quizzes.mark_done')}
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
                                                                        <CheckCircle size={14} /> {t('approvals.approve_btn')}
                                                                    </button>
                                                                    <div className="flex bg-amber-500/10 rounded-xl border border-amber-500/20 p-0.5">
                                                                        <button
                                                                            onClick={() => handleAddNote(q.id, q.notes)}
                                                                            className="w-9 h-9 flex items-center justify-center text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 rounded-lg transition-all"
                                                                            title={t('quizzes.revision_note_btn')}
                                                                        >
                                                                            <MessageSquare size={16} />
                                                                        </button>
                                                                        {/* Tombol Hapus Catatan (Hanya Admin) */}
                                                                        {q.notes && (
                                                                            <button
                                                                                onClick={() => handleUpdateQuickNote(q.id, "")}
                                                                                className="w-9 h-9 flex items-center justify-center text-red-500 hover:bg-red-500/20 rounded-lg transition-all"
                                                                                title={t('quizzes.delete_note_btn')}
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
                                                                title={t('quizzes.edit_module')}
                                                            >
                                                                <Pencil size={18} />
                                                            </Link>
                                                            <button
                                                                onClick={() => handleDelete(q.id)}
                                                                className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-all"
                                                                title={t('common.delete')}
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
                                                            {t('quizzes.start_short')}
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
                                {t('quizzes.how_to_earn')}
                            </h3>
                            <div className="flex-1 p-6 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-inner">
                                <ul className="text-xs text-text-500 space-y-5 font-bold">
                                    <li className="flex justify-between items-center border-b border-white/50 dark:border-slate-800/50 pb-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                            <span>{t('quizzes.perfect_score')}</span>
                                        </div>
                                        <span className="text-green-600 dark:text-green-400 font-black text-sm">+200 {t('quizzes.pts')}</span>
                                    </li>
                                    <li className="flex justify-between items-center border-b border-white/50 dark:border-slate-800/50 pb-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                            <span>{t('quizzes.standard_score')}</span>
                                        </div>
                                        <span className="text-amber-600 dark:text-amber-400 font-black text-sm">+100 {t('quizzes.pts')}</span>
                                    </li>
                                    <li className="flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-navy-500" />
                                            <span>{t('quizzes.read_material')}</span>
                                        </div>
                                        <span className="text-navy-600 dark:text-indigo-400 font-black text-sm">+20 {t('quizzes.pts')}</span>
                                    </li>
                                </ul>
                            </div>
                        </div>

                        {!loading && user ? (
                            <div className="banner-primary p-10 rounded-[40px] text-white relative overflow-hidden shadow-2xl shadow-navy-900/30 flex flex-col justify-center h-full group">
                                <div className="relative z-10">
                                    <h3 className="text-white/60 text-[11px] font-black uppercase tracking-[0.4em] mb-4">{t('quizzes.personal_radar')}</h3>
                                    <div className="flex items-end gap-4">
                                        <span className="text-[80px] font-black leading-none drop-shadow-2xl group-hover:scale-105 transition-transform duration-700">
                                            {leaders.find(l => l.userId === user.id)?.points || 0}
                                        </span>
                                        <span className="text-white/40 text-xl font-black mb-4 uppercase tracking-tighter">{t('quizzes.points_label')}</span>
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
                            <div className="card p-10 rounded-[40px] bg-white dark:bg-slate-800 border border-surface-200 dark:border-slate-700 flex flex-col justify-center h-full space-y-6">
                                <Skeleton className="h-4 w-32 rounded-md" />
                                <div className="flex items-end gap-4">
                                    <Skeleton className="h-20 w-32 rounded-2xl" />
                                    <Skeleton className="h-8 w-16 rounded-md mb-2" />
                                </div>
                                <div className="flex items-center gap-4">
                                    <Skeleton className="h-3 flex-1 rounded-full" />
                                    <Skeleton className="h-8 w-20 rounded-xl" />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 2. AREA FILTER (Dropdown Divisi & Kuis) */}
                    <div className="bg-white dark:bg-slate-800 p-8 rounded-[40px] border border-surface-200 dark:border-slate-700 shadow-xl shadow-navy-900/5">
                        <div className="flex flex-col lg:flex-row items-end gap-8">
                            <div className="flex flex-col gap-3 w-full lg:w-72">
                                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-text-400 ml-2">{t('quizzes.radar_filter_div')}</label>
                                <select
                                    value={selectedGroup}
                                    onChange={(e) => setSelectedGroup(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 py-3.5 px-5 text-xs font-bold text-text-700 dark:text-slate-300 rounded-2xl outline-none focus:ring-4 focus:ring-navy-600/5 focus:border-navy-500 transition-all cursor-pointer appearance-none"
                                    disabled={!isSuperAdmin}
                                >
                                    <option value="ALL">{t('quizzes.all_active_groups')}</option>
                                    {groups.map(d => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                            </div>
                            
                            <div className="flex flex-col gap-3 w-full lg:w-72">
                                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-text-400 ml-2">{t('quizzes.radar_filter_mod')}</label>
                                <select
                                    value={selectedQuiz}
                                    onChange={(e) => setSelectedQuiz(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 py-3.5 px-5 text-xs font-bold text-text-700 dark:text-slate-300 rounded-2xl outline-none focus:ring-4 focus:ring-navy-600/5 focus:border-navy-500 transition-all cursor-pointer appearance-none"
                                >
                                    <option value="ALL">{t('quizzes.all_learning_mod')}</option>
                                    {quizzes.map(q => (
                                        <option key={q.id} value={q.id}>{q.title}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="lg:ml-auto w-full lg:w-auto">
                                <button
                                    onClick={() => { setSelectedGroup('ALL'); setSelectedQuiz('ALL') }}
                                    className="w-full lg:w-auto px-8 py-3.5 text-[11px] font-black uppercase tracking-widest text-navy-600 dark:text-indigo-400 hover:bg-navy-50 dark:hover:bg-indigo-950/30 rounded-2xl transition-all border border-transparent hover:border-navy-200 dark:hover:border-indigo-500/30 flex items-center justify-center gap-2 group"
                                >
                                    <X size={16} className="group-hover:rotate-90 transition-transform duration-500" /> {t('quizzes.reset_param')}
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
                                    <h2 className="font-black font-display text-text-900 text-lg leading-tight uppercase tracking-tight">{t('quizzes.hall_of_fame')}</h2>
                                    <p className="text-[10px] font-bold text-text-400 tracking-widest uppercase mt-1">{t('quizzes.global_rank')}</p>
                                </div>
                            </div>
                            <span className="text-[10px] font-black text-navy-600 dark:text-indigo-400 uppercase tracking-widest bg-navy-50 dark:bg-indigo-950/50 px-4 py-2 rounded-xl border border-navy-100 dark:border-indigo-500/20">
                                {leaders.length} {t('quizzes.members_tracked')}
                            </span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="text-text-400 text-[10px] font-black uppercase tracking-[0.2em]">
                                        <th className="p-8 w-24 text-center">{t('quizzes.th_rank')}</th>
                                        <th className="p-8">{t('quizzes.th_performer')}</th>
                                        <th className="p-8">{t('quizzes.th_domain')}</th>
                                        <th className="p-8">{t('quizzes.th_module')}</th>
                                        <th className="p-8 text-right">{t('quizzes.points_label')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-surface-100 dark:divide-slate-700">
                                    {loading ? (
                                        [1, 2, 3, 4, 5].map((i) => (
                                            <tr key={i} className="border-b last:border-0">
                                                <td className="p-8 text-center"><Skeleton className="w-8 h-8 rounded-full mx-auto" /></td>
                                                <td className="p-8">
                                                    <div className="flex items-center gap-4">
                                                        <Skeleton className="w-10 h-10 rounded-full" />
                                                        <Skeleton className="h-4 w-32 rounded-md" />
                                                    </div>
                                                </td>
                                                <td className="p-8"><Skeleton className="h-6 w-24 rounded-xl" /></td>
                                                <td className="p-8"><Skeleton className="h-4 w-32 rounded-md" /></td>
                                                <td className="p-8 text-right"><Skeleton className="h-6 w-16 rounded-md ml-auto" /></td>
                                            </tr>
                                        ))
                                    ) : leaders.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="py-24 text-center">
                                                <div className="flex flex-col items-center gap-4 opacity-30 grayscale">
                                                    <TrendingUp size={60} />
                                                    <p className="text-sm font-bold italic">{t('quizzes.no_data_radar')}</p>
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
                                                                {isMe && <span className="text-[9px] font-black text-navy-500/80 uppercase tracking-widest mt-1">{t('quizzes.current_user')}</span>}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-8">
                                                        <span className="text-[11px] font-black text-text-500 dark:text-slate-400 bg-surface-100 dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-surface-200 dark:border-slate-700/50">
                                                            {leader.group}
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
                                                                <span className="text-[10px] font-black text-text-300 uppercase tracking-widest">{t('quizzes.pts')}</span>
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
                                    <h3 className="text-xl font-black text-text-900 dark:text-white tracking-tight">{t('quizzes.modal_title')}</h3>
                                    <p className="text-xs text-text-400 font-bold uppercase tracking-widest">{t('quizzes.modal_subtitle')}</p>
                                </div>
                            </div>

                            {/* Input Textarea */}
                            <textarea
                                value={noteValue}
                                onChange={(e) => setNoteValue(e.target.value)}
                                placeholder={t('quizzes.modal_placeholder')}
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
                                    {t('common.cancel')}
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
                                            <CheckCircle size={16} /> {t('quizzes.save_note')}
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
