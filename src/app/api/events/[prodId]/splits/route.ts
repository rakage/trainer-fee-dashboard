import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/database';
import { requireRole } from '@/lib/middleware';
import { TrainerSplit } from '@/types';

interface RouteContext {
  params: { prodId: string };
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  // Check authentication and role
  const authResult = await requireRole(request, ['admin', 'finance', 'trainer']);
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

    // Log audit event
    await DatabaseService.logAuditEvent(
      authResult.user.id,
      'UPDATE_SPLITS',
      prodId,
      `Updated trainer splits: ${splits.length} entries`
    );

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
