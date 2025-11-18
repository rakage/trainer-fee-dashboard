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
import { MultiSelect } from '@/components/ui/multi-select';
import { EventDetailsModal } from '@/components/dashboard/event-details-modal';

const monthOptions = [
  { value: '1', label: 'January', shortLabel: 'Jan' },
  { value: '2', label: 'February', shortLabel: 'Feb' },
  { value: '3', label: 'March', shortLabel: 'Mar' },
  { value: '4', label: 'April', shortLabel: 'Apr' },
  { value: '5', label: 'May', shortLabel: 'May' },
  { value: '6', label: 'June', shortLabel: 'Jun' },
  { value: '7', label: 'July', shortLabel: 'Jul' },
  { value: '8', label: 'August', shortLabel: 'Aug' },
  { value: '9', label: 'September', shortLabel: 'Sep' },
  { value: '10', label: 'October', shortLabel: 'Oct' },
  { value: '11', label: 'November', shortLabel: 'Nov' },
  { value: '12', label: 'December', shortLabel: 'Dec' },
];

const yearOptions = [
  { value: 'all', label: 'All Years' },
  { value: '2024', label: '2024' },
  { value: '2025', label: '2025' },
];

export default function TrainersEventsPage() {
  const [filters, setFilters] = useState({
    year: 'all',
  });
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [debouncedMonths, setDebouncedMonths] = useState<string[]>([]);
  const [selectedTrainers, setSelectedTrainers] = useState<string[]>([]);
  const [debouncedTrainers, setDebouncedTrainers] = useState<string[]>([]);
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
  const [debouncedPrograms, setDebouncedPrograms] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [debouncedCategories, setDebouncedCategories] = useState<string[]>([]);
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });
  const [sorting, setSorting] = useState<{ id: string; desc: boolean }[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [cardsLoading, setCardsLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Reset pagination when sorting changes
  React.useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [sorting]);

  // Debounce months selection
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedMonths(selectedMonths);
    }, 500);

    return () => clearTimeout(timer);
  }, [selectedMonths]);

  // Debounce trainer selection
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTrainers(selectedTrainers);
    }, 500);

    return () => clearTimeout(timer);
  }, [selectedTrainers]);

  // Debounce program selection
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedPrograms(selectedPrograms);
    }, 500);

    return () => clearTimeout(timer);
  }, [selectedPrograms]);

  // Debounce category selection
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedCategories(selectedCategories);
    }, 500);

    return () => clearTimeout(timer);
  }, [selectedCategories]);

  const { data: trainersData, isLoading: isLoadingTrainers, error: trainersError } = useQuery({
    queryKey: ['trainers-list'],
    queryFn: async () => {
      const response = await fetch('/api/trainers-events/trainers');
      if (!response.ok) {
        console.error('Failed to fetch trainers:', response.status, response.statusText);
        throw new Error('Failed to fetch trainers');
      }
      const data = await response.json();
      console.log('Trainers data:', data);
      return data.trainers.map((t: { trainer: string }) => ({
        value: t.trainer,
        label: t.trainer,
      }));
    },
  });

  React.useEffect(() => {
    if (trainersError) {
      console.error('Trainers query error:', trainersError);
    }
    if (trainersData) {
      console.log('Trainers loaded:', trainersData.length, 'trainers');
    }
  }, [trainersError, trainersData]);

  const { data: programsData, isLoading: isLoadingPrograms } = useQuery({
    queryKey: ['programs-list'],
    queryFn: async () => {
      const response = await fetch('/api/trainers-events/programs');
      if (!response.ok) {
        throw new Error('Failed to fetch programs');
      }
      const data = await response.json();
      return data.programs.map((p: { program: string }) => ({
        value: p.program,
        label: p.program,
      }));
    },
  });

  const { data: categoriesData, isLoading: isLoadingCategories } = useQuery({
    queryKey: ['categories-list'],
    queryFn: async () => {
      const response = await fetch('/api/trainers-events/categories');
      if (!response.ok) {
        throw new Error('Failed to fetch categories');
      }
      const data = await response.json();
      return data.categories.map((c: { category: string }) => ({
        value: c.category,
        label: c.category,
      }));
    },
  });

  const {
    data: response,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['trainers-events', filters.year, debouncedMonths, pagination.pageIndex, pagination.pageSize, searchQuery, debouncedTrainers, debouncedPrograms, debouncedCategories, sorting],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      if (filters.year && filters.year !== 'all') params.set('year', filters.year);
      if (debouncedMonths.length > 0) params.set('months', debouncedMonths.join(','));
      params.set('page', String(pagination.pageIndex + 1)); // API uses 1-based indexing
      params.set('pageSize', String(pagination.pageSize));
      if (searchQuery) params.set('search', searchQuery);
      if (debouncedTrainers.length > 0) params.set('trainers', debouncedTrainers.join(','));
      if (debouncedPrograms.length > 0) params.set('programs', debouncedPrograms.join(','));
      if (debouncedCategories.length > 0) params.set('categories', debouncedCategories.join(','));
      if (sorting.length > 0) {
        params.set('sortBy', sorting[0].id);
        params.set('sortOrder', sorting[0].desc ? 'desc' : 'asc');
      }

      const response = await fetch(`/api/trainers-events?${params.toString()}`, {
        signal, // Pass abort signal to cancel previous requests
      });
      if (!response.ok) throw new Error('Failed to fetch trainers events');
      return await response.json();
    },
  });

  const eventsData = response?.data || [];
  const summary = response?.summary || { totalEvents: 0, uniqueTrainers: 0, totalTickets: 0, totalRevenue: 0, totalProfit: 0 };
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
    setPagination({ pageIndex: 0, pageSize: 10 }); // Reset to first page when filter changes
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setPagination({ pageIndex: 0, pageSize: 10 }); // Reset to first page when search changes
  };

  const clearFilters = () => {
    setFilters({ year: 'all' });
    setSelectedMonths([]);
    setSelectedTrainers([]);
    setSelectedPrograms([]);
    setSelectedCategories([]);
    setSearchQuery('');
    setPagination({ pageIndex: 0, pageSize: 10 }); // Reset to first page
  };

  const handleRowClick = (prodid: number) => {
    setSelectedEventId(prodid);
    setIsModalOpen(true);
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
  const totalProfit = summary.totalProfit;
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
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
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
                <MultiSelect
                  options={monthOptions}
                  selected={selectedMonths}
                  onChange={(values) => {
                    setSelectedMonths(values);
                    if (values.length !== selectedMonths.length || !values.every((v, i) => v === selectedMonths[i])) {
                      setPagination({ pageIndex: 0, pageSize: 10 });
                    }
                  }}
                  placeholder="Select months..."
                  searchPlaceholder="Search months..."
                  maxDisplay={1}
                />
              </div>
              <div>
                <Label htmlFor="trainers">Main Trainer</Label>
                <MultiSelect
                  options={trainersData || []}
                  selected={selectedTrainers}
                  onChange={(values) => {
                    setSelectedTrainers(values);
                    // Reset pagination when trainers change (debounced API call will happen automatically)
                    if (values.length !== selectedTrainers.length || !values.every((v, i) => v === selectedTrainers[i])) {
                      setPagination({ pageIndex: 0, pageSize: 10 });
                    }
                  }}
                  placeholder={isLoadingTrainers ? "Loading trainers..." : "Select trainers..."}
                  searchPlaceholder="Search trainers..."
                  disabled={isLoadingTrainers}
                />
              </div>
              <div>
                <Label htmlFor="programs">Program</Label>
                <MultiSelect
                  options={programsData || []}
                  selected={selectedPrograms}
                  onChange={(values) => {
                    setSelectedPrograms(values);
                    if (values.length !== selectedPrograms.length || !values.every((v, i) => v === selectedPrograms[i])) {
                      setPagination({ pageIndex: 0, pageSize: 10 });
                    }
                  }}
                  placeholder={isLoadingPrograms ? "Loading programs..." : "Select programs..."}
                  searchPlaceholder="Search programs..."
                  disabled={isLoadingPrograms}
                />
              </div>
              <div>
                <Label htmlFor="categories">Category</Label>
                <MultiSelect
                  options={categoriesData || []}
                  selected={selectedCategories}
                  onChange={(values) => {
                    setSelectedCategories(values);
                    if (values.length !== selectedCategories.length || !values.every((v, i) => v === selectedCategories[i])) {
                      setPagination({ pageIndex: 0, pageSize: 10 });
                    }
                  }}
                  placeholder={isLoadingCategories ? "Loading categories..." : "Select categories..."}
                  searchPlaceholder="Search categories..."
                  disabled={isLoadingCategories}
                />
              </div>
              <div className="flex items-end">
                <Button onClick={clearFilters} variant="outline" className="w-full">
                  Clear Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
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
                  <CardTitle className="text-sm font-medium">Total Profit</CardTitle>
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
                    €{Number(totalRevenue).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Profit</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    €{Number(totalProfit).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
            <DataTable
              columns={trainersEventsColumns}
              data={eventsData}
              searchValue={searchQuery}
              onSearchChange={handleSearchChange}
              searchPlaceholder="Search by Product ID, Name, Country, Trainer, Program, Category, or Location..."
              enableColumnVisibility={true}
              enableRowSelection={false}
              manualPagination={true}
              manualSorting={true}
              pageCount={paginationInfo.totalPages}
              pagination={pagination}
              onPaginationChange={setPagination}
              sorting={sorting}
              onSortingChange={setSorting}
              isLoading={isFetching}
              onRowClick={(row) => handleRowClick(row.prodid)}
            />
          </CardContent>
        </Card>

        <EventDetailsModal
          prodid={selectedEventId}
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
        />
      </div>
    </DashboardLayout>
  );
}
