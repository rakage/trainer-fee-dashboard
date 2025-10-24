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

    // Get summary for cards (all filtered data)
    const summary = await DatabaseService.getTrainersEventsSummary(year, month);
    
    // Get paginated data
    const trainersEvents = await DatabaseService.getTrainersEvents(year, month, page, pageSize);

    // Calculate totals from the paginated data (will need to sum all pages in frontend)
    const totalTickets = trainersEvents.reduce((sum: number, event: any) => sum + (event.totaltickets || 0), 0);
    const totalRevenue = trainersEvents.reduce((sum: number, event: any) => sum + (event.totalrevenue || 0), 0);

    return NextResponse.json({
      data: trainersEvents,
      summary: {
        totalEvents: summary.totalEvents || 0,
        uniqueTrainers: summary.uniqueTrainers || 0,
        totalTickets, // Sum from current page only
        totalRevenue, // Sum from current page only
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
