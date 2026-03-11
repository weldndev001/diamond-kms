'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
    Activity, Bot, Users, AlertTriangle, Shield,
    MessageSquare, CheckCircle2, XCircle, AlertCircle, Clock,
    Wifi, WifiOff, ChevronUp, ChevronDown, BarChart3,
    RefreshCw, Server, Database, Cpu, HardDrive, Zap
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
}

interface Summary { total: number; online: number; offline: number; warning: number }
type SortDir = 'asc' | 'desc'

/* ───────────── Progress Bar ───────────── */
function ProgressBar({ value, max = 100, thresholds, size = 'md' }: {
    value: number; max?: number; size?: 'sm' | 'md'
    thresholds?: { green: number; yellow: number }
}) {
    const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
    const t = thresholds ?? { green: 60, yellow: 80 }
    let barColor = 'bg-emerald-500 shadow-emerald-500/30'
    if (pct > t.yellow) barColor = 'bg-red-500 shadow-red-500/30'
    else if (pct > t.green) barColor = 'bg-amber-500 shadow-amber-500/30'

    return (
        <div className="flex items-center gap-2.5">
            <div className={`flex-1 bg-white/[0.06] rounded-full overflow-hidden ${size === 'sm' ? 'h-1.5' : 'h-2'}`}>
                <div className={`${barColor} ${size === 'sm' ? 'h-1.5' : 'h-2'} rounded-full transition-all duration-700 ease-out shadow-sm`}
                    style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[11px] font-semibold text-white/70 tabular-nums w-10 text-right shrink-0">
                {Math.round(pct)}%
            </span>
        </div>
    )
}

/* Higher is better (success rate, health, read rate) */
function GoodBar({ value, max = 100, size = 'md' }: { value: number; max?: number; size?: 'sm' | 'md' }) {
    const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
    let barColor = 'bg-red-500'
    if (pct >= 95) barColor = 'bg-emerald-500'
    else if (pct >= 80) barColor = 'bg-amber-500'

    return (
        <div className="flex items-center gap-2.5">
            <div className={`flex-1 bg-white/[0.06] rounded-full overflow-hidden ${size === 'sm' ? 'h-1.5' : 'h-2'}`}>
                <div className={`${barColor} ${size === 'sm' ? 'h-1.5' : 'h-2'} rounded-full transition-all duration-700 ease-out`}
                    style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[11px] font-semibold text-white/70 tabular-nums w-10 text-right shrink-0">
                {Math.round(pct)}%
            </span>
        </div>
    )
}

/* ───────────── Status Badge ───────────── */
function StatusBadge({ status }: { status: string }) {
    const c: Record<string, { bg: string; dot: string; label: string }> = {
        online:  { bg: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20', dot: 'bg-emerald-400', label: 'Online' },
        warning: { bg: 'bg-amber-500/10 text-amber-400 ring-amber-500/20', dot: 'bg-amber-400', label: 'Warning' },
        offline: { bg: 'bg-red-500/10 text-red-400 ring-red-500/20', dot: 'bg-red-400', label: 'Offline' },
    }
    const s = c[status] ?? c.offline
    return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ${s.bg}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
            {s.label}
        </span>
    )
}

/* ───────────── Sort Header ───────────── */
function SortHeader({ label, field, currentSort, currentDir, onSort }: {
    label: string; field: string; currentSort: string; currentDir: SortDir; onSort: (f: string) => void
}) {
    const active = currentSort === field
    return (
        <button onClick={() => onSort(field)}
            className={`flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider transition-colors ${active ? 'text-amber-400' : 'text-white/30 hover:text-white/60'}`}>
            {label}
            {active && (currentDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
        </button>
    )
}

/* ───────────── Helpers ───────────── */
function formatTimeAgo(mins: number): string {
    if (mins < 1) return 'Baru saja'
    if (mins < 60) return `${mins}m`
    const h = Math.floor(mins / 60)
    return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`
}
function formatBytes(mb: number): string {
    return mb >= 1000 ? `${(mb / 1000).toFixed(1)} GB` : `${Math.round(mb)} MB`
}
function daysUntil(d: string | null): number {
    if (!d) return 0
    return Math.max(0, Math.floor((new Date(d).getTime() - Date.now()) / 86400000))
}

/* ═══════════════════════════════════════════════════════════════════
   TAB 1: OVERVIEW
   ═══════════════════════════════════════════════════════════════════ */
function OverviewTab({ data, sf, sd, onSort }: { data: ClientInstance[]; sf: string; sd: SortDir; onSort: (f: string) => void }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead><tr className="border-b border-white/[0.06]">
                    <th className="text-left py-3 px-4"><SortHeader label="Client" field="client_name" currentSort={sf} currentDir={sd} onSort={onSort} /></th>
                    <th className="text-left py-3 px-3"><SortHeader label="Status" field="status" currentSort={sf} currentDir={sd} onSort={onSort} /></th>
                    <th className="text-left py-3 px-3 min-w-[150px]"><SortHeader label="CPU" field="cpu_percent" currentSort={sf} currentDir={sd} onSort={onSort} /></th>
                    <th className="text-left py-3 px-3 min-w-[150px]"><SortHeader label="RAM" field="memory_percent" currentSort={sf} currentDir={sd} onSort={onSort} /></th>
                    <th className="text-left py-3 px-3 min-w-[150px]"><SortHeader label="Disk" field="disk_percent" currentSort={sf} currentDir={sd} onSort={onSort} /></th>
                    <th className="text-left py-3 px-3"><SortHeader label="DB" field="db_size_mb" currentSort={sf} currentDir={sd} onSort={onSort} /></th>
                    <th className="text-left py-3 px-3">Ver</th>
                    <th className="text-left py-3 px-3">Beat</th>
                </tr></thead>
                <tbody>{data.map(i => (
                    <tr key={i.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                        <td className="py-3.5 px-4">
                            <Link href={`/admin/monitoring/${i.id}`} className="group">
                                <div className="font-semibold text-white/90 text-[13px] group-hover:text-amber-400 transition-colors">{i.client_name}</div>
                                <div className="text-[11px] text-white/30 mt-0.5">{i.total_users} users · {i.total_documents} docs</div>
                            </Link>
                        </td>
                        <td className="py-3.5 px-3"><StatusBadge status={i.status} /></td>
                        <td className="py-3.5 px-3"><ProgressBar value={i.cpu_percent} size="sm" /></td>
                        <td className="py-3.5 px-3"><ProgressBar value={i.memory_percent} size="sm" /></td>
                        <td className="py-3.5 px-3"><ProgressBar value={i.disk_percent} size="sm" /></td>
                        <td className="py-3.5 px-3">
                            <div className="text-[13px] font-medium text-white/80">{formatBytes(i.db_size_mb)}</div>
                            <div className="text-[11px] text-white/30">{i.db_connections} conn</div>
                        </td>
                        <td className="py-3.5 px-3">
                            <span className="text-[11px] font-mono bg-white/[0.06] px-2 py-0.5 rounded text-white/60">{i.app_version}</span>
                        </td>
                        <td className="py-3.5 px-3">
                            <div className="flex items-center gap-1.5 text-[11px] text-white/40">
                                {i.status !== 'offline' ? <Wifi size={11} className="text-emerald-400" /> : <WifiOff size={11} className="text-red-400" />}
                                {formatTimeAgo(i.minutes_since_heartbeat)}
                            </div>
                        </td>
                    </tr>
                ))}</tbody>
            </table>
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════════════
   TAB 2: AI PIPELINE
   ═══════════════════════════════════════════════════════════════════ */
function AIPipelineTab({ data, sf, sd, onSort }: { data: ClientInstance[]; sf: string; sd: SortDir; onSort: (f: string) => void }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead><tr className="border-b border-white/[0.06]">
                    <th className="text-left py-3 px-4"><SortHeader label="Client" field="client_name" currentSort={sf} currentDir={sd} onSort={onSort} /></th>
                    <th className="text-left py-3 px-3">Provider</th>
                    <th className="text-left py-3 px-3">Model</th>
                    <th className="text-left py-3 px-3"><SortHeader label="Resp" field="ai_avg_response_ms" currentSort={sf} currentDir={sd} onSort={onSort} /></th>
                    <th className="text-left py-3 px-3 min-w-[150px]"><SortHeader label="Success" field="ai_success_rate" currentSort={sf} currentDir={sd} onSort={onSort} /></th>
                    <th className="text-left py-3 px-3"><SortHeader label="Tokens" field="ai_tokens_30d" currentSort={sf} currentDir={sd} onSort={onSort} /></th>
                    <th className="text-left py-3 px-3 min-w-[170px]">Embedding</th>
                </tr></thead>
                <tbody>{data.map(i => {
                    const prov: Record<string, string> = {
                        self_hosted: 'bg-purple-500/15 text-purple-400 ring-purple-500/20',
                        managed: 'bg-blue-500/15 text-blue-400 ring-blue-500/20',
                        byok: 'bg-amber-500/15 text-amber-400 ring-amber-500/20',
                    }
                    const embPct = i.embedding_total > 0 ? (i.embedding_done / i.embedding_total) * 100 : 0
                    const resp = i.ai_avg_response_ms
                    const respColor = resp < 1000 ? 'text-emerald-400' : resp < 3000 ? 'text-amber-400' : 'text-red-400'

                    return (
                        <tr key={i.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                            <td className="py-3.5 px-4">
                                <Link href={`/admin/monitoring/${i.id}`} className="group">
                                    <div className="font-semibold text-white/90 text-[13px] group-hover:text-amber-400 transition-colors">{i.client_name}</div>
                                    <StatusBadge status={i.ai_status === 'healthy' ? 'online' : i.ai_status === 'degraded' ? 'warning' : 'offline'} />
                                </Link>
                            </td>
                            <td className="py-3.5 px-3">
                                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ring-1 ${prov[i.ai_provider] ?? 'bg-white/5 text-white/40 ring-white/10'}`}>
                                    {i.ai_provider === 'self_hosted' ? 'Self-Hosted' : i.ai_provider === 'managed' ? 'Managed' : 'BYOK'}
                                </span>
                            </td>
                            <td className="py-3.5 px-3">
                                <span className="text-[11px] font-mono bg-white/[0.06] px-2 py-0.5 rounded text-white/60">{i.ai_model}</span>
                            </td>
                            <td className="py-3.5 px-3">
                                <div className={`text-[13px] font-semibold ${respColor}`}>
                                    {resp > 0 ? `${(resp / 1000).toFixed(1)}s` : '—'}
                                </div>
                            </td>
                            <td className="py-3.5 px-3"><GoodBar value={i.ai_success_rate} size="sm" /></td>
                            <td className="py-3.5 px-3">
                                <span className="text-[13px] font-semibold text-white/80">{(i.ai_tokens_30d / 1000).toFixed(0)}K</span>
                            </td>
                            <td className="py-3.5 px-3">
                                <GoodBar value={embPct} size="sm" />
                                <div className="text-[10px] text-white/30 mt-1">
                                    {i.embedding_done}/{i.embedding_total}
                                    {i.embedding_failed > 0 && <span className="text-red-400 font-medium"> · {i.embedding_failed} gagal</span>}
                                </div>
                            </td>
                        </tr>
                    )
                })}</tbody>
            </table>
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════════════
   TAB 3: ENGAGEMENT
   ═══════════════════════════════════════════════════════════════════ */
function EngagementTab({ data, sf, sd, onSort }: { data: ClientInstance[]; sf: string; sd: SortDir; onSort: (f: string) => void }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead><tr className="border-b border-white/[0.06]">
                    <th className="text-left py-3 px-4"><SortHeader label="Client" field="client_name" currentSort={sf} currentDir={sd} onSort={onSort} /></th>
                    <th className="text-left py-3 px-3"><SortHeader label="Users" field="total_users" currentSort={sf} currentDir={sd} onSort={onSort} /></th>
                    <th className="text-left py-3 px-3 min-w-[150px]"><SortHeader label="DAU" field="dau_today" currentSort={sf} currentDir={sd} onSort={onSort} /></th>
                    <th className="text-left py-3 px-3 min-w-[150px]"><SortHeader label="Read Rate" field="read_rate" currentSort={sf} currentDir={sd} onSort={onSort} /></th>
                    <th className="text-left py-3 px-3 min-w-[150px]"><SortHeader label="Quiz" field="avg_quiz_score" currentSort={sf} currentDir={sd} onSort={onSort} /></th>
                    <th className="text-left py-3 px-3"><SortHeader label="Chats" field="chat_sessions_7d" currentSort={sf} currentDir={sd} onSort={onSort} /></th>
                    <th className="text-left py-3 px-3">Pending</th>
                </tr></thead>
                <tbody>{data.map(i => {
                    const dauPct = i.total_users > 0 ? (i.dau_today / i.total_users) * 100 : 0
                    return (
                        <tr key={i.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                            <td className="py-3.5 px-4">
                                <Link href={`/admin/monitoring/${i.id}`} className="group">
                                    <div className="font-semibold text-white/90 text-[13px] group-hover:text-amber-400 transition-colors">{i.client_name}</div>
                                    <div className="text-[11px] text-white/30">{i.total_divisions} divisi</div>
                                </Link>
                            </td>
                            <td className="py-3.5 px-3"><span className="text-lg font-bold text-white/90">{i.total_users}</span></td>
                            <td className="py-3.5 px-3">
                                <GoodBar value={dauPct} size="sm" />
                                <div className="text-[10px] text-white/30 mt-1">{i.dau_today}/{i.total_users} aktif</div>
                            </td>
                            <td className="py-3.5 px-3"><GoodBar value={i.read_rate} size="sm" /></td>
                            <td className="py-3.5 px-3"><GoodBar value={i.avg_quiz_score} size="sm" /></td>
                            <td className="py-3.5 px-3">
                                <div className="flex items-center gap-1.5">
                                    <MessageSquare size={12} className="text-white/30" />
                                    <span className="text-[13px] font-semibold text-white/80">{i.chat_sessions_7d}</span>
                                </div>
                            </td>
                            <td className="py-3.5 px-3">
                                {i.approval_pending > 0 ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-[11px] font-semibold ring-1 ring-amber-500/20">
                                        <Clock size={10} /> {i.approval_pending}
                                    </span>
                                ) : <span className="text-[11px] text-white/20">—</span>}
                            </td>
                        </tr>
                    )
                })}</tbody>
            </table>
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════════════
   TAB 4: ERRORS
   ═══════════════════════════════════════════════════════════════════ */
function ErrorsTab({ data, sf, sd, onSort }: { data: ClientInstance[]; sf: string; sd: SortDir; onSort: (f: string) => void }) {
    const allErrors = data.flatMap(i =>
        (i.latest_errors ?? []).map((e: any) => ({ ...e, client_name: i.client_name }))
    ).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    return (
        <div className="space-y-6">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead><tr className="border-b border-white/[0.06]">
                        <th className="text-left py-3 px-4"><SortHeader label="Client" field="client_name" currentSort={sf} currentDir={sd} onSort={onSort} /></th>
                        <th className="text-left py-3 px-3"><SortHeader label="Total" field="errors_total_24h" currentSort={sf} currentDir={sd} onSort={onSort} /></th>
                        <th className="text-left py-3 px-3">ERROR</th>
                        <th className="text-left py-3 px-3">WARN</th>
                        <th className="text-left py-3 px-3 min-w-[170px]"><SortHeader label="Health" field="health_score" currentSort={sf} currentDir={sd} onSort={onSort} /></th>
                    </tr></thead>
                    <tbody>{data.map(i => (
                        <tr key={i.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                            <td className="py-3.5 px-4">
                                <Link href={`/admin/monitoring/${i.id}`} className="group">
                                    <div className="font-semibold text-white/90 text-[13px] group-hover:text-amber-400 transition-colors">{i.client_name}</div>
                                    <StatusBadge status={i.status} />
                                </Link>
                            </td>
                            <td className="py-3.5 px-3"><span className="text-lg font-bold text-white/90">{i.errors_total_24h}</span></td>
                            <td className="py-3.5 px-3">
                                {i.errors_error_24h > 0
                                    ? <span className="inline-flex px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 text-[11px] font-bold ring-1 ring-red-500/20">{i.errors_error_24h}</span>
                                    : <span className="text-[11px] text-white/20">0</span>}
                            </td>
                            <td className="py-3.5 px-3">
                                {i.errors_warn_24h > 0
                                    ? <span className="inline-flex px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-[11px] font-bold ring-1 ring-amber-500/20">{i.errors_warn_24h}</span>
                                    : <span className="text-[11px] text-white/20">0</span>}
                            </td>
                            <td className="py-3.5 px-3"><GoodBar value={i.health_score} /></td>
                        </tr>
                    ))}</tbody>
                </table>
            </div>

            {allErrors.length > 0 && (
                <div>
                    <h3 className="text-[13px] font-bold text-white/80 mb-3 flex items-center gap-2">
                        <AlertTriangle size={13} className="text-red-400" /> Error Log Terbaru
                    </h3>
                    <div className="space-y-1.5">
                        {allErrors.slice(0, 10).map((e: any, idx: number) => (
                            <div key={idx} className="flex items-start gap-3 p-3 bg-white/[0.03] rounded-lg border border-white/[0.06]">
                                <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold ${e.level === 'ERROR' ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'}`}>{e.level}</span>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 text-[11px] text-white/30">
                                        <span className="font-semibold text-white/60">{e.client_name}</span>
                                        <span>·</span><span>{e.source}</span>
                                        <span>·</span><span>{new Date(e.created_at).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}</span>
                                    </div>
                                    <p className="text-[13px] text-white/60 mt-0.5 truncate">{e.message}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════════════
   TAB 5: VERSIONS
   ═══════════════════════════════════════════════════════════════════ */
function VersionsTab({ data, sf, sd, onSort }: { data: ClientInstance[]; sf: string; sd: SortDir; onSort: (f: string) => void }) {
    const verMap: Record<string, number> = {}
    data.forEach(i => { verMap[i.app_version] = (verMap[i.app_version] || 0) + 1 })
    const verEntries = Object.entries(verMap).sort((a, b) => b[0].localeCompare(a[0]))
    const latest = verEntries.length > 0 ? verEntries[0][0] : '—'

    return (
        <div className="space-y-6">
            {/* Distribution */}
            <div className="p-5 bg-white/[0.03] rounded-xl border border-white/[0.06]">
                <h3 className="text-[13px] font-bold text-white/80 mb-4 flex items-center gap-2">
                    <BarChart3 size={14} className="text-amber-400" /> Distribusi Versi
                </h3>
                <div className="space-y-3">
                    {verEntries.map(([ver, n]) => {
                        const pct = (n / data.length) * 100
                        const isLatest = ver === latest
                        return (
                            <div key={ver}>
                                <div className="flex items-center justify-between mb-1.5">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[13px] font-mono font-semibold text-white/80">{ver}</span>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${isLatest ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
                                            {isLatest ? 'LATEST' : 'UPDATE'}
                                        </span>
                                    </div>
                                    <span className="text-[11px] text-white/40">{n} instance ({Math.round(pct)}%)</span>
                                </div>
                                <div className="w-full bg-white/[0.06] rounded-full h-2.5">
                                    <div className={`h-2.5 rounded-full transition-all duration-700 ${isLatest ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                        style={{ width: `${pct}%` }} />
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* License table */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead><tr className="border-b border-white/[0.06]">
                        <th className="text-left py-3 px-4"><SortHeader label="Client" field="client_name" currentSort={sf} currentDir={sd} onSort={onSort} /></th>
                        <th className="text-left py-3 px-3">Version</th>
                        <th className="text-left py-3 px-3">Plan</th>
                        <th className="text-left py-3 px-3">Expiry</th>
                        <th className="text-left py-3 px-3 min-w-[200px]">Sisa Waktu</th>
                    </tr></thead>
                    <tbody>{data.map(i => {
                        const days = daysUntil(i.license_expires)
                        const isOld = i.app_version !== latest
                        const planC: Record<string, string> = {
                            enterprise: 'bg-purple-500/15 text-purple-400 ring-purple-500/20',
                            pro: 'bg-blue-500/15 text-blue-400 ring-blue-500/20',
                            basic: 'bg-white/5 text-white/40 ring-white/10',
                        }
                        return (
                            <tr key={i.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                                <td className="py-3.5 px-4"><Link href={`/admin/monitoring/${i.id}`} className="font-semibold text-white/90 text-[13px] hover:text-amber-400 transition-colors">{i.client_name}</Link></td>
                                <td className="py-3.5 px-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] font-mono bg-white/[0.06] px-2 py-0.5 rounded text-white/60">{i.app_version}</span>
                                        {isOld && <span className="text-[10px] bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded-full font-semibold">⬆</span>}
                                    </div>
                                </td>
                                <td className="py-3.5 px-3">
                                    <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full capitalize ring-1 ${planC[i.license_plan] ?? planC.basic}`}>{i.license_plan}</span>
                                </td>
                                <td className="py-3.5 px-3">
                                    <span className="text-[13px] text-white/50">
                                        {i.license_expires ? new Date(i.license_expires).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                                    </span>
                                </td>
                                <td className="py-3.5 px-3">
                                    <div className="flex items-center gap-2.5">
                                        <div className="flex-1 bg-white/[0.06] rounded-full h-2 overflow-hidden">
                                            <div className={`h-2 rounded-full transition-all duration-700 ${days > 180 ? 'bg-emerald-500' : days > 90 ? 'bg-amber-500' : 'bg-red-500'}`}
                                                style={{ width: `${Math.min((days / 365) * 100, 100)}%` }} />
                                        </div>
                                        <span className={`text-[11px] font-semibold tabular-nums shrink-0 ${days > 180 ? 'text-emerald-400' : days > 90 ? 'text-amber-400' : 'text-red-400'}`}>
                                            {days > 0 ? `${days}d` : 'Expired'}
                                        </span>
                                    </div>
                                </td>
                            </tr>
                        )
                    })}</tbody>
                </table>
            </div>
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════ */
const TABS = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'ai', label: 'AI Pipeline', icon: Bot },
    { id: 'engagement', label: 'Engagement', icon: Users },
    { id: 'errors', label: 'Errors', icon: AlertTriangle },
    { id: 'versions', label: 'Versions', icon: Shield },
] as const
type TabId = typeof TABS[number]['id']

export default function AdminMonitoringPage() {
    const [instances, setInstances] = useState<ClientInstance[]>([])
    const [summary, setSummary] = useState<Summary>({ total: 0, online: 0, offline: 0, warning: 0 })
    const [loading, setLoading] = useState(true)
    const [tab, setTab] = useState<TabId>('overview')
    const [sortField, setSortField] = useState('client_name')
    const [sortDir, setSortDir] = useState<SortDir>('asc')
    const [lastRefresh, setLastRefresh] = useState(new Date())

    const fetchData = () => {
        setLoading(true)
        fetch('/api/monitoring/instances')
            .then(r => r.json())
            .then(d => {
                if (!d.error) { setInstances(d.instances ?? []); setSummary(d.summary ?? { total: 0, online: 0, offline: 0, warning: 0 }) }
                setLoading(false); setLastRefresh(new Date())
            })
            .catch(() => setLoading(false))
    }

    useEffect(() => { fetchData() }, [])
    useEffect(() => { const iv = setInterval(fetchData, 5000); return () => clearInterval(iv) }, [])

    const handleSort = (f: string) => {
        if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
        else { setSortField(f); setSortDir('desc') }
    }

    const sorted = useMemo(() => {
        return [...instances].sort((a: any, b: any) => {
            const va = a[sortField], vb = b[sortField]
            const cmp = typeof va === 'string' ? va.localeCompare(vb) : (va ?? 0) - (vb ?? 0)
            return sortDir === 'asc' ? cmp : -cmp
        })
    }, [instances, sortField, sortDir])

    if (loading && instances.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-32">
                <div className="w-10 h-10 border-[3px] border-white/10 border-t-amber-400 rounded-full animate-spin mb-4" />
                <p className="text-white/40 font-medium text-sm">Memuat data monitoring...</p>
            </div>
        )
    }

    const totalErrors = instances.reduce((s, i) => s + i.errors_error_24h, 0)

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold font-display text-white flex items-center gap-3">
                        <div className="w-9 h-9 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
                            <Server size={18} className="text-white" />
                        </div>
                        Instance Monitor
                    </h1>
                    <p className="text-[13px] text-white/40 mt-1">Monitoring semua instance Diamond KMS on-premise</p>
                </div>
                <button onClick={fetchData}
                    className="flex items-center gap-2 px-4 py-2 bg-white/[0.06] hover:bg-white/[0.10] text-white/70 hover:text-white rounded-xl text-[13px] font-semibold transition-all border border-white/[0.08]">
                    <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total', value: summary.total, icon: Database, gradient: 'from-slate-600 to-slate-800', iconBg: 'bg-slate-500/20 text-slate-300' },
                    { label: 'Online', value: summary.online, icon: CheckCircle2, gradient: 'from-emerald-600 to-emerald-800', iconBg: 'bg-emerald-500/20 text-emerald-300' },
                    { label: 'Offline', value: summary.offline, icon: XCircle, gradient: 'from-red-600 to-red-800', iconBg: 'bg-red-500/20 text-red-300' },
                    { label: 'Warning', value: summary.warning, icon: AlertCircle, gradient: 'from-amber-600 to-amber-800', iconBg: 'bg-amber-500/20 text-amber-300' },
                ].map(card => {
                    const Icon = card.icon
                    return (
                        <div key={card.label} className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-5 hover:bg-white/[0.06] transition-colors">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.iconBg}`}>
                                    <Icon size={18} />
                                </div>
                                <div>
                                    <p className="text-2xl font-black font-display text-white">{card.value}</p>
                                    <p className="text-[11px] text-white/30 font-semibold uppercase tracking-wider">{card.label}</p>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Tabs + Content */}
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
                {/* Tab Nav */}
                <div className="flex border-b border-white/[0.06] overflow-x-auto">
                    {TABS.map(t => {
                        const Icon = t.icon
                        const active = tab === t.id
                        return (
                            <button key={t.id} onClick={() => setTab(t.id)}
                                className={`flex items-center gap-2 px-5 py-3 text-[13px] font-semibold transition-all border-b-2 whitespace-nowrap ${
                                    active
                                        ? 'border-amber-400 text-amber-400 bg-amber-400/[0.04]'
                                        : 'border-transparent text-white/30 hover:text-white/60 hover:bg-white/[0.02]'
                                }`}>
                                <Icon size={14} />
                                {t.label}
                                {t.id === 'errors' && totalErrors > 0 && (
                                    <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">{totalErrors}</span>
                                )}
                            </button>
                        )
                    })}
                </div>

                {/* Content */}
                <div className="p-2">
                    {tab === 'overview' && <OverviewTab data={sorted} sf={sortField} sd={sortDir} onSort={handleSort} />}
                    {tab === 'ai' && <AIPipelineTab data={sorted} sf={sortField} sd={sortDir} onSort={handleSort} />}
                    {tab === 'engagement' && <EngagementTab data={sorted} sf={sortField} sd={sortDir} onSort={handleSort} />}
                    {tab === 'errors' && <ErrorsTab data={sorted} sf={sortField} sd={sortDir} onSort={handleSort} />}
                    {tab === 'versions' && <VersionsTab data={sorted} sf={sortField} sd={sortDir} onSort={handleSort} />}
                </div>
            </div>

            {/* Footer */}
            <p className="text-center text-[11px] text-white/20 pb-4">
                Update terakhir: {lastRefresh.toLocaleTimeString('id-ID')} · Live refresh setiap 5 detik
            </p>
        </div>
    )
}
