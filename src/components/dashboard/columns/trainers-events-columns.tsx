'use client';

import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { formatCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export interface TrainersEventsData {
  prodid: number;
  prodname: string;
  category: string;
  program: string;
  eventdate: string;
  productprice: number;
  country: string;
  location: string | null;
  status_event: string;
  trainer: string;
  cotrainer1: string | null;
  cotrainer2: string | null;
  cotrainer3: string | null;
  totalrevenue: number;
  totaltickets: number;
}

export const trainersEventsColumns: ColumnDef<TrainersEventsData>[] = [
  {
    accessorKey: 'prodid',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Product ID" />,
    cell: ({ row }) => {
      return <div className="font-mono">{row.getValue('prodid')}</div>;
    },
  },
  {
    accessorKey: 'prodname',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Event Name" />,
    cell: ({ row }) => {
      return <div className="max-w-[300px] truncate">{row.getValue('prodname')}</div>;
    },
  },
  {
    accessorKey: 'eventdate',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Event Date" />,
    cell: ({ row }) => {
      const date = new Date(row.getValue('eventdate'));
      return <div>{date.toLocaleDateString()}</div>;
    },
  },
  {
    accessorKey: 'country',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Country" />,
    cell: ({ row }) => {
      return <div>{row.getValue('country')}</div>;
    },
  },
  {
    accessorKey: 'location',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Location" />,
    cell: ({ row }) => {
      const location = row.getValue('location') as string | null;
      return (
        <Badge variant="outline" className="whitespace-nowrap">
          {location || 'N/A'}
        </Badge>
      );
    },
  },
  {
    accessorKey: 'program',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Program" />,
    cell: ({ row }) => {
      const program = row.getValue('program') as string;
      return (
        <Badge variant="outline" className="whitespace-nowrap">
          {program}
        </Badge>
      );
    },
  },
  {
    accessorKey: 'category',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Category" />,
    cell: ({ row }) => {
      const category = row.getValue('category') as string;
      return (
        <Badge variant="secondary" className="whitespace-nowrap">
          {category}
        </Badge>
      );
    },
  },
  {
    accessorKey: 'status_event',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    cell: ({ row }) => {
      const status = row.getValue('status_event') as string;
      return (
        <Badge 
          variant={status === 'Active' ? 'default' : 'destructive'} 
          className="whitespace-nowrap"
        >
          {status}
        </Badge>
      );
    },
  },
  {
    accessorKey: 'trainer',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Main Trainer" />,
    cell: ({ row }) => {
      return <div className="font-medium">{row.getValue('trainer')}</div>;
    },
  },
  {
    accessorKey: 'cotrainer1',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Co-Trainer 1" />,
    cell: ({ row }) => {
      const coTrainer = row.getValue('cotrainer1') as string | null;
      return (
        <div className="max-w-[150px] truncate">
          {coTrainer || <span className="text-muted-foreground">-</span>}
        </div>
      );
    },
  },
  {
    accessorKey: 'cotrainer2',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Co-Trainer 2" />,
    cell: ({ row }) => {
      const coTrainer = row.getValue('cotrainer2') as string | null;
      return (
        <div className="max-w-[150px] truncate">
          {coTrainer || <span className="text-muted-foreground">-</span>}
        </div>
      );
    },
  },
  {
    accessorKey: 'cotrainer3',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Co-Trainer 3" />,
    cell: ({ row }) => {
      const coTrainer = row.getValue('cotrainer3') as string | null;
      return (
        <div className="max-w-[150px] truncate">
          {coTrainer || <span className="text-muted-foreground">-</span>}
        </div>
      );
    },
  },
  {
    accessorKey: 'totaltickets',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Tickets" className="text-right" />
    ),
    cell: ({ row }) => {
      return <div className="text-right">{row.getValue('totaltickets')}</div>;
    },
  },
  {
    accessorKey: 'totalrevenue',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Revenue" className="text-right" />
    ),
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue('totalrevenue'));
      return <div className="text-right font-medium">{formatCurrency(amount)}</div>;
    },
  },
];
