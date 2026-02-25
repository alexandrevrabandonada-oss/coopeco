import Link from "next/link"
import { Recycle, ArrowRight, TrendingUp, Users } from "lucide-react"

export default function Home() {
  return (
    <div className="animate-slide-up">
      <section className="hero" style={{ padding: '3rem 0', textAlign: 'left', borderBottom: '4px solid var(--foreground)' }}>
        <h1 className="stencil-text" style={{ fontSize: 'clamp(2.5rem, 8vw, 4rem)', lineHeight: '0.9', marginBottom: '1.5rem' }}>
          Sua ação vira <span style={{ background: 'var(--primary)', padding: '0 10px' }}>impacto</span>.
        </h1>
        <p style={{ fontSize: '1.1rem', fontWeight: 600, maxWidth: '600px', marginBottom: '2.5rem' }}>
          REDE SOCIAL DO BEM: RECICLAGEM GERA RECIBO E ORGULHO LOCAL.
        </p>

        <Link href="/pedir-coleta" className="cta-button">
          <Recycle size={28} />
          Pedir coleta agora
          <ArrowRight size={24} />
        </Link>
      </section>

      <section style={{ marginTop: '3rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem' }}>
          <h2 className="stencil-text" style={{ fontSize: '1.75rem' }}>Destaques / News</h2>
          <Link href="/mural" style={{ fontWeight: 800, textDecoration: 'underline', color: 'var(--accent)' }}>VER TUDO</Link>
        </div>

        <div className="card" style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <div style={{ background: 'var(--primary)', padding: '1rem', border: '2px solid var(--foreground)' }}>
            <TrendingUp size={32} />
          </div>
          <div>
            <h3 className="stencil-text" style={{ fontSize: '1.25rem' }}>Planalto em 1º lugar</h3>
            <p style={{ fontWeight: 600, color: '#404040' }}>BAIRRO MAIS SUSTENTÁVEL DESTA SEMANA!</p>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <div style={{ background: 'var(--accent)', padding: '1rem', border: '2px solid var(--foreground)', color: 'white' }}>
            <Users size={32} />
          </div>
          <div>
            <h3 className="stencil-text" style={{ fontSize: '1.25rem' }}>Ação de Sábado</h3>
            <p style={{ fontWeight: 600, color: '#404040' }}>LIMPEZA NO PARQUE DAS ÁGUAS. 12 APOIADORES.</p>
          </div>
        </div>
      </section>

      <section style={{ marginTop: '2rem', marginBottom: '3rem' }}>
        <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '1rem' }}>
          {['TAMPINHAS', 'PAPELÃO', 'ÓLEO', 'VIDRO', 'ELETRÔNICOS'].map((item) => (
            <div key={item} style={{
              padding: '0.75rem 1.5rem',
              background: 'white',
              border: '2px solid var(--foreground)',
              fontWeight: 900,
              fontSize: '0.875rem',
              whiteSpace: 'nowrap'
            }}>
              {item}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
