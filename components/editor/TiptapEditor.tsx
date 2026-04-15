'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import TiptapImage from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import {
    Bold, Italic, Underline as UnderlineIcon, Strikethrough,
    List, ListOrdered, Heading1, Heading2, Heading3,
    Quote, Code, Undo, Redo, Link as LinkIcon, BookOpen, Image as ImageIcon, Loader2
} from 'lucide-react'
import { uploadFileAction } from '@/lib/actions/storage.actions'
import { useRef, useState } from 'react'
import { compressImage } from '@/lib/utils/image'

interface TiptapEditorProps {
    content: string
    onChange: (html: string) => void
    onOpenSources?: () => void
    orgId?: string
}

export function TiptapEditor({ content, onChange, onOpenSources, orgId }: TiptapEditorProps) {
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [uploading, setUploading] = useState(false)

    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3] },
            }),
            Underline,
            Link.configure({ openOnClick: false }),
            TiptapImage.configure({
                allowBase64: true,
                HTMLAttributes: {
                    class: 'rounded-lg max-w-full h-auto my-4',
                },
            }),
            Placeholder.configure({ placeholder: 'Start writing your article content here...' }),
        ],
        content,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML())
        },
        editorProps: {
            attributes: {
                class: 'tiptap prose prose-slate max-w-none min-h-[400px] p-4 focus:outline-none',
            },
        },
    })

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !editor) return
        if (!orgId) {
            alert('ID Organisasi tidak ditemukan. Silakan muat ulang halaman.')
            return
        }

        console.log('[Tiptap] Uploading image:', file.name, file.type, file.size)
        setUploading(true)
        try {
            const base64data = await compressImage(file)
            console.log('[Tiptap] Image compressed, base64 length:', base64data?.length)
            
            if (base64data) {
                editor.chain().focus().setImage({ src: base64data }).run()
                console.log('[Tiptap] Editor setImage executed')
            } else {
                throw new Error('Compression returned empty data')
            }
            
            setUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        } catch (error) {
            console.error('[Tiptap] Image processing failed:', error)
            alert('Gagal memproses gambar content body: ' + (error instanceof Error ? error.message : 'Unknown error'))
            setUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    if (!editor) return null

    const ToolButton = ({ onClick, isActive, children, title }: any) => (
        <button
            type="button"
            onClick={onClick}
            title={title}
            className={`p-2 rounded transition ${isActive ? 'bg-navy-100 text-navy-700' : 'text-text-500 hover:bg-surface-100 hover:text-navy-900'}`}
        >
            {children}
        </button>
    )

    return (
        <div className="border border-surface-200 rounded-lg overflow-hidden bg-white shadow-sm">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-0.5 p-2 bg-surface-50 border-b border-surface-200">
                <ToolButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} title="Bold">
                    <Bold size={16} />
                </ToolButton>
                <ToolButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} title="Italic">
                    <Italic size={16} />
                </ToolButton>
                <ToolButton onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')} title="Underline">
                    <UnderlineIcon size={16} />
                </ToolButton>
                <ToolButton onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive('strike')} title="Strikethrough">
                    <Strikethrough size={16} />
                </ToolButton>

                <div className="w-px h-6 bg-surface-200 mx-1" />

                <ToolButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive('heading', { level: 1 })} title="Heading 1">
                    <Heading1 size={16} />
                </ToolButton>
                <ToolButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive('heading', { level: 2 })} title="Heading 2">
                    <Heading2 size={16} />
                </ToolButton>
                <ToolButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} isActive={editor.isActive('heading', { level: 3 })} title="Heading 3">
                    <Heading3 size={16} />
                </ToolButton>

                <div className="w-px h-6 bg-surface-200 mx-1" />

                <ToolButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')} title="Bullet List">
                    <List size={16} />
                </ToolButton>
                <ToolButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')} title="Ordered List">
                    <ListOrdered size={16} />
                </ToolButton>
                <ToolButton onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive('blockquote')} title="Blockquote">
                    <Quote size={16} />
                </ToolButton>
                <ToolButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} isActive={editor.isActive('codeBlock')} title="Code Block">
                    <Code size={16} />
                </ToolButton>

                <div className="w-px h-6 bg-surface-200 mx-1" />

                <ToolButton
                    onClick={() => {
                        const url = prompt('Enter link URL:')
                        if (url) editor.chain().focus().setLink({ href: url }).run()
                    }}
                    isActive={editor.isActive('link')}
                    title="Insert Link"
                >
                    <LinkIcon size={16} />
                </ToolButton>

                <ToolButton
                    onClick={() => fileInputRef.current?.click()}
                    title="Insert Image"
                    isActive={uploading}
                >
                    {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />}
                </ToolButton>
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleImageUpload}
                />

                <div className="w-px h-6 bg-surface-200 mx-1" />

                <ToolButton onClick={() => editor.chain().focus().undo().run()} title="Undo">
                    <Undo size={16} />
                </ToolButton>
                <ToolButton onClick={() => editor.chain().focus().redo().run()} title="Redo">
                    <Redo size={16} />
                </ToolButton>

                {onOpenSources && (
                    <>
                        <div className="flex-1" />
                        <button
                            type="button"
                            onClick={onOpenSources}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-navy-600 bg-navy-50 border border-navy-200 rounded hover:bg-navy-100 transition"
                        >
                            <BookOpen size={14} /> Link Sources
                        </button>
                    </>
                )}
            </div>

            {/* Editor Area */}
            <EditorContent editor={editor} />
        </div>
    )
}
