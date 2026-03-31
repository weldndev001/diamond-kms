'use client'

import React, { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import { X, Check, RotateCw, ZoomIn, ZoomOut } from 'lucide-react'

interface ImageCropperProps {
    image: string
    onCropComplete: (croppedImage: Blob) => void
    onCancel: () => void
    aspect?: number
}

export default function ImageCropper({ image, onCropComplete, onCancel, aspect = 1 }: ImageCropperProps) {
    const [crop, setCrop] = useState({ x: 0, y: 0 })
    const [zoom, setZoom] = useState(1)
    const [rotation, setRotation] = useState(0)
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null)

    const onCropChange = (crop: any) => {
        setCrop(crop)
    }

    const onZoomChange = (zoom: number) => {
        setZoom(zoom)
    }

    const onRotationChange = (rotation: number) => {
        setRotation(rotation)
    }

    const onCropCompleteInternal = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels)
    }, [])

    const createImage = (url: string): Promise<HTMLImageElement> =>
        new Promise((resolve, reject) => {
            const image = new Image()
            image.addEventListener('load', () => resolve(image))
            image.addEventListener('error', (error) => reject(error))
            image.setAttribute('crossOrigin', 'anonymous')
            image.src = url
        })

    const getCroppedImg = async (
        imageSrc: string,
        pixelCrop: any,
        rotation = 0
    ): Promise<Blob | null> => {
        const image = await createImage(imageSrc)
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')

        if (!ctx) return null

        const rotRad = (rotation * Math.PI) / 180
        const { width: bBoxWidth, height: bBoxHeight } = rotateSize(
            image.width,
            image.height,
            rotation
        )

        canvas.width = bBoxWidth
        canvas.height = bBoxHeight

        ctx.translate(bBoxWidth / 2, bBoxHeight / 2)
        ctx.rotate(rotRad)
        ctx.translate(-image.width / 2, -image.height / 2)

        ctx.drawImage(image, 0, 0)

        const data = ctx.getImageData(
            pixelCrop.x,
            pixelCrop.y,
            pixelCrop.width,
            pixelCrop.height
        )

        canvas.width = pixelCrop.width
        canvas.height = pixelCrop.height

        ctx.putImageData(data, 0, 0)

        return new Promise((resolve) => {
            canvas.toBlob((file) => {
                resolve(file)
            }, 'image/png')
        })
    }

    const rotateSize = (width: number, height: number, rotation: number) => {
        const rotRad = (rotation * Math.PI) / 180
        return {
            width:
                Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
            height:
                Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
        }
    }

    const handleConfirm = async () => {
        try {
            const croppedImage = await getCroppedImg(image, croppedAreaPixels, rotation)
            if (croppedImage) {
                onCropComplete(croppedImage)
            }
        } catch (e) {
            console.error(e)
        }
    }

    return (
        <div className="fixed inset-0 z-[100] flex flex-col bg-navy-950/90 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="flex items-center justify-between p-4 border-b border-white/10 text-white">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-navy-800 rounded-lg">
                        <Check size={20} className="text-amber-400" />
                    </div>
                    <span className="font-bold font-display tracking-wide">Adjust Your Logo</span>
                </div>
                <button onClick={onCancel} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <X size={24} />
                </button>
            </div>

            <div className="relative flex-1 bg-[#1a1a1a]">
                <Cropper
                    image={image}
                    crop={crop}
                    zoom={zoom}
                    rotation={rotation}
                    aspect={aspect}
                    onCropChange={onCropChange}
                    onCropComplete={onCropCompleteInternal}
                    onZoomChange={onZoomChange}
                    onRotationChange={onRotationChange}
                />
            </div>

            <div className="p-6 bg-navy-900 border-t border-white/10 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center max-w-4xl mx-auto">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between text-navy-200 text-xs font-bold uppercase tracking-widest">
                            <div className="flex items-center gap-2">
                                <ZoomIn size={14} /> Zoom Level
                            </div>
                            <span>{Math.round(zoom * 100)}%</span>
                        </div>
                        <input
                            type="range"
                            value={zoom}
                            min={1}
                            max={3}
                            step={0.1}
                            aria-labelledby="Zoom"
                            onChange={(e) => setZoom(Number(e.target.value))}
                            className="w-full h-1.5 bg-navy-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                        />
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between text-navy-200 text-xs font-bold uppercase tracking-widest">
                            <div className="flex items-center gap-2">
                                <RotateCw size={14} /> Rotation
                            </div>
                            <span>{rotation}°</span>
                        </div>
                        <input
                            type="range"
                            value={rotation}
                            min={0}
                            max={360}
                            step={1}
                            aria-labelledby="Rotation"
                            onChange={(e) => setRotation(Number(e.target.value))}
                            className="w-full h-1.5 bg-navy-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                        />
                    </div>
                </div>

                <div className="flex justify-center gap-4 pt-2">
                    <button
                        onClick={onCancel}
                        className="px-8 py-3 rounded-xl border border-white/20 text-white font-semibold hover:bg-white/5 transition-all active:scale-95"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        className="px-10 py-3 rounded-xl bg-amber-500 text-navy-950 font-bold hover:bg-amber-400 shadow-lg shadow-amber-500/20 transition-all active:scale-95 flex items-center gap-2"
                    >
                        <Check size={20} />
                        Apply & Save
                    </button>
                </div>
            </div>
        </div>
    )
}
