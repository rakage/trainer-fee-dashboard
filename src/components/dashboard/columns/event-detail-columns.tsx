'use client';

import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { formatCurrency, formatPercentage } from '@/lib/utils';
import { EventSummaryRow } from '@/types';

export const eventDetailColumns: ColumnDef<EventSummaryRow>[] = [
  {
    accessorKey: 'Attendance',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Attendance" />,
    cell: ({ row }) => {
      return <div className="font-medium">{row.getValue('Attendance')}</div>;
    },
  },
  {
    accessorKey: 'PaymentMethod',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Payment Method" />,
    cell: ({ row }) => {
      const paymentMethod = row.getValue('PaymentMethod') as string | null;
      return <div>{paymentMethod || 'N/A'}</div>;
    },
  },
  {
    accessorKey: 'TierLevel',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Tier Level" />,
    cell: ({ row }) => {
      const tierLevel = row.getValue('TierLevel') as string | null;
      return <div>{tierLevel || 'N/A'}</div>;
    },
  },
  {
    accessorKey: 'PriceTotal',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Price" className="text-right" />
    ),
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue('PriceTotal'));
      return <div className="text-right font-medium">{formatCurrency(amount)}</div>;
    },
  },
  {
    accessorKey: 'TrainerFeePct',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Trainer Fee %" className="text-right" />
    ),
    cell: ({ row }) => {
      const percentage = parseFloat(row.getValue('TrainerFeePct'));
      return <div className="text-right">{formatPercentage(percentage)}</div>;
    },
  },
  {
    accessorKey: 'sumQuantity',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Quantity" className="text-right" />
    ),
    cell: ({ row }) => {
      return <div className="text-right">{row.getValue('sumQuantity')}</div>;
    },
  },
  {
    accessorKey: 'sumPriceTotal',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Total Revenue" className="text-right" />
    ),
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue('sumPriceTotal'));
      return <div className="text-right font-medium">{formatCurrency(amount)}</div>;
    },
  },
  {
    accessorKey: 'sumTrainerFee',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Total Trainer Fee" className="text-right" />
    ),
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue('sumTrainerFee'));
      return <div className="text-right font-medium">{formatCurrency(amount)}</div>;
    },
  },
];
