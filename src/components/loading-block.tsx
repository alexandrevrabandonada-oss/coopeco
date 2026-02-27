"use client";

import { Loader2 } from "lucide-react";

export function LoadingBlock({ text = "Carregando..." }: { text?: string }) {
  return (
    <div className="card text-center py-12 animate-slide-up">
      <Loader2 className="animate-spin text-primary mx-auto mb-3" size={38} />
      <p className="font-bold text-xs uppercase">{text}</p>
    </div>
  );
}
