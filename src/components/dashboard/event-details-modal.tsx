'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useQuery } from '@tanstack/react-query';
import { formatCurrency } from '@/lib/utils';

interface EventDetailsModalProps {
  prodid: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface EventDetails {
  prodid: number;
  prodname: string;
  maintrainer: string;
  location: string | null;
  country: string;
  status: string;
}

interface Ticket {
  OrderID: number;
  DatePaid: string;
  EventDate: string;
  Customer: string;
  CustomerID: number;
  UnitPrice: number;
  PriceTotal: number;
  quantity: number;
  PaymentMethod: string;
  Attendance: string;
  TierLevel: string | null;
}

export function EventDetailsModal({ prodid, open, onOpenChange }: EventDetailsModalProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['event-details', prodid],
    queryFn: async () => {
      if (!prodid) return null;
      const response = await fetch(`/api/trainers-events/${prodid}`);
      if (!response.ok) throw new Error('Failed to fetch event details');
      return await response.json();
    },
    enabled: open && !!prodid,
  });

  const eventDetails: EventDetails | null = data?.eventDetails || null;
  const tickets: Ticket[] = data?.tickets || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Event Details</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : error ? (
          <div className="text-red-500">Failed to load event details</div>
        ) : eventDetails ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Product ID</h3>
                <p className="text-lg font-mono">{eventDetails.prodid}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Status</h3>
                <Badge
                  variant={eventDetails.status === 'Active' ? 'default' : 'destructive'}
                  className="mt-1"
                >
                  {eventDetails.status}
                </Badge>
              </div>
              <div className="col-span-2">
                <h3 className="text-sm font-medium text-muted-foreground">Product Name</h3>
                <p className="text-lg">{eventDetails.prodname}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Main Trainer</h3>
                <p className="text-lg font-medium">{eventDetails.maintrainer}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Country</h3>
                <p className="text-lg">{eventDetails.country}</p>
              </div>
              <div className="col-span-2">
                <h3 className="text-sm font-medium text-muted-foreground">Location</h3>
                <p className="text-lg">
                  {eventDetails.location || <span className="text-muted-foreground">N/A</span>}
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Tickets ({tickets.length})</h3>
              {tickets.length > 0 ? (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order ID</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Date Paid</TableHead>
                        <TableHead>Event Date</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead className="text-right">Price Total</TableHead>
                        <TableHead>Payment Method</TableHead>
                        <TableHead>Attendance</TableHead>
                        <TableHead>Tier Level</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tickets.map((ticket, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-mono">{ticket.OrderID}</TableCell>
                          <TableCell>
                            <div className="max-w-[200px] truncate">{ticket.Customer}</div>
                          </TableCell>
                          <TableCell>{new Date(ticket.DatePaid).toLocaleDateString()}</TableCell>
                          <TableCell>{new Date(ticket.EventDate).toLocaleDateString()}</TableCell>
                          <TableCell className="text-right">{ticket.quantity}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(ticket.PriceTotal)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{ticket.PaymentMethod}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={ticket.Attendance === 'Attended' ? 'default' : 'secondary'}
                            >
                              {ticket.Attendance}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {ticket.TierLevel || <span className="text-muted-foreground">-</span>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-muted-foreground">No tickets found</p>
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
