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

    // Get summary for cards (all filtered data - not affected by pagination)
    const summary = await DatabaseService.getTrainersEventsSummary(year, month);
    
    // Get paginated data (only for table display)
    const trainersEvents = await DatabaseService.getTrainersEvents(year, month, page, pageSize);

    return NextResponse.json({
      data: trainersEvents,
      summary: {
        totalEvents: summary.totalEvents || 0, // From ALL filtered events (year/month)
        uniqueTrainers: summary.uniqueTrainers || 0, // From ALL filtered events (year/month)
        totalTickets: summary.totalTickets || 0, // From ALL filtered events (year/month)
        totalRevenue: summary.totalRevenue || 0, // From ALL filtered events (year/month)
      },
      pagination: {
        page,
        pageSize,
        totalCount: summary.totalEvents || 0,
        totalPages: Math.ceil((summary.totalEvents || 0) / pageSize),
      }
    });
  } catch (error) {
    console.error('Error fetching trainers events:', error);
    return NextResponse.json({ error: 'Failed to fetch trainers events' }, { status: 500 });
  }
}
