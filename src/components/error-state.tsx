"use client";

import { useEffect } from "react";

export function ErrorState({
  title,
  body,
  onRetry,
  code,
}: {
  title: string;
  body: string;
  onRetry?: () => void;
  code?: string;
}) {
  useEffect(() => {
    if (code) console.error(code);
  }, [code]);

  return (
    <div className="card text-center py-12 animate-slide-up" style={{ borderColor: "var(--accent)" }}>
      <h2 className="stencil-text mb-3">{title}</h2>
      <p className="font-bold text-xs uppercase">{body}</p>
      {onRetry && (
        <button className="cta-button mx-auto mt-6" onClick={onRetry}>
          Tentar novamente
        </button>
      )}
    </div>
  );
}
