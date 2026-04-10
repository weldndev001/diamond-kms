'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
    ArrowLeft, Activity, Cpu, HardDrive, Database, Bot, Users,
    AlertTriangle, Shield, MessageSquare, CheckCircle2, XCircle,
    AlertCircle, Clock, Wifi, WifiOff, Server, Zap,
    BookOpen, Trophy, RefreshCw, MemoryStick,
    Key, KeyRound, Timer, Tag, Plug, Wrench,
    DatabaseBackup, ArrowUpCircle, Hourglass, Settings2
} from 'lucide-react'
import Link from 'next/link'

/* ───────── Types ───────── */
interface Instance {
    id: string; instance_key: string; client_name: string; app_version: string
    status: string; minutes_since_heartbeat: number
    cpu_percent: number; memory_percent: number; disk_percent: number; uptime_seconds: number
    db_status: string; db_size_mb: number; db_connections: number
    total_users: number; total_groups: number; total_documents: number; total_contents: number
    docs_pending: number; docs_failed: number
    ai_provider: string; ai_model: string; ai_status: string
    ai_avg_response_ms: number; ai_success_rate: number; ai_tokens_30d: number
    embedding_total: number; embedding_done: number; embedding_failed: number
    dau_today: number; chat_sessions_7d: number; quiz_completions_7d: number
    read_rate: number; avg_quiz_score: number; approval_pending: number
    errors_total_24h: number; errors_error_24h: number; errors_warn_24h: number
    health_score: number; latest_errors: any[] | null
    license_plan: string; license_expires: string | null
}

interface History {
    timestamps: string[]; cpu: number[]; memory: number[]; disk: number[]
    response_ms: number[]; success_rate: number[]; dau: number[]
    errors: number[]; health_score: number[]
}

/* ───────── SVG Line Chart ───────── */
function LineChart({ data, color, label, unit = '', min = 0, max: maxProp, height = 120, thresholds }: {
    data: number[]; color: string; label: string; unit?: string
    min?: number; max?: number; height?: number
    thresholds?: { warn: number; danger: number }
}) {
    if (data.length === 0) return null
    const max = maxProp ?? Math.max(...data, 1)
    const w = 100
    const h = height
    const padY = 8
    const usableH = h - padY * 2

    const points = data.map((v, i) => {
        const x = (i / (data.length - 1)) * w
        const y = padY + usableH - ((v - min) / (max - min)) * usableH
        return `${x},${y}`
    })

    const areaPoints = [...points, `${w},${h}`, `0,${h}`]
    const currentValue = data[data.length - 1]

    // Determine glow color based on thresholds
    let glowColor = color
    if (thresholds) {
        if (currentValue >= thresholds.danger) glowColor = '#ef4444'
        else if (currentValue >= thresholds.warn) glowColor = '#f59e0b'
    }

    return (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 hover:bg-white/[0.05] transition-colors">
            <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">{label}</span>
                <span className="text-lg font-bold tabular-nums" style={{ color: glowColor }}>
                    {Math.round(currentValue)}{unit}
                </span>
            </div>
            <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }}>
                <defs>
                    <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={glowColor} stopOpacity="0.3" />
                        <stop offset="100%" stopColor={glowColor} stopOpacity="0.02" />
                    </linearGradient>
                </defs>
                {/* Threshold lines */}
                {thresholds && (
                    <>
                        <line
                            x1="0" x2={w}
                            y1={padY + usableH - ((thresholds.warn - min) / (max - min)) * usableH}
                            y2={padY + usableH - ((thresholds.warn - min) / (max - min)) * usableH}
                            stroke="#f59e0b" strokeWidth="0.3" strokeDasharray="2,2" opacity="0.4"
                        />
                        <line
                            x1="0" x2={w}
                            y1={padY + usableH - ((thresholds.danger - min) / (max - min)) * usableH}
                            y2={padY + usableH - ((thresholds.danger - min) / (max - min)) * usableH}
                            stroke="#ef4444" strokeWidth="0.3" strokeDasharray="2,2" opacity="0.4"
                        />
                    </>
                )}
                {/* Area fill */}
                <polygon points={areaPoints.join(' ')} fill={`url(#grad-${label})`} />
                {/* Line */}
                <polyline points={points.join(' ')} fill="none" stroke={glowColor} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
                {/* Current value dot */}
                <circle cx={w} cy={parseFloat(points[points.length - 1].split(',')[1])} r="2.5" fill={glowColor} />
                <circle cx={w} cy={parseFloat(points[points.length - 1].split(',')[1])} r="5" fill={glowColor} opacity="0.2" />
            </svg>
            <div className="flex justify-between mt-1 text-[10px] text-white/20">
                <span>2.5h ago</span>
                <span>Now</span>
            </div>
        </div>
    )
}

/* ───────── Gauge Ring ───────── */
function GaugeRing({ value, max = 100, label, icon: Icon, colorClass = 'text-emerald-400', size = 80 }: {
    value: number; max?: number; label: string; icon: any; colorClass?: string; size?: number
}) {
    const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
    const r = (size - 10) / 2
    const circ = 2 * Math.PI * r
    const offset = circ - (pct / 100) * circ

    return (
        <div className="flex flex-col items-center gap-2 bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 hover:bg-white/[0.05] transition-colors">
            <div className="relative" style={{ width: size, height: size }}>
                <svg width={size} height={size} className="-rotate-90">
                    <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                    <circle cx={size / 2} cy={size / 2} r={r} fill="none" className={colorClass.replace('text-', 'stroke-')}
                        strokeWidth="6" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
                        style={{ transition: 'stroke-dashoffset 0.7s ease-out' }} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-lg font-bold tabular-nums ${colorClass}`}>{Math.round(pct)}%</span>
                </div>
            </div>
            <div className="flex items-center gap-1.5">
                <Icon size={12} className={colorClass} />
                <span className="text-[11px] font-semibold text-white/40">{label}</span>
            </div>
        </div>
    )
}

/* ───────── Bar Chart (vertical) ───────── */
function BarChart({ data, labels, color, label: title, height = 100 }: {
    data: number[]; labels: string[]; color: string; label: string; height?: number
}) {
    const max = Math.max(...data, 1)
    return (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <span className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">{title}</span>
            <div className="flex items-end gap-1.5 mt-3" style={{ height }}>
                {data.map((v, i) => {
                    const h = (v / max) * 100
                    return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                            <span className="text-[9px] text-white/30 tabular-nums">{Math.round(v)}</span>
                            <div className="w-full rounded-t" style={{ height: `${h}%`, backgroundColor: color, minHeight: 2, transition: 'height 0.7s ease-out' }} />
                            <span className="text-[9px] text-white/20 truncate w-full text-center">{labels[i]}</span>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

/* ───────── Status Badge ───────── */
function StatusBadge({ status, size = 'md' }: { status: string; size?: 'sm' | 'md' | 'lg' }) {
    const c: Record<string, { bg: string; dot: string; label: string }> = {
        online: { bg: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20', dot: 'bg-emerald-400', label: 'Online' },
        warning: { bg: 'bg-amber-500/10 text-amber-400 ring-amber-500/20', dot: 'bg-amber-400', label: 'Warning' },
        offline: { bg: 'bg-red-500/10 text-red-400 ring-red-500/20', dot: 'bg-red-400', label: 'Offline' },
        healthy: { bg: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20', dot: 'bg-emerald-400', label: 'Healthy' },
        degraded: { bg: 'bg-amber-500/10 text-amber-400 ring-amber-500/20', dot: 'bg-amber-400', label: 'Degraded' },
        down: { bg: 'bg-red-500/10 text-red-400 ring-red-500/20', dot: 'bg-red-400', label: 'Down' },
        connected: { bg: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20', dot: 'bg-emerald-400', label: 'Connected' },
        disconnected: { bg: 'bg-red-500/10 text-red-400 ring-red-500/20', dot: 'bg-red-400', label: 'Disconnected' },
    }
    const s = c[status] ?? c.offline
    const textSize = size === 'lg' ? 'text-sm px-3 py-1' : size === 'md' ? 'text-[11px] px-2 py-0.5' : 'text-[10px] px-1.5 py-0.5'
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold ring-1 ${s.bg} ${textSize}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${s.dot} ${status === 'online' || status === 'healthy' || status === 'connected' ? 'animate-pulse' : ''}`} />
            {s.label}
        </span>
    )
}

function formatUptime(s: number): string {
    if (s <= 0) return '—'
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600)
    return d > 0 ? `${d}d ${h}h` : `${h}h ${Math.floor((s % 3600) / 60)}m`
}

function daysUntil(d: string | null): number {
    if (!d) return 0
    return Math.max(0, Math.floor((new Date(d).getTime() - Date.now()) / 86400000))
}

function getHealthColor(v: number): string {
    if (v >= 80) return 'text-emerald-400'
    if (v >= 50) return 'text-amber-400'
    return 'text-red-400'
}

function getUsageColor(v: number): string {
    if (v < 60) return 'text-emerald-400'
    if (v < 80) return 'text-amber-400'
    return 'text-red-400'
}

/* ═══════════════════════════════════════════
   MAIN DETAIL PAGE
   ═══════════════════════════════════════════ */
export default function ClientDetailPage({ params }: { params: { id: string } }) {
    const { id } = params
    const router = useRouter()
    const [instance, setInstance] = useState<Instance | null>(null)
    const [history, setHistory] = useState<History | null>(null)
    const [loading, setLoading] = useState(true)

    const fetchData = () => {
        fetch(`/api/monitoring/instances/${id}`)
            .then(r => r.json())
            .then(d => {
                if (!d.error) { setInstance(d.instance); setHistory(d.history) }
                setLoading(false)
            })
            .catch(() => setLoading(false))
    }

    useEffect(() => { fetchData() }, [id])
    useEffect(() => { const iv = setInterval(fetchData, 5000); return () => clearInterval(iv) }, [id])

    if (loading && !instance) {
        return (
            <div className="flex flex-col items-center justify-center py-32">
                <div className="w-10 h-10 border-[3px] border-white/10 border-t-amber-400 rounded-full animate-spin mb-4" />
                <p className="text-white/40 font-medium text-sm">Loading detail...</p>
            </div>
        )
    }

    if (!instance) {
        return (
            <div className="text-center py-32">
                <p className="text-white/40">Instance tidak ditemukan</p>
                <button onClick={() => router.push('/admin/monitoring')} className="mt-4 text-amber-400 text-sm hover:underline">← Kembali</button>
            </div>
        )
    }

    const i = instance!
    const h = history

    const handleAction = (action: string) => {
        alert(`${action} for client ${i.client_name} triggered (Mock)`)
    }

    return (
        <div className="space-y-6 pb-12">
            {/* Back + Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <button onClick={() => router.push('/admin/monitoring')}
                        className="flex items-center gap-1.5 text-white/40 hover:text-amber-400 text-[13px] font-medium transition-colors mb-4">
                        <ArrowLeft size={14} /> Kembali ke Monitor
                    </button>
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20">
                            <Server size={26} className="text-white" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-0.5">
                                <h1 className="text-2xl font-bold font-display text-white">{i.client_name}</h1>
                                {i.approval_pending > 0 && (
                                    <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/15 text-amber-400 rounded-full text-[10px] font-bold animate-pulse ring-1 ring-amber-500/20 uppercase tracking-tighter">
                                        <Hourglass size={10} /> {i.approval_pending} Pending
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-3">
                                <StatusBadge status={i.status} size="md" />
                                <span className="text-[11px] font-mono bg-white/[0.06] px-2 py-0.5 rounded text-white/50">{i.app_version}</span>
                                <span className="text-[11px] text-white/30">{i.instance_key}</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="text-right">
                    <div className={`text-3xl font-black tabular-nums ${getHealthColor(i.health_score)}`}>{Math.round(i.health_score)}</div>
                    <div className="text-[10px] text-white/30 font-semibold uppercase tracking-wider">Health Score</div>
                </div>
            </div>

            {/* ═══════ QUCK MANAGEMENT SECTION ═══════ */}
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-3xl -mr-16 -mt-16 rounded-full" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-orange-500/5 blur-3xl -ml-16 -mb-16 rounded-full" />
                
                <div className="relative flex flex-col md:flex-row gap-6">
                    {/* Subscription Info */}
                    <div className="flex-1 space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-[14px] font-bold text-white/80 flex items-center gap-2">
                                <Shield size={16} className="text-amber-400" /> Subscription & License
                            </h2>
                            <span className={`text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider ring-1 ${
                                i.license_plan === 'enterprise' ? 'bg-purple-500/15 text-purple-400 ring-purple-500/20' :
                                i.license_plan === 'pro' ? 'bg-blue-500/15 text-blue-400 ring-blue-500/20' :
                                'bg-white/5 text-white/40 ring-white/10'}`}>
                                {i.license_plan} Tier
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
                                <div className="text-[10px] text-white/30 font-semibold uppercase tracking-wide mb-1 flex items-center gap-1.5">
                                    <Clock size={10} /> Valid Until
                                </div>
                                <div className="text-[14px] font-bold text-white/90">
                                    {i.license_expires ? new Date(i.license_expires).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
                                </div>
                            </div>
                            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
                                <div className="text-[10px] text-white/30 font-semibold uppercase tracking-wide mb-1 flex items-center gap-1.5">
                                    <Timer size={10} /> Time Remaining
                                </div>
                                {(() => {
                                    const days = daysUntil(i.license_expires)
                                    return (
                                        <div className={`text-[14px] font-bold ${days > 180 ? 'text-emerald-400' : days > 90 ? 'text-amber-400' : 'text-red-400'}`}>
                                            {days > 0 ? `${days} hari tersisa` : 'Expired'}
                                        </div>
                                    )
                                })()}
                            </div>
                        </div>
                    </div>

                    <div className="w-px bg-white/[0.08] hidden md:block" />

                    {/* Management Actions */}
                    <div className="flex-[1.5] space-y-4">
                        <h2 className="text-[14px] font-bold text-white/80 flex items-center gap-2">
                            <Settings2 size={16} className="text-amber-400" /> Management Actions
                        </h2>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <button 
                                onClick={() => handleAction('Generate Activation OTP')}
                                className="flex items-center gap-2.5 px-3 py-2 bg-gradient-to-r from-amber-500/10 to-transparent hover:from-amber-500/20 text-amber-400 border border-amber-500/20 rounded-xl text-[12px] font-semibold transition-all group">
                                <div className="w-7 h-7 bg-amber-500/20 rounded-lg flex items-center justify-center group-hover:bg-amber-500/30 transition-colors">
                                    <Key size={14} />
                                </div>
                                Generate Activation OTP
                            </button>
                            <button 
                                onClick={() => handleAction('Generate AI API Key')}
                                className="flex items-center gap-2.5 px-3 py-2 bg-gradient-to-r from-blue-500/10 to-transparent hover:from-blue-500/20 text-blue-400 border border-blue-500/20 rounded-xl text-[12px] font-semibold transition-all group">
                                <div className="w-7 h-7 bg-blue-500/20 rounded-lg flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
                                    <KeyRound size={14} />
                                </div>
                                Generate AI API Key
                            </button>
                            <button 
                                onClick={() => handleAction('Connect')}
                                className="flex items-center gap-2.5 px-3 py-2 bg-gradient-to-r from-emerald-500/10 to-transparent hover:from-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl text-[12px] font-semibold transition-all group">
                                <div className="w-7 h-7 bg-emerald-500/20 rounded-lg flex items-center justify-center group-hover:bg-emerald-500/30 transition-colors">
                                    <Plug size={14} />
                                </div>
                                Remote Connect
                            </button>
                            <button 
                                onClick={() => handleAction('Maintenance Mode')}
                                className="flex items-center gap-2.5 px-3 py-2 bg-gradient-to-r from-orange-500/10 to-transparent hover:from-orange-500/20 text-orange-400 border border-orange-500/20 rounded-xl text-[12px] font-semibold transition-all group">
                                <div className="w-7 h-7 bg-orange-500/20 rounded-lg flex items-center justify-center group-hover:bg-orange-500/30 transition-colors">
                                    <Wrench size={14} />
                                </div>
                                Maintenance Mode
                            </button>
                            <button 
                                onClick={() => handleAction('Backup Database')}
                                className="flex items-center gap-2.5 px-3 py-2 bg-gradient-to-r from-cyan-500/10 to-transparent hover:from-cyan-500/20 text-cyan-400 border border-cyan-500/20 rounded-xl text-[12px] font-semibold transition-all group">
                                <div className="w-7 h-7 bg-cyan-500/20 rounded-lg flex items-center justify-center group-hover:bg-cyan-500/30 transition-colors">
                                    <Database size={14} />
                                </div>
                                Backup Database
                            </button>
                            <button 
                                onClick={() => handleAction('Update Client')}
                                className="flex items-center gap-2.5 px-3 py-2 bg-gradient-to-r from-indigo-500/10 to-transparent hover:from-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-xl text-[12px] font-semibold transition-all group">
                                <div className="w-7 h-7 bg-indigo-500/20 rounded-lg flex items-center justify-center group-hover:bg-indigo-500/30 transition-colors">
                                    <ArrowUpCircle size={14} />
                                </div>
                                Update Client
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══════ SECTION 1: System Resources ═══════ */}
            <div>
                <h2 className="text-[13px] font-bold text-white/60 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Cpu size={14} className="text-amber-400" /> System Resources
                </h2>

                {/* Gauges */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    <GaugeRing value={i.cpu_percent} label="CPU" icon={Cpu} colorClass={getUsageColor(i.cpu_percent)} />
                    <GaugeRing value={i.memory_percent} label="RAM" icon={MemoryStick} colorClass={getUsageColor(i.memory_percent)} />
                    <GaugeRing value={i.disk_percent} label="Disk" icon={HardDrive} colorClass={getUsageColor(i.disk_percent)} />
                    <GaugeRing value={i.health_score} label="Health" icon={Activity} colorClass={getHealthColor(i.health_score)} />
                </div>

                {/* Line Charts */}
                {h && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <LineChart data={h.cpu} color="#10b981" label="CPU Usage" unit="%" max={100} thresholds={{ warn: 60, danger: 80 }} />
                        <LineChart data={h.memory} color="#3b82f6" label="Memory Usage" unit="%" max={100} thresholds={{ warn: 60, danger: 80 }} />
                        <LineChart data={h.disk} color="#8b5cf6" label="Disk Usage" unit="%" max={100} thresholds={{ warn: 70, danger: 90 }} />
                    </div>
                )}

                {/* System stats row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                    {[
                        { label: 'Uptime', value: formatUptime(i.uptime_seconds), icon: Clock },
                        { label: 'DB Status', value: i.db_status, icon: Database, badge: true },
                        { label: 'DB Size', value: i.db_size_mb >= 1000 ? `${(i.db_size_mb / 1000).toFixed(1)} GB` : `${Math.round(i.db_size_mb)} MB`, icon: Database },
                        { label: 'DB Connections', value: `${i.db_connections} active`, icon: Zap },
                    ].map(s => (
                        <div key={s.label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 flex items-center gap-3">
                            <s.icon size={16} className="text-white/20 shrink-0" />
                            <div>
                                <div className="text-[10px] text-white/30 font-semibold uppercase tracking-wider">{s.label}</div>
                                {s.badge ? <StatusBadge status={s.value} size="sm" /> : <div className="text-[13px] font-semibold text-white/80">{s.value}</div>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ═══════ SECTION 2: AI Pipeline ═══════ */}
            <div>
                <h2 className="text-[13px] font-bold text-white/60 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Bot size={14} className="text-amber-400" /> AI Pipeline
                </h2>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    {[
                        { label: 'Provider', value: i.ai_provider === 'self_hosted' ? 'Self-Hosted' : i.ai_provider === 'managed' ? 'Managed' : 'BYOK' },
                        { label: 'Model', value: i.ai_model, mono: true },
                        { label: 'Status', value: i.ai_status, badge: true },
                        { label: 'Tokens (30d)', value: `${(i.ai_tokens_30d / 1000).toFixed(0)}K` },
                    ].map(s => (
                        <div key={s.label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
                            <div className="text-[10px] text-white/30 font-semibold uppercase tracking-wider mb-1">{s.label}</div>
                            {s.badge ? <StatusBadge status={s.value} size="sm" /> :
                                <div className={`text-[13px] font-semibold text-white/80 ${s.mono ? 'font-mono' : ''}`}>{s.value}</div>}
                        </div>
                    ))}
                </div>

                {h && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <LineChart data={h.response_ms} color="#f59e0b" label="Avg Response Time" unit="ms" min={0} max={Math.max(...h.response_ms, 1000)} />
                        <LineChart data={h.success_rate} color="#10b981" label="Success Rate" unit="%" min={50} max={100} />
                    </div>
                )}

                {/* Embedding progress */}
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 mt-3">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">Embedding Progress</span>
                        <span className="text-[13px] font-semibold text-white/60">{i.embedding_done}/{i.embedding_total}</span>
                    </div>
                    <div className="w-full bg-white/[0.06] rounded-full h-3 overflow-hidden">
                        <div className="bg-emerald-500 h-3 rounded-full transition-all duration-700 shadow-sm shadow-emerald-500/30"
                            style={{ width: `${i.embedding_total > 0 ? (i.embedding_done / i.embedding_total) * 100 : 0}%` }} />
                    </div>
                    <div className="flex gap-4 mt-2 text-[11px]">
                        <span className="text-emerald-400">✓ {i.embedding_done} sukses</span>
                        {i.embedding_failed > 0 && <span className="text-red-400">✗ {i.embedding_failed} gagal</span>}
                        <span className="text-white/30">{i.embedding_total - i.embedding_done - i.embedding_failed} pending</span>
                    </div>
                </div>
            </div>

            {/* ═══════ SECTION 3: Engagement ═══════ */}
            <div>
                <h2 className="text-[13px] font-bold text-white/60 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Users size={14} className="text-amber-400" /> Engagement & Data
                </h2>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    <GaugeRing value={i.dau_today} max={i.total_users} label="DAU" icon={Users} colorClass={i.dau_today / i.total_users > 0.5 ? 'text-emerald-400' : 'text-amber-400'} />
                    <GaugeRing value={i.read_rate} label="Read Rate" icon={BookOpen} colorClass={i.read_rate >= 80 ? 'text-emerald-400' : 'text-amber-400'} />
                    <GaugeRing value={i.avg_quiz_score} label="Quiz Score" icon={Trophy} colorClass={i.avg_quiz_score >= 80 ? 'text-emerald-400' : 'text-amber-400'} />
                    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 flex flex-col items-center justify-center gap-1">
                        <div className="text-2xl font-bold text-white/90">{i.total_users}</div>
                        <div className="text-[10px] text-white/30 font-semibold">TOTAL USERS</div>
                        <div className="text-[11px] text-white/40">{i.total_groups} group</div>
                    </div>
                </div>

                {h && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <LineChart data={h.dau} color="#3b82f6" label="Daily Active Users" unit="" min={0} max={i.total_users} />
                        <BarChart
                            data={[i.total_documents, i.total_contents, i.docs_pending, i.docs_failed, i.chat_sessions_7d, i.quiz_completions_7d]}
                            labels={['Docs', 'Content', 'Pending', 'Failed', 'Chats', 'Quiz']}
                            color="#8b5cf6" label="Data & Activity"
                        />
                    </div>
                )}

                {i.approval_pending > 0 && (
                    <div className="mt-3 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-center gap-3">
                        <Clock size={16} className="text-amber-400" />
                        <span className="text-[13px] text-amber-400 font-semibold">{i.approval_pending} approval menunggu persetujuan</span>
                    </div>
                )}
            </div>

            {/* ═══════ SECTION 4: Errors ═══════ */}
            <div>
                <h2 className="text-[13px] font-bold text-white/60 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <AlertTriangle size={14} className="text-amber-400" /> Errors & Health
                </h2>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-white/90">{i.errors_total_24h}</div>
                        <div className="text-[10px] text-white/30 font-semibold uppercase">Total (24h)</div>
                    </div>
                    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-red-400">{i.errors_error_24h}</div>
                        <div className="text-[10px] text-white/30 font-semibold uppercase">ERROR</div>
                    </div>
                    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-amber-400">{i.errors_warn_24h}</div>
                        <div className="text-[10px] text-white/30 font-semibold uppercase">WARN</div>
                    </div>
                </div>

                {h && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <LineChart data={h.errors} color="#ef4444" label="Error Count (24h)" unit="" min={0} />
                        <LineChart data={h.health_score} color="#10b981" label="Health Score" unit="%" min={0} max={100} />
                    </div>
                )}

                {/* Error log */}
                {i.latest_errors && i.latest_errors.length > 0 && (
                    <div className="mt-4">
                        <h3 className="text-[12px] font-bold text-white/50 mb-2">Error Log Terbaru</h3>
                        <div className="space-y-1.5">
                            {i.latest_errors.map((e: any, idx: number) => (
                                <div key={idx} className="flex items-start gap-3 p-3 bg-white/[0.03] rounded-lg border border-white/[0.06]">
                                    <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold ${e.level === 'ERROR' ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'}`}>{e.level}</span>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 text-[11px] text-white/30">
                                            <span className="font-semibold text-white/50">{e.source}</span>
                                            <span>·</span>
                                            <span>{new Date(e.created_at).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}</span>
                                        </div>
                                        <p className="text-[13px] text-white/60 mt-0.5">{e.message}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* ═══════ SECTION 5: License ═══════ */}
            <div>
                <h2 className="text-[13px] font-bold text-white/60 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Shield size={14} className="text-amber-400" /> License & Info
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                        <div className="text-[10px] text-white/30 font-semibold uppercase mb-1">Plan</div>
                        <span className={`text-sm font-semibold px-2.5 py-0.5 rounded-full capitalize ring-1 ${
                            i.license_plan === 'enterprise' ? 'bg-purple-500/15 text-purple-400 ring-purple-500/20' :
                            i.license_plan === 'pro' ? 'bg-blue-500/15 text-blue-400 ring-blue-500/20' :
                            'bg-white/5 text-white/40 ring-white/10'}`}>
                            {i.license_plan}
                        </span>
                    </div>
                    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                        <div className="text-[10px] text-white/30 font-semibold uppercase mb-1">Expires</div>
                        <div className="text-[13px] font-semibold text-white/70">
                            {i.license_expires ? new Date(i.license_expires).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
                        </div>
                    </div>
                    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 col-span-2">
                        <div className="text-[10px] text-white/30 font-semibold uppercase mb-2">Sisa Lisensi</div>
                        {(() => {
                            const days = daysUntil(i.license_expires)
                            const color = days > 180 ? 'bg-emerald-500' : days > 90 ? 'bg-amber-500' : 'bg-red-500'
                            return (
                                <>
                                    <div className="w-full bg-white/[0.06] rounded-full h-2.5 overflow-hidden mb-1.5">
                                        <div className={`${color} h-2.5 rounded-full transition-all duration-700`} style={{ width: `${Math.min((days / 365) * 100, 100)}%` }} />
                                    </div>
                                    <span className={`text-sm font-bold ${days > 180 ? 'text-emerald-400' : days > 90 ? 'text-amber-400' : 'text-red-400'}`}>
                                        {days > 0 ? `${days} hari tersisa` : 'Expired!'}
                                    </span>
                                </>
                            )
                        })()}
                    </div>
                </div>
            </div>
        </div>
    )
}
