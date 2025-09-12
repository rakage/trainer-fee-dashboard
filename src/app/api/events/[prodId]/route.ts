import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/database';
import { requireAuth } from '@/lib/middleware';
import { ActivityLogger } from '@/lib/activity-logger';

interface RouteContext {
  params: Promise<{ prodId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  // Check authentication
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const { prodId: prodIdParam } = await params;
    const prodId = parseInt(prodIdParam);
    if (isNaN(prodId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid ProdID' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const includeDeleted = searchParams.get('includeDeleted') === 'true';

    const event = await DatabaseService.getEventDetail(prodId, includeDeleted);
    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    // Skip trainer splits for now since table doesn't exist
    // const splits = await DatabaseService.getTrainerSplits(prodId);

    // Log activity
    if (authResult.user?.id) {
      await ActivityLogger.log(
        authResult.user.id,
        'view_event_details',
        prodId,
        `Viewed event details: ${event.ProdName} (${event.EventDate})`
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        event,
        splits: [], // Empty array for now
      },
    });
  } catch (error) {
    console.error('Event detail API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch event details' },
      { status: 500 }
    );
  }
}
