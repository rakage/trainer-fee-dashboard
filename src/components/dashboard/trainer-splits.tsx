'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Save } from 'lucide-react';
import { EventDetail, Commission, TrainerSplit } from '@/types';
import { formatCurrency, formatGermanDecimal, parseGermanDecimal, calculateEventOverview } from '@/lib/utils';

interface TrainerSplitsEditorProps {
  eventId: number;
  event: EventDetail;
  commissions: Commission;
}

export function TrainerSplitsEditor({ eventId, event, commissions }: TrainerSplitsEditorProps) {
  const [splits, setSplits] = useState<TrainerSplit[]>([
    {
      ProdID: eventId,
      RowId: 1,
      Name: '',
      Percent: 0,
      TrainerFee: 0,
      CashReceived: 0,
      Payable: 0,
    }
  ]);

  const overview = calculateEventOverview(event.tickets, commissions, splits);
  
  const addRow = () => {
    const newRow: TrainerSplit = {
      ProdID: eventId,
      RowId: splits.length + 1,
      Name: '',
      Percent: 0,
      TrainerFee: 0,
      CashReceived: 0,
      Payable: 0,
    };
    setSplits([...splits, newRow]);
  };

  const removeRow = (index: number) => {
    setSplits(splits.filter((_, i) => i !== index));
  };

  const updateSplit = (index: number, field: keyof TrainerSplit, value: any) => {
    const updatedSplits = splits.map((split, i) => {
      if (i === index) {
        const updated = { ...split, [field]: value };
        
        // Recalculate trainer fee and payable when percent or cash received changes
        if (field === 'Percent' || field === 'CashReceived') {
          updated.TrainerFee = overview.balance * (updated.Percent / 100);
          updated.Payable = updated.TrainerFee - (updated.CashReceived || 0);
        }
        
        return updated;
      }
      return split;
    });
    setSplits(updatedSplits);
  };

  const totalPercent = splits.reduce((sum, split) => sum + (split.Percent || 0), 0);
  const isValidTotal = totalPercent <= 100;

  const handleSave = async () => {
    try {
      const response = await fetch(`/api/events/${eventId}/splits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ splits }),
      });

      if (response.ok) {
        // Show success message
        console.log('Splits saved successfully');
      } else {
        // Show error message
        console.error('Failed to save splits');
      }
    } catch (error) {
      console.error('Error saving splits:', error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <span>Trainer Splits</span>
          <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
            Blue Cells
          </span>
        </CardTitle>
        <CardDescription>
          Manage trainer fee splits for shared events. Percentages must not exceed 100%.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Percentage (%)</TableHead>
                <TableHead className="text-right">Trainer Fee</TableHead>
                <TableHead className="text-right">Cash Received</TableHead>
                <TableHead className="text-right">Payable</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {splits.map((split, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Input
                      value={split.Name}
                      onChange={(e) => updateSplit(index, 'Name', e.target.value)}
                      placeholder="Trainer name"
                      className="min-w-[150px]"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="text"
                      value={formatGermanDecimal(split.Percent)}
                      onChange={(e) => updateSplit(index, 'Percent', parseGermanDecimal(e.target.value))}
                      placeholder="0,0"
                      className="w-20 text-right bg-blue-50"
                    />
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(overview.balance * (split.Percent / 100))}
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="text"
                      value={formatGermanDecimal(split.CashReceived || 0)}
                      onChange={(e) => updateSplit(index, 'CashReceived', parseGermanDecimal(e.target.value))}
                      placeholder="0,00"
                      className="w-24 text-right bg-blue-50"
                    />
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency((overview.balance * (split.Percent / 100)) - (split.CashReceived || 0))}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeRow(index)}
                      disabled={splits.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center space-x-4">
            <Button variant="outline" onClick={addRow}>
              <Plus className="h-4 w-4 mr-2" />
              Add Row
            </Button>
            <Button onClick={handleSave}>
              <Save className="h-4 w-4 mr-2" />
              Save Splits
            </Button>
          </div>
          
          <div className="text-sm">
            <span className={`font-medium ${!isValidTotal ? 'text-destructive' : ''}`}>
              Total: {formatGermanDecimal(totalPercent)}%
            </span>
            {!isValidTotal && (
              <span className="text-destructive ml-2">(Exceeds 100%)</span>
            )}
          </div>
        </div>

        {!isValidTotal && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
            <p className="text-sm text-destructive">
              <strong>Warning:</strong> Total percentage cannot exceed 100%. Please adjust the values.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
