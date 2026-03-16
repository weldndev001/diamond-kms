'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { getDivisionsAction } from '@/lib/actions/user.actions'
import { createDocumentAction } from '@/lib/actions/document.actions'
import {
    ArrowLeft, Upload, FileText, CheckCircle, Loader2, Bot,
    Sparkles, ChevronDown, ChevronUp, AlertTriangle, RefreshCcw, Eye
} from 'lucide-react'
import Link from 'next/link'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

interface ProcessingLogEntry {
    time: string
    message: string
    progress: number
}

interface RecentDoc {
    id: string
    file_name: string
    processing_status: string
    processing_log: ProcessingLogEntry[] | null
    is_processed: boolean
    processing_error: string | null
    ai_title: string | null
    ai_summary: string | null
    ai_tags: string[] | null
    created_at: string
}

export default function UploadDocumentPage() {
    const router = useRouter()
    const { organization, user } = useCurrentUser()
    const [divisions, setDivisions] = useState<any[]>([])
    const [divisionId, setDivisionId] = useState('')

    // Upload states
    const [file, setFile] = useState<File | null>(null)
    const [dragOver, setDragOver] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState('')

    // Recent uploads state
    const [recentDocs, setRecentDocs] = useState<RecentDoc[]>([])
    const [expandedDocId, setExpandedDocId] = useState<string | null>(null)
    const [loadingRecent, setLoadingRecent] = useState(true)
    const pollingRef = useRef<NodeJS.Timeout | null>(null)

    useEffect(() => {
        if (organization?.id) {
            getDivisionsAction(organization.id).then(res => {
                if (res.success && res.data) {
                    setDivisions(res.data)
                    if (res.data.length > 0) setDivisionId(res.data[0].id)
                }
            })
            loadRecentUploads()
        }
    }, [organization?.id])

    // Load recent uploads from API
    const loadRecentUploads = useCallback(async () => {
        if (!organization?.id) return
        setLoadingRecent(true)
        try {
            const res = await fetch(`/api/documents?orgId=${organization.id}&limit=10&sort=newest`)
            if (res.ok) {
                const data = await res.json()
                const docs = (data.documents || []).filter(
                    (d: any) => d.processing_status !== 'idle' || !d.is_processed
                )
                setRecentDocs(docs)
            }
        } catch { /* ignore */ }
        setLoadingRecent(false)
    }, [organization?.id])

    // Poll for processing documents
    useEffect(() => {
        let isMounted = true
        let timeoutId: NodeJS.Timeout

        const poll = async () => {
            const pollingDocs = recentDocs.filter(d => !d.is_processed && d.processing_status !== 'failed')
            if (pollingDocs.length === 0) return

            const updates = await Promise.all(
                pollingDocs.map(async (d) => {
                    try {
                        const res = await fetch(`/api/documents/${d.id}/status`)
                        if (res.ok) {
                            const data = await res.json()
                            return data.document as RecentDoc
                        }
                    } catch { /* ignore */ }
                    return null
                })
            )

            if (!isMounted) return

            let hasChanges = false
            const newState = recentDocs.map(d => {
                const updated = updates.find(u => u && u.id === d.id)
                if (updated) {
                    const currentProgress = getLatestProgress(d)
                    const newProgress = getLatestProgress(updated)
                    if (newProgress < currentProgress && updated.processing_status !== 'failed' && updated.processing_status !== 'completed') {
                        updated.processing_log = d.processing_log
                        updated.processing_status = d.processing_status
                    }
                    if (JSON.stringify(d) !== JSON.stringify(updated)) {
                        hasChanges = true
                    }
                    return updated
                }
                return d
            })

            if (hasChanges && isMounted) {
                setRecentDocs(newState)
            } else if (isMounted) {
                // If no changes, still poll again
                timeoutId = setTimeout(poll, 3000)
            }
        }

        const needsPolling = recentDocs.some(d => !d.is_processed && d.processing_status !== 'failed')
        if (needsPolling) {
            timeoutId = setTimeout(poll, 3000)
        }

        return () => {
            isMounted = false
            clearTimeout(timeoutId)
        }
    }, [recentDocs])

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setDragOver(false)
        const droppedFile = e.dataTransfer.files?.[0]
        if (droppedFile) setFile(droppedFile)
    }, [])

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        if (selectedFile) setFile(selectedFile)
    }

    const handleUpload = async () => {
        if (!file || !user?.id || !organization?.id || !divisionId) return
        setError('')
        setUploading(true)

        try {
            // Step 1: Upload file to Supabase Storage
            const { createClient } = await import('@/lib/supabase/client')
            const supabase = createClient()
            const storagePath = `${organization.id}/${Date.now()}_${file.name}`

            const { error: uploadError } = await supabase.storage
                .from('documents')
                .upload(storagePath, file, {
                    cacheControl: '3600',
                    upsert: false,
                })

            if (uploadError) {
                setError(`Upload gagal: ${uploadError.message}`)
                setUploading(false)
                return
            }

            // Step 2: Create document record in DB
            const docRes = await createDocumentAction({
                fileName: file.name,
                filePath: storagePath,
                fileSize: file.size,
                mimeType: file.type,
                divisionId,
                orgId: organization.id,
                userId: user.id
            })

            if (!docRes.success) {
                setError(docRes.error || 'Gagal membuat record dokumen')
                setUploading(false)
                return
            }

            // Step 3: Trigger AI processing as FIRE-AND-FORGET
            // Don't await — just trigger and let it run server-side
            fetch('/api/ai/process-document', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-internal-secret': 'diamond-kms-cron-secret-2026',
                },
                body: JSON.stringify({ documentId: docRes.data!.id }),
            }).catch(() => { /* fire and forget */ })

            // Add to recent docs immediately
            const newDoc: RecentDoc = {
                id: docRes.data!.id,
                file_name: file.name,
                processing_status: 'processing',
                processing_log: [{ time: new Date().toISOString(), message: 'Memulai proses...', progress: 5 }],
                is_processed: false,
                processing_error: null,
                ai_title: null,
                ai_summary: null,
                ai_tags: null,
                created_at: new Date().toISOString(),
            }
            setRecentDocs(prev => [newDoc, ...prev])
            setExpandedDocId(docRes.data!.id)

            // Reset upload form
            setFile(null)
            setUploading(false)

        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Upload gagal'
            setError(message)
            setUploading(false)
        }
    }

    const getStatusBadge = (doc: RecentDoc) => {
        switch (doc.processing_status) {
            case 'processing':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                        <Loader2 size={12} className="animate-spin" /> Memproses
                    </span>
                )
            case 'completed':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                        <CheckCircle size={12} /> Selesai
                    </span>
                )
            case 'failed':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                        <AlertTriangle size={12} /> Gagal
                    </span>
                )
            default:
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-surface-100 text-text-500">
                        Menunggu
                    </span>
                )
        }
    }

    const getLatestProgress = (doc: RecentDoc): number => {
        if (doc.processing_status === 'completed') return 100
        if (!doc.processing_log || doc.processing_log.length === 0) return 0
        return doc.processing_log[doc.processing_log.length - 1].progress || 0
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/dashboard/documents" className="p-2 text-text-500 hover:text-navy-900 hover:bg-surface-100 rounded-full transition">
                    <ArrowLeft size={20} />
                </Link>
                <h1 className="text-2xl font-bold font-display text-navy-900">Upload Document</h1>
            </div>

            {/* Upload Form Card */}
            <div className="card p-8">
                {error && (
                    <div className="p-4 rounded-md mb-6 text-sm font-medium bg-danger-bg text-danger border border-red-200">
                        {error}
                    </div>
                )}

                <div className="space-y-6">
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-text-700">Target Division <span className="text-danger">*</span></label>
                        <select
                            value={divisionId}
                            onChange={(e) => setDivisionId(e.target.value)}
                            className="w-full border-surface-200 border rounded-md p-2.5 focus:ring-navy-600 focus:border-navy-600 bg-white"
                        >
                            {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                    </div>

                    <div
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleDrop}
                        className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer ${dragOver ? 'border-navy-600 bg-navy-50' :
                            file ? 'border-success bg-success-bg' :
                                'border-surface-300 hover:border-navy-400 hover:bg-surface-50'
                            }`}
                        onClick={() => document.getElementById('file-input')?.click()}
                    >
                        <input
                            id="file-input"
                            type="file"
                            className="hidden"
                            accept=".pdf,.doc,.docx,.txt,.md,.csv,.xlsx,.pptx,.sql"
                            onChange={handleFileChange}
                        />

                        {file ? (
                            <div className="flex flex-col items-center gap-3">
                                <div className="w-14 h-14 bg-success-bg text-success rounded-full flex items-center justify-center">
                                    <CheckCircle size={28} />
                                </div>
                                <div>
                                    <p className="font-bold text-navy-900">{file.name}</p>
                                    <p className="text-sm text-text-500 mt-1">{(file.size / 1024).toFixed(1)} KB • {file.type || 'Unknown type'}</p>
                                </div>
                                <p className="text-xs text-text-300 mt-2">Klik untuk ganti file</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-3">
                                <div className="w-14 h-14 bg-surface-100 text-text-300 rounded-full flex items-center justify-center">
                                    <Upload size={28} />
                                </div>
                                <div>
                                    <p className="font-bold text-navy-900">Drop file di sini atau klik untuk browse</p>
                                    <p className="text-sm text-text-500 mt-1">PDF, Word, Excel, PowerPoint, TXT, Markdown, CSV, SQL</p>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-between items-center">
                        <p className="text-xs text-text-400">
                            💡 Anda bisa meninggalkan halaman ini setelah upload — proses AI akan tetap berjalan di background.
                        </p>
                        <button
                            onClick={handleUpload}
                            disabled={!file || !divisionId || uploading}
                            className="btn btn-primary shadow-md disabled:opacity-50 flex items-center gap-2"
                        >
                            {uploading ? (
                                <><Loader2 size={16} className="animate-spin" /> Mengunggah...</>
                            ) : (
                                <><Upload size={16} /> Upload & Process</>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Recent Uploads Section */}
            <div className="card">
                <div className="p-5 border-b border-surface-200 flex items-center justify-between">
                    <h2 className="text-lg font-bold font-display text-navy-900 flex items-center gap-2">
                        <Bot size={20} className="text-navy-600" />
                        Proses Upload Terbaru
                    </h2>
                    <button
                        onClick={loadRecentUploads}
                        className="text-text-400 hover:text-navy-600 transition p-1.5 rounded hover:bg-surface-100"
                        title="Refresh"
                    >
                        <RefreshCcw size={16} />
                    </button>
                </div>

                {loadingRecent ? (
                    <div className="p-8 text-center">
                        <Loader2 size={24} className="animate-spin text-navy-400 mx-auto" />
                        <p className="text-sm text-text-400 mt-2">Memuat...</p>
                    </div>
                ) : recentDocs.length === 0 ? (
                    <div className="p-8 text-center text-text-400">
                        <FileText size={32} className="mx-auto mb-2 text-surface-300" />
                        <p className="text-sm">Belum ada upload terbaru</p>
                    </div>
                ) : (
                    <div className="divide-y divide-surface-100">
                        {recentDocs.map(doc => (
                            <div key={doc.id} className="group">
                                {/* Row */}
                                <div
                                    className="flex items-center gap-4 p-4 hover:bg-surface-50 cursor-pointer transition"
                                    onClick={() => setExpandedDocId(expandedDocId === doc.id ? null : doc.id)}
                                >
                                    <div className="w-10 h-10 bg-navy-100 rounded-lg flex items-center justify-center shrink-0">
                                        {doc.processing_status === 'processing' ? (
                                            <Loader2 size={18} className="text-navy-600 animate-spin" />
                                        ) : doc.processing_status === 'completed' ? (
                                            <Sparkles size={18} className="text-navy-600" />
                                        ) : doc.processing_status === 'failed' ? (
                                            <AlertTriangle size={18} className="text-red-500" />
                                        ) : (
                                            <FileText size={18} className="text-navy-600" />
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-navy-900 truncate text-sm">
                                            {doc.ai_title || doc.file_name}
                                        </p>
                                        <div className="flex items-center gap-3 mt-1">
                                            {getStatusBadge(doc)}
                                            <span className="text-xs text-text-400">
                                                {new Date(doc.created_at).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Progress mini bar */}
                                    {(!doc.is_processed && doc.processing_status !== 'failed') && (
                                        <div className="w-24 space-y-1 shrink-0">
                                            <div className="w-full bg-surface-200 rounded-full h-1.5 overflow-hidden">
                                                <div
                                                    className="bg-navy-600 h-1.5 rounded-full transition-all duration-500"
                                                    style={{ width: `${getLatestProgress(doc)}%` }}
                                                />
                                            </div>
                                            <p className="text-[10px] text-text-400 text-right">{getLatestProgress(doc)}%</p>
                                        </div>
                                    )}

                                    <div className="flex items-center gap-2 shrink-0">
                                        {doc.processing_status === 'completed' && (
                                            <Link
                                                href={`/dashboard/documents/${doc.id}`}
                                                className="text-navy-600 hover:text-navy-700 p-1.5 rounded hover:bg-navy-100 transition"
                                                onClick={(e) => e.stopPropagation()}
                                                title="Lihat Dokumen"
                                            >
                                                <Eye size={16} />
                                            </Link>
                                        )}
                                        <Dialog>
                                            <DialogTrigger asChild>
                                                <button
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="text-amber-600 hover:text-amber-700 p-1.5 rounded hover:bg-amber-100 transition text-xs font-semibold"
                                                    title="Debug Proses AI"
                                                >
                                                    DEBUG
                                                </button>
                                            </DialogTrigger>
                                            <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
                                                <DialogHeader>
                                                    <DialogTitle className="flex flex-col gap-1 text-left">
                                                        <span>Debug Proses: {doc.ai_title || doc.file_name}</span>
                                                        <span className="text-xs text-text-400 font-normal">ID: {doc.id}</span>
                                                    </DialogTitle>
                                                </DialogHeader>
                                                <div className="space-y-4 pt-4">
                                                    <div>
                                                        <h4 className="text-sm font-semibold text-navy-900 mb-2">Status Umum</h4>
                                                        <div className="bg-surface-50 p-3 rounded-md border border-surface-200 text-xs font-mono space-y-1">
                                                            <p>Status: <span className="font-bold text-navy-600">{doc.processing_status}</span></p>
                                                            <p>Progress: <span className="font-bold text-navy-600">{getLatestProgress(doc)}%</span></p>
                                                            <p>Selesai: {doc.is_processed ? 'Yes' : 'No'}</p>
                                                            {doc.processing_error && <p className="text-red-600 mt-2 font-bold whitespace-pre-wrap">Error: {doc.processing_error}</p>}
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <h4 className="text-sm font-semibold text-navy-900 mb-2">Log Backend</h4>
                                                        <div className="bg-slate-900 text-slate-300 p-3 rounded-md text-xs font-mono max-h-64 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-slate-700">
                                                            {doc.processing_log && doc.processing_log.length > 0 ? (
                                                                doc.processing_log.map((log, i) => (
                                                                    <div key={i} className="flex gap-3">
                                                                        <span className="text-slate-500 shrink-0 select-none">[{new Date(log.time).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
                                                                        <span className={`${i === doc.processing_log!.length - 1 ? 'text-emerald-400 font-semibold' : ''} whitespace-pre-wrap`}>
                                                                            {log.message}
                                                                            <span className="ml-2 text-slate-600">({log.progress}%)</span>
                                                                        </span>
                                                                    </div>
                                                                ))
                                                            ) : (
                                                                <span className="text-slate-500 italic">Belum ada log terekam</span>
                                                            )}
                                                            {doc.processing_status === 'processing' && (
                                                                <div className="flex gap-3 text-slate-500 animate-pulse mt-2 pt-2 border-t border-slate-800">
                                                                    <span>[   ...  ]</span>
                                                                    <span>Menunggu update dari server...</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </DialogContent>
                                        </Dialog>

                                        {expandedDocId === doc.id ? (
                                            <ChevronUp size={16} className="text-text-400" />
                                        ) : (
                                            <ChevronDown size={16} className="text-text-400" />
                                        )}
                                    </div>
                                </div>

                                {/* Expanded Detail */}
                                {expandedDocId === doc.id && (
                                    <div className="px-4 pb-4 ml-14 space-y-3">
                                        {/* Progress Bar */}
                                        {(!doc.is_processed && doc.processing_status !== 'failed') && (
                                            <div className="space-y-1.5">
                                                <div className="flex justify-between text-xs font-medium">
                                                    <span className="text-navy-900">Progress</span>
                                                    <span className="text-navy-600">{getLatestProgress(doc)}%</span>
                                                </div>
                                                <div className="w-full bg-surface-200 rounded-full h-2 overflow-hidden">
                                                    <div
                                                        className="bg-navy-600 h-2 rounded-full transition-all duration-500 ease-out"
                                                        style={{ width: `${getLatestProgress(doc)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {/* Error */}
                                        {doc.processing_error && (
                                            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                                                <span className="font-bold">Error:</span> {doc.processing_error}
                                            </div>
                                        )}

                                        {/* AI Result */}
                                        {doc.processing_status === 'completed' && doc.ai_summary && (
                                            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 space-y-2">
                                                <p className="text-xs font-bold text-emerald-800">✨ AI Summary</p>
                                                <p className="text-xs text-emerald-700 leading-relaxed">{doc.ai_summary}</p>
                                                {doc.ai_tags && doc.ai_tags.length > 0 && (
                                                    <div className="flex flex-wrap gap-1.5 mt-1">
                                                        {doc.ai_tags.map((tag, i) => (
                                                            <span key={i} className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[10px] font-medium">
                                                                {tag}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Processing Log */}
                                        {doc.processing_log && doc.processing_log.length > 0 && (
                                            <div className="border border-surface-200 rounded-lg bg-surface-50 overflow-hidden">
                                                <div className="p-3 bg-white border-b border-surface-200">
                                                    <span className="text-xs font-semibold text-navy-900">
                                                        Detail Aktivitas ({doc.processing_log.length})
                                                    </span>
                                                </div>
                                                <div className="p-3 max-h-48 overflow-y-auto space-y-2 font-mono text-[11px]">
                                                    {doc.processing_log.map((log, i) => (
                                                        <div key={i} className="flex gap-2 text-text-600">
                                                            <span className="text-text-400 shrink-0">
                                                                [{new Date(log.time).toLocaleTimeString('id-ID')}]
                                                            </span>
                                                            <span className={i === doc.processing_log!.length - 1 ? 'text-navy-700 font-semibold' : ''}>
                                                                {log.message}
                                                            </span>
                                                        </div>
                                                    ))}
                                                    {doc.processing_status === 'processing' && (
                                                        <div className="flex gap-2 text-text-400 animate-pulse">
                                                            <span>[...]</span>
                                                            <span>Menunggu proses selanjutnya...</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
