import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Eye, CloudUpload, ArrowLeft } from "lucide-react";
import { toast } from 'sonner';

import QuestionsTab from './QuestionsTab';
import ProctoringTab from './ProctoringTab';
import SchedulingTab from './SchedulingTab';
import DeploymentTab from './DeploymentTab';

export default function ExamEditor({ examId, onBack }) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('questions');

  const { data: exam, isLoading: examLoading } = useQuery({
    queryKey: ['exam', examId],
    queryFn: () => base44.entities.Exam.get(examId),
  });

  const { data: questions, isLoading: questionsLoading } = useQuery({
    queryKey: ['questions', examId],
    queryFn: () => base44.entities.Question.filter({ exam_id: examId }),
  });

  const updateExamMutation = useMutation({
    mutationFn: (data) => base44.entities.Exam.update(examId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exam', examId] });
      toast.success('Exam saved');
    }
  });

  if (examLoading || questionsLoading) return <div className="p-8">Loading...</div>;
  if (!exam) return <div className="p-8">Exam not found</div>;

  const totalPoints = questions?.reduce((sum, q) => sum + (q.marks_awarded || 0), 0) || 0;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 -m-6"> {/* Negative margin to counteract padding from layout if any, making it full bleed */}
      <header className="bg-white border-b px-6 py-4 flex justify-between items-center sticky top-0 z-20">
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
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 text-orange-600 text-xs font-medium border border-orange-100">
            <div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div>
            {exam.status.charAt(0).toUpperCase() + exam.status.slice(1)}
          </div>
          <Button variant="outline" className="gap-2 text-slate-600">
            <Eye className="w-4 h-4" /> Preview
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2" onClick={() => toast.success('Exam saved successfully')}>
            <CloudUpload className="w-4 h-4" /> Save Exam
          </Button>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1">
        <div className="bg-white border-b px-6">
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

        <div className="flex-1 overflow-auto">
          <TabsContent value="questions" className="m-0 h-full">
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