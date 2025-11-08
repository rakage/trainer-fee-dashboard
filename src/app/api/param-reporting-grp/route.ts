import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware';
import { ParamReportingGrpService } from '@/lib/postgres';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (!authResult.success) {
      return authResult.error;
    }

    // Auto-seed if table is empty
    const reportingGroups = await ParamReportingGrpService.getAll();
    if (reportingGroups.length === 0) {
      await ParamReportingGrpService.seedDefaults();
      // Get data again after seeding
      const seededData = await ParamReportingGrpService.getAll();
      return NextResponse.json(seededData);
    }

    return NextResponse.json(reportingGroups);
  } catch (error) {
    console.error('Error fetching reporting group parameters:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reporting group parameters' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (!authResult.success) {
      return authResult.error;
    }

    const body = await request.json();
    const { reportingGroup, split, trainerPercent, alejandroPercent, price, repeaterPrice } = body;

    if (
      !reportingGroup ||
      !split ||
      typeof trainerPercent !== 'number' ||
      typeof alejandroPercent !== 'number'
    ) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    ParamReportingGrpService.upsert({
      reportingGroup,
      split,
      trainerPercent,
      alejandroPercent,
      price: price || null,
      repeaterPrice: repeaterPrice || null,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving reporting group parameter:', error);
    return NextResponse.json(
      { error: 'Failed to save reporting group parameter' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (!authResult.success) {
      return authResult.error;
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
    }

    ParamReportingGrpService.delete(parseInt(id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting reporting group parameter:', error);
    return NextResponse.json(
      { error: 'Failed to delete reporting group parameter' },
      { status: 500 }
    );
  }
}
