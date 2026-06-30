import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/api/supabaseClient';
import { apiClient } from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Building2, Lock, ArrowRight, ShieldCheck, Globe, MapPin, Map, Users, Phone, Link } from 'lucide-react';
import { toast } from 'sonner';

export default function SetupWizard() {
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    domain: '',
    logo_url: '',
    country: '',
    address: '',
    location: '',
    student_volume: '',
    phone: '',
    website: ''
  });
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const navigate = useNavigate();
  const { checkUserAuth } = useAuth();

  // Fetch the authenticated user's email on mount so it can be passed
  // through to signupTenantAdmin for the TenantUser record.
  useEffect(() => {
    (async () => {
      try {
        const { data: { user: me } } = await supabase.auth.getUser();
        console.log("[SetupWizard] Authenticated user email loaded");
        if (me?.email) setUserEmail(me.email);
      } catch (err) {
        console.error("[SetupWizard] Could not load profile user email");
      }
    })();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

 const handleSetup = async (e) => {
  e.preventDefault();

  setError("");
  setLoading(true);

  try {
    // Password validation
    if (newPassword !== confirmPassword) {
      throw new Error("Passwords do not match");
    }

    if (newPassword.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }

    // Required field validation
    if (!formData.name?.trim()) {
      throw new Error("Institution Name is required");
    }

    if (!formData.slug?.trim()) {
      throw new Error("Institution Slug is required");
    }

    if (!formData.country?.trim()) {
      throw new Error("Country is required");
    }

    if (!formData.phone?.trim()) {
      throw new Error("Phone number is required");
    }

    // -------------------------
    // VERIFY AUTH SESSION
    // -------------------------
    console.log("[SetupWizard] Checking session...");

    let sessionUser = null;
    try {
      const { data: { user: me } } = await supabase.auth.getUser();
      sessionUser = me;
    } catch (meErr) {
      console.error("[SetupWizard] Could not resolve session");
    }

    if (!sessionUser) {
      throw new Error("You must be logged in to complete setup.");
    }

    // -------------------------
    // BUILD PAYLOAD
    // -------------------------
    const payload = {
      name: formData.name.trim(),
      slug: formData.slug
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-"),

      domain: formData.domain?.trim() || null,
      logo_url: formData.logo_url?.trim() || null,
      country: formData.country.trim(),
      address: formData.address?.trim() || null,
      location: formData.location?.trim() || null,

      student_volume: formData.student_volume
        ? Number(formData.student_volume)
        : null,

      phone: formData.phone.trim(),
      website: formData.website?.trim() || null,

      // Pass authenticated email
      email: sessionUser.email || null
    };

    // -------------------------
    // UPDATE PASSWORD
    // -------------------------
    if (sessionUser?.id) {
      try {
        await supabase.auth.updateUser({ password: newPassword });
      } catch (err) {
        console.warn("Failed to update password");
      }
    }

    // -------------------------
    // CREATE TENANT
    // -------------------------
    console.log("[SetupWizard] Finalizing account creation...");

    await apiClient.post('/signup-tenant-admin', payload);

    toast.success("Setup complete! Redirecting to your dashboard...");

    // Refresh auth so RoleBasedRouter picks up the new tenant_admin role,
    // then navigate via React Router (no hard reload needed).
    try {
      await checkUserAuth();
    } catch (refreshErr) {
      console.warn("[SetupWizard] Could not refresh auth after setup");
    }

    setTimeout(() => {
      navigate('/dashboard', { replace: true });
    }, 1500);

  } catch (err) {
    console.error("[SetupWizard] Registration error occurred");

    const backendMessage =
      err?.response?.data?.detail ||
      err?.response?.data?.error ||
      err?.response?.data?.message ||
      err?.message ||
      "Setup failed";

    setError(backendMessage);

    toast.error(backendMessage);
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl flex flex-col items-center">
        <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-2xl mb-4">
          <ShieldCheck className="w-10 h-10 text-primary" />
        </div>
        <h2 className="mt-2 text-center text-3xl font-extrabold text-slate-900">
          Welcome to AssessmentXP
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          Let's finalize your secure account setup
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-2xl">
        <div className="bg-white py-8 px-4 shadow-xl sm:rounded-2xl sm:px-10 border border-slate-100">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-[#A41034]/10 border border-[#A41034]/20 text-[#A41034] text-sm font-medium text-center">
              {error}
            </div>
          )}
          
          <form className="space-y-6" onSubmit={handleSetup}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-slate-700 font-medium">Permanent Password</Label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Lock className="h-5 w-5 text-slate-400" /></div>
                    <Input type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="pl-10 bg-slate-50" placeholder="New password" />
                  </div>
                </div>
                <div>
                  <Label className="text-slate-700 font-medium">Confirm Password</Label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Lock className="h-5 w-5 text-slate-400" /></div>
                    <Input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="pl-10 bg-slate-50" placeholder="Confirm password" />
                  </div>
                </div>
            </div>

            <div className="pt-6 mt-6 border-t border-slate-100">
              <h3 className="text-lg font-medium text-slate-900 mb-4">Institution Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <Label className="text-slate-700 font-medium">Institution Name</Label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Building2 className="h-5 w-5 text-slate-400" /></div>
                      <Input type="text" name="name" required value={formData.name} onChange={handleChange} className="pl-10 bg-slate-50" placeholder="e.g. Springfield University" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-slate-700 font-medium">Unique Slug</Label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Link className="h-5 w-5 text-slate-400" /></div>
                      <Input type="text" name="slug" required value={formData.slug} onChange={handleChange} className="pl-10 bg-slate-50" placeholder="springfield-uni" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-slate-700 font-medium">Primary Domain (Optional)</Label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Globe className="h-5 w-5 text-slate-400" /></div>
                      <Input type="text" name="domain" value={formData.domain} onChange={handleChange} className="pl-10 bg-slate-50" placeholder="springfield.edu" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-slate-700 font-medium">Country</Label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Map className="h-5 w-5 text-slate-400" /></div>
                      <Input type="text" name="country" required value={formData.country} onChange={handleChange} className="pl-10 bg-slate-50" placeholder="Country" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-slate-700 font-medium">Location / City (Optional)</Label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><MapPin className="h-5 w-5 text-slate-400" /></div>
                      <Input type="text" name="location" value={formData.location} onChange={handleChange} className="pl-10 bg-slate-50" placeholder="City" />
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-slate-700 font-medium">Physical Address (Optional)</Label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><MapPin className="h-5 w-5 text-slate-400" /></div>
                      <Input type="text" name="address" value={formData.address} onChange={handleChange} className="pl-10 bg-slate-50" placeholder="Full address" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-slate-700 font-medium">Student Volume</Label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Users className="h-5 w-5 text-slate-400" /></div>
                      <Input type="number" name="student_volume" value={formData.student_volume} onChange={handleChange} className="pl-10 bg-slate-50" placeholder="e.g. 5000" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-slate-700 font-medium">Phone</Label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Phone className="h-5 w-5 text-slate-400" /></div>
                      <Input type="tel" name="phone" required value={formData.phone} onChange={handleChange} className="pl-10 bg-slate-50" placeholder="Phone number" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-slate-700 font-medium">Website (Optional)</Label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Globe className="h-5 w-5 text-slate-400" /></div>
                      <Input type="url" name="website" value={formData.website} onChange={handleChange} className="pl-10 bg-slate-50" placeholder="https://..." />
                    </div>
                  </div>
                  <div>
                    <Label className="text-slate-700 font-medium">Logo URL (Optional)</Label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Link className="h-5 w-5 text-slate-400" /></div>
                      <Input type="url" name="logo_url" value={formData.logo_url} onChange={handleChange} className="pl-10 bg-slate-50" placeholder="https://..." />
                    </div>
                  </div>
              </div>
            </div>

            <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={loading}>
              {loading ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Finalizing Setup...</>
              ) : (
                <>Complete Setup <ArrowRight className="w-5 h-5 ml-2" /></>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}