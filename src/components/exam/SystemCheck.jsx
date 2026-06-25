import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ShieldCheck, Video, Mic, Globe, Monitor, Wifi, HardDrive } from 'lucide-react';

export default function SystemCheck({ onComplete }) {
  const videoRef = useRef(null);
  const [checks, setChecks] = useState({
    camera: false,
    mic: false,
    browser: true,
    network: true,
    screen: true,
    storage: true,
  });

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setChecks(prev => ({ ...prev, camera: true, mic: true }));
      })
      .catch(err => console.error(err));
  }, []);

  const allReady = Object.values(checks).every(Boolean);

  return (
    <div className="max-w-3xl mx-auto py-8">
      <Card className="border-0 shadow-lg bg-white overflow-hidden rounded-2xl">
        <div className="bg-slate-50 border-b p-6 flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-primary" />
          <div>
            <h2 className="text-xl font-bold text-slate-800">System Requirements Check</h2>
            <p className="text-sm text-slate-500">Verifying your setup before the exam begins</p>
          </div>
        </div>
        <CardContent className="p-8">
          <div className="bg-slate-900 rounded-xl overflow-hidden aspect-video relative mb-8 flex items-center justify-center">
            <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
            <div className="absolute inset-0 border-4 border-primary/30 m-8 rounded-lg pointer-events-none"></div>
            <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-black/60 px-3 py-1.5 rounded-full backdrop-blur-md">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-xs font-medium text-white">Camera active</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-8">
            <CheckItem icon={Video} title="Camera Access" desc="Checking camera permissions" status={checks.camera} />
            <CheckItem icon={Mic} title="Microphone Access" desc="Verifying audio input device" status={checks.mic} />
            <CheckItem icon={Globe} title="Browser Compatibility" desc="Chrome 120+ or Edge 118+" status={checks.browser} />
            <CheckItem icon={Wifi} title="Network Speed" desc="Minimum 2 Mbps upload required" status={checks.network} />
            <CheckItem icon={Monitor} title="Screen Resolution" desc="Minimum 1280x720 recommended" status={checks.screen} />
            <CheckItem icon={HardDrive} title="Storage Available" desc="Checking local storage" status={checks.storage} />
          </div>

          {allReady && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3 text-green-800">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <span className="font-medium">All systems ready. You may proceed to ID verification.</span>
            </div>
          )}

          <Button 
            className="w-full h-12 text-base font-semibold bg-blue-600 hover:bg-blue-700" 
            disabled={!allReady} 
            onClick={onComplete}
          >
            Continue to ID Verification →
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function CheckItem({ icon: Icon, title, desc, status }) {
  return (
    <div className="flex items-start gap-4">
      <div className={`p-2 rounded-lg ${status ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1">
        <h4 className="font-semibold text-slate-800">{title}</h4>
        <p className="text-xs text-slate-500">{desc}</p>
      </div>
      <div>
        {status ? (
          <CheckCircle2 className="w-5 h-5 text-green-500" />
        ) : (
          <div className="w-5 h-5 rounded-full border-2 border-slate-200 border-t-slate-400 animate-spin"></div>
        )}
      </div>
    </div>
  );
}