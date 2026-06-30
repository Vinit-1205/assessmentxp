import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entities } from '@/api/entities';
import { useTenantContext } from '@/hooks/useTenantContext';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldAlert, CheckCircle, XCircle, AlertTriangle, Eye, BookOpen, Lock, SendHorizonal } from 'lucide-react';
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

  const [selectedMedia, setSelectedMedia] = useState(null);
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);

  const { tenantId } = useTenantContext();
  const { user } = useAuth();

  const { data: violations, isLoading: isLoadingViolations } = useQuery({
    queryKey: ['violations', tenantId, examFilter, candidateFilter],
    queryFn: () => {
      let filterObj = { institution_id: tenantId };
      if (examFilter) filterObj.exam_id = examFilter;
      if (candidateFilter) filterObj.candidate_id = candidateFilter;
      return entities.Violation.filter(filterObj, '-created_at');
    },
    enabled: !!tenantId,
  });

  const { data: tenantUsers } = useQuery({
    queryKey: ['tenantUsers', tenantId],
    queryFn: () => entities.TenantUser.filter({ institution_id: tenantId }),
    enabled: !!tenantId,
  });

  const { data: attempt } = useQuery({
    queryKey: ['attempt', examFilter, candidateFilter],
    queryFn: async () => {
      const res = await entities.ExamAttempt.filter({ exam_id: examFilter, candidate_id: candidateFilter });
      return res[0];
    },
    enabled: !!examFilter && !!candidateFilter,
  });

  const { data: result } = useQuery({
    queryKey: ['result', examFilter, candidateFilter],
    queryFn: async () => {
      const res = await entities.Result.filter({ exam_id: examFilter, candidate_id: candidateFilter });
      return res[0];
    },
    enabled: !!examFilter && !!candidateFilter,
  });

  const updateResultMutation = useMutation({
    mutationFn: (newStatus) => entities.Result.update(result.id, {
      final_result_status: newStatus,
      reviewed_by: user?.id || null,
      reviewed_at: new Date().toISOString(),
      reviewer_email: user?.email || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['result'] });
      queryClient.invalidateQueries({ queryKey: ['results'] });
      toast.success('Result status updated successfully');
      navigate('/proctoring-review');
    }
  });

  const handleOverrideApprove = () => updateResultMutation.mutate("Auto-Approved Pass");
  const handleInvalidateExam = () => updateResultMutation.mutate("Failed");

  const releaseResultsMutation = useMutation({
    mutationFn: () => entities.Result.update(result.id, { is_released: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['result'] });
      toast.success('Result has been released to the student.');
    },
    onError: () => toast.error('Failed to release result.')
  });

  const openMedia = (url) => {
    setSelectedMedia(url);
    setIsMediaModalOpen(true);
  };

  const isDetailView = examFilter && candidateFilter;

  // ──────────── DETAIL VIEW ────────────
  if (isDetailView) {
    if (!attempt || !result || isLoadingViolations) {
      return (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      );
    }

    const startTime = new Date(attempt.created_at || attempt.created_date).getTime();
    const endTime = new Date(attempt.updated_at || attempt.updated_date).getTime();
    const duration = Math.max(endTime - startTime, 1000);
    const candidateEmail =
      tenantUsers?.find(u => u.user_id === candidateFilter)?.email ||
      candidateFilter.substring(0, 8) + '...';

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <ShieldAlert className="w-8 h-8 text-primary" />
              Candidate Evidence Detail
            </h1>
            <p className="text-muted-foreground mt-1">
              Candidate: <span className="font-semibold text-foreground">{candidateEmail}</span>
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate('/proctoring-review')}>
            ← Back to Review
          </Button>
        </div>

        {/* Score summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-slate-50">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Academic Score</p>
              <p className="text-2xl font-bold">{result.academic_score ?? 0}%</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-50">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Integrity Score</p>
              <p className={`text-2xl font-bold ${
                (result.integrity_score ?? 100) >= 90 ? 'text-green-600' :
                (result.integrity_score ?? 100) >= 70 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {result.integrity_score ?? 100}%
              </p>
            </CardContent>
          </Card>
          <Card className="bg-slate-50">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Violations</p>
              <p className="text-2xl font-bold text-red-600">{violations?.length ?? 0}</p>
            </CardContent>
          </Card>
        </div>

        {/* Timeline */}
        <Card>
          <CardHeader><CardTitle>Exam Timeline</CardTitle></CardHeader>
          <CardContent>
            <div className="relative w-full h-12 bg-slate-200 rounded-full my-8">
              <div className="absolute top-0 left-0 h-full bg-primary/10 rounded-full w-full" />
              {violations?.map((v) => {
                const vTime = new Date(v.timestamp).getTime();
                const percent = Math.min(Math.max(((vTime - startTime) / duration) * 100, 0), 100);
                return (
                  <div key={v.id} className="absolute top-0 bottom-0 flex items-center" style={{ left: `${percent}%` }}>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className={`w-6 h-6 rounded-full border-2 border-white shadow-md transform -translate-x-1/2 hover:scale-110 transition-transform cursor-pointer focus:outline-none ${v.media_url ? 'bg-red-700' : 'bg-red-400'}`} />
                      </PopoverTrigger>
                      <PopoverContent className="w-72 p-3 text-sm z-50 bg-white shadow-lg border">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
                          <p className="font-semibold text-red-700">{v.type}</p>
                        </div>
                        <p className="text-slate-500 text-xs mb-2">{new Date(v.timestamp).toLocaleString()}</p>
                        {v.media_url && (
                          <button
                            onClick={() => openMedia(v.media_url)}
                            className="w-full mt-1 rounded overflow-hidden border hover:opacity-90 transition-opacity text-left"
                          >
                            <img
                              src={v.media_url}
                              alt="Violation evidence"
                              className="w-full h-24 object-cover"
                              onError={(e) => { e.target.style.display = 'none'; }}
                            />
                            <p className="text-xs text-center py-1 bg-slate-50 text-blue-600 font-medium">
                              Click to view full image
                            </p>
                          </button>
                        )}
                      </PopoverContent>
                    </Popover>
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

        {/* Violation cards */}
        {violations && violations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                Violations ({violations.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {violations.map(v => (
                  <div key={v.id} className="border rounded-xl overflow-hidden shadow-sm">
                    <div className="bg-red-50 border-b px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-red-700 text-sm">{v.type}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{new Date(v.timestamp).toLocaleString()}</p>
                      </div>
                      <Badge variant="destructive" className="text-xs">Logged</Badge>
                    </div>
                    {v.media_url ? (
                      <div className="relative group cursor-pointer" onClick={() => openMedia(v.media_url)}>
                        <img
                          src={v.media_url}
                          alt={v.type}
                          className="w-full h-40 object-cover"
                          onError={(e) => {
                            e.target.parentElement.innerHTML =
                              '<div class="h-40 flex items-center justify-center bg-slate-100 text-slate-400 text-sm">Image failed to load</div>';
                          }}
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Eye className="w-8 h-8 text-white" />
                        </div>
                      </div>
                    ) : (
                      <div className="h-40 flex items-center justify-center bg-slate-50 text-slate-400 text-sm italic">
                        No image evidence
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Answer Review */}
        {attempt?.randomized_questions && attempt.randomized_questions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-500" />
                Answer Review
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {Object.keys(attempt.answers || {}).length} of {attempt.randomized_questions.length} questions answered
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {attempt.randomized_questions.map((q, idx) => {
                  const studentAnswerIdx = attempt.answers?.[q.id];
                  const correctIdx = q.correct_option_index;
                  const isCorrect = studentAnswerIdx === correctIdx;
                  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
                  return (
                    <div key={q.id} className="border rounded-xl p-5">
                      <div className="flex items-start gap-3 mb-4">
                        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                          {idx + 1}
                        </span>
                        <div className="flex-1">
                          <p className="font-medium text-slate-800 leading-snug">{q.text}</p>
                          {studentAnswerIdx === undefined ? (
                            <span className="text-xs text-slate-400 italic mt-1 inline-block">Not answered</span>
                          ) : isCorrect ? (
                            <span className="text-xs font-semibold text-green-600 mt-1 inline-flex items-center gap-1">
                              <CheckCircle className="w-3.5 h-3.5" /> Correct
                            </span>
                          ) : (
                            <span className="text-xs font-semibold text-red-600 mt-1 inline-flex items-center gap-1">
                              <XCircle className="w-3.5 h-3.5" /> Incorrect
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2 pl-10">
                        {q.options?.map((opt, optIdx) => {
                          const isStudentChoice = studentAnswerIdx === optIdx;
                          const isCorrectOption = correctIdx === optIdx;
                          let cls = 'border rounded-lg px-4 py-2.5 text-sm flex items-center gap-3';
                          if (isStudentChoice && isCorrect) cls += ' border-green-400 bg-green-50 text-green-800';
                          else if (isStudentChoice && !isCorrect) cls += ' border-red-400 bg-red-50 text-red-800';
                          else if (isCorrectOption) cls += ' border-green-300 bg-green-50/50 text-green-700';
                          else cls += ' border-slate-200 text-slate-600';
                          return (
                            <div key={optIdx} className={cls}>
                              <span className="w-6 h-6 rounded flex-shrink-0 bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                                {letters[optIdx]}
                              </span>
                              <span className="flex-1">{opt}</span>
                              {isStudentChoice && (
                                <span className="text-xs font-semibold">{isCorrect ? '✓ Your answer' : '✗ Your answer'}</span>
                              )}
                              {!isStudentChoice && isCorrectOption && (
                                <span className="text-xs font-semibold text-green-600">Correct answer</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Final verdict */}
        <Card className={result.reviewed_by ? 'border-slate-200 bg-slate-50' : ''}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Final Verdict
              {result.reviewed_by && (
                <span className="inline-flex items-center gap-1 text-sm font-normal text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                  <Lock className="w-3 h-3" /> Locked
                </span>
              )}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Current status: <span className="font-semibold">{result.final_result_status || 'Pending'}</span>
            </p>
            {result.reviewed_by && result.reviewed_at && (
              <p className="text-xs text-slate-500 mt-1">
                Reviewed by <span className="font-medium text-slate-700">{result.reviewer_email || result.reviewed_by}</span>
                {' · '}{new Date(result.reviewed_at).toLocaleString()}
              </p>
            )}
          </CardHeader>
          <CardContent>
            {result.reviewed_by ? (
              // Verdict already set — show locked state, no buttons
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-5">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  result.final_result_status === 'Auto-Approved Pass' ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  {result.final_result_status === 'Auto-Approved Pass'
                    ? <CheckCircle className="w-6 h-6 text-green-600" />
                    : <XCircle className="w-6 h-6 text-red-600" />}
                </div>
                <div>
                  <p className="font-semibold text-slate-800">{result.final_result_status}</p>
                  <p className="text-xs text-slate-500">This verdict has already been set and cannot be changed.</p>
                </div>
              </div>
            ) : (
              // Verdict not yet set — show action buttons
              <div className="grid md:grid-cols-2 gap-4">
                <Button
                  onClick={handleOverrideApprove}
                  className="w-full h-16 text-lg bg-green-600 hover:bg-green-700 gap-2"
                  disabled={updateResultMutation.isPending}
                >
                  <CheckCircle className="w-6 h-6" /> Override &amp; Approve
                </Button>
                <Button
                  onClick={handleInvalidateExam}
                  className="w-full h-16 text-lg bg-red-600 hover:bg-red-700 gap-2"
                  disabled={updateResultMutation.isPending}
                >
                  <XCircle className="w-6 h-6" /> Invalidate Exam
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Release Results to Student */}
        <Card className={result.is_released ? 'border-green-200 bg-green-50' : ''}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SendHorizonal className="w-5 h-5 text-green-600" />
              Release Results to Student
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {result.is_released
                ? 'Results and digital credentials have been released. The student can now view them in their dashboard.'
                : 'The student cannot see their result or certificate until you release it here.'}
            </p>
          </CardHeader>
          <CardContent>
            {result.is_released ? (
              <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-white p-5">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="font-semibold text-green-800">Released</p>
                  <p className="text-xs text-slate-500">The student can now see their result and certificate on their dashboard.</p>
                </div>
              </div>
            ) : (
              <Button
                onClick={() => releaseResultsMutation.mutate()}
                className="w-full h-14 text-base bg-green-600 hover:bg-green-700 gap-2"
                disabled={releaseResultsMutation.isPending || !result.reviewed_by}
              >
                {releaseResultsMutation.isPending
                  ? <Loader2 className="w-5 h-5 animate-spin" />
                  : <SendHorizonal className="w-5 h-5" />}
                {!result.reviewed_by ? 'Set Final Verdict First' : 'Release Result to Student'}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Full image modal */}
        <Dialog open={isMediaModalOpen} onOpenChange={setIsMediaModalOpen}>
          <DialogContent className="sm:max-w-[800px] p-0 overflow-hidden bg-black border-0">
            <DialogHeader className="p-4 bg-slate-900 text-white absolute top-0 w-full z-10">
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400" /> Violation Evidence
              </DialogTitle>
            </DialogHeader>
            {selectedMedia && (
              <img
                src={selectedMedia}
                alt="Violation evidence"
                className="w-full object-contain pt-14 max-h-[80vh]"
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ──────────── LIST VIEW ────────────
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <ShieldAlert className="w-8 h-8 text-primary" />
          Post-Exam Audit Dashboard
        </h1>
        <p className="text-muted-foreground mt-1">Review AI-flagged violations and photo evidence.</p>
      </div>

      {isLoadingViolations ? (
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      ) : violations?.length === 0 ? (
        <p className="text-muted-foreground">No violations recorded.</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {violations?.map(v => (
            <Card key={v.id} className="overflow-hidden shadow-sm">
              <CardHeader className="bg-red-50 border-b pb-3 pt-4">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base text-red-700">{v.type}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">{new Date(v.timestamp).toLocaleString()}</p>
                  </div>
                  <Badge variant="destructive">Violation</Badge>
                </div>
                <p className="text-xs text-slate-500 mt-2 font-mono">
                  {tenantUsers?.find(u => u.user_id === v.candidate_id)?.email ||
                    v.candidate_id?.substring(0, 8) + '...'}
                </p>
              </CardHeader>
              <CardContent className="pt-0 p-0">
                {v.media_url ? (
                  <div className="relative group cursor-pointer" onClick={() => openMedia(v.media_url)}>
                    <img
                      src={v.media_url}
                      alt={v.type}
                      className="w-full h-48 object-cover"
                      onError={(e) => {
                        e.target.parentElement.innerHTML =
                          '<div class="h-48 flex items-center justify-center bg-slate-100 text-slate-400 text-sm italic">Image unavailable</div>';
                      }}
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Eye className="w-8 h-8 text-white" />
                      <span className="text-white font-medium">View Full Image</span>
                    </div>
                  </div>
                ) : (
                  <div className="h-48 flex flex-col items-center justify-center bg-slate-50 text-slate-400 text-sm italic gap-2">
                    <AlertTriangle className="w-6 h-6 text-red-300" />
                    <span>{v.type} — no image captured</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Full image modal */}
      <Dialog open={isMediaModalOpen} onOpenChange={setIsMediaModalOpen}>
        <DialogContent className="sm:max-w-[800px] p-0 overflow-hidden bg-black border-0">
          <DialogHeader className="p-4 bg-slate-900 text-white absolute top-0 w-full z-10">
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" /> Violation Evidence
            </DialogTitle>
          </DialogHeader>
          {selectedMedia && (
            <img
              src={selectedMedia}
              alt="Violation evidence"
              className="w-full object-contain pt-14 max-h-[80vh]"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}