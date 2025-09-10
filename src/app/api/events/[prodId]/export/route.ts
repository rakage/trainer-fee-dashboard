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
    'Attendance', 'Payment Method', 'Tier Level', 'Quantity',
    'Ticket Price', 'Ticket Price Total', 'Trainer Fee %', 'Trainer Fee Amount'
  ]);

  // Add summary rows
  summaryData.forEach(row => {
    worksheet.addRow([
      row.Attendance,
      row.PaymentMethod || 'N/A',
      row.TierLevel || 'N/A',
      row.sumQuantity,
      row.UnitPrice,
      row.sumPriceTotal,
      row.TrainerFeePct,
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
    ['Attendance', 'Payment Method', 'Tier Level', 'Quantity', 'Ticket Price', 'Ticket Price Total', 'Trainer Fee %', 'Trainer Fee Amount'],
    ...summaryData.map(row => [
      row.Attendance,
      row.PaymentMethod || 'N/A',
      row.TierLevel || 'N/A',
      row.sumQuantity,
      row.UnitPrice,
      row.sumPriceTotal,
      row.TrainerFeePct,
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
  try {
    const puppeteer = require('puppeteer');
    const summaryData = calculateEventSummary(event.tickets);
    
    // Create HTML content for PDF
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Event Report - ${event.ProdName}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; }
          h1 { color: #333; border-bottom: 2px solid #333; }
          h2 { color: #666; margin-top: 30px; }
          .info-grid { display: grid; grid-template-columns: 200px 1fr; gap: 10px; margin: 20px 0; }
          .info-label { font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; font-weight: bold; }
          .number { text-align: right; }
          .footer { margin-top: 40px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <h1>Event Report</h1>
        
        <div class="info-grid">
          <div class="info-label">ProdID:</div><div>${event.ProdID}</div>
          <div class="info-label">Event Name:</div><div>${event.ProdName}</div>
          <div class="info-label">Date:</div><div>${event.EventDate}</div>
          <div class="info-label">Country:</div><div>${event.Country}</div>
          <div class="info-label">Venue:</div><div>${event.Venue}</div>
          <div class="info-label">Trainer:</div><div>${trainerOverride || event.Trainer_1}</div>
        </div>
        
        <h2>Event Summary</h2>
        <table>
          <thead>
            <tr>
              <th>Attendance</th>
              <th>Payment Method</th>
              <th>Tier Level</th>
              <th class="number">Quantity</th>
              <th class="number">Ticket Price</th>
              <th class="number">Ticket Price Total</th>
              <th class="number">Trainer Fee %</th>
              <th class="number">Trainer Fee Amount</th>
            </tr>
          </thead>
          <tbody>
            ${summaryData.map(row => `
              <tr>
                <td>${row.Attendance}</td>
                <td>${row.PaymentMethod || 'N/A'}</td>
                <td>${row.TierLevel || 'N/A'}</td>
                <td class="number">${row.sumQuantity}</td>
                <td class="number">€${row.UnitPrice.toFixed(2)}</td>
                <td class="number">€${row.sumPriceTotal.toFixed(2)}</td>
                <td class="number">${(row.TrainerFeePct * 100).toFixed(1)}%</td>
                <td class="number">€${row.sumTrainerFee.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        ${splits.length > 0 ? `
          <h2>Trainer Splits</h2>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th class="number">Percentage</th>
                <th class="number">Trainer Fee</th>
                <th class="number">Cash Received</th>
                <th class="number">Payable</th>
              </tr>
            </thead>
            <tbody>
              ${splits.map(split => `
                <tr>
                  <td>${split.Name}</td>
                  <td class="number">${split.Percent.toFixed(1)}%</td>
                  <td class="number">€${split.TrainerFee.toFixed(2)}</td>
                  <td class="number">€${split.CashReceived.toFixed(2)}</td>
                  <td class="number">€${split.Payable.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : ''}
        
        <div class="footer">
          Generated on: ${new Date().toLocaleString('de-DE')}<br>
          Salsation Event Reports Dashboard
        </div>
      </body>
      </html>
    `;

    // Launch Puppeteer and generate PDF
    const browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setContent(htmlContent);
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
    });
    
    await browser.close();

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    // Fallback to text export if PDF generation fails
    const textContent = `Event Report\n\nProdID: ${event.ProdID}\nEvent Name: ${event.ProdName}\nDate: ${event.EventDate}\nCountry: ${event.Country}\nVenue: ${event.Venue}\nTrainer: ${trainerOverride || event.Trainer_1}\n\nGenerated on: ${new Date().toLocaleString('de-DE')}`;
    
    return new NextResponse(textContent, {
      headers: {
        'Content-Type': 'text/plain',
        'Content-Disposition': `attachment; filename="${filename}.txt"`,
      },
    });
  }
}
