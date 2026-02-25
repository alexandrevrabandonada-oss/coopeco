"use client"

import { useState, useRef } from "react"
import { Camera, Upload, X, Loader2 } from "lucide-react"
import { compressImage } from "@/lib/image-utils"
import { uploadMedia } from "@/lib/storage-helpers"

interface MediaUploadProps {
    type: 'receipts' | 'posts' | 'mutiroes'
    entityId: string
    onUploadSuccess: (path: string) => void
    label?: string
}

export function MediaUpload({ type, entityId, onUploadSuccess, label }: MediaUploadProps) {
    const [isUploading, setIsUploading] = useState(false)
    const [preview, setPreview] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        try {
            setIsUploading(true)

            // 1. Preview
            const localPreview = URL.createObjectURL(file)
            setPreview(localPreview)

            // 2. Compress
            const compressed = await compressImage(file)

            // 3. Upload
            const path = await uploadMedia(compressed, type, entityId)

            onUploadSuccess(path)
        } catch (err) {
            console.error('Upload failed:', err)
            alert('Falha no upload. Tente novamente.')
            setPreview(null)
        } finally {
            setIsUploading(false)
        }
    }

    return (
        <div className="media-upload-container">
            <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileChange}
                disabled={isUploading}
            />

            {preview ? (
                <div className="card relative p-0 overflow-hidden" style={{ minHeight: '200px' }}>
                    <img src={preview} alt="Preview" className="w-full h-auto block" />
                    {isUploading && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-primary">
                            <Loader2 className="animate-spin" size={48} />
                        </div>
                    )}
                    {!isUploading && (
                        <button
                            onClick={() => { setPreview(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                            className="absolute top-2 right-2 bg-accent text-white p-1 border-2 border-foreground"
                        >
                            <X size={20} />
                        </button>
                    )}
                </div>
            ) : (
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="cta-button w-full justify-center py-8"
                    style={{ borderStyle: 'dashed' }}
                >
                    <Camera size={32} />
                    <span className="stencil-text">{label || 'ANEXAR PROVA / FOTO'}</span>
                </button>
            )}

            <style jsx>{`
        .hidden { display: none; }
        .relative { position: relative; }
        .absolute { position: absolute; }
        .inset-0 { top: 0; left: 0; right: 0; bottom: 0; }
        .flex { display: flex; }
        .items-center { align-items: center; }
        .justify-center { justify-content: center; }
        .w-full { width: 100%; }
        .h-auto { height: auto; }
        .block { display: block; }
        .p-0 { padding: 0; }
        .overflow-hidden { overflow: hidden; }
        .bg-black\/50 { background-color: rgba(0,0,0,0.5); }
      `}</style>
        </div>
    )
}
