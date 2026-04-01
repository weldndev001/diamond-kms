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
        <RoleGuard allowedRoles={['SUPER_ADMIN', 'MAINTAINER', 'SUPERVISOR']}>
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
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
    const [systemPrompt, setSystemPrompt] = useState('')
    const [temperature, setTemperature] = useState<number>(0.7)

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
                setSystemPrompt(config.systemPrompt || '')
                setTemperature(config.temperature ?? 0.7)
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
        formData.append('systemPrompt', systemPrompt)
        formData.append('temperature', String(temperature))

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

    if (isLoading) {
        return <div className="p-8 text-center text-text-500">Loading AI configuration...</div>
    }

    return (
        <div className="max-w-4xl space-y-6 animate-in fade-in duration-300">
            <div className="bg-surface-0 p-8 rounded-xl border border-surface-200 shadow-sm text-center">
                <div className="w-16 h-16 bg-navy-50 text-navy-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Settings size={28} />
                </div>
                <h3 className="text-xl font-bold text-navy-900 mb-2">Configuration Managed via Environment Variables</h3>
                <p className="text-text-500 max-w-lg mx-auto mb-6">
                    For enhanced security and centralized control, all AI configurations (Provider, Endpoint, Models, Temperature, and API Keys) are now managed directly through the server's <code>.env</code> file.
                </p>
                <div className="text-sm font-mono text-left bg-surface-50 p-6 rounded-lg border border-surface-200 max-w-2xl mx-auto overflow-x-auto whitespace-pre">
                    <span className="text-text-400 block mb-2">// Example .env configuration:</span>
                    <span className="text-navy-700 font-semibold block">AI_PROVIDER="self_hosted"</span>
                    <span className="text-navy-700 font-semibold block">AI_ENDPOINT="https://llm01.weldn.ai/olla/openai/v1"</span>
                    <span className="text-navy-700 font-semibold block">AI_CHAT_MODEL="Qwen3.5-4B-Q4_K_M-unsloth.gguf"</span>
                    <span className="text-navy-700 font-semibold block">AI_EMBED_MODEL="Qwen3-Embedding-0.6B-Q8_0.gguf"</span>
                    <span className="text-navy-700 font-semibold block">AI_HYBRID_EMBED="false"</span>
                    <span className="text-navy-700 font-semibold block">AI_API_KEY="400cb90781a7e8b7365df43c0..."</span>
                    <span className="text-navy-700 font-semibold block">AI_TEMPERATURE="0.7"</span>
                </div>
            </div>
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
                            <p className="text-sm text-text-500 italic block">No action usage breakdown available at this time.</p>
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
