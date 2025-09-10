import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { EventTicket, EventSummaryRow, EventOverview, Commission, TrainerSplit } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Currency formatting with German locale (EUR)
export function formatCurrency(
  amount: number,
  options: { locale?: string; currency?: string } = {}
): string {
  const { locale = 'de-DE', currency = 'EUR' } = options;
  
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount);
}

// Parse comma-separated decimal strings (German format) to numbers
export function parseGermanDecimal(value: string): number {
  if (!value) return 0;
  // Replace comma with dot for parsing
  return parseFloat(value.replace(',', '.')) || 0;
}

// Format number with comma as decimal separator (German format)
export function formatGermanDecimal(value: number, decimals: number = 2): string {
  return value.toFixed(decimals).replace('.', ',');
}

// Calculate event summary rows (pivot-like aggregation)
export function calculateEventSummary(tickets: EventTicket[]): EventSummaryRow[] {
  const groupedData = new Map<string, EventSummaryRow>();

  tickets.forEach((ticket) => {
    const key = `${ticket.Attendance}|${ticket.PaymentMethod}|${ticket.TierLevel}`;
    
    if (!groupedData.has(key)) {
      groupedData.set(key, {
        Attendance: ticket.Attendance,
        PaymentMethod: ticket.PaymentMethod,
        TierLevel: ticket.TierLevel,
        PriceTotal: ticket.PriceTotal,
        TrainerFeePct: ticket.TrainerFeePct,
        sumQuantity: 0,
        sumPriceTotal: 0,
        sumTrainerFee: 0,
      });
    }

    const row = groupedData.get(key)!;
    row.sumQuantity += ticket.Quantity;
    row.sumPriceTotal += ticket.PriceTotal * ticket.Quantity;
    row.sumTrainerFee += ticket.PriceTotal * ticket.Quantity * ticket.TrainerFeePct;
  });

  return Array.from(groupedData.values()).sort((a, b) => {
    // Sort by Attendance, then PaymentMethod, then TierLevel
    if (a.Attendance !== b.Attendance) {
      return a.Attendance.localeCompare(b.Attendance);
    }
    if (a.PaymentMethod !== b.PaymentMethod) {
      return (a.PaymentMethod || '').localeCompare(b.PaymentMethod || '');
    }
    return (a.TierLevel || '').localeCompare(b.TierLevel || '');
  });
}

// Calculate event overview metrics
export function calculateEventOverview(
  tickets: EventTicket[],
  commissions: Commission = {},
  trainerSplits: TrainerSplit[] = []
): EventOverview {
  // Total Trainer Fee Amount (sum of all trainer fee amounts - matches table's Trainer Fee Amount column)
  const trainerFee = tickets.reduce(
    (sum, ticket) => sum + (ticket.PriceTotal * ticket.TrainerFeePct),
    0
  );

  // Cash Sales (Price Total from Cash payment method only, without multiplying by quantity)
  const cashSales = tickets
    .filter((ticket) => ticket.PaymentMethod === 'Cash')
    .reduce((sum, ticket) => sum + ticket.PriceTotal, 0);

  // Balance = Trainer Fee - Cash Sales
  const balance = trainerFee - cashSales;
  
  // Payable = Balance (simplified as requested)
  const payableToTrainer = balance;

  // Keep commission values for compatibility but don't use in main calculations
  const graceCommission = commissions.grace || 0;
  const nannaFee = commissions.nanna || 0;

  return {
    trainerFee,
    cashSales,
    graceCommission,
    nannaFee,
    balance,
    payableToTrainer,
  };
}

// Calculate trainer split details
export function calculateTrainerSplitDetails(
  splits: TrainerSplit[],
  balance: number
): TrainerSplit[] {
  return splits.map((split) => ({
    ...split,
    TrainerFee: balance * (split.Percent / 100),
    Payable: balance * (split.Percent / 100) - (split.CashReceived || 0),
  }));
}

// Format percentage for display
export function formatPercentage(value: number): string {
  return `${formatGermanDecimal(value * 100, 1)}%`;
}

// Validate trainer split percentages
export function validateSplitPercentages(splits: TrainerSplit[]): {
  valid: boolean;
  totalPercent: number;
  errors: string[];
} {
  const errors: string[] = [];
  const totalPercent = splits.reduce((sum, split) => sum + (split.Percent || 0), 0);

  if (totalPercent > 100) {
    errors.push('Total percentage cannot exceed 100%');
  }

  splits.forEach((split, index) => {
    if (!split.Name?.trim()) {
      errors.push(`Row ${index + 1}: Name is required`);
    }
    if (split.Percent < 0) {
      errors.push(`Row ${index + 1}: Percentage cannot be negative`);
    }
    if (split.CashReceived < 0) {
      errors.push(`Row ${index + 1}: Cash received cannot be negative`);
    }
  });

  return {
    valid: errors.length === 0,
    totalPercent,
    errors,
  };
}

// Debounce function for search inputs
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Generate export filename
export function generateExportFilename(
  prodId: number,
  prodName: string,
  format: string
): string {
  const date = new Date().toISOString().split('T')[0];
  const sanitizedName = prodName.replace(/[^a-zA-Z0-9\-_\s]/g, '').substring(0, 50);
  return `event-${prodId}-${sanitizedName}-${date}.${format}`;
}
