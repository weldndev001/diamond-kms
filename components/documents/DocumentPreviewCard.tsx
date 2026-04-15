import React from 'react'
import { FileText, Download, File, FileImage, FileArchive, Shield } from 'lucide-react'
import { formatBytes } from '@/lib/utils'

interface DocumentPreviewCardProps {
    doc: {
        file_name: string
        file_size: number
        mime_type: string
        file_path: string
        uploader_name?: string
        created_at: Date | string
    }
}

export function DocumentPreviewCard({ doc }: DocumentPreviewCardProps) {
    const isImage = doc.mime_type.startsWith('image/')
    const isDoc = doc.mime_type.includes('word') || doc.file_name.endsWith('.docx') || doc.file_name.endsWith('.doc')
    const isArchive = doc.mime_type.includes('zip') || doc.mime_type.includes('rar')
    
    const getFileIcon = () => {
        if (isImage) return <FileImage size={48} className="text-navy-500" />
        if (isDoc) return <FileText size={48} className="text-blue-500" />
        if (isArchive) return <FileArchive size={48} className="text-amber-500" />
        return <File size={48} className="text-text-400" />
    }

    const downloadUrl = `/api/documents/pdf/${doc.file_path}`

    return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-surface-50">
            <div className="w-24 h-24 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-6 border border-surface-200">
                {getFileIcon()}
            </div>
            
            <h3 className="text-lg font-bold text-navy-900 mb-2 truncate max-w-full px-4">
                {doc.file_name}
            </h3>
            
            <div className="flex items-center gap-3 text-sm text-text-500 mb-8">
                <span>{formatBytes(doc.file_size)}</span>
                <span>•</span>
                <span className="uppercase">{doc.mime_type.split('/')[1] || 'Unknown'}</span>
            </div>

            <div className="grid grid-cols-1 gap-4 w-full max-w-[320px]">
                <a 
                    href={downloadUrl} 
                    download={doc.file_name}
                    className="btn btn-primary w-full flex items-center justify-center gap-2 py-3"
                >
                    <Download size={18} />
                    Unduh Dokumen
                </a>
                
                <div className="p-4 bg-navy-50 rounded-xl border border-navy-100 text-left">
                    <div className="flex items-start gap-3">
                        <Shield size={16} className="text-navy-600 mt-0.5" />
                        <div>
                            <p className="text-xs font-semibold text-navy-900 mb-1">Pratinjau Terbatas</p>
                            <p className="text-[11px] text-navy-700 leading-relaxed">
                                Format file ini tidak dapat ditampilkan langsung di browser. Silakan unduh untuk melihat konten lengkapnya.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-12 text-[10px] text-text-400">
                Diunggah pada {new Date(doc.created_at).toLocaleDateString('id-ID', { 
                    day: 'numeric', 
                    month: 'long', 
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                })}
                {doc.uploader_name && ` oleh ${doc.uploader_name}`}
            </div>
        </div>
    )
}
