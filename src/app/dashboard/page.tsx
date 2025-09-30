import { Suspense } from 'react';
import DashboardClient from './dashboard-client';
import { DashboardLayout } from '@/components/dashboard/layout';
import { EventReportSkeleton } from '@/components/dashboard/event-report-skeleton';

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLayout><EventReportSkeleton /></DashboardLayout>}>
      <DashboardClient />
    </Suspense>
  );
}
