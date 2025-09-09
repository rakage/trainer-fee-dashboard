'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { EventDetail, EventListResponse, ApiResponse } from '@/types';
import { cn, debounce } from '@/lib/utils';

interface EventPickerProps {
  onEventSelect: (event: EventDetail | null) => void;
}

// API functions
async function fetchEvents(query?: string): Promise<EventListResponse[]> {
  const url = query 
    ? `/api/events?q=${encodeURIComponent(query)}` 
    : '/api/events';
    
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch events');
  }
  
  const data: ApiResponse<EventListResponse[]> = await response.json();
  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch events');
  }
  
  return data.data || [];
}

async function fetchEventDetail(prodId: number): Promise<EventDetail> {
  const response = await fetch(`/api/events/${prodId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch event details');
  }
  
  const data: ApiResponse<{ event: EventDetail }> = await response.json();
  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch event details');
  }
  
  return data.data!.event;
}

export function EventPicker({ onEventSelect }: EventPickerProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);

  // Debounced search query for API calls
  const [debouncedQuery, setDebouncedQuery] = useState('');
  
  const debouncedSetQuery = useMemo(
    () => debounce((query: string) => setDebouncedQuery(query), 300),
    []
  );

  // Update debounced query when search changes
  useState(() => {
    debouncedSetQuery(searchQuery);
  });

  // Fetch events based on search query
  const { data: events = [], isLoading, error } = useQuery({
    queryKey: ['events', debouncedQuery],
    queryFn: () => fetchEvents(debouncedQuery || undefined),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch selected event details
  const { data: selectedEvent } = useQuery({
    queryKey: ['event-detail', selectedEventId],
    queryFn: () => selectedEventId ? fetchEventDetail(selectedEventId) : null,
    enabled: !!selectedEventId,
    onSuccess: (event) => {
      onEventSelect(event);
    },
  });

  const handleEventSelect = (eventId: number) => {
    setSelectedEventId(eventId);
    setOpen(false);
  };

  const selectedEventFromList = events.find(e => e.ProdID === selectedEventId);

  return (
    <div className="space-y-2">
      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search events by name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-[300px] justify-between"
            >
              {selectedEventFromList ? (
                <span className="truncate">
                  {selectedEventFromList.ProdID} - {selectedEventFromList.ProdName}
                </span>
              ) : (
                "Select event..."
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[400px] p-0">
            <Command>
              <CommandInput placeholder="Search events..." />
              <CommandList>
                <CommandEmpty>
                  {isLoading ? "Loading events..." : "No events found."}
                </CommandEmpty>
                <CommandGroup>
                  {events.map((event) => (
                    <CommandItem
                      key={event.ProdID}
                      onSelect={() => handleEventSelect(event.ProdID)}
                      className="flex items-start space-x-2 py-2"
                    >
                      <Check
                        className={cn(
                          "mt-1 h-4 w-4",
                          selectedEventId === event.ProdID ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">
                          ID: {event.ProdID}
                        </div>
                        <div className="text-sm text-muted-foreground truncate">
                          {event.ProdName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(event.EventDate).toLocaleDateString('de-DE')}
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {error && (
        <div className="text-sm text-destructive">
          Error loading events: {error.message}
        </div>
      )}

      {selectedEvent && (
        <div className="p-4 bg-muted rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium">Event:</span>
              <div className="text-muted-foreground">{selectedEvent.ProdName}</div>
            </div>
            <div>
              <span className="font-medium">Date:</span>
              <div className="text-muted-foreground">
                {new Date(selectedEvent.EventDate).toLocaleDateString('de-DE')}
              </div>
            </div>
            <div>
              <span className="font-medium">Location:</span>
              <div className="text-muted-foreground">
                {selectedEvent.Venue}, {selectedEvent.Country}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
