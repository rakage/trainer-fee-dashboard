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

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Trainer Fee</CardTitle>
          <span className="text-xs text-muted-foreground">
            {trainerFeeTotal !== undefined ? 'After Expenses & %' : 'Total'}
          </span>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(displayTrainerFee)}</div>
          {trainerFeeTotal !== undefined && (
            <p className="text-xs text-muted-foreground mt-1">
              Calculated with expenses deducted
            </p>
          )}
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
