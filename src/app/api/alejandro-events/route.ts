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

    // Get the Alejandro events data (only events where TrainerName contains 'Alejandro')
    const eventsData = await DatabaseService.getAlejandroEvents(year, month);

    return NextResponse.json(eventsData);
  } catch (error) {
    console.error('Error fetching Alejandro events:', error);
    return NextResponse.json({ error: 'Failed to fetch Alejandro events' }, { status: 500 });
  }
}