'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useTranslation } from '@/hooks/useTranslation'
import {
    MessageSquare, Send, FileText, Loader2, Bot, User,
    Sparkles, Plus, Trash2, FileBarChart, History, PanelLeftOpen, PanelLeftClose, LayoutGrid, List,
    Settings, Database, Network, ArrowUpDown
} from 'lucide-react'
import { getKnowledgeBasesAction } from '@/lib/actions/knowledge-base.actions'

interface Message {
    role: 'user' | 'assistant'
    content: string
    citations?: Citation[]
}

interface Citation {
    documentId: string
    documentTitle: string
    pageStart: number
    pageEnd: number
    groupName: string
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

import { Skeleton } from '@/components/ui/skeleton'

function SidebarSkeleton() {
    return (
        <div className="space-y-2 px-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                    <Skeleton className="h-4 w-4 rounded-md" />
                    <Skeleton className="h-4 flex-1 rounded-md" />
                </div>
            ))}
        </div>
    )
}

export default function AIAssistantPage() {
    const { t } = useTranslation()
    // Session state
    const [sessions, setSessions] = useState<ChatSessionItem[]>([])
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
    const [sessionTitle, setSessionTitle] = useState(t('ai_assistant.new_chat'))
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
    const [knowledgeBases, setKnowledgeBases] = useState<any[]>([])
    const [isHistoryOpen, setIsHistoryOpen] = useState(true)
    const [showSettings, setShowSettings] = useState(false)
    const [useVector, setUseVector] = useState(true)
    const [useGraph, setUseGraph] = useState(true)
    const [useRerank, setUseRerank] = useState(false)
    const { organization } = useCurrentUser()
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)


    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [])

    useEffect(() => {
        scrollToBottom()
    }, [messages, streamingText, scrollToBottom])

    const renderCitations = (citationList: Citation[]) => {
        if (!citationList || citationList.length === 0) return null
        return (
            <div className="mt-4 pt-3 border-t border-surface-200 dark:border-slate-700/50">
                <p className="text-[10px] font-bold text-text-400 uppercase tracking-wider mb-2">
                    {t('ai_assistant.reference_sources')}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {citationList.slice(0, 4).map((c, i) => {
                        const isArticle = c.sourceType === 'ARTICLE'
                        const cleanText = c.chunkContent.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim()
                        const searchSnippet = cleanText.substring(0, 35)
                        const encodedKeyword = encodeURIComponent(searchSnippet)

                        const href = isArticle
                            ? `/dashboard/knowledge-base/${c.documentId}#:~:text=${encodedKeyword}`
                            : `/dashboard/documents/${c.documentId}?page=${c.pageStart}&search=${encodedKeyword}`

                        // Build breadcrumb path for user navigation
                        const pathSegments = isArticle
                            ? ['Basis Pengetahuan', c.documentTitle]
                            : ['Dokumen', c.documentTitle]
                        const locationLabel = isArticle
                            ? `Bagian ${c.pageStart}`
                            : `Hal. ${c.pageStart}${c.pageEnd > c.pageStart ? `–${c.pageEnd}` : ''}`
                        
                        return (
                            <a
                                key={i}
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group flex flex-col bg-white dark:bg-slate-800 border border-surface-200 dark:border-slate-700 rounded-lg p-3 hover:border-navy-400 dark:hover:border-navy-400 shadow-sm hover:shadow-md transition-all"
                            >
                                <div className="flex items-start gap-2.5">
                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isArticle ? 'bg-amber-100 text-amber-600' : 'bg-navy-100 dark:bg-navy-900 text-navy-600 dark:text-navy-400'}`}>
                                        <FileText size={13} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-bold text-navy-900 dark:text-white text-[11px] truncate group-hover:text-navy-700 dark:group-hover:text-navy-300 leading-tight">
                                            {c.documentTitle}
                                        </p>
                                        {/* Location badge */}
                                        <div className="flex items-center gap-1 mt-1">
                                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-tight ${isArticle ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-navy-50 text-navy-600 border border-navy-200'}`}>
                                                {locationLabel}
                                            </span>
                                            {c.groupName && (
                                                <span className="text-[9px] text-text-400 font-medium truncate">
                                                    · {c.groupName}
                                                </span>
                                            )}
                                        </div>
                                        {/* Navigation path breadcrumb */}
                                        <div className="flex items-center gap-1 mt-1.5 text-[9px] text-text-400 group-hover:text-navy-500 transition-colors">
                                            <span className="opacity-70">📂</span>
                                            <span className="font-medium truncate">
                                                {pathSegments[0]} › {pathSegments[1]?.substring(0, 30)}{(pathSegments[1]?.length || 0) > 30 ? '...' : ''} › {locationLabel}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </a>
                        )
                    })}
                </div>
            </div>
        )
    }

    // Load sessions and KBs on mount
    useEffect(() => {
        loadSessions()
    }, [])

    useEffect(() => {
        if (organization?.id) {
            loadKBs(organization.id)
        }
    }, [organization?.id])

    useEffect(() => {
        if (selectedContext === 'Global' && knowledgeBases.length === 1) {
            setSelectedContext(knowledgeBases[0].id)
        }
    }, [knowledgeBases, selectedContext])

    const loadKBs = async (orgId: string) => {
        const kbs = await getKnowledgeBasesAction(orgId)
        setKnowledgeBases(kbs)
    }

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
            const res = await fetch('/api/chat/sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    knowledgeBaseId: selectedContext !== 'Global' ? selectedContext : undefined,
                }),
            })
            if (res.ok) {
                const data = await res.json()
                setActiveSessionId(data.session.id)
                setSessionTitle(t('ai_assistant.new_chat'))
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
                setSelectedContext(data.session.knowledge_base_id || 'Global')
                setMessages(
                    data.session.messages.map((m: any) => ({
                        role: m.role as 'user' | 'assistant',
                        content: m.content,
                        citations: m.citations ? (typeof m.citations === 'string' ? JSON.parse(m.citations) : m.citations) : undefined
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
                setSessionTitle(t('ai_assistant.new_chat'))
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
                const res = await fetch('/api/chat/sessions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        knowledgeBaseId: selectedContext !== 'Global' ? selectedContext : undefined,
                    }),
                })
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
        if (textareaRef.current) textareaRef.current.style.height = 'auto'

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
                    knowledgeBaseId: selectedContext !== 'Global' ? selectedContext : undefined,
                    useVector,
                    useGraph,
                    useRerank,
                }),
            })

            if (!response.ok) {
                let errMsg = t('ai_assistant.request_failed')
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
                                    { role: 'assistant', content: fullResponse, citations: receivedCitations.length > 0 ? receivedCitations : undefined },
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
        <div className="flex h-[calc(100vh-60px)] bg-white dark:bg-surface-0 overflow-hidden relative">
            {/* Collapsible Sidebar (Chat History) */}
            <div
                className={`flex-shrink-0 bg-slate-950 dark:bg-slate-950 border-r border-white/5 transition-all duration-300 ease-in-out flex flex-col ${isHistoryOpen ? 'w-80 opacity-100' : 'w-0 opacity-0 pointer-events-none'
                    }`}
            >
                <div className="p-4 flex-shrink-0">
                    <button
                        onClick={createNewSession}
                        className="w-full flex items-center justify-center gap-2 bg-gradient-to-br from-navy-600 to-navy-800 dark:from-indigo-600 dark:to-indigo-700 hover:scale-[1.02] active:scale-95 text-white rounded-xl py-3 px-4 transition-all duration-300 shadow-lg shadow-navy-600/20 dark:shadow-indigo-900/20 font-bold text-sm mb-4 border border-white/10"
                    >
                        <Plus size={18} />
                        {t('ai_assistant.new_chat')}
                    </button>
                    <div className="h-px bg-surface-200 dark:bg-slate-800 mb-4" />
                </div>

                <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-1 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700 scrollbar-track-transparent">
                    <p className="px-3 text-[10px] font-black text-text-400 uppercase tracking-[0.2em] mb-2">{t('ai_assistant.recent_chats')}</p>
                    {loadingSessions ? (
                        <SidebarSkeleton />
                    ) : sessions.length === 0 ? (
                        <p className="px-3 text-xs text-text-400 italic py-2">{t('ai_assistant.no_history')}</p>
                    ) : (
                        sessions.map((s) => (
                            <div
                                key={s.id}
                                className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${activeSessionId === s.id
                                    ? 'bg-white/10 text-white ring-1 ring-white/20'
                                    : 'hover:bg-white/5 text-slate-400 hover:text-white'
                                    }`}
                                onClick={() => loadSession(s.id)}
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <MessageSquare size={16} className={activeSessionId === s.id ? 'text-navy-600' : 'text-text-400'} />
                                    <span className="text-sm font-semibold truncate leading-none translate-y-[-1px]">{s.title || t('ai_assistant.untitled_chat')}</span>
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
                {/* Chat Header - Clean & Minimal */}
                <div className="sticky top-0 z-30 bg-white dark:bg-surface-0 border-b border-surface-200/60 dark:border-surface-100 px-6 py-4 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-4 min-w-0">
                        {/* Sidebar Toggle Button */}
                        <button
                            onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                            className="p-2.5 rounded-xl text-text-500 hover:text-navy-600 hover:bg-surface-100 transition-all active:scale-95 border border-transparent hover:border-surface-200"
                            title={isHistoryOpen ? t('ai_assistant.hide_history') : t('ai_assistant.show_history')}
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
                                <p className="text-[9px] font-bold text-text-400 mt-0.5 tracking-wider hidden sm:block uppercase">{t('ai_assistant.aisa_full')}</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Scope Selector - Premium Styled */}
                        <div className="hidden md:flex items-center gap-3 group">
                            <span className="text-[9px] font-black text-text-300 uppercase tracking-[0.2em] group-hover:text-navy-400 transition ml-2">{t('ai_assistant.context_label')}</span>
                            <div className="relative">
                                <select
                                    value={selectedContext}
                                    onChange={(e) => setSelectedContext(e.target.value)}
                                    className="appearance-none bg-surface-50 dark:bg-surface-0 border border-surface-200 dark:border-surface-100 text-xs font-black rounded-xl pl-4 pr-10 py-2.5 focus:outline-none focus:ring-4 focus:ring-navy-600/10 text-navy-800 dark:text-navy-800 cursor-pointer hover:border-navy-400/50 hover:bg-white dark:hover:bg-navy-700 transition-all shadow-sm"
                                >
                                    <option value="Global">Global Context</option>
                                    {knowledgeBases.map(kb => (
                                        <option key={kb.id} value={kb.id}>{kb.name}</option>
                                    ))}
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-navy-400">
                                    <Sparkles size={14} className="animate-sparkle" />
                                </div>
                            </div>
                        </div>

                        <div className="h-10 w-px bg-surface-200 hidden md:block mx-2" />

                        {/* RAG Settings Toggle */}
                        <div className="relative">
                            <button
                                onClick={() => setShowSettings(!showSettings)}
                                className={`p-2.5 rounded-xl transition-all active:scale-95 border ${showSettings ? 'bg-navy-600 text-white border-navy-600 shadow-lg shadow-navy-600/20' : 'text-text-500 hover:text-navy-600 hover:bg-surface-100 border-transparent hover:border-surface-200'}`}
                                title="Konfigurasi Retrieval"
                            >
                                <Settings size={20} />
                            </button>

                            {showSettings && (
                                <div className="absolute top-12 right-0 z-[100] w-64 bg-white rounded-2xl shadow-2xl border border-surface-200 p-4 animate-in fade-in slide-in-from-top-2 duration-200">
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
                        <span className="opacity-70">{t('ai_assistant.focusing_on')}</span>
                        <span className="text-indigo-300 font-extrabold">
                            {selectedContext === 'Global' ? 'Global' : (knowledgeBases.find(k => k.id === selectedContext)?.name || 'Knowledge Base')}
                        </span>
                    </div>
                </div>

                {/* Messages Container - Wider Layout */}
                <div className="flex-1 overflow-y-auto px-6 py-8 space-y-6 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700 scrollbar-track-transparent">
                    <div className="max-w-5xl mx-auto w-full space-y-6">
                    {messages.length === 0 && !streamingText && !isThinking && (
                        <div className="text-center py-16 text-text-400">
                            <div className="w-20 h-20 bg-navy-light rounded-full flex items-center justify-center mx-auto mb-4">
                                <Bot size={40} className="text-navy-600" />
                            </div>
                            <h3 className="font-bold font-display text-navy-900 text-xl mb-2">{t('ai_assistant.welcome_title')}</h3>
                            <p className="text-sm max-w-md mx-auto">
                                {t('ai_assistant.welcome_desc')}
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-lg mx-auto mt-6">
                                {[
                                    t('ai_assistant.suggestion_1'),
                                    t('ai_assistant.suggestion_2'),
                                    t('ai_assistant.suggestion_3'),
                                    t('ai_assistant.suggestion_4')
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
                                className={`rounded-2xl px-6 py-4 max-w-[85%] md:max-w-[80%] text-[15px] leading-relaxed transition-all duration-300 ${msg.role === 'user'
                                    ? 'bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white font-medium corner-right shadow-sm'
                                    : 'bg-surface-50 dark:bg-surface-50 text-text-900 border border-surface-200/50'
                                    }`}
                            >
                                <p className="whitespace-pre-wrap">{msg.content}</p>
                                {msg.role === 'assistant' && renderCitations(msg.citations || [])}
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
                                <span className="text-sm text-text-500">{t('ai_assistant.thinking')}</span>
                            </div>
                        </div>
                    )}

                    {/* Streaming text */}
                    {streamingText && (
                        <div className="flex gap-3 justify-start">
                            <div className="w-8 h-8 bg-navy-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                                <Bot size={16} className="text-navy-600" />
                            </div>
                            <div className="bg-surface-100 text-text-900 rounded-2xl px-5 py-4 max-w-[70%] text-[15px] leading-relaxed border border-surface-200 shadow-sm">
                                <p className="whitespace-pre-wrap inline">{streamingText}</p>
                                <span className="animate-pulse text-navy-400 ml-1">▊</span>
                                
                                {renderCitations(citations)}
                            </div>
                        </div>
                    )}

                    {/* Note: Citations are now rendered directly inside assistant message bubbles using renderCitations helper. */}

                    <div ref={messagesEndRef} />
                    </div>
                </div>

                {/* Input Area - Integrated & Minimal */}
                <div className="px-6 pb-8 pt-4 flex-shrink-0 bg-white dark:bg-surface-0">
                    <div className="max-w-5xl mx-auto w-full group">
                        <div className="flex items-center gap-4 bg-surface-50 dark:bg-surface-50 rounded-2xl px-5 py-4 border border-surface-200 focus-within:border-navy-500 focus-within:bg-white transition-all duration-300 shadow-sm focus-within:shadow-md">
                            <textarea
                                ref={textareaRef}
                                value={input}
                                onChange={(e) => {
                                    setInput(e.target.value)
                                    e.target.style.height = 'auto'
                                    e.target.style.height = `${e.target.scrollHeight}px`
                                }}
                                onKeyDown={handleKeyDown}
                                disabled={isStreaming}
                                placeholder={t('ai_assistant.input_placeholder')}
                                rows={1}
                                className="flex-1 bg-transparent translate-y-[1px] outline-none text-[15px] font-medium placeholder:text-text-400 resize-none max-h-32 py-1 scrollbar-thin"
                            />
                            <button
                                onClick={sendMessage}
                                disabled={!input.trim() || isStreaming}
                                className="bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white hover:opacity-90 active:scale-95 disabled:grayscale disabled:opacity-50 disabled:scale-100 rounded-xl p-3 transition-all duration-300"
                            >
                                <Send size={18} />
                            </button>
                        </div>
                        <p className="text-center text-[9px] font-black text-text-300 mt-4 uppercase tracking-[0.2em] opacity-60">
                            {t('ai_assistant.disclaimer')}
                        </p>
                    </div>
                </div>
            </div>
        </div >
    )
}
