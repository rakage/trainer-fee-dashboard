'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
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
import { Plus, AlertCircle, CheckCircle } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface FeeParam {
  id: number;
  program: string;
  category: string;
  venue: string;
  attendance: string;
  percent: number;
  concatKey: string;
}

export default function FeeParamsPage() {
  const { data: session } = useSession();
  const [params, setParams] = useState<FeeParam[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{ program: string; category: string; venue: string; attendance: string; percent: string }>({
    program: '', category: '', venue: '', attendance: '', percent: ''
  });

  // Form state
  const [form, setForm] = useState({
    program: '',
    category: '',
    venue: '',
    attendance: '',
    percent: ''
  });

  // Manual input state
  const [manualInputs, setManualInputs] = useState({
    program: false,
    category: false,
    venue: false,
    attendance: false
  });

  // Predefined options
  const programOptions = ['Salsation', 'Choreology', 'Kid', 'Rootz', 'Natasha_Salsation'];
  const categoryOptions = ['Instructor training', 'Workshops', 'Seminar', 'Method Training', 'On Demand', 'On-Demand', 'Move Forever Training'];
  const venueOptions = ['Venue', 'Online', 'OnlineGlobal', 'On Demand'];
  const attendanceOptions = ['Attended', 'Unattended'];

  // Load fee parameters
  const loadParams = async () => {
    try {
      const response = await fetch('/api/fee-params');
      if (response.ok) {
        const data = await response.json();
        setParams(data.data || []);
      } else {
        throw new Error('Failed to load parameters');
      }
    } catch (error) {
      console.error('Error loading params:', error);
      setMessage({ type: 'error', text: 'Failed to load fee parameters' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadParams();
    // Log page view
    if (session?.user?.id) {
      fetch('/api/activity-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'view_fee_parameters',
          details: `User viewed fee parameters page`
        })
      }).catch(console.error);
    }
  }, [session]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/fee-params', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          program: form.program,
          category: form.category,
          venue: form.venue,
          attendance: form.attendance,
          percent: parseFloat(form.percent)
        })
      });

      const result = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: result.message });
                      resetForm();
        loadParams(); // Reload the list
      } else {
        throw new Error(result.error || 'Failed to save parameter');
      }
    } catch (error) {
      console.error('Error saving parameter:', error);
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to save parameter' 
      });
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSelectChange = (field: string, value: string) => {
    if (value === 'manual') {
      setManualInputs(prev => ({ ...prev, [field]: true }));
      setForm(prev => ({ ...prev, [field]: '' }));
    } else {
      setManualInputs(prev => ({ ...prev, [field]: false }));
      setForm(prev => ({ ...prev, [field]: value }));
    }
  };

  const resetForm = () => {
    setForm({ program: '', category: '', venue: '', attendance: '', percent: '' });
    setManualInputs({ program: false, category: false, venue: false, attendance: false });
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
        <h1 className="text-3xl font-bold">Fee Parameters Management</h1>
      </div>

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
                        setManualInputs(prev => ({ ...prev, program: false }));
                        setForm(prev => ({ ...prev, program: '' }));
                      }}
                    >
                      ×
                    </Button>
                  </div>
                ) : (
                  <Select value={form.program} onValueChange={(value) => handleSelectChange('program', value)} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select program" />
                    </SelectTrigger>
                    <SelectContent>
                      {programOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                      <SelectItem value="manual" className="border-t mt-2 pt-2 font-medium text-blue-600">
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
                        setManualInputs(prev => ({ ...prev, category: false }));
                        setForm(prev => ({ ...prev, category: '' }));
                      }}
                    >
                      ×
                    </Button>
                  </div>
                ) : (
                  <Select value={form.category} onValueChange={(value) => handleSelectChange('category', value)} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                      <SelectItem value="manual" className="border-t mt-2 pt-2 font-medium text-blue-600">
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
                        setManualInputs(prev => ({ ...prev, venue: false }));
                        setForm(prev => ({ ...prev, venue: '' }));
                      }}
                    >
                      ×
                    </Button>
                  </div>
                ) : (
                  <Select value={form.venue} onValueChange={(value) => handleSelectChange('venue', value)} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select venue" />
                    </SelectTrigger>
                    <SelectContent>
                      {venueOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                      <SelectItem value="manual" className="border-t mt-2 pt-2 font-medium text-blue-600">
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
                        setManualInputs(prev => ({ ...prev, attendance: false }));
                        setForm(prev => ({ ...prev, attendance: '' }));
                      }}
                    >
                      ×
                    </Button>
                  </div>
                ) : (
                  <Select value={form.attendance} onValueChange={(value) => handleSelectChange('attendance', value)} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select attendance" />
                    </SelectTrigger>
                    <SelectContent>
                      {attendanceOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                      <SelectItem value="manual" className="border-t mt-2 pt-2 font-medium text-blue-600">
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
              <Button 
                type="button" 
                variant="outline"
                onClick={resetForm}
              >
                Clear
              </Button>
            </div>
          </form>

          {message && (
            <Alert className={`mt-4 ${message.type === 'error' ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
              <div className="flex items-center gap-2">
                {message.type === 'error' ? (
                  <AlertCircle className="w-4 h-4 text-red-600" />
                ) : (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                )}
                <AlertDescription className={message.type === 'error' ? 'text-red-700' : 'text-green-700'}>
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
                    {params.map((param) => (
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
                                onValueChange={(value) => setEditForm((p) => ({ ...p, category: value }))}
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
                                onValueChange={(value) => setEditForm((p) => ({ ...p, venue: value }))}
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
                                onValueChange={(value) => setEditForm((p) => ({ ...p, attendance: value }))}
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
                                onChange={(e) => setEditForm((p) => ({ ...p, percent: e.target.value }))}
                                className="h-8"
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  onClick={async () => {
                                    setSaving(true);
                                    setMessage(null);
                                    try {
                                      // Save via POST (upsert)
                                      const resp = await fetch('/api/fee-params', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                          program: editForm.program,
                                          category: editForm.category,
                                          venue: editForm.venue,
                                          attendance: editForm.attendance,
                                          percent: parseFloat(editForm.percent),
                                        })
                                      });
                                      if (!resp.ok) throw new Error('Failed to save changes');
                                      setEditingId(null);
                                      loadParams();
                                      setMessage({ type: 'success', text: 'Updated successfully' });
                                    } catch (e) {
                                      setMessage({ type: 'error', text: 'Failed to update' });
                                    } finally {
                                      setSaving(false);
                                    }
                                  }}
                                >
                                  Save
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>
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
                                  onClick={async () => {
                                    if (!confirm('Delete this fee parameter?')) return;
                                    setSaving(true);
                                    setMessage(null);
                                    try {
                                      const resp = await fetch(`/api/fee-params?id=${param.id}`, { method: 'DELETE' });
                                      if (!resp.ok) throw new Error('Failed to delete');
                                      loadParams();
                                      setMessage({ type: 'success', text: 'Deleted successfully' });
                                    } catch (e) {
                                      setMessage({ type: 'error', text: 'Delete failed' });
                                    } finally {
                                      setSaving(false);
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
      </div>
    </DashboardLayout>
  );
}
