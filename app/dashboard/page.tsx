'use client'

import { useState, useEffect } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import {
    FileText, Tags, Users, Network, Activity,
    TrendingUp, BookOpen, BarChart3, CheckCircle
} from 'lucide-react'
import Link from 'next/link'
import { getMandatoryReadStatsAction } from '@/lib/actions/read-tracker.actions'

interface DashboardStats {
    totalDocuments: number
    totalContents: number
    totalDivisions?: number
    totalMembers: number
    readingTracker: {
        confirmed: number
        expected: number
        rate: number
    }
    role: string
}

export default function DashboardPage() {
    const { user, role, organization, isLoading } = useCurrentUser()
    const [stats, setStats] = useState<DashboardStats | null>(null)
    const [trackerStats, setTrackerStats] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (organization?.id) {
            Promise.all([
                fetch('/api/dashboard/stats').then(res => res.json()),
                getMandatoryReadStatsAction(organization.id)
            ]).then(([statsData, trackerRes]) => {
                if (!statsData.error) setStats(statsData)
                if (trackerRes.success) setTrackerStats(trackerRes.data || [])
                setLoading(false)
            }).catch(() => setLoading(false))
        }
    }, [organization?.id])

    // MAINTAINER redirects to their own dashboard
    if (role === 'MAINTAINER') {
        if (typeof window !== 'undefined') {
            window.location.href = '/dashboard/maintainer'
        }
        return null
    }

    if (isLoading || loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <div className="w-10 h-10 border-4 border-navy-200 border-t-navy-600 rounded-full animate-spin mb-4" />
                <p className="text-text-500 font-medium">Memuat dashboard...</p>
            </div>
        )
    }

    if (!user) return null

    const isHRD = role === 'SUPER_ADMIN'
    const isKadivOrSupervisor = role === 'GROUP_ADMIN' || role === 'SUPERVISOR'
    const isStaff = role === 'STAFF'

    const getRoleLabel = () => {
        switch (role) {
            case 'SUPER_ADMIN': return 'HRD Dashboard'
            case 'GROUP_ADMIN': return 'KaDiv Dashboard'
            case 'SUPERVISOR': return 'Supervisor Dashboard'
            case 'STAFF': return 'Staff Dashboard'
            default: return 'Dashboard'
        }
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-[28px] font-bold font-display text-navy-900 leading-tight">
                    {getRoleLabel()}
                </h1>
                <p className="text-sm text-text-500 mt-1">
                    Selamat datang, <span className="font-semibold text-navy-700">{user.full_name}</span>
                    {organization?.name && <> di <span className="font-semibold">{organization.name}</span></>}
                </p>
            </div>

            {/* Reading Tracker — for HRD, Kadiv, Supervisor */}
            {(isHRD || isKadivOrSupervisor) && stats && (
                <div className="card p-6 banner-primary text-white overflow-hidden relative border-none">
                    <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
                        <BookOpen size={120} />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 text-navy-200 text-sm font-medium uppercase tracking-wider mb-3">
                            <Activity size={16} />
                            Reading Tracker
                        </div>
                        <div className="flex items-end gap-4">
                            <div className="text-5xl font-black font-display">
                                {stats.readingTracker.rate}%
                            </div>
                            <div className="text-navy-200 mb-1.5 text-sm">
                                tingkat pemahaman
                            </div>
                        </div>
                        <div className="mt-4 w-full bg-white/20 rounded-full h-2.5">
                            <div
                                className="bg-amber-400 h-2.5 rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(stats.readingTracker.rate, 100)}%` }}
                            />
                        </div>
                        <p className="text-navy-300 text-xs mt-2">
                            {stats.readingTracker.confirmed} dari {stats.readingTracker.expected} wajib baca terkonfirmasi
                        </p>
                    </div>
                </div>
            )}

            {/* Stats Cards */}
            <div className={`grid gap-5 ${isHRD ? 'grid-cols-2 md:grid-cols-4' : isKadivOrSupervisor ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'}`}>
                {/* Total Dokumen — all roles */}
                <Link href="/dashboard/documents" className="card p-6 hover:border-navy-300 transition-colors group">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-navy-light text-navy-600 rounded-xl flex items-center justify-center group-hover:bg-navy-600 group-hover:text-white transition">
                            <FileText size={24} />
                        </div>
                        <div>
                            <p className="text-text-500 text-xs font-semibold uppercase tracking-wider">Manage Document</p>
                            <p className="text-3xl font-black font-display text-text-900 mt-0.5">
                                {stats?.totalDocuments ?? 0}
                            </p>
                        </div>
                    </div>
                </Link>

                {/* Total Konten — all roles */}
                <Link href="/dashboard/knowledge-base" className="card p-6 hover:border-navy-300 transition-colors group">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-amber-light text-amber-600 rounded-xl flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition">
                            <Tags size={24} />
                        </div>
                        <div>
                            <p className="text-text-500 text-xs font-semibold uppercase tracking-wider">Manage Content</p>
                            <p className="text-3xl font-black font-display text-text-900 mt-0.5">
                                {stats?.totalContents ?? 0}
                            </p>
                        </div>
                    </div>
                </Link>

                {/* Total Divisi — HRD only */}
                {isHRD && (
                    <Link href="/dashboard/hrd/divisions" className="card p-6 hover:border-navy-300 transition-colors group">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-purple-light text-purple-600 rounded-xl flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition">
                                <Network size={24} />
                            </div>
                            <div>
                                <p className="text-text-500 text-xs font-semibold uppercase tracking-wider">Divisi</p>
                                <p className="text-3xl font-black font-display text-text-900 mt-0.5">
                                    {stats?.totalDivisions ?? 0}
                                </p>
                            </div>
                        </div>
                    </Link>
                )}

                {/* Total Anggota — HRD, Kadiv, Supervisor */}
                {(isHRD || isKadivOrSupervisor) && (
                    <Link href={isHRD ? "/dashboard/hrd/users" : "#"} className="card p-6 hover:border-navy-300 transition-colors group">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-green-light text-green-600 rounded-xl flex items-center justify-center group-hover:bg-green-600 group-hover:text-white transition">
                                <Users size={24} />
                            </div>
                            <div>
                                <p className="text-text-500 text-xs font-semibold uppercase tracking-wider">Anggota</p>
                                <p className="text-3xl font-black font-display text-text-900 mt-0.5">
                                    {stats?.totalMembers ?? 0}
                                </p>
                            </div>
                        </div>
                    </Link>
                )}
            </div>

            {/* Reading Tracker Section */}
            {(isHRD || isKadivOrSupervisor) && trackerStats.length > 0 && (
                <div className="space-y-4">
                    <h2 className="text-xl font-bold font-display text-navy-900 flex items-center gap-2">
                        <CheckCircle size={20} className="text-navy-600" /> Mandatory Read Tracking
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {trackerStats.slice(0, 3).map((item) => (
                            <div key={item.id} className="card p-5">
                                <h3 className="font-bold font-display text-text-900 text-sm mb-3 line-clamp-1">{item.title}</h3>
                                <div className="flex justify-between items-end mb-2">
                                    <span className="text-xs text-text-500">{item.readCount}/{item.totalTarget} Pembaca</span>
                                    <span className="text-lg font-black text-navy-600">{item.percent}%</span>
                                </div>
                                <div className="w-full bg-surface-100 rounded-full h-1.5 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-1000 ${item.percent >= 90 ? 'bg-green-500' : item.percent >= 50 ? 'bg-navy-600' : 'bg-orange-500'}`}
                                        style={{ width: `${item.percent}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                    {trackerStats.length > 3 && (
                        <Link href="/dashboard/trackers" className="text-sm font-medium text-navy-600 hover:text-navy-700 block text-right mt-2">
                            Lihat semua →
                        </Link>
                    )}
                </div>
            )}

            {/* Quick Actions */}
            <div className="card p-6">
                <h2 className="font-bold font-display text-navy-900 text-lg mb-4 flex items-center gap-2">
                    <BarChart3 size={18} className="text-navy-600" />
                    Akses Cepat
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Link href="/dashboard/documents" className="p-4 bg-surface-50 border border-surface-200 rounded-xl text-center hover:bg-navy-light hover:border-navy-300 transition">
                        <FileText size={20} className="mx-auto text-navy-600 mb-2" />
                        <span className="text-sm font-medium text-text-900">Manage Document</span>
                    </Link>
                    <Link href="/dashboard/knowledge-base" className="p-4 bg-surface-50 border border-surface-200 rounded-xl text-center hover:bg-navy-light hover:border-navy-300 transition">
                        <Tags size={20} className="mx-auto text-amber-600 mb-2" />
                        <span className="text-sm font-medium text-text-900">Knowledge Base</span>
                    </Link>
                    <Link href="/dashboard/ai-assistant" className="p-4 bg-surface-50 border border-surface-200 rounded-xl text-center hover:bg-navy-light hover:border-navy-300 transition">
                        <TrendingUp size={20} className="mx-auto text-green-600 mb-2" />
                        <span className="text-sm font-medium text-text-900">AI Assistant</span>
                    </Link>
                    <Link href="/dashboard/leaderboard" className="p-4 bg-surface-50 border border-surface-200 rounded-xl text-center hover:bg-navy-light hover:border-navy-300 transition">
                        <Activity size={20} className="mx-auto text-purple-600 mb-2" />
                        <span className="text-sm font-medium text-text-900">Pemahaman Pegawai</span>
                    </Link>
                </div>
            </div>
        </div>
    )
}
