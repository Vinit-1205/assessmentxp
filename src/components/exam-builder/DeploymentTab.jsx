import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CheckCircle2, AlertTriangle, FileText, Star, Clock, Users } from "lucide-react";

export default function DeploymentTab({ exam, questions }) {
  
  const totalPoints = questions.reduce((sum, q) => sum + (q.marks_awarded || 0), 0);
  
  // Mock checks based on data
  const hasQuestions = questions.length > 0;
  const mcqsWithNoAnswers = questions.some(q => q.type === 'MCQ' && (q.correct_option_index === null || q.correct_option_index === undefined));
  const hasProctoring = !!exam.proctoring_strictness;
  const hasWindow = !!(exam.start_date && exam.end_date);
  const enrolledCount = 12; // Mock
  const hasAccessCode = !!exam.access_code;
  const missingExplanations = questions.some(q => !q.explanation);

  const checklist = [
    { title: "Questions configured", desc: `${questions.length} questions • ${totalPoints} total points`, passed: hasQuestions, required: true },
    { title: "All MCQ answers marked", desc: mcqsWithNoAnswers ? "Some MCQs missing correct answers" : `Correct answers set for all MCQs`, passed: !mcqsWithNoAnswers, required: true },
    { title: "Proctoring settings saved", desc: `${exam.proctoring_strictness || 'Standard'} strictness`, passed: hasProctoring, required: true },
    { title: "Exam window configured", desc: hasWindow ? `${exam.start_date} – ${exam.end_date}` : "Window not set", passed: hasWindow, required: true },
    { title: "Students enrolled", desc: `${enrolledCount} students • 11 confirmed`, passed: enrolledCount > 0, warning: true },
    { title: "Access code set", desc: exam.access_code || "Open access", passed: true },
    { title: "Answer explanations", desc: missingExplanations ? "Some questions missing explanations" : "All questions have explanations", passed: !missingExplanations, warning: true },
  ];

  const passedCount = checklist.filter(c => c.passed && !c.warning).length;
  const warningCount = checklist.filter(c => !c.passed && c.warning).length;

  return (
    <div className="max-w-4xl mx-auto space-y-10 py-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-800 mb-1">Deploy Exam</h2>
        <p className="text-sm text-slate-500 mb-8">Review deployment checklist and publish to enrolled students</p>

        <h3 className="text-sm font-semibold text-slate-800 mb-4">Exam Summary</h3>
        <div className="grid grid-cols-4 gap-4 mb-10">
          <Card className="bg-white border-slate-200 shadow-sm">
            <CardContent className="p-6 flex flex-col items-center justify-center text-center">
              <FileText className="w-6 h-6 text-blue-500 mb-3" />
              <div className="text-2xl font-bold text-slate-800 mb-1">{questions.length}</div>
              <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Questions</div>
            </CardContent>
          </Card>
          <Card className="bg-white border-slate-200 shadow-sm">
            <CardContent className="p-6 flex flex-col items-center justify-center text-center">
              <Star className="w-6 h-6 text-blue-500 mb-3" />
              <div className="text-2xl font-bold text-slate-800 mb-1">{totalPoints}</div>
              <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Total Points</div>
            </CardContent>
          </Card>
          <Card className="bg-white border-slate-200 shadow-sm">
            <CardContent className="p-6 flex flex-col items-center justify-center text-center">
              <Clock className="w-6 h-6 text-blue-500 mb-3" />
              <div className="text-2xl font-bold text-slate-800 mb-1">{exam.duration_minutes || 60} min</div>
              <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Duration</div>
            </CardContent>
          </Card>
          <Card className="bg-white border-slate-200 shadow-sm">
            <CardContent className="p-6 flex flex-col items-center justify-center text-center">
              <Users className="w-6 h-6 text-blue-500 mb-3" />
              <div className="text-2xl font-bold text-slate-800 mb-1">{enrolledCount}</div>
              <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Enrolled</div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-white border-slate-200 shadow-sm">
          <CardHeader className="pb-4 border-b">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-semibold text-slate-800">Deployment Checklist</h3>
              <div className="flex items-center gap-4 text-xs font-semibold">
                <span className="text-green-600">{passedCount} passed</span>
                {warningCount > 0 && <span className="text-orange-500">{warningCount} warnings</span>}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {checklist.map((item, idx) => (
                <div key={idx} className="p-5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4">
                    {item.passed ? (
                      <CheckCircle2 className="w-6 h-6 text-green-500" />
                    ) : item.warning ? (
                      <AlertTriangle className="w-6 h-6 text-orange-500" />
                    ) : (
                      <div className="w-6 h-6 rounded-full border-2 border-slate-300"></div>
                    )}
                    <div>
                      <div className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                        {item.title}
                        {item.required && <span className="text-[9px] text-blue-500 uppercase tracking-widest">Required</span>}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{item.desc}</div>
                    </div>
                  </div>
                  {(!item.passed || item.warning) && (
                    <button className="text-sm text-blue-600 hover:underline font-medium">Fix</button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}