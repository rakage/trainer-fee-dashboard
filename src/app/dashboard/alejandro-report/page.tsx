'use client';

import { useState } from 'react';
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
import { Download, Filter } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface AlejandroReportData {
  Month: string;
  Year: number;
  ProdID: number;
  ProdName: string;
  Category: string;
  Program: string;
  EventDate: string;
  Country: string;
  TrainerName: string;
  TotalTickets: number;
  TotalRevenue: number;
}

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

export default function AlejandroReportPage() {
  const [filters, setFilters] = useState({
    year: 'all',
    month: 'all',
  });

  // React Query for report data
  const {
    data: reportData = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['alejandro-report', filters.year, filters.month],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.year && filters.year !== 'all') params.set('year', filters.year);
      if (filters.month && filters.month !== 'all') params.set('month', filters.month);

      const response = await fetch(`/api/alejandro-report?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch report data');
      return response.json() as Promise<AlejandroReportData[]>;
    },
  });

  const handleFilterChange = (field: string, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => {
    setFilters({ year: '', month: '' });
  };

  const exportToCSV = () => {
    if (reportData.length === 0) return;

    const headers = [
      'Month',
      'Year',
      'Product ID',
      'Product Name',
      'Category',
      'Program',
      'Event Date',
      'Country',
      'Trainer Name',
      'Total Tickets',
      'Total Revenue',
    ];

    const csvContent = [
      headers.join(','),
      ...reportData.map((row) =>
        [
          row.Month,
          row.Year,
          row.ProdID,
          `"${row.ProdName.replace(/"/g, '""')}"`,
          row.Category,
          row.Program,
          row.EventDate,
          row.Country,
          `"${row.TrainerName.replace(/"/g, '""')}"`,
          row.TotalTickets,
          row.TotalRevenue.toFixed(2),
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `alejandro-trainer-report-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Calculate totals
  const totalTickets = reportData.reduce((sum, row) => sum + (row.TotalTickets || 0), 0);
  const totalRevenue = reportData.reduce((sum, row) => sum + (row.TotalRevenue || 0), 0);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="container mx-auto p-6 space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-9 w-96" />
          </div>
          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
              </div>
              <div className="space-y-4">
                {Array.from({ length: 8 }, (_, i) => (
                  <Skeleton key={`skeleton-row-${i}`} className="h-12 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Alejandro Instructor Trainer % Fee Report</h1>
          <div className="flex gap-2">
            <Button onClick={() => refetch()} variant="outline">
              <Filter className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={exportToCSV} disabled={reportData.length === 0}>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Filters */}
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

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{reportData.length}</div>
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
        </div>

        {/* Report Table */}
        <Card>
          <CardHeader>
            <CardTitle>Event Report ({reportData.length} events)</CardTitle>
          </CardHeader>
          <CardContent>
            {reportData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No events found for the selected filters.
              </div>
            ) : (
              <div className="border rounded-lg">
                <div className="max-h-[600px] overflow-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-white border-b shadow-sm z-10">
                      <TableRow>
                        <TableHead className="min-w-[80px]">Month</TableHead>
                        <TableHead className="min-w-[80px]">Year</TableHead>
                        <TableHead className="min-w-[100px]">Product ID</TableHead>
                        <TableHead className="min-w-[300px]">Product Name</TableHead>
                        <TableHead className="min-w-[120px]">Category</TableHead>
                        <TableHead className="min-w-[100px]">Program</TableHead>
                        <TableHead className="min-w-[120px]">Event Date</TableHead>
                        <TableHead className="min-w-[120px]">Country</TableHead>
                        <TableHead className="min-w-[150px]">Trainer</TableHead>
                        <TableHead className="min-w-[100px] text-right">Tickets</TableHead>
                        <TableHead className="min-w-[120px] text-right">Revenue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData.map((row) => (
                        <TableRow key={`${row.ProdID}-${row.EventDate}`}>
                          <TableCell>{row.Month}</TableCell>
                          <TableCell>{row.Year}</TableCell>
                          <TableCell className="font-medium">{row.ProdID}</TableCell>
                          <TableCell className="max-w-[300px] truncate" title={row.ProdName}>
                            {row.ProdName}
                          </TableCell>
                          <TableCell>{row.Category}</TableCell>
                          <TableCell>{row.Program}</TableCell>
                          <TableCell>{new Date(row.EventDate).toLocaleDateString()}</TableCell>
                          <TableCell>{row.Country}</TableCell>
                          <TableCell>{row.TrainerName}</TableCell>
                          <TableCell className="text-right">
                            {row.TotalTickets?.toLocaleString() || 0}
                          </TableCell>
                          <TableCell className="text-right">
                            €
                            {(row.TotalRevenue || 0).toLocaleString('de-DE', {
                              minimumFractionDigits: 2,
                            })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
