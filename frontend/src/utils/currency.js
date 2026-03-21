/**
 * Currency formatting utility.
 * Detects the correct symbol from cloud billing data.
 */

const CURRENCY_SYMBOLS = {
  USD: '$', INR: '₹', EUR: '€', GBP: '£',
  AUD: 'A$', CAD: 'C$', SGD: 'S$', JPY: '¥',
};

export function getSymbol(currency = 'USD') {
  return CURRENCY_SYMBOLS[currency?.toUpperCase()] || currency + ' ';
}

export function formatCost(amount, currency = 'USD', decimals = 2) {
  if (amount === undefined || amount === null) return '—';
  const sym = getSymbol(currency);
  const num = Number(amount);
  if (isNaN(num)) return '—';
  return `${sym}${num.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

export function formatCostShort(amount, currency = 'USD') {
  if (!amount) return `${getSymbol(currency)}0`;
  const sym = getSymbol(currency);
  if (amount >= 100000) return `${sym}${(amount/100000).toFixed(1)}L`;
  if (amount >= 1000)   return `${sym}${(amount/1000).toFixed(1)}K`;
  return `${sym}${Number(amount).toLocaleString()}`;
}

// Detect primary currency from dashboard data
export function detectCurrency(dashboardData) {
  if (!dashboardData?.currencies) return 'USD';
  // Priority: azure > aws > gcp
  const { azure, aws, gcp } = dashboardData.currencies;
  return azure || aws || gcp || 'USD';
}
