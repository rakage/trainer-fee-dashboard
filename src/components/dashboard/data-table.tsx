'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EventDetail } from '@/types';
import { formatCurrency, formatPercentage, calculateEventSummary } from '@/lib/utils';

interface EventDataTableProps {
  event: EventDetail;
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Attendance</TableHead>
              <TableHead>Payment Method</TableHead>
              <TableHead>Tier Level</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Trainer Fee %</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead className="text-right">Total Revenue</TableHead>
              <TableHead className="text-right">Total Trainer Fee</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summaryData.map((row, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium">{row.Attendance}</TableCell>
                <TableCell>{row.PaymentMethod || 'N/A'}</TableCell>
                <TableCell>{row.TierLevel || 'N/A'}</TableCell>
                <TableCell className="text-right">{formatCurrency(row.PriceTotal)}</TableCell>
                <TableCell className="text-right">{formatPercentage(row.TrainerFeePct)}</TableCell>
                <TableCell className="text-right">{row.sumQuantity}</TableCell>
                <TableCell className="text-right">{formatCurrency(row.sumPriceTotal)}</TableCell>
                <TableCell className="text-right">{formatCurrency(row.sumTrainerFee)}</TableCell>
              </TableRow>
            ))}
            {summaryData.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  No ticket data available
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        
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
