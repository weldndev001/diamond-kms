'use client'

import { useState, useEffect } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { getDocumentsAction, deleteDocumentAction } from '@/lib/actions/document.actions'
import { getDivisionsAction } from '@/lib/actions/user.actions'
import { Search, Filter, FileText, MoreVertical, Eye, Trash2, CheckCircle, Clock, Loader2, AlertCircle, FileSpreadsheet, FileArchive, Upload, LayoutGrid, List, ChevronRight } from 'lucide-react'
import Link from 'next/link'

const getFileIcon = (mimeType: string) => {
    if (mimeType?.includes('pdf')) return <FileText size={20} className="text-red-500" />
    if (mimeType?.includes('spreadsheet') || mimeType?.includes('excel')) return <FileSpreadsheet size={20} className="text-green-600" />
    if (mimeType?.includes('zip') || mimeType?.includes('rar')) return <FileArchive size={20} className="text-amber-600" />
    return <FileText size={20} className="text-navy-600" />
}

const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / 1048576).toFixed(1) + ' MB'
}

const getStatusChip = (doc: any) => {
    if (doc.is_processed) return <span className="chip bg-success-bg text-success"><CheckCircle size={12} /> Processed</span>
    if (doc.processing_status === 'processing') return <span className="chip bg-amber-100 text-amber-800"><Loader2 size={12} className="animate-spin" /> Processing</span>
    if (doc.processing_status === 'failed') return <span className="chip bg-danger-bg text-danger"><AlertCircle size={12} /> Failed</span>
    return <span className="chip bg-warning-bg text-warning"><Clock size={12} /> Pending</span>
}

export default function DocumentsPage() {
    const { organization, user, role, division } = useCurrentUser()
    const [documents, setDocuments] = useState<any[]>([])
    const [divisions, setDivisions] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
    const isAdmin = role === 'SUPER_ADMIN' || role === 'MAINTAINER'
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
        const [docsRes, divsRes] = await Promise.all([
            getDocumentsAction(organization.id, effectiveDiv),
            getDivisionsAction(organization.id)
        ])
        if (docsRes.success) setDocuments(docsRes.data || [])
        if (divsRes.success) setDivisions(divsRes.data || [])
        setLoading(false)
    }

    useEffect(() => { loadData() }, [organization?.id, filterDiv, division?.id])

    useEffect(() => {
        const hasProcessing = documents.some(d => !d.is_processed && d.processing_status !== 'failed')
        if (!hasProcessing) return
        const poll = setInterval(() => { loadData() }, 5000)
        return () => clearInterval(poll)
    }, [documents, organization?.id, filterDiv])

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this document permanently?')) return
        const res = await deleteDocumentAction(id)
        if (res.success) loadData()
        else alert(res.error || 'Failed to delete')
    }

    const filteredDocs = documents.filter(d =>
        (d.file_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (d.ai_title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (d.ai_summary || '').toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-[28px] font-bold font-display text-navy-900 leading-tight">Document Management</h1>
                    <p className="text-sm text-text-500 mt-1">Upload, process, and search organizational documents with AI.</p>
                </div>
                {['SUPER_ADMIN', 'GROUP_ADMIN', 'SUPERVISOR', 'MAINTAINER'].includes(role || '') && (
                    <Link href="/dashboard/documents/upload" className="btn btn-primary">
                        <Upload size={16} /> Upload Document
                    </Link>
                )}
            </div>

            <div className="card overflow-hidden">
                <div className="p-5 border-b border-surface-200 bg-surface-0 flex flex-wrap gap-4 items-center justify-between">
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-300" size={16} />
                        <input
                            type="text"
                            placeholder="Search documents..."
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
                                    <option value="">All Divisions</option>
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
                            <p className="text-text-500 font-medium">Loading documents...</p>
                        </div>
                    ) : filteredDocs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="w-16 h-16 bg-surface-200 text-text-300 rounded-full flex items-center justify-center mb-4">
                                <FileText size={32} />
                            </div>
                            <h3 className="font-display text-lg font-bold text-navy-900 mb-2">No documents found</h3>
                            <p className="text-text-500 max-w-sm">
                                {searchTerm ? `No documents match "${searchTerm}"` : 'Upload your first document to get started with AI-powered search.'}
                            </p>
                        </div>
                    ) : viewMode === 'grid' ? (
                        /* ── GRID VIEW ── */
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {filteredDocs.map((doc) => (
                                <div key={doc.id} className="card card-hover flex flex-col overflow-hidden">
                                    <div className="p-5 flex-1 bg-surface-0">
                                        <div className="flex items-start gap-3 mb-3">
                                            <div className="w-10 h-10 bg-surface-100 rounded-lg flex items-center justify-center shrink-0">
                                                {getFileIcon(doc.mime_type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-bold font-display text-navy-900 text-[15px] leading-tight truncate" title={doc.ai_title || doc.file_name}>
                                                    {doc.ai_title || doc.file_name}
                                                </h3>
                                                <p className="text-[12px] text-text-500 mt-0.5 truncate">{doc.file_name}</p>
                                            </div>
                                        </div>

                                        {doc.ai_summary && (
                                            <p className="text-[13px] text-text-500 line-clamp-2 mb-4 leading-relaxed">{doc.ai_summary}</p>
                                        )}

                                        <div className="flex flex-wrap gap-1.5 mb-3">
                                            {doc.ai_tags?.slice(0, 4).map((tag: string, i: number) => (
                                                <span key={i} className="text-[11px] font-medium bg-navy-50 text-navy-700 px-2 py-0.5 rounded-full">{tag}</span>
                                            ))}
                                        </div>

                                        <div className="flex flex-wrap gap-2 mt-auto">
                                            <span className="chip bg-surface-100 text-text-700">{formatFileSize(doc.file_size)}</span>
                                            <span className="chip bg-surface-100 text-text-700">{doc.division?.name || 'General'}</span>
                                            {getStatusChip(doc)}
                                        </div>
                                    </div>

                                    <div className="border-t border-surface-200 bg-surface-50 p-4 flex justify-between items-center gap-2">
                                        <a href={`/dashboard/documents/${doc.id}`} className="btn btn-primary flex-1 justify-center text-sm">
                                            <Eye size={14} /> View
                                        </a>
                                        {['SUPER_ADMIN', 'GROUP_ADMIN'].includes(role || '') && (
                                            <button
                                                onClick={() => handleDelete(doc.id)}
                                                className="w-10 h-10 flex items-center justify-center text-danger bg-danger-bg hover:opacity-80 rounded-lg transition shrink-0"
                                                title="Delete"
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
                            {filteredDocs.map((doc) => (
                                <a key={doc.id} href={`/dashboard/documents/${doc.id}`}
                                    className="w-full flex items-center gap-4 p-4 text-left hover:bg-surface-50 transition-colors group">
                                    <div className="w-10 h-10 bg-surface-100 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-surface-200 transition">
                                        {getFileIcon(doc.mime_type)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-navy-900 text-sm group-hover:text-navy-700 truncate">{doc.ai_title || doc.file_name}</h3>
                                        <p className="text-text-400 text-xs mt-0.5 truncate">{doc.file_name}</p>
                                    </div>
                                    <div className="flex items-center gap-4 text-[11px] text-text-400 shrink-0">
                                        <span className="whitespace-nowrap">{formatFileSize(doc.file_size)}</span>
                                        <span className="whitespace-nowrap">{doc.division?.name || 'General'}</span>
                                        {getStatusChip(doc)}
                                    </div>
                                    <div className="hidden md:flex flex-wrap gap-1 shrink-0 max-w-[200px]">
                                        {doc.ai_tags?.slice(0, 2).map((tag: string, i: number) => (
                                            <span key={i} className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-navy-50 text-navy-700">{tag}</span>
                                        ))}
                                        {(doc.ai_tags?.length || 0) > 2 && (
                                            <span className="text-[10px] px-2 py-0.5 bg-surface-100 text-text-500 rounded-full">+{doc.ai_tags.length - 2}</span>
                                        )}
                                    </div>
                                    <ChevronRight size={16} className="text-text-300 group-hover:text-navy-600 transition shrink-0" />
                                </a>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
