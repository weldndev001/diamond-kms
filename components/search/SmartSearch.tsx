'use client'

import { useState } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { searchDocumentsAction } from '@/lib/actions/document.actions'
import { Search, Bot, FileText, Hash, ArrowRight, Sparkles, Tag, HardDrive } from 'lucide-react'
import Link from 'next/link'

export default function SmartSearch() {
    const { organization, role, user, division } = useCurrentUser()
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [searched, setSearched] = useState(false)

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!query.trim() || !organization?.id) return
        setLoading(true)
        setSearched(true)
        const res = await searchDocumentsAction(
            organization.id,
            query.trim(),
            {
                userId: user?.id || '',
                userRole: role || 'STAFF',
                divisionId: division?.id || '',
                crossDivisionEnabled: organization.cross_division_query_enabled || false
            }
        )
        if (res.success) setResults(res.data || [])
        setLoading(false)
    }

    const highlightMatch = (text: string, q: string) => {
        if (!q.trim()) return text
        const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
        return text.replace(regex, '<mark class="bg-amber-200 text-amber-900 rounded px-0.5">$1</mark>')
    }

    return (
        <div className="space-y-6">
            {/* Hero Search */}
            <div className="bg-gradient-to-br from-navy-900 via-navy-800 to-navy-700 rounded-2xl p-8 md:p-12 text-center text-white relative overflow-hidden">
                <div className="absolute inset-0 opacity-10" style={{
                    backgroundImage: 'radial-gradient(circle at 25% 50%, rgba(255,255,255,0.3) 0%, transparent 50%), radial-gradient(circle at 75% 50%, rgba(245,158,11,0.2) 0%, transparent 50%)'
                }} />
                <div className="relative z-10">
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <Bot size={28} className="text-amber-400" />
                        <h2 className="text-3xl font-bold font-display">Smart Search</h2>
                    </div>
                    <p className="text-navy-200 max-w-lg mx-auto mb-8">
                        Search across all processed documents and knowledge base in your organization.
                    </p>

                    <form onSubmit={handleSearch} className="max-w-2xl mx-auto relative">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-text-500" size={20} />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Ask anything..."
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
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${doc.type === 'content' ? 'bg-indigo-100 text-indigo-600' : 'bg-navy-100 text-navy-600'
                                            }`}>
                                            <FileText size={20} />
                                        </div>
                                        <div>
                                            <Link
                                                href={doc.type === 'content' ? `/dashboard/contents/${doc.id}` : `/dashboard/documents/${doc.id}`}
                                                className="font-bold font-display text-navy-900 text-lg hover:text-navy-600 hover:underline"
                                            >
                                                {doc.title || doc.ai_title || doc.file_name}
                                            </Link>
                                            <div className="flex items-center gap-2 mt-1 text-xs text-text-500">
                                                <span className="capitalize px-1.5 py-0.5 bg-surface-100 rounded text-[10px] font-bold tracking-wider">
                                                    {doc.type}
                                                </span>
                                                <span>&bull;</span>
                                                <span>{doc.divisionName || doc.division?.name || 'General'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <Link
                                        href={doc.type === 'content' ? `/dashboard/contents/${doc.id}` : `/dashboard/documents/${doc.id}`}
                                        className="btn btn-ghost text-sm shrink-0"
                                    >
                                        Open <ArrowRight size={14} />
                                    </Link>
                                </div>

                                {/* Search Excerpt */}
                                {doc.excerpt && (
                                    <p className="text-sm text-text-600 leading-relaxed mb-3 line-clamp-3">
                                        {doc.excerpt}
                                    </p>
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
        </div>
    )
}
