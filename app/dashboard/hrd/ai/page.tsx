'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getOrganizationAction, updateOrgAIConfigAction, getAvailableModelsAction, getAIUsageAction } from '@/lib/actions/admin.actions'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { RoleGuard } from '@/components/shared/RoleGuard'
import { Bot, Save, Server, Key, Link as LinkIcon, Cpu, RefreshCcw, MessageSquare, Zap, TrendingUp, User, Clock, Settings, Activity } from 'lucide-react'

export default function AIManagementPage() {
    const { organization } = useCurrentUser()
    const router = useRouter()

    // Tab state
    const [activeTab, setActiveTab] = useState<'settings' | 'usage'>('settings')

    return (
        <RoleGuard allowedRoles={['SUPER_ADMIN', 'MAINTAINER']}>
            <div className="space-y-6">
                <div>
                    <h1 className="text-[28px] font-bold font-display text-navy-900 leading-tight">AI Management</h1>
                    <p className="text-sm text-text-500 mt-1">Configure your AI provider settings and track token usage.</p>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-surface-200">
                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`px-4 py-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'settings' ? 'border-amber-500 text-amber-600' : 'border-transparent text-text-500 hover:text-navy-700 hover:border-surface-300'}`}
                    >
                        <Settings size={16} /> Configuration
                    </button>
                    <button
                        onClick={() => setActiveTab('usage')}
                        className={`px-4 py-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'usage' ? 'border-amber-500 text-amber-600' : 'border-transparent text-text-500 hover:text-navy-700 hover:border-surface-300'}`}
                    >
                        <Activity size={16} /> Usage Monitor
                    </button>
                </div>

                {/* Tab Content */}
                <div className="pt-2">
                    {activeTab === 'settings' ? <AISettingsTab organization={organization} router={router} /> : <AIUsageTab organization={organization} />}
                </div>
            </div>
        </RoleGuard>
    )
}

function AISettingsTab({ organization, router }: { organization: any, router: any }) {
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    // Form State
    const [provider, setProvider] = useState('managed')
    const [endpoint, setEndpoint] = useState('')
    const [apiKey, setApiKey] = useState('')
    const [chatModel, setChatModel] = useState('')
    const [embedModel, setEmbedModel] = useState('')
    const [autoSummaryChat, setAutoSummaryChat] = useState(false)

    // Model Discovery
    const [availableModels, setAvailableModels] = useState<string[]>([])
    const [isFetchingModels, setIsFetchingModels] = useState(false)

    const handleFetchModels = async () => {
        if (!organization?.id) return
        setIsFetchingModels(true)
        setError('')
        try {
            const res = await getAvailableModelsAction(organization.id, { provider, endpoint, apiKey })
            if (res.success && res.data) {
                setAvailableModels(res.data)
                setSuccess(`Successfully loaded ${res.data.length} models from provider.`)
            } else {
                setError(res.error || 'Failed to fetch models from the provider.')
            }
        } catch (err: any) {
            setError(err.message || 'An error occurred fetching models.')
        } finally {
            setIsFetchingModels(false)
        }
    }

    useEffect(() => {
        async function loadConfig() {
            if (!organization?.id) return

            setIsLoading(true)
            const res = await getOrganizationAction(organization.id)
            if (res.success && res.data?.ai_provider_config) {
                const config: any = res.data.ai_provider_config
                setProvider(config.provider || 'managed')
                setEndpoint(config.endpoint || '')
                setChatModel(config.chatModel || '')
                setEmbedModel(config.embedModel || '')
                setApiKey('')
                setAutoSummaryChat(config.autoSummaryChat ?? false)
            }
            setIsLoading(false)
        }
        loadConfig()
    }, [organization])

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!organization?.id) return

        setIsSaving(true)
        setError('')
        setSuccess('')

        const formData = new FormData()
        formData.append('orgId', organization.id)
        formData.append('provider', provider)
        if (endpoint) formData.append('endpoint', endpoint)
        if (apiKey) formData.append('apiKey', apiKey)
        if (chatModel) formData.append('chatModel', chatModel)
        if (embedModel) formData.append('embedModel', embedModel)
        formData.append('autoSummaryChat', String(autoSummaryChat))

        const res = await updateOrgAIConfigAction(formData)

        if (res.success) {
            setSuccess('AI configuration updated successfully.')
            setApiKey('')
            router.refresh()
        } else {
            setError(res.error || 'Failed to update configuration.')
        }

        setIsSaving(false)
    }

    if (isLoading) {
        return <div className="p-8 text-center text-text-500">Loading AI configuration...</div>
    }

    return (
        <div className="max-w-4xl space-y-6 animate-in fade-in duration-300">
            {error && <div className="p-4 bg-danger-bg text-danger rounded-lg border border-red-200 text-sm">{error}</div>}
            {success && <div className="p-4 bg-success-bg text-success rounded-lg border border-green-200 text-sm">{success}</div>}

            <form onSubmit={handleSave} className="bg-surface-0 p-6 rounded-xl border border-surface-200 shadow-sm space-y-8">
                {/* Provider Selection */}
                <div className="space-y-4">
                    <label className="block text-sm font-semibold text-navy-900">Provider Strategy</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                            { id: 'managed', label: 'Managed by WELDN_AI', desc: 'AI service dikelola oleh tim WELDN_AI' },
                            { id: 'byok', label: 'Bring Your Own Key', desc: 'Auto-detects Gemini or OpenAI APIs' },
                            { id: 'self_hosted', label: 'Local Server AI', desc: 'Connect to a local or custom endpoint' }
                        ].map((p) => (
                            <label key={p.id} className={`flex items-start p-4 rounded-lg border-2 cursor-pointer transition-colors ${provider === p.id ? 'border-amber-500 bg-amber-50' : 'border-surface-200 hover:border-navy-300'}`}>
                                <input
                                    type="radio"
                                    name="provider"
                                    value={p.id}
                                    checked={provider === p.id}
                                    onChange={(e) => setProvider(e.target.value)}
                                    className="pt-1 text-amber-500 focus:ring-amber-500"
                                />
                                <div className="ml-3">
                                    <div className="font-semibold text-navy-900">{p.label}</div>
                                    <div className="text-xs text-text-500 mt-0.5">{p.desc}</div>
                                </div>
                            </label>
                        ))}
                    </div>
                </div>

                {/* WELDN_AI Managed Service Fields */}
                {provider === 'managed' && (
                    <div className="p-5 bg-surface-50 border border-surface-200 rounded-lg space-y-5">
                        <div className="flex items-center gap-2 text-sm font-bold text-navy-900 mb-2">
                            <Server size={16} className="text-navy-500" />
                            WELDN_AI Service Configuration
                        </div>
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm font-medium text-navy-900">
                                <LinkIcon size={14} className="text-text-400" /> Service URL
                            </label>
                            <input
                                type="url"
                                value={endpoint}
                                onChange={(e) => setEndpoint(e.target.value)}
                                placeholder="https://api.weldn.ai/v1"
                                className="input-field font-mono text-sm"
                            />
                            <p className="text-xs text-text-400">URL endpoint layanan WELDN_AI yang ditentukan oleh tim.</p>
                        </div>
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm font-medium text-navy-900">
                                <Key size={14} className="text-text-400" /> API Key
                            </label>
                            <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="Masukkan API Key dari WELDN_AI..."
                                className="input-field font-mono text-sm"
                            />
                            <p className="text-xs text-text-400">API key disediakan oleh tim WELDN_AI saat aktivasi layanan.</p>
                        </div>
                    </div>
                )}

                {/* Conditional Fields based on Provider */}
                {provider === 'byok' && (
                    <div className="p-5 bg-surface-50 border border-surface-200 rounded-lg space-y-5">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 text-sm font-bold text-navy-900">
                                <Server size={16} className="text-navy-500" />
                                Connection Details
                            </div>
                            <button
                                type="button"
                                onClick={handleFetchModels}
                                disabled={isFetchingModels}
                                className="text-xs font-semibold text-amber-600 hover:text-amber-700 disabled:opacity-50 flex items-center gap-1.5"
                            >
                                {isFetchingModels ? <div className="w-3 h-3 border-2 border-amber-600/30 border-t-amber-600 rounded-full animate-spin" /> : <RefreshCcw size={12} />}
                                Load Available Models
                            </button>
                        </div>

                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm font-medium text-navy-900">
                                <Key size={14} className="text-text-400" /> API Key
                            </label>
                            <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="Leave blank to keep existing key, or enter new key..."
                                className="input-field font-mono text-sm"
                                required={!chatModel}
                            />
                            <p className="text-xs text-text-400">
                                Required for BYOK. Securely encrypted before storage.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2 border-t border-surface-200 mt-4">
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-medium text-navy-900">
                                    <Cpu size={14} className="text-text-400" /> Chat Model Name
                                </label>
                                {availableModels.length > 0 ? (
                                    <select
                                        value={chatModel}
                                        onChange={(e) => setChatModel(e.target.value)}
                                        className="input-field font-mono text-sm"
                                        required
                                    >
                                        <option value="" disabled>Select a model...</option>
                                        {availableModels.map(m => (
                                            <option key={`chat-${m}`} value={m}>{m}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        value={chatModel}
                                        onChange={(e) => setChatModel(e.target.value)}
                                        placeholder={provider === 'byok' ? 'gemini-2.5-flash / gpt-4o-mini' : 'llama3.3:70b'}
                                        className="input-field font-mono text-sm"
                                    />
                                )}
                            </div>
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-medium text-navy-900">
                                    <Cpu size={14} className="text-text-400" /> Embedding Model Name
                                </label>
                                {availableModels.length > 0 ? (
                                    <select
                                        value={embedModel}
                                        onChange={(e) => setEmbedModel(e.target.value)}
                                        className="input-field font-mono text-sm"
                                        required
                                    >
                                        <option value="" disabled>Select a model...</option>
                                        {availableModels.map(m => (
                                            <option key={`embed-${m}`} value={m}>{m}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        value={embedModel}
                                        onChange={(e) => setEmbedModel(e.target.value)}
                                        placeholder="nomic-embed-text"
                                        className="input-field font-mono text-sm"
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Chat Behavior Settings */}
                <div className="p-5 bg-surface-50 border border-surface-200 rounded-lg space-y-4">
                    <div className="flex items-center gap-2 text-sm font-bold text-navy-900">
                        <MessageSquare size={16} className="text-navy-500" />
                        Chat Behavior
                    </div>
                    <label className="flex items-center justify-between cursor-pointer">
                        <div>
                            <div className="text-sm font-medium text-navy-900">Auto-generate Chat Summary</div>
                            <div className="text-xs text-text-400 mt-0.5">Otomatis membuat ringkasan setiap percakapan setelah sesi berakhir.</div>
                        </div>
                        <div className="relative">
                            <input
                                type="checkbox"
                                checked={autoSummaryChat}
                                onChange={(e) => setAutoSummaryChat(e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-surface-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-surface-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                        </div>
                    </label>
                </div>

                <div className="flex justify-end pt-4 border-t border-surface-100">
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="btn btn-primary flex items-center gap-2"
                    >
                        {isSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={16} />}
                        Save Configuration
                    </button>
                </div>
            </form>
        </div>
    )
}

function AIUsageTab({ organization }: { organization: any }) {
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (organization?.id) {
            getAIUsageAction(organization.id).then(res => {
                if (res.success) setData(res.data)
                setLoading(false)
            })
        }
    }, [organization?.id])

    const stats = data?.stats || { totalTokens: 0, totalRequests: 0, byAction: {} }
    const logs = data?.logs || []

    const actionColors: Record<string, string> = {
        DOCUMENT_PROCESS: 'bg-navy-100 text-navy-700',
        SMART_SEARCH: 'bg-info-bg text-info',
        SUMMARIZE: 'bg-success-bg text-success',
        GENERATE: 'bg-warning-bg text-warning',
    }

    if (loading) {
        return <div className="p-8 text-center text-text-500">Loading AI usage stats...</div>
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div className="card p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-navy-100 text-navy-600 rounded-lg flex items-center justify-center">
                            <Zap size={20} />
                        </div>
                        <p className="text-text-500 text-xs font-semibold uppercase tracking-wider">Total Tokens</p>
                    </div>
                    <p className="text-3xl font-black font-display text-navy-900">{stats.totalTokens.toLocaleString()}</p>
                </div>
                <div className="card p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-success-bg text-success rounded-lg flex items-center justify-center">
                            <Cpu size={20} />
                        </div>
                        <p className="text-text-500 text-xs font-semibold uppercase tracking-wider">Total Requests</p>
                    </div>
                    <p className="text-3xl font-black font-display text-navy-900">{stats.totalRequests.toLocaleString()}</p>
                </div>
                <div className="card p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-warning-bg text-warning rounded-lg flex items-center justify-center">
                            <TrendingUp size={20} />
                        </div>
                        <p className="text-text-500 text-xs font-semibold uppercase tracking-wider">Action Types</p>
                    </div>
                    <p className="text-3xl font-black font-display text-navy-900">{Object.keys(stats.byAction).length}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Usage Breakdown */}
                <div className="lg:col-span-1">
                    <div className="card p-6 h-full">
                        <h2 className="font-bold font-display text-navy-900 mb-4 text-lg">Usage by Action Type</h2>
                        {Object.keys(stats.byAction).length > 0 ? (
                            <div className="space-y-4">
                                {Object.entries(stats.byAction).map(([action, tokens]) => {
                                    const pct = stats.totalTokens > 0 ? Math.round((tokens as number / stats.totalTokens) * 100) : 0
                                    return (
                                        <div key={action} className="space-y-1.5">
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="font-medium text-text-700">{action.replace(/_/g, ' ')}</span>
                                                <span className="text-text-500 font-medium">{(tokens as number).toLocaleString()}</span>
                                            </div>
                                            <div className="w-full bg-surface-100 rounded-full h-2 overflow-hidden">
                                                <div className="h-2 bg-navy-600 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        ) : (
                            <p className="text-sm text-text-500 italic block">Tidak ada rincian penggunaan aksi untuk saat ini.</p>
                        )}
                    </div>
                </div>

                {/* Recent Logs */}
                <div className="lg:col-span-2">
                    <div className="card overflow-hidden h-full flex flex-col">
                        <div className="p-5 border-b border-surface-200 bg-surface-0">
                            <h2 className="font-bold font-display text-navy-900 flex items-center gap-2">
                                <Bot size={18} className="text-navy-600" /> Recent AI Activity
                            </h2>
                        </div>

                        {logs.length === 0 ? (
                            <div className="p-12 text-center text-text-500 flex-1 flex flex-col items-center justify-center">
                                <Bot size={40} className="mx-auto text-surface-300 mb-3" />
                                No AI usage recorded yet.
                            </div>
                        ) : (
                            <div className="divide-y divide-surface-100 flex-1 overflow-y-auto max-h-[500px] scrollbar-thin">
                                {logs.map((log: any) => (
                                    <div key={log.id} className="p-4 hover:bg-surface-50 transition flex items-start sm:items-center gap-4 flex-col sm:flex-row">
                                        <div className="w-9 h-9 bg-surface-100 text-text-500 rounded-lg hidden sm:flex items-center justify-center shrink-0">
                                            <Bot size={18} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                                <span className={`badge ${actionColors[log.action_type] || 'bg-surface-100 text-text-700'}`}>
                                                    {log.action_type.replace(/_/g, ' ')}
                                                </span>
                                                <span className="text-xs text-text-500 flex items-center gap-1">
                                                    <User size={12} /> {log.user?.full_name || 'System'}
                                                </span>
                                            </div>
                                            {log.model_used && (
                                                <p className="text-xs text-text-400 font-mono">Model: {log.model_used}</p>
                                            )}
                                        </div>
                                        <div className="sm:text-right shrink-0 w-full sm:w-auto flex flex-row sm:flex-col justify-between sm:justify-center items-center sm:items-end">
                                            <p className="text-sm font-bold text-navy-900 bg-surface-50 sm:bg-transparent px-2 sm:px-0 py-1 rounded">
                                                {log.tokens_used.toLocaleString()} tokens
                                            </p>
                                            <p className="text-[11px] text-text-400 flex items-center gap-1 mt-1">
                                                <Clock size={12} /> {new Date(log.created_at).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
