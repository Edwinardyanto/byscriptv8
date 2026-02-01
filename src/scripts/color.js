// src/scripts/color.js
// Color resolver for account/asset identity colors.
//
// New standard:
// - accounts.json and assets.json store a stable HEX string in `color_id` (e.g. "#F7931A").
//
// Backward compatibility:
// - If `color_id` is a number, we generate a deterministic vibrant HSL color.

const isHex = (v) => typeof v === "string" && /^#([0-9a-fA-F]{6})$/.test(v.trim());
const isHsl = (v) =>
  typeof v === "string" && /^hsl\(\s*[-\d.]+\s*,\s*[-\d.]+%\s*,\s*[-\d.]+%\s*\)$/i.test(v.trim());

export const colorFromId = (colorId, opts = {}) => {
  // Preferred: HEX / HSL string stored in data
  if (isHex(colorId)) return colorId.trim().toUpperCase();
  if (isHsl(colorId)) return colorId.trim();

  // Legacy: numeric id -> deterministic HSL
  const n = Number(colorId);
  const sat = Number(opts.sat ?? 88);
  const light = Number(opts.light ?? 56);

  if (!Number.isFinite(n)) return "#68FE1D";

  // Golden-angle spacing for wide, even spectrum.
  const hue = (n * 137.508) % 360;
  return `hsl(${hue.toFixed(2)}, ${sat}%, ${light}%)`;
};
