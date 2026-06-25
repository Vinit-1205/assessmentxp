import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTenantContext } from '@/hooks/useTenantContext';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Plus, Trash2, Pencil, Key, Users } from "lucide-react";
import { toast } from 'sonner';

export default function StaffManagement() {
  const queryClient = useQueryClient();
  const { tenantId, user } = useTenantContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [newStaff, setNewStaff] = useState({ email: '', role: 'examiner', department: '' });

  const { data: staff, isLoading } = useQuery({
    queryKey: ['tenant_staff', tenantId],
    queryFn: () => base44.entities.TenantUser.filter({ institution_id: tenantId }),
    enabled: !!tenantId,
  });

  const inviteStaffMutation = useMutation({
    mutationFn: async (data) => {
      // First, invite the user to the platform with "user" app role
      const inviteResponse = await base44.functions.invoke('inviteUser', {
          email: data.email,
          role: 'user'
      });
      
      // Get the user ID from the invite response if available, or just create the TenantUser record
      // The backfillTenantUserEmails or similar job will link the ID later if they don't exist yet
      const userId = inviteResponse?.data?.user?.id || inviteResponse?.user?.id;

      return base44.entities.TenantUser.create({
        institution_id: tenantId,
        email: data.email,
        user_id: userId || null,
        role: data.role,
        department: data.department || '',
        is_active: true
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant_staff', tenantId] });
      setIsAddStaffOpen(false);
      setNewStaff({ email: '', role: 'examiner', department: '' });
      toast.success('Staff member invited successfully');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to invite staff member');
    }
  });

  const deleteStaffMutation = useMutation({
    mutationFn: (id) => base44.entities.TenantUser.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant_staff', tenantId] });
      toast.success('Staff member removed');
    }
  });

  const handleAddStaff = (e) => {
    e.preventDefault();
    if (!newStaff.email) return toast.error("Email is required");
    inviteStaffMutation.mutate(newStaff);
  };

  const filteredStaff = staff?.filter(s => {
    // Hide candidates from staff management
    if (s.role === 'candidate') return false;
    
    const matchesSearch = s.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || s.role === roleFilter;
    return matchesSearch && matchesRole;
  }) || [];

  const roleColors = {
    tenant_admin: "bg-purple-100 text-purple-700",
    tenant_executive: "bg-indigo-100 text-indigo-700",
    proctor: "bg-blue-100 text-blue-700",
    examiner: "bg-green-100 text-green-700"
  };

  const roleLabels = {
    tenant_admin: "Tenant Admin",
    tenant_executive: "Executive",
    proctor: "Proctor",
    examiner: "Examiner"
  };

  const totalStaff = staff?.filter(s => s.role !== 'candidate').length || 0;
  const activeStaff = staff?.filter(s => s.role !== 'candidate' && s.is_active).length || 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Staff Management</h1>
          <p className="text-muted-foreground mt-1">Manage system users, roles, and access permissions across your institution.</p>
        </div>
        <Dialog open={isAddStaffOpen} onOpenChange={setIsAddStaffOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#002147] hover:bg-[#001833] gap-2">
              <Plus className="w-4 h-4" /> Add New Staff
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Staff Member</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddStaff} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Email Address</Label>
                <Input type="email" required value={newStaff.email} onChange={e => setNewStaff({...newStaff, email: e.target.value})} placeholder="colleague@institution.edu" />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={newStaff.role} onValueChange={v => setNewStaff({...newStaff, role: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tenant_admin">Tenant Admin (Full Access)</SelectItem>
                    <SelectItem value="examiner">Examiner (Manage Exams)</SelectItem>
                    <SelectItem value="proctor">Proctor (Monitor Exams)</SelectItem>
                    <SelectItem value="tenant_executive">Executive (Reports Only)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Department (Optional)</Label>
                <Input value={newStaff.department} onChange={e => setNewStaff({...newStaff, department: e.target.value})} placeholder="e.g. Computer Science" />
              </div>
              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={inviteStaffMutation.isPending}>
                  {inviteStaffMutation.isPending ? 'Inviting...' : 'Send Invitation'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Total Staff</p>
              <h3 className="text-2xl font-bold text-[#002147]">{totalStaff}</h3>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
              <Users className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center justify-between border-b-4 border-green-500 rounded-b-xl">
            <div>
              <p className="text-sm font-medium text-slate-500">Active</p>
              <h3 className="text-2xl font-bold text-green-600">{activeStaff}</h3>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center justify-between border-b-4 border-yellow-500 rounded-b-xl">
            <div>
              <p className="text-sm font-medium text-slate-500">Pending Invitations</p>
              <h3 className="text-2xl font-bold text-yellow-600">0</h3>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Roles in Use</p>
              <h3 className="text-2xl font-bold text-purple-600">{new Set(staff?.filter(s=>s.role !== 'candidate').map(s => s.role)).size || 0}</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <div className="p-4 border-b flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search by email..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="tenant_admin">Tenant Admin</SelectItem>
              <SelectItem value="examiner">Examiner</SelectItem>
              <SelectItem value="proctor">Proctor</SelectItem>
              <SelectItem value="tenant_executive">Executive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[300px]">EMAIL</TableHead>
              <TableHead>ROLE</TableHead>
              <TableHead>DEPARTMENT</TableHead>
              <TableHead>STATUS</TableHead>
              <TableHead className="text-right">ACTIONS</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-500">Loading staff...</TableCell></TableRow>
            ) : filteredStaff.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-500">No staff members found.</TableCell></TableRow>
            ) : (
              filteredStaff.map((staffMember) => (
                <TableRow key={staffMember.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs uppercase">
                        {staffMember.email.charAt(0)}
                      </div>
                      <div>
                        {staffMember.email}
                        {staffMember.user_id === user?.id && <span className="ml-2 text-xs text-slate-400 font-normal">(You)</span>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${roleColors[staffMember.role] || 'bg-slate-100'}`}>
                      {roleLabels[staffMember.role] || staffMember.role}
                    </span>
                  </TableCell>
                  <TableCell className="text-slate-500">{staffMember.department || '—'}</TableCell>
                  <TableCell>
                    {staffMember.is_active ? (
                      <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded">Active</span>
                    ) : (
                      <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded">Inactive</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end items-center gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      {staffMember.user_id !== user?.id && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-slate-400 hover:text-red-600"
                          onClick={() => {
                            if (confirm(`Remove ${staffMember.email} from staff?`)) {
                              deleteStaffMutation.mutate(staffMember.id);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Card>
        <CardContent className="p-6">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Key className="w-4 h-4" /> Role Permissions Reference
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
                <tr>
                  <th className="py-3 px-4 font-semibold">Permission</th>
                  <th className="py-3 px-4 font-semibold text-center">Proctor</th>
                  <th className="py-3 px-4 font-semibold text-center">Examiner</th>
                  <th className="py-3 px-4 font-semibold text-center">Executive</th>
                  <th className="py-3 px-4 font-semibold text-center">Tenant Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y text-slate-600">
                <tr>
                  <td className="py-3 px-4">View Analytics & Reports</td>
                  <td className="py-3 px-4 text-center text-green-500">✓</td>
                  <td className="py-3 px-4 text-center text-green-500">✓</td>
                  <td className="py-3 px-4 text-center text-green-500">✓</td>
                  <td className="py-3 px-4 text-center text-green-500">✓</td>
                </tr>
                <tr>
                  <td className="py-3 px-4">Monitor Live Exams</td>
                  <td className="py-3 px-4 text-center text-green-500">✓</td>
                  <td className="py-3 px-4 text-center text-green-500">✓</td>
                  <td className="py-3 px-4 text-center text-slate-300">—</td>
                  <td className="py-3 px-4 text-center text-green-500">✓</td>
                </tr>
                <tr>
                  <td className="py-3 px-4">Create & Edit Exams</td>
                  <td className="py-3 px-4 text-center text-slate-300">—</td>
                  <td className="py-3 px-4 text-center text-green-500">✓</td>
                  <td className="py-3 px-4 text-center text-slate-300">—</td>
                  <td className="py-3 px-4 text-center text-green-500">✓</td>
                </tr>
                <tr>
                  <td className="py-3 px-4">Manage System Staff</td>
                  <td className="py-3 px-4 text-center text-slate-300">—</td>
                  <td className="py-3 px-4 text-center text-slate-300">—</td>
                  <td className="py-3 px-4 text-center text-slate-300">—</td>
                  <td className="py-3 px-4 text-center text-green-500">✓</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}