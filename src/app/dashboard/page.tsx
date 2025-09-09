'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/layout';
import { EventPicker } from '@/components/dashboard/event-picker';
import { EventOverviewCards } from '@/components/dashboard/overview-cards';
import { EventDataTable } from '@/components/dashboard/data-table';
import { TrainerSplitsEditor } from '@/components/dashboard/trainer-splits';
import { ExportControls } from '@/components/dashboard/export-controls';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EventDetail, Commission } from '@/types';
import { parseGermanDecimal, formatGermanDecimal } from '@/lib/utils';

export default function DashboardPage() {
  const [selectedEvent, setSelectedEvent] = useState<EventDetail | null>(null);
  const [trainerOverride, setTrainerOverride] = useState('');
  const [commissions, setCommissions] = useState<Commission>({
    grace: 0,
    nanna: 0,
  });

  const handleEventSelect = (event: EventDetail | null) => {
    setSelectedEvent(event);
    setTrainerOverride(event?.Trainer_1 || '');
  };

  const handleCommissionChange = (field: keyof Commission, value: string) => {
    setCommissions(prev => ({
      ...prev,
      [field]: parseGermanDecimal(value),
    }));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Event Reports Dashboard</h1>
          <p className="text-muted-foreground">
            Select an event to view detailed reports and manage trainer fees.
          </p>
        </div>

        {/* Event Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Event Selection</CardTitle>
            <CardDescription>
              Search and select an event to view its details and manage trainer fees.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <EventPicker onEventSelect={handleEventSelect} />
            
            {selectedEvent && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <Label htmlFor="trainer-override">Trainer Name Override</Label>
                  <Input
                    id="trainer-override"
                    value={trainerOverride}
                    onChange={(e) => setTrainerOverride(e.target.value)}
                    placeholder="Override trainer name"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Leave empty to use default: {selectedEvent.Trainer_1}
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="grace-commission">Grace Commission (€)</Label>
                    <Input
                      id="grace-commission"
                      type="text"
                      value={formatGermanDecimal(commissions.grace || 0)}
                      onChange={(e) => handleCommissionChange('grace', e.target.value)}
                      placeholder="0,00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="nanna-fee">Nanna Fee (€)</Label>
                    <Input
                      id="nanna-fee"
                      type="text"
                      value={formatGermanDecimal(commissions.nanna || 0)}
                      onChange={(e) => handleCommissionChange('nanna', e.target.value)}
                      placeholder="0,00"
                    />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {selectedEvent && (
          <>
            {/* Export Controls */}
            <ExportControls
              eventId={selectedEvent.ProdID}
              trainerOverride={trainerOverride}
              commissions={commissions}
            />

            {/* Overview Cards */}
            <EventOverviewCards
              event={selectedEvent}
              commissions={commissions}
            />

            {/* Data Table */}
            <EventDataTable event={selectedEvent} />

            {/* Trainer Splits Editor */}
            <TrainerSplitsEditor
              eventId={selectedEvent.ProdID}
              event={selectedEvent}
              commissions={commissions}
            />
          </>
        )}

        {!selectedEvent && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold">No Event Selected</h3>
                <p className="text-muted-foreground">
                  Please select an event from the dropdown above to view its details and manage trainer fees.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
