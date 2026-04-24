/**
 * ERP helpers — account types, balance math, voucher numbering.
 * Account type is derived from the first digit of the code (Uganda CoA convention):
 *   1xxx asset, 2xxx liability, 3xxx equity, 4xxx revenue, 5xxx-9xxx expense
 */
export type AcctType = "asset" | "liability" | "equity" | "revenue" | "expense";

export const acctTypeFromCode = (code: string | null | undefined): AcctType => {
  const d = (code || "").trim()[0];
  if (d === "1") return "asset";
  if (d === "2") return "liability";
  if (d === "3") return "equity";
  if (d === "4") return "revenue";
  return "expense";
};

export const ACCT_TYPE_LABEL: Record<AcctType, string> = {
  asset: "Assets",
  liability: "Liabilities",
  equity: "Equity",
  revenue: "Revenue",
  expense: "Expenses",
};

export const ACCT_TYPE_ORDER: AcctType[] = ["asset", "liability", "equity", "revenue", "expense"];

/** Closing balance respecting normal-balance side. */
export const closingBalance = (
  type: AcctType,
  opening: number,
  debit: number,
  credit: number,
): number => {
  // Asset & Expense: debit-positive. Liability, Equity, Revenue: credit-positive.
  if (type === "asset" || type === "expense") return opening + debit - credit;
  return opening + credit - debit;
};

export const VOUCHER_TYPES = [
  { value: "journal", label: "Journal" },
  { value: "sale", label: "Sale" },
  { value: "purchase", label: "Purchase" },
  { value: "receipt", label: "Receipt" },
  { value: "payment", label: "Payment" },
  { value: "contra", label: "Contra" },
] as const;

export type VoucherType = typeof VOUCHER_TYPES[number]["value"];
