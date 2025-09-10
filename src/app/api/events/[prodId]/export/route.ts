import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/database';
import { requireRole, rateLimit } from '@/lib/middleware';
import { ExportRequest } from '@/types';
import { generateExportFilename, calculateEventSummary } from '@/lib/utils';
import ExcelJS from 'exceljs';
import { stringify } from 'csv-stringify/sync';

interface RouteContext {
  params: { prodId: string };
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  // Check authentication and role
  const authResult = await requireRole(request, ['admin', 'finance', 'trainer']);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  // Rate limiting for export endpoints
  const userId = authResult.user.id;
  if (!rateLimit(userId, 10, 60000)) { // 10 exports per minute
    return NextResponse.json(
      { success: false, error: 'Rate limit exceeded' },
      { status: 429 }
    );
  }

  try {
    // Await params before accessing properties (Next.js 15 requirement)
    const { prodId: prodIdStr } = await params;
    const prodId = parseInt(prodIdStr);
    if (isNaN(prodId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid ProdID' },
        { status: 400 }
      );
    }

    const body: ExportRequest = await request.json();
    const { format, trainerOverride, commissions, includeDeleted = false } = body;

    if (!['xlsx', 'csv', 'pdf'].includes(format)) {
      return NextResponse.json(
        { success: false, error: 'Invalid format' },
        { status: 400 }
      );
    }

    // Fetch event data
    const event = await DatabaseService.getEventDetail(prodId, includeDeleted);
    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    // Fetch trainer splits
    const splits = await DatabaseService.getTrainerSplits(prodId);

    // Generate filename
    const filename = generateExportFilename(prodId, event.ProdName, format);

    // Log audit event
    await DatabaseService.logAuditEvent(
      userId,
      'EXPORT',
      prodId,
      `Exported ${format.toUpperCase()} report`
    );

    switch (format) {
      case 'xlsx':
        return await generateXLSXExport(event, splits, commissions, trainerOverride, filename);
      case 'csv':
        return await generateCSVExport(event, splits, commissions, trainerOverride, filename);
      case 'pdf':
        return await generatePDFExport(event, splits, commissions, trainerOverride, filename);
      default:
        return NextResponse.json(
          { success: false, error: 'Unsupported format' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Export API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate export' },
      { status: 500 }
    );
  }
}

async function generateXLSXExport(event: any, splits: any[], commissions: any, trainerOverride?: string, filename?: string) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Event Report');

  // Add header information
  worksheet.addRow(['Event Report']);
  worksheet.addRow(['ProdID:', event.ProdID]);
  worksheet.addRow(['Event Name:', event.ProdName]);
  worksheet.addRow(['Date:', event.EventDate]);
  worksheet.addRow(['Country:', event.Country]);
  worksheet.addRow(['Venue:', event.Venue]);
  worksheet.addRow(['Trainer:', trainerOverride || event.Trainer_1]);
  worksheet.addRow([]); // Empty row

  // Add summary data
  const summaryData = calculateEventSummary(event.tickets);
  
  // Headers for summary table
  worksheet.addRow([
    'Attendance', 'Payment Method', 'Tier Level', 'Price Total', 
    'Trainer Fee %', 'Quantity', 'Sum Price Total', 'Sum Trainer Fee'
  ]);

  // Add summary rows
  summaryData.forEach(row => {
    worksheet.addRow([
      row.Attendance,
      row.PaymentMethod || 'N/A',
      row.TierLevel || 'N/A',
      row.PriceTotal,
      row.TrainerFeePct,
      row.sumQuantity,
      row.sumPriceTotal,
      row.sumTrainerFee
    ]);
  });

  // Add trainer splits if any
  if (splits.length > 0) {
    worksheet.addRow([]); // Empty row
    worksheet.addRow(['Trainer Splits']);
    worksheet.addRow(['Name', 'Percentage', 'Trainer Fee', 'Cash Received', 'Payable']);
    
    splits.forEach(split => {
      worksheet.addRow([
        split.Name,
        split.Percent,
        split.TrainerFee,
        split.CashReceived,
        split.Payable
      ]);
    });
  }

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

async function generateCSVExport(event: any, splits: any[], commissions: any, trainerOverride?: string, filename?: string) {
  const summaryData = calculateEventSummary(event.tickets);
  
  const csvData = [
    ['Event Report'],
    ['ProdID', event.ProdID],
    ['Event Name', event.ProdName],
    ['Date', event.EventDate],
    ['Country', event.Country],
    ['Venue', event.Venue],
    ['Trainer', trainerOverride || event.Trainer_1],
    [],
    ['Attendance', 'Payment Method', 'Tier Level', 'Price Total', 'Trainer Fee %', 'Quantity', 'Sum Price Total', 'Sum Trainer Fee'],
    ...summaryData.map(row => [
      row.Attendance,
      row.PaymentMethod || 'N/A',
      row.TierLevel || 'N/A',
      row.PriceTotal,
      row.TrainerFeePct,
      row.sumQuantity,
      row.sumPriceTotal,
      row.sumTrainerFee
    ])
  ];

  const csvString = stringify(csvData);

  return new NextResponse(csvString, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

async function generatePDFExport(event: any, splits: any[], commissions: any, trainerOverride?: string, filename?: string) {
  // For now, return a simple text-based PDF
  // In production, you would use Puppeteer to generate HTML -> PDF
  const textContent = `
Event Report

ProdID: ${event.ProdID}
Event Name: ${event.ProdName}
Date: ${event.EventDate}
Country: ${event.Country}
Venue: ${event.Venue}
Trainer: ${trainerOverride || event.Trainer_1}

Event Summary:
${calculateEventSummary(event.tickets).map(row => 
  `${row.Attendance} | ${row.PaymentMethod || 'N/A'} | ${row.TierLevel || 'N/A'} | €${row.PriceTotal} | ${(row.TrainerFeePct * 100).toFixed(1)}% | ${row.sumQuantity} | €${row.sumPriceTotal.toFixed(2)} | €${row.sumTrainerFee.toFixed(2)}`
).join('\n')}

Generated on: ${new Date().toLocaleString('de-DE')}
  `;

  return new NextResponse(textContent, {
    headers: {
      'Content-Type': 'text/plain',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
