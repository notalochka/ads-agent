/**
 * Guardrails for untrusted advertisement / user text before it reaches an LLM.
 * We neutralize instruction-like patterns; we do not invent marketing content.
 */

const INJECTION_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/gi, label: "ignore-instructions" },
  { pattern: /disregard\s+(all\s+)?(previous|prior|above)/gi, label: "disregard" },
  { pattern: /system\s*prompt/gi, label: "system-prompt" },
  { pattern: /\bdo\s+not\s+follow\s+(the\s+)?rules\b/gi, label: "bypass-rules" },
  { pattern: /\byou\s+are\s+now\b/gi, label: "role-hijack" },
  { pattern: /\bact\s+as\s+(dan|developer\s+mode|jailbreak)\b/gi, label: "jailbreak" },
  { pattern: /<\/?\s*(system|assistant|user)\s*>/gi, label: "role-tag" },
  { pattern: /\[\[\s*system\s*\]\]/gi, label: "system-bracket" },
];

export type SanitizeResult = {
  text: string | null;
  flags: string[];
};

/**
 * Strip control chars, cap length, neutralize common prompt-injection phrases.
 */
export function sanitizeUntrustedText(
  value: string | null | undefined,
  options: { maxLength?: number } = {},
): SanitizeResult {
  if (value == null) return { text: null, flags: [] };

  const maxLength = options.maxLength ?? 2000;
  let text = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ");
  text = text.replace(/\s+/g, " ").trim();

  if (!text) return { text: null, flags: [] };

  const flags: string[] = [];
  for (const { pattern, label } of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      flags.push(label);
      text = text.replace(pattern, "[filtered]");
    }
    // Reset lastIndex for global regex reuse
    pattern.lastIndex = 0;
  }

  if (text.length > maxLength) {
    text = `${text.slice(0, maxLength)}…`;
    flags.push("truncated");
  }

  return { text, flags };
}

export function sanitizeNullableField(
  value: string | null | undefined,
  maxLength = 500,
): string | null {
  return sanitizeUntrustedText(value, { maxLength }).text;
}

/**
 * True when text looks like an attempt to override model instructions.
 */
export function looksLikePromptInjection(value: string | null | undefined): boolean {
  if (!value) return false;
  return INJECTION_PATTERNS.some(({ pattern }) => {
    const hit = pattern.test(value);
    pattern.lastIndex = 0;
    return hit;
  });
}
