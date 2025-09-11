'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EventDetail, Commission } from '@/types';
import { formatCurrency, calculateEventOverview } from '@/lib/utils';

interface EventOverviewCardsProps {
  event: EventDetail;
  commissions: Commission;
  trainerName?: string;
}

export function EventOverviewCards({ event, commissions, trainerName }: EventOverviewCardsProps) {
  const overview = calculateEventOverview(event.tickets, commissions, [], trainerName);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Trainer Fee</CardTitle>
          <span className="text-xs text-muted-foreground">Total</span>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(overview.trainerFee)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Cash Sales</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(overview.cashSales)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(overview.balance)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Payable</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${
            overview.payableToTrainer < 0 ? 'text-red-600' : 'text-green-600'
          }`}>
            {formatCurrency(overview.payableToTrainer)}
          </div>
          <p className="text-xs text-muted-foreground">
            Amount to pay trainer
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
