'use client';

import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { EventDetail, EventListResponse, ApiResponse } from '@/types';
import { cn } from '@/lib/utils';

interface EventPickerProps {
  onEventSelect: (event: EventDetail | null) => void;
}

export function EventPicker({ onEventSelect }: EventPickerProps) {
  const [searchText, setSearchText] = useState('');
  const [events, setEvents] = useState<EventListResponse[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventDetail | null>(null);

  const fetchEvents = async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setEvents([]);
      setShowDropdown(false);
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch(`/api/events?q=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error('Failed to fetch events');
      
      const data: ApiResponse<EventListResponse[]> = await response.json();
      if (data.success) {
        setEvents(data.data || []);
        setShowDropdown((data.data || []).length > 0);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
      setEvents([]);
      setShowDropdown(false);
    } finally {
      setLoading(false);
    }
  };

  const fetchEventDetail = async (prodId: number) => {
    try {
      const response = await fetch(`/api/events/${prodId}`);
      if (!response.ok) throw new Error('Failed to fetch event details');
      
      const data: ApiResponse<{ event: EventDetail }> = await response.json();
      if (data.success && data.data) {
        setSelectedEvent(data.data.event);
        onEventSelect(data.data.event);
      }
    } catch (error) {
      console.error('Error fetching event details:', error);
    }
  };

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchEvents(searchText);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchText]);

  const handleEventSelect = (event: EventListResponse) => {
    setSearchText(`${event.ProdID} - ${event.ProdName}`);
    setShowDropdown(false);
    fetchEventDetail(event.ProdID);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchText(value);
    
    // Clear selection if user starts typing a new search
    if (selectedEvent && !value.includes(selectedEvent.ProdID.toString())) {
      setSelectedEvent(null);
      onEventSelect(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">
          Search Event
        </label>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Type event ID or name to search..."
            value={searchText}
            onChange={handleInputChange}
            className="pl-10 h-12"
            disabled={loading}
          />
          
          {showDropdown && (
            <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-64 overflow-auto">
              {loading ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  Searching...
                </div>
              ) : events.length > 0 ? (
                <div className="py-1">
                  {events.map((event) => (
                    <button
                      key={event.ProdID}
                      onClick={() => handleEventSelect(event)}
                      className="w-full text-left px-3 py-3 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none border-b border-gray-100 last:border-b-0"
                    >
                      <div className="flex flex-col space-y-1">
                        <span className="font-medium text-sm">
                          {event.ProdID} - {event.ProdName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(event.EventDate).toLocaleDateString()}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  No events found.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

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
                {new Date(selectedEvent.EventDate).toLocaleDateString()}
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
