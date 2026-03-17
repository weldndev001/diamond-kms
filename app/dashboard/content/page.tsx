'use client'

import { useState, useEffect } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { getContentsAction, deleteContentAction } from '@/lib/actions/content.actions'
import { getDivisionsAction } from '@/lib/actions/user.actions'
import { Search, Filter, FileText, Plus, LayoutGrid, List, ChevronRight, Clock, CheckCircle, AlertCircle, Loader2, Eye, Trash2, ClipboardCheck, BookOpen } from 'lucide-react'
import Link from 'next/link'

const getStatusBadge = (status: string) => {
    switch (status) {
        case 'PUBLISHED':
            return <span className="chip bg-success-bg text-success"><CheckCircle size={12} /> Published</span>
        case 'PENDING_APPROVAL':
            return <span className="chip bg-amber-100 text-amber-800"><Loader2 size={12} /> Pending Approval</span>
        case 'REJECTED':
            return <span className="chip bg-danger-bg text-danger"><AlertCircle size={12} /> Rejected</span>
        default:
            return <span className="chip bg-surface-200 text-text-600"><Clock size={12} /> Draft</span>
    }
}

export default function ContentListPage() {
    const { organization, user, role, division } = useCurrentUser()
    const [contents, setContents] = useState<any[]>([])
    const [divisions, setDivisions] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
    const isAdmin = role === 'SUPER_ADMIN' || role === 'MAINTAINER'
    const canApprove = role === 'SUPER_ADMIN' || role === 'GROUP_ADMIN'
    const [filterDiv, setFilterDiv] = useState('')
    const [initialized, setInitialized] = useState(false)

    useEffect(() => {
        if (!initialized && division?.id) {
            if (!isAdmin) setFilterDiv(division.id)
            setInitialized(true)
        }
    }, [division?.id, isAdmin, initialized])

    const loadData = async () => {
        if (!organization?.id) return
        const effectiveDiv = !isAdmin ? (division?.id || filterDiv) : (filterDiv || undefined)
        const [contentsRes, divsRes] = await Promise.all([
            getContentsAction(organization.id, effectiveDiv),
            getDivisionsAction(organization.id)
        ])
        if (contentsRes.success) setContents(contentsRes.data || [])
        if (divsRes.success) setDivisions(divsRes.data || [])
        setLoading(false)
    }

    useEffect(() => { loadData() }, [organization?.id, filterDiv, division?.id])

    const handleDelete = async (id: string) => {
        if (!confirm('Hapus konten ini secara permanen?')) return
        const res = await deleteContentAction(id)
        if (res.success) loadData()
        else alert(res.error || 'Gagal menghapus')
    }

    const pendingCount = contents.filter(c => c.status === 'PENDING_APPROVAL').length

    const filteredContents = contents.filter(c =>
        (c.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.category || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.author_name || '').toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end flex-wrap gap-4">
                <div>
                    <h1 className="text-[28px] font-bold font-display text-navy-900 leading-tight">Manage Content</h1>
                    <p className="text-sm text-text-500 mt-1">Kelola artikel, SOP, dan konten knowledge base organisasi Anda.</p>
                </div>
                <div className="flex items-center gap-3">
                    {canApprove && pendingCount > 0 && (
                        <Link href="/dashboard/approvals" className="btn bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition">
                            <ClipboardCheck size={16} /> Approvals
                            <span className="ml-1 bg-amber-500 text-white text-[11px] font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center">{pendingCount}</span>
                        </Link>
                    )}
                    {canApprove && pendingCount === 0 && (
                        <Link href="/dashboard/approvals" className="btn bg-surface-100 text-text-600 border border-surface-200 hover:bg-surface-200 transition">
                            <ClipboardCheck size={16} /> Approvals
                        </Link>
                    )}
                    <Link href="/dashboard/knowledge-base/create" className="btn btn-primary">
                        <Plus size={16} /> Buat Konten
                    </Link>
                </div>
            </div>

            <div className="card overflow-hidden">
                <div className="p-5 border-b border-surface-200 bg-surface-0 flex flex-wrap gap-4 items-center justify-between">
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-300" size={16} />
                        <input
                            type="text"
                            placeholder="Cari konten berdasarkan judul, kategori, atau penulis..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="input-field pl-10"
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        {isAdmin && (
                            <div className="flex items-center gap-3">
                                <Filter size={16} className="text-text-300" />
                                <select
                                    value={filterDiv}
                                    onChange={(e) => setFilterDiv(e.target.value)}
                                    className="border border-surface-200 rounded-md p-2 text-sm bg-white focus:ring-navy-600 focus:border-navy-600"
                                >
                                    <option value="">Semua Divisi</option>
                                    {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </div>
                        )}
                        {/* View Mode Toggle */}
                        <div className="flex items-center bg-surface-100 rounded-lg p-0.5">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white text-navy-700 shadow-sm' : 'text-text-400 hover:text-text-600'}`}
                                title="Grid view"
                            >
                                <LayoutGrid size={16} />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white text-navy-700 shadow-sm' : 'text-text-400 hover:text-text-600'}`}
                                title="List view"
                            >
                                <List size={16} />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-surface-50 min-h-[50vh]">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <div className="w-10 h-10 border-4 border-navy-200 border-t-navy-600 rounded-full animate-spin mb-4" />
                            <p className="text-text-500 font-medium">Memuat konten...</p>
                        </div>
                    ) : filteredContents.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="w-16 h-16 bg-surface-200 text-text-300 rounded-full flex items-center justify-center mb-4">
                                <BookOpen size={32} />
                            </div>
                            <h3 className="font-display text-lg font-bold text-navy-900 mb-2">Belum ada konten</h3>
                            <p className="text-text-500 max-w-sm">
                                {searchTerm ? `Tidak ada konten yang cocok dengan "${searchTerm}"` : 'Buat konten pertama Anda untuk memulai.'}
                            </p>
                            {!searchTerm && (
                                <Link href="/dashboard/knowledge-base/create" className="btn btn-primary mt-4 inline-flex items-center gap-2">
                                    <Plus size={16} /> Buat Konten
                                </Link>
                            )}
                        </div>
                    ) : viewMode === 'grid' ? (
                        /* ── GRID VIEW ── */
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {filteredContents.map((content) => (
                                <div key={content.id} className="card card-hover flex flex-col overflow-hidden">
                                    <div className="p-5 flex-1 bg-surface-0">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="w-10 h-10 bg-navy-100 rounded-xl flex items-center justify-center">
                                                <BookOpen size={18} className="text-navy-600" />
                                            </div>
                                            {getStatusBadge(content.status)}
                                        </div>
                                        <h3 className="font-bold font-display text-navy-900 text-[15px] leading-tight mb-1 line-clamp-2" title={content.title}>
                                            {content.title}
                                        </h3>
                                        <p className="text-[12px] text-text-400 mb-3">oleh {content.author_name}</p>

                                        <div className="flex flex-wrap gap-1.5 mb-3">
                                            <span className="text-[11px] font-medium bg-navy-50 text-navy-700 px-2 py-0.5 rounded-full">{content.category}</span>
                                            {content.is_mandatory_read && (
                                                <span className="text-[11px] font-medium bg-red-50 text-red-700 px-2 py-0.5 rounded-full">Wajib Baca</span>
                                            )}
                                        </div>

                                        <div className="flex flex-wrap gap-2 mt-auto">
                                            <span className="chip bg-surface-100 text-text-700">
                                                {content.division?.name || 'Global'}
                                            </span>
                                            <span className="chip bg-surface-100 text-text-700">
                                                <Clock size={11} /> {new Date(content.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="border-t border-surface-200 bg-surface-50 p-4 flex justify-between items-center gap-2">
                                        <Link href={`/dashboard/knowledge-base/${content.id}`} className="btn btn-primary flex-1 justify-center text-sm">
                                            <Eye size={14} /> Lihat
                                        </Link>
                                        {['SUPER_ADMIN', 'GROUP_ADMIN'].includes(role || '') && (
                                            <button
                                                onClick={() => handleDelete(content.id)}
                                                className="w-10 h-10 flex items-center justify-center text-danger bg-danger-bg hover:opacity-80 rounded-lg transition shrink-0"
                                                title="Hapus"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        /* ── LIST VIEW ── */
                        <div className="card divide-y">
                            {filteredContents.map((content) => (
                                <Link key={content.id} href={`/dashboard/knowledge-base/${content.id}`}
                                    className="w-full flex items-center gap-4 p-4 text-left hover:bg-surface-50 transition-colors group">
                                    <div className="w-10 h-10 bg-navy-100 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-navy-200 transition">
                                        <BookOpen size={18} className="text-navy-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-navy-900 text-sm group-hover:text-navy-700 truncate">{content.title}</h3>
                                        <p className="text-text-400 text-xs mt-0.5 truncate">oleh {content.author_name} · {content.category}</p>
                                    </div>
                                    <div className="flex items-center gap-3 text-[11px] text-text-400 shrink-0">
                                        <span className="whitespace-nowrap">{content.division?.name || 'Global'}</span>
                                        {getStatusBadge(content.status)}
                                        <span className="whitespace-nowrap">
                                            {new Date(content.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                        </span>
                                    </div>
                                    <ChevronRight size={16} className="text-text-300 group-hover:text-navy-600 transition shrink-0" />
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
