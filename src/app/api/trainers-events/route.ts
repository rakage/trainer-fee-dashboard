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

    // Get paginated data for current page
    const trainersEvents = await DatabaseService.getTrainersEvents(year, month, page, pageSize);

    // Calculate totals from current page (temporary - shows page totals only)
    const totalTickets = trainersEvents.reduce((sum: number, event: any) => sum + (event.totaltickets || 0), 0);
    const totalRevenue = trainersEvents.reduce((sum: number, event: any) => sum + (event.totalrevenue || 0), 0);

    return NextResponse.json({
      data: trainersEvents,
      summary: {
        totalEvents: trainersEvents.length, // Current page only
        uniqueTrainers: new Set(trainersEvents.map((e: any) => e.trainer)).size, // Current page only
        totalTickets, // Current page only
        totalRevenue, // Current page only
      },
      pagination: {
        page,
        pageSize,
        totalCount: trainersEvents.length, // TODO: Get real total count
        totalPages: 1, // TODO: Calculate real total pages
      }
    });
  } catch (error) {
    console.error('Error fetching trainers events:', error);
    return NextResponse.json({ error: 'Failed to fetch trainers events' }, { status: 500 });
  }
}
