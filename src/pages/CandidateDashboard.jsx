import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, CheckCircle, Clock, BookOpen, Award, FileText, ChevronRight, MonitorCheck, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { toast } from "sonner";

export default function CandidateDashboard() {
  const navigate = useNavigate();
  const { data: user } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });

  const [systemChecks, setSystemChecks] = useState({});
  const [checking, setChecking] = useState({});

  const runSystemCheck = async (examId) => {
    setChecking(prev => ({ ...prev, [examId]: true }));
    let passed = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      stream.getTracks().forEach(t => t.stop());
    } catch (err) {
      passed = false;
      toast.error("Camera or Microphone access is required to take this exam.");
    }

    if (passed) {
      try {
        const start = Date.now();
        await fetch(window.location.href, { cache: 'no-store', method: 'HEAD' });
        const duration = Date.now() - start;
        if (duration > 3000) {
          toast.warning("Your internet connection seems slow, but you can proceed.");
        }
      } catch (err) {
         // ignore fetch errors
      }
    }

    setChecking(prev => ({ ...prev, [examId]: false }));
    if (passed) {
      setSystemChecks(prev => ({ ...prev, [examId]: true }));
      toast.success("System checks passed! You may begin the exam.");
    }
  };

  const { data: results, isLoading: isLoadingResults } = useQuery({
    queryKey: ['candidate-results', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const res = await base44.entities.Result.filter({ candidate_id: user.id }, '-created_date');
      // Fetch exam details for each result
      const exams = await Promise.all(res.map(r => base44.entities.Exam.get(r.exam_id).catch(() => null)));
      return res.map((r, i) => ({ ...r, exam: exams[i] })).filter(r => r.exam);
    },
    enabled: !!user?.id,
  });

  const { data: activeExams, isLoading: isLoadingExams } = useQuery({
    queryKey: ['active-exams', user?.tenant_id, user?.id],
    queryFn: async () => {
      if (!user?.tenant_id || !user?.id) return [];
      const allExams = await base44.entities.Exam.filter({ tenant_id: user.tenant_id, status: 'published' });
      // Remove exams already completed
      const attempts = await base44.entities.ExamAttempt.filter({ candidate_id: user.id, completed: true });
      const completedExamIds = new Set(attempts.map(a => a.exam_id));
      return allExams.filter(e => !completedExamIds.has(e.id));
    },
    enabled: !!user?.tenant_id && !!user?.id,
  });

  const credentials = results?.filter(r => r.certificate_url) || [];

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div>
        <h1 className="text-4xl font-extrabold text-white tracking-tight">Student Dashboard</h1>
        <p className="text-slate-400 mt-2 text-lg">Welcome back, {user?.full_name || 'Student'}</p>
      </div>

      <Tabs defaultValue="upcoming" className="w-full">
        <TabsList className="bg-slate-900 border border-slate-800 p-1 mb-6 flex flex-wrap h-auto">
          <TabsTrigger value="upcoming" className="flex-1 data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400">
            Upcoming Exams
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex-1 data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-400">
            Completed Results
          </TabsTrigger>
          <TabsTrigger value="credentials" className="flex-1 data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950 text-slate-400">
            Digital Credentials
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="space-y-6">
        {isLoadingExams ? (
          <p className="text-slate-400">Loading active exams...</p>
        ) : activeExams?.length === 0 ? (
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-8 text-center text-slate-400">
              No exams currently available.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {activeExams?.map(exam => (
              <Card key={exam.id} className="bg-slate-900 border-slate-800 hover:border-blue-500 transition-colors flex flex-col">
                <CardHeader>
                  <CardTitle className="text-xl text-white">{exam.title}</CardTitle>
                  <CardDescription className="text-slate-400 line-clamp-2">{exam.description || 'No description'}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <div className="text-slate-300 flex items-center gap-2 font-medium">
                    <Clock className="w-4 h-4 text-blue-400" /> {exam.duration_minutes} Minutes
                  </div>
                </CardContent>
                <CardFooter>
                  {systemChecks[exam.id] ? (
                    <Button 
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold" 
                      onClick={() => navigate(`/exam/${exam.id}`)}
                    >
                      Start Exam <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  ) : (
                    <Button 
                      className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200" 
                      onClick={() => runSystemCheck(exam.id)}
                      disabled={checking[exam.id]}
                    >
                      {checking[exam.id] ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Checking...</>
                      ) : (
                        <><MonitorCheck className="w-4 h-4 mr-2" /> Check System</>
                      )}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-6">
        {isLoadingResults ? (
          <p className="text-slate-400">Loading results...</p>
        ) : results?.length === 0 ? (
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-8 text-center text-slate-400">
              No results available yet.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {results?.map(result => (
              <Card key={result.id} className="bg-slate-900 border-slate-800 overflow-hidden">
                <div className={`h-1.5 w-full ${result.passed ? 'bg-emerald-500' : 'bg-red-500'}`} />
                <CardHeader>
                  <CardTitle className="text-lg text-white">{result.exam?.title}</CardTitle>
                  <CardDescription className="text-slate-400">Date: {new Date(result.created_date).toLocaleDateString()}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Status:</span>
                      <span className={`font-bold ${result.final_result_status === 'Auto-Approved Pass' ? 'text-emerald-400' : result.final_result_status === 'Failed' ? 'text-red-400' : 'text-yellow-400'}`}>
                        {result.final_result_status}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Score:</span> 
                      <span className="font-bold text-white text-lg">{result.academic_score}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        </TabsContent>

        <TabsContent value="credentials" className="space-y-6">
        {isLoadingResults ? (
          <p className="text-slate-400">Loading credentials...</p>
        ) : credentials.length === 0 ? (
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-8 text-center text-slate-400">
              You haven't earned any digital credentials yet.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {credentials.map(result => (
              <Card key={`cert-${result.id}`} className="bg-gradient-to-br from-slate-900 to-slate-800 border-amber-500/30 flex flex-col">
                <CardHeader>
                  <CardTitle className="text-xl text-amber-400 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" /> Certified
                  </CardTitle>
                  <CardDescription className="text-slate-300 font-medium">{result.exam?.title}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 text-slate-400 text-sm">
                  Issued on {new Date(result.created_date).toLocaleDateString()}
                </CardContent>
                <CardFooter>
                  <Button 
                    className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold"
                    onClick={() => window.open(result.certificate_url, '_blank')}
                  >
                    <Download className="w-4 h-4 mr-2" /> View Certificate
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
        </TabsContent>
      </Tabs>
    </div>
  );
}