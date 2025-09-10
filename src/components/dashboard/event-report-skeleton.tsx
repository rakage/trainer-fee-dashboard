'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface SkeletonProps {
  className?: string;
}

function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`animate-pulse bg-muted rounded ${className}`} />;
}

export function EventReportSkeleton() {
  return (
    <div className="space-y-6">
      {/* Export Controls Skeleton */}
      <Card>
        <CardHeader className="pb-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-20" />
          </div>
        </CardContent>
      </Card>

      {/* Overview Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-3 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Event Tickets Table Skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-80" />
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            {/* Table Header */}
            <div className="bg-gray-50 border-b p-4">
              <div className="grid grid-cols-8 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
            </div>
            
            {/* Table Rows */}
            <div className="divide-y divide-gray-200">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-4">
                  <div className="grid grid-cols-8 gap-4 items-center">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-8" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                </div>
              ))}
            </div>
            
            {/* Table Footer */}
            <div className="bg-gray-50 border-t p-4">
              <div className="grid grid-cols-8 gap-4 items-center">
                <div className="col-span-4">
                  <Skeleton className="h-4 w-12" />
                </div>
                <div className="col-span-1"></div>
                <Skeleton className="h-4 w-16" />
                <div className="col-span-1"></div>
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trainer Splits Editor Skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-96" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-28" />
          </div>
          
          {/* Splits Table Skeleton */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-gray-50 border-b p-3">
              <div className="grid grid-cols-5 gap-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
            </div>
            
            <div className="divide-y divide-gray-200">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-3">
                  <div className="grid grid-cols-5 gap-4 items-center">
                    <Skeleton className="h-9 w-full" />
                    <Skeleton className="h-9 w-full" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-9 w-full" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="flex justify-end">
            <Skeleton className="h-9 w-20" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function NoEventFound() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16">
        <div className="text-center space-y-3">
          <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900">No Event Found</h3>
          <p className="text-muted-foreground max-w-md">
            The selected event could not be found or does not exist. Please try selecting a different event from the dropdown above.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
