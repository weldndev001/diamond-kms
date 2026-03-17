'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { getContentsAction } from '@/lib/actions/content.actions'
import {
    Plus, Search, MessageSquare, FileText, Bot, User, Send, Loader2,
    ArrowLeft, X, Check, BookOpen, File, ChevronRight, Sparkles,
    Trash2, Tags, FolderOpen, Clock, Users as UsersIcon,
    LayoutGrid, List
} from 'lucide-react'

/* ═══════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════ */
interface DocItem {
    id: string
    title: string
    type: 'document' | 'content'
    division?: string
    author?: string
    status?: string
    created_at?: string
}

interface KnowledgeBase {
    id: string
    name: string
    description: string
    documents: DocItem[]
    created_at: string
    messageCount: number
}

interface ChatMessage {
    role: 'user' | 'assistant'
    content: string
}

interface ChatSession {
    id: string
    title: string
    messages: ChatMessage[]
    updatedAt: string
}

/* ═══════════════════════════════════════════
   MOCK DATA  (frontend-only, replaced later)
   ═══════════════════════════════════════════ */
const MOCK_KBS: KnowledgeBase[] = [
    {
        id: 'kb-1',
        name: 'SOP Operasional',
        description: 'Kumpulan SOP dan prosedur kerja harian',
        documents: [
            { id: 'd1', title: 'SOP Penerimaan Barang', type: 'document', division: 'Warehouse' },
            { id: 'd2', title: 'Prosedur Quality Check', type: 'document', division: 'QC' },
            { id: 'c1', title: 'Panduan Keamanan Kerja', type: 'content', division: 'HR' },
        ],
        created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
        messageCount: 24,
    },
    {
        id: 'kb-2',
        name: 'Kebijakan SDM',
        description: 'Aturan cuti, gaji, dan manajemen karyawan',
        documents: [
            { id: 'd3', title: 'Panduan Cuti Tahunan', type: 'document', division: 'HR' },
            { id: 'c2', title: 'Kebijakan Remunerasi 2025', type: 'content', division: 'HR' },
        ],
        created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
        messageCount: 8,
    },
    {
        id: 'kb-3',
        name: 'Produk & Marketing',
        description: 'Informasi produk, pricing, dan strategi marketing',
        documents: [
            { id: 'd4', title: 'Katalog Produk 2025', type: 'document', division: 'Marketing' },
            { id: 'c3', title: 'Strategi Digital Marketing', type: 'content', division: 'Marketing' },
            { id: 'c4', title: 'FAQ Produk Terbaru', type: 'content', division: 'Marketing' },
            { id: 'd5', title: 'Daftar Harga Resmi', type: 'document', division: 'Sales' },
        ],
        created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
        messageCount: 42,
    },
]

const MOCK_RESPONSES: Record<string, string> = {
    default: 'Berdasarkan dokumen yang tersedia di knowledge base ini, berikut penjelasannya:\n\n1. **Informasi Utama**: Data yang Anda tanyakan tercantum dalam beberapa dokumen terkait.\n\n2. **Detail Prosedur**: Langkah-langkah yang perlu diikuti sudah dijelaskan secara detail dalam SOP yang relevan.\n\n3. **Catatan Penting**: Pastikan untuk selalu merujuk ke versi terbaru dari dokumen ini untuk informasi yang paling akurat.\n\nApakah ada hal spesifik lainnya yang ingin Anda ketahui?',
}

/* ═══════════════════════════════════════════
   VIEW: KB LIST
   ═══════════════════════════════════════════ */
function KBListView({ knowledgeBases, onSelect, onCreate }: {
    knowledgeBases: KnowledgeBase[]
    onSelect: (kb: KnowledgeBase) => void
    onCreate: () => void
}) {
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
                        Knowledge Base Management
                    </h1>
                    <p className="text-text-400 text-sm mt-1">Buat, edit, dan kelola semua knowledge base organisasi</p>
                </div>
                <button onClick={onCreate}
                    className="btn btn-primary flex items-center gap-2">
                    <Plus size={16} /> Buat Knowledge Base
                </button>
            </div>

            {/* Search + View Toggle */}
            <div className="flex items-center justify-between gap-4">
                <div className="relative w-full max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-300" size={16} />
                    <input type="text" placeholder="Cari knowledge base..."
                        value={search} onChange={e => setSearch(e.target.value)}
                        className="pl-10 pr-4 py-2.5 border rounded-xl w-full focus:ring-navy-600 focus:border-navy-600 text-sm" />
                </div>
                <div className="flex items-center bg-surface-100 rounded-lg p-0.5 border border-surface-200 shrink-0">
                    <button onClick={() => setViewMode('grid')}
                        className={`p-2 rounded-md transition ${viewMode === 'grid' ? 'bg-white shadow-sm text-navy-600' : 'text-text-400 hover:text-text-600'}`}
                        title="Tampilan Grid">
                        <LayoutGrid size={16} />
                    </button>
                    <button onClick={() => setViewMode('list')}
                        className={`p-2 rounded-md transition ${viewMode === 'list' ? 'bg-white shadow-sm text-navy-600' : 'text-text-400 hover:text-text-600'}`}
                        title="Tampilan List">
                        <List size={16} />
                    </button>
                </div>
            </div>

            {/* KB Cards Grid */}
            {filtered.length === 0 ? (
                <div className="text-center py-16">
                    <div className="w-20 h-20 bg-surface-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FolderOpen size={36} className="text-text-300" />
                    </div>
                    <h3 className="font-bold text-navy-900 text-lg mb-1">Belum ada Knowledge Base</h3>
                    <p className="text-text-400 text-sm mb-4">Buat knowledge base pertama dari dokumen atau konten Anda</p>
                    <button onClick={onCreate}
                        className="btn btn-primary inline-flex items-center gap-2">
                        <Plus size={16} /> Buat Knowledge Base
                    </button>
                </div>
            ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map(kb => (
                        <button key={kb.id} onClick={() => onSelect(kb)}
                            className="card text-left p-5 hover:shadow-md hover:border-navy-200 transition-all group cursor-pointer">
                            <div className="flex items-start justify-between mb-3">
                                <div className="w-10 h-10 bg-navy-100 rounded-xl flex items-center justify-center group-hover:bg-navy-200 transition">
                                    <BookOpen size={18} className="text-navy-600" />
                                </div>
                                <ChevronRight size={16} className="text-text-300 group-hover:text-navy-600 transition mt-1" />
                            </div>
                            <h3 className="font-bold text-navy-900 text-[15px] mb-1 group-hover:text-navy-700">{kb.name}</h3>
                            <p className="text-text-400 text-xs mb-3 line-clamp-2">{kb.description}</p>
                            <div className="flex items-center gap-3 text-[11px] text-text-400">
                                <span className="flex items-center gap-1">
                                    <FileText size={11} /> {kb.documents.length} sumber
                                </span>
                                <span className="flex items-center gap-1">
                                    <MessageSquare size={11} /> {kb.messageCount} pesan
                                </span>
                                <span className="flex items-center gap-1">
                                    <Clock size={11} /> {new Date(kb.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                </span>
                            </div>
                            {/* Doc type badges */}
                            <div className="flex flex-wrap gap-1.5 mt-3">
                                {kb.documents.slice(0, 3).map(d => (
                                    <span key={d.id} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${d.type === 'document' ? 'bg-navy-100 text-navy-700' : 'bg-amber-100 text-amber-700'}`}>
                                        {d.title.length > 20 ? d.title.slice(0, 20) + '…' : d.title}
                                    </span>
                                ))}
                                {kb.documents.length > 3 && (
                                    <span className="text-[10px] px-2 py-0.5 bg-surface-100 text-text-500 rounded-full">+{kb.documents.length - 3}</span>
                                )}
                            </div>
                        </button>
                    ))}
                </div>
            ) : (
                /* ── LIST VIEW ── */
                <div className="card divide-y">
                    {filtered.map(kb => (
                        <button key={kb.id} onClick={() => onSelect(kb)}
                            className="w-full flex items-center gap-4 p-4 text-left hover:bg-surface-50 transition-colors group">
                            <div className="w-10 h-10 bg-navy-100 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-navy-200 transition">
                                <BookOpen size={18} className="text-navy-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-navy-900 text-sm group-hover:text-navy-700 truncate">{kb.name}</h3>
                                <p className="text-text-400 text-xs mt-0.5 truncate">{kb.description}</p>
                            </div>
                            <div className="flex items-center gap-4 text-[11px] text-text-400 shrink-0">
                                <span className="flex items-center gap-1 whitespace-nowrap">
                                    <FileText size={11} /> {kb.documents.length} sumber
                                </span>
                                <span className="flex items-center gap-1 whitespace-nowrap">
                                    <MessageSquare size={11} /> {kb.messageCount} pesan
                                </span>
                                <span className="flex items-center gap-1 whitespace-nowrap">
                                    <Clock size={11} /> {new Date(kb.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                </span>
                            </div>
                            <div className="hidden md:flex flex-wrap gap-1 shrink-0 max-w-[200px]">
                                {kb.documents.slice(0, 2).map(d => (
                                    <span key={d.id} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${d.type === 'document' ? 'bg-navy-100 text-navy-700' : 'bg-amber-100 text-amber-700'}`}>
                                        {d.title.length > 15 ? d.title.slice(0, 15) + '…' : d.title}
                                    </span>
                                ))}
                                {kb.documents.length > 2 && (
                                    <span className="text-[10px] px-2 py-0.5 bg-surface-100 text-text-500 rounded-full">+{kb.documents.length - 2}</span>
                                )}
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
    onCreateDone: (kb: KnowledgeBase) => void
}) {
    const [step, setStep] = useState<1 | 2>(1) // 1=name, 2=select docs
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
        const kb: KnowledgeBase = {
            id: `kb-${Date.now()}`,
            name: name || 'Knowledge Base Baru',
            description: desc || 'Tanpa deskripsi',
            documents: docs,
            created_at: new Date().toISOString(),
            messageCount: 0,
        }
        onCreateDone(kb)
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <button onClick={onBack}
                    className="flex items-center gap-1.5 text-text-400 hover:text-navy-600 text-sm font-medium transition mb-3">
                    <ArrowLeft size={14} /> Kembali
                </button>
                <h1 className="text-2xl font-bold font-display text-navy-900">Buat Knowledge Base Baru</h1>
                <p className="text-text-400 text-sm mt-1">Pilih dokumen dan konten untuk knowledge base baru</p>
            </div>

            {/* Steps indicator */}
            <div className="flex items-center gap-3">
                <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold transition ${step === 1 ? 'bg-navy-600 text-white border-navy-600' : 'bg-surface-50 text-text-500 border-surface-200'}`}>
                    <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">1</span>
                    Detail
                </div>
                <div className="w-8 h-px bg-surface-200" />
                <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold transition ${step === 2 ? 'bg-navy-600 text-white border-navy-600' : 'bg-surface-50 text-text-500 border-surface-200'}`}>
                    <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">2</span>
                    Pilih Sumber
                </div>
            </div>

            {/* Step 1: Name & Description */}
            {step === 1 && (
                <div className="card p-6 max-w-xl space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-navy-900 mb-1.5">Nama Knowledge Base</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)}
                            placeholder="Contoh: SOP Operasional"
                            className="w-full px-4 py-2.5 border rounded-xl focus:ring-navy-600 focus:border-navy-600 text-sm" />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-navy-900 mb-1.5">Deskripsi (opsional)</label>
                        <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3}
                            placeholder="Jelaskan isi knowledge base ini..."
                            className="w-full px-4 py-2.5 border rounded-xl focus:ring-navy-600 focus:border-navy-600 text-sm resize-none" />
                    </div>
                    <button onClick={() => setStep(2)} disabled={!name.trim()}
                        className="btn btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50">
                        Lanjut Pilih Sumber <ChevronRight size={16} />
                    </button>
                </div>
            )}

            {/* Step 2: Select Documents */}
            {step === 2 && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="relative w-80">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-300" size={16} />
                            <input type="text" placeholder="Cari dokumen atau konten..."
                                value={search} onChange={e => setSearch(e.target.value)}
                                className="pl-10 pr-4 py-2.5 border rounded-xl w-full focus:ring-navy-600 focus:border-navy-600 text-sm" />
                        </div>
                        <span className="text-sm text-text-500 font-medium">
                            {selected.size} dipilih
                        </span>
                    </div>

                    {/* Docs list */}
                    <div className="card divide-y max-h-[400px] overflow-y-auto">
                        {filteredDocs.length === 0 ? (
                            <div className="p-8 text-center text-text-400 text-sm">Tidak ada dokumen ditemukan</div>
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
                                            {doc.type === 'document' ? 'Dokumen' : 'Konten'}
                                        </span>
                                        {doc.division && <span>{doc.division}</span>}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3">
                        <button onClick={() => setStep(1)}
                            className="px-4 py-2.5 border border-surface-200 rounded-xl text-sm font-medium text-text-600 hover:bg-surface-50 transition">
                            ← Kembali
                        </button>
                        <button onClick={handleCreate} disabled={selected.size === 0}
                            className="btn btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50">
                            <Sparkles size={16} /> Buat Knowledge Base ({selected.size} sumber)
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
function KBChatView({ kb, onBack, onAddDoc, onRemoveDoc, chatSessions, onSaveSession, onLoadSession, onNewSession }: {
    kb: KnowledgeBase
    onBack: () => void
    onAddDoc: () => void
    onRemoveDoc: (id: string) => void
    chatSessions: ChatSession[]
    onSaveSession: (session: ChatSession) => void
    onLoadSession: (sessionId: string) => void
    onNewSession: () => void
}) {
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [input, setInput] = useState('')
    const [isTyping, setIsTyping] = useState(false)
    const [showSidebar, setShowSidebar] = useState(true)
    const [sidebarTab, setSidebarTab] = useState<'docs' | 'history'>('docs')
    const [showNewSessionModal, setShowNewSessionModal] = useState(false)
    const endRef = useRef<HTMLDivElement>(null)

    const handleConfirmNewSession = () => {
        setMessages([])
        setInput('')
        onNewSession()
        setShowNewSessionModal(false)
    }

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, isTyping])

    const sendMessage = async () => {
        const q = input.trim()
        if (!q || isTyping) return
        setMessages(prev => [...prev, { role: 'user', content: q }])
        setInput('')
        setIsTyping(true)

        // Simulate AI response
        await new Promise(r => setTimeout(r, 1500 + Math.random() * 1500))

        const response = `Berdasarkan **${kb.documents.length} sumber** di knowledge base "${kb.name}":\n\n${q.toLowerCase().includes('sop') ? 'SOP yang dimaksud sudah diatur dalam dokumen terkait. Berikut ringkasannya:\n\n1. **Langkah awal**: Pastikan semua persiapan telah dilakukan sesuai prosedur.\n2. **Pelaksanaan**: Ikuti setiap langkah yang tertulis secara berurutan.\n3. **Dokumentasi**: Catat setiap hasil pekerjaan di formulir yang tersedia.' : 'Informasi yang Anda tanyakan dapat ditemukan di dokumen berikut:\n\n• **' + kb.documents[0]?.title + '** — Menjelaskan dasar-dasar kebijakan.\n' + (kb.documents[1] ? '• **' + kb.documents[1].title + '** — Memberikan detail prosedur pelaksanaan.\n' : '') + '\nPerlu informasi lebih detail dari dokumen tertentu?'}`

        setMessages(prev => [...prev, { role: 'assistant', content: response }])
        setIsTyping(false)
    }

    return (
        <div className="flex h-[calc(100vh-120px)] -m-6 md:-m-8 bg-surface-50 overflow-hidden rounded-xl border border-surface-200">
            {/* Main Chat */}
            <div className="flex-1 flex flex-col min-w-0 bg-white">
                {/* Chat Header */}
                <div className="bg-surface-0 border-b border-surface-200 px-5 py-3 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <button onClick={onBack}
                            className="p-1.5 hover:bg-surface-100 rounded-lg transition text-text-400 hover:text-navy-600 shrink-0">
                            <ArrowLeft size={18} />
                        </button>
                        <div className="w-9 h-9 bg-navy-100 rounded-full flex items-center justify-center shrink-0">
                            <BookOpen size={16} className="text-navy-600" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-bold text-navy-900 text-sm truncate">{kb.name}</h3>
                            <p className="text-[11px] text-text-400">{kb.documents.length} sumber · Powered by AI</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 bg-surface-100 p-1 rounded-xl">
                        <button onClick={() => { setShowSidebar(true); setSidebarTab('docs') }}
                            className={`px-3 py-1.5 rounded-lg transition text-sm font-medium flex items-center gap-1.5 ${showSidebar && sidebarTab === 'docs' ? 'bg-white shadow-sm text-navy-600' : 'text-text-400 hover:text-text-600'}`}>
                            <FileText size={14} /> Sumber
                        </button>
                        <button onClick={() => setShowNewSessionModal(true)}
                            className="p-1.5 rounded-lg transition text-text-400 hover:text-navy-600 hover:bg-white"
                            title="Sesi Baru">
                            <Plus size={16} />
                        </button>
                        <button onClick={() => { setShowSidebar(true); setSidebarTab('history') }}
                            className={`px-3 py-1.5 rounded-lg transition text-sm font-medium flex items-center gap-1.5 ${showSidebar && sidebarTab === 'history' ? 'bg-white shadow-sm text-navy-600' : 'text-text-400 hover:text-text-600'}`}>
                            <MessageSquare size={14} /> Riwayat Chat
                        </button>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
                    {messages.length === 0 && !isTyping && (
                        <div className="text-center py-16 text-text-400">
                            <div className="w-20 h-20 bg-navy-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Sparkles size={36} className="text-navy-400" />
                            </div>
                            <h3 className="font-bold font-display text-navy-900 text-xl mb-2">Chat dengan {kb.name}</h3>
                            <p className="text-sm max-w-md mx-auto">
                                Tanyakan apapun dan AI akan menjawab berdasarkan {kb.documents.length} dokumen yang tersedia.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-lg mx-auto mt-6">
                                {[
                                    `Rangkum isi ${kb.documents[0]?.title || 'dokumen'}`,
                                    'Apa poin-poin penting dari sumber ini?',
                                    'Jelaskan prosedur yang disebutkan',
                                    'Bandingkan informasi antar dokumen'
                                ].map((suggestion, i) => (
                                    <button key={i} onClick={() => setInput(suggestion)}
                                        className="text-left text-xs bg-surface-50 border border-surface-200 hover:border-navy-300 hover:bg-navy-50 p-3 rounded-lg transition text-text-600">
                                        {suggestion}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {messages.map((msg, i) => (
                        <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'assistant' && (
                                <div className="w-8 h-8 bg-navy-100 rounded-full flex items-center justify-center shrink-0 mt-1">
                                    <Bot size={16} className="text-navy-600" />
                                </div>
                            )}
                            <div className={`rounded-2xl px-5 py-3 max-w-[70%] text-sm leading-relaxed ${msg.role === 'user' ? 'bg-navy-600 text-white' : 'bg-surface-100 text-navy-900'}`}>
                                <p className="whitespace-pre-wrap">{msg.content}</p>
                            </div>
                            {msg.role === 'user' && (
                                <div className="w-8 h-8 bg-navy-600 rounded-full flex items-center justify-center shrink-0 mt-1">
                                    <User size={16} className="text-white" />
                                </div>
                            )}
                        </div>
                    ))}

                    {isTyping && (
                        <div className="flex gap-3 justify-start">
                            <div className="w-8 h-8 bg-navy-100 rounded-full flex items-center justify-center shrink-0">
                                <Bot size={16} className="text-navy-600" />
                            </div>
                            <div className="bg-surface-100 rounded-2xl px-5 py-3 flex items-center gap-3">
                                <div className="flex gap-1">
                                    <span className="w-2 h-2 bg-navy-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <span className="w-2 h-2 bg-navy-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <span className="w-2 h-2 bg-navy-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                                <span className="text-sm text-text-500">Mencari jawaban...</span>
                            </div>
                        </div>
                    )}
                    <div ref={endRef} />
                </div>

                {/* Input */}
                <div className="p-4 border-t border-surface-200 shrink-0 bg-surface-0">
                    <div className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-surface-200 focus-within:border-navy-400 focus-within:ring-2 focus-within:ring-navy-100 transition shadow-sm">
                        <input value={input} onChange={e => setInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                            disabled={isTyping} placeholder={`Tanya tentang ${kb.name}...`}
                            className="flex-1 bg-transparent outline-none text-sm placeholder:text-text-300" />
                        <button onClick={sendMessage} disabled={!input.trim() || isTyping}
                            className="bg-navy-600 hover:bg-navy-700 disabled:bg-surface-200 disabled:text-text-300 text-white rounded-lg p-2.5 transition">
                            <Send size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Right Sidebar */}
            {showSidebar && (
                <div className="w-[280px] bg-surface-50 border-l border-surface-200 flex flex-col shrink-0">
                    {sidebarTab === 'docs' ? (
                        <>
                            <div className="p-4 border-b border-surface-200">
                                <h3 className="font-bold text-navy-900 text-sm flex items-center gap-2">
                                    <FileText size={14} className="text-navy-500" /> Sumber Dokumen
                                </h3>
                                <p className="text-[11px] text-text-400 mt-1">{kb.documents.length} dokumen & konten</p>
                            </div>

                            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                                {kb.documents.map(doc => (
                                    <div key={doc.id} className="group flex items-start gap-2.5 p-3 rounded-lg hover:bg-white transition border border-transparent hover:border-surface-200">
                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${doc.type === 'document' ? 'bg-navy-100' : 'bg-amber-100'}`}>
                                            {doc.type === 'document' ? <File size={12} className="text-navy-600" /> : <FileText size={12} className="text-amber-600" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[13px] font-medium text-navy-900 truncate">{doc.title}</p>
                                            <p className="text-[11px] text-text-400 mt-0.5 flex items-center gap-1">
                                                <span className={`px-1 py-0.5 rounded text-[9px] font-semibold ${doc.type === 'document' ? 'bg-navy-100 text-navy-600' : 'bg-amber-100 text-amber-600'}`}>
                                                    {doc.type === 'document' ? 'DOC' : 'CONTENT'}
                                                </span>
                                                {doc.division}
                                            </p>
                                        </div>
                                        <button onClick={() => onRemoveDoc(doc.id)}
                                            className="opacity-0 group-hover:opacity-100 p-1 text-text-300 hover:text-danger flex-shrink-0 transition"
                                            title="Hapus dari KB">
                                            <X size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <div className="p-3 border-t border-surface-200">
                                <button onClick={onAddDoc}
                                    className="w-full py-2.5 px-4 border-2 border-dashed border-surface-300 hover:border-navy-400 text-text-500 hover:text-navy-600 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition">
                                    <Plus size={14} /> Tambah Sumber
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="p-4 border-b border-surface-200 space-y-3">
                                <div className="flex justify-between items-center">
                                    <h3 className="font-bold text-navy-900 text-sm flex items-center gap-2">
                                        <MessageSquare size={14} className="text-navy-500" /> Riwayat Chat
                                    </h3>
                                    <button onClick={() => setShowNewSessionModal(true)} className="text-navy-600 hover:bg-navy-50 p-1.5 rounded-lg transition flex items-center gap-1 px-2" title="New Chat">
                                        <Plus size={14} /> <span className="text-xs font-semibold">New</span>
                                    </button>
                                </div>
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-300" size={14} />
                                    <input type="text" placeholder="Search Chat..."
                                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-surface-200 focus:border-navy-400 focus:ring-1 focus:ring-navy-400 rounded-lg outline-none transition" />
                                </div>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                                {chatSessions.length === 0 ? (
                                    <div className="text-center flex flex-col items-center gap-2 text-xs text-text-400 py-8">
                                        <MessageSquare size={24} className="text-surface-300" />
                                        Belum ada riwayat chat
                                    </div>
                                ) : chatSessions.map(session => (
                                    <button key={session.id} onClick={() => onLoadSession(session.id)}
                                        className="w-full flex items-start flex-col gap-1 p-3 rounded-lg hover:bg-white border border-transparent hover:border-surface-200 transition text-left">
                                        <div className="text-[13px] font-medium text-navy-900 line-clamp-1">{session.title}</div>
                                        <div className="text-[10px] text-text-400">{new Date(session.updatedAt).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'})}</div>
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* New Session Confirmation Modal */}
            {showNewSessionModal && (
                <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-transparent">
                    <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-xl animate-in fade-in zoom-in-95">
                        <div className="p-6">
                            <div className="w-12 h-12 bg-navy-100 rounded-xl flex items-center justify-center mb-4 mx-auto text-navy-600">
                                <Plus size={24} />
                            </div>
                            <h2 className="text-lg font-bold text-navy-900 text-center mb-2">Mulai Sesi Baru?</h2>
                            <p className="text-text-500 text-sm text-center">
                                Anda akan memulai sesi chat baru. Riwayat chat saat ini akan disimpan dalam Riwayat Chat.
                            </p>
                        </div>
                        <div className="bg-surface-50 p-4 border-t border-surface-200 flex gap-3">
                            <button onClick={() => setShowNewSessionModal(false)}
                                className="flex-1 py-2 px-4 border border-surface-200 text-text-600 font-medium rounded-xl hover:bg-white transition text-sm">
                                Batal
                            </button>
                            <button onClick={handleConfirmNewSession}
                                className="flex-1 py-2 px-4 bg-navy-600 text-white font-medium rounded-xl hover:bg-navy-700 transition shadow-sm text-sm">
                                Ya, Mulai Sesi Baru
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

/* ═══════════════════════════════════════════
   VIEW: KB DETAIL
   ═══════════════════════════════════════════ */
function KBDetailView({ kb, onBack, onChat, onAddDoc, onUpload, onRemoveDoc }: {
    kb: KnowledgeBase
    onBack: () => void
    onChat: () => void
    onAddDoc: () => void
    onUpload: () => void
    onRemoveDoc: (id: string) => void
}) {
    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-12">
            {/* Header / Breadcrumb */}
            <div>
                <button onClick={onBack}
                    className="flex items-center gap-1.5 text-text-400 hover:text-navy-600 text-sm font-medium transition mb-4">
                    <ArrowLeft size={14} /> Kembali ke Daftar
                </button>
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <h1 className="text-3xl font-bold font-display text-navy-900">{kb.name}</h1>
                        <p className="text-text-500 mt-2 max-w-2xl">{kb.description}</p>
                    </div>
                    <button onClick={onChat}
                        className="btn btn-primary px-8 py-3 rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition duration-300 flex items-center gap-3">
                        <Sparkles size={20} />
                        <span className="text-lg">Chat dengan AISA</span>
                    </button>
                </div>
            </div>

            {/* Quick Info Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="card p-4 bg-navy-50/50 border-navy-100 flex items-center gap-4">
                    <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-navy-600">
                        <FileText size={20} />
                    </div>
                    <div>
                        <p className="text-[10px] uppercase tracking-wider font-bold text-text-400">Total Dokumen</p>
                        <p className="text-xl font-bold text-navy-900">{kb.documents.filter(d => d.type === 'document').length}</p>
                    </div>
                </div>
                <div className="card p-4 bg-amber-50/50 border-amber-100 flex items-center gap-4">
                    <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-amber-600">
                        <BookOpen size={20} />
                    </div>
                    <div>
                        <p className="text-[10px] uppercase tracking-wider font-bold text-text-400">Jumlah Sumber</p>
                        <p className="text-xl font-bold text-navy-900">{kb.documents.length}</p>
                    </div>
                </div>
                <div className="card p-4 bg-emerald-50/50 border-emerald-100 flex items-center gap-4">
                    <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-emerald-600">
                        <Clock size={20} />
                    </div>
                    <div>
                        <p className="text-[10px] uppercase tracking-wider font-bold text-text-400">Terakhir Update</p>
                        <p className="text-sm font-bold text-navy-900">{new Date(kb.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</p>
                    </div>
                </div>
                <div className="card p-4 bg-indigo-50/50 border-indigo-100 flex items-center gap-4">
                    <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-indigo-600">
                        <User size={20} />
                    </div>
                    <div>
                        <p className="text-[10px] uppercase tracking-wider font-bold text-text-400">Owner / Admin</p>
                        <p className="text-sm font-bold text-navy-900 truncate">Super Admin</p>
                    </div>
                </div>
            </div>

            {/* Content Section */}
            <div className="grid grid-cols-1 lg:grid-cols-1 gap-8">
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-navy-900 text-lg flex items-center gap-2">
                            <FolderOpen size={20} className="text-navy-500" />
                            Dokumen dalam Knowledge Base
                        </h3>
                        <div className="flex gap-2">
                            <button onClick={onUpload} className="btn bg-white border border-surface-200 text-text-600 px-4 py-2 text-sm hover:bg-surface-50">
                                <FileText size={16} /> Hubungkan Dokumen
                            </button>
                            <button onClick={onAddDoc} className="btn btn-primary px-4 py-2 text-sm">
                                <Plus size={16} /> Hubungkan Konten
                            </button>
                        </div>
                    </div>

                    <div className="card divide-y overflow-hidden">
                        {kb.documents.length === 0 ? (
                            <div className="p-12 text-center text-text-400">
                                <FolderOpen size={48} className="mx-auto mb-3 opacity-20" />
                                <p>Belum ada dokumen yang terhubung ke KB ini.</p>
                            </div>
                        ) : kb.documents.map((doc, idx) => (
                            <div key={doc.id} className="flex items-center gap-4 p-4 hover:bg-surface-50 transition group">
                                <span className="text-text-300 font-mono text-xs w-4">{idx + 1}.</span>
                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${doc.type === 'document' ? 'bg-navy-100' : 'bg-amber-100'}`}>
                                    <FileText size={16} className={doc.type === 'document' ? 'text-navy-600' : 'text-amber-600'} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-navy-900 text-sm truncate">{doc.title}</p>
                                    <p className="text-[11px] text-text-400 mt-0.5">{doc.division || 'Umum'} · {doc.type === 'document' ? 'PDF/Doc' : 'Artikel'}</p>
                                </div>
                                <button onClick={() => onRemoveDoc(doc.id)}
                                    className="opacity-0 group-hover:opacity-100 p-2 text-text-300 hover:text-danger hover:bg-danger-bg rounded-lg transition">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

/* ═══════════════════════════════════════════
   VIEW: ADD DOCS (Replaces old AddDocsModal)
   ═══════════════════════════════════════════ */
function AddDocsView({ allDocs, existingIds, onBack, onAdd }: {
    allDocs: DocItem[]
    existingIds: Set<string>
    onBack: () => void
    onAdd: (docs: DocItem[]) => void
}) {
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
                <button onClick={onBack}
                    className="flex items-center gap-1.5 text-text-400 hover:text-navy-600 text-sm font-medium transition mb-3">
                    <ArrowLeft size={14} /> Kembali ke Chat
                </button>
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold font-display text-navy-900 flex items-center gap-2">
                            <Plus size={22} className="text-navy-600" /> Tambah Sumber
                        </h1>
                        <p className="text-text-400 text-sm mt-1">Pilih dokumen atau konten untuk ditambahkan ke Knowledge Base ini</p>
                    </div>
                    <button onClick={() => { onAdd(allDocs.filter(d => selected.has(d.id))); onBack() }}
                        disabled={selected.size === 0}
                        className="btn btn-primary flex items-center gap-2 disabled:opacity-50 px-6 py-2.5">
                        <Plus size={16} /> Tambah {selected.size > 0 ? `(${selected.size})` : ''}
                    </button>
                </div>
            </div>

            <div className="card max-w-4xl mx-auto flex flex-col h-[calc(100vh-280px)] overflow-hidden">
                <div className="p-5 border-b border-surface-200 shrink-0">
                    <div className="relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-300" size={16} />
                        <input type="text" placeholder="Cari dokumen..."
                            value={search} onChange={e => setSearch(e.target.value)}
                            className="pl-10 pr-4 py-3 border border-surface-200 rounded-xl w-full text-[15px] focus:ring-navy-600 focus:border-navy-600 bg-surface-50 transition-all outline-none" />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-surface-100 p-2 scrollbar-thin">
                    {filtered.length === 0 ? (
                        <div className="p-12 text-center text-text-400 text-sm flex flex-col items-center justify-center h-full">
                            <FileText size={48} className="text-surface-300 mb-4 opacity-50" />
                            <p>Semua dokumen tersedia sudah ditambahkan ke Knowledge Base ini</p>
                        </div>
                    ) : filtered.map(doc => (
                        <button key={doc.id} onClick={() => toggleDoc(doc.id)}
                            className={`w-full flex items-center gap-4 p-4 text-left transition-all rounded-xl border ${selected.has(doc.id) ? 'bg-navy-50/50 border-navy-200 shadow-sm' : 'border-transparent hover:bg-surface-50'}`}>
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition shrink-0 ${selected.has(doc.id) ? 'bg-navy-600 border-navy-600' : 'border-surface-300 bg-white'}`}>
                                {selected.has(doc.id) && <Check size={12} className="text-white" strokeWidth={3} />}
                            </div>
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${doc.type === 'document' ? 'bg-navy-100' : 'bg-amber-100'}`}>
                                {doc.type === 'document' ? <File size={16} className="text-navy-600" /> : <FileText size={16} className="text-amber-600" />}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className={`font-semibold text-sm truncate transition ${selected.has(doc.id) ? 'text-navy-900' : 'text-text-700'}`}>{doc.title}</div>
                                <div className="text-[12px] text-text-400 mt-0.5">{doc.division} · <span className="font-medium">{doc.type === 'document' ? 'Dokumen' : 'Konten'}</span></div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}

/* ═══════════════════════════════════════════
   MAIN PAGE CONTROLLER
   ═══════════════════════════════════════════ */
type View = 'list' | 'create' | 'detail' | 'chat' | 'edit' | 'add-docs'

export default function ContentsPage() {
    const { organization, role, division } = useCurrentUser()
    const [view, setView] = useState<View>('list')
    const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>(MOCK_KBS)
    const [activeKB, setActiveKB] = useState<KnowledgeBase | null>(null)
    const [allDocs, setAllDocs] = useState<DocItem[]>([])
    const [loading, setLoading] = useState(true)
    const [editKB, setEditKB] = useState<KnowledgeBase | null>(null)
    const [chatSessions, setChatSessions] = useState<ChatSession[]>([])

    // Load real documents & contents
    useEffect(() => {
        async function load() {
            if (!organization?.id) return
            try {
                const isAdmin = role === 'SUPER_ADMIN' || role === 'MAINTAINER'
                const divFilter = !isAdmin ? division?.id : undefined
                const res = await getContentsAction(organization.id, divFilter)
                const contents: DocItem[] = res.success
                    ? (res.data || []).map((c: any) => ({
                        id: c.id,
                        title: c.title,
                        type: 'content' as const,
                        division: c.division?.name || '',
                        author: c.author_name,
                        status: c.status,
                    }))
                    : []

                // Also fetch documents
                const docRes = await fetch(`/api/documents?org_id=${organization.id}${divFilter ? `&division_id=${divFilter}` : ''}`)
                let documents: DocItem[] = []
                if (docRes.ok) {
                    const docData = await docRes.json()
                    documents = (docData.documents || []).map((d: any) => ({
                        id: d.id,
                        title: d.file_name || d.title || 'Untitled',
                        type: 'document' as const,
                        division: d.division?.name || '',
                        status: d.status,
                    }))
                }

                setAllDocs([...documents, ...contents])
            } catch { /* ignore */ }
            setLoading(false)
        }
        load()
    }, [organization?.id, division?.id, role])

    // Handlers
    const handleSelectKB = (kb: KnowledgeBase) => {
        setActiveKB(kb)
        setView('detail')
    }

    const handleCreateKB = (kb: KnowledgeBase) => {
        setKnowledgeBases(prev => [kb, ...prev])
        setActiveKB(kb)
        setView('detail')
    }

    const handleAddDocs = (docs: DocItem[]) => {
        if (!activeKB) return
        const updated = { ...activeKB, documents: [...activeKB.documents, ...docs] }
        setActiveKB(updated)
        setKnowledgeBases(prev => prev.map(kb => kb.id === updated.id ? updated : kb))
    }

    const handleRemoveDoc = (docId: string) => {
        if (!activeKB) return
        if (activeKB.documents.length <= 1) {
            alert('Knowledge base harus memiliki minimal 1 sumber')
            return
        }
        const updated = { ...activeKB, documents: activeKB.documents.filter(d => d.id !== docId) }
        setActiveKB(updated)
        setKnowledgeBases(prev => prev.map(kb => kb.id === updated.id ? updated : kb))
    }

    // Placeholder for chat session handlers
    const handleSaveSession = (session: ChatSession) => {
        setChatSessions(prev => {
            const existingIndex = prev.findIndex(s => s.id === session.id);
            if (existingIndex > -1) {
                const updatedSessions = [...prev];
                updatedSessions[existingIndex] = session;
                return updatedSessions;
            }
            return [...prev, session];
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 size={24} className="animate-spin text-navy-400" />
            </div>
        )
    }

    return (
        <>
            {view === 'list' && (
                <KBListView
                    knowledgeBases={knowledgeBases}
                    onSelect={handleSelectKB}
                    onCreate={() => setView('create')}
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
                />
            )}
            {view === 'chat' && activeKB && (
                <KBChatView
                    kb={activeKB}
                    onBack={() => setView('detail')}
                    onAddDoc={() => setView('add-docs')}
                    onRemoveDoc={handleRemoveDoc}
                    chatSessions={chatSessions}
                    onSaveSession={handleSaveSession}
                    onLoadSession={() => { }}
                    onNewSession={() => { }}
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
        </>
    )
}
