import Link from "next/link";

export default function PerfilEnderecoPage() {
  return (
    <div className="animate-slide-up pb-12">
      <h1
        className="stencil-text mb-6"
        style={{
          fontSize: "2rem",
          background: "var(--primary)",
          padding: "0 10px",
          border: "2px solid var(--foreground)",
          width: "fit-content",
        }}
      >
        ENDEREÇO DE COLETA
      </h1>

      <div className="card">
        <p className="font-black text-sm uppercase mb-2">Atualize seu endereço privado para recorrência doorstep</p>
        <p className="font-bold text-xs uppercase mb-4">
          Esse dado é usado apenas para operação de coleta e não aparece em métricas públicas.
        </p>
        <Link href="/perfil" className="cta-button">
          Ir para Meu Perfil
        </Link>
      </div>
    </div>
  );
}
