'use client';

import * as React from 'react';
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  RowSelectionState,
} from '@tanstack/react-table';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { ChevronDown } from 'lucide-react';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchKey?: string;
  searchKeys?: string[];
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  enableRowSelection?: boolean;
  enableColumnVisibility?: boolean;
  className?: string;
  onRowClick?: (row: TData) => void;
  // Server-side pagination props
  manualPagination?: boolean;
  pageCount?: number;
  pagination?: { pageIndex: number; pageSize: number };
  onPaginationChange?: (pagination: { pageIndex: number; pageSize: number }) => void;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  searchKeys,
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  enableRowSelection = false,
  enableColumnVisibility = true,
  className,
  onRowClick,
  manualPagination = false,
  pageCount,
  pagination: controlledPagination,
  onPaginationChange,
}: Readonly<DataTableProps<TData, TValue>>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [globalFilter, setGlobalFilter] = React.useState('');
  const [internalPagination, setInternalPagination] = React.useState({ pageIndex: 0, pageSize: 10 });

  const paginationState = controlledPagination || internalPagination;
  const handlePaginationChange = onPaginationChange || setInternalPagination;
  
  // Use server-side search if searchValue and onSearchChange are provided
  const isServerSideSearch = searchValue !== undefined && onSearchChange !== undefined;
  const searchValueToUse = isServerSideSearch ? searchValue : globalFilter;
  const handleSearchChangeInternal = isServerSideSearch ? onSearchChange : setGlobalFilter;

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: manualPagination ? undefined : getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: isServerSideSearch ? undefined : getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: isServerSideSearch ? undefined : setGlobalFilter,
    manualPagination,
    pageCount: pageCount || -1,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter: isServerSideSearch ? '' : globalFilter,
      pagination: paginationState,
    },
    onPaginationChange: handlePaginationChange,
    globalFilterFn: isServerSideSearch ? undefined : (row, columnId, value) => {
      // If searchKeys is provided, search across multiple columns
      if (searchKeys && searchKeys.length > 0) {
        return searchKeys.some((key) => {
          const cellValue = row.getValue(key);
          if (cellValue == null) return false;
          const stringValue =
            typeof cellValue === 'string' || typeof cellValue === 'number'
              ? cellValue.toString()
              : JSON.stringify(cellValue);
          return stringValue.toLowerCase().includes(value.toLowerCase());
        });
      }
      // Fallback to searchKey if searchKeys not provided
      if (searchKey) {
        const cellValue = row.getValue(searchKey);
        if (cellValue == null) return false;
        const stringValue =
          typeof cellValue === 'string' || typeof cellValue === 'number'
            ? cellValue.toString()
            : JSON.stringify(cellValue);
        return stringValue.toLowerCase().includes(value.toLowerCase());
      }
      return false;
    },
  });

  return (
    <div className={className}>
      <div className="flex items-center justify-between py-4">
        <div className="flex flex-1 items-center space-x-2">
          {(searchKey || searchKeys || isServerSideSearch) && (
            <Input
              placeholder={searchPlaceholder}
              value={searchValueToUse ?? ''}
              onChange={(event) => handleSearchChangeInternal(event.target.value)}
              className="max-w-sm"
            />
          )}
        </div>
        <div className="flex items-center space-x-2">
          {enableColumnVisibility && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="ml-auto">
                  Columns <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {table
                  .getAllColumns()
                  .filter((column) => column.getCanHide())
                  .map((column) => {
                    return (
                      <DropdownMenuCheckboxItem
                        key={column.id}
                        className="capitalize"
                        checked={column.getIsVisible()}
                        onCheckedChange={(value) => column.toggleVisibility(!!value)}
                      >
                        {column.id}
                      </DropdownMenuCheckboxItem>
                    );
                  })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow 
                  key={row.id} 
                  data-state={row.getIsSelected() && 'selected'}
                  onClick={() => onRowClick && onRowClick(row.original)}
                  className={onRowClick ? 'cursor-pointer hover:bg-muted/50' : ''}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <DataTablePagination table={table} />

      {enableRowSelection && (
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of{' '}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
      )}
    </div>
  );
}
