'use client';

import { useState, useEffect } from 'react';
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load existing splits when component mounts
  useEffect(() => {
    const loadSplits = async () => {
      try {
        const response = await fetch(`/api/events/${eventId}/splits`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data.splits && data.data.splits.length > 0) {
            setSplits(data.data.splits);
          }
        }
      } catch (error) {
        console.error('Failed to load trainer splits:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadSplits();
  }, [eventId]);

  const overview = calculateEventOverview(event.tickets, commissions, splits, event.Trainer_1);
  
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
        
        // Recalculate payable when trainer fee or cash received changes
        if (field === 'TrainerFee' || field === 'CashReceived') {
          updated.Payable = (updated.TrainerFee || 0) - (updated.CashReceived || 0);
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
    setSaving(true);
    try {
      const response = await fetch(`/api/events/${eventId}/splits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ splits }),
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        // Show success message
        alert('Splits saved successfully!');
      } else {
        // Show error message
        alert(`Failed to save splits: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error saving splits:', error);
      alert('Error saving splits. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Trainer Splits</CardTitle>
          <CardDescription>Loading trainer splits...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/4"></div>
            <div className="h-32 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trainer Splits</CardTitle>
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
                    <div className="flex justify-end">
                      <Input
                        type="text"
                        value={split.Percent.toString().replace('.', ',')}
                        onChange={(e) => {
                          const value = e.target.value;
                          const numValue = parseFloat(value.replace(',', '.')) || 0;
                          updateSplit(index, 'Percent', numValue);
                        }}
                        placeholder="0,0"
                        className="w-16 text-right bg-blue-50 text-sm"
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end">
                      <Input
                        type="text"
                        value={(split.TrainerFee || 0).toFixed(2).replace('.', ',')}
                        onChange={(e) => {
                          const value = e.target.value;
                          const numValue = parseFloat(value.replace(',', '.')) || 0;
                          updateSplit(index, 'TrainerFee', numValue);
                        }}
                        placeholder="0,00"
                        className="w-24 text-right bg-blue-50 text-sm"
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end">
                      <Input
                        type="text"
                        value={(split.CashReceived || 0).toFixed(2).replace('.', ',')}
                        onChange={(e) => {
                          const value = e.target.value;
                          const numValue = parseFloat(value.replace(',', '.')) || 0;
                          updateSplit(index, 'CashReceived', numValue);
                        }}
                        placeholder="0,00"
                        className="w-20 text-right bg-blue-50 text-sm"
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency((split.TrainerFee || 0) - split.CashReceived)}
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
            <Button onClick={handleSave} disabled={saving || !isValidTotal}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Splits'}
            </Button>
          </div>
          
          <div className="text-sm">
            <span className={`font-medium ${!isValidTotal ? 'text-destructive' : ''}`}>
              Total: {totalPercent.toFixed(1).replace('.', ',')}%
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
