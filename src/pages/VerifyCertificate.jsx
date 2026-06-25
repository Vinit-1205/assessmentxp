import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, Loader2, Award, ExternalLink } from 'lucide-react';

export default function VerifyCertificate() {
  const { credential_id } = useParams();

  const { data, isLoading, error } = useQuery({
    queryKey: ['verify', credential_id],
    queryFn: async () => {
      const res = await base44.functions.invoke('verifyCertificate', { credential_id });
      return res.data;
    },
    retry: false
  });

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md">
        <Card className="border-0 shadow-xl overflow-hidden">
          <div className="bg-slate-900 h-2 w-full" />
          <CardHeader className="text-center pb-2 pt-8">
            <div className="mx-auto w-16 h-16 bg-blue-50 border border-blue-100 rounded-full flex items-center justify-center mb-4 shadow-sm">
              <Award className="w-8 h-8 text-blue-600" />
            </div>
            <CardTitle className="text-2xl text-slate-900">Credential Verification</CardTitle>
            <CardDescription className="text-base mt-2">Verify the authenticity of a digital certificate</CardDescription>
          </CardHeader>
          
          <CardContent className="pt-6 pb-8">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-10 space-y-4">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <p className="text-slate-500 font-medium">Verifying blockchain & records...</p>
              </div>
            ) : data?.valid ? (
              <div className="space-y-6 animate-in fade-in zoom-in duration-300">
                <div className="bg-green-50 text-green-800 p-4 rounded-xl flex items-start gap-3 border border-green-200 shadow-sm">
                  <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-green-900">Valid & Authentic</h4>
                    <p className="text-sm text-green-700 mt-1 leading-relaxed">This credential has been verified and securely recorded in our assessment system.</p>
                  </div>
                </div>
                
                <div className="space-y-5 bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Candidate</p>
                    <p className="text-lg font-semibold text-slate-900">{data.credential.candidate_name}</p>
                  </div>
                  <div className="h-px w-full bg-slate-100" />
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Assessment</p>
                    <p className="text-base font-medium text-slate-800">{data.credential.exam_title}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-6 pt-2">
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Score</p>
                      <p className="text-lg font-bold text-slate-900">{data.credential.score}%</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Issued</p>
                      <p className="text-base font-medium text-slate-800">{new Date(data.credential.issue_date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                    </div>
                  </div>
                </div>

                {data.credential.certificate_url && (
                  <Button className="w-full gap-2 h-12 text-base font-medium shadow-sm hover:shadow" variant="outline" onClick={() => window.open(data.credential.certificate_url, '_blank')}>
                    <ExternalLink className="w-4 h-4" /> View Original Certificate
                  </Button>
                )}
              </div>
            ) : (
              <div className="bg-red-50 text-red-800 p-8 rounded-xl flex flex-col items-center text-center gap-4 border border-red-200 shadow-sm animate-in fade-in zoom-in duration-300">
                <div className="p-3 bg-red-100 rounded-full">
                  <AlertCircle className="w-10 h-10 text-red-600" />
                </div>
                <div>
                  <h4 className="font-bold text-xl text-red-900 mb-2">Invalid Credential</h4>
                  <p className="text-sm text-red-700 leading-relaxed">We could not find a valid credential matching this ID. It may have been revoked or the URL is incorrect.</p>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-center border-t border-slate-100 bg-slate-50/80 p-5">
            <Button variant="link" asChild className="text-slate-500 hover:text-slate-700 font-medium">
              <Link to="/login">Return to Platform</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}