'use client'

import { useState, useEffect } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useTranslation } from '@/hooks/useTranslation'
import { getQuizCompletionStatsAction } from '@/lib/actions/quiz.actions'
import { RoleGuard } from '@/components/shared/RoleGuard'
import { CheckCircle, BarChart3, Users, Search, BookOpen } from 'lucide-react'

export default function TrackersPage() {
    const { organization } = useCurrentUser()
    const { t } = useTranslation()
    const [stats, setStats] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')

    useEffect(() => {
        if (organization?.id) {
            getQuizCompletionStatsAction(organization.id).then(res => {
                if (res.success) {
                    setStats(res.data || [])
                }
                setLoading(false)
            })
        }
    }, [organization?.id])

    const filteredStats = stats.filter(s => s.title.toLowerCase().includes(searchTerm.toLowerCase()))

    return (
        <RoleGuard allowedRoles={['SUPER_ADMIN', 'GROUP_ADMIN', 'SUPERVISOR', 'MAINTAINER']}>
            <div className="space-y-6">
                <div className="flex justify-between items-center mb-2">
                    <h1 className="text-2xl font-bold font-display text-navy-900 flex items-center gap-2">
                        <CheckCircle size={24} className="text-navy-600" /> {t('trackers.title')}
                    </h1>
                </div>

                <div className="card-sm border p-6 mb-6">
                    <p className="text-text-500">
                        {t('trackers.desc_quiz')}
                    </p>
                </div>

                <div className="card">
                    <div className="p-4 border-b flex justify-between items-center">
                        <div className="relative w-80">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-300" size={18} />
                            <input
                                type="text"
                                placeholder={t('trackers.search_placeholder_quiz')}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 pr-4 py-2 border rounded-md w-full focus:ring-navy-600 focus:border-navy-600 outline-none"
                            />
                        </div>
                    </div>

                    <div className="p-6">
                        {loading ? (
                            <div className="py-12 text-center text-text-500 animate-pulse">{t('trackers.loading')}</div>
                        ) : filteredStats.length === 0 ? (
                            <div className="py-12 text-center">
                                <BookOpen size={48} className="mx-auto text-text-300 mb-4" />
                                <h3 className="text-lg font-bold font-display text-text-700">{t('trackers.empty_title')}</h3>
                                <p className="text-text-500 mt-1">{t('trackers.empty_desc_quiz')}</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredStats.map((item) => (
                                    <div key={item.id} className="border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden bg-white">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <span className="text-xs font-semibold uppercase tracking-wider bg-navy-light text-navy-700 px-2 py-1 rounded">
                                                    {item.category}
                                                </span>
                                            </div>
                                        </div>

                                        <h3 className="font-bold font-display text-navy-900 text-lg leading-tight mb-2 line-clamp-2" title={item.title}>
                                            {item.title}
                                        </h3>

                                        <p className="text-xs text-text-500 mb-6">
                                            {t('trackers.published')} {new Date(item.published_at).toLocaleDateString(t('common.locale'))}
                                        </p>

                                        <div className="space-y-3">
                                            <div className="flex justify-between items-end">
                                                <div className="flex items-center gap-2 text-sm text-text-500">
                                                    <Users size={16} className="text-navy-600" />
                                                    <span className="font-semibold text-navy-900">{item.readCount}</span>
                                                    / {item.totalTarget} {t('trackers.quiz_participants')}
                                                </div>
                                                <div className="text-2xl font-black text-navy-600">
                                                    {item.percent}%
                                                </div>
                                            </div>

                                            {/* Progress Bar */}
                                            <div className="w-full bg-surface-100 rounded-full h-2.5 overflow-hidden">
                                                <div
                                                    className={`h-2.5 rounded-full transition-all duration-1000 ${item.percent >= 90 ? 'bg-green-500' :
                                                        item.percent >= 50 ? 'bg-navy-600' : 'bg-orange-500'
                                                        }`}
                                                    style={{ width: `${item.percent}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </RoleGuard>
    )
}
