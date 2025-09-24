import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware';
import { DatabaseService } from '@/lib/database';
import { ParamReportingGrpService } from '@/lib/sqlite';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (!authResult.success) {
      return authResult.error;
    }

    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : undefined;
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : undefined;

    // Get the raw report data
    const reportData = await DatabaseService.getAlejandroReport(year, month);

    // Get reporting group parameters
    const reportingGroupParams = ParamReportingGrpService.getAll();

    // Calculate Alejandro totals
    const enrichedReportData = reportData.map((row: any) => {
      // Find matching reporting group
      const reportingGroup = reportingGroupParams.find(
        (rg) => rg.reportingGroup === row.ReportingGroup
      );

      // Calculate Alejandro's fee
      const alejandroPercent = reportingGroup?.alejandroPercent || 0;
      const alejandroFee = row.TotalRevenue * alejandroPercent;

      return {
        ...row,
        AlejandroPercent: alejandroPercent,
        AlejandroFee: alejandroFee,
      };
    });

    return NextResponse.json(enrichedReportData);
  } catch (error) {
    console.error('Error fetching Alejandro report:', error);
    return NextResponse.json({ error: 'Failed to fetch Alejandro report' }, { status: 500 });
  }
}
