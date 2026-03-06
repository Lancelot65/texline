export const BLOCK_ENV_GROUP =
  "aligned|align\\*?|alignat\\*?|gather\\*?|equation\\*?|multline\\*?|cases|matrix|pmatrix|bmatrix|Bmatrix|vmatrix|Vmatrix";

export function normalizeModelText(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "")
    .trimEnd();
}
