/**
 * Upload na API grava `url` como chave no R2; a resposta completa usa CLOUDFLARE_URL + chave.
 * Fallback para respostas antigas sem URL absoluta (mesma base da API em .env).
 */
export function resolveWorkInstructionAttachmentUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  if (/^https?:\/\//i.test(t)) return t;
  const base = (process.env.EXPO_PUBLIC_CLOUDFLARE_URL || "").replace(
    /\/$/,
    "",
  );
  if (base) {
    return `${base}/${t.replace(/^\//, "")}`;
  }
  return t;
}
