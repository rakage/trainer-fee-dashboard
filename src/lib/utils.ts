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
    // Group also by UnitPrice so different customer ticket prices form separate rows
    const key = `${ticket.Attendance}|${ticket.PaymentMethod}|${ticket.TierLevel}|${ticket.UnitPrice.toFixed(2)}`;
    
    if (!groupedData.has(key)) {
      groupedData.set(key, {
        Attendance: ticket.Attendance,
        PaymentMethod: ticket.PaymentMethod,
        TierLevel: ticket.TierLevel,
        UnitPrice: ticket.UnitPrice,      // Individual ticket price
        PriceTotal: 0,                    // Will accumulate total
        TrainerFeePct: ticket.TrainerFeePct,
        sumQuantity: 0,
        sumPriceTotal: 0,
        sumTrainerFee: 0,
      });
    }

    const row = groupedData.get(key)!;
    row.sumQuantity += ticket.Quantity;
    row.sumPriceTotal += ticket.PriceTotal; // Accumulate total for this unit price group
    row.sumTrainerFee += ticket.PriceTotal * ticket.TrainerFeePct; // Use PriceTotal for trainer fee calculation
    row.PriceTotal = row.sumPriceTotal; // Keep compatibility: PriceTotal reflects sum for the row
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

// Get custom trainer fee percentage and amount based on trainer name and event conditions
export function getCustomTrainerFee(
  trainerName: string,
  ticket: EventTicket
): { percentage: number; amount: number } {
  const lowerName = trainerName.toLowerCase();
  
  // Special case for Alejandro: use full ticket price as trainer fee
  if (lowerName.includes('alejandro')) {
    return {
      percentage: 1.0, // 100%
      amount: ticket.PriceTotal
    };
  }
  
  // Sofie/Mikaela rules: 65% if attended, 45% if unattended
  if (lowerName.includes('sofie') || lowerName.includes('mikaela')) {
    const percentage = ticket.Attendance === 'Attended' ? 0.65 : 0.45;
    return {
      percentage,
      amount: ticket.PriceTotal * percentage
    };
  }
  
  // Natasha rules: 45% for instructor training when attended
  if (lowerName.includes('natasha')) {
    // Check if it's instructor training and attended
    if (ticket.Attendance === 'Attended') {
      // Check if it's an instructor training event
      // This could be enhanced with more specific event type detection from the event data
      return {
        percentage: 0.45,
        amount: ticket.PriceTotal * 0.45
      };
    }
  }
  
  // Return the original percentage from the fee parameters
  const percentage = ticket.TrainerFeePct || 0;
  return {
    percentage,
    amount: ticket.PriceTotal * percentage
  };
}

// Get custom trainer fee percentage (legacy function for backward compatibility)
function getCustomTrainerFeePercentage(
  trainerName: string,
  ticket: EventTicket
): number {
  return getCustomTrainerFee(trainerName, ticket).percentage;
}

// Calculate event overview metrics
export function calculateEventOverview(
  tickets: EventTicket[],
  commissions: Commission = {},
  trainerSplits: TrainerSplit[] = [],
  trainerName?: string
): EventOverview {
  if (!trainerName) {
    // Fallback to normal calculation if no trainer name provided
    const trainerFee = tickets.reduce(
      (sum, ticket) => sum + (ticket.PriceTotal * ticket.TrainerFeePct),
      0
    );
    
    const cashSales = tickets
      .filter((ticket) => ticket.PaymentMethod === 'Cash')
      .reduce((sum, ticket) => sum + ticket.PriceTotal, 0);
    
    const balance = trainerFee - cashSales;
    const payableToTrainer = balance;
    
    return {
      trainerFee,
      cashSales,
      graceCommission: commissions.grace || 0,
      nannaFee: commissions.nanna || 0,
      balance,
      payableToTrainer,
    };
  }
  
  const lowerName = trainerName.toLowerCase();
  
  // Special case for Alejandro: use total ticket price without percentage
  const isAlejandro = lowerName.includes('alejandro');
  
  // Calculate trainer fee based on trainer name
  const trainerFee = isAlejandro 
    ? tickets.reduce((sum, ticket) => sum + ticket.PriceTotal, 0)  // Total without percentage for Alejandro
    : tickets.reduce((sum, ticket) => {
        // Use custom percentage for special trainers, otherwise use normal calculation
        const customPercentage = getCustomTrainerFeePercentage(trainerName, ticket);
        return sum + (ticket.PriceTotal * customPercentage);
      }, 0);

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
