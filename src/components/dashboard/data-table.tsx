'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { EventDetail } from '@/types';
import { formatCurrency, formatPercentage, calculateEventSummary } from '@/lib/utils';
import { eventDetailColumns } from './columns/event-detail-columns';

interface EventDataTableProps {
  readonly event: EventDetail;
}

export function EventDataTable({ event }: EventDataTableProps) {
  const summaryData = calculateEventSummary(event.tickets);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Event Details</CardTitle>
        <CardDescription>
          Ticket sales grouped by attendance, payment method, and tier level
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={eventDetailColumns}
          data={summaryData}
          searchKey="Attendance"
          searchPlaceholder="Filter by attendance..."
          enableColumnVisibility={true}
          enableRowSelection={false}
        />
        
        {summaryData.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="font-medium">Total Tickets:</span>
                <div className="text-muted-foreground">
                  {summaryData.reduce((sum, row) => sum + row.sumQuantity, 0)}
                </div>
              </div>
              <div>
                <span className="font-medium">Total Revenue:</span>
                <div className="text-muted-foreground">
                  {formatCurrency(summaryData.reduce((sum, row) => sum + row.sumPriceTotal, 0))}
                </div>
              </div>
              <div>
                <span className="font-medium">Total Trainer Fees:</span>
                <div className="text-muted-foreground">
                  {formatCurrency(summaryData.reduce((sum, row) => sum + row.sumTrainerFee, 0))}
                </div>
              </div>
              <div>
                <span className="font-medium">Avg Trainer Fee %:</span>
                <div className="text-muted-foreground">
                  {formatPercentage(
                    summaryData.reduce((sum, row) => sum + row.TrainerFeePct, 0) / summaryData.length || 0
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
