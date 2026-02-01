// src/scripts/components/sharePopup.js

let activeOverlay = null;

const escHandler = (e) => {
  if (e.key === "Escape") closeSharePopup();
};

const safeText = (v) => (v == null ? "" : String(v));

const formatSignedMoney = (value) => {
  const n = Number(value || 0);
  const sign = n > 0 ? "+" : n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
};

const formatSignedPct = (value) => {
  const n = Number(value || 0);
  const sign = n > 0 ? "+" : n < 0 ? "-" : "";
  return `${sign}${Math.abs(n).toFixed(2)}%`;
};

const buildShareText = (d) => {
  const pair = d.pairLabel || d.symbol || "TRADE";
  const pnlUsd = formatSignedMoney(d.pnlUsd);
  const pnlPct = formatSignedPct(d.pnlPct);
  const action = d.action || "";
  const account = d.accountName ? ` | ${d.accountName}` : "";
  const time = d.timeLabel ? ` | ${d.timeLabel}` : "";
  return `${pair} | ${action} | PnL ${pnlUsd} (${pnlPct})${account}${time}`;
};

const tryCopy = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    return false;
  }
};

const downloadCanvas = async (canvas, filename) => {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) return resolve(false);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 500);
      resolve(true);
    }, "image/png");
  });
};

const drawShareImage = (d) => {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;

  const ctx = canvas.getContext("2d");

  // Background
  const g = ctx.createRadialGradient(540, 220, 10, 540, 220, 1500);
  g.addColorStop(0, "#111111");
  g.addColorStop(1, "#000000");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Card outline
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 4;
  const r = 56;
  const x = 80, y = 140, w = 920, h = 1640;
  roundRect(ctx, x, y, w, h, r);
  ctx.stroke();

  // Text
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.font = "40px Inter, system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Trade Result", 540, 320);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "92px Inter, system-ui, -apple-system, sans-serif";
  ctx.fillText(safeText(d.pairLabel || d.symbol || "TRADE"), 540, 480);

  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.font = "52px Inter, system-ui, -apple-system, sans-serif";
  ctx.fillText(safeText(d.action || ""), 540, 600);

  const isPos = Number(d.pnlUsd || 0) > 0;
  const isNeg = Number(d.pnlUsd || 0) < 0;
  ctx.fillStyle = isNeg ? "#FF5F5F" : isPos ? "#68FE1D" : "rgba(255,255,255,0.75)";
  ctx.font = "86px Inter, system-ui, -apple-system, sans-serif";
  ctx.fillText(formatSignedMoney(d.pnlUsd), 540, 770);

  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "44px Inter, system-ui, -apple-system, sans-serif";
  ctx.fillText(formatSignedPct(d.pnlPct), 540, 845);

  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "36px Inter, system-ui, -apple-system, sans-serif";
  const meta = [d.accountName, d.exchangeLabel, d.timeLabel].filter(Boolean).join(" | ");
  ctx.fillText(meta, 540, 980);

  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.font = "30px Inter, system-ui, -apple-system, sans-serif";
  ctx.fillText("byScript.io", 540, 1700);

  return canvas;
};

const roundRect = (ctx, x, y, w, h, r) => {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
};

export const closeSharePopup = () => {
  if (!activeOverlay) return;

  document.removeEventListener("keydown", escHandler);

  const overlay = activeOverlay;
  activeOverlay = null;

  try {
    overlay.remove();
  } catch (e) {}

  document.body.classList.remove("share-lock-scroll");
};

export const openSharePopup = (data = {}) => {
  closeSharePopup();

  const d = {
    symbol: safeText(data.symbol),
    pairLabel: safeText(data.pairLabel),
    action: safeText(data.action),
    pnlUsd: Number(data.pnlUsd || 0),
    pnlPct: Number(data.pnlPct || 0),
    timeLabel: safeText(data.timeLabel),
    accountName: safeText(data.accountName),
    exchangeLabel: safeText(data.exchangeLabel),
    shareUrl: safeText(data.shareUrl),
  };

  const shareText = buildShareText(d);

  const overlay = document.createElement("div");
  overlay.className = "share-overlay";
  overlay.innerHTML = `
    <div class="share-modal" role="dialog" aria-modal="true" aria-label="Share trade">
      <button class="share-close" type="button" aria-label="Close">×</button>

      <div class="share-shell">
        <div class="share-card">
          <div class="share-title">Trade Result</div>
          <div class="share-pair">${safeText(d.pairLabel || d.symbol || "TRADE")}</div>
          <div class="share-action">${safeText(d.action)}</div>

          <div class="share-profit ${Number(d.pnlUsd) < 0 ? "share-profit--negative" : Number(d.pnlUsd) > 0 ? "share-profit--positive" : "share-profit--neutral"}">
            ${formatSignedMoney(d.pnlUsd)}
            <span>${formatSignedPct(d.pnlPct)}</span>
          </div>

          <div class="share-time">${safeText(d.timeLabel)}</div>

          <div class="share-meta">
            ${safeText(d.accountName)}
            ${d.exchangeLabel ? `<span class="share-meta-sep">|</span> ${safeText(d.exchangeLabel)}` : ""}
          </div>
        </div>

        <div class="share-side">
          <div class="share-side-title">Customize your message</div>
          <textarea class="share-message" rows="3">${shareText}</textarea>

          <div class="share-side-row">
            <div class="share-link">${safeText(d.shareUrl || "")}</div>
            <button class="share-mini-btn" type="button" data-action="copyLink" ${d.shareUrl ? "" : "disabled"}>Copy</button>
          </div>

          <div class="share-actions">
            <button class="share-action-btn" type="button" data-action="copyText">Copy text</button>
            <button class="share-action-btn" type="button" data-action="download">Download image</button>
            <button class="share-action-btn" type="button" data-action="systemShare">Share</button>
          </div>

          <div class="share-hint" data-hint=""></div>
        </div>
      </div>
    </div>
  `;

  const closeBtn = overlay.querySelector(".share-close");
  const modal = overlay.querySelector(".share-modal");
  const hint = overlay.querySelector(".share-hint");
  const messageEl = overlay.querySelector(".share-message");
  const linkBtn = overlay.querySelector('[data-action="copyLink"]');

  const setHint = (text) => {
    if (!hint) return;
    hint.textContent = text || "";
    hint.classList.toggle("is-visible", Boolean(text));
    if (text) setTimeout(() => setHint(""), 1600);
  };

  const onClose = () => closeSharePopup();

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) onClose();
  });

  closeBtn?.addEventListener("click", onClose);

  modal?.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  linkBtn?.addEventListener("click", async () => {
    if (!d.shareUrl) return;
    const ok = await tryCopy(d.shareUrl);
    setHint(ok ? "Link copied" : "Copy failed");
  });

  overlay.querySelectorAll(".share-action-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const action = btn.getAttribute("data-action");
      const textNow = messageEl?.value || shareText;

      if (action === "copyText") {
        const ok = await tryCopy(textNow);
        setHint(ok ? "Text copied" : "Copy failed");
        return;
      }

      if (action === "download") {
        const canvas = drawShareImage({ ...d, pairLabel: d.pairLabel || d.symbol });
        const filename = `byscript-trade-${Date.now()}.png`;
        const ok = await downloadCanvas(canvas, filename);
        setHint(ok ? "Image downloaded" : "Download failed");
        return;
      }

      if (action === "systemShare") {
        const payload = { text: textNow };
        if (d.shareUrl) payload.url = d.shareUrl;

        if (navigator.share) {
          try {
            await navigator.share(payload);
            setHint("Shared");
          } catch (e) {
            setHint("Share cancelled");
          }
        } else {
          const ok = await tryCopy(textNow + (d.shareUrl ? `\n${d.shareUrl}` : ""));
          setHint(ok ? "Copied for sharing" : "Copy failed");
        }
      }
    });
  });

  document.body.appendChild(overlay);
  document.body.classList.add("share-lock-scroll");

  activeOverlay = overlay;

  document.addEventListener("keydown", escHandler);
};
