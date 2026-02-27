"use client";

import { ArrowLeft, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function RequireAuthCard({
  title = "Acesso necessário",
  body = "Você precisa entrar para continuar.",
  ctaLabel = "Ir para login",
  ctaHref = "/perfil",
}: {
  title?: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  const router = useRouter();

  return (
    <div className="card text-center py-12 animate-slide-up">
      <LockKeyhole size={44} className="mx-auto mb-4 text-accent" />
      <h2 className="stencil-text mb-3">{title}</h2>
      <p className="font-bold text-xs uppercase">{body}</p>
      <div className="flex justify-center gap-2 mt-6">
        <button className="cta-button small" style={{ background: "white" }} onClick={() => router.back()}>
          <ArrowLeft size={14} /> Voltar
        </button>
        <Link href={ctaHref} className="cta-button small">
          {ctaLabel}
        </Link>
      </div>
    </div>
  );
}
