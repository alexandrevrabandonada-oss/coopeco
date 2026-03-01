"use client";

import { useUIPreferences } from "@/hooks/use-ui-preferences";
import {
    Eye,
    Type,
    Wind,
    MapPin,
    CheckCircle2,
    AlertCircle,
    Smartphone,
    Sun,
    MousePointer2,
    BookOpen
} from "lucide-react";
import { VRBadge } from "@/components/vr-badge";

export default function A11yAdmin() {
    const {
        contrast, setContrast,
        textScale, setTextScale,
        reduceMotion, setReduceMotion,
        streetMode, setStreetMode
    } = useUIPreferences();

    return (
        <div className="animate-slide-up pb-20">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
                <div className="flex items-center gap-3">
                    <Eye className="text-primary" size={32} />
                    <h1 className="stencil-text text-3xl">CENTRAL DE ACESSIBILIDADE</h1>
                </div>
                <VRBadge />
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                {/* PREFERENCES CONTROL */}
                <section className="flex flex-col gap-6">
                    <div className="card border-4 border-foreground p-8 bg-white">
                        <h2 className="stencil-text text-xl mb-6">OPÇÕES DE VISUALIZAÇÃO</h2>

                        <div className="flex flex-col gap-8">
                            {/* Street Mode */}
                            <div className="flex items-center justify-between p-4 border-2 border-primary bg-primary/5">
                                <div className="flex items-center gap-4">
                                    <MapPin className="text-primary" />
                                    <div>
                                        <p className="font-black text-sm uppercase">MODO RUA (STREET MODE)</p>
                                        <p className="text-[10px] font-bold opacity-60">Foco total em contraste e alvos maiores para uso sob sol forte.</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setStreetMode(!streetMode)}
                                    className={`cta-button tiny ${streetMode ? 'bg-foreground text-white' : 'bg-white'}`}
                                >
                                    {streetMode ? 'ATIVO' : 'DESATIVADO'}
                                </button>
                            </div>

                            {/* Contrast */}
                            <div className="flex flex-col gap-3">
                                <p className="font-black text-[10px] uppercase flex items-center gap-2">
                                    <Sun size={14} /> Contraste Visual
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setContrast("normal")}
                                        className={`cta-button small grow justify-center ${contrast === 'normal' ? 'bg-primary' : 'bg-white'}`}
                                    >ESTILO ECO</button>
                                    <button
                                        onClick={() => setContrast("high")}
                                        className={`cta-button small grow justify-center ${contrast === 'high' ? 'bg-primary' : 'bg-white'}`}
                                    >ALTO CONTRASTE</button>
                                </div>
                            </div>

                            {/* Font Scale */}
                            <div className="flex flex-col gap-3">
                                <p className="font-black text-[10px] uppercase flex items-center gap-2">
                                    <Type size={14} /> Escala de Texto
                                </p>
                                <div className="flex gap-2">
                                    {["100", "115", "130"].map(scale => (
                                        <button
                                            key={scale}
                                            onClick={() => setTextScale(scale as any)}
                                            className={`cta-button small grow justify-center ${textScale === scale ? 'bg-primary' : 'bg-white'}`}
                                        >{scale}%</button>
                                    ))}
                                </div>
                            </div>

                            {/* Reduce Motion */}
                            <div className="flex items-center justify-between py-4 border-t-2 border-dashed border-foreground/10">
                                <div className="flex items-center gap-4">
                                    <Wind size={20} className="text-secondary" />
                                    <p className="font-black text-xs uppercase">REDUZIR MOVIMENTO</p>
                                </div>
                                <button
                                    onClick={() => setReduceMotion(!reduceMotion)}
                                    className={`cta-button tiny ${reduceMotion ? 'bg-foreground text-white' : 'bg-white'}`}
                                >
                                    {reduceMotion ? 'ATIVO' : 'DESATIVADO'}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="card bg-black text-white p-6">
                        <h3 className="font-black text-sm uppercase mb-4 flex items-center gap-2">
                            <Smartphone size={18} className="text-primary" /> TESTE DE ALVO (TAP TARGET)
                        </h3>
                        <p className="text-xs mb-6 opacity-70">Em Modo Rua, o alvo mínimo deve ser 48px mesmo para botões pequenos.</p>
                        <div className="flex flex-wrap gap-4">
                            <button className="cta-button small bg-white text-black">TESTE 1</button>
                            <button className="cta-button tiny bg-primary text-black">TESTE 2</button>
                            <div className="w-12 h-12 bg-accent flex items-center justify-center font-black">48px</div>
                        </div>
                    </div>
                </section>

                {/* CHECKLIST & AUDIT */}
                <section className="flex flex-col gap-6">
                    <div className="card border-2 border-foreground p-8 bg-white">
                        <h2 className="stencil-text text-xl mb-6">CHECKLIST DE ACESSIBILIDADE</h2>

                        <div className="flex flex-col gap-4">
                            {[
                                { label: "Navegação por Teclado (Tab/Enter)", status: "ok" },
                                { label: "Foco Visível (Outlines)", status: "ok" },
                                { label: "ARIA Labels em Ícones", status: "ok" },
                                { label: "Hierarquia de Headings (H1-H3)", status: "ok" },
                                { label: "Transcrição em Mídias (A39)", status: "warn" },
                                { label: "Skip Link de Conteúdo", status: "ok" }
                            ].map((item, i) => (
                                <div key={i} className="flex items-center justify-between py-2 border-b border-foreground/5">
                                    <span className="text-xs font-bold uppercase">{item.label}</span>
                                    {item.status === 'ok' ? (
                                        <CheckCircle2 size={16} className="text-green-600" />
                                    ) : (
                                        <AlertCircle size={16} className="text-amber-500" />
                                    )}
                                </div>
                            ))}
                        </div>

                        <button className="cta-button w-full justify-center mt-10 bg-foreground text-white">
                            GERAR RELATÓRIO A40
                        </button>
                    </div>

                    <div className="card p-6 border-dashed border-2 border-foreground/20">
                        <h3 className="font-black text-[10px] uppercase text-muted mb-4 flex items-center gap-2">
                            DOCUMENTAÇÃO RÁPIDA
                        </h3>
                        <ul className="flex flex-col gap-2">
                            <li className="text-[10px] font-bold uppercase opacity-80 flex items-center gap-2">
                                <MousePointer2 size={12} /> Use TAB para navegar e ESPAÇO para ativar.
                            </li>
                            <li className="text-[10px] font-bold uppercase opacity-80 flex items-center gap-2">
                                <BookOpen size={12} /> Prefira o Modo Rua em celulares com mais de 3 anos.
                            </li>
                        </ul>
                    </div>
                </section>
            </div>
        </div>
    );
}
