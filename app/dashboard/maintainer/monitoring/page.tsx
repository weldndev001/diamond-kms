'use client'

import { useState, useEffect, useMemo } from 'react'
import {
    Activity, Cpu, HardDrive, Database, Bot, Users, BookOpen,
    AlertTriangle, Shield, FileText, MessageSquare, Trophy,
    CheckCircle2, XCircle, AlertCircle, Clock, Wifi, WifiOff,
    ChevronUp, ChevronDown, BarChart3, Zap, RefreshCw
} from 'lucide-react'

/* ───────────── Types ───────────── */
interface ClientInstance {
    id: string
    instance_key: string
    client_name: string
    app_version: string
    status: string
    last_heartbeat: string | null
    minutes_since_heartbeat: number
    cpu_percent: number
    memory_percent: number
    disk_percent: number
    uptime_seconds: number
    db_status: string
    db_size_mb: number
    db_connections: number
    total_users: number
    total_divisions: number
    total_documents: number
    total_contents: number
    docs_pending: number
    docs_failed: number
    ai_provider: string
    ai_model: string
    ai_status: string
    ai_avg_response_ms: number
    ai_success_rate: number
    ai_tokens_30d: number
    embedding_total: number
    embedding_done: number
    embedding_failed: number
    dau_today: number
    chat_sessions_7d: number
    quiz_completions_7d: number
    read_rate: number
    avg_quiz_score: number
    approval_pending: number
    errors_total_24h: number
    errors_error_24h: number
    errors_warn_24h: number
    health_score: number
    latest_errors: any[] | null
    license_plan: string
    license_expires: string | null
    created_at: string
    updated_at: string
}

interface Summary {
    total: number
    online: number
    offline: number
    warning: number
}

type SortDir = 'asc' | 'desc'

/* ───────────── Helper Components ───────────── */
function ProgressBar({ value, max = 100, size = 'md', thresholds }: {
    value: number
    max?: number
    size?: 'sm' | 'md' | 'lg'
    thresholds?: { green: number; yellow: number } // below green=green, below yellow=yellow, else red
}) {
    const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
    const t = thresholds ?? { green: 60, yellow: 80 }
    let color = 'bg-emerald-500'
    let glow = 'shadow-emerald-500/20'
    if (pct > t.yellow) { color = 'bg-red-500'; glow = 'shadow-red-500/30' }
    else if (pct > t.green) { color = 'bg-amber-500'; glow = 'shadow-amber-500/20' }

    const heights: Record<string, string> = { sm: 'h-1.5', md: 'h-2', lg: 'h-2.5' }

    return (
        <div className="flex items-center gap-2 min-w-0">
            <div className={`flex-1 bg-surface-200 rounded-full overflow-hidden ${heights[size]}`}>
                <div
                    className={`${color} ${heights[size]} rounded-full transition-all duration-700 ease-out shadow-sm ${glow}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
            <span className="text-xs font-semibold text-text-600 tabular-nums w-10 text-right shrink-0">
                {Math.round(pct)}%
            </span>
        </div>
    )
}

function InverseProgressBar({ value, max = 100, size = 'md' }: {
    value: number; max?: number; size?: 'sm' | 'md' | 'lg'
}) {
    // Higher is better (e.g. success rate)
    const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
    let color = 'bg-red-500'
    if (pct >= 95) color = 'bg-emerald-500'
    else if (pct >= 80) color = 'bg-amber-500'

    const heights: Record<string, string> = { sm: 'h-1.5', md: 'h-2', lg: 'h-2.5' }

    return (
        <div className="flex items-center gap-2 min-w-0">
            <div className={`flex-1 bg-surface-200 rounded-full overflow-hidden ${heights[size]}`}>
                <div
                    className={`${color} ${heights[size]} rounded-full transition-all duration-700 ease-out`}
                    style={{ width: `${pct}%` }}
                />
            </div>
            <span className="text-xs font-semibold text-text-600 tabular-nums w-10 text-right shrink-0">
                {Math.round(pct)}%
            </span>
        </div>
    )
}

function StatusBadge({ status }: { status: string }) {
    const config: Record<string, { bg: string; text: string; icon: typeof CheckCircle2; label: string }> = {
        online: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: CheckCircle2, label: 'Online' },
        warning: { bg: 'bg-amber-100', text: 'text-amber-700', icon: AlertCircle, label: 'Warning' },
        offline: { bg: 'bg-red-100', text: 'text-red-700', icon: XCircle, label: 'Offline' },
    }
    const c = config[status] ?? config.offline
    const Icon = c.icon

    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${c.bg} ${c.text}`}>
            <Icon size={12} />
            {c.label}
        </span>
    )
}

function SortHeader({ label, field, currentSort, currentDir, onSort }: {
    label: string; field: string; currentSort: string; currentDir: SortDir
    onSort: (f: string) => void
}) {
    const isActive = currentSort === field
    return (
        <button
            className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wider hover:text-navy-600 transition-colors ${isActive ? 'text-navy-700' : 'text-text-400'}`}
            onClick={() => onSort(field)}
        >
            {label}
            {isActive && (currentDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
        </button>
    )
}

function formatUptime(seconds: number): string {
    if (seconds <= 0) return '—'
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    if (days > 0) return `${days}d ${hours}h`
    const mins = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${mins}m`
}

function formatTimeAgo(minutes: number): string {
    if (minutes < 1) return 'Baru saja'
    if (minutes < 60) return `${minutes}m lalu`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h lalu`
    return `${Math.floor(hours / 24)}d lalu`
}

function formatBytes(mb: number): string {
    if (mb >= 1000) return `${(mb / 1000).toFixed(1)} GB`
    return `${Math.round(mb)} MB`
}

function daysUntil(dateStr: string | null): number {
    if (!dateStr) return 0
    const diff = new Date(dateStr).getTime() - Date.now()
    return Math.max(0, Math.floor(diff / 86400000))
}

/* ───────────── Tab Content Components ───────────── */

function OverviewTab({ instances, sortField, sortDir, onSort }: {
    instances: ClientInstance[]; sortField: string; sortDir: SortDir; onSort: (f: string) => void
}) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead>
                    <tr className="border-b border-surface-200">
                        <th className="text-left py-3 px-4"><SortHeader label="Client" field="client_name" currentSort={sortField} currentDir={sortDir} onSort={onSort} /></th>
                        <th className="text-left py-3 px-3"><SortHeader label="Status" field="status" currentSort={sortField} currentDir={sortDir} onSort={onSort} /></th>
                        <th className="text-left py-3 px-3 min-w-[160px]"><SortHeader label="CPU" field="cpu_percent" currentSort={sortField} currentDir={sortDir} onSort={onSort} /></th>
                        <th className="text-left py-3 px-3 min-w-[160px]"><SortHeader label="RAM" field="memory_percent" currentSort={sortField} currentDir={sortDir} onSort={onSort} /></th>
                        <th className="text-left py-3 px-3 min-w-[160px]"><SortHeader label="Disk" field="disk_percent" currentSort={sortField} currentDir={sortDir} onSort={onSort} /></th>
                        <th className="text-left py-3 px-3"><SortHeader label="DB" field="db_size_mb" currentSort={sortField} currentDir={sortDir} onSort={onSort} /></th>
                        <th className="text-left py-3 px-3">Version</th>
                        <th className="text-left py-3 px-3">Heartbeat</th>
                    </tr>
                </thead>
                <tbody>
                    {instances.map(inst => (
                        <tr key={inst.id} className="border-b border-surface-100 hover:bg-surface-50/50 transition-colors">
                            <td className="py-4 px-4">
                                <div className="font-semibold text-navy-900 text-sm">{inst.client_name}</div>
                                <div className="text-xs text-text-400 mt-0.5">{inst.total_users} users · {inst.total_documents} docs</div>
                            </td>
                            <td className="py-4 px-3"><StatusBadge status={inst.status} /></td>
                            <td className="py-4 px-3"><ProgressBar value={inst.cpu_percent} size="sm" /></td>
                            <td className="py-4 px-3"><ProgressBar value={inst.memory_percent} size="sm" /></td>
                            <td className="py-4 px-3"><ProgressBar value={inst.disk_percent} size="sm" /></td>
                            <td className="py-4 px-3">
                                <div className="text-sm font-medium text-navy-800">{formatBytes(inst.db_size_mb)}</div>
                                <div className="text-xs text-text-400">{inst.db_connections} conn</div>
                            </td>
                            <td className="py-4 px-3">
                                <span className="text-xs font-mono bg-surface-100 px-2 py-0.5 rounded text-navy-700">{inst.app_version}</span>
                            </td>
                            <td className="py-4 px-3">
                                <div className="flex items-center gap-1.5 text-xs text-text-500">
                                    {inst.status !== 'offline' ? <Wifi size={12} className="text-emerald-500" /> : <WifiOff size={12} className="text-red-400" />}
                                    {formatTimeAgo(inst.minutes_since_heartbeat)}
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

function AIPipelineTab({ instances, sortField, sortDir, onSort }: {
    instances: ClientInstance[]; sortField: string; sortDir: SortDir; onSort: (f: string) => void
}) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead>
                    <tr className="border-b border-surface-200">
                        <th className="text-left py-3 px-4"><SortHeader label="Client" field="client_name" currentSort={sortField} currentDir={sortDir} onSort={onSort} /></th>
                        <th className="text-left py-3 px-3">Provider</th>
                        <th className="text-left py-3 px-3">Model</th>
                        <th className="text-left py-3 px-3"><SortHeader label="Resp Time" field="ai_avg_response_ms" currentSort={sortField} currentDir={sortDir} onSort={onSort} /></th>
                        <th className="text-left py-3 px-3 min-w-[160px]"><SortHeader label="Success Rate" field="ai_success_rate" currentSort={sortField} currentDir={sortDir} onSort={onSort} /></th>
                        <th className="text-left py-3 px-3"><SortHeader label="Tokens (30d)" field="ai_tokens_30d" currentSort={sortField} currentDir={sortDir} onSort={onSort} /></th>
                        <th className="text-left py-3 px-3 min-w-[180px]">Embedding Progress</th>
                    </tr>
                </thead>
                <tbody>
                    {instances.map(inst => {
                        const providerColors: Record<string, string> = {
                            self_hosted: 'bg-purple-100 text-purple-700',
                            managed: 'bg-blue-100 text-blue-700',
                            byok: 'bg-amber-100 text-amber-700',
                        }
                        const embPct = inst.embedding_total > 0 ? (inst.embedding_done / inst.embedding_total) * 100 : 0
                        const respLabel = inst.ai_avg_response_ms < 1000 ? 'Fast' : inst.ai_avg_response_ms < 3000 ? 'Medium' : 'Slow'
                        const respColor = inst.ai_avg_response_ms < 1000 ? 'text-emerald-600' : inst.ai_avg_response_ms < 3000 ? 'text-amber-600' : 'text-red-600'

                        return (
                            <tr key={inst.id} className="border-b border-surface-100 hover:bg-surface-50/50 transition-colors">
                                <td className="py-4 px-4">
                                    <div className="font-semibold text-navy-900 text-sm">{inst.client_name}</div>
                                    <StatusBadge status={inst.ai_status === 'healthy' ? 'online' : inst.ai_status === 'degraded' ? 'warning' : 'offline'} />
                                </td>
                                <td className="py-4 px-3">
                                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${providerColors[inst.ai_provider] ?? 'bg-surface-100 text-text-600'}`}>
                                        {inst.ai_provider === 'self_hosted' ? 'Self-Hosted' : inst.ai_provider === 'managed' ? 'Managed' : 'BYOK'}
                                    </span>
                                </td>
                                <td className="py-4 px-3">
                                    <span className="text-xs font-mono bg-surface-100 px-2 py-0.5 rounded text-navy-700">{inst.ai_model}</span>
                                </td>
                                <td className="py-4 px-3">
                                    <div className="text-sm font-semibold text-navy-800">{inst.ai_avg_response_ms > 0 ? `${(inst.ai_avg_response_ms / 1000).toFixed(1)}s` : '—'}</div>
                                    <div className={`text-xs font-medium ${respColor}`}>{inst.ai_avg_response_ms > 0 ? respLabel : ''}</div>
                                </td>
                                <td className="py-4 px-3"><InverseProgressBar value={inst.ai_success_rate} size="sm" /></td>
                                <td className="py-4 px-3">
                                    <div className="text-sm font-semibold text-navy-800">{(inst.ai_tokens_30d / 1000).toFixed(0)}K</div>
                                </td>
                                <td className="py-4 px-3">
                                    <InverseProgressBar value={embPct} size="sm" />
                                    <div className="text-xs text-text-400 mt-1">
                                        {inst.embedding_done}/{inst.embedding_total}
                                        {inst.embedding_failed > 0 && <span className="text-red-500 font-medium"> · {inst.embedding_failed} gagal</span>}
                                    </div>
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}

function EngagementTab({ instances, sortField, sortDir, onSort }: {
    instances: ClientInstance[]; sortField: string; sortDir: SortDir; onSort: (f: string) => void
}) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead>
                    <tr className="border-b border-surface-200">
                        <th className="text-left py-3 px-4"><SortHeader label="Client" field="client_name" currentSort={sortField} currentDir={sortDir} onSort={onSort} /></th>
                        <th className="text-left py-3 px-3"><SortHeader label="Users" field="total_users" currentSort={sortField} currentDir={sortDir} onSort={onSort} /></th>
                        <th className="text-left py-3 px-3 min-w-[160px]"><SortHeader label="DAU Activity" field="dau_today" currentSort={sortField} currentDir={sortDir} onSort={onSort} /></th>
                        <th className="text-left py-3 px-3 min-w-[160px]"><SortHeader label="Read Rate" field="read_rate" currentSort={sortField} currentDir={sortDir} onSort={onSort} /></th>
                        <th className="text-left py-3 px-3 min-w-[160px]"><SortHeader label="Quiz Score" field="avg_quiz_score" currentSort={sortField} currentDir={sortDir} onSort={onSort} /></th>
                        <th className="text-left py-3 px-3"><SortHeader label="Chats (7d)" field="chat_sessions_7d" currentSort={sortField} currentDir={sortDir} onSort={onSort} /></th>
                        <th className="text-left py-3 px-3">Pending</th>
                    </tr>
                </thead>
                <tbody>
                    {instances.map(inst => {
                        const dauPct = inst.total_users > 0 ? (inst.dau_today / inst.total_users) * 100 : 0
                        return (
                            <tr key={inst.id} className="border-b border-surface-100 hover:bg-surface-50/50 transition-colors">
                                <td className="py-4 px-4">
                                    <div className="font-semibold text-navy-900 text-sm">{inst.client_name}</div>
                                    <div className="text-xs text-text-400">{inst.total_divisions} divisi</div>
                                </td>
                                <td className="py-4 px-3">
                                    <div className="text-lg font-bold text-navy-800">{inst.total_users}</div>
                                </td>
                                <td className="py-4 px-3">
                                    <InverseProgressBar value={dauPct} size="sm" />
                                    <div className="text-xs text-text-400 mt-1">{inst.dau_today}/{inst.total_users} aktif</div>
                                </td>
                                <td className="py-4 px-3">
                                    <InverseProgressBar value={inst.read_rate} size="sm" />
                                </td>
                                <td className="py-4 px-3">
                                    <InverseProgressBar value={inst.avg_quiz_score} size="sm" />
                                </td>
                                <td className="py-4 px-3">
                                    <div className="flex items-center gap-2">
                                        <MessageSquare size={14} className="text-navy-400" />
                                        <span className="text-sm font-semibold text-navy-800">{inst.chat_sessions_7d}</span>
                                    </div>
                                    <div className="text-xs text-text-400 mt-0.5">{inst.quiz_completions_7d} quiz</div>
                                </td>
                                <td className="py-4 px-3">
                                    {inst.approval_pending > 0 ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
                                            <Clock size={10} /> {inst.approval_pending}
                                        </span>
                                    ) : (
                                        <span className="text-xs text-text-400">—</span>
                                    )}
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}

function ErrorsTab({ instances, sortField, sortDir, onSort }: {
    instances: ClientInstance[]; sortField: string; sortDir: SortDir; onSort: (f: string) => void
}) {
    // Aggregate all latest errors
    const allErrors = instances.flatMap(inst =>
        (inst.latest_errors ?? []).map((err: any) => ({ ...err, client_name: inst.client_name }))
    ).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    return (
        <div className="space-y-6">
            {/* Summary table */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-surface-200">
                            <th className="text-left py-3 px-4"><SortHeader label="Client" field="client_name" currentSort={sortField} currentDir={sortDir} onSort={onSort} /></th>
                            <th className="text-left py-3 px-3"><SortHeader label="Total (24h)" field="errors_total_24h" currentSort={sortField} currentDir={sortDir} onSort={onSort} /></th>
                            <th className="text-left py-3 px-3">ERROR</th>
                            <th className="text-left py-3 px-3">WARN</th>
                            <th className="text-left py-3 px-3 min-w-[180px]"><SortHeader label="Health Score" field="health_score" currentSort={sortField} currentDir={sortDir} onSort={onSort} /></th>
                        </tr>
                    </thead>
                    <tbody>
                        {instances.map(inst => (
                            <tr key={inst.id} className="border-b border-surface-100 hover:bg-surface-50/50 transition-colors">
                                <td className="py-4 px-4">
                                    <div className="font-semibold text-navy-900 text-sm">{inst.client_name}</div>
                                    <StatusBadge status={inst.status} />
                                </td>
                                <td className="py-4 px-3">
                                    <span className="text-lg font-bold text-navy-800">{inst.errors_total_24h}</span>
                                </td>
                                <td className="py-4 px-3">
                                    {inst.errors_error_24h > 0 ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-bold">
                                            {inst.errors_error_24h}
                                        </span>
                                    ) : (
                                        <span className="text-xs text-text-400">0</span>
                                    )}
                                </td>
                                <td className="py-4 px-3">
                                    {inst.errors_warn_24h > 0 ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                                            {inst.errors_warn_24h}
                                        </span>
                                    ) : (
                                        <span className="text-xs text-text-400">0</span>
                                    )}
                                </td>
                                <td className="py-4 px-3">
                                    <InverseProgressBar value={inst.health_score} size="md" />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Error feed */}
            {allErrors.length > 0 && (
                <div>
                    <h3 className="text-sm font-bold text-navy-900 mb-3 flex items-center gap-2">
                        <AlertTriangle size={14} className="text-red-500" />
                        Error Log Terbaru
                    </h3>
                    <div className="space-y-2">
                        {allErrors.slice(0, 10).map((err: any, i: number) => (
                            <div key={i} className="flex items-start gap-3 p-3 bg-surface-50 rounded-lg border border-surface-200">
                                <span className={`shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${err.level === 'ERROR' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                    {err.level}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 text-xs text-text-400">
                                        <span className="font-semibold text-navy-700">{err.client_name}</span>
                                        <span>·</span>
                                        <span>{err.source}</span>
                                        <span>·</span>
                                        <span>{new Date(err.created_at).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}</span>
                                    </div>
                                    <p className="text-sm text-text-700 mt-0.5 truncate">{err.message}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

function VersionsTab({ instances, sortField, sortDir, onSort }: {
    instances: ClientInstance[]; sortField: string; sortDir: SortDir; onSort: (f: string) => void
}) {
    // Version distribution
    const versionMap: Record<string, number> = {}
    instances.forEach(inst => {
        versionMap[inst.app_version] = (versionMap[inst.app_version] || 0) + 1
    })
    const versionEntries = Object.entries(versionMap).sort((a, b) => b[0].localeCompare(a[0]))
    const latestVersion = versionEntries.length > 0 ? versionEntries[0][0] : '—'

    return (
        <div className="space-y-6">
            {/* Version distribution */}
            <div className="p-5 bg-surface-50 rounded-xl border border-surface-200">
                <h3 className="text-sm font-bold text-navy-900 mb-4 flex items-center gap-2">
                    <BarChart3 size={14} className="text-navy-600" />
                    Distribusi Versi
                </h3>
                <div className="space-y-3">
                    {versionEntries.map(([version, count]) => {
                        const pct = (count / instances.length) * 100
                        const isLatest = version === latestVersion
                        return (
                            <div key={version}>
                                <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-mono font-semibold text-navy-800">{version}</span>
                                        {isLatest && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-semibold">LATEST</span>}
                                        {!isLatest && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold">UPDATE</span>}
                                    </div>
                                    <span className="text-xs text-text-500 font-medium">{count} instance ({Math.round(pct)}%)</span>
                                </div>
                                <div className="w-full bg-surface-200 rounded-full h-2.5">
                                    <div
                                        className={`h-2.5 rounded-full transition-all duration-700 ${isLatest ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* License table */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-surface-200">
                            <th className="text-left py-3 px-4"><SortHeader label="Client" field="client_name" currentSort={sortField} currentDir={sortDir} onSort={onSort} /></th>
                            <th className="text-left py-3 px-3">Version</th>
                            <th className="text-left py-3 px-3">Plan</th>
                            <th className="text-left py-3 px-3">Expiry</th>
                            <th className="text-left py-3 px-3 min-w-[200px]">Sisa Waktu</th>
                        </tr>
                    </thead>
                    <tbody>
                        {instances.map(inst => {
                            const days = daysUntil(inst.license_expires)
                            const maxDays = 365
                            const isOutdated = inst.app_version !== latestVersion
                            const planColors: Record<string, string> = {
                                enterprise: 'bg-purple-100 text-purple-700',
                                pro: 'bg-blue-100 text-blue-700',
                                basic: 'bg-surface-200 text-text-600',
                            }

                            return (
                                <tr key={inst.id} className="border-b border-surface-100 hover:bg-surface-50/50 transition-colors">
                                    <td className="py-4 px-4">
                                        <div className="font-semibold text-navy-900 text-sm">{inst.client_name}</div>
                                    </td>
                                    <td className="py-4 px-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-mono bg-surface-100 px-2 py-0.5 rounded text-navy-700">{inst.app_version}</span>
                                            {isOutdated && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold">⬆ Update</span>}
                                        </div>
                                    </td>
                                    <td className="py-4 px-3">
                                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${planColors[inst.license_plan] ?? planColors.basic}`}>
                                            {inst.license_plan}
                                        </span>
                                    </td>
                                    <td className="py-4 px-3">
                                        <span className="text-sm text-text-600">
                                            {inst.license_expires ? new Date(inst.license_expires).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                                        </span>
                                    </td>
                                    <td className="py-4 px-3">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <div className="flex-1 bg-surface-200 rounded-full h-2 overflow-hidden">
                                                <div
                                                    className={`h-2 rounded-full transition-all duration-700 ${days > 180 ? 'bg-emerald-500' : days > 90 ? 'bg-amber-500' : 'bg-red-500'}`}
                                                    style={{ width: `${Math.min((days / maxDays) * 100, 100)}%` }}
                                                />
                                            </div>
                                            <span className={`text-xs font-semibold tabular-nums shrink-0 ${days > 180 ? 'text-emerald-600' : days > 90 ? 'text-amber-600' : 'text-red-600'}`}>
                                                {days > 0 ? `${days} hari` : 'Expired'}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

/* ───────────── Main Page ───────────── */
const TABS = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'ai', label: 'AI Pipeline', icon: Bot },
    { id: 'engagement', label: 'Engagement', icon: Users },
    { id: 'errors', label: 'Errors', icon: AlertTriangle },
    { id: 'versions', label: 'Versions', icon: Shield },
] as const

type TabId = typeof TABS[number]['id']

export default function MonitoringPage() {
    const [instances, setInstances] = useState<ClientInstance[]>([])
    const [summary, setSummary] = useState<Summary>({ total: 0, online: 0, offline: 0, warning: 0 })
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<TabId>('overview')
    const [sortField, setSortField] = useState('client_name')
    const [sortDir, setSortDir] = useState<SortDir>('asc')
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

    const fetchData = () => {
        setLoading(true)
        fetch('/api/monitoring/instances')
            .then(res => res.json())
            .then(data => {
                if (!data.error) {
                    setInstances(data.instances ?? [])
                    setSummary(data.summary ?? { total: 0, online: 0, offline: 0, warning: 0 })
                }
                setLoading(false)
                setLastRefresh(new Date())
            })
            .catch(() => setLoading(false))
    }

    useEffect(() => { fetchData() }, [])

    // Auto-refresh every 30s
    useEffect(() => {
        const interval = setInterval(fetchData, 30000)
        return () => clearInterval(interval)
    }, [])

    const handleSort = (field: string) => {
        if (sortField === field) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortDir('desc')
        }
    }

    const sortedInstances = useMemo(() => {
        return [...instances].sort((a: any, b: any) => {
            const valA = a[sortField]
            const valB = b[sortField]
            const cmp = typeof valA === 'string' ? valA.localeCompare(valB) : (valA ?? 0) - (valB ?? 0)
            return sortDir === 'asc' ? cmp : -cmp
        })
    }, [instances, sortField, sortDir])

    if (loading && instances.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <div className="w-10 h-10 border-4 border-navy-200 border-t-navy-600 rounded-full animate-spin mb-4" />
                <p className="text-text-500 font-medium">Memuat data monitoring...</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-[28px] font-bold font-display text-navy-900 leading-tight flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-navy-600 to-navy-800 rounded-xl flex items-center justify-center shadow-lg">
                            <Activity size={20} className="text-white" />
                        </div>
                        Central Monitor
                    </h1>
                    <p className="text-sm text-text-500 mt-1">
                        Monitoring semua instance Diamond KMS
                    </p>
                </div>
                <button
                    onClick={fetchData}
                    className="flex items-center gap-2 px-4 py-2 bg-navy-900 text-white rounded-xl text-sm font-semibold hover:bg-navy-800 transition-colors shadow-sm"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white border border-surface-200 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-navy-100 rounded-xl flex items-center justify-center">
                            <Database size={18} className="text-navy-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-black font-display text-navy-900">{summary.total}</p>
                            <p className="text-xs text-text-400 font-semibold uppercase tracking-wider">Total</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white border border-surface-200 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                            <CheckCircle2 size={18} className="text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-black font-display text-emerald-600">{summary.online}</p>
                            <p className="text-xs text-text-400 font-semibold uppercase tracking-wider">Online</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white border border-surface-200 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                            <XCircle size={18} className="text-red-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-black font-display text-red-600">{summary.offline}</p>
                            <p className="text-xs text-text-400 font-semibold uppercase tracking-wider">Offline</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white border border-surface-200 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                            <AlertCircle size={18} className="text-amber-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-black font-display text-amber-600">{summary.warning}</p>
                            <p className="text-xs text-text-400 font-semibold uppercase tracking-wider">Warning</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="bg-white border border-surface-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="flex border-b border-surface-200 overflow-x-auto">
                    {TABS.map(tab => {
                        const Icon = tab.icon
                        const isActive = activeTab === tab.id
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold transition-colors border-b-2 whitespace-nowrap ${
                                    isActive
                                        ? 'border-navy-600 text-navy-700 bg-navy-50/50'
                                        : 'border-transparent text-text-400 hover:text-navy-600 hover:bg-surface-50'
                                }`}
                            >
                                <Icon size={15} />
                                {tab.label}
                                {tab.id === 'errors' && summary.warning > 0 && (
                                    <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                                        {instances.reduce((s, i) => s + i.errors_error_24h, 0)}
                                    </span>
                                )}
                            </button>
                        )
                    })}
                </div>

                {/* Tab Content */}
                <div className="p-1 md:p-2">
                    {activeTab === 'overview' && <OverviewTab instances={sortedInstances} sortField={sortField} sortDir={sortDir} onSort={handleSort} />}
                    {activeTab === 'ai' && <AIPipelineTab instances={sortedInstances} sortField={sortField} sortDir={sortDir} onSort={handleSort} />}
                    {activeTab === 'engagement' && <EngagementTab instances={sortedInstances} sortField={sortField} sortDir={sortDir} onSort={handleSort} />}
                    {activeTab === 'errors' && <ErrorsTab instances={sortedInstances} sortField={sortField} sortDir={sortDir} onSort={handleSort} />}
                    {activeTab === 'versions' && <VersionsTab instances={sortedInstances} sortField={sortField} sortDir={sortDir} onSort={handleSort} />}
                </div>
            </div>

            {/* Footer */}
            <div className="text-center text-xs text-text-400 pb-4">
                Terakhir diperbarui: {lastRefresh.toLocaleTimeString('id-ID')} · Auto-refresh setiap 30 detik
            </div>
        </div>
    )
}
