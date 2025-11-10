import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware';
import { DatabaseService } from '@/lib/database';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ prodid: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (!authResult.success) {
      return authResult.error;
    }

    const params = await context.params;
    const prodid = parseInt(params.prodid);
    if (isNaN(prodid)) {
      return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 });
    }

    const [eventDetails, tickets] = await Promise.all([
      DatabaseService.getEventDetails(prodid),
      DatabaseService.getEventTickets(prodid),
    ]);

    if (!eventDetails) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Check if event is in Japan
    const isJapan = 
      eventDetails.country?.toLowerCase().includes('japan') ||
      eventDetails.country?.toLowerCase().includes('jp');

    // For Japan events, recalculate revenue from converted ticket prices
    if (isJapan && tickets.length > 0) {
      console.log('\n=== RECALCULATING REVENUE FOR JAPAN EVENT ===');
      
      // Calculate revenue as sum of all ticket PriceTotals (already converted to JPY)
      const revenue = tickets.reduce((sum: number, ticket: any) => sum + (ticket.PriceTotal || 0), 0);
      console.log(`Original revenue (EUR): €${eventDetails.revenue}`);
      console.log(`Recalculated revenue (JPY): ¥${revenue.toLocaleString('ja-JP')}`);

      // Get and convert expenses to JPY
      let expenses = eventDetails.expenses || 0;
      if (expenses > 0) {
        // Get individual expense records to convert each one
        const expenseRecords = await DatabaseService.getEventExpenses(prodid);
        
        if (expenseRecords.length > 0) {
          console.log(`\nConverting ${expenseRecords.length} expense(s) to JPY:`);
          
          // Convert each expense based on its currency
          const convertedExpenses = await Promise.all(
            expenseRecords.map(async (expense: any) => {
              const expenseCurrency = expense.Currency || 'EUR';
              
              if (expenseCurrency === 'JPY') {
                // Already in JPY, no conversion needed
                console.log(`  - ${expense.Description}: ¥${expense.Amount.toLocaleString('ja-JP')} (already JPY)`);
                return expense.Amount;
              } else if (expenseCurrency === 'EUR') {
                // Convert EUR to JPY using a standard exchange rate
                // For consistency with ticket conversion, we could use a fixed rate
                // Common EUR/JPY rate is around 160-170
                const eurToJpyRate = 165; // Standard conversion rate
                const jpyAmount = expense.Amount * eurToJpyRate;
                console.log(`  - ${expense.Description}: €${expense.Amount} → ¥${jpyAmount.toLocaleString('ja-JP')}`);
                return jpyAmount;
              } else {
                // For other currencies, convert to JPY (simplified - using EUR as intermediate)
                // In production, you might want to use actual exchange rates
                const eurToJpyRate = 165;
                const jpyAmount = expense.Amount * eurToJpyRate;
                console.log(`  - ${expense.Description}: ${expenseCurrency}${expense.Amount} → ¥${jpyAmount.toLocaleString('ja-JP')} (via EUR)`);
                return jpyAmount;
              }
            })
          );

          expenses = convertedExpenses.reduce((sum, amount) => sum + amount, 0);
          console.log(`Total expenses (JPY): ¥${expenses.toLocaleString('ja-JP')}`);
        }
      }

      // Recalculate profit
      const profit = revenue - expenses;
      console.log(`Profit (JPY): ¥${profit.toLocaleString('ja-JP')}`);
      console.log('=== END RECALCULATION ===\n');

      // Update event details with recalculated values
      eventDetails.revenue = revenue;
      eventDetails.expenses = expenses;
      eventDetails.profit = profit;
      eventDetails.currency = 'JPY';
    } else {
      eventDetails.currency = 'EUR';
    }

    return NextResponse.json({
      eventDetails,
      tickets,
    });
  } catch (error) {
    console.error('Error fetching event details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch event details' },
      { status: 500 }
    );
  }
}
