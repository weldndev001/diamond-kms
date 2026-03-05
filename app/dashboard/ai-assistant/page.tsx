'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
    MessageSquare, Send, FileText, Loader2, Bot, User,
    Sparkles, Plus, Trash2, FileBarChart, History
} from 'lucide-react'

interface Message {
    role: 'user' | 'assistant'
    content: string
}

interface Citation {
    documentId: string
    documentTitle: string
    pageStart: number
    pageEnd: number
    divisionName: string
    chunkContent: string
    sourceType?: 'DOCUMENT' | 'ARTICLE'
}

interface ChatSessionItem {
    id: string
    title: string
    summary: string | null
    created_at: string
    updated_at: string
    _count: { messages: number }
}

export default function AIAssistantPage() {
    // Session state
    const [sessions, setSessions] = useState<ChatSessionItem[]>([])
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
    const [sessionTitle, setSessionTitle] = useState('New Chat')
    const [loadingSessions, setLoadingSessions] = useState(false)

    // Chat state
    const [messages, setMessages] = useState<Message[]>([])
    const [streamingText, setStreamingText] = useState('')
    const [citations, setCitations] = useState<Citation[]>([])
    const [isStreaming, setIsStreaming] = useState(false)
    const [isThinking, setIsThinking] = useState(false)
    const [input, setInput] = useState('')
    const [summaryLoading, setSummaryLoading] = useState(false)
    const [sessionSummary, setSessionSummary] = useState<string | null>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [])

    useEffect(() => {
        scrollToBottom()
    }, [messages, streamingText, scrollToBottom])

    // Load sessions on mount
    useEffect(() => {
        loadSessions()
    }, [])

    const loadSessions = async () => {
        setLoadingSessions(true)
        try {
            const res = await fetch('/api/chat/sessions')
            if (res.ok) {
                const data = await res.json()
                setSessions(data.sessions)
            }
        } catch { /* ignore */ }
        setLoadingSessions(false)
    }

    const createNewSession = async () => {
        try {
            const res = await fetch('/api/chat/sessions', { method: 'POST' })
            if (res.ok) {
                const data = await res.json()
                setActiveSessionId(data.session.id)
                setSessionTitle('New Chat')
                setMessages([])
                setCitations([])
                setStreamingText('')
                setSessionSummary(null)
                loadSessions()
            }
        } catch { /* ignore */ }
    }

    const loadSession = async (sessionId: string) => {
        try {
            const res = await fetch(`/api/chat/sessions/${sessionId}`)
            if (res.ok) {
                const data = await res.json()
                setActiveSessionId(sessionId)
                setSessionTitle(data.session.title)
                setSessionSummary(data.session.summary)
                setMessages(
                    data.session.messages.map((m: any) => ({
                        role: m.role as 'user' | 'assistant',
                        content: m.content,
                    }))
                )
                setCitations([])
            }
        } catch { /* ignore */ }
    }

    const deleteSession = async (sessionId: string) => {
        try {
            await fetch(`/api/chat/sessions/${sessionId}`, { method: 'DELETE' })
            setSessions(prev => prev.filter(s => s.id !== sessionId))
            if (activeSessionId === sessionId) {
                setActiveSessionId(null)
                setMessages([])
                setSessionTitle('New Chat')
                setSessionSummary(null)
            }
        } catch { /* ignore */ }
    }

    const generateSummary = async () => {
        if (!activeSessionId) return
        setSummaryLoading(true)
        try {
            const res = await fetch(`/api/chat/sessions/${activeSessionId}/summary`, {
                method: 'POST',
            })
            if (res.ok) {
                const data = await res.json()
                setSessionSummary(data.summary)
            }
        } catch { /* ignore */ }
        setSummaryLoading(false)
    }

    const sendMessage = async () => {
        const question = input.trim()
        if (!question || isStreaming) return

        let currentSessionId = activeSessionId
        if (!currentSessionId) {
            try {
                const res = await fetch('/api/chat/sessions', { method: 'POST' })
                if (res.ok) {
                    const data = await res.json()
                    currentSessionId = data.session.id
                    setActiveSessionId(data.session.id)
                }
            } catch {
                return
            }
        }

        const userMessage: Message = { role: 'user', content: question }
        setMessages((prev) => [...prev, userMessage])
        setInput('')
        setStreamingText('')
        setCitations([])
        setIsStreaming(true)
        setIsThinking(true)

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question,
                    history: messages.slice(-6),
                    sessionId: currentSessionId,
                }),
            })

            if (!response.ok) {
                let errMsg = 'Chat request failed'
                try {
                    const errData = await response.json()
                    errMsg = errData.error || errMsg
                } catch { /* response might not be JSON */ }
                throw new Error(errMsg)
            }

            const reader = response.body!.getReader()
            const decoder = new TextDecoder()
            let fullResponse = ''
            let receivedCitations: Citation[] = []
            let sseBuffer = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                sseBuffer += decoder.decode(value, { stream: true })
                const lines = sseBuffer.split('\n')
                sseBuffer = lines.pop() || ''

                let currentEvent = ''

                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        currentEvent = line.slice(7).trim()
                    } else if (line.startsWith('data: ') && currentEvent) {
                        let switchError: Error | null = null
                        try {
                            const json = JSON.parse(line.slice(6))
                            if (currentEvent === 'chunk' && json.text) {
                                setIsThinking(false)
                                fullResponse += json.text
                                setStreamingText(fullResponse)
                            } else if (currentEvent === 'citations' && json.citations) {
                                receivedCitations = json.citations
                                setCitations(json.citations)
                            } else if (currentEvent === 'done') {
                                setMessages((prev) => [
                                    ...prev,
                                    { role: 'assistant', content: fullResponse },
                                ])
                                setStreamingText('')
                            } else if (currentEvent === 'title_updated' && json.title) {
                                setSessionTitle(json.title)
                            } else if (currentEvent === 'error') {
                                switchError = new Error(json.message || 'AI error')
                            }
                        } catch {
                            console.warn('[AIAssistant] Skipping malformed SSE data:', line)
                        }
                        if (switchError) throw switchError
                        currentEvent = ''
                    }
                }
            }

            if (currentSessionId && fullResponse) {
                try {
                    await fetch(`/api/chat/sessions/${currentSessionId}/messages`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            userMessage: question,
                            assistantMessage: fullResponse,
                            citations: receivedCitations.length > 0 ? receivedCitations : null,
                        }),
                    })
                    loadSessions()
                } catch { /* ignore */ }
            }
        } catch (err) {
            const errorMessage =
                err instanceof Error ? err.message : 'Gagal mendapat respons'
            setMessages((prev) => [
                ...prev,
                {
                    role: 'assistant',
                    content: `⚠️ ${errorMessage}`,
                },
            ])
            setStreamingText('')
        } finally {
            setIsStreaming(false)
            setIsThinking(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            sendMessage()
        }
    }

    return (
        <div className="flex h-[calc(100vh-120px)] -m-6 md:-m-8 bg-surface-50 overflow-hidden rounded-xl border border-surface-200">
            {/* Sessions Sidebar */}
            <div className="w-[280px] bg-navy-900 flex flex-col shrink-0">
                <div className="p-4 border-b border-white/10">
                    <h2 className="text-white font-bold font-display text-sm flex items-center gap-2">
                        <Sparkles size={16} className="text-amber-400" />
                        AI Knowledge Assistant
                    </h2>
                    <p className="text-navy-400 text-[11px] mt-1">Tanya apapun tentang dokumen perusahaan</p>
                </div>

                <button
                    onClick={createNewSession}
                    className="mx-3 mt-3 py-2.5 px-4 bg-navy-600 hover:bg-navy-500 text-white text-sm rounded-lg flex items-center gap-2 transition font-medium"
                >
                    <Plus size={16} /> Chat Baru
                </button>

                <div className="flex-1 overflow-y-auto p-3 space-y-1 mt-2 scrollbar-thin">
                    <p className="text-[10px] text-navy-500 font-semibold uppercase tracking-wider px-2 mb-2 flex items-center gap-1.5">
                        <History size={10} /> Riwayat Chat
                    </p>
                    {loadingSessions ? (
                        <div className="text-center py-6">
                            <Loader2 size={18} className="animate-spin text-navy-400 mx-auto" />
                        </div>
                    ) : sessions.length === 0 ? (
                        <div className="text-center py-6 text-navy-500 text-xs">
                            Belum ada riwayat chat
                        </div>
                    ) : (
                        sessions.map((s) => (
                            <div
                                key={s.id}
                                className={`group flex items-start gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition text-[12px] ${activeSessionId === s.id
                                    ? 'bg-navy-600/40 text-white'
                                    : 'text-navy-300 hover:bg-white/5 hover:text-white'
                                    }`}
                                onClick={() => loadSession(s.id)}
                            >
                                <MessageSquare size={13} className="mt-0.5 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="truncate font-medium leading-tight text-white">{s.title}</p>
                                    <p className="text-[10px] text-navy-300 mt-0.5">
                                        {s._count.messages} pesan
                                    </p>
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        deleteSession(s.id)
                                    }}
                                    className="opacity-0 group-hover:opacity-100 text-navy-500 hover:text-red-400 transition p-0.5"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col min-w-0 bg-white">
                {/* Chat Header */}
                <div className="bg-surface-0 border-b border-surface-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 bg-navy-100 rounded-full flex items-center justify-center shrink-0">
                            <Bot size={18} className="text-navy-600" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-bold text-navy-900 text-sm truncate">{sessionTitle}</h3>
                            <p className="text-[11px] text-text-400">Powered by AI & RAG</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {activeSessionId && messages.length >= 2 && (
                            <button
                                onClick={generateSummary}
                                disabled={summaryLoading}
                                className="text-text-500 hover:text-navy-600 transition p-2 rounded-lg hover:bg-surface-100 flex items-center gap-1.5 text-xs font-medium"
                                title="Generate Summary"
                            >
                                {summaryLoading ? (
                                    <Loader2 size={14} className="animate-spin" />
                                ) : (
                                    <FileBarChart size={14} />
                                )}
                                Ringkasan
                            </button>
                        )}
                    </div>
                </div>

                {/* Summary Banner */}
                {sessionSummary && (
                    <div className="px-6 py-3 bg-amber-50 border-b border-amber-200 text-sm text-amber-800">
                        <span className="font-bold">📋 Ringkasan:</span> {sessionSummary}
                    </div>
                )}

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
                    {messages.length === 0 && !streamingText && !isThinking && (
                        <div className="text-center py-16 text-text-400">
                            <div className="w-20 h-20 bg-navy-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Bot size={40} className="text-navy-400" />
                            </div>
                            <h3 className="font-bold font-display text-navy-900 text-xl mb-2">Halo! 👋</h3>
                            <p className="text-sm max-w-md mx-auto">
                                Tanyakan apapun tentang dokumen perusahaan Anda. AI akan mencari jawaban dari seluruh knowledge base yang tersedia.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-lg mx-auto mt-6">
                                {[
                                    'Apa isi utama dokumen terbaru?',
                                    'Jelaskan prosedur yang ada di SOP',
                                    'Rangkum kebijakan perusahaan',
                                    'Bandingkan dua dokumen terakhir'
                                ].map((suggestion, i) => (
                                    <button
                                        key={i}
                                        onClick={() => { setInput(suggestion); }}
                                        className="text-left text-xs bg-surface-50 border border-surface-200 hover:border-navy-300 hover:bg-navy-50 p-3 rounded-lg transition text-text-600"
                                    >
                                        {suggestion}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {messages.map((msg, i) => (
                        <div
                            key={i}
                            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            {msg.role === 'assistant' && (
                                <div className="w-8 h-8 bg-navy-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                                    <Bot size={16} className="text-navy-600" />
                                </div>
                            )}
                            <div
                                className={`rounded-2xl px-5 py-3 max-w-[70%] text-sm leading-relaxed ${msg.role === 'user'
                                    ? 'bg-navy-600 text-white'
                                    : 'bg-surface-100 text-navy-900'
                                    }`}
                            >
                                <p className="whitespace-pre-wrap">{msg.content}</p>
                            </div>
                            {msg.role === 'user' && (
                                <div className="w-8 h-8 bg-navy-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                                    <User size={16} className="text-white" />
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Thinking Indicator */}
                    {isThinking && (
                        <div className="flex gap-3 justify-start">
                            <div className="w-8 h-8 bg-navy-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <Bot size={16} className="text-navy-600" />
                            </div>
                            <div className="bg-surface-100 rounded-2xl px-5 py-3 flex items-center gap-3">
                                <div className="flex gap-1">
                                    <span className="w-2 h-2 bg-navy-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <span className="w-2 h-2 bg-navy-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <span className="w-2 h-2 bg-navy-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                                <span className="text-sm text-text-500">Sedang berpikir...</span>
                            </div>
                        </div>
                    )}

                    {/* Streaming text */}
                    {streamingText && (
                        <div className="flex gap-3 justify-start">
                            <div className="w-8 h-8 bg-navy-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                                <Bot size={16} className="text-navy-600" />
                            </div>
                            <div className="bg-surface-100 text-navy-900 rounded-2xl px-5 py-3 max-w-[70%] text-sm leading-relaxed">
                                <p className="whitespace-pre-wrap">{streamingText}</p>
                                <span className="animate-pulse text-navy-400">▊</span>
                            </div>
                        </div>
                    )}

                    {/* Citations */}
                    {citations.length > 0 && !isStreaming && (
                        <div className="space-y-2 ml-11">
                            <p className="text-xs font-semibold text-text-400 uppercase tracking-wider">
                                Sumber Referensi
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {citations.slice(0, 6).map((c, i) => {
                                    const isArticle = c.sourceType === 'ARTICLE'
                                    const href = isArticle
                                        ? `/dashboard/contents/${c.documentId}`
                                        : `/dashboard/documents/${c.documentId}`
                                    return (
                                        <a
                                            key={i}
                                            href={href}
                                            className="block bg-surface-50 border border-surface-200 rounded-lg p-3 hover:border-navy-300 hover:bg-navy-50 transition text-xs"
                                        >
                                            <div className="flex items-start gap-2">
                                                <FileText size={14} className="text-navy-500 mt-0.5 flex-shrink-0" />
                                                <div className="min-w-0">
                                                    <p className="font-semibold text-navy-900 truncate">
                                                        {c.documentTitle}
                                                    </p>
                                                    <p className="text-text-400 mt-0.5">
                                                        {isArticle ? `Bagian ${c.pageStart}` : `Hal. ${c.pageStart}${c.pageEnd !== c.pageStart ? `-${c.pageEnd}` : ''}`}
                                                        {' '}&bull;{' '}{c.divisionName}
                                                    </p>
                                                    <span className={`inline-block mt-1 px-1.5 py-0.5 text-[10px] font-semibold rounded ${isArticle ? 'bg-amber-100 text-amber-700' : 'bg-navy-100 text-navy-700'}`}>
                                                        {isArticle ? 'Konten' : 'Dokumen'}
                                                    </span>
                                                </div>
                                            </div>
                                        </a>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-4 border-t border-surface-200 flex-shrink-0 bg-surface-0">
                    <div className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-surface-200 focus-within:border-navy-400 focus-within:ring-2 focus-within:ring-navy-100 transition shadow-sm">
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={isStreaming}
                            placeholder="Tanya tentang dokumen perusahaan..."
                            className="flex-1 bg-transparent outline-none text-sm placeholder:text-text-300"
                        />
                        <button
                            onClick={sendMessage}
                            disabled={!input.trim() || isStreaming}
                            className="bg-navy-600 hover:bg-navy-700 disabled:bg-surface-200 disabled:text-text-300 text-white rounded-lg p-2.5 transition"
                        >
                            <Send size={16} />
                        </button>
                    </div>
                    <p className="text-center text-[10px] text-text-300 mt-2">
                        AI dapat membuat kesalahan. Verifikasi informasi penting dari sumber dokumen.
                    </p>
                </div>
            </div>
        </div>
    )
}
