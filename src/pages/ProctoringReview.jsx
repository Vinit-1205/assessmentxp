import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTenantContext } from '@/hooks/useTenantContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from 'react-router-dom';
import { Loader2, ShieldCheck } from 'lucide-react';

export default function ProctoringReview() {
  const navigate = useNavigate();
  const [selectedExamId, setSelectedExamId] = useState("");

  const { user, tenantId } = useTenantContext();

  const { data: exams, isLoading: isLoadingExams } = useQuery({
    queryKey: ['exams', tenantId],
    queryFn: () => base44.entities.Exam.filter({ tenant_id: tenantId }),
    enabled: !!tenantId,
  });

  const { data: results, isLoading: isLoadingResults } = useQuery({
    queryKey: ['results', selectedExamId],
    queryFn: () => base44.entities.Result.filter({ exam_id: selectedExamId }),
    enabled: !!selectedExamId,
  });

  const { data: users } = useQuery({
    queryKey: ['users', tenantId],
    queryFn: () => base44.entities.User.filter({ tenant_id: tenantId }),
    enabled: !!tenantId,
  });

  const getIntegrityColor = (score) => {
    if (score >= 90) return 'text-green-600 font-semibold';
    if (score >= 70) return 'text-yellow-600 font-semibold';
    return 'text-red-600 font-semibold';
  };

  const getBadgeVariant = (status) => {
    if (status === 'Pending Admin Review') return 'destructive';
    if (status === 'Auto-Approved Pass') return 'default';
    return 'secondary';
  };

  const sortedResults = results ? [...results].sort((a, b) => {
    const aPending = a.final_result_status === "Pending Admin Review";
    const bPending = b.final_result_status === "Pending Admin Review";
    
    // Sort "Pending Admin Review" to the top
    if (aPending && !bPending) return -1;
    if (!aPending && bPending) return 1;
    
    // For others or same status, sort by lowest integrity score first
    return (a.integrity_score || 0) - (b.integrity_score || 0);
  }) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <ShieldCheck className="w-8 h-8 text-primary" />
          Proctoring Review
        </h1>
        <p className="text-muted-foreground mt-1">Review candidate integrity scores and final status.</p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Select Exam</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingExams ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Select value={selectedExamId} onValueChange={setSelectedExamId}>
              <SelectTrigger className="w-full max-w-md">
                <SelectValue placeholder="Select an exam to review" />
              </SelectTrigger>
              <SelectContent>
                {exams?.map(exam => (
                  <SelectItem key={exam.id} value={exam.id}>{exam.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {selectedExamId && (
        <Card>
          <CardHeader>
            <CardTitle>Candidates Review</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingResults ? (
              <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : sortedResults.length === 0 ? (
              <p className="text-muted-foreground">No completed exams found for this exam.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Candidate Name</TableHead>
                    <TableHead>Academic Score</TableHead>
                    <TableHead>Integrity Score</TableHead>
                    <TableHead>Final Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedResults.map((result) => {
                    const candidate = users?.find(u => u.id === result.candidate_id);
                    return (
                      <TableRow 
                        key={result.id} 
                        className="cursor-pointer hover:bg-slate-50 transition-colors"
                        onClick={() => navigate(`/audit?exam=${result.exam_id}&candidate=${result.candidate_id}`)}
                      >
                        <TableCell className="font-medium">
                          {candidate ? candidate.full_name : result.candidate_id}
                        </TableCell>
                        <TableCell>{result.academic_score ?? 0}%</TableCell>
                        <TableCell className={getIntegrityColor(result.integrity_score ?? 100)}>
                          {result.integrity_score ?? 100}%
                        </TableCell>
                        <TableCell>
                          <Badge variant={getBadgeVariant(result.final_result_status)}>
                            {result.final_result_status || 'Unknown'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}