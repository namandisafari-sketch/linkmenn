/**
 * Centralized formatters for Marvid ERP.
 * Currency: UGX, no decimals shown (Uganda Shillings rarely use fractions).
 */

const ugxFmt = new Intl.NumberFormat("en-UG", {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

const ugxDecFmt = new Intl.NumberFormat("en-UG", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

/** Format an amount as `UGX 1,250,000` (0 decimals). */
export const ugx = (n: number | string | null | undefined): string => {
  const v = typeof n === "string" ? parseFloat(n) : (n ?? 0);
  if (!Number.isFinite(v)) return "UGX 0";
  return `UGX ${ugxFmt.format(Math.round(v))}`;
};

/** Same as ugx but with 2 decimals — only for ratios/intermediate. */
export const ugxDec = (n: number | string | null | undefined): string => {
  const v = typeof n === "string" ? parseFloat(n) : (n ?? 0);
  if (!Number.isFinite(v)) return "UGX 0.00";
  return `UGX ${ugxDecFmt.format(v)}`;
};

/** Format a quantity respecting unit-of-measure. */
export const qty = (n: number | string | null | undefined, unit?: string): string => {
  const v = typeof n === "string" ? parseFloat(n) : (n ?? 0);
  if (!Number.isFinite(v)) return "0";
  const fractional = unit === "ml" || unit === "g" || unit === "kg" || unit === "L";
  if (fractional) return v.toFixed(2);
  return Math.round(v).toLocaleString();
};

/** Percentage formatter — `12.5%`. */
export const pct = (n: number | null | undefined, digits = 1): string => {
  if (n == null || !Number.isFinite(n)) return "0%";
  return `${n.toFixed(digits)}%`;
};

/** Uganda VAT rate (default 18%). */
export const VAT_RATE = 18;
