import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/api/dbClient";
import { entities } from "@/api/entities";
import { apiClient } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck, Mail, Lock, KeyRound, Building } from "lucide-react";
import { cn } from "@/lib/utils";

export default function CandidateLogin() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tenantIdFromUrl = searchParams.get("tenant_id");

  const [loginMode, setLoginMode] = useState("credentials"); // 'credentials' or 'token'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Tenant Branding State
  const [tenantBranding, setTenantBranding] = useState({
    logo_url: null,
    brand_color: "#002147",
    name: "AssessmentXP"
  });

  // Fetch tenant branding if tenant_id is in URL
  useEffect(() => {
    async function fetchTenantBranding() {
      if (tenantIdFromUrl) {
        try {
          // Unauthenticated users might not have access to Tenant directly due to RLS,
          // so we use a public backend function or assume RLS allows read for branding.
          // Fallback to default if it fails.
          const res = await apiClient.get(`/tenant-branding/${tenantIdFromUrl}`);
          if (res?.tenant) {
            setTenantBranding({
              logo_url: res.tenant.logo_url,
              brand_color: res.tenant.border_color || "#002147",
              name: res.tenant.name || "AssessmentXP"
            });
          }
        } catch (err) {
          console.error("Failed to fetch tenant branding", err);
        }
      }
    }
    fetchTenantBranding();
  }, [tenantIdFromUrl]);

  // Optionally fetch branding when email changes (debounced) - skipped for simplicity, relying on URL or token.

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (loginMode === "credentials") {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        const user = signInData?.user;
        
        // If tenant_id isn't in URL, try to pull it from the user now that they are logged in
        if (!tenantIdFromUrl && user?.app_metadata?.institution_id) {
          try {
             const tenant = await entities.Tenant.get(user.app_metadata.institution_id);
             if (tenant) {
               setTenantBranding({
                 logo_url: tenant.logo_url,
                 brand_color: tenant.border_color || "#002147",
                 name: tenant.name
               });
             }
          } catch(e) {}
        }
        
        window.location.href = "/"; // Route to personal Student Portal Dashboard
      } else {
        // Attempt to authenticate via token
        try {
          const res = await apiClient.post("/login-with-exam-token", { token });
          if (res?.success && res?.exam_id) {
            // If the backend returned a session token to set:
            if (res.access_token) {
               await supabase.auth.setSession({
                 access_token: res.access_token,
                 refresh_token: res.refresh_token,
               });
            }
            window.location.href = `/exam/${res.exam_id}`;
          } else {
            throw new Error("Invalid token");
          }
        } catch (err) {
          throw new Error("Invalid credentials or expired exam token. Please verify your details or contact your institution's administrator.");
        }
      }
    } catch (err) {
      setError("Invalid credentials or expired exam token. Please verify your details or contact your institution's administrator.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-slate-50 font-sans">
      {/* Left Side - Branding (The Glass & The Grid) */}
      <div 
        className="hidden lg:flex flex-1 flex-col justify-center items-center p-12 text-white relative overflow-hidden transition-colors duration-500"
        style={{ backgroundColor: tenantBranding.brand_color }}
      >
        {/* Glass effect background elements */}
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-black/10 rounded-full blur-3xl"></div>
        
        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:4rem_4rem]"></div>

        <div className="relative z-10 text-center max-w-xl">
          <div className="inline-flex items-center justify-center p-6 bg-white/10 rounded-3xl backdrop-blur-md border border-white/20 mb-8 shadow-2xl">
            {tenantBranding.logo_url ? (
              <img src={tenantBranding.logo_url} alt={tenantBranding.name} className="h-16 object-contain" />
            ) : (
              <ShieldCheck className="w-16 h-16 text-white" />
            )}
          </div>
          <h1 className="text-5xl font-extrabold mb-6 tracking-tight drop-shadow-md">
            {tenantBranding.name} Student Portal
          </h1>
          <p className="text-2xl text-white/80 font-light leading-relaxed">
            Secure evaluation at any scale.
          </p>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 relative z-20">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-100 p-8 lg:p-10">
          <div className="text-center mb-8">
            <h2 
              className="text-3xl font-bold mb-2 transition-colors duration-500"
              style={{ color: tenantBranding.brand_color }}
            >
              Candidate Access
            </h2>
            <p className="text-slate-500 font-medium">Verify your identity to begin</p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-[#A41034]/10 border border-[#A41034]/20 text-[#A41034] text-sm font-semibold text-center shadow-sm">
              {error}
            </div>
          )}

          <div className="flex p-1.5 mb-8 bg-slate-100 rounded-xl">
            <button
              type="button"
              className={cn(
                "flex-1 py-2.5 text-sm font-bold rounded-lg transition-all",
                loginMode === "credentials" 
                  ? "bg-white shadow-sm" 
                  : "text-slate-500 hover:text-slate-700"
              )}
              style={loginMode === "credentials" ? { color: tenantBranding.brand_color } : {}}
              onClick={() => setLoginMode("credentials")}
            >
              Login with Account
            </button>
            <button
              type="button"
              className={cn(
                "flex-1 py-2.5 text-sm font-bold rounded-lg transition-all",
                loginMode === "token" 
                  ? "bg-white shadow-sm" 
                  : "text-slate-500 hover:text-slate-700"
              )}
              style={loginMode === "token" ? { color: tenantBranding.brand_color } : {}}
              onClick={() => setLoginMode("token")}
            >
              Enter Exam Token
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {loginMode === "credentials" ? (
              <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-700 font-bold">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="student@school.edu"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-11 h-12 bg-slate-50 border-slate-200 focus:ring-2 rounded-xl transition-shadow"
                      style={{ '--tw-ring-color': `${tenantBranding.brand_color}33`, '--tw-border-color': tenantBranding.brand_color }}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-slate-700 font-bold">Password</Label>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-11 h-12 bg-slate-50 border-slate-200 focus:ring-2 rounded-xl transition-shadow"
                      style={{ '--tw-ring-color': `${tenantBranding.brand_color}33`, '--tw-border-color': tenantBranding.brand_color }}
                      required
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="space-y-2">
                  <Label htmlFor="token" className="text-slate-700 font-bold">Exam Token</Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <Input
                      id="token"
                      type="text"
                      placeholder="Enter your secure 6-digit or encrypted Exam Token to begin"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      className="pl-11 h-14 bg-slate-50 border-slate-200 focus:ring-2 rounded-xl font-mono text-center tracking-wider transition-shadow"
                      style={{ '--tw-ring-color': `${tenantBranding.brand_color}33`, '--tw-border-color': tenantBranding.brand_color }}
                      required
                    />
                  </div>
                  <p className="text-sm text-slate-500 text-center mt-3">
                    Your token bypasses the password and routes you directly to your scheduled exam room.
                  </p>
                </div>
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full h-14 text-white rounded-xl font-bold text-lg transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 mt-6" 
              style={{ backgroundColor: tenantBranding.brand_color }}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                loginMode === "credentials" ? "Access Dashboard" : "Begin Exam Now"
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}