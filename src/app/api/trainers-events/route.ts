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
    const monthsParam = searchParams.get('months');
    const months = monthsParam ? monthsParam.split(',').map(m => parseInt(m.trim())).filter(m => !isNaN(m)) : undefined;
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1;
    const pageSize = searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!) : 50;
    const search = searchParams.get('search') || undefined;
    const trainersParam = searchParams.get('trainers');
    const trainers = trainersParam ? trainersParam.split(',').filter(t => t.trim()) : undefined;
    const programsParam = searchParams.get('programs');
    const programs = programsParam ? programsParam.split(',').filter(p => p.trim()) : undefined;
    const categoriesParam = searchParams.get('categories');
    const categories = categoriesParam ? categoriesParam.split(',').filter(c => c.trim()) : undefined;
    const countriesParam = searchParams.get('countries');
    const countries = countriesParam ? countriesParam.split(',').filter(c => c.trim()) : undefined;
    const sortBy = searchParams.get('sortBy') || 'eventdate';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Get paginated data for current page (sequential to avoid pool contention)
    const trainersEvents = await DatabaseService.getTrainersEvents(year, months, page, pageSize, search, trainers, programs, categories, countries, sortBy, sortOrder);
    // Get global summary using ONLY year/months/search/trainers/programs/categories/countries filters (not affected by pagination)
    const summary = await DatabaseService.getTrainersEventsSummary(year, months, search, trainers, programs, categories, countries);
    const totalCount = summary.totalEvents || 0;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    return NextResponse.json({
      data: trainersEvents,
      summary,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages,
      }
    });
  } catch (error) {
    console.error('Error fetching trainers events:', error);
    return NextResponse.json({ error: 'Failed to fetch trainers events' }, { status: 500 });
  }
}
