import React from 'react';
import { Button } from "@/components/ui/button";
import { User, Mic, AppWindow, MonitorSmartphone } from 'lucide-react';

export default function ProctoringSidebar({ videoRef, questions, currentIdx, answers, onNavigate, onSubmit }) {
  
  return (
    <div className="w-80 bg-white border-l flex flex-col h-[calc(100vh-73px)] sticky top-[73px]">
      <div className="p-4 border-b">
        <div className="bg-slate-900 rounded-xl overflow-hidden aspect-video relative flex items-center justify-center mb-3 shadow-inner">
          <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover transform -scale-x-100" />
          <div className="absolute top-0 left-0 w-full h-full border-[3px] border-blue-500/30 rounded-xl pointer-events-none"></div>
          <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/50 px-2 py-0.5 rounded-full backdrop-blur-sm">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-[10px] font-bold text-white tracking-wider">LIVE</span>
          </div>
          <div className="absolute bottom-2 right-2 flex items-end gap-0.5 h-3">
            {[1,2,3,4,5].map(i => <div key={i} className="w-1 bg-green-500 rounded-sm" style={{height: `${20 * i}%`}}></div>)}
          </div>
        </div>
        <div className="flex justify-between items-center text-xs font-medium px-1">
          <span className="text-green-600 flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Face detected</span>
          <span className="text-slate-500">0 violations</span>
        </div>
      </div>

      <div className="p-4 border-b bg-slate-50/50">
        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">AI Monitoring</h4>
        <div className="space-y-3">
          <MonitorItem icon={User} label="Face Detection" />
          <MonitorItem icon={Mic} label="Audio Analysis" />
          <MonitorItem icon={AppWindow} label="Tab Monitoring" />
          <MonitorItem icon={MonitorSmartphone} label="Device Scan" />
        </div>
      </div>

      <div className="p-4 flex-1 overflow-y-auto">
        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Question Navigator</h4>
        <div className="grid grid-cols-5 gap-2 mb-6">
          {questions.map((q, idx) => {
            const isAnswered = answers[q.id] !== undefined;
            const isCurrent = currentIdx === idx;
            
            let bgClass = "bg-white border-slate-200 text-slate-600 hover:border-blue-400 hover:text-blue-600 shadow-sm";
            if (isCurrent) bgClass = "bg-blue-600 border-blue-600 text-white shadow-md ring-2 ring-blue-600/20";
            else if (isAnswered) bgClass = "bg-green-50 border-green-200 text-green-700 shadow-sm";

            return (
              <button
                key={idx}
                onClick={() => onNavigate(idx)}
                className={`h-10 rounded-lg border font-medium text-sm transition-all flex items-center justify-center ${bgClass}`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>

        <div className="space-y-2.5 text-xs text-slate-600 px-1 bg-slate-50 p-3 rounded-lg border border-slate-100">
          <div className="flex items-center gap-3"><div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-sm"></div> Answered</div>
          <div className="flex items-center gap-3"><div className="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-sm"></div> Flagged</div>
          <div className="flex items-center gap-3"><div className="w-2.5 h-2.5 rounded-full bg-blue-600 shadow-sm"></div> Current</div>
          <div className="flex items-center gap-3"><div className="w-2.5 h-2.5 rounded-full border border-slate-300 bg-white"></div> Not answered</div>
        </div>
      </div>

      <div className="p-4 border-t bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
        <Button onClick={onSubmit} className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-semibold text-base shadow-md">
          Submit Exam
        </Button>
      </div>
    </div>
  );
}

function MonitorItem({ icon: Icon, label }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <div className="flex items-center gap-2.5 text-slate-600 font-medium">
        <Icon className="w-4 h-4 text-indigo-500" />
        <span>{label}</span>
      </div>
      <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-green-600 uppercase">
        <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.6)]"></div>
        Active
      </div>
    </div>
  );
}