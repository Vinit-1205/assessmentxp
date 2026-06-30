import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { entities } from '@/api/entities';
import { apiClient } from '@/api/apiClient';
import { useTenantContext } from '@/hooks/useTenantContext';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Upload, Plus, AlertCircle, Loader2, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function CandidateManagement() {
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);

  const { tenantId } = useTenantContext();

  const { data: students, isLoading } = useQuery({
    queryKey: ['candidates', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const studentRecords = await entities.Student.filter({ institution_id: tenantId }, '-created_at');
      const users = await Promise.all(studentRecords.map(s => entities.User.get(s.user_id).catch(() => null)));
      return studentRecords.map((s, idx) => ({ ...s, user: users[idx] }));
    },
    enabled: !!tenantId,
  });

  // ── Add ──
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCandidate, setNewCandidate] = useState({ name: '', email: '' });
  const [isAdding, setIsAdding] = useState(false);

  // ── Edit ──
  const [editStudent, setEditStudent] = useState(null);
  const [editName, setEditName] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // ── Delete ──
  const [deleteStudent, setDeleteStudent] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleAddCandidate = async (e) => {
    e.preventDefault();
    if (!tenantId) return toast.error("You must belong to a tenant to add candidates.");
    setIsAdding(true);
    try {
      await apiClient.post('/invite-user', {
        email: newCandidate.email,
        role: 'candidate',
        institution_id: tenantId,
        full_name: newCandidate.name
      });
      toast.success("Candidate added successfully");
      setIsAddModalOpen(false);
      setNewCandidate({ name: '', email: '' });
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
    } catch (err) {
      toast.error("Failed to add candidate: " + err.message);
    } finally {
      setIsAdding(false);
    }
  };

  const handleEditOpen = (student) => {
    setEditStudent(student);
    setEditName(student.user?.full_name || student.student_identifier || '');
    setIsEditModalOpen(true);
  };

  const editMutation = useMutation({
    mutationFn: async () => {
      // Update the user's full name in the users table
      if (editStudent?.user_id) {
        await entities.User.update(editStudent.user_id, { full_name: editName });
      }
    },
    onSuccess: () => {
      toast.success('Candidate updated');
      setIsEditModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
    },
    onError: (err) => toast.error('Update failed: ' + err.message),
  });

  const handleDeleteOpen = (student) => {
    setDeleteStudent(student);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteStudent) return;
    setIsDeleting(true);
    try {
      await entities.Student.delete(deleteStudent.id);
      toast.success('Candidate removed');
      setIsDeleteModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
    } catch (err) {
      toast.error('Delete failed: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!tenantId) { toast.error("You must belong to a tenant to upload candidates."); return; }
    setIsUploading(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      if (lines.length < 2) { toast.error("CSV file is empty or missing data."); return; }
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const emailIdx = headers.indexOf('email');
      const nameIdx = headers.indexOf('name') !== -1 ? headers.indexOf('name') : headers.indexOf('full_name');
      if (emailIdx === -1) { toast.error("CSV must contain an 'email' column."); return; }
      let successCount = 0;
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim());
        if (cols.length > emailIdx && cols[emailIdx]) {
          const email = cols[emailIdx];
          const fullName = nameIdx !== -1 && cols[nameIdx] ? cols[nameIdx] : email.split('@')[0];
          try {
            await apiClient.post('/invite-user', { email, role: 'candidate', institution_id: tenantId, full_name: fullName });
            successCount++;
          } catch (err) { console.error('Failed to invite:', email, err); }
        }
      }
      if (successCount > 0) {
        toast.success(`Successfully processed ${successCount} candidates from CSV`);
        queryClient.invalidateQueries({ queryKey: ['candidates'] });
      } else {
        toast.error("No candidates were successfully added.");
      }
    } catch (err) {
      toast.error("Failed to parse CSV file");
    } finally {
      setIsUploading(false);
      e.target.value = null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Candidate Management</h1>
          <p className="text-muted-foreground mt-1">Manage tenant candidates and bulk upload.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="relative">
            <Input type="file" accept=".csv" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleFileUpload} disabled={isUploading} />
            <Button variant="outline" className="gap-2" disabled={isUploading}>
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {isUploading ? "Processing..." : "Bulk Upload CSV"}
            </Button>
          </div>
          <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="w-4 h-4" /> Add Candidate
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add New Candidate</DialogTitle></DialogHeader>
              <form onSubmit={handleAddCandidate} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input required value={newCandidate.name} onChange={e => setNewCandidate({ ...newCandidate, name: e.target.value })} placeholder="John Doe" />
                </div>
                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <Input type="email" required value={newCandidate.email} onChange={e => setNewCandidate({ ...newCandidate, email: e.target.value })} placeholder="john@example.com" />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={isAdding}>
                    {isAdding && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Add Candidate
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="bg-card border rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    <div className="flex justify-center items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" /> Loading candidates...
                    </div>
                  </TableCell>
                </TableRow>
              ) : students?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <AlertCircle className="w-8 h-8 text-muted-foreground/50" />
                      <p>No candidates found. Upload a CSV to get started.</p>
                      <p className="text-sm">CSV should have headers: name, email</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                students?.map(student => (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium">{student.user?.full_name || student.student_identifier || 'N/A'}</TableCell>
                    <TableCell>{student.user?.email || 'N/A'}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        student.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {(student.status || 'unknown').charAt(0).toUpperCase() + (student.status || 'unknown').slice(1)}
                      </span>
                    </TableCell>
                    <TableCell>{new Date(student.created_at || student.created_date).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => handleEditOpen(student)}>
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 gap-1 text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleDeleteOpen(student)}>
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Candidate</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Email (read-only)</Label>
              <Input value={editStudent?.user?.email || ''} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Full name" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
              <Button onClick={() => editMutation.mutate()} disabled={editMutation.isPending}>
                {editMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Remove Candidate</DialogTitle></DialogHeader>
          <div className="pt-2 space-y-4">
            <p className="text-muted-foreground">
              Are you sure you want to remove <span className="font-semibold text-foreground">{deleteStudent?.user?.email || deleteStudent?.student_identifier}</span>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDeleteConfirm} disabled={isDeleting}>
                {isDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Remove Candidate
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}