import { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

export default function SchedulingTab({ exam, onUpdate }) {
  
  const handleGenerateCode = () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase() + '-SECURE';
    onUpdate({ access_code: code });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10 py-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-800 mb-1">Scheduling & Access</h2>
        <p className="text-sm text-slate-500 mb-6">Set exam window, duration, and student access controls</p>

        <Card className="bg-white border-slate-200 shadow-sm mb-6">
          <CardContent className="p-8">
            <h3 className="text-sm font-semibold text-slate-800 mb-6">Exam Window</h3>
            
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Start Date</Label>
                  <Input 
                    type="date" 
                    value={exam.start_date || ''} 
                    onChange={e => onUpdate({ start_date: e.target.value })}
                    className="bg-slate-50 border-slate-200"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider">End Date</Label>
                  <Input 
                    type="date" 
                    value={exam.end_date || ''} 
                    onChange={e => onUpdate({ end_date: e.target.value })}
                    className="bg-slate-50 border-slate-200"
                  />
                </div>
              </div>
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Start Time</Label>
                  <Input 
                    type="time" 
                    value={exam.start_time || ''} 
                    onChange={e => onUpdate({ start_time: e.target.value })}
                    className="bg-slate-50 border-slate-200"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider">End Time</Label>
                  <Input 
                    type="time" 
                    value={exam.end_time || ''} 
                    onChange={e => onUpdate({ end_time: e.target.value })}
                    className="bg-slate-50 border-slate-200"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-sm mb-6">
          <CardContent className="p-8">
            <h3 className="text-sm font-semibold text-slate-800 mb-6">Duration & Attempts</h3>
            
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Exam Duration <span className="font-normal normal-case">(minutes)</span></Label>
                <p className="text-[10px] text-slate-500 mb-2">Time each student has to complete the exam</p>
                <Input 
                  type="number" 
                  value={exam.duration_minutes || 60} 
                  onChange={e => onUpdate({ duration_minutes: Number(e.target.value) })}
                  className="bg-slate-50 border-slate-200 max-w-[200px]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Maximum Attempts</Label>
                <p className="text-[10px] text-slate-500 mb-2">How many times a student can attempt this exam</p>
                <Input 
                  type="number" 
                  value={exam.max_attempts || 1} 
                  onChange={e => onUpdate({ max_attempts: Number(e.target.value) })}
                  className="bg-slate-50 border-slate-200 max-w-[200px]"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-sm">
          <CardContent className="p-8">
            <h3 className="text-sm font-semibold text-slate-800 mb-6">Access Settings</h3>
            
            <div className="space-y-8">
              <div className="space-y-2 max-w-md">
                <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Access Code <span className="font-normal normal-case text-slate-400">(optional - leave blank for open access)</span></Label>
                <p className="text-[10px] text-slate-500 mb-2">Students must enter this code to begin the exam</p>
                <div className="flex gap-2">
                  <Input 
                    value={exam.access_code || ''} 
                    onChange={e => onUpdate({ access_code: e.target.value })}
                    className="bg-slate-50 border-slate-200 font-mono"
                    placeholder="e.g. DB2026-SECURE"
                  />
                  <Button variant="outline" onClick={handleGenerateCode}>Generate</Button>
                </div>
              </div>

              <div className="h-px bg-slate-100" />

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-700">Allow Early Submission</div>
                  <div className="text-[10px] text-slate-500">Students can submit before time expires</div>
                </div>
                <Switch checked={exam.allow_early_submission !== false} onCheckedChange={c => onUpdate({ allow_early_submission: c })} />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-700">Allow Late Join</div>
                  <div className="text-[10px] text-slate-500">Students can join up to 15 minutes after start</div>
                </div>
                <Switch checked={exam.allow_late_join === true} onCheckedChange={c => onUpdate({ allow_late_join: c })} />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-700">Shuffle Question Order</div>
                  <div className="text-[10px] text-slate-500">Randomize question sequence for each student</div>
                </div>
                <Switch checked={exam.shuffle_questions !== false} onCheckedChange={c => onUpdate({ shuffle_questions: c })} />
              </div>

            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}