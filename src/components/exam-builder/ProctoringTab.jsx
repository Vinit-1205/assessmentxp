import { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { User, Mic, AppWindow, Users, Smartphone, Eye, Maximize, Copy } from "lucide-react";

export default function ProctoringTab({ exam, onUpdate }) {
  const currentStrictness = exam.proctoring_strictness || 'Standard';
  const modules = exam.proctoring_modules || {
    face: true, audio: true, tab: true, multiple_persons: true, 
    mobile: true, eye: false, fullscreen: true, copy_paste: true
  };

  const handleStrictnessChange = (level) => {
    let newModules = { ...modules };
    if (level === 'Lenient') {
      newModules = { face: true, audio: false, tab: false, multiple_persons: false, mobile: false, eye: false, fullscreen: false, copy_paste: false };
    } else if (level === 'Standard') {
      newModules = { face: true, audio: true, tab: true, multiple_persons: true, mobile: true, eye: false, fullscreen: true, copy_paste: true };
    } else if (level === 'Strict' || level === 'Ultra') {
      newModules = { face: true, audio: true, tab: true, multiple_persons: true, mobile: true, eye: true, fullscreen: true, copy_paste: true };
    }
    
    onUpdate({ proctoring_strictness: level, proctoring_modules: newModules });
  };

  const toggleModule = (key, value) => {
    onUpdate({ proctoring_modules: { ...modules, [key]: value } });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10 py-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-800 mb-1">Proctoring Configuration</h2>
        <p className="text-sm text-slate-500 mb-6">Configure AI monitoring sensitivity and violation thresholds for this exam</p>

        <Card className="bg-white border-slate-200 shadow-sm mb-8">
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">Proctoring Strictness Level</h3>
            <p className="text-xs text-slate-500 mb-4">Select a preset that matches your exam's security requirements</p>
            
            <div className="grid grid-cols-4 gap-4">
              {['Lenient', 'Standard', 'Strict', 'Ultra'].map((level) => {
                const isSelected = currentStrictness === level;
                return (
                  <div 
                    key={level}
                    onClick={() => handleStrictnessChange(level)}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      isSelected ? 'border-green-500 bg-green-50/20' : 'border-slate-100 hover:border-slate-300'
                    }`}
                  >
                    <div className={`font-semibold mb-1 ${isSelected ? 'text-green-700' : 'text-slate-700'}`}>{level}</div>
                    <div className="text-[10px] text-slate-500 leading-tight">
                      {level === 'Lenient' && 'Face detection only. No auto-flag'}
                      {level === 'Standard' && 'Core monitoring. 3-violation threshold'}
                      {level === 'Strict' && 'All detectors. 1-violation threshold'}
                      {level === 'Ultra' && 'Max sensitivity. Auto-escalate'}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-sm">
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold text-slate-800 mb-6">Detection Modules</h3>
            
            <div className="space-y-6">
              <ModuleToggle 
                icon={User} 
                title="Face Detection" 
                desc="Alert when student face is absent from frame" 
                checked={modules.face} 
                onChange={(c) => toggleModule('face', c)}
                required
              />
              <div className="h-px bg-slate-100" />
              <ModuleToggle 
                icon={Mic} 
                title="Audio Monitoring" 
                desc="Detect suspicious audio patterns and voice activity" 
                checked={modules.audio} 
                onChange={(c) => toggleModule('audio', c)}
              />
              <div className="h-px bg-slate-100" />
              <ModuleToggle 
                icon={AppWindow} 
                title="Tab Switch Detection" 
                desc="Flag when student switches browser tabs or apps" 
                checked={modules.tab} 
                onChange={(c) => toggleModule('tab', c)}
              />
              <div className="h-px bg-slate-100" />
              <ModuleToggle 
                icon={Users} 
                title="Multiple Persons Detection" 
                desc="Alert when more than one face is visible" 
                checked={modules.multiple_persons} 
                onChange={(c) => toggleModule('multiple_persons', c)}
              />
              <div className="h-px bg-slate-100" />
              <ModuleToggle 
                icon={Smartphone} 
                title="Mobile Phone Detection" 
                desc="Detect handheld devices in camera frame" 
                checked={modules.mobile} 
                onChange={(c) => toggleModule('mobile', c)}
              />
              <div className="h-px bg-slate-100" />
              <ModuleToggle 
                icon={Eye} 
                title="Eye Tracking" 
                desc="Analyze gaze direction for off-screen lookup patterns" 
                checked={modules.eye} 
                onChange={(c) => toggleModule('eye', c)}
              />
              <div className="h-px bg-slate-100" />
              <ModuleToggle 
                icon={Maximize} 
                title="Fullscreen Enforcement" 
                desc="Require fullscreen mode throughout the exam" 
                checked={modules.fullscreen} 
                onChange={(c) => toggleModule('fullscreen', c)}
              />
              <div className="h-px bg-slate-100" />
              <ModuleToggle 
                icon={Copy} 
                title="Disable Copy/Paste" 
                desc="Prevent clipboard operations during the session" 
                checked={modules.copy_paste} 
                onChange={(c) => toggleModule('copy_paste', c)}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ModuleToggle({ icon: Icon, title, desc, checked, onChange, required }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="w-8 h-8 rounded-full bg-slate-50 border flex items-center justify-center text-slate-400">
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            {title}
            {required && <span className="text-[10px] text-blue-500 font-normal">Required</span>}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">{desc}</div>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={required} />
    </div>
  );
}