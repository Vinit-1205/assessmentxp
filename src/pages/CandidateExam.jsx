import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { entities } from '@/api/entities';
import { apiClient } from '@/api/apiClient';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Clock, AlertCircle, Eye, Check } from 'lucide-react';
import { toast } from 'sonner';

import SystemCheck from '@/components/exam/SystemCheck';
import IdVerification from '@/components/exam/IdVerification';
import RulesAgreement from '@/components/exam/RulesAgreement';
import ProctoringSidebar from '@/components/exam/ProctoringSidebar';
import ExamSubmitted from '@/components/exam/ExamSubmitted';

export default function CandidateExam() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [step, setStep] = useState(1);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(3600);
  const [isInitializing, setIsInitializing] = useState(true);
  const [showWarning, setShowWarning] = useState(false);
  const [violationCount, setViolationCount] = useState(0);

  const answersRef = useRef(answers);
  const timeLeftRef = useRef(timeLeft);
  const showWarningRef = useRef(showWarning);

  // Video Proctoring Refs
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const rollingChunksRef = useRef([]);
  const violationChunksRef = useRef([]);
  const violationTriggeredRef = useRef(false);
  const postViolationChunksRef = useRef(0);
  const violationTypeRef = useRef('');

  const { user } = useAuth();
  const tenantId = user?.tenant_id || user?.institution_id;

  const { data: exam, isLoading: isLoadingExam } = useQuery({
    queryKey: ['exam', examId],
    queryFn: () => entities.Exam.get(examId),
  });

  const { data: attempt, isLoading: isLoadingAttempt } = useQuery({
    queryKey: ['examAttempt', examId, user?.id],
    queryFn: async () => {
      if (!user?.id || !examId) return null;
      const attempts = await entities.ExamAttempt.filter({ exam_id: examId, candidate_id: user.id });
      return attempts.length > 0 ? attempts[0] : null;
    },
    enabled: !!user?.id && !!examId
  });

  useEffect(() => {
    answersRef.current = answers;
    timeLeftRef.current = timeLeft;
    showWarningRef.current = showWarning;
  }, [answers, timeLeft, showWarning]);

  // Initialization: fetch raw, randomize, create attempt if not exists
  useEffect(() => {
    const initExam = async () => {
      if (!user?.id || !exam || attempt === undefined) return;
      
      if (attempt) {
        if (attempt.completed) {
          setStep(5);
        } else {
          // Check if answers are already populated, might mean they already started
          if (Object.keys(attempt.answers || {}).length > 0) {
            setStep(4);
          }
        }
        setAnswers(attempt.answers || {});
        setTimeLeft(attempt.time_left !== undefined ? attempt.time_left : (exam.duration_minutes || 60) * 60);
        setIsInitializing(false);
      } else {
        try {
          const rawQuestions = await entities.Question.filter({ exam_id: examId });
          if (rawQuestions.length === 0) {
            toast.error("This exam has no questions yet.");
            navigate('/');
            return;
          }
          const res = await apiClient.post('/randomize-exam', { 
            questions: rawQuestions,
            shuffle_questions: exam.shuffle_questions !== false,
            shuffle_options: exam.shuffle_options !== false
          });
          const randomized = res.questions || res.data?.questions;
          
          const newAttempt = await entities.ExamAttempt.create({
            tenant_id: tenantId,
            exam_id: examId,
            candidate_id: user.id,
            randomized_questions: randomized,
            answers: {},
            time_left: (exam.duration_minutes || 60) * 60
          });
          
          queryClient.setQueryData(['examAttempt', examId, user.id], newAttempt);
          setAnswers({});
          setTimeLeft((exam.duration_minutes || 60) * 60);
          setIsInitializing(false);
        } catch (e) {
          console.error(e);
          toast.error("Failed to start exam.");
        }
      }
    };
    if (isInitializing) {
      initExam();
    }
  }, [user, exam, attempt, examId, isInitializing, navigate, queryClient, tenantId]);

  // Timer
  useEffect(() => {
    if (isInitializing || attempt?.completed || step !== 4) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          handleSubmit(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isInitializing, attempt, step]);

  // Auto-save every 10 seconds
  useEffect(() => {
    if (isInitializing || !attempt || attempt.completed || step !== 4) return;
    
    const saveInterval = setInterval(async () => {
      try {
        await entities.ExamAttempt.update(attempt.id, { 
          answers: answersRef.current,
          time_left: timeLeftRef.current
        });
      } catch (e) {
        console.error("Auto-save failed", e);
      }
    }, 10000);
    return () => clearInterval(saveInterval);
  }, [isInitializing, attempt, step]);

  // AI Virtual Proctor: Webcam & Mic Access + Rolling Buffer (Only during exam)
  useEffect(() => {
    if (isInitializing || attempt?.completed || step !== 4) return;
    
    let stream = null;
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(s => {
        stream = s;
        if (videoRef.current) videoRef.current.srcObject = s;
        
        const options = MediaRecorder.isTypeSupported('video/webm') ? { mimeType: 'video/webm' } : undefined;
        const mr = new MediaRecorder(s, options);
        mediaRecorderRef.current = mr;
        
        mr.ondataavailable = (e) => {
          if (e.data.size > 0) {
            if (violationTriggeredRef.current) {
              violationChunksRef.current.push(e.data);
              postViolationChunksRef.current += 1;
              if (postViolationChunksRef.current >= 10) {
                finalizeViolationVideo();
              }
            } else {
              rollingChunksRef.current.push(e.data);
              if (rollingChunksRef.current.length > 5) {
                rollingChunksRef.current.shift(); // Keep only last 5 seconds
              }
            }
          }
        };
        mr.start(1000); // 1-second timeslices
      })
      .catch(err => {
        console.error("Camera access denied", err);
        toast.error("Camera and microphone access is required for this exam.");
      });

    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, [isInitializing, attempt, step]);

  const finalizeViolationVideo = async () => {
    try {
      const blob = new Blob(violationChunksRef.current, { type: 'video/webm' });

      // Convert to base64 and let the backend upload with service-role key
      const reader = new FileReader();
      const videoBase64 = await new Promise((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      await apiClient.post('/violations', {
        tenant_id: tenantId,
        exam_id: examId,
        candidate_id: user.id,
        attempt_id: attempt.id,
        type: `Critical Violation: ${violationTypeRef.current}`,
        timestamp: new Date().toISOString(),
        image_base64: videoBase64  // backend uploads to storage and saves URL
      });
    } catch (error) {
      console.error('Failed to finalize violation video', error);
    } finally {
      violationTriggeredRef.current = false;
      rollingChunksRef.current = [];
      postViolationChunksRef.current = 0;
    }
  };

  const lastFrameRef = useRef(null);

  // Capture a JPEG snapshot from the live webcam feed.
  // Returns a base64 data-URL string (e.g. "data:image/jpeg;base64,...") or null on failure.
  // The BACKEND handles the Storage upload using the service-role key (bypasses RLS).
  const captureCameraSnapshot = () => {
    return new Promise((resolve) => {
      try {
        const video = videoRef.current;
        if (!video) { resolve(null); return; }

        // Fall back to 640x480 if dimensions are not loaded or suspended
        const w = video.videoWidth || 640;
        const h = video.videoHeight || 480;

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');

        // Draw the current video frame onto the canvas
        ctx.drawImage(video, 0, 0, w, h);

        canvas.toBlob((blob) => {
          if (!blob) { resolve(null); return; }
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result); // data URL
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        }, 'image/jpeg', 0.80);
      } catch (err) {
        console.error('[captureCameraSnapshot] failed:', err);
        resolve(null);
      }
    });
  };

  // Cache the webcam frame periodically so we always have a recent frame even if the tab is hidden or blurred.
  useEffect(() => {
    if (isInitializing || attempt?.completed || step !== 4) return;

    const interval = setInterval(async () => {
      try {
        const frame = await captureCameraSnapshot();
        if (frame) {
          lastFrameRef.current = frame;
        }
      } catch (e) {
        // Silent ignore
      }
    }, 2000); // every 2 seconds

    return () => clearInterval(interval);
  }, [isInitializing, attempt, step]);

  // Soft-lockdown: detect focus loss + prevent accidental page kill.
  // Every tab switch / focus loss is recorded as a violation.
  // The webcam snapshot is captured and sent to the BACKEND for storage upload.
  useEffect(() => {
    if (isInitializing || !attempt || attempt.completed || step !== 4) return;

    // Prevent browser from leaving/reloading the page
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = 'Your exam is in progress. Leaving this page will interrupt your session.';
      return e.returnValue;
    };

    // Snapshot + DB write on every focus-loss event
    const recordViolation = async (violationType) => {
      // Increment counter and show overlay immediately (sync, no await)
      setViolationCount(prev => prev + 1);
      if (!showWarningRef.current) {
        setShowWarning(true);
      }

      let imageBase64 = null;
      let captureErrorMsg = '';

      try {
        // Try fresh capture first
        imageBase64 = await captureCameraSnapshot();
        if (!imageBase64 && lastFrameRef.current) {
          imageBase64 = lastFrameRef.current;
          captureErrorMsg = ' (Used cached frame)';
        } else if (!imageBase64) {
          captureErrorMsg = ' (No frame available)';
        }
      } catch (err) {
        console.error('[violations] capture error:', err.message);
        if (lastFrameRef.current) {
          imageBase64 = lastFrameRef.current;
          captureErrorMsg = ` (Capture failed, used cached: ${err.message})`;
        } else {
          captureErrorMsg = ` (Capture failed: ${err.message})`;
        }
      }

      // POST to backend — service-role key handles storage upload + DB insert
      apiClient.post('/violations', {
        tenant_id: tenantId,
        exam_id: examId,
        candidate_id: user.id,
        attempt_id: attempt.id,
        type: violationType + captureErrorMsg,
        timestamp: new Date().toISOString(),
        image_base64: imageBase64 || undefined   // backend uploads this to storage
      }).catch(err => console.error('[violations POST] failed:', err));
    };

    // visibilitychange fires reliably when switching tabs
    const handleVisibilityChange = () => {
      if (document.hidden) {
        recordViolation('Tab Switch Violation');
      }
    };

    // blur fires when focus moves to another app / devtools (tab still visible)
    const handleBlur = () => {
      if (!document.hidden) {
        recordViolation('Window Focus Loss');
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isInitializing, attempt, tenantId, examId, user?.id, step]);

  const handleSelectOption = (qId, optIdx) => {
    setAnswers(prev => ({ ...prev, [qId]: optIdx }));
  };

  const handleSubmit = async (auto = false) => {
    if (!attempt) return;
    try {
      await entities.ExamAttempt.update(attempt.id, { 
        answers: answersRef.current,
        time_left: timeLeftRef.current,
        completed: true
      });

      // Calculate results immediately on the backend — this writes to the results table
      try {
        await apiClient.post('/calculate-result', { attempt_id: attempt.id });
      } catch (err) {
        console.error("Failed to calculate result on submit", err);
      }
      
      if (auto) {
        toast.info("Time's up! Exam submitted automatically.");
      } else {
        toast.success("Exam submitted successfully!");
      }
      setStep(5);
    } catch (e) {
      console.error(e);
      toast.error("Failed to submit exam.");
    }
  };

  if (isLoadingExam || isLoadingAttempt || isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const randomizedQuestions = attempt?.randomized_questions || [];
  
  if (step === 5) {
    const answeredCount = Object.keys(answers).length;
    const stats = {
      answered: answeredCount,
      unanswered: randomizedQuestions.length - answeredCount,
      violations: violationCount,
      timeTaken: `${Math.floor(((exam?.duration_minutes || 60) * 60 - timeLeft) / 60)}:${String(((exam?.duration_minutes || 60) * 60 - timeLeft) % 60).padStart(2, '0')}`
    };
    return <ExamSubmitted stats={stats} />;
  }

  if (randomizedQuestions.length === 0) return null;

  const currentQuestion = randomizedQuestions[currentQuestionIdx];
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="bg-white border-b px-6 py-3 flex justify-between items-center sticky top-0 z-20 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-3 w-1/4">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
            <Eye className="w-5 h-5" />
          </div>
          <span className="font-bold text-lg tracking-tight text-slate-800">ProctorAI</span>
        </div>
        
        <div className="text-center w-2/4">
          <h1 className="text-sm font-semibold text-slate-800">{exam.title}</h1>
          <p className="text-xs text-slate-500 mt-0.5">ID: {examId.substring(0, 8).toUpperCase()} • {new Date().toLocaleDateString()}</p>
        </div>

        <div className="w-1/4 flex justify-end items-center gap-4">
          {step === 4 ? (
             <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full font-bold text-sm text-slate-700 border">
              <Clock className="w-4 h-4 text-slate-500" />
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 border border-green-200 text-green-700 text-xs font-semibold">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
              Secure Session
            </div>
          )}
        </div>
      </header>

      {step < 4 && (
        <div className="bg-white border-b py-6 flex justify-center">
          <div className="flex items-center w-full max-w-2xl px-4">
            <StepIndicator number={1} label="System Check" active={step === 1} completed={step > 1} />
            <div className={`flex-1 h-0.5 mx-2 ${step > 1 ? 'bg-green-500' : 'bg-slate-200'}`}></div>
            <StepIndicator number={2} label="ID Verification" active={step === 2} completed={step > 2} />
            <div className={`flex-1 h-0.5 mx-2 ${step > 2 ? 'bg-green-500' : 'bg-slate-200'}`}></div>
            <StepIndicator number={3} label="Rules & Agreement" active={step === 3} completed={step > 3} />
            <div className={`flex-1 h-0.5 mx-2 ${step > 3 ? 'bg-green-500' : 'bg-slate-200'}`}></div>
            <StepIndicator number={4} label="Exam" active={step === 4} completed={step > 4} />
          </div>
        </div>
      )}

      {step === 1 && <SystemCheck onComplete={() => setStep(2)} />}
      {step === 2 && <IdVerification user={user} exam={exam} onComplete={() => setStep(3)} />}
      {step === 3 && <RulesAgreement user={user} onComplete={() => setStep(4)} />}

      {step === 4 && (
        <div className="flex flex-1 overflow-hidden relative">
          
          {showWarning && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-6">
              <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-5">
                  <AlertCircle className="w-9 h-9 text-red-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Tab Switch Detected!</h2>
                <p className="text-slate-500 text-sm mb-4">
                  You navigated away from the exam window. This incident has been recorded by the proctoring system.
                </p>
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 mb-6 inline-block">
                  <span className="text-red-700 text-sm font-semibold">
                    ⚠️ Violations recorded: {violationCount}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mb-6">
                  Your answers and exam progress are safe. Click below to continue.
                </p>
                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl text-base"
                  onClick={() => {
                    setShowWarning(false);
                    showWarningRef.current = false; // Reset so next tab-switch shows overlay again
                  }}
                >
                  Continue Exam
                </Button>
              </div>
            </div>
          )}

          <main className="flex-1 p-6 md:p-10 overflow-y-auto">
            <div className="max-w-4xl mx-auto">
              <div className="mb-6 flex justify-between items-end border-b border-slate-200 pb-4">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  Section A
                </span>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  {currentQuestion.marks_awarded || 1} points
                </span>
              </div>
              
              <div className="flex gap-4 items-start mb-8">
                <div className="text-2xl font-bold text-slate-300 mt-1">{currentQuestionIdx + 1}</div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 tracking-wider">
                      MULTIPLE CHOICE
                    </span>
                  </div>
                  
                  <h2 className="text-xl md:text-2xl font-medium text-slate-800 leading-relaxed mb-8">
                    {currentQuestion.text}
                  </h2>

                  <div className="space-y-4">
                    {currentQuestion.options.map((opt, idx) => {
                      const isSelected = answers[currentQuestion.id] === idx;
                      const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
                      return (
                        <button
                          key={idx}
                          onClick={() => handleSelectOption(currentQuestion.id, idx)}
                          className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center gap-4 ${
                            isSelected 
                              ? 'border-blue-500 bg-blue-50/30 text-blue-900 shadow-sm' 
                              : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-xs font-bold transition-colors ${
                            isSelected ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500'
                          }`}>
                            {letters[idx]}
                          </div>
                          <span className={`text-base leading-snug ${isSelected ? 'font-medium' : ''}`}>{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-12 flex justify-between items-center border-t border-slate-200 pt-6">
                <Button 
                  variant="ghost" 
                  onClick={() => setCurrentQuestionIdx(prev => prev - 1)}
                  disabled={currentQuestionIdx === 0}
                  className="text-slate-500 hover:text-slate-800"
                >
                  &lt; Previous
                </Button>
                
                <span className="text-sm font-medium text-slate-400">
                  {currentQuestionIdx + 1} / {randomizedQuestions.length}
                </span>

                <Button 
                  onClick={() => setCurrentQuestionIdx(prev => Math.min(prev + 1, randomizedQuestions.length - 1))}
                  disabled={currentQuestionIdx === randomizedQuestions.length - 1}
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-6"
                >
                  Next &gt;
                </Button>
              </div>
            </div>
          </main>

          <ProctoringSidebar 
            videoRef={videoRef}
            questions={randomizedQuestions}
            currentIdx={currentQuestionIdx}
            answers={answers}
            onNavigate={setCurrentQuestionIdx}
            onSubmit={() => handleSubmit(false)}
          />
        </div>
      )}
    </div>
  );
}

function StepIndicator({ number, label, active, completed }) {
  let circleClasses = "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors";
  let textClasses = "text-xs font-semibold mt-2 transition-colors";

  if (completed) {
    circleClasses += " bg-green-500 border-green-500 text-white";
    textClasses += " text-green-600";
  } else if (active) {
    circleClasses += " bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/30";
    textClasses += " text-blue-600";
  } else {
    circleClasses += " bg-white border-slate-200 text-slate-400";
    textClasses += " text-slate-400";
  }

  return (
    <div className="flex flex-col items-center w-24">
      <div className={circleClasses}>
        {completed ? <Check className="w-4 h-4" /> : number}
      </div>
      <span className={textClasses}>{label}</span>
    </div>
  );
}