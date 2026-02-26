import { NextRequest, NextResponse } from "next/server";

const ECO_ENV = process.env.ECO_ENV || "dev";
const STAGING_PASS = process.env.ECO_STAGING_PASS || "";
const STAGING_GATE_COOKIE = "eco_staging_gate";

function buildRobotsBody() {
  if (ECO_ENV === "staging") {
    return "User-agent: *\nDisallow: /\n";
  }
  return "User-agent: *\nAllow: /\n";
}

function isStaticBypass(pathname: string) {
  return (
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/manifest") ||
    pathname.startsWith("/file.svg") ||
    pathname.startsWith("/next.svg") ||
    pathname.startsWith("/vercel.svg") ||
    pathname.startsWith("/window.svg") ||
    pathname.startsWith("/globe.svg")
  );
}

function gateHtml(pathname: string) {
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>ECO Staging Gate</title>
    <style>
      body { font-family: sans-serif; background: #f5f5f5; margin: 0; }
      main { max-width: 420px; margin: 10vh auto; background: #fff; border: 2px solid #111; padding: 20px; }
      h1 { font-size: 18px; margin: 0 0 12px; }
      p { font-size: 14px; margin: 0 0 16px; }
      input, button { width: 100%; padding: 10px; border: 2px solid #111; font-size: 14px; box-sizing: border-box; }
      button { margin-top: 10px; font-weight: 700; background: #111; color: #fff; cursor: pointer; }
    </style>
  </head>
  <body>
    <main>
      <h1>Staging protegido</h1>
      <p>Informe a senha de acesso para continuar.</p>
      <form method="GET" action="${pathname}">
        <input type="password" name="access" placeholder="Senha de staging" required />
        <button type="submit">Entrar</button>
      </form>
    </main>
  </body>
</html>`;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/robots.txt") {
    return new NextResponse(buildRobotsBody(), {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  if (ECO_ENV !== "staging") {
    return NextResponse.next();
  }

  if (!STAGING_PASS) {
    return new NextResponse("Staging bloqueado: configure ECO_STAGING_PASS.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  if (isStaticBypass(pathname)) {
    return NextResponse.next();
  }

  const passFromCookie = request.cookies.get(STAGING_GATE_COOKIE)?.value || "";
  if (passFromCookie === STAGING_PASS) {
    return NextResponse.next();
  }

  const passFromQuery = request.nextUrl.searchParams.get("access") || "";
  const passFromHeader = request.headers.get("x-eco-staging-pass") || "";
  const passFromClientCookie = request.cookies.get("eco_staging_pass")?.value || "";
  const candidatePass = passFromQuery || passFromHeader || passFromClientCookie;

  if (candidatePass === STAGING_PASS) {
    const cleanUrl = request.nextUrl.clone();
    cleanUrl.searchParams.delete("access");
    const response = passFromQuery
      ? NextResponse.redirect(cleanUrl)
      : NextResponse.next();

    response.cookies.set(STAGING_GATE_COOKIE, STAGING_PASS, {
      httpOnly: true,
      sameSite: "lax",
      secure: cleanUrl.protocol === "https:",
      path: "/",
      maxAge: 60 * 60 * 8,
    });
    return response;
  }

  return new NextResponse(gateHtml(pathname), {
    status: 401,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|_next/webpack-hmr).*)"],
};
