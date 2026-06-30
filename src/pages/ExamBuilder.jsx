import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entities } from '@/api/entities';
import { apiClient } from '@/api/apiClient';
import { useTenantContext } from '@/hooks/useTenantContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Loader2 } from "lucide-react";
import ExamEditor from '@/components/exam-builder/ExamEditor';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from 'sonner';

export default function ExamBuilder() {
  const queryClient = useQueryClient();
  const [selectedExamId, setSelectedExamId] = useState(null);
  const { tenantId } = useTenantContext();
  const [examToDelete, setExamToDelete] = useState(null);

  const { data: exams, isLoading } = useQuery({
    queryKey: ['exams', tenantId],
    queryFn: async () => await entities.Exam.filter({ institution_id: tenantId }, '-created_at'),
    enabled: !!tenantId,
  });

  const createExamMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post('/create-exam', {
        title: 'New Exam',
        course_id: '',
        institution_id: tenantId,
        status: 'draft'
      });
      return response?.exam || response;
    },
    onSuccess: (exam) => {
      setSelectedExamId(exam.id);
    }
  });

  const deleteExamMutation = useMutation({
    mutationFn: (id) => entities.Exam.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exams', tenantId] });
      toast.success('Exam deleted successfully');
      setExamToDelete(null);
    },
    onError: (err) => {
      toast.error('Failed to delete exam: ' + err.message);
    }
  });

  if (selectedExamId) {
    return <ExamEditor examId={selectedExamId} onBack={() => setSelectedExamId(null)} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Exam Builder</h1>
          <p className="text-muted-foreground mt-1">Create and manage your assessments.</p>
        </div>
        <Button onClick={() => createExamMutation.mutate()} disabled={createExamMutation.isPending} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
          {createExamMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Create New Exam
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <p className="text-muted-foreground">Loading exams...</p>
        ) : exams?.length === 0 ? (
          <p className="text-muted-foreground col-span-full">No exams created yet. Click "Create New Exam" to begin.</p>
        ) : (
          exams?.map(exam => (
            <Card key={exam.id} className="cursor-pointer hover:shadow-md transition-shadow border-slate-200 relative flex flex-col justify-between" onClick={() => setSelectedExamId(exam.id)}>
              <CardHeader className="flex flex-row justify-between items-start space-y-0 pb-2">
                <div className="space-y-1">
                  <CardTitle className="text-xl line-clamp-1">{exam.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">{new Date(exam.created_date).toLocaleDateString()}</p>
                </div>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="text-red-500 hover:text-red-700 hover:bg-red-50 -mt-1 -mr-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExamToDelete(exam);
                  }}
                >
                  <Trash2 className="w-4.5 h-4.5" />
                </Button>
              </CardHeader>
              <CardContent className="mt-2">
                <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{exam.description || 'No description'}</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className={`px-2 py-1 rounded-full font-medium ${
                    exam.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {exam.status.charAt(0).toUpperCase() + exam.status.slice(1)}
                  </span>
                  <span className="px-2 py-1 bg-slate-100 rounded-full font-medium text-slate-700">
                    {exam.duration_minutes || 60} mins
                  </span>
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full font-medium">
                    {exam.total_marks || 0} pts
                  </span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <Dialog open={!!examToDelete} onOpenChange={(open) => !open && setExamToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Exam</DialogTitle>
          </DialogHeader>
          <div className="pt-2 space-y-4">
            <p className="text-muted-foreground">
              Are you sure you want to delete the exam <span className="font-semibold text-foreground">"{examToDelete?.title}"</span>? This will permanently delete the exam, its questions, settings, and any student attempts or scores associated with it. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setExamToDelete(null)}>Cancel</Button>
              <Button 
                variant="destructive" 
                onClick={() => deleteExamMutation.mutate(examToDelete.id)} 
                disabled={deleteExamMutation.isPending}
              >
                {deleteExamMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Delete Permanently
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}