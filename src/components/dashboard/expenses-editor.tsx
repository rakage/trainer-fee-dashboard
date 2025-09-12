'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Save } from 'lucide-react';
import { EventDetail, Expense } from '@/types';
import { formatCurrency } from '@/lib/utils';

interface ExpensesEditorProps {
  eventId: number;
  event: EventDetail;
  trainerFee: number;
  onExpensesChange?: (totalExpenses: number) => void;
}

export function ExpensesEditor({ eventId, event, trainerFee, onExpensesChange }: ExpensesEditorProps) {
  const [expenses, setExpenses] = useState<Expense[]>([
    {
      ProdID: eventId,
      RowId: 1,
      Description: '',
      Amount: 0,
    }
  ]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [amountDisplays, setAmountDisplays] = useState<string[]>(['0,00']);

  // Load existing expenses when component mounts
  useEffect(() => {
    const loadExpenses = async () => {
      try {
        const response = await fetch(`/api/events/${eventId}/expenses`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data.expenses && data.data.expenses.length > 0) {
            setExpenses(data.data.expenses);
            // Set display values for loaded expenses
            const displays = data.data.expenses.map((exp: any) => 
              (exp.Amount || 0).toFixed(2).replace('.', ',')
            );
            setAmountDisplays(displays);
          }
        }
      } catch (error) {
        console.error('Failed to load expenses:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadExpenses();
  }, [eventId]);

  // Calculate total expenses and notify parent
  const totalExpenses = expenses.reduce((sum, expense) => sum + (expense.Amount || 0), 0);
  const margin = trainerFee - totalExpenses;

  useEffect(() => {
    onExpensesChange?.(totalExpenses);
  }, [totalExpenses, onExpensesChange]);

  const addRow = () => {
    const newRow: Expense = {
      ProdID: eventId,
      RowId: expenses.length + 1,
      Description: '',
      Amount: 0,
    };
    setExpenses([...expenses, newRow]);
    setAmountDisplays([...amountDisplays, '0,00']);
  };

  const removeRow = (index: number) => {
    setExpenses(expenses.filter((_, i) => i !== index));
    setAmountDisplays(amountDisplays.filter((_, i) => i !== index));
  };

  const updateExpense = (index: number, field: keyof Expense, value: any) => {
    const updatedExpenses = expenses.map((expense, i) => {
      if (i === index) {
        return { ...expense, [field]: value };
      }
      return expense;
    });
    setExpenses(updatedExpenses);
  };

  const handleAmountChange = (index: number, value: string) => {
    // Update display value immediately (allows free typing)
    const newDisplays = [...amountDisplays];
    newDisplays[index] = value;
    setAmountDisplays(newDisplays);
  };

  const handleAmountBlur = (index: number, value: string) => {
    // Parse and update actual amount value on blur
    const numValue = parseFloat(value.replace(',', '.')) || 0;
    updateExpense(index, 'Amount', numValue);
    
    // Format the display value properly
    const formattedValue = numValue.toFixed(2).replace('.', ',');
    const newDisplays = [...amountDisplays];
    newDisplays[index] = formattedValue;
    setAmountDisplays(newDisplays);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/events/${eventId}/expenses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ expenses }),
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        alert('Expenses saved successfully!');
      } else {
        alert(`Failed to save expenses: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error saving expenses:', error);
      alert('Error saving expenses. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Expenses</CardTitle>
          <CardDescription>Loading expenses...</CardDescription>
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
        <CardTitle>Expenses</CardTitle>
        <CardDescription>
          Manage expenses related to this event. These will be deducted from trainer fee to calculate margin.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border rounded-lg">
          <div className="max-h-96 overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-white z-10">
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Input
                        value={expense.Description}
                        onChange={(e) => updateExpense(index, 'Description', e.target.value)}
                        placeholder="Expense description"
                        className="min-w-[200px]"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end">
                        <Input
                          type="text"
                          value={amountDisplays[index] || '0,00'}
                          onChange={(e) => handleAmountChange(index, e.target.value)}
                          onBlur={(e) => handleAmountBlur(index, e.target.value)}
                          placeholder="0,00"
                          className="w-24 text-right text-sm"
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeRow(index)}
                        disabled={expenses.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center space-x-4">
            <Button variant="outline" onClick={addRow}>
              <Plus className="h-4 w-4 mr-2" />
              Add Expense
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Expenses'}
            </Button>
          </div>
          
          <div className="text-sm space-y-1">
            <div className="flex justify-between items-center min-w-[200px]">
              <span>Total Expenses:</span>
              <span className="font-medium text-red-600">{formatCurrency(totalExpenses)}</span>
            </div>
            <div className="flex justify-between items-center min-w-[200px] pt-1 border-t">
              <span className="font-semibold">Margin:</span>
              <span className={`font-bold ${margin < 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatCurrency(margin)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
