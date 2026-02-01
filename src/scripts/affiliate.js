// src/scripts/affiliate.js
// Become Affiliate (compact) interactions

const $ = (sel, root = document) => root.querySelector(sel);

const formatInt = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return "0";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(v);
};

const formatUsd0 = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(v);
};

const copyToClipboard = async (text) => {
  const value = String(text || "").trim();
  if (!value) return false;

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch (_) {}

  try {
    const ta = document.createElement("textarea");
    ta.value = value;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    ta.style.left = "-1000px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return Boolean(ok);
  } catch (_) {
    return false;
  }
};

const flash = (btn, text, ms = 900) => {
  if (!btn) return;
  const prev = btn.textContent;
  btn.textContent = text;
  btn.disabled = true;
  window.setTimeout(() => {
    btn.textContent = prev;
    btn.disabled = false;
  }, ms);
};

const getDefaultModel = () => ({
  clicks: 30,
  signups: 21,
  earningsUsd: 2100,
  link: "byscript.io/?ref=EDWIN",
});

const readModel = (root) => {
  const model =
    window.__BYSCRIPT_AFFILIATE__ && typeof window.__BYSCRIPT_AFFILIATE__ === "object"
      ? { ...getDefaultModel(), ...window.__BYSCRIPT_AFFILIATE__ }
      : getDefaultModel();

  const linkAttr = root.getAttribute("data-affiliate-link");
  if (linkAttr && linkAttr.trim()) model.link = linkAttr.trim();

  return model;
};

const hydrate = (root, model) => {
  const clicksEl = $("[data-affiliate-clicks]", root);
  const signupsEl = $("[data-affiliate-signups]", root);
  const earningsEl = $("[data-affiliate-earnings]", root);

  if (clicksEl) clicksEl.textContent = formatInt(model.clicks);
  if (signupsEl) signupsEl.textContent = formatInt(model.signups);
  if (earningsEl) earningsEl.textContent = formatUsd0(model.earningsUsd);
};

const bind = (root, model) => {
  root.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-affiliate-action]");
    if (!btn) return;

    const action = btn.getAttribute("data-affiliate-action");
    if (action !== "copy-link") return;

    const ok = await copyToClipboard(model.link);
    flash(btn, ok ? "Copied" : "Copy failed");
  });
};

const init = () => {
  const root = document.querySelector("[data-affiliate]");
  if (!root) return;

  const model = readModel(root);
  hydrate(root, model);
  bind(root, model);
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
