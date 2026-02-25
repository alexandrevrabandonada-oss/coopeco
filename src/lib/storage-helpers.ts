import { createClient } from "@/lib/supabase"

/**
 * Generates a signed URL for an object in the 'eco-media' bucket.
 * This can be used in Server Components or Client Components.
 * @param path The full path inside the bucket (e.g., 'receipts/uuid/photo.jpg')
 * @param expiresIn Seconds until the link expires (default 1 hour)
 */
export async function getSignedUrl(path: string, expiresIn: number = 3600) {
    const supabase = createClient()

    const { data, error } = await supabase
        .storage
        .from('eco-media')
        .createSignedUrl(path, expiresIn)

    if (error) {
        console.error('Error generating signed URL:', error.message)
        return null
    }

    return data.signedUrl
}

/**
 * Uploads a file with an automated path based on type and entityId
 */
export async function uploadMedia(
    file: File,
    type: 'receipts' | 'posts' | 'mutiroes',
    entityId: string
) {
    const supabase = createClient()
    const fileExt = file.name.split('.').pop()
    const fileName = `${crypto.randomUUID()}.${fileExt}`
    const path = `${type}/${entityId}/${fileName}`

    const { data, error } = await supabase
        .storage
        .from('eco-media')
        .upload(path, file)

    if (error) throw error
    return data.path
}
