const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET || '';
const BYPASS_PARAM = 'x-vercel-protection-bypass';

function maskSecret(value) {
  if (!bypassSecret) return value;
  return String(value ?? '').split(bypassSecret).join('***');
}

function withBypassQuery(url) {
  if (!bypassSecret) return url;
  const parsed = new URL(url);
  parsed.searchParams.set(BYPASS_PARAM, bypassSecret);
  return parsed.toString();
}

function mergeHeaders(inputHeaders = {}) {
  const headers = new Headers(inputHeaders);
  if (bypassSecret) {
    headers.set(BYPASS_PARAM, bypassSecret);
    headers.set('x-vercel-set-bypass-cookie', 'true');
  }
  return headers;
}

export async function fetchWithBypass(url, init = {}) {
  const baseRequestInit = {
    ...init,
    headers: mergeHeaders(init.headers || {}),
  };

  try {
    const firstResponse = await fetch(url, baseRequestInit);
    if (firstResponse.status !== 401 || !bypassSecret) {
      return firstResponse;
    }

    const fallbackUrl = withBypassQuery(url);
    return await fetch(fallbackUrl, baseRequestInit);
  } catch (error) {
    const message = maskSecret(error?.message || String(error));
    throw new Error(message);
  }
}

export function getDeploymentProtectionHint(status, bodyText) {
  if (status === 401 && /Authentication Required/i.test(bodyText || '')) {
    return 'Deployment Protection ativo. Defina VERCEL_AUTOMATION_BYPASS_SECRET com o secret do Vercel e tente novamente.';
  }
  return null;
}

export function hasBypassSecret() {
  return Boolean(bypassSecret);
}

export function maskBypassSecret(value) {
  return maskSecret(value);
}
