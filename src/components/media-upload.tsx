"use client"

import { useRef, useState } from "react"
import { Camera, X } from "lucide-react"

interface MediaUploadProps {
    onFilesSelected: (files: File[]) => void
    label?: string
    multiple?: boolean
    maxFiles?: number
}

interface PreviewItem {
    id: string
    url: string
    name: string
}

export function MediaUpload({
    onFilesSelected,
    label,
    multiple = true,
    maxFiles = 6,
}: MediaUploadProps) {
    const [files, setFiles] = useState<File[]>([])
    const [previews, setPreviews] = useState<PreviewItem[]>([])
    const fileInputRef = useRef<HTMLInputElement>(null)

    const updateSelection = (nextFiles: File[]) => {
        const safeFiles = nextFiles.slice(0, maxFiles)
        setFiles(safeFiles)

        setPreviews((current) => {
            for (const preview of current) {
                URL.revokeObjectURL(preview.url)
            }
            return safeFiles.map((file) => ({
                id: crypto.randomUUID(),
                url: URL.createObjectURL(file),
                name: file.name,
            }))
        })

        onFilesSelected(safeFiles)
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = Array.from(e.target.files || [])
        if (selected.length === 0) return

        const next = multiple ? [...files, ...selected] : [selected[0]]
        updateSelection(next)

        if (fileInputRef.current) {
            fileInputRef.current.value = ""
        }
    }

    const removeAt = (index: number) => {
        const next = files.filter((_, i) => i !== index)
        updateSelection(next)
    }

    return (
        <div className="media-upload-container">
            <input
                type="file"
                accept="image/*"
                capture="environment"
                multiple={multiple}
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileChange}
            />

            {previews.length > 0 ? (
                <div className="flex flex-col gap-3">
                    <div className="grid-preview">
                        {previews.map((preview, index) => (
                            <div key={preview.id} className="card relative p-0 overflow-hidden">
                                {/* Blob/object URLs from local file picker are rendered with native img. */}
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={preview.url} alt={preview.name} className="w-full h-auto block" />
                                <button
                                    onClick={() => removeAt(index)}
                                    className="absolute top-2 right-2 bg-accent text-white p-1 border-2 border-foreground"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="cta-button w-full justify-center py-4"
                        style={{ borderStyle: "dashed" }}
                    >
                        <Camera size={24} />
                        <span className="stencil-text text-xs">ADICIONAR MAIS FOTOS</span>
                    </button>
                </div>
            ) : (
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="cta-button w-full justify-center py-8"
                    style={{ borderStyle: "dashed" }}
                >
                    <Camera size={32} />
                    <span className="stencil-text">{label || "ANEXAR PROVA / FOTO"}</span>
                </button>
            )}

            <p className="text-[10px] font-black uppercase mt-2">
                {files.length} arquivo(s) selecionado(s) • max {maxFiles}
            </p>

            <style jsx>{`
        .grid-preview {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.75rem;
        }
        @media (min-width: 768px) {
          .grid-preview {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
        .hidden { display: none; }
        .relative { position: relative; }
        .absolute { position: absolute; }
        .top-2 { top: 0.5rem; }
        .right-2 { right: 0.5rem; }
        .flex { display: flex; }
        .flex-col { flex-direction: column; }
        .gap-3 { gap: 0.75rem; }
        .w-full { width: 100%; }
        .h-auto { height: auto; }
        .block { display: block; }
        .p-0 { padding: 0; }
        .overflow-hidden { overflow: hidden; }
        .mt-2 { margin-top: 0.5rem; }
      `}</style>
        </div>
    )
}
