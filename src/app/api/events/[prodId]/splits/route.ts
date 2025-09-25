import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/database';
import { requireRole } from '@/lib/middleware';
import { ActivityLogger } from '@/lib/activity-logger';
import { TrainerSplit } from '@/types';

interface RouteContext {
  params: Promise<{ prodId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  // Check authentication
  const authResult = await requireRole(request, ['admin', 'finance', 'trainer', 'viewer']);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    // Await params before accessing properties (Next.js 15)
    const { prodId: prodIdParam } = await params;
    const prodId = parseInt(prodIdParam);
    if (isNaN(prodId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid ProdID' },
        { status: 400 }
      );
    }

    const splits = await DatabaseService.getTrainerSplits(prodId);

    return NextResponse.json({
      success: true,
      data: { splits },
    });
  } catch (error) {
    console.error('Get trainer splits API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch trainer splits' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  // Check authentication and role
  const authResult = await requireRole(request, ['admin', 'finance', 'trainer']);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    // Await params before accessing properties (Next.js 15)
    const { prodId: prodIdParam } = await params;
    const prodId = parseInt(prodIdParam);
    if (isNaN(prodId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid ProdID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { splits }: { splits: TrainerSplit[] } = body;

    if (!Array.isArray(splits)) {
      return NextResponse.json(
        { success: false, error: 'Invalid splits data' },
        { status: 400 }
      );
    }

    // Validate splits data
    for (const split of splits) {
      if (!split.Name || split.Percent < 0 || split.Percent > 100) {
        return NextResponse.json(
          { success: false, error: 'Invalid split data' },
          { status: 400 }
        );
      }
    }

    // Check that percentages don't exceed 100%
    const totalPercent = splits.reduce((sum, split) => sum + split.Percent, 0);
    if (totalPercent > 100) {
      return NextResponse.json(
        { success: false, error: 'Total percentage cannot exceed 100%' },
        { status: 400 }
      );
    }

    // Save each split
    for (const split of splits) {
      split.ProdID = prodId;
      await DatabaseService.saveTrainerSplit(split);
    }

    // Log activity
    const splitDetails = splits.map(s => `${s.Name}: ${s.Percent}%`).join(', ');
    if (authResult.user?.id) {
      await ActivityLogger.log(
        authResult.user.id,
        'update_trainer_splits',
        prodId,
        `Updated trainer splits for event ${prodId}: ${splitDetails}`
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Splits saved successfully',
    });
  } catch (error) {
    console.error('Trainer splits API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save splits' },
      { status: 500 }
    );
  }
}
