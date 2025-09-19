'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EventDetail, Commission } from '@/types';
import { formatCurrency, calculateEventOverview } from '@/lib/utils';

interface EventOverviewCardsProps {
  event: EventDetail;
  commissions: Commission;
  trainerName?: string;
  trainerFeeTotal?: number;
}

export function EventOverviewCards({ event, commissions, trainerName, trainerFeeTotal }: EventOverviewCardsProps) {
  const overview = calculateEventOverview(event.tickets, commissions, [], trainerName);
  
  // Use provided trainerFeeTotal if available, otherwise use calculated overview value
  const displayTrainerFee = trainerFeeTotal !== undefined ? trainerFeeTotal : overview.trainerFee;
  
  // Recalculate balance and payable with the new trainer fee
  const adjustedBalance = overview.cashSales - displayTrainerFee;
  const adjustedPayable = displayTrainerFee - overview.cashSales;
  
  // Determine currency and locale based on event currency
  const currency = event.Currency || 'EUR';
  const locale = currency === 'JPY' ? 'ja-JP' : 'de-DE';
  const formatOptions = { locale, currency };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Trainer Fee</CardTitle>
          <span className="text-xs text-muted-foreground">Total</span>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(displayTrainerFee, formatOptions)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Cash Sales</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(overview.cashSales, formatOptions)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(adjustedBalance, formatOptions)}</div>
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
            {formatCurrency(adjustedPayable, formatOptions)}
          </div>
          <p className="text-xs text-muted-foreground">
            Amount to pay trainer
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
