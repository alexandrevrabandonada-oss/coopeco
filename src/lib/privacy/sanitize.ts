// A34 — Utility for Privacy Sanitization and Asserts
// src/lib/privacy/sanitize.ts

/**
 * Redacts PII patterns (email, phone, CPF) from a string.
 */
export function redactPIIPatterns(text: string): string {
    if (!text) return text;

    let sanitized = text;

    // Email (simplificado: xxxx@xxxx.xxx)
    sanitized = sanitized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[EMAIL_REDIGIDO]");

    // Telefone (padrão BR: (xx) xxxxx-xxxx ou similar)
    sanitized = sanitized.replace(/(\(?\d{2}\)?\s?)?(\d{4,5}[-\s]?\d{4})/g, "[TEL_REDIGIDO]");

    // CPF (000.000.000-00)
    sanitized = sanitized.replace(/\d{3}\.\d{3}\.\d{3}-\d{2}/g, "[ID_REDIGIDO]");

    return sanitized;
}

/**
 * Removes sensitive keys from an object deeply.
 */
export function stripPrivateFields(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
        return obj.map(item => stripPrivateFields(item));
    }

    const privateKeys = [
        'address_full', 'phone', 'email', 'lat', 'lng',
        'pickup_request_private', 'user_id', 'full_name',
        'document_id', 'cpf'
    ];

    const clean: any = {};
    for (const [key, value] of Object.entries(obj)) {
        if (privateKeys.includes(key.toLowerCase())) {
            continue;
        }
        clean[key] = stripPrivateFields(value);
    }

    return clean;
}

/**
 * Asserts that an object contains no PII patterns in its string values.
 * Throws an error if PII is detected in a non-allowlisted path.
 */
export function assertNoPII(obj: any, allowlistPaths: string[] = []): void {
    const piiRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})|(\(?\d{2}\)?\s?)?(\d{4,5}[-\s]?\d{4})|(\d{3}\.\d{3}\.\d{3}-\d{2})/;

    function walk(value: any, path: string = "") {
        if (typeof value === 'string') {
            // Check if this path is allowlisted for redaction (e.g., body content that we redact but don't block)
            const isAllowlisted = allowlistPaths.some(p => {
                const regex = new RegExp(`^${p.replace(/\*/g, '.*')}$`);
                return regex.test(path);
            });

            if (!isAllowlisted && piiRegex.test(value)) {
                throw new Error(`PII_DETECTED: Padrão sensível encontrado no campo "${path}".`);
            }
        } else if (value && typeof value === 'object') {
            for (const [key, val] of Object.entries(value)) {
                walk(val, path ? `${path}.${key}` : key);
            }
        }
    }

    walk(obj);
}

/**
 * Ensures K-Anonymity for list data (zones, etc.)
 */
export function enforceKAnonymity<T extends { count?: number }>(rows: T[], k: number = 5): T[] {
    return rows.filter(row => (row.count || 0) >= k);
}
