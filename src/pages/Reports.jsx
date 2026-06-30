import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { entities } from '@/api/entities';
import { useTenantContext } from '@/hooks/useTenantContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, AlertTriangle, FileText, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Reports() {
  const { tenantId } = useTenantContext();

  const { data: exams, isLoading: loadingExams } = useQuery({
    queryKey: ['exams', tenantId],
    queryFn: () => entities.Exam.filter({ institution_id: tenantId }),
    enabled: !!tenantId,
  });

  const { data: violations, isLoading: loadingViolations } = useQuery({
    queryKey: ['violations', tenantId],
    queryFn: () => entities.Violation.filter({ institution_id: tenantId }),
    enabled: !!tenantId,
  });

  const { data: results, isLoading: loadingResults } = useQuery({
    queryKey: ['results', tenantId],
    queryFn: () => entities.Result.filter({ institution_id: tenantId }),
    enabled: !!tenantId,
  });

  const totalExams = exams?.length || 0;
  const totalViolations = violations?.length || 0;
  const passRate = results?.length ? Math.round((results.filter(r => r.passed).length / results.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Reports & Analytics</h1>
          <p className="text-muted-foreground mt-1">Exportable audit reports, violation summaries, and exam analytics.</p>
        </div>
        <Button variant="outline" className="gap-2 shrink-0">
          <Download className="w-4 h-4" /> Export All Data
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                <FileText className="w-5 h-5" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-slate-800">{totalExams}</h3>
            <p className="text-sm font-medium text-slate-500">Exams Conducted</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-slate-800">{totalViolations}</h3>
            <p className="text-sm font-medium text-slate-500">Total Violations Logged</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-slate-800">{passRate}%</h3>
            <p className="text-sm font-medium text-slate-500">Average Pass Rate</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Violation Reports</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingViolations ? (
              <p className="text-sm text-slate-500">Loading...</p>
            ) : violations?.length === 0 ? (
              <p className="text-sm text-slate-500">No violations logged yet.</p>
            ) : (
              <div className="space-y-4">
                {violations.slice(0, 5).map(v => (
                  <div key={v.id} className="flex items-center justify-between p-3 border rounded-lg bg-slate-50">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{v.type}</p>
                      <p className="text-xs text-slate-500">{new Date(v.timestamp).toLocaleString()}</p>
                    </div>
                    <Button variant="ghost" size="sm" className="text-blue-600 h-8">Review</Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Available Audit Exports</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 border rounded-xl flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-slate-800">Comprehensive Exam Audit</h4>
                <p className="text-xs text-slate-500 mt-1">Full breakdown of all exam attempts, scores, and timestamps.</p>
              </div>
              <Button variant="outline" size="sm" className="gap-2"><Download className="w-4 h-4"/> CSV</Button>
            </div>
            <div className="p-4 border rounded-xl flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-slate-800">Proctoring Incident Log</h4>
                <p className="text-xs text-slate-500 mt-1">Detailed log of all AI-flagged violations across all sessions.</p>
              </div>
              <Button variant="outline" size="sm" className="gap-2"><Download className="w-4 h-4"/> CSV</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}