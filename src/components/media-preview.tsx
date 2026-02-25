"use client"

import { useEffect, useState } from "react"
import { getSignedUrl } from "@/lib/storage-helpers"
import { Loader2, ImageOff } from "lucide-react"

interface MediaPreviewProps {
    path: string
    alt?: string
    className?: string
}

export function MediaPreview({ path, alt, className }: MediaPreviewProps) {
    const [url, setUrl] = useState<string | null>(null)
    const [error, setError] = useState(false)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        async function loadUrl() {
            setIsLoading(true)
            const signedUrl = await getSignedUrl(path)
            if (signedUrl) {
                setUrl(signedUrl)
            } else {
                setError(true)
            }
            setIsLoading(false)
        }

        if (path) loadUrl()
    }, [path])

    if (isLoading) {
        return (
            <div className={`card flex items-center justify-center bg-muted ${className}`} style={{ minHeight: '150px' }}>
                <Loader2 className="animate-spin text-primary" size={24} />
            </div>
        )
    }

    if (error || !url) {
        return (
            <div className={`card flex flex-col items-center justify-center bg-muted text-accent ${className}`} style={{ minHeight: '150px' }}>
                <ImageOff size={32} />
                <span className="stencil-text text-xs mt-2">ERRO NA CARGA</span>
            </div>
        )
    }

    return (
        <div className={`card p-0 overflow-hidden ${className}`}>
            <img src={url} alt={alt || "ECO Media"} className="w-full h-auto block" />
        </div>
    )
}
