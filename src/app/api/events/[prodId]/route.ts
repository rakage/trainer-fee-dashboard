import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/database';
import { requireAuth } from '@/lib/middleware';

interface RouteContext {
  params: { prodId: string };
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  // Check authentication
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const prodId = parseInt(params.prodId);
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

    // Also fetch trainer splits
    const splits = await DatabaseService.getTrainerSplits(prodId);

    return NextResponse.json({
      success: true,
      data: {
        event,
        splits,
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
