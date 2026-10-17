export const CURRENCIES = [
  { code: "PHP", name: "Philippine Peso" },
  { code: "USD", name: "US Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
  { code: "JPY", name: "Japanese Yen" },
  { code: "SGD", name: "Singapore Dollar" },
  { code: "AUD", name: "Australian Dollar" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "HKD", name: "Hong Kong Dollar" },
  { code: "KRW", name: "South Korean Won" },
  { code: "INR", name: "Indian Rupee" },
  { code: "IDR", name: "Indonesian Rupiah" },
  { code: "MYR", name: "Malaysian Ringgit" },
  { code: "THB", name: "Thai Baht" },
  { code: "VND", name: "Vietnamese Dong" },
  { code: "CNY", name: "Chinese Yuan" },
  { code: "AED", name: "UAE Dirham" },
] as const;

export const DEFAULT_CURRENCY = "PHP";

export function isCurrency(code: unknown): code is string {
  return CURRENCIES.some((c) => c.code === code);
}

/** Amounts are stored as integer cents (hundredths of the currency unit). */
export function parseAmount(input: unknown): number | null {
  const text = String(input ?? "").replace(/[,\s]/g, "");
  if (!/^\d+(\.\d{0,2})?$/.test(text)) return null;
  const cents = Math.round(Number(text) * 100);
  return cents > 0 && cents <= 100_000_000_000 ? cents : null;
}

export function formatMoney(cents: number, currency: string, options: { compact?: boolean } = {}): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: options.compact ? "compact" : "standard",
    maximumFractionDigits: options.compact ? 1 : 2,
  }).format(cents / 100);
}

export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}
