import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, AlertTriangle, Maximize, User, AppWindow, Smartphone, MicOff, BookX, Timer } from 'lucide-react';

export default function RulesAgreement({ onComplete, user }) {
  const [agreed1, setAgreed1] = useState(false);
  const [agreed2, setAgreed2] = useState(false);

  const rules = [
    { icon: Maximize, title: "Fullscreen mode required", desc: "You must remain in fullscreen throughout the exam. Exiting fullscreen will generate a violation event." },
    { icon: User, title: "Face must be visible at all times", desc: "Keep your face within the camera frame. Absence for more than 10 seconds triggers an automatic alert." },
    { icon: AppWindow, title: "No tab switching or new windows", desc: "Switching tabs, opening new windows, or using Alt+Tab will be detected and flagged as a violation." },
    { icon: Smartphone, title: "No secondary devices", desc: "Using a phone, tablet, or secondary monitor is prohibited. Our AI detects secondary device usage." },
    { icon: User, title: "Only you in the frame", desc: "No other persons should be visible in the camera frame. Multiple faces trigger immediate escalation." },
    { icon: MicOff, title: "Maintain a quiet environment", desc: "Continuous audio analysis is active. Suspicious audio patterns (voices, whispers) will be flagged." },
    { icon: BookX, title: "No external resources", desc: "No textbooks, notes, or printed materials. This is a closed-book examination." },
    { icon: Timer, title: "Submit before time expires", desc: "The exam auto-submits when the timer reaches zero. Incomplete answers will be scored as attempted." },
  ];

  return (
    <div className="max-w-3xl mx-auto py-8">
      <Card className="border-0 shadow-lg bg-white rounded-2xl overflow-hidden">
        <div className="bg-slate-50 border-b p-6 flex items-center gap-3">
          <FileText className="w-6 h-6 text-orange-500" />
          <div>
            <h2 className="text-xl font-bold text-slate-800">Exam Rules & Consent</h2>
            <p className="text-sm text-slate-500">Read and acknowledge all proctoring rules before starting</p>
          </div>
        </div>
        
        <CardContent className="p-8">
          <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg flex items-start gap-3 text-orange-800">
            <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
            <span className="text-sm">This examination is monitored by ProctorAI. All violations are recorded with timestamps and screenshot evidence. Academic misconduct will be reported to your institution per the academic integrity policy.</span>
          </div>

          <ScrollArea className="h-[320px] mb-6 rounded-xl border">
            <div className="p-4 space-y-3">
              {rules.map((rule, idx) => (
                <div key={idx} className="flex gap-4 p-4 rounded-lg border bg-white shadow-sm">
                  <rule.icon className="w-5 h-5 text-slate-400 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-slate-800 mb-1">{rule.title}</h4>
                    <p className="text-sm text-slate-500 leading-relaxed">{rule.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="space-y-4 mb-8">
            <div className="flex items-start gap-3">
              <Checkbox id="consent1" checked={agreed1} onCheckedChange={setAgreed1} className="mt-1" />
              <label htmlFor="consent1" className="text-sm text-slate-700 leading-relaxed cursor-pointer">
                I have read and understood all examination rules. I confirm that I am the registered student {user?.full_name} and I will not engage in any form of academic dishonesty.
              </label>
            </div>
            <div className="flex items-start gap-3">
              <Checkbox id="consent2" checked={agreed2} onCheckedChange={setAgreed2} className="mt-1" />
              <label htmlFor="consent2" className="text-sm text-slate-700 leading-relaxed cursor-pointer">
                I consent to video, audio, and screen recording during this exam session. Recordings may be reviewed by authorized faculty and will be retained per institutional policy.
              </label>
            </div>
          </div>

          <Button 
            className="w-full h-12 text-base font-semibold bg-blue-600 hover:bg-blue-700 transition-all" 
            disabled={!agreed1 || !agreed2} 
            onClick={onComplete}
          >
            Enter Exam - Start Timer →
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}