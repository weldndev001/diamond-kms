'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getContentByIdAction, publishContentAction } from '@/lib/actions/content.actions'
import { submitForApprovalAction } from '@/lib/actions/approval.actions'
import { checkAcknowledgeStatusAction, acknowledgeReadAction } from '@/lib/actions/read-tracker.actions'
import { createSuggestionAction } from '@/lib/actions/suggestion.actions'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useTranslation } from '@/hooks/useTranslation'
import { 
    ArrowLeft, Edit, FileText, CheckCircle, Send, Loader2, Bot, 
    MessageSquare, Sparkles, Trash2, ClipboardList, BookOpen, 
    ShieldCheck, Clock, Globe, Maximize2, Minimize2, CheckCircle2,
    AlertCircle, ChevronRight
} from 'lucide-react'
import Link from 'next/link'
import { Role, ContentStatus } from '@prisma/client'

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
    const [articleFullscreen, setArticleFullscreen] = useState(false)

    // Chat state
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [input, setInput] = useState('')
    const [isStreaming, setIsStreaming] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)

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

    const sendMessage = async () => {
        const q = input.trim()
        if (!q || isStreaming || !content) return

        const userMsg: ChatMessage = { role: 'user', content: q }
        const newMessages = [...messages, userMsg]
        setMessages(newMessages)
        setInput('')
        setIsStreaming(true)

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

            if (!res.ok) throw new Error('API Error')

            const reader = res.body?.getReader()
            const decoder = new TextDecoder()
            let fullText = ''

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read()
                    if (done) break
                    const chunk = decoder.decode(value)
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
                            } catch {}
                        }
                    }
                }
            }
        } catch (err) {
            setMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: 'Maaf, terjadi kesalahan koneksi.' }])
        } finally {
            setIsStreaming(false)
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
        <div className="flex flex-col h-[calc(100vh-100px)] -m-6 md:-m-8">
            {/* Header / Toolbar */}
            <div className="bg-white border-b border-surface-200 px-6 py-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.back()} className="p-2 text-text-400 hover:text-navy-900 hover:bg-surface-100 rounded-full transition">
                        <ArrowLeft size={20} />
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
                    {canPublish && content.status === ContentStatus.DRAFT && (
                        <button onClick={handlePublish} disabled={publishing} className="btn bg-success text-white hover:bg-success-dark">
                            {publishing ? <Loader2 size={16} className="animate-spin" /> : <Globe size={16} className="mr-2" />}
                            {t('common.publish')}
                        </button>
                    )}
                    {canEdit && (
                        <Link href={`/dashboard/content/${content.id}/edit`} className="btn border border-navy-600 text-navy-600 hover:bg-navy-50">
                            <Edit size={16} className="mr-2" /> {t('common.edit')}
                        </Link>
                    )}
                </div>
            </div>

            {/* Main Layout: Split AI Chat & Content */}
            <div className="flex flex-1 overflow-hidden bg-surface-50">
                {/* AI Chat Panel (Left) */}
                {isPublished && !articleFullscreen && (
                    <div className="w-[380px] border-r border-surface-200 bg-white flex flex-col shrink-0">
                        <div className="p-4 border-b border-surface-100 bg-surface-50 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-navy-600 flex items-center justify-center shadow-lg shadow-navy-100">
                                    <Sparkles size={16} className="text-white" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-navy-900">AISA Assistant</h3>
                                    <p className="text-[10px] text-text-400">Diskusi seputar artikel ini</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {messages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center px-6 opacity-60">
                                    <Bot size={48} className="text-navy-200 mb-3" />
                                    <h4 className="text-sm font-bold text-navy-900 mb-1">Tanya AISA</h4>
                                    <p className="text-xs text-text-500">Ajukan pertanyaan tentang isi artikel ini, AISA akan menjawab berdasarkan konteks yang ada.</p>
                                </div>
                            ) : (
                                messages.map((msg, idx) => (
                                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                                            msg.role === 'user' ? 'bg-navy-600 text-white rounded-tr-none' : 'bg-surface-100 text-navy-900 rounded-tl-none'
                                        }`}>
                                            {msg.content || <Loader2 size={14} className="animate-spin opacity-50" />}
                                        </div>
                                    </div>
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        <div className="p-4 border-t border-surface-100">
                            <div className="flex items-center gap-2 bg-surface-100 rounded-xl px-3 py-1.5 border border-surface-200 focus-within:border-navy-400 transition">
                                <textarea 
                                    ref={inputRef}
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
                                    placeholder="Tanya sesuatu..."
                                    className="flex-1 bg-transparent border-none focus:ring-0 text-sm resize-none py-1.5 h-10"
                                />
                                <button onClick={sendMessage} disabled={!input.trim() || isStreaming} className="p-2 bg-navy-600 text-white rounded-lg hover:bg-navy-700 disabled:opacity-40 transition">
                                    {isStreaming ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                </button>
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
