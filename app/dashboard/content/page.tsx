'use client'

import { useState, useEffect } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { getContentsAction, deleteContentAction } from '@/lib/actions/content.actions'
import { getGroupsAction } from '@/lib/actions/user.actions'
import { Search, Filter, FileText, Plus, LayoutGrid, List, ChevronRight, Clock, CheckCircle, AlertCircle, Loader2, Eye, Trash2, ClipboardCheck, BookOpen, Edit, ShieldCheck } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'
import Link from 'next/link'
import { Role } from '@prisma/client'

const getStatusBadge = (status: string, t: any) => {
    switch (status) {
        case 'PUBLISHED':
            return <span className="chip bg-success-bg text-success"><CheckCircle size={12} /> {t('content.status_published')}</span>
        case 'PENDING_APPROVAL':
            return <span className="chip bg-amber-100 text-amber-800"><Loader2 size={12} className="animate-spin" /> {t('content.status_pending_approval')}</span>
        case 'REJECTED':
            return <span className="chip bg-danger-bg text-danger"><AlertCircle size={12} /> {t('content.status_rejected')}</span>
        default:
            return <span className="chip bg-surface-200 text-text-600"><Clock size={12} /> {t('content.status_draft')}</span>
    }
}

export default function ContentListPage() {
    const { organization, role, group } = useCurrentUser()
    const { t } = useTranslation()
    const [contents, setContents] = useState<any[]>([])
    const [groups, setGroups] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
    const [filterGroup, setFilterGroup] = useState('')
    const [initialized, setInitialized] = useState(false)

    const isSuperAdmin = role === Role.SUPER_ADMIN || role === Role.MAINTAINER
    const isGroupAdmin = role === Role.GROUP_ADMIN || isSuperAdmin
    const isSupervisor = role === Role.SUPERVISOR || isGroupAdmin
    const canCreate = isSupervisor
    const canApprove = isGroupAdmin

    useEffect(() => {
        if (!initialized && group?.id) {
            if (!isSuperAdmin) setFilterGroup(group.id)
            setInitialized(true)
        }
    }, [group?.id, isSuperAdmin, initialized])

    const loadData = async () => {
        if (!organization?.id) return
        const effectiveGroup = !isSuperAdmin ? (group?.id || filterGroup) : (filterGroup || undefined)
        const [contentsRes, groupsRes] = await Promise.all([
            getContentsAction(organization.id, effectiveGroup),
            getGroupsAction(organization.id)
        ])
        if (contentsRes.success) setContents(contentsRes.data || [])
        if (groupsRes.success) setGroups(groupsRes.data || [])
        setLoading(false)
    }

    useEffect(() => { loadData() }, [organization?.id, filterGroup, group?.id])

    const handleDelete = async (id: string) => {
        if (!confirm(t('content.delete_confirm'))) return
        const res = await deleteContentAction(id)
        if (res.success) loadData()
        else alert(res.error || t('content.delete_failed'))
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
                    <h1 className="text-[28px] font-bold font-display text-navy-900 leading-tight">{t('content.title')}</h1>
                    <p className="text-sm text-text-500 mt-1">{t('content.subtitle')}</p>
                </div>
                <div className="flex items-center gap-3">
                    {canApprove && pendingCount > 0 && (
                        <Link href="/dashboard/approvals" className="btn bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition">
                            <ClipboardCheck size={16} /> {t('content.approvals')}
                            <span className="ml-1 bg-amber-500 text-white text-[11px] font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center">{pendingCount}</span>
                        </Link>
                    )}
                    {canCreate && (
                        <Link href="/dashboard/knowledge-base/create" className="btn btn-primary">
                            <Plus size={16} /> {t('content.create_btn')}
                        </Link>
                    )}
                </div>
            </div>

            <div className="card overflow-hidden">
                <div className="p-5 border-b border-surface-200 bg-surface-0 flex flex-wrap gap-4 items-center justify-between">
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-300" size={16} />
                        <input
                            type="text"
                            placeholder={t('content.search_placeholder')}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="input-field pl-10"
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        {isSuperAdmin && (
                            <div className="flex items-center gap-3">
                                <Filter size={16} className="text-text-300" />
                                <select
                                    value={filterGroup}
                                    onChange={(e) => setFilterGroup(e.target.value)}
                                    className="border border-surface-200 rounded-md p-2 text-sm bg-white focus:ring-navy-600 focus:border-navy-600"
                                >
                                    <option value="">{t('documents.all_groups')}</option>
                                    {groups.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </div>
                        )}
                        <div className="flex items-center bg-surface-100 rounded-lg p-0.5">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white text-navy-700 shadow-sm' : 'text-text-400 hover:text-text-600'}`}
                                title={t('knowledge_base.grid_view')}
                            >
                                <LayoutGrid size={16} />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white text-navy-700 shadow-sm' : 'text-text-400 hover:text-text-600'}`}
                                title={t('knowledge_base.list_view')}
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
                            <p className="text-text-500 font-medium">{t('content.loading_content')}</p>
                        </div>
                    ) : filteredContents.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="w-16 h-16 bg-surface-200 text-text-300 rounded-full flex items-center justify-center mb-4">
                                <BookOpen size={32} />
                            </div>
                            <h3 className="font-display text-lg font-bold text-navy-900 mb-2">{t('content.no_content_yet')}</h3>
                            <p className="text-text-500 max-w-sm">
                                {searchTerm ? `${t('documents.no_docs_match')} "${searchTerm}"` : t('content.get_started_desc')}
                            </p>
                            {canCreate && !searchTerm && (
                                <Link href="/dashboard/knowledge-base/create" className="btn btn-primary mt-4 inline-flex items-center gap-2">
                                    <Plus size={16} /> {t('content.create_btn')}
                                </Link>
                            )}
                        </div>
                    ) : viewMode === 'grid' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {filteredContents.map((content) => (
                                <div key={content.id} className="card card-hover flex flex-col overflow-hidden">
                                    <div className="p-5 flex-1 bg-surface-0">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="w-10 h-10 bg-navy-100 rounded-xl flex items-center justify-center">
                                                <BookOpen size={18} className="text-navy-600" />
                                            </div>
                                            {getStatusBadge(content.status, t)}
                                        </div>
                                        <h3 className="font-bold font-display text-navy-900 text-[15px] leading-tight mb-1 line-clamp-2" title={content.title}>
                                            {content.title}
                                        </h3>
                                        <p className="text-[12px] text-text-400 mb-3">{t('common.by')} {content.author_name}</p>

                                        <div className="flex flex-wrap gap-1.5 mb-3">
                                            <span className="text-[11px] font-medium bg-navy-50 text-navy-700 px-2 py-0.5 rounded-full">{content.category}</span>
                                            {content.is_mandatory_read && (
                                                <span className="text-[11px] font-medium bg-red-50 text-red-700 px-2 py-0.5 rounded-full">{t('content.mandatory_read')}</span>
                                            )}
                                        </div>

                                        <div className="flex flex-wrap gap-2 mt-auto">
                                            <span className="chip bg-surface-100 text-text-700">
                                                <ShieldCheck size={10} className="mr-1" />
                                                {content.group?.name || t('content.global')}
                                            </span>
                                            <span className="chip bg-surface-100 text-text-700">
                                                <Clock size={11} className="mr-1" /> {new Date(content.created_at).toLocaleDateString(t('common.language') === 'Indonesian' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="border-t border-surface-200 bg-surface-50 p-4 flex justify-between items-center gap-2">
                                        <Link href={`/dashboard/content/${content.id}`} className="btn btn-primary flex-1 justify-center text-sm">
                                            <Eye size={14} className="mr-2" /> {t('common.view')}
                                        </Link>
                                        {(isSuperAdmin || (isGroupAdmin && content.group_id === group?.id)) && (
                                            <>
                                                <Link href={`/dashboard/content/${content.id}/edit`}
                                                    className="w-10 h-10 flex items-center justify-center text-text-300 hover:text-navy-600 bg-white border border-surface-200 hover:bg-navy-50 rounded-lg transition shrink-0"
                                                    title="Edit"
                                                >
                                                    <Edit size={16} />
                                                </Link>
                                                <button
                                                    onClick={() => handleDelete(content.id)}
                                                    className="w-10 h-10 flex items-center justify-center text-text-300 hover:text-danger bg-white border border-surface-200 hover:bg-danger-bg rounded-lg transition shrink-0"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="card divide-y">
                            {filteredContents.map((content) => (
                                <Link key={content.id} href={`/dashboard/content/${content.id}`}
                                    className="w-full flex items-center gap-4 p-4 text-left hover:bg-surface-50 transition-colors group">
                                    <div className="w-10 h-10 bg-navy-100 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-navy-200 transition">
                                        <BookOpen size={18} className="text-navy-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-navy-900 text-sm group-hover:text-navy-700 truncate">{content.title}</h3>
                                        <p className="text-text-400 text-xs mt-0.5 truncate">{t('common.by')} {content.author_name} · {content.category}</p>
                                    </div>
                                    <div className="flex items-center gap-3 text-[11px] text-text-400 shrink-0">
                                        <span className="whitespace-nowrap flex items-center gap-1">
                                            <ShieldCheck size={10} /> {content.group?.name || t('content.global')}
                                        </span>
                                        {getStatusBadge(content.status, t)}
                                        <div className="flex items-center gap-2">
                                            {(isSuperAdmin || (isGroupAdmin && content.group_id === group?.id)) && (
                                                <Link href={`/dashboard/content/${content.id}/edit`}
                                                    className="p-1.5 text-text-300 hover:text-navy-600 hover:bg-navy-50 rounded-md transition"
                                                    onClick={(e) => e.stopPropagation()}
                                                    title="Edit"
                                                >
                                                    <Edit size={15} />
                                                </Link>
                                            )}
                                            <span className="whitespace-nowrap ml-1">
                                                {new Date(content.created_at).toLocaleDateString(t('common.language') === 'Indonesian' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'short' })}
                                            </span>
                                        </div>
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
