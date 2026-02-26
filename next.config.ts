import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

function toHostname(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isSafeDevHost(host: string): boolean {
  if (host === "localhost" || host === "127.0.0.1") return true;
  return host.includes("antigravity");
}

const candidateHosts = [
  "localhost",
  "127.0.0.1",
  toHostname(process.env.PLAYWRIGHT_BASE_URL),
  toHostname(process.env.ANTIGRAVITY_ORIGIN),
  toHostname(process.env.NEXT_PUBLIC_APP_URL),
].filter((host): host is string => Boolean(host));

const allowedDevOrigins = Array.from(new Set(candidateHosts.filter((host) => isSafeDevHost(host))));

const nextConfig: NextConfig = {
  ...(isDev && allowedDevOrigins.length > 0 ? { allowedDevOrigins } : {}),
};

export default nextConfig;
