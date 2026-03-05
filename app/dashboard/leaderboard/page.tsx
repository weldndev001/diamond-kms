'use client'

import { useState, useEffect } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { getLeaderboardAction } from '@/lib/actions/leaderboard.actions'
import { Trophy, Medal, Award, TrendingUp, Sparkles } from 'lucide-react'

export default function LeaderboardPage() {
    const { organization, user, role, division } = useCurrentUser()
    const [leaders, setLeaders] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const isStaff = role === 'STAFF'

    useEffect(() => {
        if (organization?.id) {
            // Staff sees division leaderboard, others see org-wide
            const divFilter = isStaff ? division?.id : undefined
            getLeaderboardAction(organization.id, 20, divFilter).then(res => {
                if (res.success) {
                    setLeaders(res.data || [])
                }
                setLoading(false)
            })
        }
    }, [organization?.id, division?.id])

    // Render podium icons for top 3
    const renderRankIcon = (index: number) => {
        switch (index) {
            case 0: return <Trophy className="text-amber-400 drop-shadow-sm" size={28} />
            case 1: return <Medal className="text-text-300 drop-shadow-sm" size={26} />
            case 2: return <Medal className="text-amber-700 drop-shadow-sm" size={24} />
            default: return <div className="w-8 h-8 rounded-full bg-surface-100 flex items-center justify-center text-sm font-bold font-display text-text-500 border border-surface-200">{index + 1}</div>
        }
    }

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-12">
            <div className="bg-gradient-to-r from-blue-700 to-indigo-800 rounded-2xl p-8 md:p-12 text-white shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                    <Trophy size={160} />
                </div>

                <div className="relative z-10 max-w-2xl">
                    <div className="flex items-center gap-3 text-blue-200 mb-2 font-medium tracking-wider uppercase text-sm">
                        <Sparkles size={16} />
                        Gamification & Rewards
                    </div>
                    <h1 className="text-4xl md:text-5xl font-extrabold mb-4 tracking-tight">
                        {isStaff ? 'Pemahaman Pegawai Divisi' : 'Pemahaman Pegawai Organisasi'}
                    </h1>
                    <p className="text-blue-100 text-lg leading-relaxed opacity-90">
                        Compete with your peers by completing mandatory readings and scoring high on quizzes to showcase your expertise. Top learners shape the future of our knowledge base!
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Stats & Motivation */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-surface-200 text-center">
                        <div className="w-16 h-16 bg-navy-100 text-navy-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <TrendingUp size={32} />
                        </div>
                        <h3 className="font-bold font-display text-navy-900 text-xl mb-2">How to earn points?</h3>
                        <ul className="text-sm text-text-500 space-y-3 text-left w-full mx-auto p-4 bg-surface-50 rounded-lg">
                            <li className="flex gap-2">
                                <span className="text-success font-bold font-display">+50</span>
                                <span>Acknowledge Mandatory Documents</span>
                            </li>
                            <li className="flex gap-2">
                                <span className="text-navy-600 font-bold font-display">+10</span>
                                <span>Per 10% Score in Academy Quizzes</span>
                            </li>
                            <li className="flex gap-2 opacity-50">
                                <span className="text-purple-500 font-bold font-display">+100</span>
                                <span>Write Approved Article (Coming Soon)</span>
                            </li>
                        </ul>
                    </div>

                    {/* User's own Rank Snippet */}
                    {!loading && user && (
                        <div className="bg-navy-900 p-6 rounded-xl shadow-sm border border-slate-700 text-white relative overflow-hidden">
                            <h3 className="text-text-300 font-medium mb-1">Your Standing</h3>
                            <div className="flex items-end gap-3 mt-2">
                                <div className="text-4xl font-black">
                                    {leaders.find(l => l.id === user.id)?.points || 0}
                                </div>
                                <div className="text-text-300 mb-1">PTS</div>
                            </div>
                            <p className="text-sm text-text-300 mt-4">Keep learning to climb up the ranks!</p>
                            <Award className="absolute -bottom-4 -right-4 text-text-700 opacity-50" size={100} />
                        </div>
                    )}
                </div>

                {/* Right Column: The Leaderboard */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-xl shadow-sm border border-surface-200 overflow-hidden">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-surface-50">
                            <h2 className="font-bold font-display text-navy-900 text-lg flex items-center gap-2">
                                <Trophy size={20} className="text-amber-500" />
                                Top Performers
                            </h2>
                            <div className="text-sm font-medium text-text-500 bg-white px-3 py-1 rounded-full border shadow-sm">
                                All-Time
                            </div>
                        </div>

                        {loading ? (
                            <div className="p-12 text-center text-text-500 animate-pulse">Calculating rankings...</div>
                        ) : leaders.length === 0 ? (
                            <div className="p-12 text-center">
                                <div className="w-16 h-16 bg-surface-100 text-text-300 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Sparkles size={32} />
                                </div>
                                <h3 className="font-bold font-display text-text-700 mb-1">No points recorded yet!</h3>
                                <p className="text-text-500 text-sm">Be the first to claim the #1 spot by taking a quiz.</p>
                            </div>
                        ) : (
                            <ul className="divide-y divide-slate-100">
                                {leaders.map((leader, index) => {
                                    const isMe = user?.id === leader.id
                                    return (
                                        <li
                                            key={leader.id}
                                            className={`p-4 flex items-center gap-4 transition-colors ${isMe ? 'bg-navy-50/50 relative' : 'hover:bg-surface-50'
                                                }`}
                                        >
                                            {isMe && <div className="absolute left-0 top-0 bottom-0 w-1 bg-navy-600" />}

                                            <div className="w-12 flex justify-center flex-shrink-0">
                                                {renderRankIcon(index)}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className={`text-sm font-bold font-display truncate ${isMe ? 'text-navy-700' : 'text-navy-900'}`}>
                                                        {leader.name}
                                                    </p>
                                                    {isMe && (
                                                        <span className="text-[10px] font-bold font-display uppercase tracking-wider bg-navy-100 text-navy-700 px-1.5 py-0.5 rounded">
                                                            You
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-text-500 truncate mt-0.5">
                                                    {leader.division} • {leader.jobTitle || 'Employee'}
                                                </p>
                                            </div>

                                            <div className="text-right">
                                                <div className="font-black text-lg text-text-700">
                                                    {leader.points.toLocaleString()}
                                                </div>
                                                <div className="text-[10px] font-medium text-text-300 uppercase tracking-widest">
                                                    Points
                                                </div>
                                            </div>
                                        </li>
                                    )
                                })}
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
