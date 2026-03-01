// src/lib/copy/lint.ts
import { createClient } from "@/lib/supabase";

export interface LintFinding {
    rule_key: string;
    severity: 'warn' | 'blocker';
    excerpt: string;
    hint: string;
}

export interface LintResult {
    ok: boolean;
    findings: LintFinding[];
}

/**
 * Normalizes copy by removing excessive punctuation, caps lock, and whitespace.
 */
export function normalizeCopy(text: string): string {
    if (!text) return "";

    let normalized = text;
    // Remove excessive exclamation marks (3 or more)
    normalized = normalized.replace(/!{3,}/g, "!");
    // Remove excessive question marks
    normalized = normalized.replace(/\?{3,}/g, "?");
    // Normalize excessive whitespace
    normalized = normalized.replace(/\s{2,}/g, " ");

    // Attempt to normalize AGGRESSIVE CAPS LOCK (heuristic: if more than 70% of words are CAPS and text is long)
    const words = normalized.split(/\s+/);
    const capsWords = words.filter(w => w.length > 2 && w === w.toUpperCase() && /[A-Z]/.test(w));
    if (words.length > 5 && (capsWords.length / words.length) > 0.7) {
        normalized = normalized.toLowerCase().replace(/(^\w|\.\s+\w)/g, letter => letter.toUpperCase());
    }

    return normalized.trim();
}

/**
 * Lints copy against rules defined in the database.
 */
export async function lintCopy(text: string, context?: { cell_id?: string; neighborhood_id?: string; source_kind: string }): Promise<LintResult> {
    const supabase = createClient();
    const { data: rules } = await supabase.from("eco_copy_lint_rules").select("*").eq("is_active", true);

    if (!rules) return { ok: true, findings: [] };

    const findings: LintFinding[] = [];
    const normalizedText = text.toLowerCase();

    for (const rule of rules) {
        const regex = new RegExp(rule.pattern, "gi");
        const matches = text.match(regex);

        if (matches) {
            for (const match of matches) {
                findings.push({
                    rule_key: rule.rule_key,
                    severity: rule.severity as 'warn' | 'blocker',
                    excerpt: match,
                    hint: rule.hint
                });
            }
        }
    }

    // Log findings if context is provided (best effort)
    if (context && findings.length > 0) {
        for (const finding of findings) {
            await supabase.rpc('rpc_log_lint_finding', {
                p_cell_id: context.cell_id,
                p_neighborhood_id: context.neighborhood_id,
                p_source_kind: context.source_kind,
                p_source_id: null, // to be updated if possible
                p_severity: finding.severity,
                p_rule_key: finding.rule_key,
                p_excerpt: finding.excerpt,
                p_suggestion: finding.hint
            });
        }
    }

    return {
        ok: !findings.some(f => f.severity === 'blocker'),
        findings
    };
}

/**
 * Automatically fixes common punitive terms based on policy replacements.
 */
export async function autofixCopy(text: string): Promise<{ text: string; changes: string[] }> {
    const supabase = createClient();
    const { data: policy } = await supabase.from("eco_copy_policy").select("replacements").order("created_at", { ascending: false }).limit(1).single();

    if (!policy || !policy.replacements) return { text, changes: [] };

    let fixedText = text;
    const changes: string[] = [];
    const replacements = policy.replacements as Record<string, string>;

    for (const [target, replacement] of Object.entries(replacements)) {
        const regex = new RegExp(`\\b${target}\\b`, "gi");
        if (regex.test(fixedText)) {
            fixedText = fixedText.replace(regex, replacement);
            changes.push(`${target} -> ${replacement}`);
        }
    }

    return { text: fixedText, changes };
}
