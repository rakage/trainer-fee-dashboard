'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EventDetail, Commission, SupportedCurrency } from '@/types';
import { formatCurrency, calculateEventOverview } from '@/lib/utils';
import { formatCurrencyAmount } from '@/lib/currency';

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
  
  // Use display currency for formatting
  const targetCurrency = displayCurrency || (event.Currency as SupportedCurrency) || 'EUR';

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Trainer Fee</CardTitle>
          <span className="text-xs text-muted-foreground">Total</span>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrencyAmount(displayTrainerFee, targetCurrency)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Cash Sales</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrencyAmount(overview.cashSales, targetCurrency)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrencyAmount(adjustedBalance, targetCurrency)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Payable</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${
            adjustedPayable < 0 ? 'text-red-600' : 'text-green-600'
          }`}>
            {formatCurrencyAmount(adjustedPayable, targetCurrency)}
          </div>
          <p className="text-xs text-muted-foreground">
            Amount to pay trainer
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
