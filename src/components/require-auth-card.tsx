"use client";

import { useState } from "react";
import { ArrowLeft, LockKeyhole, Eye, EyeOff, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export function RequireAuthCard({
  title = "Acesso necessário",
  body = "Entre na sua conta para continuar.",
  ctaLabel = "Ir para login",
  ctaHref = "/perfil",
}: {
  title?: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("Email ou senha incorretos.");
      setLoading(false);
    }
    // Se sucesso: manter loading=true enquanto o auth context atualiza via onAuthStateChange.
    // O ProtectedRouteGate vai desmontar este componente quando isAllowed=true.
    // Safety: reset loading após 8s se nada acontecer.
    setTimeout(() => setLoading(false), 8000);
  }

  return (
    <div className="card animate-slide-up" style={{ maxWidth: 420, margin: "0 auto", padding: "2.5rem 2rem" }}>
      <div className="text-center mb-6">
        <LockKeyhole size={40} className="mx-auto mb-3 text-accent" />
        <h2 className="stencil-text mb-1" style={{ fontSize: "1.5rem" }}>{title}</h2>
        <p className="font-bold text-xs uppercase" style={{ color: "var(--muted-foreground)" }}>{body}</p>
      </div>

      <form onSubmit={handleLogin} className="flex flex-col gap-4">
        <div>
          <label className="block font-black text-[10px] uppercase mb-1" htmlFor="admin-email">Email</label>
          <input
            id="admin-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="seu@email.com"
            style={{
              width: "100%",
              border: "2px solid var(--foreground)",
              padding: "10px 12px",
              fontSize: "0.875rem",
              fontWeight: "bold",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div>
          <label className="block font-black text-[10px] uppercase mb-1" htmlFor="admin-password">Senha</label>
          <div style={{ position: "relative" }}>
            <input
              id="admin-password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: "100%",
                border: "2px solid var(--foreground)",
                padding: "10px 42px 10px 12px",
                fontSize: "0.875rem",
                fontWeight: "bold",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              style={{
                position: "absolute",
                right: 10,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
                color: "var(--muted-foreground)",
              }}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {error && (
          <p style={{ color: "var(--accent)", fontWeight: "bold", fontSize: "0.75rem", textTransform: "uppercase" }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="cta-button"
          style={{ width: "100%", justifyContent: "center", opacity: loading ? 0.7 : 1 }}
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : "Entrar"}
        </button>
      </form>

      <div className="flex justify-center mt-4">
        <button
          className="cta-button small"
          style={{ background: "white" }}
          onClick={() => router.back()}
        >
          <ArrowLeft size={14} /> Voltar
        </button>
      </div>
    </div>
  );
}
