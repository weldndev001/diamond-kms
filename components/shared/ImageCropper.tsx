'use client'

import React, { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import getCroppedImg from '@/lib/utils/cropImage'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog'
import { X, Check, ZoomIn, ZoomOut } from 'lucide-react'

interface ImageCropperProps {
    image: string
    isOpen: boolean
    onClose: () => void
    onCropComplete: (croppedImage: Blob) => void
    aspect?: number
}

export const ImageCropper: React.FC<ImageCropperProps> = ({
    image,
    isOpen,
    onClose,
    onCropComplete,
    aspect = 3 / 1, // Default for quiz header 1200x400
}) => {
    const [crop, setCrop] = useState({ x: 0, y: 0 })
    const [zoom, setZoom] = useState(1)
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null)

    const onCropChange = (crop: any) => setCrop(crop)
    const onZoomChange = (zoom: number) => setZoom(zoom)

    const onCropCompleteInternal = useCallback(
        (_croppedArea: any, croppedAreaPixels: any) => {
            setCroppedAreaPixels(croppedAreaPixels)
        },
        []
    )

    const handleCrop = async () => {
        try {
            const croppedImage = await getCroppedImg(image, croppedAreaPixels)
            if (croppedImage) {
                onCropComplete(croppedImage)
                onClose()
            }
        } catch (e) {
            console.error(e)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-[90vw] md:max-w-2xl bg-white dark:bg-slate-900 overflow-hidden rounded-[32px] p-0 border-none">
                <DialogHeader className="p-6 border-b border-slate-100 dark:border-slate-800">
                    <DialogTitle className="text-xl font-black font-display flex items-center gap-3 text-slate-900 dark:text-white">
                        Crop Header Image
                    </DialogTitle>
                </DialogHeader>

                <div className="relative w-full h-[400px] bg-slate-100 dark:bg-slate-950">
                    <Cropper
                        image={image}
                        crop={crop}
                        zoom={zoom}
                        aspect={aspect}
                        onCropChange={onCropChange}
                        onCropComplete={onCropCompleteInternal}
                        onZoomChange={onZoomChange}
                    />
                </div>

                <div className="p-6 space-y-6">
                    <div className="flex items-center gap-4">
                        <ZoomOut size={20} className="text-slate-400" />
                        <input
                            type="range"
                            min={1}
                            max={3}
                            step={0.1}
                            value={zoom}
                            onChange={(e) => setZoom(Number(e.target.value))}
                            className="flex-1 accent-navy-600 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full appearance-none cursor-pointer"
                        />
                        <ZoomIn size={20} className="text-slate-400" />
                    </div>

                    <DialogFooter className="flex gap-3 sm:justify-end border-t border-slate-100 dark:border-slate-800 pt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2.5 text-slate-500 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-all flex items-center gap-2"
                        >
                            <X size={18} /> Batal
                        </button>
                        <button
                            type="button"
                            onClick={handleCrop}
                            className="px-8 py-2.5 bg-navy-600 hover:bg-navy-700 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-navy-600/20 active:scale-95 transition-all flex items-center gap-2"
                        >
                            <Check size={18} /> Potong & Simpan
                        </button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    )
}
