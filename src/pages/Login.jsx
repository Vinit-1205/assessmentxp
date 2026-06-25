import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck, Mail, Lock, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Login() {
  const [loginMode, setLoginMode] = useState("credentials"); // 'credentials' or 'token'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

 const handleSubmit = async (e) => {
  e.preventDefault();
  setError("");
  setLoading(true);

  try {
    if (loginMode === "credentials") {
      // --- STEP 1: Normalize inputs ---
      const normalizedEmail = email.trim().toLowerCase();
      console.log("[LOGIN] Step 1 — raw email:", JSON.stringify(email), "| normalized:", JSON.stringify(normalizedEmail));
      console.log("[LOGIN] Step 1 — password length:", password.length, "| has leading/trailing space:", password !== password.trim());

      // --- STEP 2: Authenticate against Base44 Auth ---
      console.log("[LOGIN] Step 2 — calling loginViaEmailPassword...");
      try {
        await base44.auth.loginViaEmailPassword(normalizedEmail, password);
        console.log("[LOGIN] Step 2 — ✅ loginViaEmailPassword SUCCEEDED");
      } catch (authErr) {
        console.error("[LOGIN] Step 2 — ❌ loginViaEmailPassword FAILED:", authErr);
        console.error("[LOGIN] Step 2 — error.message:", authErr?.message);
        console.error("[LOGIN] Step 2 — error.status:", authErr?.status, "| response:", authErr?.response?.data);
        throw authErr;
      }

      // --- STEP 3: Fetch the authenticated user ---
      console.log("[LOGIN] Step 3 — calling base44.auth.me()...");
      const loggedInUser = await base44.auth.me();
      console.log("[LOGIN] Step 3 — ✅ user:", loggedInUser);
      console.log("[LOGIN] Step 3 — user.id:", loggedInUser?.id, "| role:", loggedInUser?.role);
      console.log("[LOGIN] Step 3 — tenant_access type:", Array.isArray(loggedInUser?.tenant_access) ? "array" : typeof loggedInUser?.tenant_access, "| value:", loggedInUser?.tenant_access);

      // --- STEP 4: Resolve tenant_access (handle BOTH array and object shapes) ---
      const rawAccess = loggedInUser?.tenant_access;
      const tenantAccessList = Array.isArray(rawAccess)
        ? rawAccess
        : rawAccess && typeof rawAccess === "object"
          ? [rawAccess]
          : [];
      console.log("[LOGIN] Step 4 — normalized tenantAccessList:", tenantAccessList);

      if (loggedInUser?.role === "user" && tenantAccessList.length > 0) {
        const targetInstitutionId = tenantAccessList[0].institution_id;
        console.log("[LOGIN] Step 5 — targetInstitutionId:", targetInstitutionId);

        // --- STEP 5: Verify the TenantUser mapping ---
        console.log("[LOGIN] Step 5 — querying TenantUser...");
        const verifiedTenantUsers = await base44.entities.TenantUser.filter({
          user_id: loggedInUser.id,
          institution_id: targetInstitutionId,
          is_active: true,
        });
        console.log("[LOGIN] Step 5 — matched TenantUser records:", verifiedTenantUsers);

        if (verifiedTenantUsers.length > 0) {
          console.log("[LOGIN] Step 6 — ✅ verified tenant admin → /tenant-dashboard");
          window.location.href = "/tenant-dashboard";
          return;
        }
        console.warn("[LOGIN] Step 6 — ⚠️ no active TenantUser match → falling through to /dashboard");
      } else {
        console.log("[LOGIN] Step 5 — skipped tenant check (role is not 'user' or no tenant_access)");
      }

      console.log("[LOGIN] Step 7 — redirecting to /dashboard");
      window.location.href = "/dashboard";
      return;
    } else {
      console.log("[LOGIN] Token mode — invoking loginWithToken...");
      await base44.functions.invoke("loginWithToken", { token });
      window.location.href = "/dashboard";
      return;
    }
  } catch (err) {
    console.error("[LOGIN] FATAL — login flow failed:", err);
    const status = err?.status || err?.response?.status;
    if (status === 401 || status === 403) {
      setError("Invalid email or password. Please check your credentials and try again.");
    } else {
      setError(err?.message || "Something went wrong during login. Please try again.");
    }
  } finally {
    setLoading(false);
  }
};
  return (

    <div className="min-h-screen w-full flex bg-[#002147]">
      {/* Left Side - Branding (The Glass & The Grid) */}
      <div className="hidden lg:flex flex-1 flex-col justify-center items-center p-12 text-white relative overflow-hidden">
        {/* Glass effect background elements */}
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-500/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl"></div>
        
        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:4rem_4rem]"></div>

        <div className="relative z-10 text-center max-w-xl">
          <div className="inline-flex items-center justify-center p-4 bg-white/10 rounded-2xl backdrop-blur-md border border-white/20 mb-8 shadow-2xl">
            <ShieldCheck className="w-16 h-16 text-white" />
          </div>
          <h1 className="text-5xl font-bold mb-6 tracking-tight drop-shadow-md">AssessmentXP</h1>
          <p className="text-2xl text-blue-100 font-light leading-relaxed">
            Secure evaluation at any scale.
          </p>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-white/5 backdrop-blur-xl border-l border-white/10 relative z-20">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 lg:p-10">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-[#002147] mb-2">Welcome Back</h2>
            <p className="text-slate-500">Sign in to continue to your dashboard</p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-[#A41034]/10 border border-[#A41034]/20 text-[#A41034] text-sm font-medium text-center shadow-sm">
              {error}
            </div>
          )}

          <div className="flex p-1 mb-8 bg-slate-100 rounded-xl">
            <button
              type="button"
              className={cn(
                "flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all",
                loginMode === "credentials" 
                  ? "bg-white text-[#002147] shadow-sm" 
                  : "text-slate-500 hover:text-slate-700"
              )}
              onClick={() => setLoginMode("credentials")}
            >
              Email & Password
            </button>
            <button
              type="button"
              className={cn(
                "flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all",
                loginMode === "token" 
                  ? "bg-white text-[#002147] shadow-sm" 
                  : "text-slate-500 hover:text-slate-700"
              )}
              onClick={() => setLoginMode("token")}
            >
              Exam Token
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {loginMode === "credentials" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-700 font-medium">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-11 h-12 bg-slate-50 border-slate-200 focus:border-[#002147] focus:ring-[#002147]/20 rounded-xl"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-slate-700 font-medium">Password</Label>
                    <a href="/forgot-password" className="text-sm font-medium text-[#002147] hover:underline">
                      Forgot password?
                    </a>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-11 h-12 bg-slate-50 border-slate-200 focus:border-[#002147] focus:ring-[#002147]/20 rounded-xl"
                      required
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="token" className="text-slate-700 font-medium">Exam Token</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <Input
                    id="token"
                    type="text"
                    placeholder="Have an Exam Token? Enter it here to start."
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    className="pl-11 h-12 bg-slate-50 border-slate-200 focus:border-[#002147] focus:ring-[#002147]/20 rounded-xl"
                    required
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Enter the secure token provided by your administrator to immediately access your assessment.
                </p>
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full h-12 bg-[#002147] hover:bg-[#002147]/90 text-white rounded-xl font-semibold text-base transition-colors mt-4" 
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Authenticating...
                </>
              ) : (
                loginMode === "credentials" ? "Sign In" : "Start Exam"
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Don't have an account?{" "}
            <a href="/signup" className="font-medium text-[#002147] hover:underline">
              Create new organization
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}