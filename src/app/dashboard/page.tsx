'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/layout';
import { EventPicker } from '@/components/dashboard/event-picker';
import { EventOverviewCards } from '@/components/dashboard/overview-cards';
import { EventDataTable } from '@/components/dashboard/data-table';
import { TrainerSplitsEditor } from '@/components/dashboard/trainer-splits';
import { ExpensesEditor } from '@/components/dashboard/expenses-editor';
import { ExportControls } from '@/components/dashboard/export-controls';
import { EventReportSkeleton, NoEventFound } from '@/components/dashboard/event-report-skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EventDetail, Commission } from '@/types';
import { parseGermanDecimal, formatGermanDecimal, getCustomTrainerFee } from '@/lib/utils';

export default function DashboardPage() {
  const [selectedEvent, setSelectedEvent] = useState<EventDetail | null>(null);
  const [trainerOverride, setTrainerOverride] = useState('');
  const [isLoadingEvent, setIsLoadingEvent] = useState(false);
  const [eventError, setEventError] = useState<string | null>(null);
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
            <EventPicker 
              onEventSelect={handleEventSelect}
              onLoadingChange={setIsLoadingEvent}
              onErrorChange={setEventError}
            />
            
            {selectedEvent && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <Label htmlFor="trainer-override">Trainer Name</Label>
                  <Input
                    id="trainer-override"
                    value={trainerOverride}
                    onChange={(e) => setTrainerOverride(e.target.value)}
                    placeholder="Override trainer name"
                  />
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

        {/* Show loading skeleton while fetching event details */}
        {isLoadingEvent && <EventReportSkeleton />}
        
        {/* Show error state if event not found */}
        {eventError && !isLoadingEvent && <NoEventFound />}
        
        {/* Show event details when loaded successfully */}
        {selectedEvent && !isLoadingEvent && !eventError && (
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
              trainerName={trainerOverride || selectedEvent.Trainer_1}
            />

            {/* Tickets Table */}
            <Card>
              <CardHeader>
                <CardTitle>Event Tickets</CardTitle>
                <CardDescription>
                  Ticket sales data with calculated trainer fees based on fee parameters.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedEvent.tickets && selectedEvent.tickets.length > 0 ? (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="text-left py-3 px-4 font-medium text-gray-900">Attendance</th>
                            <th className="text-left py-3 px-4 font-medium text-gray-900">Payment Method</th>
                            <th className="text-left py-3 px-4 font-medium text-gray-900">Tier Level</th>
                            <th className="text-right py-3 px-4 font-medium text-gray-900">Quantity</th>
                            <th className="text-right py-3 px-4 font-medium text-gray-900">Ticket Price</th>
                            <th className="text-right py-3 px-4 font-medium text-gray-900">Ticket Price Total</th>
                            <th className="text-right py-3 px-4 font-medium text-gray-900">Trainer Fee %</th>
                            <th className="text-right py-3 px-4 font-medium text-gray-900">Trainer Fee Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {selectedEvent.tickets.map((ticket, index) => {
                            const currentTrainerName = trainerOverride || selectedEvent.Trainer_1 || '';
                            const isAlejandro = currentTrainerName.toLowerCase().includes('alejandro');
                            
                            // For Alejandro: show original percentage but calculate amount as 100%
                            const trainerFeePercentage = isAlejandro 
                              ? (ticket.TrainerFeePct || 0) // Show original percentage from query
                              : getCustomTrainerFee(currentTrainerName, ticket).percentage;
                              
                            const trainerFeeAmount = isAlejandro
                              ? ticket.PriceTotal // 100% of ticket price for Alejandro
                              : getCustomTrainerFee(currentTrainerName, ticket).amount;
                            return (
                              <tr key={index} className="hover:bg-gray-50">
                                <td className="py-3 px-4">
                                  <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                                    ticket.Attendance === 'Attended' 
                                      ? 'bg-green-100 text-green-800' 
                                      : 'bg-gray-100 text-gray-800'
                                  }`}>
                                    {ticket.Attendance}
                                  </span>
                                </td>
                                <td className="py-3 px-4">
                                  <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                                    ticket.PaymentMethod === 'Paypal' 
                                      ? 'bg-blue-100 text-blue-800'
                                      : ticket.PaymentMethod === 'Cash'
                                      ? 'bg-yellow-100 text-yellow-800'
                                      : 'bg-gray-100 text-gray-800'
                                  }`}>
                                    {ticket.PaymentMethod}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-gray-900">{ticket.TierLevel}</td>
                                <td className="py-3 px-4 text-right text-gray-900">{ticket.Quantity}</td>
                                <td className="py-3 px-4 text-right font-medium text-gray-900">
                                  €{ticket.UnitPrice.toFixed(2)}
                                </td>
                                <td className="py-3 px-4 text-right font-medium text-gray-900">
                                  €{ticket.PriceTotal.toFixed(2)}
                                </td>
                                <td className="py-3 px-4 text-right text-gray-900">
                                  {(trainerFeePercentage * 100).toFixed(1)}%
                                </td>
                                <td className="py-3 px-4 text-right font-medium text-green-600">
                                  €{trainerFeeAmount.toFixed(2)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="bg-gray-50 border-t">
                          <tr>
                            <td colSpan={4} className="py-3 px-4 font-medium text-gray-900">Totals</td>
                            <td className="py-3 px-4"></td>
                            <td className="py-3 px-4 text-right font-bold text-gray-900">
                              €{selectedEvent.tickets.reduce((sum, ticket) => sum + ticket.PriceTotal, 0).toFixed(2)}
                            </td>
                            <td className="py-3 px-4"></td>
                            <td className="py-3 px-4 text-right font-bold text-green-600">
                              €{(() => {
                                const currentTrainerName = trainerOverride || selectedEvent.Trainer_1 || '';
                                
                                return selectedEvent.tickets.reduce((sum, ticket) => {
                                  const { amount } = getCustomTrainerFee(currentTrainerName, ticket);
                                  return sum + amount;
                                }, 0).toFixed(2);
                              })()}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No ticket data available for this event.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Expenses Editor */}
            <ExpensesEditor
              eventId={selectedEvent.ProdID}
              event={selectedEvent}
              trainerFee={(() => {
                const currentTrainerName = trainerOverride || selectedEvent.Trainer_1 || '';
                return selectedEvent.tickets.reduce((sum, ticket) => {
                  const { amount } = getCustomTrainerFee(currentTrainerName, ticket);
                  return sum + amount;
                }, 0);
              })()}
            />
            
            {/* Trainer Splits Editor */}
            <TrainerSplitsEditor
              eventId={selectedEvent.ProdID}
              event={selectedEvent}
              commissions={commissions}
            />
          </>
        )}

        {/* Show empty state when no event selected and not loading */}
        {!selectedEvent && !isLoadingEvent && !eventError && (
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
