'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { getDocumentByIdAction } from '@/lib/actions/document.actions'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import {
    Maximize2, Minimize2, Loader2, Send, MessageSquare, Sparkles,
    Trash2, ClipboardList, RefreshCcw, Settings, Database, Network, ArrowUpDown,
    ArrowLeft, FileText, Bot, Tag, FolderOpen, User
} from 'lucide-react'

import Link from 'next/link'
import { DocumentPreviewCard } from '@/components/documents/DocumentPreviewCard'
import { DocxPreview } from '@/components/documents/DocxPreview'
import { XlsxPreview } from '@/components/documents/XlsxPreview'
import { MarkdownPreview } from '@/components/documents/MarkdownPreview'
import { SqlPreview } from '@/components/documents/SqlPreview'

interface ChatMessage {
    role: 'user' | 'assistant'
    content: string
}

export default function DocumentDetailPage() {
    const params = useParams()
    const searchParams = useSearchParams()
    const { role } = useCurrentUser()
    const [doc, setDoc] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [pdfFullscreen, setPdfFullscreen] = useState(false)
    const [pdfUrl, setPdfUrl] = useState<string | null>(null)
    const [pdfLoading, setPdfLoading] = useState(false)
    const [pdfError, setPdfError] = useState<string | null>(null)

    // Chat state
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [chatSessionId, setChatSessionId] = useState<string | null>(null)
    const [input, setInput] = useState('')
    const [isStreaming, setIsStreaming] = useState(false)
    const [isSummarizing, setIsSummarizing] = useState(false)
    const [reprocessing, setReprocessing] = useState(false)
    const [showSettings, setShowSettings] = useState(false)
    const [useVector, setUseVector] = useState(true)
    const [useGraph, setUseGraph] = useState(true)
    const [useRerank, setUseRerank] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)

    // Fetch chart history on mount
    useEffect(() => {
        if (params.id) {
            fetch(`/api/chat/entity?documentId=${params.id}`)
                .then(res => res.json())
                .then(data => {
                    if (data.messages && data.messages.length > 0) {
                        setMessages(data.messages)
                    }
                    if (data.sessionId) setChatSessionId(data.sessionId)
                }).catch(() => { })
        }
    }, [params.id])

    useEffect(() => {
        if (params.id) {
            getDocumentByIdAction(params.id as string).then(res => {
                if (res.success) setDoc(res.data)
                setLoading(false)
            })
        }
    }, [params.id])

    const isPDF = doc?.mime_type === 'application/pdf'
    const isImage = doc?.mime_type?.startsWith('image/')
    const isAudio = doc?.mime_type?.startsWith('audio/') || /\.(mp3|wav|ogg|m4a)$/i.test(doc?.file_name || '')
    const isDocx = doc?.mime_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || doc?.file_name?.endsWith('.docx')
    const isXlsx = doc?.mime_type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
                   doc?.mime_type === 'application/vnd.ms-excel' || 
                   doc?.mime_type === 'text/csv' ||
                   /\.(xlsx|xls|csv)$/i.test(doc?.file_name || '') ||
                   /\.(xlsx|xls|csv)$/i.test(doc?.file_path || '')
    const isMarkdown = doc?.mime_type === 'text/markdown' || doc?.mime_type === 'text/x-markdown' || /\.(md|markdown)$/i.test(doc?.file_name || '') || /\.(md|markdown)$/i.test(doc?.file_path || '')
    const isSql = doc?.mime_type === 'text/x-sql' || doc?.mime_type === 'application/sql' || doc?.mime_type === 'text/sql' || /\.(sql)$/i.test(doc?.file_name || '') || /\.(sql)$/i.test(doc?.file_path || '')

    // Use proxy endpoint to bypass signed URL JWT issues
    const loadPdfUrl = () => {
        if (!doc?.file_path) return
        setPdfLoading(false)
        setPdfError(null)
        // Use our proxy endpoint that serves from local filesystem
        setPdfUrl(`/api/documents/pdf/${doc.file_path}`)
    }

    useEffect(() => {
        if (doc && isPDF && doc.file_path && !pdfUrl) {
            loadPdfUrl()
        }
    }, [doc, isPDF])

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // Auto-poll if document is currently processing
    useEffect(() => {
        if (!doc || doc.is_processed) return

        // If it's explicitly marked as failed, don't auto-poll
        if (doc.processing_status === 'failed' || doc.processing_error) return

        const poll = setInterval(async () => {
            const res = await getDocumentByIdAction(doc.id)
            if (res.success && res.data) {
                setDoc(res.data)
                if (res.data.is_processed || res.data.processing_error) {
                    clearInterval(poll)
                }
            }
        }, 5000)

        // Cleanup on unmount or when doc changes to processed
        return () => clearInterval(poll)
    }, [doc?.id, doc?.is_processed, doc?.processing_status, doc?.processing_error])

    // Trigger reprocessing
    const handleReprocess = async () => {
        if (!doc || reprocessing) return
        setReprocessing(true)
        try {
            await fetch('/api/ai/process-document', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-internal-secret': 'diamond-kms-cron-secret-2026',
                },
                body: JSON.stringify({ documentId: doc.id }),
            })
            // Poll for completion every 5s
            const poll = setInterval(async () => {
                const res = await getDocumentByIdAction(doc.id)
                if (res.success && res.data) {
                    setDoc(res.data)
                    if (res.data.is_processed || res.data.processing_error) {
                        clearInterval(poll)
                        setReprocessing(false)
                    }
                }
            }, 5000)
            // Auto-stop after 2 minutes
            setTimeout(() => { clearInterval(poll); setReprocessing(false) }, 120000)
        } catch {
            setReprocessing(false)
        }
    }

    const sendMessage = async () => {
        const q = input.trim()
        if (!q || isStreaming || !doc) return

        const userMsg: ChatMessage = { role: 'user', content: q }
        const newMessages = [...messages, userMsg]
        setMessages(newMessages)
        setInput('')
        if (inputRef.current) inputRef.current.style.height = 'auto'
        setIsStreaming(true)


        // Add empty assistant message for streaming
        setMessages(prev => [...prev, { role: 'assistant', content: '' }])

        try {
            const res = await fetch('/api/ai/chat-document', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    documentId: doc.id,
                    question: q,
                    history: newMessages.slice(-8),
                    useVector,
                    useGraph,
                    useRerank,
                }),
            })

            if (!res.ok) {
                const err = await res.json()
                setMessages(prev => {
                    const updated = [...prev]
                    updated[updated.length - 1] = {
                        role: 'assistant',
                        content: `⚠️ Error: ${err.error || 'Gagal mendapatkan jawaban'}`,
                    }
                    return updated
                })
                setIsStreaming(false)
                return
            }

            const reader = res.body?.getReader()
            const decoder = new TextDecoder()

            if (!reader) {
                setIsStreaming(false)
                return
            }

            let fullText = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                const chunk = decoder.decode(value, { stream: true })
                const lines = chunk.split('\n')

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6)
                        if (data === '[DONE]') continue

                        try {
                            const parsed = JSON.parse(data)
                            if (parsed.text) {
                                fullText += parsed.text
                                setMessages(prev => {
                                    const updated = [...prev]
                                    updated[updated.length - 1] = {
                                        role: 'assistant',
                                        content: fullText,
                                    }
                                    return updated
                                })
                            }
                            if (parsed.error) {
                                fullText += `\n⚠️ ${parsed.error}`
                                setMessages(prev => {
                                    const updated = [...prev]
                                    updated[updated.length - 1] = {
                                        role: 'assistant',
                                        content: fullText,
                                    }
                                    return updated
                                })
                            }
                        } catch { /* ignore parse errors */ }
                    }
                }
            }
            // Save chat history to DB
            await fetch('/api/chat/entity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    documentId: params.id,
                    title: doc?.title || 'Document Q&A',
                    messages: [...newMessages, { role: 'assistant', content: fullText }]
                })
            })
        } catch (err) {
            setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = {
                    role: 'assistant',
                    content: '⚠️ Koneksi terputus. Silakan coba lagi.',
                }
                return updated
            })
        } finally {
            setIsStreaming(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            sendMessage()
        }
    }

    const clearChat = async () => {
        setMessages([])
        setChatSessionId(null)
        if (params.id) {
            try {
                await fetch(`/api/chat/entity?documentId=${params.id}`, { method: 'DELETE' })
            } catch { }
        }
    }

    const handleSummary = async () => {
        if (messages.length === 0 || isStreaming || isSummarizing) return
        setIsSummarizing(true)

        const summaryPrompt = 'Buatkan ringkasan dari seluruh percakapan kita di atas dalam bentuk poin-poin utama.'
        const userMsg: ChatMessage = { role: 'user', content: summaryPrompt }
        const newMessages = [...messages, userMsg]
        setMessages(newMessages)
        setMessages(prev => [...prev, { role: 'assistant', content: '' }])

        try {
            const res = await fetch('/api/ai/chat-document', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    documentId: doc.id,
                    question: summaryPrompt,
                    history: newMessages.slice(-20),
                    useVector,
                    useGraph,
                    useRerank,
                }),
            })

            if (!res.ok) {
                setMessages(prev => {
                    const updated = [...prev]
                    updated[updated.length - 1] = { role: 'assistant', content: '⚠️ Gagal membuat ringkasan' }
                    return updated
                })
                return
            }

            const reader = res.body?.getReader()
            const decoder = new TextDecoder()
            if (!reader) return

            let fullText = ''
            while (true) {
                const { done, value } = await reader.read()
                if (done) break
                const chunk = decoder.decode(value, { stream: true })
                for (const line of chunk.split('\n')) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6)
                        if (data === '[DONE]') continue
                        try {
                            const parsed = JSON.parse(data)
                            if (parsed.text) {
                                fullText += parsed.text
                                setMessages(prev => {
                                    const updated = [...prev]
                                    updated[updated.length - 1] = { role: 'assistant', content: fullText }
                                    return updated
                                })
                            }
                        } catch { }
                    }
                }
            }
        } catch {
            setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = { role: 'assistant', content: '⚠️ Koneksi terputus.' }
                return updated
            })
        } finally {
            setIsSummarizing(false)
        }
    }

    if (loading) return (
        <div className="flex items-center justify-center h-[60vh]">
            <div className="text-center space-y-3">
                <div className="w-10 h-10 border-3 border-navy-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-text-500 text-sm">Memuat dokumen...</p>
            </div>
        </div>
    )
    if (!doc) return (
        <div className="flex items-center justify-center h-[60vh]">
            <div className="text-center space-y-2">
                <FileText size={40} className="text-text-300 mx-auto" />
                <p className="text-danger font-semibold">Dokumen tidak ditemukan</p>
                <Link href="/dashboard/documents" className="btn btn-secondary text-sm mt-2">
                    <ArrowLeft size={14} /> Kembali
                </Link>
            </div>
        </div>
    )

    const suggestedQuestions = [
        'Apa inti dari dokumen ini?',
        'Apa poin-poin penting dalam dokumen ini?',
        'Buat ringkasan dalam bahasa sederhana',
    ]

    return (
        <div className="flex flex-col h-[calc(100vh-60px)] -m-6 md:-m-8 bg-surface-0">
            {/* Header Bar */}
            <div className="bg-white dark:bg-surface-0 border-b border-surface-200/60 dark:border-surface-100 px-6 py-4 flex items-center gap-4 shrink-0">
                <Link href="/dashboard/documents" className="p-2.5 rounded-xl text-text-500 hover:text-navy-600 hover:bg-surface-100 transition-all active:scale-95 border border-transparent hover:border-surface-200 shrink-0">
                    <ArrowLeft size={22} />
                </Link>
                <div className="h-8 w-[1.5px] bg-surface-200 dark:bg-surface-100" />
                <div className="flex-1 min-w-0">
                    <h1 className="text-sm font-extrabold text-navy-900 uppercase tracking-[0.05em] leading-tight truncate">
                        {doc.ai_title || doc.file_name}
                    </h1>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-text-500 flex-wrap">
                        <span className="flex items-center gap-1"><FileText size={12} /> {doc.file_name}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1"><FolderOpen size={12} /> {doc.group?.name || 'General'}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1"><User size={12} /> {doc.uploader_name}</span>
                    </div>
                </div>
                {doc.ai_tags?.length > 0 && (
                    <div className="hidden md:flex items-center gap-1.5 shrink-0">
                        <Tag size={12} className="text-text-300" />
                        {doc.ai_tags.slice(0, 3).map((tag: string, i: number) => (
                            <span key={i} className="badge bg-navy-100 text-navy-700 text-[10px]">{tag}</span>
                        ))}
                        {doc.ai_tags.length > 3 && (
                            <span className="text-[10px] text-text-300">+{doc.ai_tags.length - 3}</span>
                        )}
                    </div>
                )}
            </div>

            {/* Split Panel: Chat LEFT | Preview RIGHT */}
            <div className="flex flex-1 overflow-hidden bg-surface-0">
                {/* LEFT — AI Chat */}
                {!pdfFullscreen && (
                    <div className="flex flex-col border-r border-surface-200/60 bg-white dark:bg-surface-0 shrink-0" style={{ width: '45%', minWidth: 0 }}>
                        {/* Chat Header */}
                        <div className="px-6 py-4 border-b border-surface-100/60 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-navy-600 flex items-center justify-center">
                                    <Sparkles size={14} className="text-white" />
                                </div>
                                <div>
                                    <h2 className="font-bold font-display text-navy-900 text-sm">Tanya Dokumen</h2>
                                    <p className="text-[10px] text-text-400">AI akan menjawab berdasarkan isi dokumen ini</p>
                                </div>
                            </div>
                                <div className="flex items-center gap-1">
                                    {/* RAG Settings Toggle */}
                                    <div className="relative">
                                        <button
                                            onClick={() => setShowSettings(!showSettings)}
                                            className={`p-1.5 rounded-md transition-all active:scale-95 border ${showSettings ? 'bg-navy-600 text-white border-navy-600' : 'text-text-400 hover:text-navy-700 hover:bg-navy-50 border-transparent'}`}
                                            title="Konfigurasi Retrieval"
                                        >
                                            <Settings size={15} />
                                        </button>

                                        {showSettings && (
                                            <div className="absolute top-10 right-0 z-[100] w-64 bg-white rounded-2xl shadow-2xl border border-surface-200 p-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                                <div className="flex items-center justify-between mb-3 px-1">
                                                    <h4 className="text-[11px] font-black text-navy-900 uppercase tracking-wider">Konfigurasi RAG</h4>
                                                    <div className="h-1 w-8 bg-navy-100 rounded-full" />
                                                </div>
                                                
                                                <div className="space-y-1.5">
                                                    {/* Vector Toggle */}
                                                    <label className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all ${!useVector && !useRerank ? 'opacity-50' : 'hover:bg-surface-50'}`}>
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-lg bg-navy-50 flex items-center justify-center">
                                                                <Database size={15} className="text-navy-600" />
                                                            </div>
                                                            <span className="text-xs font-bold text-navy-900">Vector Search</span>
                                                        </div>
                                                        <input 
                                                            type="checkbox" 
                                                            checked={useVector} 
                                                            disabled={useVector && !useRerank}
                                                            onChange={(e) => setUseVector(e.target.checked)}
                                                            className="w-4 h-4 rounded border-surface-300 text-navy-600 focus:ring-navy-500 cursor-pointer"
                                                        />
                                                    </label>

                                                    {/* Graph Toggle */}
                                                    <label className="flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all hover:bg-surface-50">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                                                                <Network size={15} className="text-indigo-600" />
                                                            </div>
                                                            <span className="text-xs font-bold text-navy-900">Graph Context</span>
                                                        </div>
                                                        <input 
                                                            type="checkbox" 
                                                            checked={useGraph} 
                                                            onChange={(e) => setUseGraph(e.target.checked)}
                                                            className="w-4 h-4 rounded border-surface-300 text-navy-600 focus:ring-navy-500 cursor-pointer"
                                                        />
                                                    </label>

                                                    {/* Rerank Toggle */}
                                                    <label className="flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all hover:bg-surface-50">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-lg bg-secondary-50 flex items-center justify-center">
                                                                <ArrowUpDown size={15} className="text-secondary-600" />
                                                            </div>
                                                            <span className="text-xs font-bold text-navy-900">Reranking</span>
                                                        </div>
                                                        <input 
                                                            type="checkbox" 
                                                            checked={useRerank} 
                                                            disabled={useRerank && !useVector}
                                                            onChange={(e) => setUseRerank(e.target.checked)}
                                                            className="w-4 h-4 rounded border-surface-300 text-navy-600 focus:ring-navy-500 cursor-pointer"
                                                        />
                                                    </label>
                                                </div>
                                                <div className="mt-3 pt-3 border-t border-surface-100 text-[10px] text-text-400 px-1 italic leading-tight">
                                                    * Aturan Sistem: Vector atau Reranking harus aktif salah satu.
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        onClick={handleReprocess}
                                        disabled={reprocessing}
                                        className="p-1.5 text-text-400 hover:text-navy-700 hover:bg-navy-50 rounded-md transition disabled:opacity-40"
                                        title="Proses Ulang Dokumen dengan AI"
                                    >
                                        {reprocessing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCcw size={15} />}
                                    </button>
                                    {messages.length > 0 && (
                                        <>
                                            <button
                                                onClick={handleSummary}
                                                disabled={isStreaming || isSummarizing}
                                                className="p-1.5 text-text-400 hover:text-navy-700 hover:bg-navy-50 rounded-md transition disabled:opacity-40"
                                                title="Ringkas Percakapan"
                                            >
                                                <ClipboardList size={15} />
                                            </button>
                                            <button
                                                onClick={clearChat}
                                                disabled={isStreaming}
                                                className="p-1.5 text-text-400 hover:text-red-600 hover:bg-red-50 rounded-md transition disabled:opacity-40"
                                                title="Hapus Chat"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </>
                                    )}
                                </div>

                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6 bg-surface-0">
                            {/* Processing banner */}
                            {!doc.is_processed && (
                                <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 text-center space-y-2">
                                    {doc.processing_status === 'processing' && (
                                        <div className="flex items-center justify-center gap-2 text-xs font-semibold text-amber-900 bg-amber-200/50 py-1.5 rounded-md px-4 w-fit mx-auto">
                                            <Loader2 size={12} className="animate-spin text-amber-700" /> AI Membaca Dokumen...
                                        </div>
                                    )}

                                    {/* Live Processing Log */}
                                    {doc.processing_log && Array.isArray(doc.processing_log) && doc.processing_log.length > 0 && (
                                        <div className="mt-2 text-[10px] text-amber-700 font-mono bg-amber-100/50 p-2 rounded text-left overflow-hidden">
                                            <div className="truncate">
                                                <span className="font-semibold">&gt;</span> {doc.processing_log[doc.processing_log.length - 1].message}
                                            </div>
                                            {doc.processing_log[doc.processing_log.length - 1].progress > 0 && (
                                                <div className="w-full bg-amber-200 h-1 mt-1.5 rounded-full overflow-hidden">
                                                    <div
                                                        className="bg-amber-500 h-full transition-all duration-500"
                                                        style={{ width: `${doc.processing_log[doc.processing_log.length - 1].progress}%` }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                            {messages.length === 0 ? (
                                <div className="text-center py-16 text-text-400">
                                    <div className="w-16 h-16 bg-navy-50 dark:bg-navy-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-navy-100 dark:border-navy-800">
                                        <MessageSquare size={32} className="text-navy-600 dark:text-navy-400" />
                                    </div>
                                    <h3 className="font-extrabold text-navy-900 text-[14px] uppercase tracking-wider mb-2">Chat dengan Dokumen</h3>
                                    <p className="text-xs text-text-500 mb-6 max-w-[260px] mx-auto">
                                        Tanyakan apa saja tentang isi dokumen ini. AI akan menjawab berdasarkan konten yang ada.
                                    </p>
                                    <div className="space-y-2 w-full max-w-sm mx-auto">
                                        {suggestedQuestions.map((q, i) => (
                                            <button
                                                key={i}
                                                onClick={() => { setInput(q); inputRef.current?.focus() }}
                                                className="w-full text-left px-4 py-3 bg-surface-50 dark:bg-surface-0 border border-surface-200 dark:border-slate-700/50 rounded-xl text-xs font-semibold text-text-600 hover:border-navy-400 dark:hover:border-navy-400 hover:bg-white transition-all shadow-sm group"
                                            >
                                                <span className="text-navy-600 mr-2 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all inline-block">→</span> {q}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                messages.map((msg, i) => (
                                    <div key={i} className={`flex gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        {msg.role === 'assistant' && (
                                            <div className="w-8 h-8 bg-navy-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                                                <Bot size={16} className="text-navy-600" />
                                            </div>
                                        )}
                                        <div className={`rounded-2xl px-5 py-3.5 max-w-[85%] text-[14px] leading-relaxed transition-all duration-300 ${msg.role === 'user'
                                            ? 'bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white font-medium corner-right shadow-sm'
                                            : 'bg-surface-50 dark:bg-surface-50 text-text-900 border border-surface-200/50'
                                            }`}>
                                            <div className={`text-sm leading-relaxed whitespace-pre-wrap ${msg.role === 'assistant' ? 'text-text-700' : ''}`}>
                                                {msg.content || (
                                                    <span className="flex items-center gap-2 text-text-400">
                                                        <Loader2 size={14} className="animate-spin" />
                                                        Sedang berpikir...
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        {msg.role === 'user' && (
                                            <div className="w-8 h-8 bg-surface-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1 border border-surface-200 shadow-sm overflow-hidden">
                                                <User size={16} className="text-navy-600" />
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="px-6 pb-6 pt-4 flex-shrink-0 bg-white border-t border-surface-100">
                            <div className="flex items-center gap-3 bg-surface-50 rounded-2xl px-4 py-3 border border-surface-200 focus-within:border-navy-500 focus-within:bg-white transition-all duration-300 shadow-sm focus-within:shadow-md">
                                <textarea
                                    ref={inputRef}
                                    value={input}
                                    onChange={(e) => {
                                        setInput(e.target.value)
                                        e.target.style.height = 'auto'
                                        e.target.style.height = `${e.target.scrollHeight}px`
                                    }}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Tanya tentang dokumen ini..."
                                    rows={1}
                                    className="flex-1 bg-transparent border-none outline-none resize-none text-[14px] font-medium placeholder:text-text-400 whitespace-pre-wrap py-1 max-h-32 scrollbar-thin overflow-y-auto"
                                    disabled={isStreaming}
                                />

                                <button
                                    onClick={sendMessage}
                                    disabled={!input.trim() || isStreaming}
                                    className="bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white hover:opacity-90 active:scale-95 disabled:grayscale disabled:opacity-50 disabled:scale-100 rounded-xl p-2.5 transition-all duration-300 shrink-0"
                                >
                                    {isStreaming ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* RIGHT — Preview Viewer */}
                <div className={`flex flex-col bg-surface-100 relative ${pdfFullscreen ? 'w-full' : 'flex-1'}`}>
                    <div className="px-6 py-4 border-b border-surface-200/60 bg-white flex justify-between items-center shrink-0">
                        <h2 className="font-bold font-display text-navy-900 flex items-center gap-2 text-sm">
                            <FileText size={15} className="text-navy-600" />
                            {isPDF ? 'PDF Viewer' : isImage ? 'Image Preview' : isAudio ? 'Audio Player' : isSql ? 'SQL Preview' : 'Preview Dokumen'}
                        </h2>
                        {isPDF && (
                            <button
                                onClick={() => setPdfFullscreen(!pdfFullscreen)}
                                className="p-1.5 text-text-500 hover:text-navy-900 hover:bg-surface-100 rounded-md transition"
                                title={pdfFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                            >
                                {pdfFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                            </button>
                        )}
                    </div>
                    <div className="flex-1 bg-surface-100 overflow-hidden">
                        {isPDF ? (
                            pdfLoading ? (
                                <div className="flex items-center justify-center h-full">
                                    <div className="text-center space-y-2">
                                        <Loader2 size={28} className="text-navy-600 animate-spin mx-auto" />
                                        <p className="text-xs text-text-500">Memuat PDF...</p>
                                    </div>
                                </div>
                            ) : pdfError ? (
                                <div className="flex items-center justify-center h-full">
                                    <div className="text-center space-y-3 p-6">
                                        <FileText size={36} className="text-text-300 mx-auto" />
                                        <p className="text-sm text-danger font-medium">Gagal memuat PDF</p>
                                        <p className="text-xs text-text-400 max-w-xs">{pdfError}</p>
                                        <button
                                            onClick={loadPdfUrl}
                                            className="btn btn-primary btn-sm mt-2"
                                        >
                                            Coba Lagi
                                        </button>
                                    </div>
                                </div>
                            ) : pdfUrl ? (
                                (() => {
                                    const pageParam = searchParams.get('page')
                                    const searchParam = searchParams.get('search')
                                    const searchSuffix = searchParam ? `&search="${encodeURIComponent(searchParam)}"` : ''
                                    
                                    return (
                                        <iframe
                                            src={`${pdfUrl}#toolbar=1&navpanes=0${pageParam ? `&page=${pageParam}` : ''}${searchSuffix}`}
                                            className="w-full h-full border-0"
                                            title="PDF Viewer"
                                        />
                                    )
                                })()
                            ) : (
                                <div className="flex items-center justify-center h-full">
                                    <div className="text-center space-y-2">
                                        <FileText size={28} className="text-text-300 mx-auto" />
                                        <p className="text-xs text-text-500">PDF tidak tersedia</p>
                                    </div>
                                </div>
                            )
                        ) : isImage ? (
                            <div className="w-full h-full flex items-center justify-center p-4">
                                <img 
                                    src={`/api/documents/pdf/${doc.file_path}`} 
                                    alt={doc.file_name}
                                    className="max-w-full max-h-full object-contain shadow-lg rounded-lg"
                                />
                            </div>
                        ) : isAudio ? (
                            <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-surface-100">
                                <div className="w-24 h-24 rounded-full bg-white shadow-sm border border-surface-200 flex items-center justify-center mb-6">
                                    <FileText size={40} className="text-navy-600" />
                                </div>
                                <div className="text-center space-y-2 mb-8">
                                    <h3 className="font-semibold text-navy-900 text-lg max-w-sm truncate px-4" title={doc.file_name}>{doc.file_name}</h3>
                                    <p className="text-sm text-text-500">Audio Preview</p>
                                </div>
                                <div className="w-full max-w-md bg-white p-6 rounded-2xl shadow-sm border border-surface-200">
                                    <audio 
                                        controls 
                                        className="w-full outline-none"
                                        src={`/api/documents/pdf/${doc.file_path}`} 
                                    >
                                        Browser Anda tidak mendukung elemen audio.
                                    </audio>
                                </div>
                            </div>
                        ) : isDocx ? (
                            <DocxPreview fileUrl={`/api/documents/pdf/${doc.file_path}`} />
                        ) : isXlsx ? (
                            <XlsxPreview fileUrl={`/api/documents/pdf/${doc.file_path}`} />
                        ) : isMarkdown ? (
                            <MarkdownPreview fileUrl={`/api/documents/pdf/${doc.file_path}`} />
                        ) : isSql ? (
                            <SqlPreview fileUrl={`/api/documents/pdf/${doc.file_path}`} />
                        ) : (
                            <DocumentPreviewCard doc={doc} />
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
