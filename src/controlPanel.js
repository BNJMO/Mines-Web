const TOTAL_PROFIT_SELECTOR = "[data-total-profit-display]";

let totalProfitDisplayEl = null;
let currentTotalProfitMultiplier = 1;

function resolveTotalProfitElement() {
  if (!totalProfitDisplayEl) {
    totalProfitDisplayEl = document.querySelector(TOTAL_PROFIT_SELECTOR);
  }
  return totalProfitDisplayEl;
}

function formatMultiplier(multiplier) {
  if (typeof multiplier === "number" && Number.isFinite(multiplier)) {
    return multiplier.toFixed(2);
  }

  const parsed = Number.parseFloat(multiplier);
  if (Number.isFinite(parsed)) {
    return parsed.toFixed(2);
  }

  return currentTotalProfitMultiplier.toFixed(2);
}

export function updateTotalProfitMultiplier(multiplier = currentTotalProfitMultiplier) {
  const target = resolveTotalProfitElement();
  if (!target) {
    return currentTotalProfitMultiplier;
  }

  const formatted = formatMultiplier(multiplier);
  currentTotalProfitMultiplier = Number.parseFloat(formatted);
  target.textContent = `Total Profit(${formatted}x`;

  return currentTotalProfitMultiplier;
}

export function initControlPanel() {
  currentTotalProfitMultiplier = 1;
  updateTotalProfitMultiplier(currentTotalProfitMultiplier);
}
