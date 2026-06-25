import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTenantContext } from '@/hooks/useTenantContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import ExamEditor from '@/components/exam-builder/ExamEditor';

export default function ExamBuilder() {
  const [selectedExamId, setSelectedExamId] = useState(null);
  const { tenantId } = useTenantContext();

  const { data: exams, isLoading } = useQuery({
    queryKey: ['exams', tenantId],
    queryFn: async () => await base44.entities.Exam.filter({ institution_id: tenantId }, '-created_date'),
    enabled: !!tenantId,
  });

  const createExamMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('createExam', {
        title: 'New Exam',
        course_id: '',
        institution_id: tenantId,
        status: 'draft'
      });
      return response?.data?.exam || response?.exam;
    },
    onSuccess: (exam) => {
      setSelectedExamId(exam.id);
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
          <Plus className="w-4 h-4" /> Create New Exam
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <p className="text-muted-foreground">Loading exams...</p>
        ) : exams?.length === 0 ? (
          <p className="text-muted-foreground col-span-full">No exams created yet. Click "Create New Exam" to begin.</p>
        ) : (
          exams?.map(exam => (
            <Card key={exam.id} className="cursor-pointer hover:shadow-md transition-shadow border-slate-200" onClick={() => setSelectedExamId(exam.id)}>
              <CardHeader>
                <CardTitle className="text-xl">{exam.title}</CardTitle>
                <p className="text-sm text-muted-foreground">{new Date(exam.created_date).toLocaleDateString()}</p>
              </CardHeader>
              <CardContent>
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
    </div>
  );
}