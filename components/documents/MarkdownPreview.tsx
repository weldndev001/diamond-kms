'use client'

import React, { useEffect, useState } from 'react'
import { Loader2, AlertCircle, FileText } from 'lucide-react'

interface MarkdownPreviewProps {
    fileUrl: string
}

export function MarkdownPreview({ fileUrl }: MarkdownPreviewProps) {
    const [content, setContent] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const loadMarkdown = async () => {
            setLoading(true)
            setError(null)
            try {
                const response = await fetch(fileUrl)
                if (!response.ok) throw new Error('Gagal mengambil file')
                
                const text = await response.text()
                setContent(text)
            } catch (err: any) {
                console.error('Error loading Markdown:', err)
                setError(err.message || 'Gagal memproses pratinjau Markdown')
            } finally {
                setLoading(false)
            }
        }

        loadMarkdown()
    }, [fileUrl])

    // Simple markdown-to-HTML sanitizer/converter
    const parseMarkdown = (md: string) => {
        if (!md) return ''
        
        let html = md
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            
        // Basic Markdown transformations (simplified)
        // Headers
        html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>')
        html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>')
        html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>')
        
        // Bold
        html = html.replace(/\*\*(.*)\*\*/gim, '<b>$1</b>')
        
        // Italic
        html = html.replace(/\*(.*)\*/gim, '<i>$1</i>')
        
        // Blockquotes
        html = html.replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
        
        // Unordered lists
        html = html.replace(/^\- (.*$)/gim, '<li>$1</li>')
        
        // Code blocks
        html = html.replace(/\`\`\`([\s\S]*?)\`\`\`/gim, '<pre><code>$1</code></pre>')
        
        // Inline code
        html = html.replace(/\`(.*)\`/gim, '<code>$1</code>')
        
        // Paragraphs (surround lines with <p> if not already in a tag)
        // This is tricky, a better way is to split by double newlines
        return html.split(/\n\n+/).map(p => {
            if (p.trim().startsWith('<')) return p
            return `<p>${p.replace(/\n/g, '<br/>')}</p>`
        }).join('')
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8">
                <Loader2 size={32} className="text-navy-600 animate-spin mb-4" />
                <p className="text-sm text-text-500">Menyiapkan pratinjau Markdown...</p>
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
                className="prose prose-slate prose-sm md:prose-base max-w-4xl mx-auto dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: parseMarkdown(content || '') }}
            />
        </div>
    )
}
