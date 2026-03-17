'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getContentByIdAction, publishContentAction } from '@/lib/actions/content.actions'
import { submitForApprovalAction } from '@/lib/actions/approval.actions'
import { checkAcknowledgeStatusAction, acknowledgeReadAction } from '@/lib/actions/read-tracker.actions'
import { createSuggestionAction } from '@/lib/actions/suggestion.actions'
import { getReviewCommentsAction, createReviewCommentAction, resolveReviewCommentAction, deleteReviewCommentAction } from '@/lib/actions/review-comment.actions'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { ArrowLeft, Edit, FileText, CheckCircle, ExternalLink, Send, MessageSquarePlus, Maximize2, Minimize2, Loader2, Bot, MessageSquare, Sparkles, Trash2, ClipboardList, MessageCircle, X, Check, ChevronDown, ChevronUp } from 'lucide-react'
import Link from 'next/link'

interface ChatMessage {
    role: 'user' | 'assistant'
    content: string
}

interface ReviewComment {
    id: string
    content_id: string
    author_id: string
    author_name: string
    highlighted_text: string
    comment: string
    is_resolved: boolean
    created_at: Date
}

export default function ContentDetailPage() {
    const params = useParams()
    const router = useRouter()
    const { user, role } = useCurrentUser()

    const [content, setContent] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [publishing, setPublishing] = useState(false)
    const [isAcknowledged, setIsAcknowledged] = useState(false)
    const [acknowledging, setAcknowledging] = useState(false)

    // Suggestion state
    const [suggestionText, setSuggestionText] = useState('')
    const [isSuggesting, setIsSuggesting] = useState(false)
    const [suggestionMsg, setSuggestionMsg] = useState('')

    // Chat state
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [chatSessionId, setChatSessionId] = useState<string | null>(null)
    const [input, setInput] = useState('')
    const [isStreaming, setIsStreaming] = useState(false)
    const [isSummarizing, setIsSummarizing] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)
    const [articleFullscreen, setArticleFullscreen] = useState(false)
    const [reprocessing, setReprocessing] = useState(false)

    // Review comments state
    const [reviewComments, setReviewComments] = useState<ReviewComment[]>([])
    const [showCommentForm, setShowCommentForm] = useState(false)
    const [selectedText, setSelectedText] = useState('')
    const [commentText, setCommentText] = useState('')
    const [isSubmittingComment, setIsSubmittingComment] = useState(false)
    const [showCommentPanel, setShowCommentPanel] = useState(false)
    const articleRef = useRef<HTMLElement>(null)
    const tooltipRef = useRef<HTMLDivElement>(null)
    const [selectionTooltip, setSelectionTooltip] = useState<{ top: number; left: number } | null>(null)

    // Fetch chat history on mount
    useEffect(() => {
        if (params.id) {
            fetch(`/api/chat/entity?contentId=${params.id}`)
                .then(res => res.json())
                .then(data => {
                    if (data.messages && data.messages.length > 0) {
                        setMessages(data.messages)
                    }
                    if (data.sessionId) setChatSessionId(data.sessionId)
                }).catch(() => { })
        }
    }, [params.id])

    // Load review comments
    const loadReviewComments = useCallback(async () => {
        if (!params.id) return
        const res = await getReviewCommentsAction(params.id as string)
        if (res.success) {
            setReviewComments(res.data || [])
        }
    }, [params.id])

    useEffect(() => {
        loadReviewComments()
    }, [loadReviewComments])

    // Text selection handler for inline commenting
    const handleTextSelection = useCallback(() => {
        // Skip if comment form is open
        if (showCommentForm) return

        const selection = window.getSelection()
        if (!selection || selection.isCollapsed || !articleRef.current) {
            // Don't clear tooltip if we clicked inside the tooltip itself
            setTimeout(() => {
                const activeEl = document.activeElement
                if (tooltipRef.current?.contains(activeEl)) return
                setSelectionTooltip(null)
            }, 100)
            return
        }

        // Only allow selection within the article body
        const range = selection.getRangeAt(0)
        if (!articleRef.current.contains(range.commonAncestorContainer)) {
            setSelectionTooltip(null)
            return
        }

        const text = selection.toString().trim()
        if (text.length < 3) {
            setSelectionTooltip(null)
            return
        }

        const rect = range.getBoundingClientRect()
        setSelectedText(text)
        setSelectionTooltip({
            top: rect.top + window.scrollY - 45,
            left: rect.left + window.scrollX + rect.width / 2 - 70,
        })
    }, [showCommentForm])

    useEffect(() => {
        document.addEventListener('mouseup', handleTextSelection)
        return () => document.removeEventListener('mouseup', handleTextSelection)
    }, [handleTextSelection])

    const openCommentForm = () => {
        setShowCommentForm(true)
        setShowCommentPanel(true)
        setSelectionTooltip(null)
        setCommentText('')
    }

    const handleSubmitComment = async () => {
        if (!user?.id || !selectedText.trim() || !commentText.trim()) return
        setIsSubmittingComment(true)
        const res = await createReviewCommentAction({
            contentId: params.id as string,
            authorId: user.id,
            highlightedText: selectedText,
            comment: commentText,
        })
        if (res.success) {
            setShowCommentForm(false)
            setCommentText('')
            setSelectedText('')
            loadReviewComments()
        }
        setIsSubmittingComment(false)
    }

    const handleResolveComment = async (commentId: string) => {
        await resolveReviewCommentAction(commentId)
        loadReviewComments()
    }

    const handleDeleteComment = async (commentId: string) => {
        if (!confirm('Hapus komentar ini?')) return
        await deleteReviewCommentAction(commentId)
        loadReviewComments()
    }

    useEffect(() => {
        if (params.id) {
            loadContent(params.id as string)
        }
    }, [params.id])

    const loadContent = async (id: string, currentUserId?: string) => {
        const res = await getContentByIdAction(id)
        if (res.success && res.data) {
            setContent(res.data)

            // Check read tracker if it's mandatory
            if (res.data.is_mandatory_read && currentUserId) {
                const ackRes = await checkAcknowledgeStatusAction(id, currentUserId)
                if (ackRes.success) {
                    setIsAcknowledged(ackRes.isAcknowledged || false)
                }
            }
        }
        setLoading(false)
    }

    // Effect for when user ID resolves
    useEffect(() => {
        if (params.id && user?.id) {
            if (content?.is_mandatory_read) {
                checkAcknowledgeStatusAction(params.id as string, user.id).then(ackRes => {
                    if (ackRes.success) setIsAcknowledged(ackRes.isAcknowledged || false)
                })
            }
        }
    }, [user?.id, content?.is_mandatory_read, params.id])

    // Initial load
    useEffect(() => {
        if (params.id) {
            loadContent(params.id as string, user?.id)
        }
    }, [params.id, user?.id])

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // Auto-poll if content is currently processing
    useEffect(() => {
        if (!content || content.status !== 'PUBLISHED' || content.is_processed) return
        if (content.processing_status === 'failed' || content.processing_error) return

        const poll = setInterval(async () => {
            const res = await getContentByIdAction(content.id)
            if (res.success && res.data) {
                setContent(res.data)
                if (res.data.is_processed || res.data.processing_error) {
                    clearInterval(poll)
                }
            }
        }, 5000)

        return () => clearInterval(poll)
    }, [content?.id, content?.status, content?.is_processed, content?.processing_status, content?.processing_error])

    const handleAcknowledge = async () => {
        if (!user || isAcknowledged) return
        setAcknowledging(true)
        const res = await acknowledgeReadAction(content.id, user.id)
        if (res.success) {
            setIsAcknowledged(true)
            alert('Successfully acknowledged! 50 Points awarded.')
        } else {
            alert(res.error || 'Failed to acknowledge')
        }
        setAcknowledging(false)
    }

    const handleAddSuggestion = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user || !suggestionText.trim()) return
        setIsSuggesting(true)

        const res = await createSuggestionAction(content.id, user.id, suggestionText)
        if (res.success) {
            setSuggestionMsg('Thank you! Your revision suggestion has been sent to the managers.')
            setSuggestionText('')
        } else {
            setSuggestionMsg(res.error || 'Failed to submit suggestion.')
        }
        setIsSuggesting(false)
        setTimeout(() => setSuggestionMsg(''), 5000)
    }

    const handleSubmitApproval = async () => {
        if (!user || !confirm('Submit this article for approval?')) return
        setPublishing(true)
        const res = await submitForApprovalAction(content.id, user.id)
        if (res.success) {
            alert('Article submitted for approval!')
            loadContent(content.id)
        } else {
            alert(res.error || 'Failed to submit')
        }
        setPublishing(false)
    }

    const handlePublish = async () => {
        if (!confirm('Are you sure you want to logically publish this article?')) return
        setPublishing(true)

        const res = await publishContentAction(content.id)
        if (res.success) {
            alert('Article successfully published! AI processing has started.')
            loadContent(content.id)
        } else {
            alert(res.error || 'Failed to publish')
        }
        setPublishing(false)
    }

    const sendMessage = async () => {
        const q = input.trim()
        if (!q || isStreaming || !content) return

        const userMsg: ChatMessage = { role: 'user', content: q }
        const newMessages = [...messages, userMsg]
        setMessages(newMessages)
        setInput('')
        setIsStreaming(true)

        // Add empty assistant message for streaming
        setMessages(prev => [...prev, { role: 'assistant', content: '' }])

        try {
            const res = await fetch('/api/ai/chat-content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contentId: content.id,
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
                    contentId: params.id,
                    title: content?.title || 'Knowledge Base Q&A',
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

    // Trigger reprocessing for articles that failed or never got processed
    const handleReprocess = async () => {
        if (!content || reprocessing) return
        setReprocessing(true)
        try {
            await fetch('/api/ai/process-content', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-internal-secret': 'diamond-kms-cron-secret-2026',
                },
                body: JSON.stringify({ contentId: content.id }),
            })
            // Start polling for completion
            const poll = setInterval(async () => {
                const res = await getContentByIdAction(content.id)
                if (res.success && res.data) {
                    setContent(res.data)
                    if (res.data.is_processed || res.data.processing_error) {
                        clearInterval(poll)
                        setReprocessing(false)
                    }
                }
            }, 5000)
            setTimeout(() => { clearInterval(poll); setReprocessing(false) }, 120000)
        } catch {
            setReprocessing(false)
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
                await fetch(`/api/chat/entity?contentId=${params.id}`, { method: 'DELETE' })
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
            const res = await fetch('/api/ai/chat-content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contentId: content.id,
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
                <p className="text-text-500 text-sm">Loading Article...</p>
            </div>
        </div>
    )

    if (!content) return (
        <div className="flex items-center justify-center h-[60vh]">
            <div className="text-center space-y-2">
                <FileText size={40} className="text-text-300 mx-auto" />
                <p className="text-danger font-semibold">Article not found</p>
                <Link href="/dashboard/knowledge-base" className="btn btn-secondary text-sm mt-2">
                    <ArrowLeft size={14} /> Back
                </Link>
            </div>
        </div>
    )

    const isPublished = content.status === 'PUBLISHED'
    const suggestedQuestions = [
        'Apa poin utama dari artikel ini?',
        'Adakah instruksi atau prosedur di sini?',
        'Buat ringkasan singkat dalam bahasa Indonesia.',
    ]

    return (
        <div className="flex flex-col h-[calc(100vh-100px)]">
            <div className="flex items-center gap-4 border-b border-surface-200 pb-4 mb-4 shrink-0">
                <Link href="/dashboard/knowledge-base" className="p-2 text-text-500 hover:text-navy-900 hover:bg-surface-100 rounded-full transition">
                    <ArrowLeft size={20} />
                </Link>
                <div className="flex-1">
                    <div className="flex items-center gap-3">
                        <span className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded uppercase tracking-wider ${isPublished ? 'bg-green-100 text-green-700' :
                            content.status === 'PENDING_APPROVAL' ? 'bg-orange-100 text-orange-700' :
                                'bg-surface-200 text-text-700'
                            }`}>
                            {content.status}
                        </span>
                        {content.is_mandatory_read && (
                            <span className="inline-block px-2.5 py-0.5 bg-danger-bg text-red-700 text-xs font-semibold rounded uppercase tracking-wider">
                                Mandatory Read
                            </span>
                        )}
                        <span className="text-sm font-medium text-text-500 bg-surface-100 px-2 py-0.5 rounded border">
                            {content.category}
                        </span>
                    </div>
                </div>

                <div className="flex gap-2">
                    {/* Simplified roles: Any authoring admin can publish for MVP */}
                    {content.status === 'DRAFT' && (
                        <button
                            onClick={handleSubmitApproval}
                            disabled={publishing}
                            className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-md hover:bg-indigo-700 transition flex items-center gap-2"
                        >
                            <Send size={18} />
                            Request Approval
                        </button>
                    )}

                    {['SUPER_ADMIN', 'GROUP_ADMIN', 'MAINTAINER'].includes(role || '') && content.status !== 'PUBLISHED' && (
                        <button
                            onClick={handlePublish}
                            disabled={publishing}
                            className="px-4 py-2 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 transition flex items-center gap-2"
                        >
                            <CheckCircle size={18} />
                            Publish
                        </button>
                    )}

                    {['SUPER_ADMIN', 'GROUP_ADMIN', 'SUPERVISOR', 'MAINTAINER'].includes(role || '') && (
                        <button className="px-4 py-2 border border-navy-600 text-navy-600 font-medium rounded-md hover:bg-navy-50 transition flex items-center gap-2">
                            <Edit size={18} />
                            Edit
                        </button>
                    )}

                    {/* Review Comments Toggle */}
                    {reviewComments.length > 0 && (
                        <button
                            onClick={() => setShowCommentPanel(!showCommentPanel)}
                            className={`px-4 py-2 font-medium rounded-md transition flex items-center gap-2 ${
                                showCommentPanel
                                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                    : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                            }`}
                        >
                            <MessageCircle size={18} />
                            Komentar
                            <span className="bg-amber-500 text-white text-[11px] font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                                {reviewComments.filter(c => !c.is_resolved).length}
                            </span>
                        </button>
                    )}
                </div>
            </div>

            {/* Content Area - Split Panel when Published, Single container when Draft */}
            <div className={`flex-1 min-h-0 flex gap-4 ${(!isPublished && !showCommentPanel) ? 'max-w-5xl mx-auto w-full' : 'w-full'}`}>

                {/* LEFT SIDE - AI CHAT (Only if published) */}
                {isPublished && !articleFullscreen && (
                    <div className="card overflow-hidden flex flex-col w-[35%] min-w-[320px] max-w-[400px]">
                        {/* Chat Header */}
                        <div className="px-4 py-3 border-b border-surface-200 bg-gradient-to-r from-navy-50 to-surface-50 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-navy-600 flex items-center justify-center">
                                    <Sparkles size={14} className="text-white" />
                                </div>
                                <div>
                                    <h2 className="font-bold font-display text-navy-900 text-sm">AI Article Assistant</h2>
                                    <p className="text-[10px] text-text-400">Tanya seputar isi artikel ini</p>
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
                            {!content.is_processed && (
                                <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 text-center space-y-2">
                                    {(content.processing_status === 'processing' || reprocessing) ? (
                                        <div className="flex items-center justify-center gap-2 text-xs font-semibold text-amber-900 bg-amber-200/50 py-1.5 rounded-md px-4 w-fit mx-auto">
                                            <Loader2 size={12} className="animate-spin text-amber-700" /> AI Membaca Artikel...
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <div className="text-xs font-semibold text-amber-900">AI belum memproses artikel ini.</div>
                                            <button
                                                onClick={handleReprocess}
                                                className="px-4 py-1.5 bg-amber-600 text-white text-xs font-semibold rounded-md hover:bg-amber-700 transition"
                                            >
                                                🔄 Proses Ulang AI
                                            </button>
                                        </div>
                                    )}

                                    {content.processing_log && Array.isArray(content.processing_log) && content.processing_log.length > 0 && (
                                        <div className="mt-2 text-[10px] text-amber-700 font-mono bg-amber-100/50 p-2 rounded text-left overflow-hidden">
                                            <div className="truncate">
                                                <span className="font-semibold">&gt;</span> {content.processing_log[content.processing_log.length - 1].message}
                                            </div>
                                            {content.processing_log[content.processing_log.length - 1].progress > 0 && (
                                                <div className="w-full bg-amber-200 h-1 mt-1.5 rounded-full overflow-hidden">
                                                    <div
                                                        className="bg-amber-500 h-full transition-all duration-500"
                                                        style={{ width: `${content.processing_log[content.processing_log.length - 1].progress}%` }}
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
                                    <h3 className="font-semibold text-navy-900 text-sm mb-1">Diskusi Artikel</h3>
                                    <p className="text-xs text-text-400 mb-5 max-w-[260px]">
                                        Tanyakan apa saja. AI saya akan menjawab instan menggunakan informasi dari teks artikel ini.
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
                                                        Berpikir...
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <div className="px-4 py-3 border-t border-surface-200 bg-white shrink-0">
                            <div className="flex items-end gap-2">
                                <textarea
                                    ref={inputRef}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Tanya dengan AI..."
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

                {/* RIGHT SIDE - ARTICLE VIEWER */}
                <div className={`bg-white rounded-xl shadow-sm border flex flex-col overflow-hidden ${isPublished && !articleFullscreen ? 'w-[65%] flex-1' : 'w-full'}`}>

                    {isPublished && (
                        <div className="px-6 py-3 border-b border-surface-200 bg-surface-0 flex justify-between items-center shrink-0">
                            <h2 className="font-bold font-display text-navy-900 flex items-center gap-2 text-sm">
                                <FileText size={15} className="text-navy-600" />
                                Article Contents
                            </h2>
                            <button
                                onClick={() => setArticleFullscreen(!articleFullscreen)}
                                className="p-1.5 text-text-500 hover:text-navy-900 hover:bg-surface-100 rounded-md transition"
                                title={articleFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                            >
                                {articleFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                            </button>
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto p-8 md:p-12 relative">
                        <h1 className="text-4xl font-extrabold text-navy-900 mb-6 leading-tight tracking-tight">
                            {content.title}
                        </h1>

                        {content.image_url && (
                            <div className="mb-8 aspect-[21/9] w-full overflow-hidden rounded-2xl border border-surface-200">
                                <img src={content.image_url} alt={content.title} className="h-full w-full object-cover" />
                            </div>
                        )}

                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-10 pb-6 border-b text-sm text-text-500">
                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-text-700">Author:</span>
                                {content.author_name}
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-text-700">Division:</span>
                                {content.division?.name || 'Globally Visible'}
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-text-700">Created:</span>
                                {new Date(content.created_at).toLocaleDateString()}
                            </div>
                            {content.published_at && (
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold text-text-700">Published:</span>
                                    {new Date(content.published_at).toLocaleDateString()}
                                </div>
                            )}
                        </div>

                        {/* HTML rendering area */}
                        <article
                            ref={articleRef}
                            className="prose prose-slate max-w-none prose-headings:font-bold font-display prose-headings:tracking-tight prose-a:text-navy-600 pt-2"
                            dangerouslySetInnerHTML={{ __html: content.body }}
                        />

                        {/* Selection Tooltip - appears when user highlights text */}
                        {selectionTooltip && ['SUPER_ADMIN', 'GROUP_ADMIN', 'MAINTAINER'].includes(role || '') && !isPublished && (
                            <div
                                ref={tooltipRef}
                                className="fixed z-50 bg-navy-900 text-white rounded-lg shadow-xl px-3 py-2 flex items-center gap-2 cursor-pointer hover:bg-navy-800 transition"
                                style={{ top: selectionTooltip.top, left: selectionTooltip.left }}
                                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); openCommentForm(); }}
                            >
                                <MessageCircle size={14} />
                                <span className="text-xs font-medium whitespace-nowrap">Tambah Komentar</span>
                            </div>
                        )}

                        {content.source_documents && content.source_documents.length > 0 && (
                            <div className="mt-16 pt-6 border-t">
                                <h4 className="font-bold font-display text-navy-900 flex items-center gap-2 mb-4">
                                    <FileText size={18} className="text-navy-600" /> Source References
                                </h4>
                                <ul className="space-y-2">
                                    {content.source_documents.map((docPath: string, idx: number) => (
                                        <li key={idx} className="flex flex-row items-center gap-2 text-sm text-navy-600 hover:underline cursor-pointer">
                                            <ExternalLink size={14} /> {docPath.split('/').pop() || docPath}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Action Bar for employees (Read Tracker) */}
                        {content.is_mandatory_read && isPublished && (
                            <div className={`border rounded-lg p-6 flex flex-col md:flex-row items-center justify-between gap-4 mt-12 ${isAcknowledged ? 'bg-success-bg border-green-200' : 'bg-navy-50 border-blue-200'
                                }`}>
                                <div>
                                    <h3 className={`font-bold font-display ${isAcknowledged ? 'text-green-900' : 'text-blue-900'}`}>
                                        {isAcknowledged ? 'Acknowledgment Completed' : 'Mandatory Acknowledgment Required'}
                                    </h3>
                                    <p className={`text-sm ${isAcknowledged ? 'text-green-700' : 'text-navy-700'}`}>
                                        {isAcknowledged
                                            ? 'You have confirmed reading this document. The points have been added to your profile.'
                                            : 'By clicking acknowledge, you confirm you have read and understood this document.'}
                                    </p>
                                </div>

                                {isAcknowledged ? (
                                    <div className="px-6 py-2.5 bg-green-100 text-green-800 rounded shadow-sm font-medium flex items-center gap-2 whitespace-nowrap border border-green-200 cursor-default">
                                        <CheckCircle size={18} />
                                        Acknowledged
                                    </div>
                                ) : (
                                    <button
                                        onClick={handleAcknowledge}
                                        disabled={acknowledging}
                                        className="btn btn-primary"
                                    >
                                        {acknowledging ? 'Processing...' : 'I Acknowledge (Gain 50 Pts)'}
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Feedback Form */}
                        {isPublished && (
                            <div className="bg-surface-50 border border-surface-200 rounded-lg p-6 md:p-8 mt-6">
                                <h3 className="font-bold font-display text-navy-900 flex items-center gap-2 mb-2">
                                    <MessageSquarePlus size={18} className="text-orange-500" />
                                    Found an error or outdated procedure in this article?
                                </h3>
                                <p className="text-sm text-text-500 mb-4">
                                    Submit a revision suggestion. Your feedback will be reviewed by the division managers to keep our Knowledge Base up-to-date.
                                </p>

                                {suggestionMsg && (
                                    <div className="p-3 bg-success-bg text-green-700 text-sm font-medium rounded-md mb-4 border border-green-200">
                                        {suggestionMsg}
                                    </div>
                                )}

                                <form onSubmit={handleAddSuggestion}>
                                    <textarea
                                        value={suggestionText}
                                        onChange={(e) => setSuggestionText(e.target.value)}
                                        className="w-full border-surface-200 border rounded-md p-3 focus:ring-navy-600 focus:border-navy-600 min-h-[80px] text-sm"
                                        placeholder="Describe what needs to be changed and why..."
                                        required
                                    />
                                    <div className="flex justify-end mt-3">
                                        <button
                                            type="submit"
                                            disabled={isSuggesting || !suggestionText.trim()}
                                            className="px-5 py-2 bg-navy-900 text-white text-sm font-medium rounded hover:bg-navy-900 transition disabled:opacity-50"
                                        >
                                            {isSuggesting ? 'Submitting...' : 'Submit Suggestion'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT SIDEBAR - Review Comments Panel */}
                {showCommentPanel && !isPublished && (
                    <div className="w-[340px] min-w-[300px] bg-white rounded-xl shadow-sm border flex flex-col overflow-hidden shrink-0">
                        <div className="px-4 py-3 border-b border-surface-200 bg-amber-50 flex items-center justify-between shrink-0">
                            <h3 className="font-bold text-amber-900 text-sm flex items-center gap-2">
                                <MessageCircle size={15} className="text-amber-600" />
                                Review ({reviewComments.filter(c => !c.is_resolved).length})
                            </h3>
                            <button onClick={() => setShowCommentPanel(false)} className="p-1 text-amber-600 hover:text-amber-800 rounded">
                                <X size={14} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            {/* New Comment Form */}
                            {showCommentForm && selectedText && (
                                <div className="p-4 border-b border-amber-200 bg-amber-50/30">
                                    <div className="text-xs font-semibold text-amber-800 mb-2 flex items-center gap-1.5">
                                        <MessageCircle size={12} /> Komentar Baru
                                    </div>
                                    <div className="bg-amber-100/70 border border-amber-200 rounded-md p-2 mb-3 text-xs text-amber-900 italic line-clamp-3">
                                        &quot;{selectedText}&quot;
                                    </div>
                                    <textarea
                                        value={commentText}
                                        onChange={(e) => setCommentText(e.target.value)}
                                        placeholder="Tulis komentar atau saran revisi..."
                                        className="w-full border border-surface-200 rounded-md p-2.5 text-sm focus:ring-navy-600 focus:border-navy-600 min-h-[70px] resize-none"
                                        autoFocus
                                    />
                                    <div className="flex justify-end gap-2 mt-2">
                                        <button
                                            onClick={() => { setShowCommentForm(false); setSelectedText('') }}
                                            className="px-3 py-1.5 text-xs text-text-500 hover:bg-surface-100 rounded transition"
                                        >
                                            Batal
                                        </button>
                                        <button
                                            onClick={handleSubmitComment}
                                            disabled={isSubmittingComment || !commentText.trim()}
                                            className="px-3 py-1.5 text-xs bg-navy-600 text-white rounded hover:bg-navy-700 transition disabled:opacity-50 flex items-center gap-1.5"
                                        >
                                            {isSubmittingComment ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                                            Kirim
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Comment List */}
                            {reviewComments.length === 0 ? (
                                <div className="p-6 text-center text-text-400 text-sm">
                                    <MessageCircle size={28} className="mx-auto mb-2 text-text-300" />
                                    <p>Belum ada komentar.</p>
                                    <p className="text-xs mt-1">Highlight teks di artikel untuk menambah komentar.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-surface-100">
                                    {reviewComments.map(rc => (
                                        <div key={rc.id} className={`p-3 ${rc.is_resolved ? 'opacity-50 bg-surface-50' : 'hover:bg-surface-50'} transition`}>
                                            <div className="flex items-start gap-2.5">
                                                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${
                                                    rc.is_resolved ? 'bg-green-100 text-green-700' : 'bg-amber-200 text-amber-800'
                                                }`}>
                                                    {rc.author_name.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1.5 mb-1">
                                                        <span className="font-semibold text-navy-900 text-xs">{rc.author_name}</span>
                                                        <span className="text-[9px] text-text-400">
                                                            {new Date(rc.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                        {rc.is_resolved && (
                                                            <span className="text-[9px] bg-green-100 text-green-700 px-1 py-0.5 rounded font-medium">✓</span>
                                                        )}
                                                    </div>
                                                    <div className="bg-amber-50 border border-amber-200 rounded px-2 py-1 mb-1.5 text-[11px] text-amber-800 italic line-clamp-2">
                                                        &quot;{rc.highlighted_text.length > 80 ? rc.highlighted_text.slice(0, 80) + '...' : rc.highlighted_text}&quot;
                                                    </div>
                                                    <p className="text-xs text-text-700 leading-relaxed">{rc.comment}</p>
                                                    {!rc.is_resolved && ['SUPER_ADMIN', 'GROUP_ADMIN', 'MAINTAINER'].includes(role || '') && (
                                                        <div className="flex items-center gap-1.5 mt-1.5">
                                                            <button
                                                                onClick={() => handleResolveComment(rc.id)}
                                                                className="text-[10px] text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 px-2 py-0.5 rounded flex items-center gap-1 transition"
                                                            >
                                                                <Check size={10} /> Resolve
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteComment(rc.id)}
                                                                className="text-[10px] text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-2 py-0.5 rounded flex items-center gap-1 transition"
                                                            >
                                                                <Trash2 size={10} /> Hapus
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
