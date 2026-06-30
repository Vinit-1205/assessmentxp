import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entities } from '@/api/entities';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Eye, CloudUpload, ArrowLeft, Rocket, Trash2, Loader2 } from "lucide-react";
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import QuestionsTab from './QuestionsTab';
import ProctoringTab from './ProctoringTab';
import SchedulingTab from './SchedulingTab';
import DeploymentTab from './DeploymentTab';

export default function ExamEditor({ examId, onBack }) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('questions');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const { data: exam, isLoading: examLoading } = useQuery({
    queryKey: ['exam', examId],
    queryFn: () => entities.Exam.get(examId),
  });

  const { data: questions, isLoading: questionsLoading } = useQuery({
    queryKey: ['questions', examId],
    queryFn: () => entities.Question.filter({ exam_id: examId }),
  });

  // Silent update — no toast, used for onChange on inputs
  const updateExamMutation = useMutation({
    mutationFn: (data) => entities.Exam.update(examId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exam', examId] });
    }
  });

  const deleteExamMutation = useMutation({
    mutationFn: () => entities.Exam.delete(examId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exams'] });
      toast.success('Exam deleted successfully');
      onBack();
    },
    onError: (err) => {
      toast.error('Failed to delete exam: ' + err.message);
    }
  });

  if (examLoading || questionsLoading) return <div className="p-8">Loading...</div>;
  if (!exam) return <div className="p-8">Exam not found</div>;

  const totalPoints = questions?.reduce((sum, q) => sum + (q.marks_awarded || 0), 0) || 0;

  return (
    <div className="flex flex-col h-[calc(100vh)] bg-slate-50 -m-8 overflow-hidden">
      <header className="bg-white border-b px-6 py-4 flex justify-between items-center shrink-0 z-20">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack} className="text-slate-500">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-blue-500" />
            <div>
              <input 
                value={exam.title} 
                onChange={e => updateExamMutation.mutate({ title: e.target.value })}
                className="text-lg font-bold text-slate-800 bg-transparent border-none outline-none p-0 focus:ring-0 focus:underline"
                placeholder="Exam Title"
              />
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                <input 
                  value={exam.course_id || ''} 
                  onChange={e => updateExamMutation.mutate({ course_id: e.target.value })}
                  className="bg-transparent border-none outline-none p-0 focus:ring-0 focus:underline w-24 placeholder:text-slate-400"
                  placeholder="Course ID"
                />
                <span>•</span>
                <span>{questions?.length || 0} questions</span>
                <span>•</span>
                <span>{totalPoints} pts</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
            exam.status === 'published'
              ? 'bg-green-50 text-green-700 border-green-200'
              : 'bg-orange-50 text-orange-600 border-orange-100'
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${
              exam.status === 'published' ? 'bg-green-500' : 'bg-orange-500'
            }`}></div>
            {exam.status.charAt(0).toUpperCase() + exam.status.slice(1)}
          </div>
          {exam.status === 'published' ? (
            <Button
              variant="outline"
              className="gap-2 text-slate-600"
              onClick={() => updateExamMutation.mutate({ status: 'draft' }, { onSuccess: () => toast.success('Exam unpublished') })}
              disabled={updateExamMutation.isPending}
            >
              Unpublish
            </Button>
          ) : (
            <Button
              className="bg-green-600 hover:bg-green-700 text-white gap-2"
              onClick={() => {
                updateExamMutation.mutate(
                  { status: 'published' },
                  { onSuccess: () => toast.success('🎉 Exam published! It will now appear in Exam Deployment.') }
                );
              }}
              disabled={updateExamMutation.isPending}
            >
              <Rocket className="w-4 h-4" /> Publish Exam
            </Button>
          )}
          <Button variant="outline" className="gap-2 text-slate-600">
            <Eye className="w-4 h-4" /> Preview
          </Button>
          <Button
            className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
            onClick={() => toast.success('Exam saved successfully')}
          >
            <CloudUpload className="w-4 h-4" /> Save Exam
          </Button>
          <Button 
            variant="outline" 
            className="gap-2 text-red-600 border-red-200 hover:bg-red-50"
            onClick={() => setIsDeleteModalOpen(true)}
          >
            <Trash2 className="w-4 h-4" /> Delete Exam
          </Button>
        </div>
      </header>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Exam</DialogTitle>
          </DialogHeader>
          <div className="pt-2 space-y-4">
            <p className="text-muted-foreground">
              Are you sure you want to delete the exam <span className="font-semibold text-foreground">"{exam.title}"</span>? This will permanently delete the exam, its questions, settings, and any student attempts or scores associated with it. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>Cancel</Button>
              <Button 
                variant="destructive" 
                onClick={() => deleteExamMutation.mutate()} 
                disabled={deleteExamMutation.isPending}
              >
                {deleteExamMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Delete Permanently
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
        <div className="bg-white border-b px-6 shrink-0">
          <TabsList className="bg-transparent border-b-0 h-12 w-full justify-start gap-6 rounded-none p-0">
            <TabsTrigger value="questions" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none h-full px-2 text-slate-500 data-[state=active]:text-blue-600 font-medium">
              Questions
            </TabsTrigger>
            <TabsTrigger value="proctoring" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none h-full px-2 text-slate-500 data-[state=active]:text-blue-600 font-medium">
              Proctoring
            </TabsTrigger>
            <TabsTrigger value="scheduling" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none h-full px-2 text-slate-500 data-[state=active]:text-blue-600 font-medium">
              Scheduling
            </TabsTrigger>
            <TabsTrigger value="deployment" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none h-full px-2 text-slate-500 data-[state=active]:text-blue-600 font-medium">
              Deployment
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          <TabsContent value="questions" className="m-0 h-full overflow-hidden">
            <QuestionsTab exam={exam} questions={questions || []} />
          </TabsContent>
          <TabsContent value="proctoring" className="m-0 h-full p-8">
            <ProctoringTab exam={exam} onUpdate={(data) => updateExamMutation.mutate(data)} />
          </TabsContent>
          <TabsContent value="scheduling" className="m-0 h-full p-8">
            <SchedulingTab exam={exam} onUpdate={(data) => updateExamMutation.mutate(data)} />
          </TabsContent>
          <TabsContent value="deployment" className="m-0 h-full p-8">
            <DeploymentTab exam={exam} questions={questions || []} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}