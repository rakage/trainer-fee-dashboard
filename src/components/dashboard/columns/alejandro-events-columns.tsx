'use client';

import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { formatCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export interface AlejandroEventData {
  Month: string;
  Year: number;
  ProdID: number;
  ProdName: string;
  Category: string;
  Program: string;
  EventDate: string;
  Country: string;
  ReportingGroup: string;
  MainTrainer: string;
  CoTrainer1: string | null;
  CoTrainer2: string | null;
  CoTrainer3: string | null;
  TotalTickets: number;
  TotalRevenue: number;
  AlejandroFee: number;
  TotalExpenses: number;
  ExpenseCount: number;
  TrainerFeePercent: number;
  NetRevenue: number;
}

export const alejandroEventsColumns: ColumnDef<AlejandroEventData>[] = [
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
    accessorKey: 'MainTrainer',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Main Trainer" />,
    cell: ({ row }) => {
      return <div className="font-medium">{row.getValue('MainTrainer')}</div>;
    },
  },
  {
    accessorKey: 'CoTrainer1',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Co-Trainer 1" />,
    cell: ({ row }) => {
      const coTrainer = row.getValue('CoTrainer1') as string | null;
      return <div className="text-sm">{coTrainer || '-'}</div>;
    },
  },
  {
    accessorKey: 'CoTrainer2',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Co-Trainer 2" />,
    cell: ({ row }) => {
      const coTrainer = row.getValue('CoTrainer2') as string | null;
      return <div className="text-sm">{coTrainer || '-'}</div>;
    },
  },
  {
    accessorKey: 'CoTrainer3',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Co-Trainer 3" />,
    cell: ({ row }) => {
      const coTrainer = row.getValue('CoTrainer3') as string | null;
      return <div className="text-sm">{coTrainer || '-'}</div>;
    },
    enableHiding: true,
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
      <DataTableColumnHeader column={column} title="Total Revenue" className="text-right" />
    ),
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue('TotalRevenue'));
      return <div className="text-right font-medium">{formatCurrency(amount)}</div>;
    },
  },
  {
    accessorKey: 'NetRevenue',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Net Revenue" className="text-right" />
    ),
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue('NetRevenue'));
      return <div className="text-right font-medium">{formatCurrency(amount)}</div>;
    },
  },
  {
    accessorKey: 'TrainerFeePercent',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Fee %" className="text-right" />
    ),
    cell: ({ row }) => {
      const percent = parseFloat(row.getValue('TrainerFeePercent'));
      return <div className="text-right font-medium">{percent}%</div>;
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
  {
    accessorKey: 'TotalExpenses',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Expenses" className="text-right" />
    ),
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue('TotalExpenses'));
      const count = row.getValue('ExpenseCount') as number;
      return (
        <div className="text-right">
          <div className="font-medium">{formatCurrency(amount)}</div>
          {count > 0 && (
            <div className="text-xs text-muted-foreground">
              {count} item{count !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      );
    },
  },
];
