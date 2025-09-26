'use client';

import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { formatCurrency, formatPercentage } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export interface AlejandroReportData {
  Month: string;
  Year: number;
  ProdID: number;
  ProdName: string;
  Category: string;
  Program: string;
  EventDate: string;
  Country: string;
  ReportingGroup: string;
  TrainerName: string;
  TotalTickets: number;
  TotalRevenue: number;
  AlejandroPercent: number;
  AlejandroFee: number;
}

export const alejandroReportColumns: ColumnDef<AlejandroReportData>[] = [
  {
    accessorKey: 'ProdID',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Product ID" />,
    cell: ({ row }) => {
      return <div className="font-mono">{row.getValue('ProdID')}</div>;
    },
  },
  {
    accessorKey: 'ProdName',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Event Name" />,
    cell: ({ row }) => {
      return <div className="max-w-[300px] truncate">{row.getValue('ProdName')}</div>;
    },
  },
  {
    accessorKey: 'EventDate',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Event Date" />,
    cell: ({ row }) => {
      const date = new Date(row.getValue('EventDate'));
      return <div>{date.toLocaleDateString()}</div>;
    },
  },
  {
    accessorKey: 'Country',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Country" />,
    cell: ({ row }) => {
      return <div>{row.getValue('Country')}</div>;
    },
  },
  {
    accessorKey: 'Program',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Program" />,
    cell: ({ row }) => {
      const program = row.getValue('Program') as string;
      return (
        <Badge variant="outline" className="whitespace-nowrap">
          {program}
        </Badge>
      );
    },
  },
  {
    accessorKey: 'Category',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Category" />,
    cell: ({ row }) => {
      const category = row.getValue('Category') as string;
      return (
        <Badge variant="secondary" className="whitespace-nowrap">
          {category}
        </Badge>
      );
    },
  },
  {
    accessorKey: 'TrainerName',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Trainer" />,
    cell: ({ row }) => {
      return <div className="font-medium">{row.getValue('TrainerName')}</div>;
    },
  },
  {
    accessorKey: 'TotalTickets',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Tickets" className="text-right" />
    ),
    cell: ({ row }) => {
      return <div className="text-right">{row.getValue('TotalTickets')}</div>;
    },
  },
  {
    accessorKey: 'TotalRevenue',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Revenue" className="text-right" />
    ),
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue('TotalRevenue'));
      return <div className="text-right font-medium">{formatCurrency(amount)}</div>;
    },
  },
  {
    accessorKey: 'AlejandroPercent',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Alejandro %" className="text-right" />
    ),
    cell: ({ row }) => {
      const percentage = parseFloat(row.getValue('AlejandroPercent'));
      return <div className="text-right">{formatPercentage(percentage)}</div>;
    },
  },
  {
    accessorKey: 'AlejandroFee',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Alejandro Fee" className="text-right" />
    ),
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue('AlejandroFee'));
      return <div className="text-right font-medium">{formatCurrency(amount)}</div>;
    },
  },
];
