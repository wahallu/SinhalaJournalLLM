/**
 * Money formatting.
 *
 * Amounts arrive as integer minor units (cents / සත) because that is how
 * they are stored — see the pricing columns on `plans`. Dividing by 100 for
 * display is the ONLY place the value becomes fractional, and it happens
 * after all arithmetic, so nothing accumulates a rounding error.
 */
export function formatPrice(minorUnits, currency = 'LKR', locale = undefined) {
  if (minorUnits == null) return null;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: minorUnits % 100 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(minorUnits / 100);
  } catch {
    // An unknown currency code should not blank the price.
    return `${currency} ${(minorUnits / 100).toLocaleString()}`;
  }
}

/**
 * What an annual price saves against twelve monthly payments, as a
 * percentage, or null when there is nothing to compare.
 */
export function annualSavingPercent(monthlyMinor, annualMinor) {
  if (!monthlyMinor || annualMinor == null) return null;
  const twelve = monthlyMinor * 12;
  if (annualMinor >= twelve) return null;
  return Math.round(((twelve - annualMinor) / twelve) * 100);
}
