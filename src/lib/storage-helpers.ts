import { createClient } from "@/lib/supabase"

export type MediaEntityType = "receipt" | "post";

export interface MediaObject {
    id: string;
    bucket: string;
    path: string;
    owner_id: string;
    entity_type: MediaEntityType;
    entity_id: string;
    mime: string;
    bytes: number;
    created_at: string;
}

export interface SignedMediaItem {
    media_id: string;
    signed_url: string;
}

interface CacheEntry<T> {
    expiresAt: number;
    value: T;
}

const mediaSignedUrlCache = new Map<string, CacheEntry<string>>()
const entitySignedUrlCache = new Map<string, CacheEntry<SignedMediaItem[]>>()

function clampExpiresIn(expiresIn: number): number {
    return Math.max(60, Math.min(300, expiresIn))
}

function makeCacheTtlMs(expiresIn: number): number {
    const clamped = clampExpiresIn(expiresIn)
    const ttlSeconds = Math.max(20, Math.min(120, clamped - 20))
    return ttlSeconds * 1000
}

function readCache<T>(map: Map<string, CacheEntry<T>>, key: string): T | null {
    const hit = map.get(key)
    if (!hit) return null
    if (Date.now() >= hit.expiresAt) {
        map.delete(key)
        return null
    }
    return hit.value
}

function writeCache<T>(map: Map<string, CacheEntry<T>>, key: string, value: T, ttlMs: number) {
    map.set(key, {
        expiresAt: Date.now() + ttlMs,
        value,
    })
}

async function getBearerToken() {
    const supabase = createClient()
    const {
        data: { session },
        error,
    } = await supabase.auth.getSession()

    if (error) throw error
    if (session?.access_token) return session.access_token

    if (typeof window !== "undefined") {
        const e2eToken = window.localStorage.getItem("eco_e2e_access_token")
        if (e2eToken) return e2eToken
    }

    throw new Error("Sessao invalida para operacao de midia.")
}

export async function getSignedUrlByMediaId(
    mediaId: string,
    expiresIn: number = 120,
    options?: { forceRefresh?: boolean },
): Promise<string | null> {
    if (!options?.forceRefresh) {
        const cached = readCache(mediaSignedUrlCache, mediaId)
        if (cached) return cached
    }

    const safeExpires = clampExpiresIn(expiresIn)
    const token = await getBearerToken()
    const response = await fetch(
        `/api/media/signed-url?media_id=${mediaId}&expires_in=${safeExpires}`,
        {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
            },
        },
    )

    if (!response.ok) {
        return null
    }

    const payload = (await response.json()) as { signed_url?: string }
    if (!payload.signed_url) return null

    writeCache(mediaSignedUrlCache, mediaId, payload.signed_url, makeCacheTtlMs(safeExpires))
    return payload.signed_url
}

export async function getSignedUrlsForEntity(
    entityType: MediaEntityType,
    entityId: string,
    expiresIn: number = 120,
    options?: { forceRefresh?: boolean },
): Promise<SignedMediaItem[]> {
    const entityCacheKey = `${entityType}:${entityId}`
    if (!options?.forceRefresh) {
        const cached = readCache(entitySignedUrlCache, entityCacheKey)
        if (cached) return cached
    }

    const safeExpires = clampExpiresIn(expiresIn)
    const token = await getBearerToken()
    const response = await fetch(
        `/api/media/signed-url?entity_type=${entityType}&entity_id=${entityId}&expires_in=${safeExpires}`,
        {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
            },
        },
    )

    if (!response.ok) {
        return []
    }

    const payload = (await response.json()) as {
        items?: SignedMediaItem[]
    }
    const items = payload.items ?? []
    const ttlMs = makeCacheTtlMs(safeExpires)

    writeCache(entitySignedUrlCache, entityCacheKey, items, ttlMs)
    for (const item of items) {
        writeCache(mediaSignedUrlCache, item.media_id, item.signed_url, ttlMs)
    }

    return items
}

export async function uploadMediaFiles(
    files: File[],
    entityType: MediaEntityType,
    entityId: string,
): Promise<MediaObject[]> {
    if (files.length === 0) return []

    const supabase = createClient()
    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser()

    if (userError) throw userError

    let ownerId = user?.id ?? null
    if (!ownerId && typeof window !== "undefined") {
        const rawE2EAuth = window.localStorage.getItem("eco_e2e_auth")
        if (rawE2EAuth) {
            try {
                const parsed = JSON.parse(rawE2EAuth) as { user?: { id?: string } }
                ownerId = parsed.user?.id ?? null
            } catch {
                ownerId = null
            }
        }
    }

    if (!ownerId) throw new Error("Usuario autenticado e obrigatorio para upload de midia.")

    const folder = entityType === "receipt" ? "receipts" : "posts"
    const created: MediaObject[] = []

    for (const file of files) {
        const extFromName = file.name.includes(".") ? file.name.split(".").pop() : null
        const extFromMime = file.type.split("/")[1] || "jpg"
        const extension = (extFromName || extFromMime || "jpg").toLowerCase()
        const fileName = `${crypto.randomUUID()}.${extension}`
        const path = `${folder}/${entityId}/${fileName}`

        const { error: uploadError } = await supabase
            .storage
            .from("eco-media")
            .upload(path, file, {
                contentType: file.type || "application/octet-stream",
                upsert: false,
            })

        if (uploadError) throw uploadError

        const { data: mediaRow, error: mediaError } = await supabase
            .from("media_objects")
            .insert({
                bucket: "eco-media",
                path,
                owner_id: ownerId,
                entity_type: entityType,
                entity_id: entityId,
                mime: file.type || "application/octet-stream",
                bytes: file.size,
                is_public: false,
            })
            .select("*")
            .single<MediaObject>()

        if (mediaError || !mediaRow) {
            await supabase.storage.from("eco-media").remove([path])
            throw mediaError || new Error("Falha ao registrar metadado de midia.")
        }

        created.push(mediaRow)
    }

    return created
}
