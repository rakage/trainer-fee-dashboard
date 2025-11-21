'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Save } from 'lucide-react';
import { EventDetail, Expense, SupportedCurrency } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { formatCurrencyAmount, getCurrencyOptions } from '@/lib/currency';

interface ExpensesEditorProps {
  eventId: number;
  event: EventDetail;
  trainerFee: number;
  trainerName?: string;
  onExpensesChange?: (totalExpenses: number) => void;
  onTrainerFeeTotalChange?: (trainerFeeTotal: number) => void;
  displayCurrency?: SupportedCurrency;
}

export function ExpensesEditor({ eventId, event, trainerFee, trainerName, onExpensesChange, onTrainerFeeTotalChange, displayCurrency }: ExpensesEditorProps) {
  const [expenses, setExpenses] = useState<Expense[]>([
    {
      ProdID: eventId,
      RowId: 1,
      Description: '',
      Currency: (event.Currency as SupportedCurrency) || 'EUR',
      Amount: 0,
    }
  ]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [amountDisplays, setAmountDisplays] = useState<string[]>(['0,00']);
  const [trainerFeePercentage, setTrainerFeePercentage] = useState<number>(0);
  const [trainerFeePercentageDisplay, setTrainerFeePercentageDisplay] = useState<string>('0,0');
  const [isPercentageInitialized, setIsPercentageInitialized] = useState(false);

  // Use display currency for formatting
  const targetCurrency = displayCurrency || (event.Currency as SupportedCurrency) || 'EUR';

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

  // Check if trainer is Alejandro
  const currentTrainerName = trainerName || event.Trainer_1 || '';
  const isAlejandro = currentTrainerName.toLowerCase().includes('alejandro');

  // Calculate default trainer fee percentage from attended tickets (only for Alejandro)
  const attendedTickets = event.tickets?.filter(ticket => ticket.Attendance === 'Attended') || [];
  const calculatedPercentage = isAlejandro && attendedTickets.length > 0 
    ? attendedTickets.reduce((sum, ticket) => sum + (ticket.TrainerFeePct || 0) * ticket.PriceTotal, 0) / 
      attendedTickets.reduce((sum, ticket) => sum + ticket.PriceTotal, 0) * 100
    : 0;

  // Initialize percentage from calculated value (only once and only for Alejandro)
  React.useEffect(() => {
    if (isAlejandro && !isPercentageInitialized && calculatedPercentage > 0) {
      setTrainerFeePercentage(calculatedPercentage);
      setTrainerFeePercentageDisplay(calculatedPercentage.toFixed(1).replace('.', ','));
      setIsPercentageInitialized(true);
    } else if (!isAlejandro && !isPercentageInitialized) {
      // For non-Alejandro trainers, set to 100% by default
      setTrainerFeePercentage(100);
      setTrainerFeePercentageDisplay('100,0');
      setIsPercentageInitialized(true);
    }
  }, [calculatedPercentage, isPercentageInitialized, isAlejandro]);

  // Calculate total expenses and notify parent
  const totalExpenses = expenses.reduce((sum, expense) => sum + (expense.Amount || 0), 0);
  const margin = trainerFee - totalExpenses;
  const trainerFeeTotal = margin * (trainerFeePercentage / 100);

  useEffect(() => {
    onExpensesChange?.(totalExpenses);
  }, [totalExpenses, onExpensesChange]);

  useEffect(() => {
    onTrainerFeeTotalChange?.(trainerFeeTotal);
  }, [trainerFeeTotal, onTrainerFeeTotalChange]);

  const addRow = () => {
    const newRow: Expense = {
      ProdID: eventId,
      RowId: expenses.length + 1,
      Description: '',
      Currency: (event.Currency as SupportedCurrency) || 'EUR',
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

  const handleTrainerFeePercentageChange = (value: string) => {
    // Update display value immediately (allows free typing)
    setTrainerFeePercentageDisplay(value);
  };

  const handleTrainerFeePercentageBlur = (value: string) => {
    // Parse and update actual percentage value on blur
    const numValue = parseFloat(value.replace(',', '.'));
    const validValue = isNaN(numValue) ? 0 : Math.max(0, Math.min(100, numValue)); // Clamp between 0-100
    setTrainerFeePercentage(validValue);
    
    // Format the display value properly
    const formattedValue = validValue.toFixed(1).replace('.', ',');
    setTrainerFeePercentageDisplay(formattedValue);
  };

  const resetToCalculatedPercentage = () => {
    setTrainerFeePercentage(calculatedPercentage);
    setTrainerFeePercentageDisplay(calculatedPercentage.toFixed(1).replace('.', ','));
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
                  <TableHead className="w-[140px]">Currency</TableHead>
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
                    <TableCell>
                      <Select
                        value={expense.Currency || 'EUR'}
                        onValueChange={(value) => updateExpense(index, 'Currency', value as SupportedCurrency)}
                      >
                        <SelectTrigger className="w-[120px]">
                          <SelectValue placeholder="Currency" />
                        </SelectTrigger>
                        <SelectContent>
                          {getCurrencyOptions().map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeRow(index)}
                        disabled={expenses.length === 1}
                        className="relative z-20"
                        title={expenses.length === 1 ? "Cannot delete the last expense row" : "Delete expense"}
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
            <Button type="button" variant="outline" onClick={addRow}>
              <Plus className="h-4 w-4 mr-2" />
              Add Expense
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Expenses'}
            </Button>
          </div>
          
          <div className="text-sm space-y-2">
            <div className="flex justify-between items-center min-w-[250px]">
              <span>Total Expenses:</span>
              <span className="font-medium text-red-600">{formatCurrencyAmount(totalExpenses, targetCurrency)}</span>
            </div>
            <div className="flex justify-between items-center min-w-[250px] pt-1 border-t">
              <span className="font-semibold">Margin:</span>
              <span className={`font-bold ${margin < 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatCurrencyAmount(margin, targetCurrency)}
              </span>
            </div>
            {isAlejandro && (
              <div className="flex justify-between items-center min-w-[250px]">
                <span className="font-semibold">Trainer Fee %:</span>
                <div className="flex items-center space-x-1">
                  <Input
                    type="text"
                    value={trainerFeePercentageDisplay}
                    onChange={(e) => handleTrainerFeePercentageChange(e.target.value)}
                    onBlur={(e) => handleTrainerFeePercentageBlur(e.target.value)}
                    placeholder="0,0"
                    className="w-16 text-right text-sm"
                    title={`Manually editable. Default from tickets: ${calculatedPercentage.toFixed(1)}%`}
                  />
                  <span className="text-xs">%</span>
                  {calculatedPercentage > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={resetToCalculatedPercentage}
                      className="h-6 w-6 p-0 text-xs"
                      title={`Reset to calculated value: ${calculatedPercentage.toFixed(1)}%`}
                    >
                      ↻
                    </Button>
                  )}
                </div>
              </div>
            )}
            <div className="flex justify-between items-center min-w-[250px] pt-1 border-t">
              <span className="font-semibold">Trainer Fee Total:</span>
              <span className={`font-bold ${trainerFeeTotal < 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatCurrencyAmount(trainerFeeTotal, targetCurrency)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
