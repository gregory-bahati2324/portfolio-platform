/** "#2563EB" -> "37 99 235" for the --brand CSS variable. Returns null for invalid input. */
export function hexToRgbTriplet(hex: string): string | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}
