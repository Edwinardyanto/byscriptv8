// src/scripts/affiliate.js
// Become Affiliate (v2) interactions

const $ = (sel, root = document) => root.querySelector(sel);

const formatInt = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return "0";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(v);
};

const formatUsd = (n) => {
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
  } catch (e) {
    // fallback below
  }

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
  } catch (e) {
    return false;
  }
};

const flashButton = (btn, text, ms = 900) => {
  if (!btn) return;
  const prev = btn.textContent;
  btn.textContent = text;
  btn.disabled = true;
  window.setTimeout(() => {
    btn.textContent = prev;
    btn.disabled = false;
  }, ms);
};

const getDefaultAffiliateModel = () => ({
  clicks7d: 0,
  clicks30d: 0,
  signups: 0,
  paidUsers: 0,
  earningsMonthUsd: 0,
  earningsLifetimeUsd: 0,
  link: "byscript.io/?ref=EDWIN",
  coupon: "EDWIN20",
  commission: "20%",
  cookie: "30 days",
  payoutMin: "$100",
});

const hydrateAffiliate = (root) => {
  const model =
    window.__BYSCRIPT_AFFILIATE__ && typeof window.__BYSCRIPT_AFFILIATE__ === "object"
      ? { ...getDefaultAffiliateModel(), ...window.__BYSCRIPT_AFFILIATE__ }
      : getDefaultAffiliateModel();

  const linkEl = $("[data-affiliate-link]", root);
  if (linkEl && linkEl.textContent.trim()) model.link = linkEl.textContent.trim();

  const couponEl = $("[data-affiliate-coupon]", root);
  if (couponEl && couponEl.textContent.trim()) model.coupon = couponEl.textContent.trim();

  const clicksValue = $("[data-affiliate-clicks]", root);
  const clicksMeta = $("[data-affiliate-clicks-meta]", root);
  if (clicksValue)
    clicksValue.textContent = `${formatInt(model.clicks7d)} / ${formatInt(model.clicks30d)}`;
  if (clicksMeta) clicksMeta.textContent = "7D / 30D";

  const signupsValue = $("[data-affiliate-signups]", root);
  if (signupsValue) signupsValue.textContent = formatInt(model.signups);

  const earningsValue = $("[data-affiliate-earnings]", root);
  const earningsMeta = $("[data-affiliate-earnings-meta]", root);
  if (earningsValue) earningsValue.textContent = formatUsd(model.earningsMonthUsd);
  if (earningsMeta) {
    earningsMeta.textContent = `This month / Lifetime: ${formatUsd(model.earningsMonthUsd)} / ${formatUsd(
      model.earningsLifetimeUsd
    )}`;
  }

  const clicks7 = $("[data-affiliate-clicks7]", root);
  if (clicks7) clicks7.textContent = formatInt(model.clicks7d);

  const signups2 = $("[data-affiliate-signups2]", root);
  if (signups2) signups2.textContent = formatInt(model.signups);

  const paid = $("[data-affiliate-paid]", root);
  if (paid) paid.textContent = formatInt(model.paidUsers);

  const commission = $("[data-affiliate-commission]", root);
  if (commission) commission.textContent = model.commission;

  const cookie = $("[data-affiliate-cookie]", root);
  if (cookie) cookie.textContent = model.cookie;

  const payout = $("[data-affiliate-payout]", root);
  if (payout) payout.textContent = model.payoutMin;

  const couponRow = $("[data-affiliate-coupon-row]", root);
  const hasCoupon = Boolean(String(model.coupon || "").trim());
  if (couponRow) couponRow.style.display = hasCoupon ? "grid" : "none";

  return model;
};

const bindAffiliateActions = (root, model) => {
  const getLink = () => String(model.link || "").trim();
  const getCoupon = () => String(model.coupon || "").trim();

  const promoText = () => {
    const link = getLink();
    const coupon = getCoupon();
    const lines = ["Automate your trading with byScript.io.", `Get started here: ${link}`];
    if (coupon) lines.push(`Optional coupon: ${coupon}`);
    return lines.join("\n");
  };

  root.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-affiliate-action]");
    if (!btn) return;

    const action = btn.getAttribute("data-affiliate-action");
    if (!action) return;

    if (btn.hasAttribute("disabled")) return;

    if (action === "copy-link") {
      const ok = await copyToClipboard(getLink());
      flashButton(btn, ok ? "Copied" : "Copy failed");
      return;
    }

    if (action === "copy-referral") {
      const ok = await copyToClipboard(getLink());
      flashButton(btn, ok ? "Copied" : "Copy failed", 1100);
      return;
    }

    if (action === "copy-coupon") {
      const ok = await copyToClipboard(getCoupon());
      flashButton(btn, ok ? "Copied" : "Copy failed");
      return;
    }

    if (action === "copy-promo") {
      const ok = await copyToClipboard(promoText());
      flashButton(btn, ok ? "Copied" : "Copy failed");
      return;
    }
  });
};

const initAffiliate = () => {
  const root = document.querySelector("[data-affiliate]");
  if (!root) return;

  const model = hydrateAffiliate(root);
  bindAffiliateActions(root, model);
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAffiliate);
} else {
  initAffiliate();
}
