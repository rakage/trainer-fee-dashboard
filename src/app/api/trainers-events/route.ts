import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware';
import { DatabaseService } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (!authResult.success) {
      return authResult.error;
    }

    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : undefined;
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : undefined;
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1;
    const pageSize = searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!) : 50;
    const search = searchParams.get('search') || undefined;

    // Get paginated data for current page (sequential to avoid pool contention)
    const trainersEvents = await DatabaseService.getTrainersEvents(year, month, page, pageSize, search);
    // Get global summary using ONLY year/month/search filters (not affected by pagination)
    const summary = await DatabaseService.getTrainersEventsSummary(year, month, search);
    const totalCount = summary.totalEvents || 0;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    return NextResponse.json({
      data: trainersEvents,
      summary,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages,
      }
    });
  } catch (error) {
    console.error('Error fetching trainers events:', error);
    return NextResponse.json({ error: 'Failed to fetch trainers events' }, { status: 500 });
  }
}
