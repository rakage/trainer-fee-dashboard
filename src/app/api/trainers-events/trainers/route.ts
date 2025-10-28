import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware';
import { DatabaseService } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (!authResult.success) {
      return authResult.error;
    }

    const trainers = await DatabaseService.getUniqueTrainers();

    return NextResponse.json({ trainers });
  } catch (error) {
    console.error('Error fetching trainers:', error);
    return NextResponse.json({ error: 'Failed to fetch trainers' }, { status: 500 });
  }
}
