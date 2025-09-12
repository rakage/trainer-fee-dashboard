import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ActivityLogger } from '@/lib/activity-logger';
import { stringify } from 'csv-stringify/sync';

// GET /api/admin/activity-logs - Fetch activity logs with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const action = searchParams.get('action');
    const userId = searchParams.get('userId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const isExport = searchParams.get('export') === 'true';

    const filters = {
      search: search || undefined,
      action: action || undefined,
      userId: userId || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      page: isExport ? undefined : page,
      limit: isExport ? undefined : limit,
    };

    const result = await ActivityLogger.getLogs(filters);

    // If export is requested, return CSV
    if (isExport) {
      const csvData = stringify(result.data.map(log => ({
        'Date & Time': new Date(log.createdAt).toLocaleString(),
        'User ID': log.userId,
        'Action': log.action,
        'Event ID': log.prodId || '',
        'Details': log.details,
      })), {
        header: true,
      });

      const headers = new Headers();
      headers.set('Content-Type', 'text/csv');
      headers.set('Content-Disposition', `attachment; filename="activity-logs-${new Date().toISOString().split('T')[0]}.csv"`);

      return new NextResponse(csvData, { headers });
    }

    // Log the activity (but don't create infinite loop by logging log views)
    if (!search?.includes('view_activity_logs')) {
      await ActivityLogger.log(
        session.user.id,
        'view_activity_logs',
        null,
        `Admin viewed activity logs${search ? ` (search: ${search})` : ''}${action ? ` (action: ${action})` : ''}`
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activity logs' },
      { status: 500 }
    );
  }
}
