// src/scripts/color.js
// Deterministic vibrant color from numeric color_id.

export const colorFromId = (colorId, opts = {}) => {
  const n = Number(colorId);
  const sat = Number(opts.sat ?? 88);
  const light = Number(opts.light ?? 56);

  if (!Number.isFinite(n)) return "#68FE1D";

  // Golden-angle spacing for wide, even spectrum.
  const hue = (n * 137.508) % 360;
  return `hsl(${hue.toFixed(2)}, ${sat}%, ${light}%)`;
};
