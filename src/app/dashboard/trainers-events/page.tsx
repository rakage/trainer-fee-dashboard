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
  const [cardsLoading, setCardsLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);

  const {
    data: eventsData = [],
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['trainers-events', filters.year, filters.month],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.year && filters.year !== 'all') params.set('year', filters.year);
      if (filters.month && filters.month !== 'all') params.set('month', filters.month);

      const response = await fetch(`/api/trainers-events?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch trainers events');
      const data = (await response.json()) as TrainersEventsData[];

      return data;
    },
  });

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
  };

  const clearFilters = () => {
    setFilters({ year: 'all', month: 'all' });
  };

  const exportToCSV = () => {
    if (eventsData.length === 0) return;

    const headers = [
      'Month',
      'Year',
      'Product ID',
      'Product Name',
      'Category',
      'Program',
      'Event Date',
      'Country',
      'Status',
      'Reporting Group',
      'Main Trainer',
      'Co-Trainers',
      'Total Tickets',
      'Total Revenue',
    ];

    const csvContent = [
      headers.join(','),
      ...eventsData.map((row) =>
        [
          row.Month,
          row.Year,
          row.ProdID,
          `"${row.ProdName.replace(/"/g, '""')}"`,
          row.Category,
          row.Program,
          row.EventDate,
          row.Country,
          row.Status_Event,
          `"${row.ReportingGroup.replace(/"/g, '""')}"`,
          `"${row.MainTrainerName.replace(/"/g, '""')}"`,
          row.CoTrainers ? `"${row.CoTrainers.replace(/"/g, '""')}"` : '',
          row.TotalTickets,
          row.TotalRevenue.toFixed(2),
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `trainers-events-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const totalEvents = eventsData.length;
  const totalTickets = eventsData.reduce((sum, row) => sum + (row.TotalTickets || 0), 0);
  const totalRevenue = eventsData.reduce((sum, row) => sum + (row.TotalRevenue || 0), 0);
  const uniqueTrainers = new Set(eventsData.map((row) => row.MainTrainerName)).size;

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
              Export CSV
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
            <CardTitle>Events Report ({eventsData.length} events)</CardTitle>
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
                searchKeys={[
                  'ProdID',
                  'ProdName',
                  'Country',
                  'MainTrainerName',
                  'CoTrainers',
                  'Program',
                  'Category',
                ]}
                searchPlaceholder="Search by Product ID, Name, Country, Trainer, Program, or Category..."
                enableColumnVisibility={true}
                enableRowSelection={false}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
