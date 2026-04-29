'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { getContentsAction } from '@/lib/actions/content.actions'
import {
    getKnowledgeBasesAction,
    createKnowledgeBaseAction,
    addSourcesToKBAction,
    removeSourceFromKBAction,
    getKBChatSessionsAction,
    deleteKnowledgeBaseAction,
    publishKnowledgeBaseAction
} from '@/lib/actions/knowledge-base.actions'
import {
    Plus, Search, MessageSquare, FileText, Bot, User, Send, Loader2,
    ArrowLeft, X, Check, BookOpen, File, ChevronRight, Sparkles,
    Trash2, ClipboardList, RefreshCcw, Settings, Database, Network, ArrowUpDown,
    LayoutGrid, List, Globe, Lock, ShieldCheck, ExternalLink, Square, Tags,
    FolderOpen, Clock, Users
} from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'
import { ContentStatus, Role } from '@prisma/client'
import { Skeleton } from '@/components/ui/skeleton'

function KBSkeleton() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-48 rounded-md" />
                    <Skeleton className="h-4 w-64 rounded-md" />
                </div>
                <Skeleton className="h-10 w-40 rounded-lg" />
            </div>
            <div className="flex items-center justify-between gap-4">
                <Skeleton className="h-10 w-full max-w-md rounded-xl" />
                <Skeleton className="h-10 w-24 rounded-lg" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="card p-5 space-y-4">
                        <div className="flex items-start justify-between">
                            <Skeleton className="w-10 h-10 rounded-xl" />
                            <Skeleton className="h-5 w-5 rounded-md" />
                        </div>
                        <div className="space-y-2">
                            <Skeleton className="h-5 w-full rounded-md" />
                            <Skeleton className="h-4 w-2/3 rounded-md" />
                        </div>
                        <Skeleton className="h-6 w-24 rounded-md" />
                        <div className="flex gap-4">
                            <Skeleton className="h-3 w-16 rounded-md" />
                            <Skeleton className="h-3 w-16 rounded-md" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

/* ═══════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════ */
interface DocItem {
    id: string
    title: string
    type: 'document' | 'content'
    group?: string
    author?: string
    status?: string
    created_at?: string
}

interface KnowledgeBase {
    id: string
    name: string
    description: string
    status: string
    groupName: string
    documents: DocItem[]
    created_at: string
    messageCount: number
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

interface ChatMessage {
    role: 'user' | 'assistant'
    content: string
    citations?: Citation[]
}

interface ChatSession {
    id: string
    title: string
    messages: ChatMessage[]
    updatedAt: string
}

/* ═══════════════════════════════════════════
   VIEW: KB LIST
   ═══════════════════════════════════════════ */
function KBListView({ knowledgeBases, onSelect, onCreate, onDelete, canCreate }: {
    knowledgeBases: KnowledgeBase[]
    onSelect: (kb: KnowledgeBase) => void
    onCreate: () => void
    onDelete: (kb: KnowledgeBase) => void
    canCreate: boolean
}) {
    const { t } = useTranslation()
    const [search, setSearch] = useState('')
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
    const filtered = knowledgeBases.filter(kb =>
        kb.name.toLowerCase().includes(search.toLowerCase()) ||
        kb.description.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold font-display text-navy-900 flex items-center gap-2">
                        <Tags size={22} className="text-navy-600" />
                        {t('knowledge_base.title')}
                    </h1>
                    <p className="text-text-400 text-sm mt-1">{t('knowledge_base.subtitle')}</p>
                </div>
                {canCreate && (
                    <button onClick={onCreate}
                        className="btn btn-primary flex items-center gap-2">
                        <Plus size={16} /> {t('knowledge_base.create_kb')}
                    </button>
                )}
            </div>

            <div className="flex items-center justify-between gap-4">
                <div className="relative w-full max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-300" size={16} />
                    <input type="text" placeholder={t('knowledge_base.search_placeholder')}
                        value={search} onChange={e => setSearch(e.target.value)}
                        className="pl-10 pr-4 py-2.5 border rounded-xl w-full focus:ring-navy-600 focus:border-navy-600 text-sm" />
                </div>
                <div className="flex items-center bg-surface-100 rounded-lg p-0.5 border border-surface-200 shrink-0">
                    <button onClick={() => setViewMode('grid')}
                        className={`p-2 rounded-md transition ${viewMode === 'grid' ? 'bg-white shadow-sm text-navy-600' : 'text-text-400 hover:text-text-600'}`}
                        title={t('knowledge_base.grid_view')}>
                        <LayoutGrid size={16} />
                    </button>
                    <button onClick={() => setViewMode('list')}
                        className={`p-2 rounded-md transition ${viewMode === 'list' ? 'bg-white shadow-sm text-navy-600' : 'text-text-400 hover:text-text-600'}`}
                        title={t('knowledge_base.list_view')}>
                        <List size={16} />
                    </button>
                </div>
            </div>

            {filtered.length === 0 ? (
                <div className="text-center py-16">
                    <div className="w-20 h-20 bg-surface-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FolderOpen size={36} className="text-text-300" />
                    </div>
                    <h3 className="font-bold text-navy-900 text-lg mb-1">{t('knowledge_base.no_kb_yet')}</h3>
                    <p className="text-text-400 text-sm mb-4">{t('knowledge_base.no_kb_desc')}</p>
                    {canCreate && (
                        <button onClick={onCreate}
                            className="btn btn-primary inline-flex items-center gap-2">
                            <Plus size={16} /> {t('knowledge_base.create_kb')}
                        </button>
                    )}
                </div>
            ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map(kb => (
                        <button key={kb.id} onClick={() => onSelect(kb)}
                            className="card text-left p-5 hover:shadow-md hover:border-navy-200 transition-all group cursor-pointer relative overflow-hidden">
                            {kb.status === ContentStatus.DRAFT && (
                                <div className="absolute top-0 right-0 bg-amber-500 text-white text-[10px] px-3 py-0.5 rounded-bl-lg font-bold">
                                    DRAFT
                                </div>
                            )}
                            <div className="flex items-start justify-between mb-3">
                                <div className="w-10 h-10 bg-navy-100 rounded-xl flex items-center justify-center group-hover:bg-navy-200 transition">
                                    <BookOpen size={18} className="text-navy-600" />
                                </div>
                                <div className="flex items-center gap-2">
                                    <ChevronRight size={16} className="text-text-300 group-hover:text-navy-600 transition mt-1" />
                                </div>
                            </div>
                            <h3 className="font-bold text-navy-900 text-[15px] mb-1 group-hover:text-navy-700">{kb.name}</h3>
                            <p className="text-text-400 text-xs mb-3 line-clamp-2">{kb.description}</p>
                            
                            <div className="flex items-center gap-2 mb-3">
                                <span className="flex items-center gap-1 text-[10px] font-bold text-navy-600 bg-navy-50 px-2 py-0.5 rounded-md">
                                    <ShieldCheck size={10} /> {kb.groupName}
                                </span>
                            </div>

                            <div className="flex items-center gap-3 text-[11px] text-text-400">
                                <span className="flex items-center gap-1">
                                    <FileText size={11} /> {kb.documents.length} {t('knowledge_base.sources_count')}
                                </span>
                                <span className="flex items-center gap-1">
                                    <Clock size={11} /> {new Date(kb.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                                </span>
                            </div>
                        </button>
                    ))}
                </div>
            ) : (
                <div className="card divide-y">
                    {filtered.map(kb => (
                        <button key={kb.id} onClick={() => onSelect(kb)}
                            className="w-full flex items-center gap-4 p-4 text-left hover:bg-surface-50 transition-colors group">
                            <div className="w-10 h-10 bg-navy-100 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-navy-200 transition">
                                <BookOpen size={18} className="text-navy-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-bold text-navy-900 text-sm group-hover:text-navy-700 truncate">{kb.name}</h3>
                                    {kb.status === ContentStatus.DRAFT && (
                                        <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold">DRAFT</span>
                                    )}
                                </div>
                                <p className="text-text-400 text-xs mt-0.5 truncate">{kb.description}</p>
                            </div>
                            <div className="flex items-center gap-4 text-[11px] text-text-400 shrink-0">
                                <span className="text-navy-600 font-semibold">{kb.groupName}</span>
                                <span className="flex items-center gap-1">
                                    <FileText size={11} /> {kb.documents.length}
                                </span>
                                <span className="flex items-center gap-1">
                                    <Clock size={11} /> {new Date(kb.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                                </span>
                            </div>
                            <ChevronRight size={16} className="text-text-300 group-hover:text-navy-600 transition shrink-0" />
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

/* ═══════════════════════════════════════════
   VIEW: CREATE KB
   ═══════════════════════════════════════════ */
function CreateKBView({ allDocs, onBack, onCreateDone }: {
    allDocs: DocItem[]
    onBack: () => void
    onCreateDone: (kb: Partial<KnowledgeBase>) => void
}) {
    const { t } = useTranslation()
    const [step, setStep] = useState<1 | 2>(1)
    const [name, setName] = useState('')
    const [desc, setDesc] = useState('')
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [search, setSearch] = useState('')

    const filteredDocs = allDocs.filter(d =>
        d.title.toLowerCase().includes(search.toLowerCase())
    )

    const toggleDoc = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }

    const handleCreate = () => {
        const docs = allDocs.filter(d => selected.has(d.id))
        const kb: Partial<KnowledgeBase> = {
            name: name || 'New Knowledge Base',
            description: desc || '',
            documents: docs,
        }
        onCreateDone(kb)
    }

    return (
        <div className="space-y-6">
            <div>
                <button onClick={onBack}
                    className="flex items-center gap-1.5 text-text-400 hover:text-navy-600 text-sm font-medium transition mb-3">
                    <ArrowLeft size={14} /> {t('common.back')}
                </button>
                <h1 className="text-2xl font-bold font-display text-navy-900">{t('knowledge_base.create_new_title')}</h1>
                <p className="text-text-400 text-sm mt-1">{t('knowledge_base.create_new_subtitle')}</p>
            </div>

            <div className="flex items-center gap-3">
                <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold transition ${step === 1 ? 'bg-navy-600 text-white border-navy-600' : 'bg-surface-50 text-text-500 border-surface-200'}`}>
                    <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">1</span>
                    {t('common.details')}
                </div>
                <div className="w-8 h-px bg-surface-200" />
                <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold transition ${step === 2 ? 'bg-navy-600 text-white border-navy-600' : 'bg-surface-50 text-text-500 border-surface-200'}`}>
                    <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">2</span>
                    {t('knowledge_base.select_sources')}
                </div>
            </div>

            {step === 1 && (
                <div className="card p-6 max-w-xl space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-navy-900 mb-1.5">{t('knowledge_base.kb_name_label')}</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)}
                            placeholder={t('knowledge_base.kb_name_placeholder')}
                            className="w-full px-4 py-2.5 border rounded-xl focus:ring-navy-600 focus:border-navy-600 text-sm" />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-navy-900 mb-1.5">{t('knowledge_base.kb_desc_label')}</label>
                        <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3}
                            placeholder={t('knowledge_base.kb_desc_placeholder')}
                            className="w-full px-4 py-2.5 border rounded-xl focus:ring-navy-600 focus:border-navy-600 text-sm resize-none" />
                    </div>
                    <button onClick={() => setStep(2)} disabled={!name.trim()}
                        className="btn btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50">
                        {t('knowledge_base.continue_to_sources')} <ChevronRight size={16} />
                    </button>
                </div>
            )}

            {step === 2 && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="relative w-80">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-300" size={16} />
                            <input type="text" placeholder={t('knowledge_base.search_docs_placeholder')}
                                value={search} onChange={e => setSearch(e.target.value)}
                                className="pl-10 pr-4 py-2.5 border rounded-xl w-full focus:ring-navy-600 focus:border-navy-600 text-sm" />
                        </div>
                        <span className="text-sm text-text-500 font-medium">
                            {selected.size} {t('knowledge_base.selected')}
                        </span>
                    </div>

                    <div className="card divide-y max-h-[400px] overflow-y-auto">
                        {filteredDocs.length === 0 ? (
                            <div className="p-8 text-center text-text-400 text-sm">{t('knowledge_base.no_docs_found')}</div>
                        ) : filteredDocs.map(doc => (
                            <button key={doc.id} onClick={() => toggleDoc(doc.id)}
                                className={`w-full flex items-center gap-3 p-4 text-left transition hover:bg-surface-50 ${selected.has(doc.id) ? 'bg-navy-50' : ''}`}>
                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition shrink-0 ${selected.has(doc.id) ? 'bg-navy-600 border-navy-600' : 'border-surface-300'}`}>
                                    {selected.has(doc.id) && <Check size={12} className="text-white" />}
                                </div>
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${doc.type === 'document' ? 'bg-navy-100' : 'bg-amber-100'}`}>
                                    {doc.type === 'document' ? <File size={14} className="text-navy-600" /> : <FileText size={14} className="text-amber-600" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-navy-900 text-sm truncate">{doc.title}</div>
                                    <div className="text-[11px] text-text-400 mt-0.5 flex items-center gap-2">
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${doc.type === 'document' ? 'bg-navy-100 text-navy-700' : 'bg-amber-100 text-amber-700'}`}>
                                            {doc.type === 'document' ? t('knowledge_base.type_document') : t('knowledge_base.type_content')}
                                        </span>
                                        {doc.group && <span>{doc.group}</span>}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-3">
                        <button onClick={() => setStep(1)}
                            className="px-4 py-2.5 border border-surface-200 rounded-xl text-sm font-medium text-text-600 hover:bg-surface-50 transition">
                            ← {t('common.back')}
                        </button>
                        <button onClick={handleCreate} disabled={selected.size === 0}
                            className="btn btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50">
                            <Sparkles size={16} /> {t('knowledge_base.create_btn')} ({selected.size} {t('knowledge_base.sources_count')})
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

/* ═══════════════════════════════════════════
   VIEW: KB CHAT
   ═══════════════════════════════════════════ */
function KBChatView({ kb, onBack, onAddDoc, onRemoveDoc, chatSessions, onNewSession, canEdit, onRefreshSessions }: {
    kb: KnowledgeBase
    onBack: () => void
    onAddDoc: () => void
    onRemoveDoc: (id: string) => void
    chatSessions: ChatSession[]
    onNewSession: () => void
    canEdit: boolean
    onRefreshSessions?: () => void
}) {
    const { t } = useTranslation()
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [input, setInput] = useState('')
    const [isTyping, setIsTyping] = useState(false)
    const [showSidebar, setShowSidebar] = useState(true)
    const [sidebarTab, setSidebarTab] = useState<'docs' | 'history'>('docs')
    const [showNewSessionModal, setShowNewSessionModal] = useState(false)
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
    const endRef = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const abortControllerRef = useRef<AbortController | null>(null)



    const loadSession = async (sessionId: string) => {
        try {
            const res = await fetch(`/api/chat/sessions/${sessionId}`)
            if (res.ok) {
                const data = await res.json()
                setActiveSessionId(sessionId)
                setMessages(
                    data.session.messages.map((m: any) => ({
                        role: m.role as 'user' | 'assistant',
                        content: m.content,
                        citations: m.citations ? (typeof m.citations === 'string' ? JSON.parse(m.citations) : m.citations) : undefined
                    }))
                )
            }
        } catch { /* ignore */ }
    }

    const isDraft = kb.status === ContentStatus.DRAFT

    const renderCitations = (citationList?: Citation[]) => {
        if (!citationList || citationList.length === 0) return null

        // Group by documentId to avoid redundant cards
        const groupedMap = new Map<string, {
            docId: string,
            title: string,
            groupName: string,
            sourceType: 'DOCUMENT' | 'ARTICLE',
            pages: Set<number>,
            contentSnippet: string
        }>()

        citationList.forEach(c => {
            if (!groupedMap.has(c.documentId)) {
                groupedMap.set(c.documentId, {
                    docId: c.documentId,
                    title: c.documentTitle,
                    groupName: c.groupName,
                    sourceType: c.sourceType || 'DOCUMENT',
                    pages: new Set<number>(),
                    contentSnippet: c.chunkContent
                })
            }
            const item = groupedMap.get(c.documentId)!
            // Add all pages in the range
            for (let p = c.pageStart; p <= (c.pageEnd || c.pageStart); p++) {
                item.pages.add(p)
            }
        })

        const groupedCitations = Array.from(groupedMap.values())

        const formatRanges = (pages: Set<number>) => {
            const sorted = Array.from(pages).sort((a, b) => a - b)
            if (sorted.length === 0) return ''
            const ranges: string[] = []
            let start = sorted[0]
            let end = sorted[0]
            for (let i = 1; i <= sorted.length; i++) {
                if (i < sorted.length && sorted[i] === end + 1) {
                    end = sorted[i]
                } else {
                    ranges.push(start === end ? `${start}` : `${start}–${end}`)
                    if (i < sorted.length) {
                        start = sorted[i]
                        end = sorted[i]
                    }
                }
            }
            return ranges.join(', ')
        }

        return (
            <div className="mt-4 pt-3 border-t border-surface-200 dark:border-slate-700/50">
                <p className="text-[10px] font-bold text-text-400 uppercase tracking-wider mb-2">
                    {t('ai_assistant.reference_sources') || 'SUMBER DOKUMEN'}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {groupedCitations.slice(0, 4).map((c, i) => {
                        const isArticle = c.sourceType === 'ARTICLE'
                        const pageList = formatRanges(c.pages)
                        const locationLabel = isArticle ? `Bagian ${pageList}` : `Hal. ${pageList}`
                        
                        // Use the first page of the group for the link
                        const firstPage = Array.from(c.pages).sort((a, b) => a - b)[0] || 1
                        const cleanText = c.contentSnippet.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim()
                        const searchSnippet = cleanText.substring(0, 35)
                        const encodedKeyword = encodeURIComponent(searchSnippet)

                        const href = isArticle
                            ? `/dashboard/knowledge-base/${c.docId}#:~:text=${encodedKeyword}`
                            : `/dashboard/documents/${c.docId}?page=${firstPage}&search=${encodedKeyword}`

                        const pathSegments = isArticle
                            ? ['Basis Pengetahuan', c.title]
                            : ['Dokumen', c.title]
                        
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
                                            {c.title}
                                        </p>
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
                                        <div className="flex items-center gap-1 mt-1.5 text-[9px] text-text-400 group-hover:text-navy-500 transition-colors">
                                            <span className="opacity-70">📂</span>
                                            <span className="font-medium truncate">
                                                {pathSegments[0]} › {pathSegments[1]?.substring(0, 30)}{(pathSegments[1]?.length || 0) > 30 ? '...' : ''}
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

    const handleConfirmNewSession = () => {
        setMessages([])
        setActiveSessionId(null)
        onNewSession()
        setShowNewSessionModal(false)
    }

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, isTyping])

    const stopStreaming = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort()
            setIsTyping(false)
        }
    }

    const sendMessage = async () => {
        const q = input.trim()
        if (!q || isTyping || isDraft) return
        
        let currentSessionId = activeSessionId
        if (!currentSessionId) {
            try {
                const res = await fetch('/api/chat/sessions', { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ knowledgeBaseId: kb.id }) 
                })
                if (res.ok) {
                    const data = await res.json()
                    currentSessionId = data.session.id
                    setActiveSessionId(data.session.id)
                    if (onRefreshSessions) {
                        onRefreshSessions()
                    }
                }
            } catch {
                return
            }
        }

        const newHistory = [...messages, { role: 'user' as const, content: q }]
        setMessages(newHistory)
        setInput('')
        if (textareaRef.current) textareaRef.current.style.height = 'auto'
        setIsTyping(true)

        const controller = new AbortController()
        abortControllerRef.current = controller

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    question: q,
                    history: messages.slice(-6),
                    sessionId: currentSessionId,
                    knowledgeBaseId: kb.id
                })
            })
            if (!res.ok) throw new Error('API Error')
            
            const reader = res.body?.getReader()
            const decoder = new TextDecoder()
            let aiText = ''
            let receivedCitations: Citation[] = []
            let sseBuffer = ''

            setMessages([...newHistory, { role: 'assistant' as const, content: '', citations: [] }])

            if (reader) {
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
                            try {
                                const json = JSON.parse(line.slice(6))
                                if (currentEvent === 'chunk' && json.text) {
                                    aiText += json.text
                                    setMessages(prev => {
                                        const next = [...prev]
                                        next[next.length - 1] = { role: 'assistant', content: aiText, citations: receivedCitations }
                                        return next
                                    })
                                } else if (currentEvent === 'citations' && json.citations) {
                                    receivedCitations = json.citations
                                    setMessages(prev => {
                                        const next = [...prev]
                                        next[next.length - 1].citations = receivedCitations
                                        return next
                                    })
                                } else if (currentEvent === 'title_updated' && json.title) {
                                    if (onRefreshSessions) {
                                        onRefreshSessions()
                                    }
                                }
                            } catch {}
                            currentEvent = ''
                        }
                    }
                }
            }

            if (currentSessionId && aiText) {
                try {
                    await fetch(`/api/chat/sessions/${currentSessionId}/messages`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            userMessage: q,
                            assistantMessage: aiText,
                            citations: receivedCitations.length > 0 ? receivedCitations : null,
                        }),
                    })
                } catch { /* ignore */ }
            }

        } catch (e) {
            if (e instanceof Error && e.name === 'AbortError') {
                // Ignore
            } else {
                setMessages(prev => [...prev, { role: 'assistant', content: 'Maaf, terjadi kesalahan.' }])
            }
        } finally {
            setIsTyping(false)
            abortControllerRef.current = null
        }
    }

    return (
        <div className="flex h-[calc(100vh-120px)] -m-6 md:-m-8 bg-surface-50 overflow-hidden rounded-xl border border-surface-200">
            <div className="flex-1 flex flex-col min-w-0 bg-white">
                <div className="bg-surface-0 border-b border-surface-200 px-5 py-3 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <button onClick={onBack} className="p-1.5 hover:bg-surface-100 rounded-lg transition text-text-400 shrink-0">
                            <ArrowLeft size={18} />
                        </button>
                        <div className="w-9 h-9 bg-navy-100 rounded-full flex items-center justify-center shrink-0">
                            <BookOpen size={16} className="text-navy-600" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-bold text-navy-900 text-sm truncate">{kb.name}</h3>
                            <p className="text-[11px] text-text-400">{kb.documents.length} sources</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 bg-surface-100 p-1 rounded-xl">
                        <button onClick={handleConfirmNewSession}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 text-text-400 hover:text-navy-600`}>
                            <Plus size={14} /> New Chat
                        </button>
                        <button onClick={() => { setShowSidebar(true); setSidebarTab('docs') }}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 ${showSidebar && sidebarTab === 'docs' ? 'bg-white shadow-sm text-navy-600' : 'text-text-400'}`}>
                            <FileText size={14} /> {t('common.sources')}
                        </button>
                        <button onClick={() => { setShowSidebar(true); setSidebarTab('history') }}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 ${showSidebar && sidebarTab === 'history' ? 'bg-white shadow-sm text-navy-600' : 'text-text-400'}`}>
                            <MessageSquare size={14} /> {t('common.history')}
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
                    {isDraft && (
                        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-amber-800 text-sm text-center mb-4">
                            <strong>Note:</strong> Ini adalah Knowledge Base DRAFT. Publikasikan terlebih dahulu agar AISA dapat mulai mempelajari dokumen di dalamnya.
                        </div>
                    )}
                    {messages.length === 0 && !isTyping && (
                        <div className="text-center py-16 text-text-400">
                            <Sparkles size={48} className="mx-auto mb-4 opacity-20" />
                            <h3 className="font-bold text-navy-900 text-xl mb-2">Tanya AISA tentang {kb.name}</h3>
                            <p className="text-sm">Silakan ajukan pertanyaan seputar dokumen yang ada di KB ini.</p>
                        </div>
                    )}
                    {messages.map((msg, i) => (
                        <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`rounded-2xl px-4 py-2.5 max-w-[80%] text-sm ${msg.role === 'user' ? 'bg-navy-600 text-white' : 'bg-surface-100 text-navy-900'}`}>
                                <p className="whitespace-pre-wrap">{msg.content}</p>
                                {msg.role === 'assistant' && renderCitations(msg.citations)}
                            </div>
                        </div>
                    ))}
                    {isTyping && <Loader2 className="animate-spin text-navy-400" size={20} />}
                    <div ref={endRef} />
                </div>

                <div className="p-4 border-t border-surface-200 bg-surface-0">
                    <div className="flex items-center gap-3 bg-white rounded-xl px-4 py-2 border border-surface-200">
                        <textarea
                            ref={textareaRef}
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
                            disabled={isTyping || isDraft}
                            placeholder={isDraft ? "Chat dinonaktifkan untuk draft" : "Ketik pertanyaan..."}
                            rows={1}
                            className="flex-1 bg-transparent outline-none text-sm resize-none max-h-32 py-1 scrollbar-thin"
                        />

                        {isTyping ? (
                            <button onClick={stopStreaming}
                                className="bg-red-500 text-white rounded-lg p-2">
                                <Square size={16} fill="currentColor" />
                            </button>
                        ) : (
                            <button onClick={sendMessage} disabled={!input.trim() || isDraft}
                                className="bg-navy-600 text-white rounded-lg p-2 disabled:bg-surface-200">
                                <Send size={16} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {showSidebar && (
                <div className="w-[280px] bg-surface-50 border-l border-surface-200 flex flex-col shrink-0">
                    <div className="p-4 border-b border-surface-200 flex justify-between items-center">
                        <h4 className="font-bold text-sm text-navy-900">{sidebarTab === 'docs' ? 'Sources' : 'History'}</h4>
                        <button onClick={() => setShowSidebar(false)}><X size={16} /></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {sidebarTab === 'docs' ? kb.documents.map(d => (
                            <a 
                                key={d.id} 
                                href={d.type === 'document' ? `/dashboard/documents/${d.id}` : `/dashboard/knowledge-base/${d.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2.5 bg-white border border-surface-200 rounded-lg text-xs font-medium text-navy-900 flex items-center gap-2 hover:border-navy-400 hover:text-navy-600 transition-colors group"
                            >
                                <FileText size={14} className="text-navy-400 group-hover:text-navy-600" /> 
                                <span className="truncate flex-1">{d.title}</span>
                                <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 text-navy-400 transition-opacity" />
                            </a>
                        )) : chatSessions.map(s => (
                            <button key={s.id} onClick={() => loadSession(s.id)}
                                className={`w-full text-left p-2.5 border rounded-lg text-xs font-medium transition ${activeSessionId === s.id ? 'bg-navy-50 border-navy-200 text-navy-700' : 'bg-white border-surface-200 text-navy-900 hover:bg-surface-50'}`}>
                                {s.title}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

/* ═══════════════════════════════════════════
   VIEW: KB DETAIL
   ═══════════════════════════════════════════ */
function KBDetailView({ kb, onBack, onChat, onAddDoc, onUpload, onRemoveDoc, onDelete, onPublish, canPublish, canEdit }: {
    kb: KnowledgeBase
    onBack: () => void
    onChat: () => void
    onAddDoc: () => void
    onUpload: () => void
    onRemoveDoc: (id: string) => void
    onDelete: (kb: KnowledgeBase) => void
    onPublish: () => void
    canPublish: boolean
    canEdit: boolean
}) {
    const { t } = useTranslation()
    const isDraft = kb.status === ContentStatus.DRAFT

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-12">
            <div>
                <button onClick={onBack}
                    className="flex items-center gap-1.5 text-text-400 hover:text-navy-600 text-sm font-medium transition mb-4">
                    <ArrowLeft size={14} /> {t('knowledge_base.back_to_list')}
                </button>
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-bold font-display text-navy-900 truncate">{kb.name}</h1>
                            {isDraft && (
                                <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full border border-amber-200 shadow-sm animate-pulse">DRAFT</span>
                            )}
                        </div>
                        <p className="text-text-500 mt-2 max-w-2xl">{kb.description}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 shrink-0">
                        {isDraft && canPublish && (
                            <button onClick={onPublish}
                                className="btn bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 flex items-center gap-2 shadow-lg shadow-emerald-200 transition">
                                <Globe size={18} /> Publish KB
                            </button>
                        )}
                        {canEdit && (
                            <button onClick={() => onDelete(kb)}
                                className="p-3 border border-surface-200 text-text-400 hover:text-danger hover:bg-danger-bg rounded-xl transition shadow-sm"
                                title="Delete Knowledge Base">
                                <Trash2 size={20} />
                            </button>
                        )}
                        <button onClick={onChat}
                            className="btn btn-primary px-8 py-3 rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition duration-300 flex items-center gap-3">
                            <Sparkles size={20} />
                            <span className="text-lg">Chat with AISA</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="card p-4 bg-navy-50/50 border-navy-100 flex items-center gap-4">
                    <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-navy-600">
                        <FileText size={20} />
                    </div>
                    <div>
                        <p className="text-[10px] uppercase tracking-wider font-bold text-text-400">{t('dashboard.total_documents')}</p>
                        <p className="text-xl font-bold text-navy-900">{kb.documents.filter(d => d.type === 'document').length}</p>
                    </div>
                </div>
                <div className="card p-4 bg-amber-50/50 border-amber-100 flex items-center gap-4">
                    <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-amber-600">
                        <BookOpen size={20} />
                    </div>
                    <div>
                        <p className="text-[10px] uppercase tracking-wider font-bold text-text-400">{t('knowledge_base.number_of_sources')}</p>
                        <p className="text-xl font-bold text-navy-900">{kb.documents.length}</p>
                    </div>
                </div>
                <div className="card p-4 bg-emerald-50/50 border-emerald-100 flex items-center gap-4">
                    <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-emerald-600 text-sm">
                        <Lock size={18} />
                    </div>
                    <div>
                        <p className="text-[10px] uppercase tracking-wider font-bold text-text-400">STATUS</p>
                        <p className={`text-xs font-bold ${isDraft ? 'text-amber-600' : 'text-emerald-600'}`}>{isDraft ? 'DRAFT' : 'PUBLISHED'}</p>
                    </div>
                </div>
                <div className="card p-4 bg-indigo-50/50 border-indigo-100 flex items-center gap-4">
                    <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-indigo-600">
                        <Users size={20} />
                    </div>
                    <div>
                        <p className="text-[10px] uppercase tracking-wider font-bold text-text-400">GROUP</p>
                        <p className="text-xs font-bold text-navy-900 truncate">{kb.groupName}</p>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="font-bold text-navy-900 text-lg flex items-center gap-2">
                        <FolderOpen size={20} className="text-navy-500" />
                        {t('knowledge_base.docs_in_kb')}
                    </h3>
                    {canEdit && (
                        <div className="flex gap-2">
                            <button onClick={onUpload} className="btn bg-white border border-surface-200 text-text-600 px-4 py-2 text-sm hover:bg-surface-50">
                                <FileText size={16} /> {t('knowledge_base.connect_document')}
                            </button>
                            <button onClick={onAddDoc} className="btn btn-primary px-4 py-2 text-sm">
                                <Plus size={16} /> {t('knowledge_base.connect_content')}
                            </button>
                        </div>
                    )}
                </div>

                <div className="card divide-y overflow-hidden">
                    {kb.documents.length === 0 ? (
                        <div className="p-12 text-center text-text-400">
                            <FolderOpen size={48} className="mx-auto mb-3 opacity-20" />
                            <p>{t('knowledge_base.no_docs_connected')}</p>
                        </div>
                    ) : kb.documents.map((doc, idx) => (
                        <div key={doc.id} className="flex items-center gap-4 p-4 hover:bg-surface-50 transition group relative">
                            <span className="text-text-300 font-mono text-xs w-4">{idx + 1}.</span>
                            
                            <a 
                                href={doc.type === 'document' ? `/dashboard/documents/${doc.id}` : `/dashboard/knowledge-base/${doc.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex flex-1 items-center gap-4 min-w-0"
                            >
                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${doc.type === 'document' ? 'bg-navy-100' : 'bg-amber-100'}`}>
                                    <FileText size={16} className={doc.type === 'document' ? 'text-navy-600' : 'text-amber-600'} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-navy-900 text-sm truncate group-hover:text-navy-600 transition-colors">{doc.title}</p>
                                    <p className="text-[11px] text-text-400 mt-0.5">{doc.group || 'General'} · {doc.type === 'document' ? 'PDF/Doc' : 'Article'}</p>
                                </div>
                            </a>

                            <div className="flex items-center gap-2">
                                <a 
                                    href={doc.type === 'document' ? `/dashboard/documents/${doc.id}` : `/dashboard/knowledge-base/${doc.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="opacity-0 group-hover:opacity-100 px-3 py-1.5 bg-navy-50 text-navy-600 rounded-lg flex items-center gap-1.5 text-[11px] font-bold transition-all border border-navy-100"
                                >
                                    <ExternalLink size={14} /> {t('common.view') || 'VIEW'}
                                </a>
                                {canEdit && (
                                    <button onClick={() => onRemoveDoc(doc.id)}
                                        className="opacity-0 group-hover:opacity-100 p-2 text-text-300 hover:text-danger hover:bg-danger-bg rounded-lg transition">
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

/* ═══════════════════════════════════════════
   VIEW: ADD DOCS
   ═══════════════════════════════════════════ */
function AddDocsView({ allDocs, existingIds, onBack, onAdd }: {
    allDocs: DocItem[]
    existingIds: Set<string>
    onBack: () => void
    onAdd: (docs: DocItem[]) => void
}) {
    const { t } = useTranslation()
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [search, setSearch] = useState('')
    const available = allDocs.filter(d => !existingIds.has(d.id))
    const filtered = available.filter(d => d.title.toLowerCase().includes(search.toLowerCase()))

    const toggleDoc = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }

    return (
        <div className="space-y-6">
            <div>
                <button onClick={onBack} className="flex items-center gap-1.5 text-text-400 hover:text-navy-600 text-sm mb-3">
                    <ArrowLeft size={14} /> {t('common.back')}
                </button>
                <h1 className="text-2xl font-bold text-navy-900">{t('knowledge_base.connect_content')}</h1>
            </div>
            <div className="card overflow-hidden h-[calc(100vh-300px)] flex flex-col">
                <div className="p-4 border-b border-surface-200">
                    <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
                        className="w-full px-4 py-2 border rounded-xl" />
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {filtered.map(doc => (
                        <button key={doc.id} onClick={() => toggleDoc(doc.id)}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl transition ${selected.has(doc.id) ? 'bg-navy-50 border-navy-200 border' : 'hover:bg-surface-50'}`}>
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${selected.has(doc.id) ? 'bg-navy-600 border-navy-600' : 'border-surface-300'}`}>
                                {selected.has(doc.id) && <Check size={12} className="text-white" />}
                            </div>
                            <div className="text-left flex-1 min-w-0">
                                <p className="text-sm font-bold text-navy-900 truncate">{doc.title}</p>
                                <p className="text-[11px] text-text-400">{doc.group}</p>
                            </div>
                        </button>
                    ))}
                </div>
                <div className="p-4 border-t border-surface-200 flex gap-3">
                    <button onClick={onBack} className="flex-1 py-2 border rounded-xl font-medium">Cancel</button>
                    <button onClick={() => onAdd(available.filter(d => selected.has(d.id)))} disabled={selected.size === 0}
                        className="flex-[2] py-2 bg-navy-600 text-white rounded-xl font-medium disabled:opacity-50">
                        Add Selected ({selected.size})
                    </button>
                </div>
            </div>
        </div>
    )
}

/* ═══════════════════════════════════════════
   MAIN PAGE CONTROLLER
   ═══════════════════════════════════════════ */
type View = 'list' | 'create' | 'detail' | 'chat' | 'edit' | 'add-docs'

export default function KnowledgeBasePage() {
    const { organization, role, group } = useCurrentUser()
    const { t } = useTranslation()
    const [view, setView] = useState<View>('list')
    const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([])
    const [activeKB, setActiveKB] = useState<KnowledgeBase | null>(null)
    const [allDocs, setAllDocs] = useState<DocItem[]>([])
    const [loading, setLoading] = useState(true)
    const [chatSessions, setChatSessions] = useState<ChatSession[]>([])
    const [kbToDelete, setKbToDelete] = useState<KnowledgeBase | null>(null)
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)

    const isSuperAdmin = role === Role.SUPER_ADMIN || role === Role.MAINTAINER
    const isGroupAdmin = role === Role.GROUP_ADMIN || isSuperAdmin
    const isSupervisor = role === Role.SUPERVISOR || isGroupAdmin
    const canCreate = isSupervisor
    const canPublish = isGroupAdmin
    const canDelete = isGroupAdmin

    const handlePublish = async (kbId: string) => {
        const res = await publishKnowledgeBaseAction(kbId)
        if (res.success) {
            setKnowledgeBases(prev => prev.map(kb => kb.id === kbId ? { ...kb, status: ContentStatus.PUBLISHED } : kb))
            if (activeKB?.id === kbId) {
                setActiveKB({ ...activeKB, status: ContentStatus.PUBLISHED })
            }
        } else {
            alert('Gagal mempublikasikan KB: ' + (res as any).error)
        }
    }

    const handleDeleteKB = async () => {
        if (!kbToDelete) return
        setIsDeleting(true)
        const res = await deleteKnowledgeBaseAction(kbToDelete.id)
        if (res.success) {
            setKnowledgeBases(prev => prev.filter(kb => kb.id !== kbToDelete.id))
            setShowDeleteModal(false)
            setKbToDelete(null)
            if (activeKB?.id === kbToDelete.id) {
                setView('list')
                setActiveKB(null)
            }
        } else {
            alert('Gagal menghapus knowledge base: ' + (res as any).error)
        }
        setIsDeleting(false)
    }

    useEffect(() => {
        async function load() {
            if (!organization?.id || !role) return
            try {
                const kbs = await getKnowledgeBasesAction(organization.id)
                
                // Group Members/Staff can only see PUBLISHED KBs (unless Super Admin/Group Admin)
                const isStaff = role === Role.STAFF
                const filteredKBs = isStaff 
                    ? kbs.filter(kb => kb.status === ContentStatus.PUBLISHED)
                    : kbs

                setKnowledgeBases(filteredKBs)

                const groupFilter = !isSuperAdmin ? group?.id : undefined
                const res = await getContentsAction(organization.id, groupFilter)
                const contents: DocItem[] = res.success
                    ? (res.data || []).map((c: any) => ({
                        id: c.id,
                        title: c.title,
                        type: 'content' as const,
                        group: c.group?.name || '',
                        author: c.author_name,
                        status: c.status,
                    }))
                    : []

                const docRes = await fetch(`/api/documents?orgId=${organization.id}${groupFilter ? `&groupId=${groupFilter}` : ''}`)
                let documents: DocItem[] = []
                if (docRes.ok) {
                    const docData = await docRes.json()
                    documents = (docData.documents || []).map((d: any) => ({
                        id: d.id,
                        title: d.file_name || d.title || 'Untitled',
                        type: 'document' as const,
                        group: d.group?.name || '',
                        status: d.status,
                    }))
                }

                setAllDocs([...documents, ...contents])
            } catch { /* ignore */ }
            setLoading(false)
        }
        load()
    }, [organization?.id, group?.id, role, isSuperAdmin])

    const handleSelectKB = async (kb: KnowledgeBase) => {
        setActiveKB(kb)
        setView('detail')
        const sessions = await getKBChatSessionsAction(kb.id)
        setChatSessions(sessions)
    }

    const handleCreateKB = async (kb: Partial<KnowledgeBase>) => {
        if (!organization?.id || !kb.name || !kb.documents) return
        const res = await createKnowledgeBaseAction(
            organization.id,
            kb.name,
            kb.description || '',
            kb.documents.map(d => ({ id: d.id, type: d.type })),
            group?.id
        )
        if (res.success && res.kbId) {
            const updatedKBs = await getKnowledgeBasesAction(organization.id)
            setKnowledgeBases(updatedKBs)
            const created = updatedKBs.find(x => x.id === res.kbId)
            if (created) {
                setActiveKB(created)
                setView('detail')
            } else {
                setView('list')
            }
        } else {
            alert('Gagal membuat knowledge base: ' + (res as any).error)
        }
    }

    const handleAddDocs = async (docs: DocItem[]) => {
        if (!activeKB) return
        const res = await addSourcesToKBAction(
            activeKB.id,
            docs.map(d => ({ id: d.id, type: d.type }))
        )
        if (res.success) {
            const updated = { ...activeKB, documents: [...activeKB.documents, ...docs] }
            setActiveKB(updated)
            setKnowledgeBases(prev => prev.map(kb => kb.id === updated.id ? updated : kb))
        } else {
            alert('Gagal menambahkan dokumen')
        }
    }

    const handleRemoveDoc = async (docId: string) => {
        if (!activeKB) return
        if (activeKB.documents.length <= 1) {
            alert('Knowledge base harus memiliki minimal 1 sumber')
            return
        }
        const res = await removeSourceFromKBAction(activeKB.id, docId)
        if (res.success) {
            const updated = { ...activeKB, documents: activeKB.documents.filter(d => d.id !== docId) }
            setActiveKB(updated)
            setKnowledgeBases(prev => prev.map(kb => kb.id === updated.id ? updated : kb))
        } else {
            alert('Gagal menghapus dokumen')
        }
    }

    if (loading) {
        return <KBSkeleton />
    }

    return (
        <>
            {view === 'list' && (
                <KBListView 
                    knowledgeBases={knowledgeBases}
                    onSelect={handleSelectKB}
                    onCreate={() => setView('create')}
                    onDelete={(kb) => { setKbToDelete(kb); setShowDeleteModal(true); }}
                    canCreate={canCreate}
                />
            )}
            {view === 'create' && (
                <CreateKBView
                    allDocs={allDocs}
                    onBack={() => setView('list')}
                    onCreateDone={handleCreateKB}
                />
            )}
            {view === 'detail' && activeKB && (
                <KBDetailView
                    kb={activeKB}
                    onBack={() => { setView('list'); setActiveKB(null) }}
                    onChat={() => setView('chat')}
                    onAddDoc={() => setView('add-docs')}
                    onUpload={() => setView('add-docs')}
                    onRemoveDoc={handleRemoveDoc}
                    onDelete={(kb) => { setKbToDelete(kb); setShowDeleteModal(true); }}
                    onPublish={() => handlePublish(activeKB.id)}
                    canPublish={canPublish && activeKB.status === ContentStatus.DRAFT}
                    canEdit={isSupervisor && (isSuperAdmin || activeKB.groupName === group?.name)}
                />
            )}
            {view === 'chat' && activeKB && (
                <KBChatView
                    kb={activeKB}
                    onBack={() => setView('detail')}
                    onAddDoc={() => setView('add-docs')}
                    onRemoveDoc={handleRemoveDoc}
                    chatSessions={chatSessions}
                    onNewSession={() => { }}
                    canEdit={isSupervisor && (isSuperAdmin || activeKB.groupName === group?.name)}
                    onRefreshSessions={async () => {
                        const sessions = await getKBChatSessionsAction(activeKB.id)
                        setChatSessions(sessions)
                    }}
                />
            )}
            {view === 'add-docs' && activeKB && (
                <AddDocsView
                    allDocs={allDocs}
                    existingIds={new Set(activeKB.documents.map(d => d.id))}
                    onBack={() => setView('detail')}
                    onAdd={(docs) => {
                        handleAddDocs(docs);
                        setView('detail');
                    }}
                />
            )}

            {/* DELETE CONFIRMATION MODAL */}
            {showDeleteModal && kbToDelete && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-navy-900/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
                        <div className="p-6 text-center">
                            <div className="w-16 h-16 bg-danger-bg rounded-2xl flex items-center justify-center mb-4 mx-auto text-danger">
                                <Trash2 size={32} />
                            </div>
                            <h2 className="text-xl font-bold text-navy-900 mb-2">Hapus Knowledge Base?</h2>
                            <p className="text-text-500 text-sm">
                                Anda akan menghapus <strong>{kbToDelete.name}</strong>. Tindakan ini tidak dapat dibatalkan.
                            </p>
                        </div>
                        <div className="bg-surface-50 p-4 border-t border-surface-200 flex gap-3">
                            <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-2.5 border rounded-xl font-semibold">Batal</button>
                            <button onClick={handleDeleteKB} disabled={isDeleting}
                                className="flex-1 py-2.5 bg-danger text-white font-semibold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
                                {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                Ya, Hapus
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
