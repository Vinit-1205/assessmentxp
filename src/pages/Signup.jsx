import React, { useState } from "react";
import { supabase } from "@/api/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck, Mail, KeyRound } from "lucide-react";
import { toast } from "sonner";

export default function Signup() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");

  const validateEmail = (email) => {
    return true; // Allow all email domains including gmail.com
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");

    if (!validateEmail(email)) {
      setError("Please use a valid B2B company email. Personal domains are not allowed.");
      return;
    }

    setLoading(true);
    try {
      const generatedTempPassword = crypto.randomUUID() + 'Aa1!';
      setTempPassword(generatedTempPassword);
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password: generatedTempPassword,
        options: { data: { full_name: '' } },
      });
      if (signUpError) throw signUpError;
      setStep(2);
      toast.success("Verification code sent to your email.");
    } catch (err) {
      setError(err.message || "Registration failed. The email may already be registered.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: 'signup',
      });
      if (verifyError) throw verifyError;

      // Sign in with the temp password to establish a live session
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: tempPassword,
      });
      if (signInError) throw signInError;

      console.log("[Signup] Logged-in session confirmed");

      if (!loggedInUser) {
        throw new Error("Login did not establish a session. Please try again.");
      }

      toast.success("Email verified! Redirecting to setup...");
      window.location.href = "/setup";
    } catch (err) {
      setError(err.message || "Verification failed. Please check the code and try again.");
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!email) {
      toast.error("Email is missing.");
      return;
    }
    setError("");
    setResending(true);
    try {
      const { error: resendError } = await supabase.auth.resend({ type: 'signup', email });
      if (resendError) throw resendError;
      setOtpCode("");
      toast.success("New verification code sent to your email.");
    } catch (err) {
      toast.error(err?.message || "Failed to resend code.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-[#002147]">
      <div className="hidden lg:flex flex-1 flex-col justify-center items-center p-12 text-white relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-500/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl"></div>
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:4rem_4rem]"></div>

        <div className="relative z-10 text-center max-w-xl">
          <div className="inline-flex items-center justify-center p-4 bg-white/10 rounded-2xl backdrop-blur-md border border-white/20 mb-8 shadow-2xl">
            <ShieldCheck className="w-16 h-16 text-white" />
          </div>
          <h1 className="text-5xl font-bold mb-6 tracking-tight drop-shadow-md">AssessmentXP</h1>
          <p className="text-2xl text-blue-100 font-light leading-relaxed">
            Launch your secure assessment workspace in minutes.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-white/5 backdrop-blur-xl border-l border-white/10 relative z-20">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 lg:p-10">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-[#002147] mb-2">
              {step === 1 ? "Create Your Workspace" : "Verify Your Email"}
            </h2>
            <p className="text-slate-500">
              {step === 1
                ? "Enter your B2B email to get started."
                : `We sent a 6-digit code to ${email}`}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-[#A41034]/10 border border-[#A41034]/20 text-[#A41034] text-sm font-medium text-center shadow-sm">
              {error}
            </div>
          )}

          {step === 1 ? (
            <form onSubmit={handleRegister} className="space-y-5">
              <div className="space-y-2">
                <Label className="text-slate-700 font-medium">Work Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <Input
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-11 h-12 bg-slate-50 border-slate-200 focus:border-[#002147] focus:ring-[#002147]/20 rounded-xl"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-[#002147] hover:bg-[#002147]/90 text-white rounded-xl font-semibold text-base mt-4"
                disabled={loading}
              >
                {loading ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Sending...</>
                ) : (
                  "Continue with Email"
                )}
              </Button>

              <p className="text-center text-sm text-slate-500 pt-2">
                Already have an account?{" "}
                <a href="/login" className="font-medium text-[#002147] hover:underline">
                  Sign in
                </a>
              </p>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div className="space-y-2">
                <Label className="text-slate-700 font-medium">Verification Code</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="6-digit code"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    className="pl-11 h-12 bg-slate-50 border-slate-200 focus:border-[#002147] focus:ring-[#002147]/20 rounded-xl tracking-widest text-center font-mono text-lg"
                    maxLength={6}
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-[#002147] hover:bg-[#002147]/90 text-white rounded-xl font-semibold text-base"
                disabled={loading || otpCode.length < 4}
              >
                {loading ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Verifying...</>
                ) : (
                  "Verify & Continue"
                )}
              </Button>

              <div className="flex items-center justify-between text-sm pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-slate-500 hover:text-slate-700 font-medium"
                >
                  ← Edit email
                </button>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resending}
                  className="text-[#002147] hover:underline font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                >
                  {resending ? <><Loader2 className="w-3 h-3 animate-spin" /> Sending...</> : "Resend code"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}