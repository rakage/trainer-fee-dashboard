import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware';
import { DatabaseService } from '@/lib/database';
import { getTrainersEventsSummary } from '@/lib/trainers-events-summary';

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

    // Call both queries in parallel for better performance
    const [summary, trainersEvents] = await Promise.all([
      getTrainersEventsSummary(year, month), // Get totals from ALL filtered events
      DatabaseService.getTrainersEvents(year, month, page, pageSize) // Get current page data
    ]);

    return NextResponse.json({
      data: trainersEvents,
      summary: {
        totalEvents: summary.totalEvents || 0,
        uniqueTrainers: summary.uniqueTrainers || 0,
        totalTickets: summary.totalTickets || 0,
        totalRevenue: summary.totalRevenue || 0,
      },
      pagination: {
        page,
        pageSize,
        totalCount: summary.totalEvents || 0, // Use total from summary
        totalPages: Math.ceil((summary.totalEvents || 0) / pageSize),
      }
    });
  } catch (error) {
    console.error('Error fetching trainers events:', error);
    return NextResponse.json({ error: 'Failed to fetch trainers events' }, { status: 500 });
  }
}
