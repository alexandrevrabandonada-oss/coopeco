"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { LoadingBlock } from "@/components/loading-block";
import {
    BookOpen,
    ShieldAlert,
    History,
    Play,
    Save,
    Trash2,
    AlertCircle,
    CheckCircle2,
    FileText,
    Sparkles,
    Search,
    Database
} from "lucide-react";
import { normalizeCopy, lintCopy, autofixCopy, LintFinding } from "@/lib/copy/lint";
import Link from "next/link";

export default function AdminCopyPage() {
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'policy' | 'rules' | 'tester' | 'logs'>('policy');
    const [policy, setPolicy] = useState<any>(null);
    const [rules, setRules] = useState<any[]>([]);
    const [logs, setLogs] = useState<any[]>([]);

    // Tester state
    const [testText, setTestText] = useState("");
    const [testResult, setTestResult] = useState<{ ok: boolean, findings: LintFinding[] } | null>(null);
    const [fixedText, setFixedText] = useState("");

    const supabase = createClient();

    useEffect(() => {
        loadData();
    }, [activeTab]);

    const loadData = async () => {
        setLoading(true);
        if (activeTab === 'policy') {
            const { data } = await supabase.from("eco_copy_policy").select("*").single();
            setPolicy(data);
        } else if (activeTab === 'rules') {
            const { data } = await supabase.from("eco_copy_lint_rules").select("*").order("rule_key");
            setRules(data || []);
        } else if (activeTab === 'logs') {
            const { data } = await supabase.from("eco_copy_lint_logs").select("*").order("created_at", { ascending: false }).limit(200);
            setLogs(data || []);
        }
        setLoading(false);
    };

    const handleRunTest = async () => {
        const normalized = normalizeCopy(testText);
        setTestText(normalized);
        const result = await lintCopy(normalized, { source_kind: 'tester' });
        setTestResult(result);
        const { text: autoFixed } = await autofixCopy(normalized);
        setFixedText(autoFixed);
    };

    return (
        <div className="animate-slide-up pb-12">
            <header className="flex items-center gap-3 mb-8">
                <BookOpen className="text-primary" size={32} />
                <h1 className="stencil-text text-3xl">COPY ANTI-CULPA</h1>
            </header>

            <div className="flex gap-4 mb-8 border-b-2 border-foreground overflow-x-auto">
                {[
                    { id: 'policy', label: 'Política', icon: BookOpen },
                    { id: 'rules', label: 'Regras de Lint', icon: ShieldAlert },
                    { id: 'tester', label: 'Testador', icon: Play },
                    { id: 'logs', label: 'Logs Auditáveis', icon: History },
                    { id: 'batch', label: 'Auditoria em Lote', icon: Database }
                ].map(tab => (
                    tab.id === 'batch' ? (
                        <Link
                            key={tab.id}
                            href="/admin/copy/batch"
                            className="px-4 py-2 font-black text-xs uppercase flex items-center gap-2 transition-all hover:bg-muted/10"
                        >
                            <tab.icon size={16} />
                            {tab.label}
                        </Link>
                    ) : (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`px-4 py-2 font-black text-xs uppercase flex items-center gap-2 transition-all ${activeTab === tab.id ? 'bg-foreground text-white' : 'hover:bg-muted/10'
                                }`}
                        >
                            <tab.icon size={16} />
                            {tab.label}
                        </button>
                    )
                ))}
            </div>

            {loading && activeTab !== 'tester' ? <LoadingBlock text="Sincronizando guia de linguagem..." /> : (
                <div className="animate-slide-up">
                    {/* tab: policy */}
                    {activeTab === 'policy' && policy && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="card bg-white p-6 border-4 border-foreground shadow-[8px_8px_0_0_rgba(0,0,0,1)]">
                                <h2 className="stencil-text text-xl mb-4">PRINCÍPIOS {policy.version}</h2>
                                <div className="prose prose-sm max-w-none font-bold opacity-80 mb-6">
                                    {policy.principles_md}
                                </div>

                                <h3 className="stencil-text text-sm mb-2 text-primary">FAÇA (DO)</h3>
                                <ul className="flex flex-col gap-2 mb-6">
                                    {(policy.do_list || []).map((item: string, i: number) => (
                                        <li key={i} className="flex items-center gap-2 text-xs font-black uppercase">
                                            <CheckCircle2 size={14} className="text-green-600" /> {item}
                                        </li>
                                    ))}
                                </ul>

                                <h3 className="stencil-text text-sm mb-2 text-accent">NÃO FAÇA (DON'T)</h3>
                                <ul className="flex flex-col gap-2">
                                    {(policy.dont_list || []).map((item: string, i: number) => (
                                        <li key={i} className="flex items-center gap-2 text-xs font-black uppercase">
                                            <AlertCircle size={14} className="text-red-600" /> {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="card bg-foreground text-white p-6">
                                <h2 className="stencil-text text-xl mb-4 text-secondary">SUBSTITUIÇÕES (AUTOFIX)</h2>
                                <div className="flex flex-col gap-2">
                                    {Object.entries(policy.replacements || {}).map(([target, replacement]: [any, any]) => (
                                        <div key={target} className="flex items-center justify-between border-b border-white/10 pb-2">
                                            <span className="font-mono text-red-400 font-bold">"{target}"</span>
                                            <ArrowRight size={14} className="opacity-50" />
                                            <span className="font-mono text-green-400 font-bold">"{replacement}"</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* tab: rules */}
                    {activeTab === 'rules' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {rules.map(rule => (
                                <div key={rule.id} className={`card border-2 p-4 flex flex-col justify-between ${rule.severity === 'blocker' ? 'border-red-600 bg-red-50/50' : 'border-foreground/20'}`}>
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="font-black text-[10px] uppercase opacity-50">{rule.rule_key}</span>
                                            <span className={`px-2 py-0.5 font-black text-[8px] uppercase border ${rule.severity === 'blocker' ? 'bg-red-600 text-white border-red-800' : 'bg-yellow-100 text-yellow-800 border-yellow-300'
                                                }`}>
                                                {rule.severity}
                                            </span>
                                        </div>
                                        <p className="font-mono text-[10px] bg-white border border-foreground/10 p-2 mb-3">
                                            {rule.pattern}
                                        </p>
                                        <p className="text-xs font-bold leading-tight mb-4">
                                            💡 {rule.hint}
                                        </p>
                                    </div>
                                    <button className="cta-button tiny opacity-50 grayscale hover:grayscale-0 hover:opacity-100">EDITAR REGRA</button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* tab: tester */}
                    {activeTab === 'tester' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="flex flex-col gap-4">
                                <div className="card p-0 overflow-hidden border-2 border-foreground shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
                                    <div className="bg-foreground text-white p-4 flex items-center justify-between">
                                        <span className="stencil-text text-sm">TESTADOR DE COPY</span>
                                        <Sparkles size={18} className="text-secondary" />
                                    </div>
                                    <textarea
                                        className="w-full p-4 h-64 field border-0 resize-none font-bold text-lg"
                                        placeholder="Cole o texto aqui para validar contra o Guia de Linguagem ECO..."
                                        value={testText}
                                        onChange={e => setTestText(e.target.value)}
                                    />
                                    <button
                                        onClick={handleRunTest}
                                        className="w-full bg-primary p-4 stencil-text text-xl hover:bg-primary/90 flex items-center justify-center gap-3"
                                    >
                                        <Play size={20} /> ANALISAR LINGUAGEM
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-col gap-6">
                                {testResult && (
                                    <div className={`card animate-slide-up border-4 ${testResult.ok ? 'border-green-600 bg-green-50' : 'border-red-600 bg-red-50'}`}>
                                        <h3 className="stencil-text text-lg mb-4 flex items-center gap-2">
                                            {testResult.ok ? <CheckCircle2 className="text-green-600" /> : <ShieldAlert className="text-red-600" />}
                                            RESULTADO: {testResult.ok ? 'PASSOU' : 'BLOQUEADO'}
                                        </h3>

                                        {testResult.findings.length > 0 ? (
                                            <div className="flex flex-col gap-3">
                                                {testResult.findings.map((f, i) => (
                                                    <div key={i} className="p-3 bg-white border-2 border-foreground/10">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="font-black text-[8px] uppercase px-1 bg-muted">{f.rule_key}</span>
                                                            <span className={`font-black text-[8px] uppercase ${f.severity === 'blocker' ? 'text-red-600' : 'text-yellow-600'}`}>{f.severity}</span>
                                                        </div>
                                                        <p className="text-xs font-bold mb-1">Encontrado: <span className="underline decoration-red-400 font-black">"{f.excerpt}"</span></p>
                                                        <p className="text-[10px] opacity-70 italic">{f.hint}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="font-bold text-sm uppercase opacity-60">Linguagem limpa e em conformidade com o ECO.</p>
                                        )}
                                    </div>
                                )}

                                {fixedText && fixedText !== testText && (
                                    <div className="card animate-slide-up border-2 border-primary bg-primary/5">
                                        <h3 className="stencil-text text-sm mb-3 flex items-center gap-2">
                                            <Sparkles className="text-primary" size={16} /> SUGESTÃO DE REESCRITA (AUTOFIX)
                                        </h3>
                                        <div className="p-3 bg-white border border-primary/20 text-xs font-bold leading-relaxed mb-4">
                                            {fixedText}
                                        </div>
                                        <button
                                            onClick={() => setTestText(fixedText)}
                                            className="cta-button tiny w-full"
                                        >
                                            USAR ESTA VERSÃO
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* tab: logs */}
                    {activeTab === 'logs' && (
                        <div className="card p-0 overflow-hidden border-2 border-foreground">
                            <div className="bg-muted/5 p-4 border-b-2 border-foreground flex items-center justify-between">
                                <h2 className="stencil-text text-sm flex items-center gap-2"><History size={16} /> ÚLTIMOS LOGS DE LINTING</h2>
                                <Search size={16} className="opacity-30" />
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-foreground text-white text-[10px] uppercase font-black">
                                        <tr>
                                            <th className="p-4">Data</th>
                                            <th className="p-4">Source</th>
                                            <th className="p-4">Trecho</th>
                                            <th className="p-4">Severidade</th>
                                            <th className="p-4">Sugestão</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-[10px] font-bold uppercase">
                                        {logs.map(log => (
                                            <tr key={log.id} className="border-b border-foreground/5 hover:bg-muted/5">
                                                <td className="p-4 opacity-50 whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</td>
                                                <td className="p-4"><span className="bg-muted px-1">{log.source_kind}</span></td>
                                                <td className="p-4 font-mono text-xs">"{log.excerpt}"</td>
                                                <td className="p-4">
                                                    <span className={log.severity === 'blocker' ? 'text-red-600' : 'text-yellow-600'}>{log.severity}</span>
                                                </td>
                                                <td className="p-4 opacity-70">{log.suggestion}</td>
                                            </tr>
                                        ))}
                                        {logs.length === 0 && (
                                            <tr><td colSpan={5} className="p-12 text-center opacity-30 italic">Nenhum log registrado ainda.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <style jsx>{`
                .card { border-radius: 0; }
                th { letter-spacing: 0.1em; }
            `}</style>
        </div>
    );
}

const ArrowRight = ({ size, className }: { size: number, className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M5 12h14m-7-7 7 7-7 7" /></svg>
);
