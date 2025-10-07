'use client';

import { SupportedCurrency } from '@/types';
import { getCurrencyOptions } from '@/lib/currency';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface CurrencySelectorProps {
  value: SupportedCurrency;
  onChange: (currency: SupportedCurrency) => void;
  eventCurrency?: string;
}

export function CurrencySelector({ value, onChange, eventCurrency }: CurrencySelectorProps) {
  const options = getCurrencyOptions();

  return (
    <div className="space-y-2">
      <Label htmlFor="currency-select">Display Currency</Label>
      <Select value={value} onValueChange={(val) => onChange(val as SupportedCurrency)}>
        <SelectTrigger id="currency-select" className="w-[240px]">
          <SelectValue placeholder="Select currency" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
              {eventCurrency === option.value && ' (Event Default)'}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        {eventCurrency && eventCurrency !== value && (
          <>Event data is in {eventCurrency}, amounts will be converted to {value}</>
        )}
      </p>
    </div>
  );
}
