import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { entities } from '@/api/entities';
import { apiClient } from '@/api/apiClient';
import { useTenantContext } from '@/hooks/useTenantContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, CheckCircle, Clock, Plus, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from 'sonner';

export default function TenantAdminDashboard() {
  const [isAddFacultyOpen, setIsAddFacultyOpen] = useState(false);
  const [newFaculty, setNewFaculty] = useState({ name: '', email: '' });
  const [isAddingFaculty, setIsAddingFaculty] = useState(false);
  const { user, tenantId } = useTenantContext();

  const handleAddFaculty = async (e) => {
    e.preventDefault();
    if (!tenantId) {
      toast.error('Dashboard context not loaded. Please wait...');
      return;
    }
    setIsAddingFaculty(true);

    try {
      await apiClient.post('/invite-user', {
        email: newFaculty.email,
        role: 'tenant_executive',
        institution_id: tenantId,
        full_name: newFaculty.name
      });
      toast.success("Faculty added successfully");
      setIsAddFacultyOpen(false);
      setNewFaculty({ name: '', email: '' });
    } catch (err) {
      console.error("Invite Faculty Error");

      toast.error(
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to add faculty"
      );
    } finally {
      setIsAddingFaculty(false);
    }
  };

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats', tenantId],
    queryFn: async () => {
      if (!tenantId) return { candidates: 0, exams: 0, results: 0, passed: 0 };
      const [candidates, exams, results] = await Promise.all([
        entities.Student.filter({ institution_id: tenantId }),
        entities.Exam.filter({ institution_id: tenantId }),
        entities.Result.filter({ institution_id: tenantId })
      ]);
      return {
        candidates: candidates.length,
        exams: exams.length,
        results: results.length,
        passed: results.filter(r => r.passed).length
      };
    },
    enabled: !!tenantId,
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <Dialog open={isAddFacultyOpen} onOpenChange={setIsAddFacultyOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-primary">
              <Plus className="w-4 h-4" /> Add Faculty
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Faculty Member</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddFaculty} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input required value={newFaculty.name} onChange={e => setNewFaculty({...newFaculty, name: e.target.value})} placeholder="Jane Smith" />
              </div>
              <div className="space-y-2">
                <Label>Email Address</Label>
                <Input type="email" required value={newFaculty.email} onChange={e => setNewFaculty({...newFaculty, email: e.target.value})} placeholder="jane@example.com" />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsAddFacultyOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isAddingFaculty}>
                  {isAddingFaculty && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Send Invite
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Candidates</CardTitle>
            <Users className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? '-' : stats?.candidates || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Exams</CardTitle>
            <FileText className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? '-' : stats?.exams || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Exams Completed</CardTitle>
            <CheckCircle className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? '-' : stats?.results || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Passed Candidates</CardTitle>
            <Clock className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? '-' : stats?.passed || 0}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}