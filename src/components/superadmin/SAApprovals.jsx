import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

export default function SAApprovals() {
  const queryClient = useQueryClient();

  const { data: pendingInstitutions, isLoading } = useQuery({
    queryKey: ['pending_institutions'],
    queryFn: async () => {
      return await base44.entities.Institution.filter({ status: 'Pending' });
    }
  });

  const { data: tenantAdmins } = useQuery({
    queryKey: ['tenant_users_all'],
    queryFn: async () => {
      return await base44.entities.TenantUser.filter({ role: 'tenant_admin' });
    }
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, tenantUserId }) => {
      await base44.entities.Institution.update(id, { status: 'Active' });
      if (tenantUserId) {
         await base44.entities.TenantUser.update(tenantUserId, { is_active: true });
      }
    },
    onSuccess: () => {
      toast.success("Institution approved successfully");
      queryClient.invalidateQueries({ queryKey: ['pending_institutions'] });
    },
    onError: (err) => {
      toast.error(err.message || "Failed to approve institution");
    }
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, tenantUserId }) => {
      if (tenantUserId) {
        await base44.entities.TenantUser.delete(tenantUserId);
      }
      await base44.entities.Institution.delete(id);
    },
    onSuccess: () => {
      toast.success("Institution request rejected");
      queryClient.invalidateQueries({ queryKey: ['pending_institutions'] });
    },
    onError: (err) => {
      toast.error(err.message || "Failed to reject institution");
    }
  });

  if (isLoading) {
    return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  if (!pendingInstitutions || pendingInstitutions.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <ShieldCheck className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-slate-800">No Pending Approvals</h3>
        <p className="text-slate-500 mt-2">All institution registrations have been processed.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead>Institution Name</TableHead>
              <TableHead>Domain/Slug</TableHead>
              <TableHead>Admin Email</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pendingInstitutions.map((inst) => {
              const admin = tenantAdmins?.find(tu => tu.institution_id === inst.id);
              
              return (
                <TableRow key={inst.id}>
                  <TableCell className="font-medium text-slate-800">{inst.name}</TableCell>
                  <TableCell>
                    <div className="text-sm">{inst.domain || '-'}</div>
                    <div className="text-xs text-slate-500 font-mono">{inst.slug}</div>
                  </TableCell>
                  <TableCell>{admin?.email || 'Unknown'}</TableCell>
                  <TableCell>
                    <div className="text-sm">{inst.country}</div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => {
                          if (confirm("Are you sure you want to reject and delete this registration?")) {
                            rejectMutation.mutate({ id: inst.id, tenantUserId: admin?.id });
                          }
                        }}
                      >
                        <X className="w-4 h-4 mr-1" /> Reject
                      </Button>
                      <Button 
                        size="sm" 
                        className="bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => approveMutation.mutate({ id: inst.id, tenantUserId: admin?.id })}
                      >
                        <Check className="w-4 h-4 mr-1" /> Approve
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}