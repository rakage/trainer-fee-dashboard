'use client';

import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Button } from '@/components/ui/button';
import { EventListResponse } from '@/types';
import { ExternalLink } from 'lucide-react';

export const eventListColumns: ColumnDef<EventListResponse>[] = [
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
      return <div className="max-w-[400px] truncate">{row.getValue('ProdName')}</div>;
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
    id: 'actions',
    enableHiding: false,
    cell: ({ row }) => {
      const event = row.original;

      return (
        <div className="flex items-center justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              // Navigate to event detail page
              window.location.href = `/dashboard?prodId=${event.ProdID}`;
            }}
          >
            <ExternalLink className="h-4 w-4" />
            <span className="sr-only">View event details</span>
          </Button>
        </div>
      );
    },
  },
];
