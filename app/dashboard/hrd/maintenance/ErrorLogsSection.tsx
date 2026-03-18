'use client'

import { useState, useEffect } from 'react'
import { AlertCircle, Terminal, ChevronDown, ChevronRight, Filter } from 'lucide-react'

type LogLevel = 'ERROR' | 'WARN' | 'INFO'

interface ErrorLog {
    id: string
    level: LogLevel
    source: string
    message: string
    stack_trace: string | null
    url: string | null
    method: string | null
    created_at: string
}

export function ErrorLogsSection() {
    const [logs, setLogs] = useState<ErrorLog[]>([])
    const [loading, setLoading] = useState(true)
    const [filterLevel, setFilterLevel] = useState<LogLevel | 'ALL'>('ALL')
    const [expandedId, setExpandedId] = useState<string | null>(null)

    const fetchLogs = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/admin/error-logs?level=${filterLevel}&limit=50`)
            if (res.ok) {
                const json = await res.json()
                if (json.success) setLogs(json.data)
            }
        } catch (e) {
            console.error('Failed to fetch error logs', e)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchLogs()
    }, [filterLevel])

    const getLevelBadge = (level: string) => {
        switch (level) {
            case 'ERROR': return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-danger-bg text-danger">ERROR</span>
            case 'WARN': return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-warning-bg text-warning">WARN</span>
            case 'INFO': return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-info-bg text-info">INFO</span>
            default: return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-surface-200 text-text-500">{level}</span>
        }
    }

    return (
        <div className="card overflow-hidden mt-6">
            <div className="p-5 border-b border-surface-200 bg-surface-0 flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
                <h2 className="font-bold font-display text-navy-900 flex items-center gap-2">
                    <Terminal size={18} className="text-navy-600" /> Error Logs
                </h2>

                <div className="flex items-center gap-2 text-sm">
                    <Filter size={14} className="text-text-400" />
                    <select
                        value={filterLevel}
                        onChange={(e) => setFilterLevel(e.target.value as any)}
                        className="bg-surface-50 border border-surface-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-navy-500"
                    >
                        <option value="ALL">All Levels</option>
                        <option value="ERROR">Errors Only</option>
                        <option value="WARN">Warnings Only</option>
                        <option value="INFO">Info Only</option>
                    </select>
                    <button
                        onClick={fetchLogs}
                        className="btn btn-secondary text-xs px-3 py-1 ml-2"
                        disabled={loading}
                    >
                        {loading ? 'Loading...' : 'Refresh'}
                    </button>
                </div>
            </div>

            <div className="divide-y divide-surface-100 max-h-[500px] overflow-y-auto">
                {loading && logs.length === 0 ? (
                    <div className="p-8 text-center text-text-400 text-sm">Loading system logs...</div>
                ) : logs.length === 0 ? (
                    <div className="p-8 text-center text-text-400 flex flex-col items-center justify-center gap-2">
                        <AlertCircle size={24} className="text-surface-300" />
                        <p>No log records found.</p>
                    </div>
                ) : (
                    logs.map(log => {
                        const isExpanded = expandedId === log.id
                        return (
                            <div key={log.id} className="flex flex-col hover:bg-surface-50 transition">
                                <button
                                    className="p-4 flex items-start gap-3 w-full text-left focus:outline-none"
                                    onClick={() => setExpandedId(isExpanded ? null : log.id)}
                                >
                                    <div className="mt-1 text-text-400 shrink-0">
                                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            {getLevelBadge(log.level)}
                                            <span className="text-xs font-mono text-text-400 truncate max-w-[200px]">{log.source}</span>
                                            <span className="text-xs text-text-300 ml-auto whitespace-nowrap">
                                                {new Date(log.created_at).toLocaleString('en-US')}
                                            </span>
                                        </div>
                                        <p className="font-medium text-sm text-navy-900 line-clamp-2 md:line-clamp-1 break-words">
                                            {log.message}
                                        </p>
                                    </div>
                                </button>

                                {isExpanded && (
                                    <div className="pl-11 pr-4 pb-4 bg-surface-50/50">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 text-xs">
                                            {log.url && (
                                                <div>
                                                    <span className="text-text-400 font-semibold block mb-1">URL:</span>
                                                    <code className="bg-surface-100 px-2 py-1 rounded break-all">{log.method ? `[${log.method}] ` : ''}{log.url}</code>
                                                </div>
                                            )}
                                            <div>
                                                <span className="text-text-400 font-semibold block mb-1">ID Log:</span>
                                                <code className="bg-surface-100 px-2 py-1 rounded text-text-500">{log.id}</code>
                                            </div>
                                        </div>

                                        {log.stack_trace && (
                                            <div>
                                                <span className="text-text-400 text-xs font-semibold block mb-1">Stack Trace:</span>
                                                <pre className="bg-navy-900 text-green-400 p-3 rounded-lg text-[11px] overflow-x-auto whitespace-pre-wrap max-h-60 overflow-y-auto">
                                                    {log.stack_trace}
                                                </pre>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    )
}
