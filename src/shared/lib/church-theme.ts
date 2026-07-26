function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "");
  const value = normalized.length === 3
    ? normalized.split("").map((c) => c + c).join("")
    : normalized;
  const int = parseInt(value, 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  const delta = max - min;
  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r: h = ((g - b) / delta) % 6; break;
      case g: h = (b - r) / delta + 2; break;
      default: h = (r - g) / delta + 4; break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let [r, g, b] = [0, 0, 0];
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (value: number) => Math.round((value + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isValidHex(hex: string) {
  return /^#[0-9a-fA-F]{6}$/.test(hex);
}

// Deriva a paleta completa da igreja a partir de uma única cor principal,
// para que trocar a cor mude botões, links, badges e gradientes no app inteiro.
export function getChurchTheme(primaryHex: string) {
  const safeHex = isValidHex(primaryHex) ? primaryHex : "#277ad8";
  const [r, g, b] = hexToRgb(safeHex);
  const [h, s, l] = rgbToHsl(r, g, b);
  return {
    base: safeHex,
    dark: hslToHex(h, clamp(s, 0.35, 1), clamp(l - 0.14, 0.14, 0.85)),
    darker: hslToHex(h, clamp(s, 0.35, 1), clamp(l - 0.26, 0.08, 0.85)),
    light: hslToHex(h, clamp(s, 0.35, 1), clamp(l + 0.14, 0.15, 0.9)),
    soft: hslToHex(h, clamp(s, 0.2, 0.9), clamp(l + 0.42, 0.9, 0.96)),
    softer: hslToHex(h, clamp(s, 0.15, 0.7), clamp(l + 0.46, 0.94, 0.98)),
    onSoft: hslToHex(h, clamp(s, 0.35, 1), clamp(l - 0.18, 0.18, 0.5)),
  };
}
