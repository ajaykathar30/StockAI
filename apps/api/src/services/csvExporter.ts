/**
 * Escapes spreadsheet-formula prefixes in exported CSV text fields.
 * Prevents CSV Formula Injection (CWE-1236).
 */
export function sanitizeCsvCell(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }
  let str = String(value);

  // If text begins with formula triggers, prepend single apostrophe
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // Escape quotes if needed
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    str = `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

export function exportForecastsToCsv(forecasts: any[]): string {
  const headers = ['Date', 'Store ID', 'Product ID', 'Forecasted Demand', 'Lower Bound (10%)', 'Upper Bound (90%)', 'Cold Start Fallback'];
  const rows = forecasts.map(f => [
    sanitizeCsvCell(f.date),
    sanitizeCsvCell(f.store_id),
    sanitizeCsvCell(f.product_id),
    sanitizeCsvCell(f.predicted_mean),
    sanitizeCsvCell(f.lower_bound),
    sanitizeCsvCell(f.upper_bound),
    sanitizeCsvCell(f.is_cold_start ? 'YES' : 'NO')
  ].join(','));

  return [headers.join(','), ...rows].join('\n');
}

export function exportReplenishmentToCsv(items: any[]): string {
  const headers = [
    'Store ID', 'Product ID', 'Category', 'Priority',
    'Protection Period (Days)', 'Period Forecast', 'Safety Stock',
    'Target Stock', 'Inventory Position', 'Suggested Order (Raw)',
    'Rounded Order Qty', 'Unit Cost', 'Total Order Cost', 'Audit Explanation'
  ];

  const rows = items.map(item => [
    sanitizeCsvCell(item.store_id),
    sanitizeCsvCell(item.product_id),
    sanitizeCsvCell(item.category),
    sanitizeCsvCell(item.priority),
    sanitizeCsvCell(item.protection_period_days),
    sanitizeCsvCell(item.protection_period_forecast),
    sanitizeCsvCell(item.safety_stock),
    sanitizeCsvCell(item.target_stock),
    sanitizeCsvCell(item.inventory_position),
    sanitizeCsvCell(item.raw_suggested_order),
    sanitizeCsvCell(item.rounded_order_qty),
    sanitizeCsvCell(item.unit_cost),
    sanitizeCsvCell(item.total_order_cost),
    sanitizeCsvCell(item.explanation)
  ].join(','));

  return [headers.join(','), ...rows].join('\n');
}
