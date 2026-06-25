import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTenantContext } from '@/hooks/useTenantContext';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Upload, Plus, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function CandidateManagement() {
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);
  
  const { user, tenantId } = useTenantContext();

  const { data: students, isLoading } = useQuery({
    queryKey: ['candidates', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const studentRecords = await base44.entities.Student.filter({ institution_id: tenantId }, '-created_date');
      // Fetch users for these students
      const users = await Promise.all(studentRecords.map(s => base44.entities.User.get(s.user_id).catch(() => null)));
      return studentRecords.map((s, idx) => ({ ...s, user: users[idx] }));
    },
    enabled: !!tenantId,
  });

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCandidate, setNewCandidate] = useState({ name: '', email: '' });
  const [isAdding, setIsAdding] = useState(false);

  const handleAddCandidate = async (e) => {
    e.preventDefault();
    if (!tenantId) return toast.error("You must belong to a tenant to add candidates.");
    
    setIsAdding(true);
    try {
      await base44.functions.invoke('inviteUser', {
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
      console.error(err);
    } finally {
      setIsAdding(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!tenantId) {
      toast.error("You must belong to a tenant to upload candidates.");
      return;
    }

    setIsUploading(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        toast.error("CSV file is empty or missing data.");
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const emailIdx = headers.indexOf('email');
      const nameIdx = headers.indexOf('name') !== -1 ? headers.indexOf('name') : headers.indexOf('full_name');
      
      if (emailIdx === -1) {
        toast.error("CSV must contain an 'email' column.");
        return;
      }

      let successCount = 0;
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim());
        if (cols.length > emailIdx && cols[emailIdx]) {
          const email = cols[emailIdx];
          const fullName = nameIdx !== -1 && cols[nameIdx] ? cols[nameIdx] : email.split('@')[0];
          
          try {
            await base44.functions.invoke('inviteUser', {
              email: email,
              role: 'candidate',
              institution_id: tenantId,
              full_name: fullName
            });
            successCount++;
          } catch (err) {
            console.error('Failed to invite:', email, err);
          }
        }
      }
      
      if (successCount > 0) {
        toast.success(`Successfully processed ${successCount} candidates from CSV`);
        queryClient.invalidateQueries({ queryKey: ['candidates'] });
      } else {
        toast.error("No candidates were successfully added. Ensure emails are valid.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to parse CSV file");
    } finally {
      setIsUploading(false);
      e.target.value = null; 
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Candidate Management</h1>
          <p className="text-muted-foreground mt-1">Manage tenant candidates and bulk upload.</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Input 
              type="file" 
              accept=".csv" 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
              onChange={handleFileUpload}
              disabled={isUploading}
            />
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
              <DialogHeader>
                <DialogTitle>Add New Candidate</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddCandidate} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input 
                    required 
                    value={newCandidate.name} 
                    onChange={e => setNewCandidate({...newCandidate, name: e.target.value})} 
                    placeholder="John Doe" 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <Input 
                    type="email" 
                    required 
                    value={newCandidate.email} 
                    onChange={e => setNewCandidate({...newCandidate, email: e.target.value})} 
                    placeholder="john@example.com" 
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={isAdding}>
                    {isAdding && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Add Candidate
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="bg-card border rounded-lg overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                  <div className="flex justify-center items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" /> Loading candidates...
                  </div>
                </TableCell>
              </TableRow>
            ) : students?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
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
                  <TableCell className="font-medium">{student.student_identifier || student.user?.full_name || 'N/A'}</TableCell>
                  <TableCell>{student.user?.email || 'N/A'}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      student.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {student.status.charAt(0).toUpperCase() + student.status.slice(1)}
                    </span>
                  </TableCell>
                  <TableCell>{new Date(student.created_date).toLocaleDateString()}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}