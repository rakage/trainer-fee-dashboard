import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware';
import { ParamReportingGrpService } from '@/lib/sqlite';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (!authResult.success) {
      return authResult.error;
    }

    // Type guard to ensure user exists
    if (!authResult.user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    // Only allow admin users to seed data
    if (authResult.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    ParamReportingGrpService.seedDefaults();

    return NextResponse.json({
      success: true,
      message: 'Reporting group parameters seeded successfully',
    });
  } catch (error) {
    console.error('Error seeding reporting group parameters:', error);
    return NextResponse.json(
      { error: 'Failed to seed reporting group parameters' },
      { status: 500 }
    );
  }
}
