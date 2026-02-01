// src/scripts/color.js
// Brand-safe color helper for account_id / asset_id color_id.
//
// New standard:
// - accounts.json + assets.json include: "color_id": "#RRGGBB" (preferred)
// Backward compatibility:
// - numeric color_id still works (deterministic golden-angle HSL)

const isHex = (v) =>
  typeof v === "string" && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v.trim());

const normalizeHex = (hex) => {
  const v = hex.trim().toUpperCase();
  if (v.length === 4) {
    const r = v[1];
    const g = v[2];
    const b = v[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return v;
};

export const colorFromId = (colorId, opts = {}) => {
  // Preferred: use provided hex directly (brand-consistent)
  if (isHex(colorId)) return normalizeHex(colorId);

  // Allow passing raw hsl(...) strings when needed
  if (typeof colorId === "string" && colorId.trim().toLowerCase().startsWith("hsl(")) {
    return colorId.trim();
  }

  // Legacy numeric: generate a vibrant, evenly spread spectrum
  const n = Number(colorId);
  const sat = Number(opts.sat ?? 88);
  const light = Number(opts.light ?? 56);

  if (!Number.isFinite(n)) return "#68FE1D";

  const hue = (n * 137.508) % 360;
  return `hsl(${hue.toFixed(2)}, ${sat}%, ${light}%)`;
};
