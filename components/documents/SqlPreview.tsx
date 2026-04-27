'use client'

import React, { useEffect, useState } from 'react'
import { Loader2, AlertCircle, Code } from 'lucide-react'

interface SqlPreviewProps {
    fileUrl: string
}

export function SqlPreview({ fileUrl }: SqlPreviewProps) {
    const [content, setContent] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const loadSql = async () => {
            setLoading(true)
            setError(null)
            try {
                const response = await fetch(fileUrl)
                if (!response.ok) throw new Error('Gagal mengambil file SQL')
                
                const text = await response.text()
                setContent(text)
            } catch (err: any) {
                console.error('Error loading SQL:', err)
                setError(err.message || 'Gagal memproses pratinjau SQL')
            } finally {
                setLoading(false)
            }
        }

        loadSql()
    }, [fileUrl])

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 bg-slate-950">
                <Loader2 size={32} className="text-blue-400 animate-spin mb-4" />
                <p className="text-sm text-slate-400">Menyiapkan pratinjau SQL...</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-slate-950">
                <AlertCircle size={40} className="text-red-400 mb-4" />
                <h3 className="font-bold text-slate-100 mb-2">Gagal Memuat Pratinjau</h3>
                <p className="text-sm text-slate-400 max-w-sm">{error}</p>
            </div>
        )
    }

    return (
        <div className="w-full h-full flex flex-col bg-slate-950 overflow-hidden">
            <div className="flex items-center gap-2 bg-slate-900/80 px-4 py-3 border-b border-slate-800 shrink-0">
                <Code size={16} className="text-blue-400" />
                <span className="text-xs font-mono font-medium text-slate-300">File SQL Explorer</span>
            </div>
            <div className="flex-1 overflow-auto p-4 md:p-6 custom-scrollbar">
                <pre className="text-[13px] leading-relaxed font-mono text-slate-300 whitespace-pre-wrap break-words">
                    <code>{content}</code>
                </pre>
            </div>
        </div>
    )
}
