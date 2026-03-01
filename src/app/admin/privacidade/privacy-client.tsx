"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import {
    ShieldCheck,
    ShieldAlert,
    ShieldQuestion,
    Play,
    History,
    CheckCircle2,
    XCircle,
    Fingerprint
} from "lucide-react";
import { LoadingBlock } from "@/components/loading-block";

export default function PrivacyAuditClient() {
    const supabase = createClient();
    const [loading, setLoading] = useState(true);
    const [running, setRunning] = useState(false);
    const [rules, setRules] = useState<any[]>([]);
    const [lastRuns, setLastRuns] = useState<any[]>([]);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            const [rulesRes, runsRes] = await Promise.all([
                supabase.from("eco_privacy_rules").select("*").order("severity", { ascending: false }),
                supabase.from("eco_privacy_audit_runs").select("*").order("created_at", { ascending: false }).limit(5)
            ]);

            if (rulesRes.data) setRules(rulesRes.data);
            if (runsRes.data) setLastRuns(runsRes.data);
            setLoading(false);
        };
        load();
    }, [supabase]);

    const runAudit = async () => {
        setRunning(true);
        try {
            const res = await fetch("/api/admin/privacy/run", { method: "POST" });
            const data = await res.json();

            if (data.success) {
                // Refresh runs
                const { data: newRuns } = await supabase.from("eco_privacy_audit_runs").select("*").order("created_at", { ascending: false }).limit(5);
                if (newRuns) setLastRuns(newRuns);
            } else {
                alert("Erro na auditoria: " + data.error);
            }
        } catch (e: any) {
            alert("Falha técnica: " + e.message);
        }
        setRunning(false);
    };

    if (loading) return <LoadingBlock text="Carregando centro de privacidade..." />;

    const lastRun = lastRuns[0];

    return (
        <div className="animate-slide-up pb-12">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-3">
                    <ShieldCheck className="text-primary" size={32} />
                    <h1 className="stencil-text text-3xl">CENTRO DE PRIVACIDADE</h1>
                </div>
                <button
                    disabled={running}
                    onClick={runAudit}
                    className="cta-button small bg-foreground text-white flex gap-2"
                >
                    <Play size={16} /> {running ? 'AUDITANDO...' : 'RODAR AUDITORIA'}
                </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="card p-6 border-2 border-foreground bg-white flex flex-col items-center text-center gap-2">
                    <Fingerprint className="text-muted" size={40} />
                    <span className="font-black text-xs uppercase opacity-60">Status de Vazamento</span>
                    <span className={`stencil-text text-2xl ${lastRun?.result_status === 'pass' ? 'text-green-600' : 'text-accent'}`}>
                        {lastRun ? lastRun.result_status.toUpperCase() : 'N/A'}
                    </span>
                </div>

                <div className="card p-6 border-2 border-foreground bg-white flex flex-col items-center text-center gap-2">
                    <ShieldAlert className="text-muted" size={40} />
                    <span className="font-black text-xs uppercase opacity-60">Regras Ativas</span>
                    <span className="stencil-text text-2xl">{rules.length}</span>
                </div>

                <div className="card p-6 border-2 border-foreground bg-white flex flex-col items-center text-center gap-2">
                    <History className="text-muted" size={40} />
                    <span className="font-black text-xs uppercase opacity-60">Último Audit</span>
                    <span className="stencil-text text-2xl">
                        {lastRun ? new Date(lastRun.created_at).toLocaleDateString() : 'NUNCA'}
                    </span>
                </div>
            </div>

            <section className="mb-8">
                <h2 className="stencil-text text-xl mb-4 uppercase">Regras de Sanitização Automática</h2>
                <div className="grid grid-cols-1 gap-4">
                    {rules.map(rule => (
                        <div key={rule.id} className="card border-2 border-foreground p-4 flex justify-between items-center">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`font-black text-[8px] uppercase px-2 py-0.5 text-white ${rule.severity === 'blocker' ? 'bg-accent' : 'bg-primary'}`}>
                                        {rule.severity}
                                    </span>
                                    <h3 className="font-black text-xs uppercase">{rule.rule_key}</h3>
                                </div>
                                <p className="text-[10px] font-bold uppercase text-muted-foreground">{rule.description}</p>
                                <div className="flex gap-1 mt-2">
                                    {rule.applies_to.map((a: string) => (
                                        <span key={a} className="text-[8px] font-black uppercase bg-muted/20 px-1.5 py-0.5 italic">{a}</span>
                                    ))}
                                </div>
                            </div>
                            <CheckCircle2 className="text-green-600" size={24} />
                        </div>
                    ))}
                </div>
            </section>

            <section>
                <h2 className="stencil-text text-xl mb-4 uppercase">Histórico de Auditoria</h2>
                <div className="card border-2 border-foreground bg-black/5 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-foreground text-white">
                                <th className="p-3 font-black text-[10px] uppercase">Data</th>
                                <th className="p-3 font-black text-[10px] uppercase">Status</th>
                                <th className="p-3 font-black text-[10px] uppercase">Resumo</th>
                                <th className="p-3 font-black text-[10px] uppercase">Ação</th>
                            </tr>
                        </thead>
                        <tbody>
                            {lastRuns.map(run => (
                                <tr key={run.id} className="border-b border-foreground/10 hover:bg-white/50 transition-colors text-[10px] font-bold uppercase">
                                    <td className="p-3">{new Date(run.created_at).toLocaleString()}</td>
                                    <td className="p-3">
                                        <span className={`px-2 py-0.5 rounded-sm ${run.result_status === 'pass' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {run.result_status}
                                        </span>
                                    </td>
                                    <td className="p-3">
                                        {run.results?.details?.length || 0} regras validadas
                                    </td>
                                    <td className="p-3">
                                        <button className="underline">DETALHES</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}
