'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/dashboard/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, RefreshCw } from 'lucide-react';
import { DataTable } from '@/components/ui/data-table';
import {
  trainersEventsColumns,
  TrainersEventsData,
} from '@/components/dashboard/columns/trainers-events-columns';

const monthOptions = [
  { value: 'all', label: 'All Months' },
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

const yearOptions = [
  { value: 'all', label: 'All Years' },
  { value: '2024', label: '2024' },
  { value: '2025', label: '2025' },
];

export default function TrainersEventsPage() {
  const [filters, setFilters] = useState({
    year: 'all',
    month: 'all',
  });
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 50,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [cardsLoading, setCardsLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);

  const {
    data: response,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['trainers-events', filters.year, filters.month, pagination.pageIndex, pagination.pageSize, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.year && filters.year !== 'all') params.set('year', filters.year);
      if (filters.month && filters.month !== 'all') params.set('month', filters.month);
      params.set('page', String(pagination.pageIndex + 1)); // API uses 1-based indexing
      params.set('pageSize', String(pagination.pageSize));
      if (searchQuery) params.set('search', searchQuery);

      const response = await fetch(`/api/trainers-events?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch trainers events');
      return await response.json();
    },
  });

  const eventsData = response?.data || [];
  const summary = response?.summary || { totalEvents: 0, uniqueTrainers: 0, totalTickets: 0, totalRevenue: 0 };
  const paginationInfo = response?.pagination || { totalCount: 0, totalPages: 0 };

  React.useEffect(() => {
    if (isFetching) {
      setCardsLoading(true);
      setTableLoading(true);
    } else {
      setCardsLoading(false);
      setTableLoading(false);
    }
  }, [isFetching]);

  const handleFilterChange = (field: string, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setPagination({ pageIndex: 0, pageSize: 50 }); // Reset to first page when filter changes
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setPagination({ pageIndex: 0, pageSize: 50 }); // Reset to first page when search changes
  };

  const clearFilters = () => {
    setFilters({ year: 'all', month: 'all' });
    setSearchQuery('');
    setPagination({ pageIndex: 0, pageSize: 50 }); // Reset to first page
  };

  const exportToCSV = () => {
    if (eventsData.length === 0) return;

    const headers = [
      'Product ID',
      'Product Name',
      'Category',
      'Program',
      'Event Date',
      'Product Price',
      'Country',
      'Location',
      'Status',
      'Main Trainer',
      'Co-Trainer 1',
      'Co-Trainer 2',
      'Co-Trainer 3',
      'Total Tickets',
      'Total Revenue',
    ];

    const csvContent = [
      headers.join(','),
      ...eventsData.map((row: any) =>
        [
          row.prodid,
          `"${row.prodname.replace(/"/g, '""')}"`,
          row.category,
          row.program,
          row.eventdate,
          row.productprice,
          row.country,
          row.location || '',
          row.status_event,
          `"${row.trainer.replace(/"/g, '""')}"`,
          row.cotrainer1 ? `"${row.cotrainer1.replace(/"/g, '""')}"` : '',
          row.cotrainer2 ? `"${row.cotrainer2.replace(/"/g, '""')}"` : '',
          row.cotrainer3 ? `"${row.cotrainer3.replace(/"/g, '""')}"` : '',
          row.totaltickets,
          row.totalrevenue.toFixed(2),
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `trainers-events-page${pagination.pageIndex + 1}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Use summary data from API (reflects all filtered data, not just current page)
  const totalEvents = summary.totalEvents;
  const totalTickets = summary.totalTickets;
  const totalRevenue = summary.totalRevenue;
  const uniqueTrainers = summary.uniqueTrainers;

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Trainer&apos;s Events</h1>
          <div className="flex gap-2">
            <Button onClick={() => refetch()} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={exportToCSV} disabled={eventsData.length === 0}>
              <Download className="w-4 h-4 mr-2" />
              Export Page CSV
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="year">Year</Label>
                <Select
                  value={filters.year}
                  onValueChange={(value) => handleFilterChange('year', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="month">Month</Label>
                <Select
                  value={filters.month}
                  onValueChange={(value) => handleFilterChange('month', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button onClick={clearFilters} variant="outline" className="w-full">
                  Clear Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {cardsLoading ? (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Events</CardTitle>
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-20" />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-24" />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Unique Trainers</CardTitle>
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            </>
          ) : (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Events</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalEvents}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalTickets.toLocaleString()}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    €{totalRevenue.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Unique Trainers</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{uniqueTrainers}</div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Events Report (Page {pagination.pageIndex + 1} of {paginationInfo.totalPages} - {paginationInfo.totalCount} total events)</CardTitle>
          </CardHeader>
          <CardContent>
            {tableLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 10 }, (_, i) => (
                  <Skeleton key={`table-skeleton-${i}`} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <DataTable
                columns={trainersEventsColumns}
                data={eventsData}
                searchValue={searchQuery}
                onSearchChange={handleSearchChange}
                searchPlaceholder="Search by Product ID, Name, Country, Trainer, Program, Category, or Location..."
                enableColumnVisibility={true}
                enableRowSelection={false}
                manualPagination={true}
                pageCount={paginationInfo.totalPages}
                pagination={pagination}
                onPaginationChange={setPagination}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
