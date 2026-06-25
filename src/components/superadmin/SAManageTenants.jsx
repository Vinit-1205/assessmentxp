import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Search, Plus, Globe, Pencil, MoreVertical, X } from 'lucide-react';
import { toast } from 'sonner';

export default function SAManageTenants() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [editingInst, setEditingInst] = useState(null);

  const { data: institutions, isLoading: isLoadingInst } = useQuery({
    queryKey: ['sa_institutions'],
    queryFn: () => base44.entities.Institution.list(),
  });

  const { data: tenantUsers, isLoading: isLoadingUsers } = useQuery({
    queryKey: ['sa_tenant_users'],
    queryFn: () => base44.entities.TenantUser.list(),
  });

  const updateInstitutionMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Institution.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sa_institutions'] });
      toast.success('Institution updated');
      setEditingInst(null);
    },
    onError: (err) => toast.error(`Failed to update: ${err.message}`)
  });

  if (isLoadingInst || isLoadingUsers) {
    return <div className="p-8 text-center text-slate-500">Loading tenants...</div>;
  }

  const filteredInstitutions = institutions?.filter(inst => {
    const admin = tenantUsers?.find(u => u.institution_id === inst.id && (u.role === 'tenant_admin' || u.role === 'admin'));
    const searchString = `${inst.name} ${inst.slug} ${inst.country} ${admin?.email}`.toLowerCase();
    const matchesSearch = searchString.includes(searchTerm.toLowerCase());
    
    const status = inst.status || (inst.is_active ? 'Active' : 'Inactive');
    const matchesStatus = statusFilter === 'all' || status === statusFilter;
    
    const plan = inst.plan || 'Starter';
    const matchesPlan = planFilter === 'all' || plan === planFilter;
    
    return matchesSearch && matchesStatus && matchesPlan;
  }) || [];

  const handleSave = (e) => {
    e.preventDefault();
    if (!editingInst) return;
    updateInstitutionMutation.mutate({
      id: editingInst.id,
      data: {
        name: editingInst.name,
        slug: editingInst.slug,
        country: editingInst.country,
        address: editingInst.address,
        website: editingInst.website,
        plan: editingInst.plan,
        status: editingInst.status,
      }
    });
    // Note: updating tenant admin via this form is UI-only placeholder for now as it requires complex user management logic
  };

  return (
    <div className="flex h-[calc(100vh-theme(spacing.16))] -mx-6 -my-8">
      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-h-0 bg-slate-50 p-6 ${editingInst ? 'mr-[400px]' : ''} transition-all duration-300`}>
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Tenant Management</h1>
            <p className="text-sm text-slate-500 mt-1">Manage all registered institutions and their Tenant Admins</p>
          </div>
          <Button className="bg-[#002147] hover:bg-[#001833] gap-2">
            <Plus className="w-4 h-4" /> Add Institution
          </Button>
        </div>

        <Card className="shadow-sm border-slate-200 flex-1 flex flex-col min-h-0">
          <div className="p-4 border-b flex items-center gap-4 bg-white rounded-t-xl">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Search institutions, admins, countries..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-slate-50 border-slate-200"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] bg-slate-50 border-slate-200">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger className="w-[140px] bg-slate-50 border-slate-200">
                <SelectValue placeholder="All Plans" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Plans</SelectItem>
                <SelectItem value="Enterprise">Enterprise</SelectItem>
                <SelectItem value="Professional">Professional</SelectItem>
                <SelectItem value="Starter">Starter</SelectItem>
              </SelectContent>
            </Select>
            <div className="ml-auto text-xs text-slate-500">
              {filteredInstitutions.length} of {institutions?.length} institutions
            </div>
          </div>
          
          <div className="flex-1 overflow-auto bg-white rounded-b-xl">
            <Table>
              <TableHeader className="bg-slate-50/80 sticky top-0 z-10 shadow-sm">
                <TableRow>
                  <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider h-11">INSTITUTION</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider h-11">COUNTRY</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider h-11">TENANT ADMIN</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider h-11">PLAN</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider h-11 text-right">STUDENTS</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider h-11 text-right">STAFF</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider h-11 text-center">STATUS</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider h-11">LAST ACTIVE</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider h-11 text-right">ACTIONS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInstitutions.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-slate-500">No institutions found matching criteria.</TableCell></TableRow>
                ) : (
                  filteredInstitutions.map((inst) => {
                    const admin = tenantUsers?.find(u => u.institution_id === inst.id && (u.role === 'tenant_admin' || u.role === 'admin'));
                    const staffCount = tenantUsers?.filter(u => u.institution_id === inst.id && u.role !== 'candidate').length || 0;
                    const status = inst.status || (inst.is_active ? 'Active' : 'Inactive');
                    
                    return (
                      <TableRow key={inst.id} className="hover:bg-slate-50/50 cursor-pointer" onClick={() => setEditingInst(inst)}>
                        <TableCell>
                          <div className="flex items-center gap-3 py-1">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                              {inst.slug ? inst.slug.substring(0, 2) : inst.name.substring(0, 2)}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-800 text-sm line-clamp-1">{inst.name}</div>
                              <div className="text-xs text-slate-500 uppercase tracking-widest">{inst.slug || '—'}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Globe className="w-3.5 h-3.5 text-slate-400" />
                            {inst.country || '—'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-slate-800 font-medium">Admin</div>
                          <div className="text-xs text-slate-500 line-clamp-1 max-w-[150px]">{admin?.email || 'Unassigned'}</div>
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                            inst.plan === 'Enterprise' ? 'bg-purple-50 text-purple-600' :
                            inst.plan === 'Professional' ? 'bg-blue-50 text-blue-600' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {inst.plan || 'Starter'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-sm text-slate-800 font-medium">
                          {inst.student_volume || '—'}
                        </TableCell>
                        <TableCell className="text-right text-sm text-slate-800 font-medium">
                          {staffCount}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            status === 'Active' ? 'text-green-600 bg-green-50/50 border-green-200' :
                            status === 'Suspended' ? 'text-red-600 bg-red-50/50 border-red-200' : 
                            'text-orange-600 bg-orange-50/50 border-orange-200'
                          }`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${
                              status === 'Active' ? 'bg-green-500' :
                              status === 'Suspended' ? 'bg-red-500' : 'bg-orange-500'
                            }`}></div>
                            {status}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">
                          {status === 'Active' ? '2h ago' : '48d ago'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50" onClick={(e) => { e.stopPropagation(); setEditingInst(inst); }}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600 hover:bg-slate-100" onClick={(e) => e.stopPropagation()}>
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {/* Right Sidebar: Edit Institution */}
      <div className={`fixed top-0 right-0 h-full w-[400px] bg-white border-l shadow-2xl transition-transform duration-300 transform ${editingInst ? 'translate-x-0' : 'translate-x-full'} z-50 flex flex-col`}>
        {editingInst && (
          <>
            <div className="px-6 py-5 border-b flex justify-between items-center bg-slate-50/50">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Edit Institution</h2>
                <p className="text-xs text-slate-500">Update institution details and Tenant Admin</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setEditingInst(null)} className="h-8 w-8 text-slate-400 hover:bg-slate-200 rounded-full">
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <form id="edit-inst-form" onSubmit={handleSave} className="space-y-8">
                <div className="space-y-5">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Institution Details</h3>
                  
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-700">Institution Name <span className="text-red-500">*</span></Label>
                    <Input 
                      value={editingInst.name} 
                      onChange={e => setEditingInst({...editingInst, name: e.target.value})}
                      className="bg-slate-50/50"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-slate-700">Short Code</Label>
                      <Input 
                        value={editingInst.slug || ''} 
                        onChange={e => setEditingInst({...editingInst, slug: e.target.value})}
                        className="bg-slate-50/50 uppercase"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-slate-700">Country</Label>
                      <Input 
                        value={editingInst.country || ''} 
                        onChange={e => setEditingInst({...editingInst, country: e.target.value})}
                        className="bg-slate-50/50"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-slate-700">Address</Label>
                    <Input 
                      value={editingInst.address || ''} 
                      onChange={e => setEditingInst({...editingInst, address: e.target.value})}
                      className="bg-slate-50/50"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-slate-700">Website</Label>
                    <Input 
                      value={editingInst.website || ''} 
                      onChange={e => setEditingInst({...editingInst, website: e.target.value})}
                      className="bg-slate-50/50"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-slate-700">Plan</Label>
                      <Select value={editingInst.plan || 'Starter'} onValueChange={v => setEditingInst({...editingInst, plan: v})}>
                        <SelectTrigger className="bg-slate-50/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Enterprise">Enterprise</SelectItem>
                          <SelectItem value="Professional">Professional</SelectItem>
                          <SelectItem value="Starter">Starter</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-slate-700">Status</Label>
                      <Select value={editingInst.status || (editingInst.is_active ? 'Active' : 'Inactive')} onValueChange={v => setEditingInst({...editingInst, status: v})}>
                        <SelectTrigger className="bg-slate-50/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Active">Active</SelectItem>
                          <SelectItem value="Pending">Pending</SelectItem>
                          <SelectItem value="Suspended">Suspended</SelectItem>
                          <SelectItem value="Inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="space-y-5 pt-4 border-t">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tenant Admin</h3>
                  
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-700">Full Name <span className="text-red-500">*</span></Label>
                    <Input 
                      placeholder="Admin Name"
                      className="bg-slate-50/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-700">Email Address <span className="text-red-500">*</span></Label>
                    <Input 
                      placeholder="admin@institution.edu"
                      value={tenantUsers?.find(u => u.institution_id === editingInst.id && (u.role === 'tenant_admin' || u.role === 'admin'))?.email || ''}
                      readOnly
                      className="bg-slate-50/50 text-slate-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-700">Phone Number</Label>
                    <Input 
                      value={editingInst.phone || ''}
                      onChange={e => setEditingInst({...editingInst, phone: e.target.value})}
                      className="bg-slate-50/50"
                    />
                  </div>
                </div>
              </form>
            </div>
            
            <div className="p-6 border-t bg-slate-50 flex justify-end gap-3 mt-auto">
              <Button type="button" variant="outline" onClick={() => setEditingInst(null)} className="bg-white">
                Cancel
              </Button>
              <Button type="submit" form="edit-inst-form" disabled={updateInstitutionMutation.isPending} className="bg-blue-600 hover:bg-blue-700 text-white">
                {updateInstitutionMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}