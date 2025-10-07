'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EventDetail, Commission, SupportedCurrency } from '@/types';
import { formatCurrency, calculateEventOverview } from '@/lib/utils';
import { convertCurrency, formatCurrencyAmount } from '@/lib/currency';

interface EventOverviewCardsProps {
  event: EventDetail;
  commissions: Commission;
  trainerName?: string;
  trainerFeeTotal?: number;
  displayCurrency?: SupportedCurrency;
}

export function EventOverviewCards({ event, commissions, trainerName, trainerFeeTotal, displayCurrency }: EventOverviewCardsProps) {
  const overview = calculateEventOverview(event.tickets, commissions, [], trainerName);
  
  // Use provided trainerFeeTotal if available, otherwise use calculated overview value
  const displayTrainerFee = trainerFeeTotal !== undefined ? trainerFeeTotal : overview.trainerFee;
  
  // Recalculate balance and payable with the new trainer fee
  const adjustedBalance = overview.cashSales - displayTrainerFee;
  const adjustedPayable = displayTrainerFee - overview.cashSales;
  
  // Determine currency conversion
  const eventCurrency = (event.Currency || 'EUR') as SupportedCurrency;
  const targetCurrency = displayCurrency || eventCurrency;
  
  // Convert amounts to display currency
  const convertedTrainerFee = convertCurrency(displayTrainerFee, eventCurrency, targetCurrency);
  const convertedCashSales = convertCurrency(overview.cashSales, eventCurrency, targetCurrency);
  const convertedBalance = convertCurrency(adjustedBalance, eventCurrency, targetCurrency);
  const convertedPayable = convertCurrency(adjustedPayable, eventCurrency, targetCurrency);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Trainer Fee</CardTitle>
          <span className="text-xs text-muted-foreground">Total</span>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrencyAmount(convertedTrainerFee, targetCurrency)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Cash Sales</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrencyAmount(convertedCashSales, targetCurrency)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrencyAmount(convertedBalance, targetCurrency)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Payable</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${
            convertedPayable < 0 ? 'text-red-600' : 'text-green-600'
          }`}>
            {formatCurrencyAmount(convertedPayable, targetCurrency)}
          </div>
          <p className="text-xs text-muted-foreground">
            Amount to pay trainer
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
