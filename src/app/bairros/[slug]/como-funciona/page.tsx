import { createClient } from "@/lib/supabase";
import { notFound } from "next/navigation";
import {
    Heart,
    ShieldCheck,
    Zap,
    Smartphone,
    MapPin,
    ArrowRight,
    QrCode,
    Users,
    Globe
} from "lucide-react";
import Link from "next/link";

export default async function NeighborhoodHowItWorksPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const supabase = createClient();

    const { data: neighborhood } = await supabase
        .from("neighborhoods")
        .select("*, eco_cells(name)")
        .eq("slug", slug)
        .single();

    if (!neighborhood) notFound();

    return (
        <div className="min-h-screen bg-white text-foreground pb-20">
            <header className="bg-foreground text-white py-12 px-6">
                <div className="max-w-4xl mx-auto flex flex-col items-center text-center">
                    <Heart className="text-secondary mb-4" size={48} />
                    <h1 className="stencil-text text-4xl md:text-6xl mb-4">ECO É CUIDADO</h1>
                    <p className="text-lg font-bold opacity-80 max-w-2xl">
                        Em {neighborhood.name}, cuidamos do que é comum. O ECO não é um serviço de lixo,
                        é uma rede de confiança e trabalho digno.
                    </p>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-6 py-12 flex flex-col gap-20">
                {/* Rules Section */}
                <section className="animate-slide-up">
                    <h2 className="stencil-text text-2xl mb-8 border-b-4 border-primary inline-block">COMO ENTREGAR?</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="card rounded-none border-2 border-foreground p-6 flex flex-col gap-4">
                            <Zap className="text-primary" size={32} />
                            <h3 className="font-black uppercase text-xl">1. SECO E SEPARADO</h3>
                            <p className="text-sm font-bold opacity-70">Lave as embalagens. Comida no reciclável estraga o trabalho de quem coleta.</p>
                        </div>
                        <div className="card rounded-none border-2 border-foreground p-6 flex flex-col gap-4">
                            <ShieldCheck className="text-secondary" size={32} />
                            <h3 className="font-black uppercase text-xl">2. VIDRO SEGURO</h3>
                            <p className="text-sm font-bold opacity-70">Sempre dentro de caixas ou garrafas PET cortadas. O cuidado começa na sua mão.</p>
                        </div>
                        <div className="card rounded-none border-2 border-foreground p-6 flex flex-col gap-4">
                            <Smartphone className="text-accent" size={32} />
                            <h3 className="font-black uppercase text-xl">3. RECIBO É LEI</h3>
                            <p className="text-sm font-bold opacity-70">Sempre peça seu recibo digital ao entregar. Sem recibo, não há transparência.</p>
                        </div>
                    </div>
                </section>

                {/* Manifesto Section */}
                <section className="bg-muted/5 border-l-8 border-foreground p-10 flex flex-col md:flex-row gap-10 items-center">
                    <div className="flex-1">
                        <h2 className="stencil-text text-3xl mb-4 text-foreground">O COMUM NO CENTRO</h2>
                        <p className="font-bold text-lg leading-relaxed mb-6">
                            Acreditamos que todo material reciclável é uma reserva de energia coletiva.
                            Quando você separa corretamente, está garantindo o valor do trabalho do seu vizinho.
                        </p>
                        <div className="flex gap-4">
                            <div className="flex items-center gap-2 font-black text-[10px] uppercase">
                                <Globe size={16} /> Sem Greenwashing
                            </div>
                            <div className="flex items-center gap-2 font-black text-[10px] uppercase">
                                <Users size={16} /> Autonomia Local
                            </div>
                        </div>
                    </div>
                    <div className="w-full md:w-64 aspect-square bg-foreground text-secondary flex items-center justify-center p-8 text-center text-4xl stencil-text leading-tight flex-col">
                        SOLUÇÃO COLETIVA
                    </div>
                </section>

                {/* Local Info */}
                <section className="flex flex-col gap-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                        <div>
                            <h2 className="stencil-text text-2xl mb-4">ACOMPANHE O BAIRRO</h2>
                            <p className="font-bold mb-6 opacity-70">Toda semana publicamos o boletim de transparência com a qualidade do material e volume coletado.</p>
                            <Link
                                href={`/bairros/${slug}/transparencia`}
                                className="cta-button flex items-center justify-center gap-3 w-full md:w-fit px-8"
                            >
                                VER TRANSPARÊNCIA <ArrowRight size={20} />
                            </Link>
                        </div>
                        <div className="card rounded-none bg-white border-2 border-foreground p-8 border-dashed flex flex-col gap-4">
                            <MapPin className="text-primary" size={32} />
                            <h3 className="stencil-text text-xl uppercase">CÉLULA: {neighborhood.eco_cells?.name}</h3>
                            <p className="text-xs font-bold opacity-60">Operação mantida pelos cooperados locais em parceria com a COOP ECO.</p>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="max-w-4xl mx-auto px-6 pt-20 border-t-2 border-foreground/10 text-center">
                <p className="stencil-text text-sm opacity-30 mb-2 whitespace-nowrap overflow-hidden">
                    ECO É CUIDADO • RECIBO É LEI • TRABALHO DIGNO • ECO É CUIDADO • RECIBO É LEI • TRABALHO DIGNO
                </p>
                <Link href="/" className="font-black text-[10px] uppercase underline">Voltar para o Início</Link>
            </footer>
        </div>
    );
}
