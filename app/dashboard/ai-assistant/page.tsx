'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
    MessageSquare, Send, FileText, Loader2, Bot, User,
    Sparkles, Plus, Trash2, FileBarChart, History, PanelLeftOpen, PanelLeftClose, LayoutGrid, List
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
    const [selectedContext, setSelectedContext] = useState('Global')
    const [isHistoryOpen, setIsHistoryOpen] = useState(true)
    const contexts = ['Global', 'SOP Karyawan', 'Panduan Teknis', 'Kebijakan Keamanan']
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
                err instanceof Error ? err.message : 'Failed to get response'
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
        <div className="flex h-[calc(100vh-120px)] bg-surface-50 dark:bg-surface-50 overflow-hidden rounded-xl border border-surface-200 dark:border-surface-100 relative">
            {/* Collapsible Sidebar (Chat History) */}
            <div
                className={`flex-shrink-0 bg-surface-50 dark:bg-surface-0 border-r border-surface-200 dark:border-slate-800 transition-all duration-300 ease-in-out flex flex-col ${isHistoryOpen ? 'w-72 opacity-100' : 'w-0 opacity-0 pointer-events-none'
                    }`}
            >
                <div className="p-4 flex-shrink-0">
                    <button
                        onClick={createNewSession}
                        className="w-full flex items-center justify-center gap-2 bg-gradient-to-br from-navy-600 to-navy-800 dark:from-indigo-600 dark:to-indigo-700 hover:scale-[1.02] active:scale-95 text-white rounded-xl py-3 px-4 transition-all duration-300 shadow-lg shadow-navy-600/20 dark:shadow-indigo-900/20 font-bold text-sm mb-4 border border-white/10"
                    >
                        <Plus size={18} />
                        New Chat
                    </button>
                    <div className="h-px bg-surface-200 dark:bg-slate-800 mb-4" />
                </div>

                <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-1 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700 scrollbar-track-transparent">
                    <p className="px-3 text-[10px] font-black text-text-400 uppercase tracking-[0.2em] mb-2">Recent Chats</p>
                    {loadingSessions ? (
                        <div className="flex justify-center py-4">
                            <Loader2 size={24} className="animate-spin text-navy-400" />
                        </div>
                    ) : sessions.length === 0 ? (
                        <p className="px-3 text-xs text-text-400 italic py-2">No history found</p>
                    ) : (
                        sessions.map((s) => (
                            <div
                                key={s.id}
                                className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${activeSessionId === s.id
                                    ? 'bg-navy-50 dark:bg-navy-900/40 text-navy-700 dark:text-navy-400 ring-1 ring-navy-200 dark:ring-navy-700/50'
                                    : 'hover:bg-surface-100 dark:hover:bg-surface-100 text-text-600 hover:text-navy-600'
                                    }`}
                                onClick={() => loadSession(s.id)}
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <MessageSquare size={16} className={activeSessionId === s.id ? 'text-navy-600' : 'text-text-400'} />
                                    <span className="text-sm font-semibold truncate leading-none translate-y-[-1px]">{s.title || 'Untitled Chat'}</span>
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        deleteSession(s.id)
                                    }}
                                    className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-danger-bg hover:text-danger rounded-lg transition-all"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col min-w-0 bg-surface-0 relative">
                {/* Chat Header (Glassmorphism) - High Fidelity */}
                <div className="sticky top-0 z-30 bg-surface-0/90 dark:bg-surface-0/80 backdrop-blur-xl border-b border-surface-200 dark:border-surface-100 px-6 py-4 flex items-center justify-between flex-shrink-0 shadow-lg shadow-navy-900/5 dark:shadow-none">
                    <div className="flex items-center gap-4 min-w-0">
                        {/* Sidebar Toggle Button */}
                        <button
                            onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                            className="p-2.5 rounded-xl text-text-500 hover:text-navy-600 hover:bg-surface-100 transition-all active:scale-95 border border-transparent hover:border-surface-200"
                            title={isHistoryOpen ? "Hide History" : "Show History"}
                        >
                            {isHistoryOpen ? <PanelLeftClose size={22} /> : <PanelLeftOpen size={22} />}
                        </button>

                        <div className="h-8 w-[1.5px] bg-surface-200 dark:bg-surface-100 mx-1" />

                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <div className="w-10 h-10 bg-gradient-to-tr from-navy-600 via-navy-500 to-indigo-400 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-navy-600/10 active:scale-95 transition-transform">
                                    <Bot size={20} className="text-white drop-shadow-md" />
                                </div>
                                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-[3px] border-surface-0 shadow-sm animate-pulse" />
                            </div>
                            <div className="min-w-0">
                                <h3 className="font-extrabold text-navy-900 text-[14px] truncate uppercase tracking-[0.05em] leading-tight">{sessionTitle}</h3>
                                <p className="text-[9px] font-bold text-text-400 mt-0.5 tracking-wider hidden sm:block uppercase">AI Smart Assistant (AISA)</p>
                            </div>
                        </div>

                        {/* Scope Selector - Premium Styled */}
                        <div className="h-10 w-px bg-surface-200 hidden md:block mx-2" />
                        <div className="hidden md:flex items-center gap-3 group">
                            <span className="text-[9px] font-black text-text-300 uppercase tracking-[0.2em] group-hover:text-navy-400 transition ml-2">Context:</span>
                            <div className="relative">
                                <select
                                    value={selectedContext}
                                    onChange={(e) => setSelectedContext(e.target.value)}
                                    className="appearance-none bg-surface-50 dark:bg-surface-0 border border-surface-200 dark:border-surface-100 text-xs font-black rounded-xl pl-4 pr-10 py-2.5 focus:outline-none focus:ring-4 focus:ring-navy-600/10 text-navy-800 dark:text-navy-800 cursor-pointer hover:border-navy-400/50 hover:bg-white dark:hover:bg-navy-700 transition-all shadow-sm"
                                >
                                    {contexts.map(ctx => (
                                        <option key={ctx} value={ctx}>{ctx}</option>
                                    ))}
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-navy-400">
                                    <Sparkles size={14} className="animate-sparkle" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Summary Banner */}
                {sessionSummary && (
                    <div className="px-6 py-3 bg-amber-50 border-b border-amber-200 text-sm text-amber-800">
                        <span className="font-bold">📋 Summary:</span> {sessionSummary}
                    </div>
                )}

                {/* Context Indicator Badge - High Fidelity */}
                <div className="px-6 pt-6 flex justify-center animate-in fade-in zoom-in-95 duration-1000 slide-in-from-top-4">
                    <div className="inline-flex items-center gap-3 px-5 py-2 bg-slate-900 dark:bg-slate-800/80 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.25em] shadow-xl border border-white/5 dark:border-slate-700 backdrop-blur-sm">
                        <div className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]"></span>
                        </div>
                        <span className="opacity-70">Focusing on</span>
                        <span className="text-indigo-300 font-extrabold">{selectedContext}</span>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700 scrollbar-track-transparent">
                    {messages.length === 0 && !streamingText && !isThinking && (
                        <div className="text-center py-16 text-text-400">
                            <div className="w-20 h-20 bg-navy-light rounded-full flex items-center justify-center mx-auto mb-4">
                                <Bot size={40} className="text-navy-600" />
                            </div>
                            <h3 className="font-bold font-display text-navy-900 text-xl mb-2">Hello! 👋</h3>
                            <p className="text-sm max-w-md mx-auto">
                                Ask anything about your company documents. AI will search for answers from the entire available knowledge base.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-lg mx-auto mt-6">
                                {[
                                    'What is the main content of the latest document?',
                                    'Explain the procedures in the SOP',
                                    'Summarize company policies',
                                    'Compare the last two documents'
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
                            className={`flex gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            style={{ animationDelay: `${i * 50}ms` }}
                        >
                            {msg.role === 'assistant' && (
                                <div className="w-8 h-8 bg-navy-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                                    <Bot size={16} className="text-navy-600" />
                                </div>
                            )}
                            <div
                                className={`rounded-2xl px-6 py-4 max-w-[85%] md:max-w-[75%] text-[15px] leading-relaxed shadow-sm transition-all duration-300 hover:shadow-md ${msg.role === 'user'
                                    ? 'bg-gradient-to-br from-navy-600 to-navy-700 text-white font-medium corner-right'
                                    : 'bg-surface-0 text-text-900 border border-surface-200'
                                    }`}
                            >
                                <p className="whitespace-pre-wrap">{msg.content}</p>
                            </div>
                            {msg.role === 'user' && (
                                <div className="w-10 h-10 bg-surface-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1 border border-surface-200 shadow-sm transition-transform active:scale-90 overflow-hidden">
                                    <User size={20} className="text-navy-600" />
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
                                <span className="text-sm text-text-500">Thinking...</span>
                            </div>
                        </div>
                    )}

                    {/* Streaming text */}
                    {streamingText && (
                        <div className="flex gap-3 justify-start">
                            <div className="w-8 h-8 bg-navy-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                                <Bot size={16} className="text-navy-600" />
                            </div>
                            <div className="bg-surface-100 text-text-900 rounded-2xl px-5 py-3 max-w-[70%] text-sm leading-relaxed border border-surface-200">
                                <p className="whitespace-pre-wrap">{streamingText}</p>
                                <span className="animate-pulse text-navy-400">▊</span>
                            </div>
                        </div>
                    )}

                    {/* Citations */}
                    {citations.length > 0 && !isStreaming && (
                        <div className="space-y-2 ml-11">
                            <p className="text-xs font-semibold text-text-400 uppercase tracking-wider">
                                Reference Sources
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {citations.slice(0, 6).map((c, i) => {
                                    const isArticle = c.sourceType === 'ARTICLE'
                                    const href = isArticle
                                        ? `/dashboard/knowledge-base/${c.documentId}`
                                        : `/dashboard/documents/${c.documentId}`
                                    return (
                                        <a
                                            key={i}
                                            href={href}
                                            className="group block bg-surface-0 border border-surface-200 rounded-xl p-4 hover:border-navy-400 hover:bg-navy-50/30 transition-all duration-300 shadow-sm hover:shadow-md"
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isArticle ? 'bg-amber-100 text-amber-600' : 'bg-navy-100 text-navy-600'}`}>
                                                    <FileText size={16} />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-bold text-navy-900 text-[13px] truncate group-hover:text-navy-700">
                                                        {c.documentTitle}
                                                    </p>
                                                    <div className="flex items-center gap-1.5 mt-1">
                                                        <span className="text-[10px] font-bold text-text-400 truncate max-w-[80px]">
                                                            {c.divisionName}
                                                        </span>
                                                        <span className="text-text-300">&bull;</span>
                                                        <span className="text-[10px] font-black text-navy-500 uppercase tracking-tighter">
                                                            {isArticle ? `SEC ${c.pageStart}` : `PG ${c.pageStart}`}
                                                        </span>
                                                    </div>
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

                {/* Input Area - Premium Floating Design */}
                <div className="px-8 pb-8 pt-4 flex-shrink-0 bg-gradient-to-t from-surface-100 via-surface-50 to-transparent">
                    <div className="relative max-w-4xl mx-auto group">
                        <div className="flex items-center gap-3 bg-surface-0 rounded-[22px] px-6 py-4 border border-surface-200 focus-within:border-navy-500 focus-within:shadow-2xl focus-within:shadow-navy-600/10 transition-all duration-500 shadow-xl shadow-navy-900/5 ring-4 ring-transparent focus-within:ring-navy-600/5">
                            <input
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                disabled={isStreaming}
                                placeholder="Ask anything to AISA Intelligence..."
                                className="flex-1 bg-transparent translate-y-[1px] outline-none text-[15px] font-medium placeholder:text-text-300"
                            />
                            <button
                                onClick={sendMessage}
                                disabled={!input.trim() || isStreaming}
                                className="bg-gradient-to-br from-navy-600 to-navy-800 hover:scale-105 active:scale-95 disabled:grayscale disabled:opacity-50 disabled:scale-100 text-white rounded-xl p-3.5 transition-all duration-300 shadow-lg shadow-navy-600/30"
                            >
                                <Send size={20} className="translate-x-[1px] -translate-y-[1px]" />
                            </button>
                        </div>
                        <p className="text-center text-[9px] font-black text-text-300 mt-4 uppercase tracking-[0.2em] opacity-60">
                            AISA AI can make mistakes. Cross-check with official sources.
                        </p>
                    </div>
                </div>
            </div>
        </div >
    )
}
