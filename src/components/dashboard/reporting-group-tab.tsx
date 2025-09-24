'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, AlertCircle, CheckCircle } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface ReportingGrpParam {
  id: number;
  reportingGroup: string;
  split: string;
  trainerPercent: number;
  alejandroPercent: number;
  price: number | null;
  repeaterPrice: number | null;
}

interface ReportingGroupTabProps {
  message: { type: 'success' | 'error'; text: string } | null;
  setMessage: (message: { type: 'success' | 'error'; text: string } | null) => void;
  saving: boolean;
  setSaving: (saving: boolean) => void;
}

export function ReportingGroupTab({
  message,
  setMessage,
  saving,
  setSaving,
}: ReportingGroupTabProps) {
  const queryClient = useQueryClient();

  // React Query for reporting group parameters
  const { data: reportingGrpParams = [], isLoading } = useQuery({
    queryKey: ['param-reporting-grp'],
    queryFn: async () => {
      const response = await fetch('/api/param-reporting-grp');
      if (!response.ok) throw new Error('Failed to fetch reporting group parameters');
      return response.json();
    },
  });

  // Form state
  const [form, setForm] = useState({
    reportingGroup: '',
    split: '',
    trainerPercent: '',
    alejandroPercent: '',
    price: '',
    repeaterPrice: '',
  });

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    reportingGroup: '',
    split: '',
    trainerPercent: '',
    alejandroPercent: '',
    price: '',
    repeaterPrice: '',
  });

  // Mutations
  const reportingGrpMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/param-reporting-grp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to save reporting group parameter');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['param-reporting-grp'] });
      setMessage({ type: 'success', text: 'Reporting group parameter saved successfully' });
    },
    onError: (error) => {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save reporting group parameter',
      });
    },
  });

  const deleteReportingGrpMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/param-reporting-grp?id=${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete reporting group parameter');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['param-reporting-grp'] });
      setMessage({ type: 'success', text: 'Reporting group parameter deleted successfully' });
    },
    onError: (error) => {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to delete reporting group parameter',
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    reportingGrpMutation.mutate({
      reportingGroup: form.reportingGroup,
      split: form.split,
      trainerPercent: parseFloat(form.trainerPercent),
      alejandroPercent: parseFloat(form.alejandroPercent),
      price: form.price ? parseFloat(form.price) : null,
      repeaterPrice: form.repeaterPrice ? parseFloat(form.repeaterPrice) : null,
    });

    resetForm();
    setSaving(false);
  };

  const handleInputChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setForm({
      reportingGroup: '',
      split: '',
      trainerPercent: '',
      alejandroPercent: '',
      price: '',
      repeaterPrice: '',
    });
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Add New Reporting Group Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Add New Reporting Group Parameter
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="reportingGroup">Reporting Group</Label>
                <Input
                  id="reportingGroup"
                  type="text"
                  placeholder="e.g. Salsation Instructor training"
                  value={form.reportingGroup}
                  onChange={(e) => handleInputChange('reportingGroup', e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="split">Split</Label>
                <Input
                  id="split"
                  type="text"
                  placeholder="e.g. 40/60"
                  value={form.split}
                  onChange={(e) => handleInputChange('split', e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="trainerPercent">Trainer Percent</Label>
                <Input
                  id="trainerPercent"
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  placeholder="e.g. 0.40"
                  value={form.trainerPercent}
                  onChange={(e) => handleInputChange('trainerPercent', e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="alejandroPercent">Alejandro Percent</Label>
                <Input
                  id="alejandroPercent"
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  placeholder="e.g. 0.10"
                  value={form.alejandroPercent}
                  onChange={(e) => handleInputChange('alejandroPercent', e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="price">Price (optional)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 230"
                  value={form.price}
                  onChange={(e) => handleInputChange('price', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="repeaterPrice">Repeater Price (optional)</Label>
                <Input
                  id="repeaterPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 120"
                  value={form.repeaterPrice}
                  onChange={(e) => handleInputChange('repeaterPrice', e.target.value)}
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

      {/* Reporting Group Parameters Table */}
      <Card>
        <CardHeader>
          <CardTitle>Reporting Group Parameters ({reportingGrpParams.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {reportingGrpParams.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No reporting group parameters found. Add some parameters above.
            </div>
          ) : (
            <div className="border rounded-lg">
              <div className="max-h-[600px] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-white border-b shadow-sm z-10">
                    <TableRow>
                      <TableHead className="min-w-[250px]">Reporting Group</TableHead>
                      <TableHead className="min-w-[100px]">Split</TableHead>
                      <TableHead className="min-w-[120px]">Trainer %</TableHead>
                      <TableHead className="min-w-[120px]">Alejandro %</TableHead>
                      <TableHead className="min-w-[100px]">Price</TableHead>
                      <TableHead className="min-w-[120px]">Repeater Price</TableHead>
                      <TableHead className="min-w-[160px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportingGrpParams.map((param: ReportingGrpParam) => (
                      <TableRow key={param.id}>
                        {editingId === param.id ? (
                          <>
                            <TableCell>
                              <Input
                                value={editForm.reportingGroup}
                                onChange={(e) =>
                                  setEditForm((p) => ({ ...p, reportingGroup: e.target.value }))
                                }
                                className="h-8"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={editForm.split}
                                onChange={(e) =>
                                  setEditForm((p) => ({ ...p, split: e.target.value }))
                                }
                                className="h-8"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                step="0.01"
                                value={editForm.trainerPercent}
                                onChange={(e) =>
                                  setEditForm((p) => ({ ...p, trainerPercent: e.target.value }))
                                }
                                className="h-8"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                step="0.01"
                                value={editForm.alejandroPercent}
                                onChange={(e) =>
                                  setEditForm((p) => ({ ...p, alejandroPercent: e.target.value }))
                                }
                                className="h-8"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                step="0.01"
                                value={editForm.price}
                                onChange={(e) =>
                                  setEditForm((p) => ({ ...p, price: e.target.value }))
                                }
                                className="h-8"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                step="0.01"
                                value={editForm.repeaterPrice}
                                onChange={(e) =>
                                  setEditForm((p) => ({ ...p, repeaterPrice: e.target.value }))
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
                                    reportingGrpMutation.mutate({
                                      reportingGroup: editForm.reportingGroup,
                                      split: editForm.split,
                                      trainerPercent: parseFloat(editForm.trainerPercent),
                                      alejandroPercent: parseFloat(editForm.alejandroPercent),
                                      price: editForm.price ? parseFloat(editForm.price) : null,
                                      repeaterPrice: editForm.repeaterPrice
                                        ? parseFloat(editForm.repeaterPrice)
                                        : null,
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
                            <TableCell className="font-medium">{param.reportingGroup}</TableCell>
                            <TableCell>{param.split}</TableCell>
                            <TableCell>{(param.trainerPercent * 100).toFixed(1)}%</TableCell>
                            <TableCell>{(param.alejandroPercent * 100).toFixed(1)}%</TableCell>
                            <TableCell>{param.price ? `€${param.price}` : '-'}</TableCell>
                            <TableCell>
                              {param.repeaterPrice ? `€${param.repeaterPrice}` : '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setEditingId(param.id);
                                    setEditForm({
                                      reportingGroup: param.reportingGroup,
                                      split: param.split,
                                      trainerPercent: String(param.trainerPercent),
                                      alejandroPercent: String(param.alejandroPercent),
                                      price: param.price ? String(param.price) : '',
                                      repeaterPrice: param.repeaterPrice
                                        ? String(param.repeaterPrice)
                                        : '',
                                    });
                                  }}
                                >
                                  Edit
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => {
                                    if (confirm('Delete this reporting group parameter?')) {
                                      deleteReportingGrpMutation.mutate(param.id);
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
  );
}
