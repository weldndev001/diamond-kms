'use client'

import { useState } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { searchDocumentsAction } from '@/lib/actions/document.actions'
import { Search, Bot, FileText, Hash, ArrowRight, Sparkles, Tag, HardDrive } from 'lucide-react'
import Link from 'next/link'

export default function DocumentSearchPage() {
    const { organization } = useCurrentUser()
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [searched, setSearched] = useState(false)

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!query.trim() || !organization?.id) return
        setLoading(true)
        setSearched(true)
        const res = await searchDocumentsAction(organization.id, query.trim())
        if (res.success) setResults(res.data || [])
        setLoading(false)
    }

    const highlightMatch = (text: string, q: string) => {
        if (!q.trim()) return text
        const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
        return text.replace(regex, '<mark class="bg-amber-200 text-amber-900 rounded px-0.5">$1</mark>')
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Hero Search */}
            <div className="bg-gradient-to-br from-navy-900 via-navy-800 to-navy-700 rounded-2xl p-8 md:p-12 text-center text-white relative overflow-hidden">
                <div className="absolute inset-0 opacity-10" style={{
                    backgroundImage: 'radial-gradient(circle at 25% 50%, rgba(255,255,255,0.3) 0%, transparent 50%), radial-gradient(circle at 75% 50%, rgba(245,158,11,0.2) 0%, transparent 50%)'
                }} />
                <div className="relative z-10">
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <Bot size={28} className="text-amber-400" />
                        <h1 className="text-3xl font-bold font-display">Smart Document Search</h1>
                    </div>
                    <p className="text-navy-200 max-w-lg mx-auto mb-8">
                        Search across all processed documents in your organization. AI-powered chunk-level search for instant answers.
                    </p>

                    <form onSubmit={handleSearch} className="max-w-2xl mx-auto relative">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-text-500" size={20} />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Ask anything... e.g. 'employee leave policy', 'data backup procedure'"
                            className="w-full pl-14 pr-32 py-4 bg-white text-navy-900 rounded-xl shadow-lg text-base focus:ring-4 focus:ring-amber-400/30 focus:outline-none border-0 placeholder:text-text-300"
                        />
                        <button
                            type="submit"
                            disabled={loading || !query.trim()}
                            className="absolute right-2 top-1/2 -translate-y-1/2 btn btn-amber disabled:opacity-50"
                        >
                            {loading ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Searching...
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <Sparkles size={16} /> Search
                                </div>
                            )}
                        </button>
                    </form>
                </div>
            </div>

            {/* Results */}
            {searched && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold font-display text-navy-900">
                            {loading ? 'Searching...' : `${results.length} result(s) found`}
                        </h2>
                        {query && !loading && (
                            <p className="text-sm text-text-500">
                                Results for: <span className="font-medium text-navy-700">"{query}"</span>
                            </p>
                        )}
                    </div>

                    {loading ? (
                        <div className="space-y-4">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="card p-6 animate-pulse">
                                    <div className="h-5 bg-surface-200 rounded w-2/3 mb-3" />
                                    <div className="h-4 bg-surface-100 rounded w-full mb-2" />
                                    <div className="h-4 bg-surface-100 rounded w-3/4" />
                                </div>
                            ))}
                        </div>
                    ) : results.length === 0 ? (
                        <div className="card p-12 text-center">
                            <Search size={40} className="mx-auto text-text-300 mb-3" />
                            <h3 className="font-display font-bold text-navy-900 text-lg mb-1">No results found</h3>
                            <p className="text-text-500 max-w-sm mx-auto">
                                Try different keywords or upload more documents to expand the search index.
                            </p>
                        </div>
                    ) : (
                        results.map((doc) => (
                            <div key={doc.id} className="card p-6 hover:border-navy-400 transition-colors">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-start gap-3">
                                        <div className="w-10 h-10 bg-navy-100 text-navy-600 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                                            <FileText size={20} />
                                        </div>
                                        <div>
                                            <Link href={`/dashboard/documents/${doc.id}`} className="font-bold font-display text-navy-900 text-lg hover:text-navy-600 hover:underline">
                                                {doc.ai_title || doc.file_name}
                                            </Link>
                                            <div className="flex items-center gap-2 mt-1 text-xs text-text-500">
                                                <span>{doc.file_name}</span>
                                                <span>&bull;</span>
                                                <span>{doc.division?.name || 'General'}</span>
                                                {doc.file_size && (
                                                    <>
                                                        <span>&bull;</span>
                                                        <span className="flex items-center gap-0.5">
                                                            <HardDrive size={10} />
                                                            {doc.file_size >= 1048576
                                                                ? `${(doc.file_size / 1048576).toFixed(1)} MB`
                                                                : `${Math.round(doc.file_size / 1024)} KB`
                                                            }
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <Link href={`/dashboard/documents/${doc.id}`} className="btn btn-ghost text-sm shrink-0">
                                        Open <ArrowRight size={14} />
                                    </Link>
                                </div>

                                {/* AI Summary */}
                                {doc.ai_summary && (
                                    <p className="text-sm text-text-600 leading-relaxed mb-3 line-clamp-2">
                                        {doc.ai_summary}
                                    </p>
                                )}

                                {/* AI Tags */}
                                {doc.ai_tags && doc.ai_tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mb-3">
                                        {(Array.isArray(doc.ai_tags) ? doc.ai_tags : []).slice(0, 6).map((tag: string, idx: number) => (
                                            <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 bg-navy-50 text-navy-700 text-[11px] font-medium rounded-full border border-navy-200">
                                                <Tag size={10} />
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Matching chunks */}
                                {doc.chunks?.length > 0 && (
                                    <div className="space-y-2 mt-4">
                                        <p className="text-xs font-semibold uppercase text-text-300 tracking-wider flex items-center gap-1">
                                            <Hash size={12} /> Matching Sections
                                        </p>
                                        {doc.chunks.map((chunk: any) => (
                                            <div key={chunk.id} className="bg-surface-50 border border-surface-200 rounded-md p-3">
                                                <p
                                                    className="text-sm text-text-700 leading-relaxed line-clamp-3"
                                                    dangerouslySetInnerHTML={{ __html: highlightMatch(chunk.content, query) }}
                                                />
                                                {chunk.page_number && (
                                                    <span className="text-[10px] text-text-300 mt-1 block">Page {chunk.page_number} &bull; Chunk #{chunk.chunk_index + 1}</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Initial state */}
            {!searched && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div className="card p-5 text-center">
                        <div className="w-12 h-12 bg-navy-100 text-navy-600 rounded-xl flex items-center justify-center mx-auto mb-3">
                            <FileText size={24} />
                        </div>
                        <h3 className="font-bold font-display text-navy-900 mb-1">Upload Documents</h3>
                        <p className="text-sm text-text-500">Upload PDF, Word, and text files. AI extracts content automatically.</p>
                    </div>
                    <div className="card p-5 text-center">
                        <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center mx-auto mb-3">
                            <Bot size={24} />
                        </div>
                        <h3 className="font-bold font-display text-navy-900 mb-1">AI Processing</h3>
                        <p className="text-sm text-text-500">Documents are chunked, summarized, and tagged by AI for search.</p>
                    </div>
                    <div className="card p-5 text-center">
                        <div className="w-12 h-12 bg-success-bg text-success rounded-xl flex items-center justify-center mx-auto mb-3">
                            <Search size={24} />
                        </div>
                        <h3 className="font-bold font-display text-navy-900 mb-1">Smart Search</h3>
                        <p className="text-sm text-text-500">Find exact passages across entire document library instantly.</p>
                    </div>
                </div>
            )}
        </div>
    )
}
