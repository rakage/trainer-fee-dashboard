import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/database';
import { requireRole } from '@/lib/middleware';
import { ActivityLogger } from '@/lib/activity-logger';
import { Expense } from '@/types';

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

    const expenses = await DatabaseService.getEventExpenses(prodId);

    return NextResponse.json({
      success: true,
      data: { expenses },
    });
  } catch (error) {
    console.error('Get expenses API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch expenses' },
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
    const { expenses }: { expenses: Expense[] } = body;

    if (!Array.isArray(expenses)) {
      return NextResponse.json(
        { success: false, error: 'Invalid expenses data' },
        { status: 400 }
      );
    }

    // Validate expenses data
    for (const expense of expenses) {
      if (!expense.Description?.trim() || expense.Amount < 0) {
        return NextResponse.json(
          { success: false, error: 'Invalid expense data: Description required and amount must be positive' },
          { status: 400 }
        );
      }
    }

    // Save each expense
    for (const expense of expenses) {
      expense.ProdID = prodId;
      await DatabaseService.saveEventExpense(expense);
    }

    // Log activity
    const expenseDetails = expenses.map(e => `${e.Description}: $${e.Amount}`).join(', ');
    if (authResult.user?.id) {
      await ActivityLogger.log(
        authResult.user.id,
        'update_event_expenses',
        prodId,
        `Updated expenses for event ${prodId}: ${expenseDetails}`
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Expenses saved successfully',
    });
  } catch (error) {
    console.error('Expenses API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save expenses' },
      { status: 500 }
    );
  }
}
