'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { getDocumentByIdAction } from '@/lib/actions/document.actions'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import {
    ArrowLeft, FileText, Bot, Tag, FolderOpen, User,
    Maximize2, Minimize2, Loader2, Send, MessageSquare, Sparkles,
    Trash2, ClipboardList
} from 'lucide-react'
import Link from 'next/link'

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
        <div className="space-y-4 h-full">
            {/* Header Bar */}
            <div className="flex items-center gap-4">
                <Link href="/dashboard/documents" className="p-2 text-text-500 hover:text-navy-900 hover:bg-surface-100 rounded-full transition shrink-0">
                    <ArrowLeft size={20} />
                </Link>
                <div className="flex-1 min-w-0">
                    <h1 className="text-xl font-bold font-display text-navy-900 truncate">
                        {doc.ai_title || doc.file_name}
                    </h1>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-text-500 flex-wrap">
                        <span className="flex items-center gap-1"><FileText size={12} /> {doc.file_name}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1"><FolderOpen size={12} /> {doc.division?.name || 'General'}</span>
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

            {/* Split Panel: Chat LEFT | PDF RIGHT */}
            <div className="flex gap-4" style={{ height: 'calc(100vh - 160px)' }}>
                {/* LEFT — AI Chat */}
                {!pdfFullscreen && (
                    <div className="card overflow-hidden flex flex-col" style={{ width: isPDF ? '45%' : '100%', minWidth: 0 }}>
                        {/* Chat Header */}
                        <div className="px-4 py-3 border-b border-surface-200 bg-gradient-to-r from-navy-50 to-surface-50 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-navy-600 flex items-center justify-center">
                                    <Sparkles size={14} className="text-white" />
                                </div>
                                <div>
                                    <h2 className="font-bold font-display text-navy-900 text-sm">Tanya Dokumen</h2>
                                    <p className="text-[10px] text-text-400">AI akan menjawab berdasarkan isi dokumen ini</p>
                                </div>
                            </div>
                            {messages.length > 0 && (
                                <div className="flex items-center gap-1">
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
                                </div>
                            )}
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4 bg-surface-50">
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
                                <div className="flex flex-col items-center justify-center h-full text-center px-4">
                                    <div className="w-16 h-16 rounded-2xl bg-navy-100 flex items-center justify-center mb-4">
                                        <MessageSquare size={28} className="text-navy-600" />
                                    </div>
                                    <h3 className="font-semibold text-navy-900 text-sm mb-1">Chat dengan Dokumen</h3>
                                    <p className="text-xs text-text-400 mb-5 max-w-[260px]">
                                        Tanyakan apa saja tentang isi dokumen ini. AI akan menjawab berdasarkan konten yang ada.
                                    </p>
                                    <div className="space-y-2 w-full max-w-[280px]">
                                        {suggestedQuestions.map((q, i) => (
                                            <button
                                                key={i}
                                                onClick={() => { setInput(q); inputRef.current?.focus() }}
                                                className="w-full text-left px-3 py-2.5 bg-white border border-surface-200 rounded-lg text-xs text-text-600 hover:border-navy-400 hover:bg-navy-50 transition"
                                            >
                                                <span className="text-navy-600 mr-1.5">→</span> {q}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                messages.map((msg, i) => (
                                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] ${msg.role === 'user'
                                            ? 'bg-navy-600 text-white rounded-2xl rounded-br-md px-4 py-2.5'
                                            : 'bg-white border border-surface-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm'
                                            }`}>
                                            {msg.role === 'assistant' && (
                                                <div className="flex items-center gap-1.5 mb-1.5">
                                                    <Bot size={12} className="text-navy-600" />
                                                    <span className="text-[10px] font-semibold text-navy-600">AI Asisten</span>
                                                </div>
                                            )}
                                            <div className={`text-sm leading-relaxed whitespace-pre-wrap ${msg.role === 'assistant' ? 'text-text-700' : ''}`}>
                                                {msg.content || (
                                                    <span className="flex items-center gap-2 text-text-400">
                                                        <Loader2 size={14} className="animate-spin" />
                                                        Sedang berpikir...
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="px-4 py-3 border-t border-surface-200 bg-white shrink-0">
                            <div className="flex items-end gap-2">
                                <textarea
                                    ref={inputRef}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Tanya tentang dokumen ini..."
                                    rows={1}
                                    className="flex-1 resize-none input-field py-2.5 px-3 text-sm leading-relaxed max-h-24"
                                    disabled={isStreaming}
                                    style={{ minHeight: '42px' }}
                                />
                                <button
                                    onClick={sendMessage}
                                    disabled={!input.trim() || isStreaming}
                                    className="btn btn-primary p-2.5 shrink-0 disabled:opacity-40"
                                >
                                    {isStreaming ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* RIGHT — PDF Viewer */}
                {isPDF && (
                    <div className={`card overflow-hidden flex flex-col ${pdfFullscreen ? 'w-full' : ''}`} style={pdfFullscreen ? {} : { width: '55%', minWidth: 0 }}>
                        <div className="px-4 py-3 border-b border-surface-200 bg-surface-0 flex justify-between items-center shrink-0">
                            <h2 className="font-bold font-display text-navy-900 flex items-center gap-2 text-sm">
                                <FileText size={15} className="text-navy-600" />
                                PDF Viewer
                            </h2>
                            <button
                                onClick={() => setPdfFullscreen(!pdfFullscreen)}
                                className="p-1.5 text-text-500 hover:text-navy-900 hover:bg-surface-100 rounded-md transition"
                                title={pdfFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                            >
                                {pdfFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                            </button>
                        </div>
                        <div className="flex-1 bg-surface-100">
                            {pdfLoading ? (
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
                                    const pdfHashParams = new URLSearchParams()
                                    pdfHashParams.set('toolbar', '1')
                                    pdfHashParams.set('navpanes', '0')
                                    if (pageParam) pdfHashParams.set('page', pageParam)
                                    if (searchParam) pdfHashParams.set('search', searchParam)
                                    // Ensure quote marks for exact phrase search in PDF viewers
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
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
