import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware';
import { DatabaseService } from '@/lib/database';

export async function GET(
  request: NextRequest,
  { params }: { params: { prodid: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (!authResult.success) {
      return authResult.error;
    }

    const prodid = parseInt(params.prodid);
    if (isNaN(prodid)) {
      return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 });
    }

    const [eventDetails, tickets] = await Promise.all([
      DatabaseService.getEventDetails(prodid),
      DatabaseService.getEventTickets(prodid),
    ]);

    if (!eventDetails) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    return NextResponse.json({
      eventDetails,
      tickets,
    });
  } catch (error) {
    console.error('Error fetching event details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch event details' },
      { status: 500 }
    );
  }
}
