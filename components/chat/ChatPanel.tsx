'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
    MessageSquare, Send, X, FileText, Loader2, Bot, User,
    Sparkles, Plus, Trash2, ChevronLeft, FileBarChart, History,
    Settings, Database, Network, ArrowUpDown
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
    groupName: string
    chunkContent: string
}

interface ChatSessionItem {
    id: string
    title: string
    summary: string | null
    created_at: string
    updated_at: string
    _count: { messages: number }
}

export default function ChatPanel() {
    const [isOpen, setIsOpen] = useState(false)
    const [showSidebar, setShowSidebar] = useState(false)

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
    const [showSettings, setShowSettings] = useState(false)
    const [useVector, setUseVector] = useState(true)
    const [useGraph, setUseGraph] = useState(true)
    const [useRerank, setUseRerank] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [])

    useEffect(() => {
        scrollToBottom()
    }, [messages, streamingText, scrollToBottom])

    // Load sessions when panel opens
    useEffect(() => {
        if (isOpen) {
            loadSessions()
        }
    }, [isOpen])

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
                setShowSidebar(false)
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
                setShowSidebar(false)
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

        // Create session if none exists
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
                    useVector,
                    useGraph,
                    useRerank,
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
            // Buffer for handling partial SSE lines across chunks
            let sseBuffer = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                sseBuffer += decoder.decode(value, { stream: true })

                // Process complete SSE lines (terminated by \n)
                const lines = sseBuffer.split('\n')
                // Keep the last potentially incomplete line in the buffer
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
                            // Skip malformed/incomplete data lines
                            console.warn('[ChatPanel] Skipping malformed SSE data:', line)
                        }

                        // Throw OUTSIDE the parse try-catch so it reaches the outer handler
                        if (switchError) throw switchError
                        currentEvent = ''
                    }
                }
            }

            // The 'done' event already appended the message to state.
            // We no longer need the fallback check that caused duplicates.

            // Persist messages to DB
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
                    loadSessions() // Refresh sidebar
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

    // ── Closed State: Floating Button ─────────────────────────────
    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 z-50 bg-navy-600 text-white rounded-full p-4 shadow-lg hover:bg-navy-700 transition-all hover:scale-105 group"
            >
                <Sparkles size={24} />
                <span className="absolute -top-10 right-0 bg-navy-900 text-white text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
                    AI Knowledge Assistant
                </span>
            </button>
        )
    }

    // ── Open State: Chat Panel ────────────────────────────────────
    return (
        <div className="fixed bottom-6 right-6 z-50 w-[480px] h-[650px] bg-white rounded-2xl shadow-2xl border border-surface-200 flex overflow-hidden">
            {/* Sidebar */}
            {showSidebar && (
                <div className="w-[200px] bg-navy-900 flex flex-col border-r border-white/10 shrink-0">
                    <div className="p-3 border-b border-white/10 flex items-center justify-between">
                        <span className="text-white text-xs font-bold flex items-center gap-1.5">
                            <History size={13} /> Riwayat
                        </span>
                        <button
                            onClick={() => setShowSidebar(false)}
                            className="text-white/50 hover:text-white transition p-0.5"
                        >
                            <ChevronLeft size={14} />
                        </button>
                    </div>

                    <button
                        onClick={createNewSession}
                        className="mx-2 mt-2 py-2 px-3 bg-navy-600 hover:bg-navy-500 text-white text-xs rounded-lg flex items-center gap-1.5 transition font-medium"
                    >
                        <Plus size={13} /> Chat Baru
                    </button>

                    <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin mt-1">
                        {loadingSessions ? (
                            <div className="text-center py-4">
                                <Loader2 size={14} className="animate-spin text-navy-400 mx-auto" />
                            </div>
                        ) : sessions.length === 0 ? (
                            <div className="text-center py-4 text-navy-500 text-[10px]">
                                Belum ada riwayat
                            </div>
                        ) : (
                            sessions.map((s) => (
                                <div
                                    key={s.id}
                                    className={`group flex items-start gap-1.5 px-2.5 py-2 rounded-lg cursor-pointer transition text-[11px] ${activeSessionId === s.id
                                        ? 'bg-navy-600/40 text-white'
                                        : 'text-navy-300 hover:bg-white/5 hover:text-white'
                                        }`}
                                    onClick={() => loadSession(s.id)}
                                >
                                    <MessageSquare size={11} className="mt-0.5 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="truncate font-medium leading-tight">{s.title}</p>
                                        <p className="text-[9px] text-navy-500 mt-0.5">
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
                                        <Trash2 size={11} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <div className="bg-navy-600 text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                        <button
                            onClick={() => setShowSidebar(!showSidebar)}
                            className="text-white/70 hover:text-white transition p-1 rounded hover:bg-white/10"
                        >
                            <History size={16} />
                        </button>
                        <div className="min-w-0">
                            <h3 className="font-bold text-sm truncate">{sessionTitle}</h3>
                            <p className="text-[10px] text-white/60">Powered by AI & RAG</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            className={`transition p-1.5 rounded hover:bg-white/10 ${showSettings ? 'bg-white/20 text-white' : 'text-white/70 hover:text-white'}`}
                            title="Konfigurasi RAG"
                        >
                            <Settings size={16} />
                        </button>
                        {activeSessionId && messages.length >= 2 && (
                            <button
                                onClick={generateSummary}
                                disabled={summaryLoading}
                                className="text-white/70 hover:text-white transition p-1.5 rounded hover:bg-white/10"
                                title="Generate Summary"
                            >
                                {summaryLoading ? (
                                    <Loader2 size={14} className="animate-spin" />
                                ) : (
                                    <FileBarChart size={14} />
                                )}
                            </button>
                        )}
                        <button
                            onClick={() => setIsOpen(false)}
                            className="text-white/70 hover:text-white transition p-1.5 rounded hover:bg-white/10"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* Settings Overlay Menu */}
                {showSettings && (
                    <div className="absolute top-[52px] right-2 z-[60] w-64 bg-white rounded-xl shadow-xl border border-surface-200 p-3 animate-in fade-in slide-in-from-top-2 duration-200">
                        <h4 className="text-[11px] font-bold text-navy-900 uppercase tracking-wider mb-2 px-1">Konfigurasi Retrieval</h4>
                        <div className="space-y-1">
                            {/* Vector Toggle */}
                            <label className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition ${!useVector && !useRerank ? 'opacity-50' : 'hover:bg-surface-50'}`}>
                                <div className="flex items-center gap-2">
                                    <Database size={14} className="text-navy-500" />
                                    <span className="text-xs font-medium text-navy-900">Vector Search</span>
                                </div>
                                <input 
                                    type="checkbox" 
                                    checked={useVector} 
                                    disabled={useVector && !useRerank} // Prevent disabling both
                                    onChange={(e) => setUseVector(e.target.checked)}
                                    className="w-3.5 h-3.5 rounded border-surface-300 text-navy-600 focus:ring-navy-500"
                                />
                            </label>

                            {/* Graph Toggle */}
                            <label className="flex items-center justify-between p-2 rounded-lg cursor-pointer transition hover:bg-surface-50">
                                <div className="flex items-center gap-2">
                                    <Network size={14} className="text-navy-500" />
                                    <span className="text-xs font-medium text-navy-900">Graph Context</span>
                                </div>
                                <input 
                                    type="checkbox" 
                                    checked={useGraph} 
                                    onChange={(e) => setUseGraph(e.target.checked)}
                                    className="w-3.5 h-3.5 rounded border-surface-300 text-navy-600 focus:ring-navy-500"
                                />
                            </label>

                            {/* Rerank Toggle */}
                            <label className="flex items-center justify-between p-2 rounded-lg cursor-pointer transition hover:bg-surface-50">
                                <div className="flex items-center gap-2">
                                    <ArrowUpDown size={14} className="text-navy-500" />
                                    <span className="text-xs font-medium text-navy-900">Reranking</span>
                                </div>
                                <input 
                                    type="checkbox" 
                                    checked={useRerank} 
                                    disabled={useRerank && !useVector} // Prevent disabling both
                                    onChange={(e) => setUseRerank(e.target.checked)}
                                    className="w-3.5 h-3.5 rounded border-surface-300 text-navy-600 focus:ring-navy-500"
                                />
                            </label>
                        </div>
                        <div className="mt-2 pt-2 border-t border-surface-100 text-[9px] text-text-400 px-1 italic">
                            * Wajib aktif salah satu: Vector atau Reranking.
                        </div>
                    </div>
                )}

                {/* Summary Banner */}
                {sessionSummary && (
                    <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-800">
                        <span className="font-bold">📋 Ringkasan:</span> {sessionSummary}
                    </div>
                )}

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.length === 0 && !streamingText && !isThinking && (
                        <div className="text-center py-8 text-text-400">
                            <Bot size={40} className="mx-auto mb-3 text-navy-300" />
                            <p className="font-medium text-navy-900">Halo! 👋</p>
                            <p className="text-sm mt-1">
                                Tanyakan apapun tentang dokumen perusahaan Anda.
                            </p>
                        </div>
                    )}

                    {messages.map((msg, i) => (
                        <div
                            key={i}
                            className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            {msg.role === 'assistant' && (
                                <div className="w-7 h-7 bg-navy-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                                    <Bot size={14} className="text-navy-600" />
                                </div>
                            )}
                            <div
                                className={`rounded-xl px-4 py-2.5 max-w-[80%] text-sm leading-relaxed ${msg.role === 'user'
                                    ? 'bg-navy-600 text-white'
                                    : 'bg-surface-100 text-navy-900'
                                    }`}
                            >
                                <p className="whitespace-pre-wrap">{msg.content}</p>
                            </div>
                            {msg.role === 'user' && (
                                <div className="w-7 h-7 bg-navy-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                                    <User size={14} className="text-white" />
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Thinking Indicator */}
                    {isThinking && (
                        <div className="flex gap-2 justify-start">
                            <div className="w-7 h-7 bg-navy-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <Bot size={14} className="text-navy-600" />
                            </div>
                            <div className="bg-surface-100 rounded-xl px-4 py-3 flex items-center gap-3">
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
                        <div className="flex gap-2 justify-start">
                            <div className="w-7 h-7 bg-navy-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                                <Bot size={14} className="text-navy-600" />
                            </div>
                            <div className="bg-surface-100 text-navy-900 rounded-xl px-4 py-2.5 max-w-[80%] text-sm leading-relaxed">
                                <p className="whitespace-pre-wrap">{streamingText}</p>
                                <span className="animate-pulse text-navy-400">▊</span>
                            </div>
                        </div>
                    )}

                    {/* Citations */}
                    {citations.length > 0 && !isStreaming && (
                        <div className="space-y-2 ml-9">
                            <p className="text-xs font-semibold text-text-400 uppercase tracking-wider">
                                Sumber Referensi
                            </p>
                            {citations.slice(0, 4).map((c, i) => (
                                <a
                                    key={i}
                                    href={`/dashboard/documents/${c.documentId}`}
                                    className="block bg-surface-50 border border-surface-200 rounded-lg p-3 hover:border-navy-300 hover:bg-navy-50 transition text-xs"
                                >
                                    <div className="flex items-start gap-2">
                                        <FileText size={14} className="text-navy-500 mt-0.5 flex-shrink-0" />
                                        <div className="min-w-0">
                                            <p className="font-semibold text-navy-900 truncate">
                                                {c.documentTitle}
                                            </p>
                                            <p className="text-text-400 mt-0.5">
                                                Hal. {c.pageStart}
                                                {c.pageEnd !== c.pageStart ? `-${c.pageEnd}` : ''} •{' '}
                                                {c.groupName}
                                            </p>
                                        </div>
                                    </div>
                                </a>
                            ))}
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-3 border-t border-surface-200 flex-shrink-0">
                    <div className="flex items-center gap-2 bg-surface-50 rounded-xl px-4 py-2 border border-surface-200 focus-within:border-navy-400 transition">
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={isStreaming}
                            placeholder="Tanya tentang dokumen..."
                            className="flex-1 bg-transparent outline-none text-sm placeholder:text-text-300"
                        />
                        <button
                            onClick={sendMessage}
                            disabled={!input.trim() || isStreaming}
                            className="text-navy-600 hover:text-navy-700 disabled:text-text-200 transition p-1"
                        >
                            <Send size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
