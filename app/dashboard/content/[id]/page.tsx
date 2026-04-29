'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getContentByIdAction, publishContentAction } from '@/lib/actions/content.actions'
import { submitForApprovalAction, reviewApprovalAction } from '@/lib/actions/approval.actions'
import { checkAcknowledgeStatusAction, acknowledgeReadAction } from '@/lib/actions/read-tracker.actions'
import { createSuggestionAction } from '@/lib/actions/suggestion.actions'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useTranslation } from '@/hooks/useTranslation'
import { 
    ArrowLeft, Edit, FileText, CheckCircle, Send, Loader2, Bot, 
    MessageSquare, Sparkles, Trash2, ClipboardList, BookOpen, 
    ShieldCheck, Clock, Globe, Maximize2, Minimize2, CheckCircle2,
    AlertCircle, ChevronRight, User, XCircle, Settings, Database, Network, ArrowUpDown, Square
} from 'lucide-react'
import Link from 'next/link'
import { Role, ContentStatus, ApprovalStatus } from '@prisma/client'
import ReactMarkdown from 'react-markdown'

interface ChatMessage {
    role: 'user' | 'assistant'
    content: string
}

export default function ContentDetailPage() {
    const params = useParams()
    const router = useRouter()
    const { user, role, group, organization } = useCurrentUser()
    const { t } = useTranslation()

    const [content, setContent] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [publishing, setPublishing] = useState(false)
    const [isAcknowledged, setIsAcknowledged] = useState(false)
    const [acknowledging, setAcknowledging] = useState(false)
    const [approving, setApproving] = useState(false)
    const [submittingApproval, setSubmittingApproval] = useState(false)
    const [articleFullscreen, setArticleFullscreen] = useState(false)

    // Chat state
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [input, setInput] = useState('')
    const [isStreaming, setIsStreaming] = useState(false)
    const [isSummarizing, setIsSummarizing] = useState(false)
    const [showSettings, setShowSettings] = useState(false)
    const [useVector, setUseVector] = useState(true)
    const [useGraph, setUseGraph] = useState(true)
    const [useRerank, setUseRerank] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)
    const abortControllerRef = useRef<AbortController | null>(null)

    const isSuperAdmin = role === Role.SUPER_ADMIN || role === Role.MAINTAINER
    const isGroupAdmin = role === Role.GROUP_ADMIN || isSuperAdmin
    const canEdit = isSuperAdmin || (role === Role.GROUP_ADMIN && content?.group_id === group?.id) || (role === Role.SUPERVISOR && content?.group_id === group?.id)
    const canPublish = isGroupAdmin

    const loadContent = async () => {
        if (!params.id) return
        const res = await getContentByIdAction(params.id as string)
        if (res.success && res.data) {
            setContent(res.data)
            
            // Check mandatory read status
            if (res.data.is_mandatory_read && user?.id) {
                const ackRes = await checkAcknowledgeStatusAction(res.data.id, user.id)
                if (ackRes.success) setIsAcknowledged(ackRes.isAcknowledged || false)
            }
        }
        setLoading(false)
    }

    useEffect(() => {
        loadContent()
    }, [params.id, user?.id])

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const handleAcknowledge = async () => {
        if (!user?.id || !content || isAcknowledged) return
        setAcknowledging(true)
        const res = await acknowledgeReadAction(content.id, user.id)
        if (res.success) {
            setIsAcknowledged(true)
        } else {
            alert(res.error || 'Gagal melakukan konfirmasi bacak')
        }
        setAcknowledging(false)
    }

    const handlePublish = async () => {
        if (!content || !confirm(t('content.publish_confirm') || 'Publikasikan konten ini?')) return
        setPublishing(true)
        const res = await publishContentAction(content.id)
        if (res.success) {
            loadContent()
        } else {
            alert(res.error || 'Gagal mempublikasikan konten')
        }
        setPublishing(false)
    }

    const handleSubmitApproval = async () => {
        if (!content || !user) return
        setSubmittingApproval(true)
        const res = await submitForApprovalAction(content.id, user.id)
        if (res.success) {
            loadContent()
        } else {
            alert(res.error || 'Gagal mengajukan persetujuan')
        }
        setSubmittingApproval(false)
    }

    const handleReviewStatus = async (status: 'APPROVED' | 'REJECTED') => {
        const queue = content.approval_queues?.[0]
        if (!queue || !user) return
        
        if (status === 'REJECTED') {
            const note = prompt('Alasan penolakan:')
            if (note === null) return // Cancelled
            setApproving(true)
            const res = await reviewApprovalAction(queue.id, user.id, ApprovalStatus.REJECTED, note)
            if (res.success) loadContent()
            else alert(res.error)
            setApproving(false)
        } else {
            if (!confirm('Setujui dan publikasikan konten ini?')) return
            setApproving(true)
            const res = await reviewApprovalAction(queue.id, user.id, ApprovalStatus.APPROVED)
            if (res.success) loadContent()
            else alert(res.error)
            setApproving(false)
        }
    }

    const stopStreaming = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort()
            setIsStreaming(false)
        }
    }

    const sendMessage = async () => {
        const q = input.trim()
        if (!q || isStreaming || !content) return

        const userMsg: ChatMessage = { role: 'user', content: q }
        const newMessages = [...messages, userMsg]
        setMessages(newMessages)
        setInput('')
        if (inputRef.current) inputRef.current.style.height = 'auto'
        setIsStreaming(true)

        setMessages(prev => [...prev, { role: 'assistant', content: '' }])
        
        const controller = new AbortController()
        abortControllerRef.current = controller

        try {
            const res = await fetch('/api/ai/chat-content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    contentId: content.id,
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
            let fullText = ''

            if (reader) {
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
                                        const next = [...prev]
                                        next[next.length - 1] = { role: 'assistant', content: fullText }
                                        return next
                                    })
                                }
                                if (parsed.error) {
                                    fullText += `\n⚠️ ${parsed.error}`
                                    setMessages(prev => {
                                        const updated = [...prev]
                                        updated[updated.length - 1] = { role: 'assistant', content: fullText }
                                        return updated
                                    })
                                }
                            } catch {}
                        }
                    }
                }
            }
            await fetch('/api/chat/entity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contentId: params.id,
                    title: content?.title || 'Article Q&A',
                    messages: [...newMessages, { role: 'assistant', content: fullText }]
                })
            })
        } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') {
                // Ignore abort error
            } else {
                setMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: '⚠️ Koneksi terputus. Silakan coba lagi.' }])
            }
        } finally {
            setIsStreaming(false)
            abortControllerRef.current = null
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

        const controller = new AbortController()
        abortControllerRef.current = controller

        try {
            const res = await fetch('/api/ai/chat-content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    contentId: content.id,
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
        } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') {
                // Ignore abort error
            } else {
                setMessages(prev => {
                    const updated = [...prev]
                    updated[updated.length - 1] = { role: 'assistant', content: '⚠️ Koneksi terputus.' }
                    return updated
                })
            }
        } finally {
            setIsSummarizing(false)
            abortControllerRef.current = null
        }
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <Loader2 size={40} className="animate-spin text-navy-600 mb-4" />
                <p className="text-text-500 font-medium">{t('content.loading_content')}</p>
            </div>
        )
    }

    if (!content) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <AlertCircle size={48} className="text-danger mb-4" />
                <h2 className="text-2xl font-bold text-navy-900 mb-2">{t('content.not_found')}</h2>
                <button onClick={() => router.back()} className="btn btn-secondary mt-4 flex items-center gap-2">
                    <ArrowLeft size={16} /> {t('common.back')}
                </button>
            </div>
        )
    }

    const isPublished = content.status === ContentStatus.PUBLISHED

    return (
        <div className="flex flex-col h-[calc(100vh-60px)] -m-6 md:-m-8 bg-surface-0">
            {/* Header / Toolbar */}
            <div className="bg-white dark:bg-surface-0 border-b border-surface-200/60 dark:border-surface-100 px-6 py-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.back()} className="p-2.5 rounded-xl text-text-500 hover:text-navy-600 hover:bg-surface-100 transition-all active:scale-95 border border-transparent hover:border-surface-200 shrink-0">
                        <ArrowLeft size={22} />
                    </button>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                                content.status === 'PUBLISHED' ? 'bg-success-bg text-success' : 
                                content.status === 'PENDING_APPROVAL' ? 'bg-amber-100 text-amber-700' : 'bg-surface-200 text-text-600'
                            }`}>
                                {content.status}
                            </span>
                            {content.is_mandatory_read && (
                                <span className="bg-danger-bg text-danger text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1">
                                    <AlertCircle size={10} /> {t('content.mandatory_read')}
                                </span>
                            )}
                        </div>
                        <h2 className="text-sm font-bold text-navy-900 truncate max-w-md hidden md:block">{content.title}</h2>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Draft Status Actions */}
                    {content.status === ContentStatus.DRAFT && (
                        <>
                            {canPublish && (
                                <button onClick={handlePublish} disabled={publishing} className="btn bg-success text-white hover:bg-success-dark shadow-sm">
                                    {publishing ? <Loader2 size={16} className="animate-spin" /> : <Globe size={16} className="mr-2" />}
                                    {t('common.publish')}
                                </button>
                            )}
                            <button onClick={handleSubmitApproval} disabled={submittingApproval} className="btn bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100">
                                {submittingApproval ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} className="mr-2" />}
                                {t('content.submit_approval') || 'Ajukan Approval'}
                            </button>
                        </>
                    )}

                    {/* Pending Approval Actions */}
                    {content.status === ContentStatus.PENDING_APPROVAL && isGroupAdmin && (
                        <div className="flex items-center gap-2">
                             <button onClick={() => handleReviewStatus('REJECTED')} disabled={approving} className="btn bg-danger-bg text-danger border border-red-200 hover:bg-red-50">
                                <XCircle size={16} className="mr-2" /> Tolak
                            </button>
                            <button onClick={() => handleReviewStatus('APPROVED')} disabled={approving} className="btn bg-success-bg text-success border border-green-200 hover:bg-green-50">
                                <CheckCircle size={16} className="mr-2" /> Setujui & Terbitkan
                            </button>
                        </div>
                    )}

                    {canEdit && (
                        <Link href={`/dashboard/content/${content.id}/edit`} className="btn border border-surface-200 text-text-600 hover:bg-surface-50 bg-white">
                            <Edit size={16} className="mr-2" /> {t('common.edit')}
                        </Link>
                    )}
                </div>
            </div>

            {/* Main Layout: Split AI Chat & Content */}
            <div className="flex flex-1 overflow-hidden bg-surface-0 border-t border-surface-200">
                {/* AI Chat Panel (Left) */}
                {isPublished && !articleFullscreen && (
                    <div className="w-[380px] border-r border-surface-200/60 bg-white dark:bg-surface-0 flex flex-col shrink-0">
                        <div className="px-6 py-4 border-b border-surface-100/60 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-tr from-navy-600 via-navy-500 to-indigo-400 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-navy-600/10">
                                    <Bot size={20} className="text-white drop-shadow-md" />
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-navy-900 text-[14px] uppercase tracking-wider leading-tight">AISA Assistant</h3>
                                    <p className="text-[9px] font-bold text-text-400 mt-0.5 uppercase tracking-wider">Diskusi Artikel</p>
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
                                            onClick={() => { setMessages([]); if (params.id) fetch(`/api/chat/entity?contentId=${params.id}`, { method: 'DELETE' }).catch(() => { }) }}
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

                        <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6 bg-surface-0">
                            {messages.length === 0 ? (
                                <div className="text-center py-16 text-text-400">
                                    <div className="w-16 h-16 bg-navy-50 dark:bg-navy-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-navy-100 dark:border-navy-800">
                                        <MessageSquare size={32} className="text-navy-600 dark:text-navy-400" />
                                    </div>
                                    <h3 className="font-extrabold text-navy-900 text-[14px] uppercase tracking-wider mb-2">Tanya AISA</h3>
                                    <p className="text-xs text-text-500 mb-6 max-w-[260px] mx-auto">
                                        Ajukan pertanyaan tentang isi artikel ini, AISA akan menjawab berdasarkan konteks yang ada.
                                    </p>
                                </div>
                            ) : (
                                messages.map((msg, idx) => (
                                    <div key={idx} className={`flex gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        {msg.role === 'assistant' && (
                                            <div className="w-8 h-8 bg-navy-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                                                <Bot size={16} className="text-navy-600" />
                                            </div>
                                        )}
                                        <div className={`rounded-2xl px-5 py-3.5 max-w-[85%] text-[14px] leading-relaxed transition-all duration-300 ${
                                            msg.role === 'user' ? 'bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white font-medium corner-right shadow-sm' : 'bg-surface-50 dark:bg-surface-50 text-text-900 border border-surface-200/50'
                                        }`}>
                                            <div className={`text-sm leading-relaxed ${msg.role === 'assistant' ? 'text-text-700 markdown-content' : 'whitespace-pre-wrap'}`}>
                                                {msg.content ? (
                                                    <ReactMarkdown
                                                        components={{
                                                            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                                                            strong: ({ children }) => <strong className="font-black text-navy-900 dark:text-navy-400">{children}</strong>,
                                                            ul: ({ children }) => <ul className="list-disc ml-4 mb-2 space-y-1">{children}</ul>,
                                                            ol: ({ children }) => <ol className="list-decimal ml-4 mb-2 space-y-1">{children}</ol>,
                                                            li: ({ children }) => <li className="pl-1">{children}</li>,
                                                            code: ({ children }) => <code className="bg-navy-50 dark:bg-navy-900/50 px-1.5 py-0.5 rounded text-navy-700 dark:text-navy-300 font-mono text-[13px]">{children}</code>,
                                                        }}
                                                    >
                                                        {msg.content}
                                                    </ReactMarkdown>
                                                ) : (
                                                    <span className="flex items-center gap-2 text-text-400">
                                                        <Loader2 size={14} className="animate-spin" />
                                                        Thinking...
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

                        <div className="px-6 pb-6 pt-4 flex-shrink-0 bg-white border-t border-surface-100">
                            <div className="flex items-center gap-3 bg-surface-50 rounded-2xl px-4 py-3 border border-surface-200 focus-within:border-navy-500 focus-within:bg-white transition-all duration-300 shadow-sm focus-within:shadow-md">
                                <textarea 
                                    ref={inputRef}
                                    value={input}
                                    onChange={e => {
                                        setInput(e.target.value)
                                        e.target.style.height = 'auto'
                                        e.target.style.height = `${e.target.scrollHeight}px`
                                    }}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault()
                                            sendMessage()
                                        }
                                    }}
                                    placeholder="Tanya sesuatu..."
                                    rows={1}
                                    className="flex-1 bg-transparent border-none outline-none resize-none text-[14px] font-medium placeholder:text-text-400 whitespace-pre-wrap py-1 max-h-32 scrollbar-thin overflow-y-auto"
                                    disabled={isStreaming}
                                />

                                {isStreaming ? (
                                    <button
                                        onClick={stopStreaming}
                                        className="bg-red-500 hover:bg-red-600 text-white rounded-xl p-2.5 transition-all duration-300 shrink-0"
                                    >
                                        <Square size={16} fill="currentColor" />
                                    </button>
                                ) : (
                                    <button
                                        onClick={sendMessage}
                                        disabled={!input.trim()}
                                        className="bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white hover:opacity-90 active:scale-95 disabled:grayscale disabled:opacity-50 disabled:scale-100 rounded-xl p-2.5 transition-all duration-300 shrink-0"
                                    >
                                        <Send size={16} />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Content Viewer Panel (Center/Right) */}
                <div className="flex-1 overflow-y-auto flex flex-col relative">
                    {isPublished && (
                        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-surface-200 px-6 py-2 flex items-center justify-between">
                             <div className="flex items-center gap-2">
                                <BookOpen size={14} className="text-navy-600" />
                                <span className="text-xs font-bold text-navy-900">Article Viewer</span>
                             </div>
                             <button onClick={() => setArticleFullscreen(!articleFullscreen)} className="p-1.5 hover:bg-surface-100 rounded transition text-text-400">
                                {articleFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                             </button>
                        </div>
                    )}

                    <div className={`max-w-4xl mx-auto w-full p-8 md:p-12 pb-24 ${articleFullscreen ? 'max-w-5xl' : ''}`}>
                        {content.image_url && (
                            <div className="w-full aspect-[21/9] rounded-2xl overflow-hidden mb-8 shadow-lg border border-surface-200">
                                <img src={content.image_url} alt={content.title} className="w-full h-full object-cover" />
                            </div>
                        )}

                        <div className="mb-8">
                            <h1 className="text-4xl font-extrabold text-navy-900 font-display leading-tight mb-4">{content.title}</h1>
                            <div className="flex flex-wrap items-center gap-y-3 gap-x-6 text-sm text-text-500">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-surface-200 flex items-center justify-center font-bold text-navy-700">
                                        {content.author_name?.[0] || 'U'}
                                    </div>
                                    <span className="font-semibold text-navy-900">{content.author_name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Clock size={16} className="text-text-300" />
                                    <span>{new Date(content.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <ShieldCheck size={16} className="text-text-300" />
                                    <span>{content.group?.name || t('content.global')}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="bg-navy-50 text-navy-700 px-2.5 py-0.5 rounded-full text-xs font-bold">
                                        {content.category}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div 
                            className="prose prose-navy max-w-none pt-8 border-t border-surface-200 
                            prose-headings:font-display prose-headings:text-navy-900 prose-headings:font-bold
                            prose-p:text-text-700 prose-p:leading-relaxed prose-p:mb-6
                            prose-img:rounded-xl prose-img:shadow-md
                            prose-a:text-navy-600 prose-a:font-semibold hover:prose-a:text-navy-700"
                            dangerouslySetInnerHTML={{ __html: content.body }}
                        />

                        {/* Mandatory Read Footer */}
                        {content.is_mandatory_read && (
                            <div className="mt-16 p-8 rounded-2xl bg-gradient-to-br from-navy-900 to-navy-800 text-white shadow-xl relative overflow-hidden group">
                                <div className="absolute top-[-20px] right-[-20px] w-40 h-40 bg-white/5 rounded-full blur-3xl group-hover:bg-white/10 transition-all" />
                                <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                                    <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center border border-white/20 shrink-0">
                                        <CheckCircle2 size={32} className="text-white" />
                                    </div>
                                    <div className="flex-1 text-center md:text-left">
                                        <h3 className="text-xl font-bold mb-2">Konfirmasi Pembacaan Mandatori</h3>
                                        <p className="text-white/70 text-sm">Dengan menekan tombol di bawah, Anda menyatakan telah membaca dan memahami isi dari konten ini sesuai dengan kebijakan organisasi.</p>
                                    </div>
                                    <div className="shrink-0 w-full md:w-auto">
                                        {isAcknowledged ? (
                                            <div className="bg-success/20 backdrop-blur-md border border-success/40 text-success-bg px-6 py-3 rounded-xl flex items-center gap-2 font-bold justify-center">
                                                <CheckCircle size={20} /> Terkonfirmasi
                                            </div>
                                        ) : (
                                            <button 
                                                onClick={handleAcknowledge}
                                                disabled={acknowledging}
                                                className="w-full md:w-auto px-8 py-3 bg-white text-navy-900 rounded-xl font-bold hover:bg-navy-50 hover:scale-105 transition-all flex items-center justify-center gap-2 group/btn shadow-lg"
                                            >
                                                {acknowledging ? <Loader2 className="animate-spin" /> : <Send size={18} className="transition-transform group-hover/btn:translate-x-1" />}
                                                Saya Sudah Membaca
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
