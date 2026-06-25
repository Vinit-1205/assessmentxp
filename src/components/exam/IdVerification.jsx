import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BadgeCheck, CheckCircle2, ScanFace } from 'lucide-react';

export default function IdVerification({ user, exam, onComplete }) {
  const videoRef = useRef(null);
  const [step, setStep] = useState(1); // 1 = ID, 2 = Face
  const [idCaptured, setIdCaptured] = useState(false);
  const [faceCaptured, setFaceCaptured] = useState(false);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(stream => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(err => console.error(err));
  }, [step]);

  const handleCaptureId = () => {
    setIdCaptured(true);
    setStep(2);
  };

  const handleCaptureFace = () => {
    setFaceCaptured(true);
  };

  return (
    <div className="max-w-3xl mx-auto py-8">
      <Card className="border-0 shadow-lg bg-white rounded-2xl overflow-hidden">
        <div className="bg-slate-50 border-b p-6 flex items-center gap-3">
          <BadgeCheck className="w-6 h-6 text-indigo-600" />
          <div>
            <h2 className="text-xl font-bold text-slate-800">Identity Verification</h2>
            <p className="text-sm text-slate-500">AI will match your ID photo with your live face</p>
          </div>
        </div>
        
        <CardContent className="p-8">
          <div className="bg-slate-100 rounded-xl p-6 flex flex-wrap gap-x-12 gap-y-4 mb-8">
            <div>
              <div className="text-xs text-slate-500 font-semibold mb-1 uppercase">Student Name</div>
              <div className="font-medium text-slate-800">{user?.full_name || 'Student'}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 font-semibold mb-1 uppercase">Email</div>
              <div className="font-medium text-slate-800">{user?.email}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 font-semibold mb-1 uppercase">Exam</div>
              <div className="font-medium text-slate-800">{exam?.title}</div>
            </div>
          </div>

          <div className={`border-2 rounded-xl p-6 mb-6 transition-all ${step === 1 ? 'border-blue-500 shadow-md bg-white' : 'border-slate-200 bg-slate-50 opacity-60'}`}>
            <div className="flex justify-between items-start mb-4">
              <div className="flex gap-3">
                <BadgeCheck className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h3 className="font-bold text-slate-800">Step 1: Hold up your Student ID</h3>
                  <p className="text-sm text-slate-500">Position your ID card clearly in front of the camera</p>
                </div>
              </div>
              {idCaptured ? <div className="flex items-center gap-1 text-sm text-green-600 font-medium"><CheckCircle2 className="w-4 h-4" /> Captured</div> : <div className="text-sm text-slate-400">Not captured</div>}
            </div>
            
            {step === 1 && (
              <div className="space-y-4">
                <div className="bg-slate-900 rounded-xl overflow-hidden aspect-video relative flex items-center justify-center">
                  <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                  <div className="absolute w-3/5 h-3/5 border-2 border-dashed border-white/70 rounded-xl flex items-center justify-center bg-black/20">
                    <span className="text-white/90 text-sm font-medium">Position ID card in frame</span>
                  </div>
                </div>
                <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={handleCaptureId}>Capture ID Card</Button>
              </div>
            )}
          </div>

          <div className={`border-2 rounded-xl p-6 mb-8 transition-all ${step === 2 ? 'border-blue-500 shadow-md bg-white' : 'border-slate-200 bg-slate-50 opacity-60'}`}>
            <div className="flex justify-between items-start mb-4">
              <div className="flex gap-3">
                <ScanFace className="w-5 h-5 text-purple-600 mt-0.5" />
                <div>
                  <h3 className="font-bold text-slate-800">Step 2: Face Match Verification</h3>
                  <p className="text-sm text-slate-500">Look directly at the camera for biometric match</p>
                </div>
              </div>
              {faceCaptured ? <div className="flex items-center gap-1 text-sm text-green-600 font-medium"><CheckCircle2 className="w-4 h-4" /> Matched</div> : <div className="text-sm text-slate-400">Not captured</div>}
            </div>
            
            {step === 2 && !faceCaptured && (
              <div className="space-y-4">
                <div className="bg-slate-900 rounded-xl overflow-hidden aspect-video relative flex items-center justify-center">
                  <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                  <div className="absolute w-48 h-64 border-2 border-dashed border-white/70 rounded-full flex items-center justify-center bg-black/20">
                  </div>
                </div>
                <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={handleCaptureFace}>Verify Face Match</Button>
              </div>
            )}
          </div>

          <Button 
            className="w-full h-12 text-base font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50" 
            disabled={!idCaptured || !faceCaptured} 
            onClick={onComplete}
          >
            Continue to Rules & Agreement →
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}