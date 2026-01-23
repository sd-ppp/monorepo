const clampAlpha = (value: number): number => {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
};

const expandShorthandHex = (hex: string): string => {
  if (hex.length === 3) {
    return hex
      .split('')
      .map(char => char + char)
      .join('');
  }
  return hex;
};

export const withAlpha = (color: string, alpha: number): string => {
  const safeAlpha = clampAlpha(alpha);
  if (!color || typeof color !== 'string') {
    return `rgba(0,0,0,${safeAlpha})`;
  }

  const trimmed = color.trim();
  const hexMatch = /^#([0-9a-f]{3,8})$/i.exec(trimmed);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 8) {
      hex = hex.slice(0, 6);
    }
    hex = expandShorthandHex(hex);
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
        return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
      }
    }
  }

  const rgbMatch =
    /^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+))?\s*\)$/i.exec(trimmed);
  if (rgbMatch) {
    const r = Number(rgbMatch[1]);
    const g = Number(rgbMatch[2]);
    const b = Number(rgbMatch[3]);
    if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
      return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${safeAlpha})`;
    }
  }

  return trimmed;
};
