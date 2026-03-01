"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { LoadingBlock } from "@/components/loading-block";
import { MessageSquare, AlertTriangle, CheckCircle2, ShieldAlert, ArrowLeft } from "lucide-react";
import Link from "next/link";

function FeedbackForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const supabase = createClient();

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [profile, setProfile] = useState<any>(null);
    const [cellId, setCellId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Form State
    const [category, setCategory] = useState("ops_route");
    const [severity, setSeverity] = useState("medium");
    const [summary, setSummary] = useState("");
    const [details, setDetails] = useState("");

    useEffect(() => {
        async function getContext() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push("/login?returnTo=/feedback");
                return;
            }

            const { data: prof } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();
            setProfile(prof);

            if (prof?.neighborhood_id) {
                // Get cell for this neighborhood
                const { data: cellMap } = await supabase
                    .from("eco_cell_neighborhoods")
                    .select("cell_id")
                    .eq("neighborhood_id", prof.neighborhood_id)
                    .maybeSingle();
                if (cellMap) setCellId(cellMap.cell_id);
            }
            setLoading(false);
        }
        getContext();
    }, [supabase, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Simple PII defense
        const piiRegex = /([a-z0-9._%-]+@[a-z0-9.-]+\.[a-z]{2,4})|(\(?\d{2,3}\)? ?\d{4,5}-?\d{4})/gi;
        if (piiRegex.test(summary) || piiRegex.test(details)) {
            setError("Por segurança, não envie telefone, e-mail ou endereço privado. Use descrições gerais.");
            return;
        }

        setSubmitting(true);
        const { data: { user } } = await supabase.auth.getUser();

        const { error: submitError } = await supabase
            .from("eco_feedback_items")
            .insert({
                cell_id: cellId,
                neighborhood_id: profile?.neighborhood_id,
                created_by: user?.id,
                role_at_time: profile?.role || 'resident',
                category,
                severity,
                summary: summary.trim(),
                details: details.trim(),
                context_kind: searchParams.get("kind"),
                context_id: searchParams.get("id"),
                status: 'new'
            });

        if (submitError) {
            setError(submitError.message);
            setSubmitting(false);
        } else {
            setSuccess(true);
            setSubmitting(false);
        }
    };

    if (loading) return <LoadingBlock text="Preparando canal de escuta..." />;

    if (success) {
        return (
            <div className="animate-slide-up flex flex-col items-center justify-center py-20 text-center">
                <CheckCircle2 className="text-secondary mb-4" size={64} />
                <h1 className="stencil-text text-3xl mb-2">VALEU PELO FEEDBACK!</h1>
                <p className="font-bold text-xs uppercase text-muted mb-8 max-w-xs">
                    Isso vira melhoria real no bairro. A equipe de operação vai triar esse item em breve.
                </p>
                <Link href="/" className="cta-button small">
                    VOLTAR PARA O INÍCIO
                </Link>
            </div>
        );
    }

    return (
        <div className="animate-slide-up max-w-2xl mx-auto pb-12">
            <header className="mb-8 flex items-center gap-4">
                <button onClick={() => router.back()} className="p-2 border-2 border-foreground hover:bg-muted/10 transition-colors">
                    <ArrowLeft size={20} />
                </button>
                <div className="flex items-center gap-3">
                    <MessageSquare className="text-secondary" size={32} />
                    <h1 className="stencil-text text-3xl">FEEDBACK 30S</h1>
                </div>
            </header>

            <form onSubmit={handleSubmit} className="card border-2 border-foreground bg-white flex flex-col gap-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                        <label className="font-black text-[10px] uppercase text-muted">Categoria</label>
                        <select
                            className="field font-bold uppercase text-xs"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            required
                        >
                            <option value="ops_route">Operação / Rota</option>
                            <option value="ops_drop_point">Operação / Ponto</option>
                            <option value="quality">Qualidade de Material</option>
                            <option value="education">Cuidado / Educação</option>
                            <option value="payments">Pagamentos</option>
                            <option value="ui_bug">Bug no App</option>
                            <option value="onboarding">Cadastro / Início</option>
                            <option value="governance">Governança / Decisão</option>
                            <option value="other">Outro</option>
                        </select>
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="font-black text-[10px] uppercase text-muted">Severidade</label>
                        <select
                            className="field font-bold uppercase text-xs"
                            value={severity}
                            onChange={(e) => setSeverity(e.target.value)}
                            required
                        >
                            <option value="low">Baixa</option>
                            <option value="medium">Média</option>
                            <option value="high">Alta (Impacto imediato)</option>
                            <option value="blocker">Bloqueio Operacional</option>
                        </select>
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <label className="font-black text-[10px] uppercase text-muted">O que deu ruim? (Resumo 120 chars)</label>
                    <input
                        type="text"
                        className="field font-bold uppercase text-xs"
                        placeholder="Ex: Ponto Recicla Já está sem caixa de vidro."
                        value={summary}
                        onChange={(e) => setSummary(e.target.value)}
                        maxLength={120}
                        required
                    />
                </div>

                <div className="flex flex-col gap-2">
                    <label className="font-black text-[10px] uppercase text-muted">Mais detalhes (Opcional, 500 chars)</label>
                    <textarea
                        className="field font-bold uppercase text-xs min-h-[120px]"
                        placeholder="Descreva o contexto. Não inclua PII (nomes, telefones ou endereços privados)."
                        value={details}
                        onChange={(e) => setDetails(e.target.value)}
                        maxLength={500}
                    />
                </div>

                {error && (
                    <div className="p-3 bg-accent/10 border-2 border-accent flex gap-3">
                        <ShieldAlert className="text-accent shrink-0" size={20} />
                        <p className="text-[10px] font-black uppercase text-accent leading-tight">{error}</p>
                    </div>
                )}

                <div className="mt-4 p-4 bg-muted/5 border-2 border-foreground border-dashed">
                    <p className="text-[10px] font-bold uppercase flex items-center gap-2 opacity-60">
                        <AlertTriangle size={14} /> Zero PII: Garantimos anonimato no bairro.
                    </p>
                </div>

                <button
                    type="submit"
                    className="cta-button w-full bg-secondary text-white justify-center disabled:opacity-50"
                    disabled={submitting}
                >
                    {submitting ? "ENVIANDO..." : "ENVIAR FEEDBACK (30S)"}
                </button>
            </form>
        </div>
    );
}

export default function FeedbackPage() {
    return (
        <Suspense fallback={<LoadingBlock text="Carregando..." />}>
            <FeedbackForm />
        </Suspense>
    );
}
