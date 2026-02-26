"use client"

import { useEffect, useRef, useState } from "react"
import { getSignedUrlByMediaId } from "@/lib/storage-helpers"
import { Loader2, ImageOff } from "lucide-react"

interface MediaPreviewProps {
    mediaId: string
    alt?: string
    className?: string
    signedUrl?: string | null
}

export function MediaPreview({ mediaId, alt, className, signedUrl }: MediaPreviewProps) {
    const [url, setUrl] = useState<string | null>(signedUrl ?? null)
    const [error, setError] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const hasRenewedRef = useRef(false)

    useEffect(() => {
        hasRenewedRef.current = false

        async function loadUrl() {
            if (signedUrl) {
                setUrl(signedUrl)
                setError(false)
                setIsLoading(false)
                return
            }

            setIsLoading(true)
            setError(false)
            const freshSignedUrl = await getSignedUrlByMediaId(mediaId, 180)
            if (freshSignedUrl) {
                setUrl(freshSignedUrl)
            } else {
                setUrl(null)
                setError(true)
            }
            setIsLoading(false)
        }

        if (mediaId) loadUrl()
    }, [mediaId, signedUrl])

    const renewSignedUrl = async () => {
        if (hasRenewedRef.current) {
            setError(true)
            return
        }

        hasRenewedRef.current = true
        setIsLoading(true)
        const renewed = await getSignedUrlByMediaId(mediaId, 180, { forceRefresh: true })
        if (!renewed) {
            setUrl(null)
            setError(true)
            setIsLoading(false)
            return
        }

        setUrl(renewed)
        setError(false)
        setIsLoading(false)
    }

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
            {/* Signed URL from storage may expire; keep native img for direct retry/onError control. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={url}
                alt={alt || "ECO Media"}
                className="w-full h-auto block"
                data-testid="media-preview-image"
                onError={() => {
                    void renewSignedUrl()
                }}
            />
        </div>
    )
}
