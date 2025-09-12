import { NextRequest, NextResponse } from 'next/server';
import { FeeParamService } from '@/lib/sqlite';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ActivityLogger } from '@/lib/activity-logger';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = FeeParamService.list();
    return NextResponse.json({ 
      success: true, 
      data: params.map(p => ({
        id: p.id,
        program: p.program,
        category: p.category,
        venue: p.venue,
        attendance: p.attendance,
        percent: Math.round(p.percent * 100), // Convert to percentage
        concatKey: p.concat_key
      }))
    });
  } catch (error) {
    console.error('Fee params API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch fee parameters' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admin can create/modify fee parameters
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { program, category, venue, attendance, percent } = body;

    // Validation
    if (!program || !category || !venue || !attendance || typeof percent !== 'number') {
      return NextResponse.json(
        { error: 'Missing required fields: program, category, venue, attendance, percent' },
        { status: 400 }
      );
    }

    if (percent < 0 || percent > 100) {
      return NextResponse.json(
        { error: 'Percent must be between 0 and 100' },
        { status: 400 }
      );
    }

    // Check if parameter already exists to determine if it's create or update
    const concatKey = FeeParamService.concatKey(
      program.trim(),
      category.trim(),
      venue.trim(),
      attendance.trim()
    );
    
    const existing = FeeParamService.list().find(p => p.concat_key === concatKey);
    const isUpdate = !!existing;

    // Convert percentage to decimal
    const percentDecimal = percent / 100;

    FeeParamService.upsertParam({
      program: program.trim(),
      category: category.trim(),
      venue: venue.trim(),
      attendance: attendance.trim(),
      percent: percentDecimal
    });

    // Log the activity
    const action = isUpdate ? 'update_fee_parameter' : 'create_fee_parameter';
    const paramDetails = `${program}-${category}-${venue}-${attendance}: ${percent}%`;
    await ActivityLogger.log(
      session.user.id,
      action,
      null,
      `${isUpdate ? 'Updated' : 'Created'} fee parameter: ${paramDetails}`
    );

    return NextResponse.json({
      success: true,
      message: 'Fee parameter saved successfully'
    });

  } catch (error) {
    console.error('Fee params create error:', error);
    return NextResponse.json(
      { error: 'Failed to save fee parameter' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admin can delete fee parameters
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json(
        { error: 'Valid ID parameter is required' },
        { status: 400 }
      );
    }

    const paramId = parseInt(id);
    const existing = FeeParamService.getById(paramId);
    
    if (!existing) {
      return NextResponse.json(
        { error: 'Fee parameter not found' },
        { status: 404 }
      );
    }

    FeeParamService.delete(paramId);

    // Log the activity
    const paramDetails = `${existing.program}-${existing.category}-${existing.venue}-${existing.attendance}: ${Math.round(existing.percent * 100)}%`;
    await ActivityLogger.log(
      session.user.id,
      'delete_fee_parameter',
      null,
      `Deleted fee parameter: ${paramDetails}`
    );

    return NextResponse.json({
      success: true,
      message: 'Fee parameter deleted successfully'
    });

  } catch (error) {
    console.error('Fee params delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete fee parameter' },
      { status: 500 }
    );
  }
}
