"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, ShieldOff } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useAuth } from "@/contexts/auth-context"
import { MediaUpload } from "@/components/media-upload"
import { uploadMediaFiles } from "@/lib/storage-helpers"

type PostKind = "registro" | "recibo" | "mutirao" | "chamado" | "ponto_critico" | "transparencia"

export default function MuralNovo() {
    const router = useRouter()
    const supabase = useMemo(() => createClient(), [])
    const { user, profile, isLoading: authLoading } = useAuth()
    const [kind, setKind] = useState<PostKind>("mutirao")
    const [title, setTitle] = useState("")
    const [body, setBody] = useState("")
    const [files, setFiles] = useState<File[]>([])
    const [isSaving, setIsSaving] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    const p = profile as { neighborhood_id?: string | null } | null

    const canAttachMedia = kind === "mutirao"

    const submit = async (e: React.FormEvent) => {
        e.preventDefault()
        setErrorMessage(null)

        if (!user || !p?.neighborhood_id) {
            setErrorMessage("Perfil sem bairro definido. Complete o onboarding.")
            return
        }

        if (!body.trim()) {
            setErrorMessage("Conteudo obrigatorio.")
            return
        }

        setIsSaving(true)
        try {
            const { data: createdPost, error: postError } = await supabase
                .from("posts")
                .insert({
                    created_by: user.id,
                    neighborhood_id: p.neighborhood_id,
                    kind,
                    title: title.trim() || null,
                    body: body.trim(),
                })
                .select("id")
                .single<{ id: string }>()

            if (postError || !createdPost) throw postError || new Error("Falha ao criar post.")

            if (canAttachMedia && files.length > 0) {
                await uploadMediaFiles(files, "post", createdPost.id)
            }

            router.push("/mural")
        } catch (error) {
            setErrorMessage((error as Error).message)
        } finally {
            setIsSaving(false)
        }
    }

    if (authLoading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="animate-spin text-primary" size={44} />
            </div>
        )
    }

    if (!user || !profile) {
        return (
            <div className="card text-center py-12 animate-slide-up">
                <ShieldOff size={48} className="mx-auto mb-4 text-accent" />
                <h2 className="stencil-text mb-3">Acesso Restrito</h2>
                <p className="font-bold uppercase">Entre na sua conta para publicar no mural.</p>
            </div>
        )
    }

    return (
        <div className="animate-slide-up pb-12">
            <h1
                className="stencil-text mb-6"
                style={{
                    fontSize: "2.1rem",
                    background: "var(--primary)",
                    padding: "0 10px",
                    border: "2px solid var(--foreground)",
                    width: "fit-content",
                }}
            >
                NOVO POST
            </h1>

            <form onSubmit={submit} className="card flex flex-col gap-4">
                <label className="flex flex-col gap-1">
                    <span className="stencil-text text-xs">Tipo</span>
                    <select value={kind} onChange={(e) => setKind(e.target.value as PostKind)} className="field">
                        <option value="mutirao">Mutirão</option>
                        <option value="chamado">Chamado</option>
                        <option value="registro">Registro</option>
                        <option value="transparencia">Transparência</option>
                    </select>
                </label>

                <label className="flex flex-col gap-1">
                    <span className="stencil-text text-xs">Titulo</span>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="field"
                        placeholder="Ex.: Limpeza da praça no sábado"
                    />
                </label>

                <label className="flex flex-col gap-1">
                    <span className="stencil-text text-xs">Conteudo</span>
                    <textarea
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        className="field"
                        rows={5}
                        placeholder="Descreva a ação e como participar."
                    />
                </label>

                {canAttachMedia && (
                    <div>
                        <p className="stencil-text text-xs mb-2">Fotos da prova (mutirão)</p>
                        <MediaUpload
                            onFilesSelected={setFiles}
                            label="ADICIONAR FOTOS DO MUTIRÃO"
                            multiple
                            maxFiles={6}
                        />
                    </div>
                )}

                {errorMessage && (
                    <p className="font-bold text-sm uppercase" style={{ color: "var(--accent)" }}>
                        Erro: {errorMessage}
                    </p>
                )}

                <button type="submit" disabled={isSaving} className="cta-button justify-center py-5">
                    {isSaving ? <Loader2 className="animate-spin" /> : "Publicar"}
                </button>
            </form>

            <style jsx>{`
        .flex { display: flex; }
        .flex-col { flex-direction: column; }
        .gap-1 { gap: 0.25rem; }
        .gap-4 { gap: 1rem; }
        .field {
          border: 2px solid var(--foreground);
          background: white;
          padding: 0.75rem;
          font-weight: 700;
          outline: none;
        }
        .text-xs { font-size: 0.75rem; }
        .mb-2 { margin-bottom: 0.5rem; }
      `}</style>
        </div>
    )
}
