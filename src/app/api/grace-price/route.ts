import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/middleware';
import { GracePriceService } from '@/lib/postgres';

export async function GET(request: NextRequest) {
  // Check authentication and require admin role
  const authResult = await requireRole(request, ['admin']);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const priceConversions = await GracePriceService.getAll();
    return NextResponse.json({
      success: true,
      data: priceConversions,
    });
  } catch (error) {
    console.error('Grace price GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch grace price conversions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Check authentication and require admin role
  const authResult = await requireRole(request, ['admin']);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const body = await request.json();
    const { id, eventType, eventTypeKey, venue, jpyPrice, eurPrice } = body;

    // Validation
    if (!eventType || !eventTypeKey || typeof jpyPrice !== 'number' || typeof eurPrice !== 'number') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid required fields' },
        { status: 400 }
      );
    }

    if (jpyPrice < 0 || eurPrice < 0) {
      return NextResponse.json(
        { success: false, error: 'Prices cannot be negative' },
        { status: 400 }
      );
    }

    // If ID is provided, update existing record; otherwise insert new record
    if (id && typeof id === 'number') {
      GracePriceService.update(id, {
        eventType,
        eventTypeKey,
        venue: venue || null,
        jpyPrice,
        eurPrice,
      });
    } else {
      GracePriceService.upsert({
        eventType,
        eventTypeKey,
        venue: venue || null,
        jpyPrice,
        eurPrice,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Grace price conversion saved successfully',
    });
  } catch (error) {
    console.error('Grace price POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save grace price conversion' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  // Check authentication and require admin role
  const authResult = await requireRole(request, ['admin']);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json(
        { success: false, error: 'Invalid ID parameter' },
        { status: 400 }
      );
    }

    GracePriceService.delete(parseInt(id));

    return NextResponse.json({
      success: true,
      message: 'Grace price conversion deleted successfully',
    });
  } catch (error) {
    console.error('Grace price DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete grace price conversion' },
      { status: 500 }
    );
  }
}