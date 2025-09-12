import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/database';
import { requireRole, rateLimit } from '@/lib/middleware';
import { ExportRequest } from '@/types';
import { generateExportFilename, calculateEventSummary, getCustomTrainerFee } from '@/lib/utils';
import ExcelJS from 'exceljs';
import { stringify } from 'csv-stringify/sync';

interface RouteContext {
  params: Promise<{ prodId: string }>;
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

    // Fetch trainer splits and expenses
    const splits = await DatabaseService.getTrainerSplits(prodId);
    const expenses = await DatabaseService.getEventExpenses(prodId);

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
        return await generateXLSXExport(event, splits, expenses, commissions, trainerOverride, filename);
      case 'csv':
        return await generateCSVExport(event, splits, expenses, commissions, trainerOverride, filename);
      case 'pdf':
        return await generatePDFExport(event, splits, expenses, commissions, trainerOverride, filename);
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

// Helper function to calculate trainer fee after expenses and percentage
function calculateAdjustedTrainerFee(event: any, expenses: any[], trainerName?: string): { originalTrainerFee: number, totalExpenses: number, margin: number, trainerFeePercentage: number, adjustedTrainerFee: number } {
  const currentTrainerName = trainerName || event.Trainer_1 || '';
  const isAlejandro = currentTrainerName.toLowerCase().includes('alejandro');
  
  // Calculate original trainer fee
  const originalTrainerFee = event.tickets.reduce((sum: number, ticket: any) => {
    if (isAlejandro) {
      return sum + ticket.PriceTotal;
    } else {
      const { amount } = getCustomTrainerFee(currentTrainerName, ticket);
      return sum + amount;
    }
  }, 0);
  
  // Calculate total expenses
  const totalExpenses = expenses.reduce((sum: number, expense: any) => sum + (expense.Amount || 0), 0);
  
  // Calculate margin
  const margin = originalTrainerFee - totalExpenses;
  
  // Calculate trainer fee percentage from attended tickets (for Alejandro)
  const attendedTickets = event.tickets?.filter((ticket: any) => ticket.Attendance === 'Attended') || [];
  let trainerFeePercentage = 100; // Default 100% for non-Alejandro
  
  if (isAlejandro && attendedTickets.length > 0) {
    trainerFeePercentage = attendedTickets.reduce((sum: number, ticket: any) => sum + (ticket.TrainerFeePct || 0) * ticket.PriceTotal, 0) / 
      attendedTickets.reduce((sum: number, ticket: any) => sum + ticket.PriceTotal, 0) * 100;
  }
  
  // Calculate final adjusted trainer fee
  const adjustedTrainerFee = margin * (trainerFeePercentage / 100);
  
  return {
    originalTrainerFee,
    totalExpenses,
    margin,
    trainerFeePercentage,
    adjustedTrainerFee
  };
}

async function generateXLSXExport(event: any, splits: any[], expenses: any[], commissions: any, trainerOverride?: string, filename?: string) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Event Report');

  // Format date properly
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE');
  };

  // Add header information
  worksheet.addRow(['Event Report']);
  worksheet.addRow(['ProdID:', event.ProdID]);
  worksheet.addRow(['Event Name:', event.ProdName]);
  worksheet.addRow(['Date:', formatDate(event.EventDate)]);
  worksheet.addRow(['Country:', event.Country]);
  worksheet.addRow(['Venue:', event.Venue]);
  worksheet.addRow(['Trainer:', trainerOverride || event.Trainer_1]);
  worksheet.addRow([]); // Empty row

  // Add summary data
  const summaryData = calculateEventSummary(event.tickets);
  
  // Calculate overview and totals
  const { calculateEventOverview } = require('@/lib/utils');
  const overview = calculateEventOverview(event.tickets, commissions, splits);
  const totals = {
    totalQuantity: summaryData.reduce((sum, row) => sum + row.sumQuantity, 0),
    totalPriceTotal: summaryData.reduce((sum, row) => sum + row.sumPriceTotal, 0),
    totalTrainerFee: summaryData.reduce((sum, row) => sum + row.sumTrainerFee, 0)
  };
  
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

  // Add grand total row
  worksheet.addRow([
    'Grand Total', '', // Attendance, Payment Method, Tier Level (merged)
    totals.totalQuantity,  // Quantity
    '',                    // Ticket Price (empty)
    totals.totalPriceTotal, // Ticket Price Total
    '',                    // Trainer Fee % (empty)
    totals.totalTrainerFee // Trainer Fee Amount
  ]);

  // Calculate adjusted trainer fee and expenses
  const adjustedCalc = calculateAdjustedTrainerFee(event, expenses, trainerOverride);
  
  // Add expenses section if there are expenses
  if (expenses.length > 0) {
    worksheet.addRow([]); // Empty row
    worksheet.addRow(['Expenses']);
    worksheet.addRow(['Description', 'Amount']);
    
    expenses.forEach(expense => {
      worksheet.addRow([
        expense.Description,
        expense.Amount
      ]);
    });
    
    // Add expenses total
    worksheet.addRow(['Total Expenses', adjustedCalc.totalExpenses]);
    worksheet.addRow(['Margin (Original Fee - Expenses)', adjustedCalc.margin]);
    
    const currentTrainerName = trainerOverride || event.Trainer_1 || '';
    const isAlejandro = currentTrainerName.toLowerCase().includes('alejandro');
    if (isAlejandro) {
      worksheet.addRow(['Trainer Fee %', adjustedCalc.trainerFeePercentage]);
    }
  }
  
  // Add overview section
  worksheet.addRow([]); // Empty row
  worksheet.addRow(['Overview']);
  worksheet.addRow(['Trainer Fee', adjustedCalc.adjustedTrainerFee]);
  worksheet.addRow(['Cash Sales', overview.cashSales]);
  const adjustedBalance = overview.cashSales - adjustedCalc.adjustedTrainerFee;
  const adjustedPayable = adjustedCalc.adjustedTrainerFee - overview.cashSales;
  worksheet.addRow(['Balance', adjustedBalance]);
  worksheet.addRow(['Receivable from Trainer', adjustedPayable]);

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

async function generateCSVExport(event: any, splits: any[], expenses: any[], commissions: any, trainerOverride?: string, filename?: string) {
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

async function generatePDFExport(event: any, splits: any[], expenses: any[], commissions: any, trainerOverride?: string, filename?: string) {
  try {
    const puppeteer = require('puppeteer');
    const fs = require('fs');
    const path = require('path');
    const summaryData = calculateEventSummary(event.tickets);
    
    // Calculate overview metrics and adjusted trainer fee
    const { calculateEventOverview } = require('@/lib/utils');
    const overview = calculateEventOverview(event.tickets, commissions, splits);
    const adjustedCalc = calculateAdjustedTrainerFee(event, expenses, trainerOverride);
    
    // Calculate adjusted balance and payable
    const adjustedBalance = overview.cashSales - adjustedCalc.adjustedTrainerFee;
    const adjustedPayable = adjustedCalc.adjustedTrainerFee - overview.cashSales;
    
    // Calculate totals for grand total row
    const totals = {
      totalQuantity: summaryData.reduce((sum, row) => sum + row.sumQuantity, 0),
      totalPriceTotal: summaryData.reduce((sum, row) => sum + row.sumPriceTotal, 0),
      totalTrainerFee: summaryData.reduce((sum, row) => sum + row.sumTrainerFee, 0)
    };
    
    // Format date properly (remove GMT timezone)
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString('de-DE');
    };
    
    // Convert logo to base64
    let logoBase64 = '';
    try {
      const logoPath = path.join(process.cwd(), 'public', 'logo.png');
      const logoBuffer = fs.readFileSync(logoPath);
      logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
    } catch (logoError) {
      console.warn('Could not load logo for PDF:', logoError instanceof Error ? logoError.message : String(logoError));
    }
    
    // Create HTML content for PDF
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Event Report - ${event.ProdName}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; }
          .logo-container { text-align: center; margin-bottom: 20px; }
          .logo-container img { max-width: 120px; max-height: 80px; object-fit: contain; }
          .title-container { text-align: center; margin-bottom: 30px; }
          h1 { color: #333; border-bottom: 2px solid #333; margin: 0; padding-bottom: 10px; display: inline-block; }
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
        ${logoBase64 ? `
          <div class="logo-container">
            <img src="${logoBase64}" alt="Salsation Logo" />
          </div>
        ` : ''}
        <div class="title-container">
          <h1>Event Report</h1>
        </div>
        
        <div class="info-grid">
          <div class="info-label">ProdID:</div><div>${event.ProdID}</div>
          <div class="info-label">Event Name:</div><div>${event.ProdName}</div>
          <div class="info-label">Date:</div><div>${formatDate(event.EventDate)}</div>
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
          <tfoot style="background-color: #f8f9fa; border-top: 2px solid #dee2e6; font-weight: bold;">
            <tr>
              <td colspan="3" style="text-align: left; padding: 12px 8px;">Grand Total</td>
              <td class="number" style="font-weight: bold;">${totals.totalQuantity}</td>
              <td class="number"></td>
              <td class="number" style="font-weight: bold;">€${totals.totalPriceTotal.toFixed(2)}</td>
              <td class="number"></td>
              <td class="number" style="font-weight: bold; color: #28a745;">€${totals.totalTrainerFee.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
        
        ${expenses.length > 0 ? `
          <h2>Expenses</h2>
          <table style="width: 70%; margin: 20px 0;">
            <thead>
              <tr>
                <th>Description</th>
                <th class="number">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${expenses.map((expense: any) => `
                <tr>
                  <td>${expense.Description}</td>
                  <td class="number">€${expense.Amount.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot style="background-color: #f8f9fa; border-top: 2px solid #dee2e6; font-weight: bold;">
              <tr>
                <td style="text-align: left; padding: 8px;">Total Expenses</td>
                <td class="number" style="font-weight: bold;">€${adjustedCalc.totalExpenses.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="text-align: left; padding: 8px;">Margin (Fee - Expenses)</td>
                <td class="number" style="font-weight: bold;">€${adjustedCalc.margin.toFixed(2)}</td>
              </tr>
              ${(() => {
                const currentTrainerName = trainerOverride || event.Trainer_1 || '';
                const isAlejandro = currentTrainerName.toLowerCase().includes('alejandro');
                return isAlejandro ? `
                  <tr>
                    <td style="text-align: left; padding: 8px;">Trainer Fee %</td>
                    <td class="number" style="font-weight: bold;">${adjustedCalc.trainerFeePercentage.toFixed(1)}%</td>
                  </tr>
                ` : '';
              })()}
            </tfoot>
          </table>
        ` : ''}
        
        <h2>Overview</h2>
        <table style="width: 50%; margin: 20px 0;">
          <tbody>
            <tr>
              <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Trainer Fee</td>
              <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">€${adjustedCalc.adjustedTrainerFee.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Cash Sales</td>
              <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">€${overview.cashSales.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Balance</td>
              <td style="border: 1px solid #ddd; padding: 8px; text-align: right; ${adjustedBalance < 0 ? 'color: #dc3545;' : ''}">€${adjustedBalance.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Receivable from Trainer</td>
              <td style="border: 1px solid #ddd; padding: 8px; text-align: right; font-weight: bold; ${adjustedPayable < 0 ? 'color: #dc3545;' : 'color: #28a745;'}">€${adjustedPayable.toFixed(2)}</td>
            </tr>
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
          Generated on: ${new Date().toLocaleDateString('de-DE')} ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}<br>
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
