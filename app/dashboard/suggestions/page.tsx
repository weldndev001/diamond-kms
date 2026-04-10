'use client'

import { useEffect, useState } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useTranslation } from '@/hooks/useTranslation'
import { getSuggestionsAction, reviewSuggestionAction } from '@/lib/actions/suggestion.actions'
import { CheckCircle, XCircle, Search, Eye, MessageSquareWarning } from 'lucide-react'
import Link from 'next/link'
import { RoleGuard } from '@/components/shared/RoleGuard'

export default function SuggestionsPage() {
    const { organization, user } = useCurrentUser()
    const { t } = useTranslation()
    const [suggestions, setSuggestions] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [processingId, setProcessingId] = useState<string | null>(null)

    const loadData = async () => {
        if (!organization?.id) return
        const res = await getSuggestionsAction(organization.id, 'PENDING')
        if (res.success) {
            setSuggestions(res.data || [])
        }
        setLoading(false)
    }

    useEffect(() => {
        loadData()
    }, [organization?.id])

    const handleReview = async (id: string, action: 'ACCEPTED' | 'REJECTED') => {
        if (!user || !confirm(t('suggestions.confirm_review').replace('{action}', action))) return
        setProcessingId(id)

        const res = await reviewSuggestionAction(id, user.id, action)
        if (res.success) {
            loadData()
        } else {
            alert(res.error || t('suggestions.error_review'))
        }
        setProcessingId(null)
    }

    const filteredSuggestions = suggestions.filter(s =>
        s.content?.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.suggestor_name.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <RoleGuard allowedRoles={['SUPER_ADMIN', 'GROUP_ADMIN', 'SUPERVISOR', 'MAINTAINER']}>
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-bold font-display text-navy-900 flex items-center gap-2">
                        <MessageSquareWarning size={24} className="text-orange-500" /> {t('suggestions.title')}
                    </h1>
                </div>

                <div className="card">
                    <div className="p-4 border-b flex justify-between items-center bg-surface-50">
                        <div className="relative w-72 bg-white rounded-md">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-300" size={18} />
                            <input
                                type="text"
                                placeholder={t('suggestions.search_placeholder')}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 pr-4 py-2 border rounded-md w-full focus:ring-navy-600 focus:border-navy-600 shadow-sm"
                            />
                        </div>
                        <div className="text-sm font-medium text-text-500 bg-white px-3 py-1.5 rounded border shadow-sm">
                            {t('suggestions.pending_count').replace('{count}', suggestions.length.toString())}
                        </div>
                    </div>

                    <div className="divide-y">
                        {loading ? (
                            <div className="p-8 text-center text-text-500 animate-pulse">{t('suggestions.loading')}</div>
                        ) : filteredSuggestions.length === 0 ? (
                            <div className="p-12 text-center text-text-500">
                                <CheckCircle size={40} className="mx-auto text-green-300 mb-3" />
                                {t('suggestions.empty_title')}
                            </div>
                        ) : (
                            filteredSuggestions.map((s) => (
                                <div key={s.id} className="p-6 hover:bg-surface-50 transition-colors">
                                    <div className="flex justify-between items-start gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1 text-sm text-text-500">
                                                <span className="font-bold font-display text-text-700">{s.suggestor_name}</span> {t('suggestions.suggested_by')}
                                            </div>
                                            <Link href={`/dashboard/knowledge-base/${s.content_id}`} target="_blank" className="text-lg font-bold font-display text-navy-600 hover:underline flex items-center gap-2 mb-3">
                                                {s.content?.title || t('suggestions.unknown_article')} <Eye size={16} />
                                            </Link>

                                            <div className="bg-orange-50/50 border border-orange-100 p-4 rounded-lg relative">
                                                <div className="absolute top-2 left-2 text-orange-200">"</div>
                                                <p className="text-text-700 italic px-4 relative z-10 whitespace-pre-wrap">{s.suggestion_text}</p>
                                            </div>

                                            <div className="mt-4 text-xs font-medium text-text-300">
                                                {t('suggestions.submitted_on')} {new Date(s.created_at).toLocaleString(t('common.locale'))}
                                                {s.content?.group?.name ? ` • ${t('suggestions.group')} ${s.content.group.name}` : ''}
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-2 shrink-0">
                                            <button
                                                onClick={() => handleReview(s.id, 'ACCEPTED')}
                                                disabled={processingId === s.id}
                                                className="px-4 py-2 text-sm text-white bg-green-600 hover:bg-green-700 rounded shadow-sm transition font-medium flex items-center gap-2 justify-center"
                                            >
                                                <CheckCircle size={16} /> {t('suggestions.mark_accepted')}
                                            </button>
                                            <button
                                                onClick={() => handleReview(s.id, 'REJECTED')}
                                                disabled={processingId === s.id}
                                                className="px-4 py-2 text-sm text-danger bg-danger-bg border border-red-200 hover:bg-danger-bg rounded transition font-medium flex items-center gap-2 justify-center"
                                            >
                                                <XCircle size={16} /> {t('suggestions.mark_rejected')}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </RoleGuard>
    )
}
