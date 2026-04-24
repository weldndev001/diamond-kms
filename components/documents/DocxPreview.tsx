'use client'

import React, { useEffect, useState } from 'react'
import mammoth from 'mammoth'
import { Loader2, AlertCircle } from 'lucide-react'

interface DocxPreviewProps {
    fileUrl: string
}

export function DocxPreview({ fileUrl }: DocxPreviewProps) {
    const [html, setHtml] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const loadDocx = async () => {
            setLoading(true)
            setError(null)
            try {
                const response = await fetch(fileUrl)
                if (!response.ok) throw new Error('Gagal mengambil file')
                
                const arrayBuffer = await response.arrayBuffer()
                const result = await mammoth.convertToHtml({ arrayBuffer })
                
                setHtml(result.value)
                if (result.messages.length > 0) {
                    console.warn('Mammoth messages:', result.messages)
                }
            } catch (err: any) {
                console.error('Error loading DOCX:', err)
                setError(err.message || 'Gagal memproses pratinjau DOCX')
            } finally {
                setLoading(false)
            }
        }

        loadDocx()
    }, [fileUrl])

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8">
                <Loader2 size={32} className="text-navy-600 animate-spin mb-4" />
                <p className="text-sm text-text-500">Menyiapkan pratinjau dokumen...</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <AlertCircle size={40} className="text-danger mb-4" />
                <h3 className="font-bold text-navy-900 mb-2">Gagal Memuat Pratinjau</h3>
                <p className="text-sm text-text-500 max-w-sm">{error}</p>
            </div>
        )
    }

    return (
        <div className="w-full h-full overflow-auto bg-white p-8 md:p-12 shadow-inner">
            <div 
                className="prose prose-slate prose-sm md:prose-base max-w-4xl mx-auto"
                dangerouslySetInnerHTML={{ __html: html || '' }}
            />
        </div>
    )
}
