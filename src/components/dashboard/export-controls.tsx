'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Download, FileSpreadsheet, FileText, File } from 'lucide-react';
import { Commission, ExportFormat } from '@/types';
import { useSession } from 'next-auth/react';

interface ExportControlsProps {
  eventId: number;
  trainerOverride?: string;
  commissions: Commission;
}

export function ExportControls({ eventId, trainerOverride, commissions }: ExportControlsProps) {
  const { data: session } = useSession();
  const [isExporting, setIsExporting] = useState(false);

  const canExport = session?.user?.role !== 'viewer';

  const handleExport = async (format: ExportFormat) => {
    if (!canExport) return;
    
    setIsExporting(true);
    try {
      const response = await fetch(`/api/events/${eventId}/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          format,
          trainerOverride,
          commissions,
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `event-${eventId}-report.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        console.error('Export failed');
      }
    } catch (error) {
      console.error('Export error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  if (!canExport) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Export Report</CardTitle>
          <CardDescription>
            Export functionality is not available for your role.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            Contact your administrator for export permissions.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Export Report</CardTitle>
        <CardDescription>
          Generate reports in various formats with current settings
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => handleExport('xlsx')}
            disabled={isExporting}
            className="flex items-center space-x-2"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Export XLSX</span>
          </Button>

          <Button
            variant="outline"
            onClick={() => handleExport('csv')}
            disabled={isExporting}
            className="flex items-center space-x-2"
          >
            <FileText className="h-4 w-4" />
            <span>Export CSV</span>
          </Button>

          <Button
            variant="outline"
            onClick={() => handleExport('pdf')}
            disabled={isExporting}
            className="flex items-center space-x-2"
          >
            <File className="h-4 w-4" />
            <span>Export PDF</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" disabled={isExporting}>
                <Download className="h-4 w-4 mr-2" />
                More Options
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleExport('xlsx')}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Excel with formatting
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('csv')}>
                <FileText className="h-4 w-4 mr-2" />
                CSV for analysis
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('pdf')}>
                <File className="h-4 w-4 mr-2" />
                PDF report
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {isExporting && (
          <div className="mt-4 text-sm text-muted-foreground">
            Generating export file... Please wait.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
