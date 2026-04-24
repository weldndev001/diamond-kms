'use client'

import React, { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import { Loader2, AlertCircle, FileSpreadsheet, List } from 'lucide-react'

interface XlsxPreviewProps {
    fileUrl: string
}

export function XlsxPreview({ fileUrl }: XlsxPreviewProps) {
    const [sheets, setSheets] = useState<{ name: string; html: string }[]>([])
    const [activeSheetIndex, setActiveSheetIndex] = useState(0)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const loadXlsx = async () => {
            setLoading(true)
            setError(null)
            try {
                const response = await fetch(fileUrl)
                if (!response.ok) throw new Error('Gagal mengambil file')
                
                const arrayBuffer = await response.arrayBuffer()
                const workbook = XLSX.read(arrayBuffer, { type: 'array' })
                
                const sheetsData = workbook.SheetNames.map(name => {
                    const worksheet = workbook.Sheets[name]
                    // Convert to HTML table
                    const html = XLSX.utils.sheet_to_html(worksheet, { id: `sheet-${name}` })
                    return { name, html }
                })
                
                setSheets(sheetsData)
            } catch (err: any) {
                console.error('Error loading XLSX:', err)
                setError(err.message || 'Gagal memproses pratinjau XLSX')
            } finally {
                setLoading(false)
            }
        }

        loadXlsx()
    }, [fileUrl])

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8">
                <Loader2 size={32} className="text-navy-600 animate-spin mb-4" />
                <p className="text-sm text-text-500">Menyiapkan pratinjau spreadsheet...</p>
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

    if (sheets.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center text-text-400">
                <FileSpreadsheet size={40} className="mb-2" />
                <p>Dokumen Excel kosong</p>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full bg-white overflow-hidden">
            {/* Sheet Tabs */}
            {sheets.length > 1 && (
                <div className="flex items-center gap-1 p-2 bg-surface-50 border-b overflow-x-auto scrollbar-thin">
                    <div className="flex items-center gap-2 px-3 py-1 text-xs font-bold text-navy-900 border-r mr-2">
                        <List size={14} /> Sheets:
                    </div>
                    {sheets.map((sheet, index) => (
                        <button
                            key={index}
                            onClick={() => setActiveSheetIndex(index)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                                activeSheetIndex === index 
                                ? 'bg-navy-600 text-white shadow-sm' 
                                : 'text-text-600 hover:bg-surface-200'
                            }`}
                        >
                            {sheet.name}
                        </button>
                    ))}
                </div>
            )}

            {/* Table Area */}
            <div className="flex-1 overflow-auto p-4 md:p-8 scrollbar-thin">
                <div className="max-w-max mx-auto shadow-sm border rounded-lg overflow-hidden">
                    <style dangerouslySetInnerHTML={{ __html: `
                        .xlsx-preview table { border-collapse: collapse; width: 100%; background: white; }
                        .xlsx-preview th, .xlsx-preview td { border: 1px solid #e2e8f0; padding: 12px 16px; text-align: left; font-size: 13px; }
                        .xlsx-preview th { background: #f8fafc; font-weight: 700; color: #1e293b; position: sticky; top: 0; }
                        .xlsx-preview tr:hover td { background: #f1f5f9; }
                    `}} />
                    <div 
                        className="xlsx-preview prose prose-slate max-w-none prose-sm"
                        dangerouslySetInnerHTML={{ __html: sheets[activeSheetIndex].html }}
                    />
                </div>
            </div>
        </div>
    )
}
