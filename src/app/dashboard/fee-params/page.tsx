'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/dashboard/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, AlertCircle, CheckCircle } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ReportingGroupTab } from '@/components/dashboard/reporting-group-tab';

interface FeeParam {
  id: number;
  program: string;
  category: string;
  venue: string;
  attendance: string;
  percent: number;
  concatKey: string;
}

interface GracePrice {
  id: number;
  eventType: string;
  eventTypeKey: string;
  venue: string | null;
  jpyPrice: number;
  eurPrice: number;
}

interface ReportingGrpParam {
  id: number;
  reportingGroup: string;
  split: string;
  trainerPercent: number;
  alejandroPercent: number;
  price: number | null;
  repeaterPrice: number | null;
}

export default function FeeParamsPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState('fee-params');

  // React Query for fee parameters
  const { data: params = [], isLoading: paramsLoading } = useQuery({
    queryKey: ['fee-params'],
    queryFn: async () => {
      const response = await fetch('/api/fee-params');
      if (!response.ok) throw new Error('Failed to fetch fee parameters');
      const data = await response.json();
      return data.data || [];
    },
  });

  // React Query for grace prices (admin only)
  const { data: gracePrices = [], isLoading: gracePricesLoading } = useQuery({
    queryKey: ['grace-prices'],
    queryFn: async () => {
      const response = await fetch('/api/grace-price');
      if (!response.ok) throw new Error('Failed to fetch grace prices');
      const data = await response.json();
      return data.data || [];
    },
    enabled: session?.user?.role === 'admin', // Only fetch if user is admin
  });

  // React Query for reporting group parameters (admin only)
  const { data: reportingGrpParams = [], isLoading: reportingGrpLoading } = useQuery({
    queryKey: ['param-reporting-grp'],
    queryFn: async () => {
      const response = await fetch('/api/param-reporting-grp');
      if (!response.ok) throw new Error('Failed to fetch reporting group parameters');
      return response.json();
    },
    enabled: session?.user?.role === 'admin', // Only fetch if user is admin
  });

  const loading =
    paramsLoading ||
    (session?.user?.role === 'admin' && (gracePricesLoading || reportingGrpLoading));

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{
    program: string;
    category: string;
    venue: string;
    attendance: string;
    percent: string;
  }>({
    program: '',
    category: '',
    venue: '',
    attendance: '',
    percent: '',
  });

  // Form state
  const [form, setForm] = useState({
    program: '',
    category: '',
    venue: '',
    attendance: '',
    percent: '',
  });

  // Grace Price form state
  const [gracePriceForm, setGracePriceForm] = useState({
    program: '',
    category: '',
    venue: '',
    tierLevel: '',
    jpyPrice: '',
    eurPrice: '',
  });

  // Grace Price edit state
  const [editingGracePriceId, setEditingGracePriceId] = useState<number | null>(null);
  const [editGracePriceForm, setEditGracePriceForm] = useState({
    program: '',
    category: '',
    venue: '',
    tierLevel: '',
    jpyPrice: '',
    eurPrice: '',
  });

  // Reporting Group form state
  const [reportingGrpForm, setReportingGrpForm] = useState({
    reportingGroup: '',
    split: '',
    trainerPercent: '',
    alejandroPercent: '',
    price: '',
    repeaterPrice: '',
  });

  // Reporting Group edit state
  const [editingReportingGrpId, setEditingReportingGrpId] = useState<number | null>(null);
  const [editReportingGrpForm, setEditReportingGrpForm] = useState({
    reportingGroup: '',
    split: '',
    trainerPercent: '',
    alejandroPercent: '',
    price: '',
    repeaterPrice: '',
  });

  // Manual input state
  const [manualInputs, setManualInputs] = useState({
    program: false,
    category: false,
    venue: false,
    attendance: false,
  });

  // Predefined options
  const programOptions = ['Salsation', 'Choreology', 'Kid', 'Rootz', 'Natasha_Salsation'];
  const categoryOptions = [
    'Instructor training',
    'Workshops',
    'Seminar',
    'Method Training',
    'On Demand',
    'On-Demand',
    'Move Forever Training',
  ];
  const venueOptions = ['Venue', 'Online', 'OnlineGlobal', 'On Demand'];
  const attendanceOptions = ['Attended', 'Unattended'];

  // Grace Price specific options
  const tierLevelOptions = ['Repeater', 'Troupe', 'Trouper', 'Early Bird', 'Regular', 'Rush', 'Free'];

  // React Query mutations for saving data
  const feeParamMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/fee-params', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to save fee parameter');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fee-params'] });
      setMessage({ type: 'success', text: 'Fee parameter saved successfully' });
    },
    onError: (error) => {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save fee parameter',
      });
    },
  });

  const gracePriceMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/grace-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to save grace price conversion');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grace-prices'] });
      setMessage({ type: 'success', text: 'Grace price conversion saved successfully' });
    },
    onError: (error) => {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save grace price conversion',
      });
    },
  });

  const deleteFeeParamMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/fee-params?id=${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete fee parameter');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fee-params'] });
      setMessage({ type: 'success', text: 'Fee parameter deleted successfully' });
    },
    onError: (error) => {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to delete fee parameter',
      });
    },
  });

  const deleteGracePriceMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/grace-price?id=${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete grace price conversion');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grace-prices'] });
      setMessage({ type: 'success', text: 'Grace price conversion deleted successfully' });
    },
    onError: (error) => {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to delete grace price conversion',
      });
    },
  });

  useEffect(() => {
    // Log page view
    if (session?.user?.id) {
      fetch('/api/activity-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'view_fee_parameters',
          details: `User viewed fee parameters page`,
        }),
      }).catch(console.error);
    }
  }, [session]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    feeParamMutation.mutate({
      program: form.program,
      category: form.category,
      venue: form.venue,
      attendance: form.attendance,
      percent: parseFloat(form.percent),
    });

    resetForm();
    setSaving(false);
  };

  const handleInputChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSelectChange = (field: string, value: string) => {
    if (value === 'manual') {
      setManualInputs((prev) => ({ ...prev, [field]: true }));
      setForm((prev) => ({ ...prev, [field]: '' }));
    } else {
      setManualInputs((prev) => ({ ...prev, [field]: false }));
      setForm((prev) => ({ ...prev, [field]: value }));
    }
  };

  const resetForm = () => {
    setForm({ program: '', category: '', venue: '', attendance: '', percent: '' });
    setManualInputs({ program: false, category: false, venue: false, attendance: false });
  };

  const resetGracePriceForm = () => {
    setGracePriceForm({ program: '', category: '', venue: '', tierLevel: '', jpyPrice: '', eurPrice: '' });
  };

  // Grace Price form handlers
  const handleGracePriceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    // Generate eventType and eventTypeKey from form inputs
    const eventType = `${gracePriceForm.program} Training - ${gracePriceForm.tierLevel}`;
    let eventTypeKey = `${gracePriceForm.program}-${gracePriceForm.category}-${gracePriceForm.tierLevel === 'Free' ? '' : gracePriceForm.tierLevel}`;
    
    // Add -Online suffix if venue is Online
    if (gracePriceForm.venue === 'Online') {
      eventTypeKey = `${eventTypeKey}-Online`;
    }

    gracePriceMutation.mutate({
      eventType: eventType,
      eventTypeKey: eventTypeKey,
      venue: gracePriceForm.venue || null,
      jpyPrice: parseFloat(gracePriceForm.jpyPrice),
      eurPrice: parseFloat(gracePriceForm.eurPrice),
    });

    resetGracePriceForm();
    setSaving(false);
  };

  const handleGracePriceInputChange = (field: string, value: string) => {
    setGracePriceForm((prev) => ({ ...prev, [field]: value }));
  };

  // Helper functions for Grace Price data parsing
  const parseGracePriceData = (gracePrice: GracePrice) => {
    // Parse eventTypeKey back to components: "Salsation-Instructor training-Early Bird" or "Salsation-Instructor training-Early Bird-Online"
    const parts = gracePrice.eventTypeKey.split('-');
    
    // Check if last part is "Online" (venue suffix)
    const hasOnlineSuffix = parts[parts.length - 1] === 'Online';
    
    return {
      program: parts[0] || '',
      category: parts[1] || '',
      tierLevel: hasOnlineSuffix ? (parts[2] || 'Free') : (parts[2] || 'Free'),
      venue: gracePrice.venue || '',
    };
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="container mx-auto p-6 space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-9 w-64" /> {/* Title */}
          </div>

          {/* Add New Parameter Form Skeleton */}
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" /> {/* Card Title */}
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-16" /> {/* Label */}
                    <Skeleton className="h-10 w-full" /> {/* Input */}
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-10 w-32" /> {/* Button */}
                  <Skeleton className="h-10 w-20" /> {/* Button */}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Parameters Table Skeleton */}
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-56" /> {/* Card Title */}
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg">
                <div className="p-4 space-y-3">
                  {/* Table Header */}
                  <div className="grid grid-cols-6 gap-4">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-18" />
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  {/* Table Rows */}
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="grid grid-cols-6 gap-4">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-18" />
                      <Skeleton className="h-4 w-12" />
                      <Skeleton className="h-4 w-40" />
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">
            Fee Parameters
            {session?.user?.role === 'admin' ? ' & Grace Price Management' : ' Management'}
          </h1>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList
            className={`grid w-full ${session?.user?.role === 'admin' ? 'grid-cols-3' : 'grid-cols-1'}`}
          >
            <TabsTrigger value="fee-params">Fee Parameters</TabsTrigger>
            {session?.user?.role === 'admin' && (
              <>
                <TabsTrigger value="grace-price">Grace Price Conversion</TabsTrigger>
                <TabsTrigger value="reporting-grp">Reporting Groups</TabsTrigger>
              </>
            )}
          </TabsList>

          <TabsContent value="fee-params" className="space-y-6">
            {/* Add New Parameter Form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  Add New Fee Parameter
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <Label htmlFor="program">Program</Label>
                      {manualInputs.program ? (
                        <div className="flex gap-2">
                          <Input
                            id="program"
                            type="text"
                            placeholder="Enter custom program"
                            value={form.program}
                            onChange={(e) => handleInputChange('program', e.target.value)}
                            required
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setManualInputs((prev) => ({ ...prev, program: false }));
                              setForm((prev) => ({ ...prev, program: '' }));
                            }}
                          >
                            ×
                          </Button>
                        </div>
                      ) : (
                        <Select
                          value={form.program}
                          onValueChange={(value) => handleSelectChange('program', value)}
                          required
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select program" />
                          </SelectTrigger>
                          <SelectContent>
                            {programOptions.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                            <SelectItem
                              value="manual"
                              className="border-t mt-2 pt-2 font-medium text-blue-600"
                            >
                              + Add manual entry
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="category">Category</Label>
                      {manualInputs.category ? (
                        <div className="flex gap-2">
                          <Input
                            id="category"
                            type="text"
                            placeholder="Enter custom category"
                            value={form.category}
                            onChange={(e) => handleInputChange('category', e.target.value)}
                            required
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setManualInputs((prev) => ({ ...prev, category: false }));
                              setForm((prev) => ({ ...prev, category: '' }));
                            }}
                          >
                            ×
                          </Button>
                        </div>
                      ) : (
                        <Select
                          value={form.category}
                          onValueChange={(value) => handleSelectChange('category', value)}
                          required
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {categoryOptions.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                            <SelectItem
                              value="manual"
                              className="border-t mt-2 pt-2 font-medium text-blue-600"
                            >
                              + Add manual entry
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="venue">Venue</Label>
                      {manualInputs.venue ? (
                        <div className="flex gap-2">
                          <Input
                            id="venue"
                            type="text"
                            placeholder="Enter custom venue"
                            value={form.venue}
                            onChange={(e) => handleInputChange('venue', e.target.value)}
                            required
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setManualInputs((prev) => ({ ...prev, venue: false }));
                              setForm((prev) => ({ ...prev, venue: '' }));
                            }}
                          >
                            ×
                          </Button>
                        </div>
                      ) : (
                        <Select
                          value={form.venue}
                          onValueChange={(value) => handleSelectChange('venue', value)}
                          required
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select venue" />
                          </SelectTrigger>
                          <SelectContent>
                            {venueOptions.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                            <SelectItem
                              value="manual"
                              className="border-t mt-2 pt-2 font-medium text-blue-600"
                            >
                              + Add manual entry
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="attendance">Attendance</Label>
                      {manualInputs.attendance ? (
                        <div className="flex gap-2">
                          <Input
                            id="attendance"
                            type="text"
                            placeholder="Enter custom attendance"
                            value={form.attendance}
                            onChange={(e) => handleInputChange('attendance', e.target.value)}
                            required
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setManualInputs((prev) => ({ ...prev, attendance: false }));
                              setForm((prev) => ({ ...prev, attendance: '' }));
                            }}
                          >
                            ×
                          </Button>
                        </div>
                      ) : (
                        <Select
                          value={form.attendance}
                          onValueChange={(value) => handleSelectChange('attendance', value)}
                          required
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select attendance" />
                          </SelectTrigger>
                          <SelectContent>
                            {attendanceOptions.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                            <SelectItem
                              value="manual"
                              className="border-t mt-2 pt-2 font-medium text-blue-600"
                            >
                              + Add manual entry
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="percent">Percentage (%)</Label>
                      <Input
                        id="percent"
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        placeholder="e.g. 70"
                        value={form.percent}
                        onChange={(e) => handleInputChange('percent', e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={saving}>
                      {saving ? 'Saving...' : 'Add Parameter'}
                    </Button>
                    <Button type="button" variant="outline" onClick={resetForm}>
                      Clear
                    </Button>
                  </div>
                </form>

                {message && (
                  <Alert
                    className={`mt-4 ${message.type === 'error' ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}
                  >
                    <div className="flex items-center gap-2">
                      {message.type === 'error' ? (
                        <AlertCircle className="w-4 h-4 text-red-600" />
                      ) : (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      )}
                      <AlertDescription
                        className={message.type === 'error' ? 'text-red-700' : 'text-green-700'}
                      >
                        {message.text}
                      </AlertDescription>
                    </div>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Parameters Table */}
            <Card>
              <CardHeader>
                <CardTitle>Existing Fee Parameters ({params.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {params.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No fee parameters found. Add some parameters above.
                  </div>
                ) : (
                  <div className="border rounded-lg">
                    <div className="max-h-[600px] overflow-auto">
                      <Table>
                        <TableHeader className="sticky top-0 bg-white border-b shadow-sm z-10">
                          <TableRow>
                            <TableHead className="min-w-[120px]">Program</TableHead>
                            <TableHead className="min-w-[140px]">Category</TableHead>
                            <TableHead className="min-w-[100px]">Venue</TableHead>
                            <TableHead className="min-w-[120px]">Attendance</TableHead>
                            <TableHead className="min-w-[100px]">Percentage</TableHead>
                            <TableHead className="min-w-[160px] text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {params.map((param: FeeParam) => (
                            <TableRow key={param.id}>
                              {/* Editable cells */}
                              {editingId === param.id ? (
                                <>
                                  <TableCell className="font-medium">
                                    <Select
                                      value={editForm.program}
                                      onValueChange={(value) => {
                                        if (value === 'manual') {
                                          // For edit mode, we'll allow direct text input
                                          return;
                                        }
                                        setEditForm((p) => ({ ...p, program: value }));
                                      }}
                                    >
                                      <SelectTrigger className="h-8">
                                        <SelectValue placeholder="Select program" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {programOptions.map((option) => (
                                          <SelectItem key={option} value={option}>
                                            {option}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell>
                                    <Select
                                      value={editForm.category}
                                      onValueChange={(value) =>
                                        setEditForm((p) => ({ ...p, category: value }))
                                      }
                                    >
                                      <SelectTrigger className="h-8">
                                        <SelectValue placeholder="Select category" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {categoryOptions.map((option) => (
                                          <SelectItem key={option} value={option}>
                                            {option}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell>
                                    <Select
                                      value={editForm.venue}
                                      onValueChange={(value) =>
                                        setEditForm((p) => ({ ...p, venue: value }))
                                      }
                                    >
                                      <SelectTrigger className="h-8">
                                        <SelectValue placeholder="Select venue" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {venueOptions.map((option) => (
                                          <SelectItem key={option} value={option}>
                                            {option}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell>
                                    <Select
                                      value={editForm.attendance}
                                      onValueChange={(value) =>
                                        setEditForm((p) => ({ ...p, attendance: value }))
                                      }
                                    >
                                      <SelectTrigger className="h-8">
                                        <SelectValue placeholder="Select attendance" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {attendanceOptions.map((option) => (
                                          <SelectItem key={option} value={option}>
                                            {option}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      type="number"
                                      step="0.1"
                                      min="0"
                                      max="100"
                                      value={editForm.percent}
                                      onChange={(e) =>
                                        setEditForm((p) => ({ ...p, percent: e.target.value }))
                                      }
                                      className="h-8"
                                    />
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                      <Button
                                        size="sm"
                                        onClick={() => {
                                          setSaving(true);
                                          setMessage(null);
                                          feeParamMutation.mutate({
                                            program: editForm.program,
                                            category: editForm.category,
                                            venue: editForm.venue,
                                            attendance: editForm.attendance,
                                            percent: parseFloat(editForm.percent),
                                          });
                                          setEditingId(null);
                                          setSaving(false);
                                        }}
                                      >
                                        Save
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setEditingId(null)}
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  </TableCell>
                                </>
                              ) : (
                                <>
                                  <TableCell className="font-medium">{param.program}</TableCell>
                                  <TableCell>{param.category}</TableCell>
                                  <TableCell>{param.venue}</TableCell>
                                  <TableCell>{param.attendance}</TableCell>
                                  <TableCell>{param.percent}%</TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          setEditingId(param.id);
                                          setEditForm({
                                            program: param.program,
                                            category: param.category,
                                            venue: param.venue,
                                            attendance: param.attendance,
                                            percent: String(param.percent),
                                          });
                                        }}
                                      >
                                        Edit
                                      </Button>
                                      <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => {
                                          if (confirm('Delete this fee parameter?')) {
                                            deleteFeeParamMutation.mutate(param.id);
                                          }
                                        }}
                                      >
                                        Delete
                                      </Button>
                                    </div>
                                  </TableCell>
                                </>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {session?.user?.role === 'admin' && (
            <TabsContent value="grace-price" className="space-y-6">
              {/* Add New Grace Price Form */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="w-5 h-5" />
                    Add New Grace Price Conversion
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleGracePriceSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <Label htmlFor="program">Program</Label>
                        <Select
                          value={gracePriceForm.program}
                          onValueChange={(value) => handleGracePriceInputChange('program', value)}
                          required
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select program" />
                          </SelectTrigger>
                          <SelectContent>
                            {programOptions.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="category">Category</Label>
                        <Select
                          value={gracePriceForm.category}
                          onValueChange={(value) => handleGracePriceInputChange('category', value)}
                          required
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {categoryOptions.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="venue">Venue</Label>
                        <Select
                          value={gracePriceForm.venue}
                          onValueChange={(value) => handleGracePriceInputChange('venue', value)}
                          required
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select venue" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Venue">Venue</SelectItem>
                            <SelectItem value="Online">Online</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="tierLevel">Tier Level</Label>
                        <Select
                          value={gracePriceForm.tierLevel}
                          onValueChange={(value) => handleGracePriceInputChange('tierLevel', value)}
                          required
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select tier level" />
                          </SelectTrigger>
                          <SelectContent>
                            {tierLevelOptions.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="jpyPrice">JPY Price</Label>
                        <Input
                          id="jpyPrice"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="e.g. 29700"
                          value={gracePriceForm.jpyPrice}
                          onChange={(e) => handleGracePriceInputChange('jpyPrice', e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="eurPrice">EUR Price</Label>
                        <Input
                          id="eurPrice"
                          type="number"
                          step="0.001"
                          min="0"
                          placeholder="e.g. 173.685"
                          value={gracePriceForm.eurPrice}
                          onChange={(e) => handleGracePriceInputChange('eurPrice', e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" disabled={saving}>
                        {saving ? 'Saving...' : 'Add Grace Price'}
                      </Button>
                      <Button type="button" variant="outline" onClick={resetGracePriceForm}>
                        Clear
                      </Button>
                    </div>
                  </form>

                  {message && (
                    <Alert
                      className={`mt-4 ${message.type === 'error' ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}
                    >
                      <div className="flex items-center gap-2">
                        {message.type === 'error' ? (
                          <AlertCircle className="w-4 h-4 text-red-600" />
                        ) : (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        )}
                        <AlertDescription
                          className={message.type === 'error' ? 'text-red-700' : 'text-green-700'}
                        >
                          {message.text}
                        </AlertDescription>
                      </div>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              {/* Grace Price Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Grace Price Conversions ({gracePrices.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {gracePrices.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No grace price conversions found. Add some conversions above.
                    </div>
                  ) : (
                    <div className="border rounded-lg">
                      <div className="max-h-[600px] overflow-auto">
                        <Table>
                          <TableHeader className="sticky top-0 bg-white border-b shadow-sm z-10">
                            <TableRow>
                              <TableHead className="min-w-[120px]">Program</TableHead>
                              <TableHead className="min-w-[140px]">Category</TableHead>
                              <TableHead className="min-w-[100px]">Venue</TableHead>
                              <TableHead className="min-w-[120px]">Tier Level</TableHead>
                              <TableHead className="min-w-[200px]">Event Type Key</TableHead>
                              <TableHead className="min-w-[120px]">JPY Price</TableHead>
                              <TableHead className="min-w-[120px]">EUR Price</TableHead>
                              <TableHead className="min-w-[160px] text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {gracePrices.map((gracePrice: GracePrice) => {
                              const parsedData = parseGracePriceData(gracePrice);
                              return (
                                <TableRow key={gracePrice.id}>
                                  {/* Editable cells */}
                                  {editingGracePriceId === gracePrice.id ? (
                                    <>
                                      <TableCell className="font-medium">
                                        <Select
                                          value={editGracePriceForm.program}
                                          onValueChange={(value) =>
                                            setEditGracePriceForm((p) => ({ ...p, program: value }))
                                          }
                                        >
                                          <SelectTrigger className="h-8">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {programOptions.map((option) => (
                                              <SelectItem key={option} value={option}>
                                                {option}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </TableCell>
                                      <TableCell>
                                        <Select
                                          value={editGracePriceForm.category}
                                          onValueChange={(value) =>
                                            setEditGracePriceForm((p) => ({
                                              ...p,
                                              category: value,
                                            }))
                                          }
                                        >
                                          <SelectTrigger className="h-8">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {categoryOptions.map((option) => (
                                              <SelectItem key={option} value={option}>
                                                {option}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </TableCell>
                                      <TableCell>
                                        <Select
                                          value={editGracePriceForm.venue}
                                          onValueChange={(value) =>
                                            setEditGracePriceForm((p) => ({
                                              ...p,
                                              venue: value,
                                            }))
                                          }
                                        >
                                          <SelectTrigger className="h-8">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="Venue">Venue</SelectItem>
                                            <SelectItem value="Online">Online</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </TableCell>
                                      <TableCell>
                                        <Select
                                          value={editGracePriceForm.tierLevel}
                                          onValueChange={(value) =>
                                            setEditGracePriceForm((p) => ({
                                              ...p,
                                              tierLevel: value,
                                            }))
                                          }
                                        >
                                          <SelectTrigger className="h-8">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {tierLevelOptions.map((option) => (
                                              <SelectItem key={option} value={option}>
                                                {option}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </TableCell>
                                      <TableCell className="text-xs text-muted-foreground">
                                        {gracePrice.eventTypeKey}
                                      </TableCell>
                                      <TableCell>
                                        <Input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          value={editGracePriceForm.jpyPrice}
                                          onChange={(e) =>
                                            setEditGracePriceForm((p) => ({
                                              ...p,
                                              jpyPrice: e.target.value,
                                            }))
                                          }
                                          className="h-8"
                                        />
                                      </TableCell>
                                      <TableCell>
                                        <Input
                                          type="number"
                                          step="0.001"
                                          min="0"
                                          value={editGracePriceForm.eurPrice}
                                          onChange={(e) =>
                                            setEditGracePriceForm((p) => ({
                                              ...p,
                                              eurPrice: e.target.value,
                                            }))
                                          }
                                          className="h-8"
                                        />
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                          <Button
                                            size="sm"
                                            onClick={() => {
                                              setSaving(true);
                                              setMessage(null);

                                              // Generate eventType and eventTypeKey from form inputs
                                              const eventType = `${editGracePriceForm.program} Training - ${editGracePriceForm.tierLevel}`;
                                              let eventTypeKey = `${editGracePriceForm.program}-${editGracePriceForm.category}-${editGracePriceForm.tierLevel === 'Free' ? '' : editGracePriceForm.tierLevel}`;
                                              
                                              // Add -Online suffix if venue is Online
                                              if (editGracePriceForm.venue === 'Online') {
                                                eventTypeKey = `${eventTypeKey}-Online`;
                                              }

                                              gracePriceMutation.mutate({
                                                id: editingGracePriceId,
                                                eventType: eventType,
                                                eventTypeKey: eventTypeKey,
                                                venue: editGracePriceForm.venue || null,
                                                jpyPrice: parseFloat(editGracePriceForm.jpyPrice),
                                                eurPrice: parseFloat(editGracePriceForm.eurPrice),
                                              });

                                              setEditingGracePriceId(null);
                                              setSaving(false);
                                            }}
                                          >
                                            Save
                                          </Button>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setEditingGracePriceId(null)}
                                          >
                                            Cancel
                                          </Button>
                                        </div>
                                      </TableCell>
                                    </>
                                  ) : (
                                    <>
                                      <TableCell className="font-medium">
                                        {parsedData.program}
                                      </TableCell>
                                      <TableCell>{parsedData.category}</TableCell>
                                      <TableCell>{parsedData.venue || '-'}</TableCell>
                                      <TableCell>{parsedData.tierLevel}</TableCell>
                                      <TableCell className="text-xs text-muted-foreground">
                                        {gracePrice.eventTypeKey}
                                      </TableCell>
                                      <TableCell>
                                        ¥{gracePrice.jpyPrice.toLocaleString('ja-JP')}
                                      </TableCell>
                                      <TableCell>
                                        €
                                        {gracePrice.eurPrice.toLocaleString('de-DE', {
                                          minimumFractionDigits: 3,
                                        })}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                              setEditingGracePriceId(gracePrice.id);
                                              setEditGracePriceForm({
                                                program: parsedData.program,
                                                category: parsedData.category,
                                                venue: parsedData.venue,
                                                tierLevel: parsedData.tierLevel,
                                                jpyPrice: String(gracePrice.jpyPrice),
                                                eurPrice: String(gracePrice.eurPrice),
                                              });
                                            }}
                                          >
                                            Edit
                                          </Button>
                                          <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={() => {
                                              if (confirm('Delete this grace price conversion?')) {
                                                deleteGracePriceMutation.mutate(gracePrice.id);
                                              }
                                            }}
                                          >
                                            Delete
                                          </Button>
                                        </div>
                                      </TableCell>
                                    </>
                                  )}
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {session?.user?.role === 'admin' && (
            <TabsContent value="reporting-grp" className="space-y-6">
              <ReportingGroupTab
                message={message}
                setMessage={setMessage}
                saving={saving}
                setSaving={setSaving}
              />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
