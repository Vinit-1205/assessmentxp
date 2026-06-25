import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { useNavigate } from 'react-router-dom';

export default function ExamSubmitted({ stats }) {
  const navigate = useNavigate();

  return (
    <div className="min-h-[70vh] bg-slate-50 flex items-center justify-center p-6">
      <Card className="max-w-md w-full border-0 shadow-xl rounded-2xl text-center overflow-hidden">
        <CardContent className="p-10">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Exam Submitted</h2>
          <p className="text-slate-500 mb-8">Your responses have been recorded and the proctoring session has ended.</p>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <div className="text-2xl font-bold text-slate-800 mb-1">{stats.answered}</div>
              <div className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Questions Answered</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <div className="text-2xl font-bold text-slate-800 mb-1">{stats.unanswered}</div>
              <div className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Unanswered</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <div className="text-2xl font-bold text-slate-800 mb-1">{stats.violations}</div>
              <div className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Violations Flagged</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <div className="text-2xl font-bold text-slate-800 mb-1">{stats.timeTaken}</div>
              <div className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Time Taken</div>
            </div>
          </div>

          <p className="text-sm text-slate-500 mb-8">
            Results will be available once the faculty completes their review. Check your institution portal for updates.
          </p>

          <Button onClick={() => navigate('/dashboard')} variant="outline" className="w-full">
            Return to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}