import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTenantContext } from '@/hooks/useTenantContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldAlert, CheckCircle, XCircle } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from 'sonner';

export default function PostExamAudit() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const examFilter = searchParams.get('exam');
  const candidateFilter = searchParams.get('candidate');

  const [selectedVideo, setSelectedVideo] = useState(null);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);

  const { user, tenantId } = useTenantContext();

  const { data: violations, isLoading: isLoadingViolations } = useQuery({
    queryKey: ['violations', tenantId, examFilter, candidateFilter],
    queryFn: () => {
      let filterObj = { tenant_id: tenantId };
      if (examFilter) filterObj.exam_id = examFilter;
      if (candidateFilter) filterObj.candidate_id = candidateFilter;
      return base44.entities.Violation.filter(filterObj, '-timestamp');
    },
    enabled: !!tenantId,
  });

  const { data: attempt } = useQuery({
    queryKey: ['attempt', examFilter, candidateFilter],
    queryFn: async () => {
      const res = await base44.entities.ExamAttempt.filter({ exam_id: examFilter, candidate_id: candidateFilter });
      return res[0];
    },
    enabled: !!examFilter && !!candidateFilter,
  });

  const { data: result } = useQuery({
    queryKey: ['result', examFilter, candidateFilter],
    queryFn: async () => {
      const res = await base44.entities.Result.filter({ exam_id: examFilter, candidate_id: candidateFilter });
      return res[0];
    },
    enabled: !!examFilter && !!candidateFilter,
  });

  const updateResultMutation = useMutation({
    mutationFn: (newStatus) => base44.entities.Result.update(result.id, { final_result_status: newStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['result'] });
      toast.success('Result status updated successfully');
      navigate('/proctoring-review');
    }
  });

  const handleOverrideApprove = () => updateResultMutation.mutate("Auto-Approved Pass");
  const handleInvalidateExam = () => updateResultMutation.mutate("Failed");

  const openVideo = (url) => {
    setSelectedVideo(url);
    setIsVideoModalOpen(true);
  };

  const isDetailView = examFilter && candidateFilter;

  if (isDetailView) {
    if (!attempt || !result || isLoadingViolations) {
      return <div className="flex items-center justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
    }

    const startTime = new Date(attempt.created_date).getTime();
    const endTime = new Date(attempt.updated_date).getTime();
    const duration = Math.max(endTime - startTime, 1000); // Prevent divide by zero

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-primary" />
            Candidate Evidence Detail
          </h1>
          <p className="text-muted-foreground mt-1">Review candidate timeline and violations.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Exam Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative w-full h-12 bg-slate-200 rounded-full my-8">
              <div className="absolute top-0 left-0 h-full bg-primary/10 rounded-full w-full" />
              {violations?.map((v) => {
                const vTime = new Date(v.timestamp).getTime();
                // constrain between 0 and 100
                const percent = Math.min(Math.max(((vTime - startTime) / duration) * 100, 0), 100);
                const isFocusLoss = v.type.includes("Focus Loss");

                return (
                  <div key={v.id} className="absolute top-0 bottom-0 flex items-center" style={{ left: `${percent}%` }}>
                    {isFocusLoss ? (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="w-6 h-6 bg-red-400 rounded-full border-2 border-white shadow-md transform -translate-x-1/2 hover:scale-110 transition-transform cursor-pointer focus:outline-none" />
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-3 text-sm z-50 bg-white shadow-lg border">
                          <p className="font-semibold text-red-700">Focus Loss Detected</p>
                          <p className="text-slate-600 mt-1">The candidate navigated away from the exam tab at {new Date(v.timestamp).toLocaleTimeString()}</p>
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <button 
                        onClick={() => openVideo(v.media_url)}
                        className="w-6 h-6 bg-red-700 rounded-full border-2 border-white shadow-md transform -translate-x-1/2 hover:scale-110 transition-transform cursor-pointer focus:outline-none" 
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-sm text-slate-500 font-medium px-2">
              <span>Start: {new Date(startTime).toLocaleTimeString()}</span>
              <span>End: {new Date(endTime).toLocaleTimeString()}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Final Verdict</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="grid md:grid-cols-2 gap-4">
                <Button 
                  onClick={handleOverrideApprove}
                  className="w-full h-16 text-lg bg-green-600 hover:bg-green-700 gap-2"
                >
                  <CheckCircle className="w-6 h-6" />
                  Override & Approve
                </Button>
                <Button 
                  onClick={handleInvalidateExam}
                  className="w-full h-16 text-lg bg-red-600 hover:bg-red-700 gap-2"
                >
                  <XCircle className="w-6 h-6" />
                  Invalidate Exam
                </Button>
             </div>
          </CardContent>
        </Card>

        <Dialog open={isVideoModalOpen} onOpenChange={setIsVideoModalOpen}>
          <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden bg-black border-0">
            <DialogHeader className="p-4 bg-slate-900 text-white absolute top-0 w-full z-10 bg-opacity-80">
              <DialogTitle>Critical Violation Evidence</DialogTitle>
            </DialogHeader>
            {selectedVideo && (
              <video 
                src={selectedVideo} 
                controls 
                autoPlay 
                className="w-full aspect-video object-contain pt-14"
              />
            )}
          </DialogContent>
        </Dialog>

      </div>
    );
  }

  // Original list view
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <ShieldAlert className="w-8 h-8 text-primary" />
          Post-Exam Audit Dashboard
        </h1>
        <p className="text-muted-foreground mt-1">Review AI-flagged violations and video evidence.</p>
      </div>

      {isLoadingViolations ? (
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      ) : violations?.length === 0 ? (
        <p className="text-muted-foreground">No violations recorded.</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {violations?.map(v => (
            <Card key={v.id} className="overflow-hidden">
              <CardHeader className="bg-slate-50 border-b pb-4">
                <CardTitle className="text-lg text-red-700">{v.type}</CardTitle>
                <p className="text-sm text-muted-foreground font-medium">{new Date(v.timestamp).toLocaleString()}</p>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-slate-500 block">Candidate ID</span>
                    <span className="font-medium text-slate-800">{v.candidate_id}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Exam ID</span>
                    <span className="font-medium text-slate-800">{v.exam_id}</span>
                  </div>
                </div>
                {v.media_url ? (
                  <div className="mt-4">
                    <span className="text-slate-500 text-sm block mb-2">Video Evidence</span>
                    <video 
                      src={v.media_url} 
                      controls 
                      className="w-full rounded-md bg-black shadow-sm aspect-video object-contain" 
                    />
                  </div>
                ) : (
                  <div className="mt-4 p-4 bg-slate-100 rounded-md flex items-center justify-center text-slate-500 text-sm italic aspect-video">
                    No video evidence available
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}