import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { entities } from '@/api/entities';
import { useTenantContext } from '@/hooks/useTenantContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from 'react-router-dom';
import { Loader2, ShieldCheck, Eye, AlertTriangle } from 'lucide-react';

export default function ProctoringReview() {
  const navigate = useNavigate();
  const [selectedExamId, setSelectedExamId] = useState("");

  const { tenantId } = useTenantContext();

  const { data: exams, isLoading: isLoadingExams } = useQuery({
    queryKey: ['exams', tenantId],
    queryFn: () => entities.Exam.filter({ institution_id: tenantId }),
    enabled: !!tenantId,
  });

  const { data: results, isLoading: isLoadingResults } = useQuery({
    queryKey: ['results', selectedExamId],
    queryFn: () => entities.Result.filter({ exam_id: selectedExamId }),
    enabled: !!selectedExamId,
  });

  const { data: allViolations } = useQuery({
    queryKey: ['violations-exam', selectedExamId],
    queryFn: () => entities.Violation.filter({ exam_id: selectedExamId }, '-created_at'),
    enabled: !!selectedExamId,
  });

  // Load tenant_users so we can show email/name for each candidate
  const { data: tenantUsers } = useQuery({
    queryKey: ['tenantUsers', tenantId],
    queryFn: () => entities.TenantUser.filter({ institution_id: tenantId }),
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
    if (aPending && !bPending) return -1;
    if (!aPending && bPending) return 1;
    return (a.integrity_score || 0) - (b.integrity_score || 0);
  }) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <ShieldCheck className="w-8 h-8 text-primary" />
          Proctoring Review
        </h1>
        <p className="text-muted-foreground mt-1">Review candidate integrity scores, violations, and final status.</p>
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
            <div className="flex items-center justify-between">
              <CardTitle>Candidates Review</CardTitle>
              {sortedResults.length > 0 && (
                <span className="text-sm text-muted-foreground">
                  {sortedResults.length} candidate{sortedResults.length !== 1 ? 's' : ''} completed
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingResults ? (
              <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : sortedResults.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center">No completed exams found for this exam.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                    <TableHead>Candidate</TableHead>
                    <TableHead>Academic Score</TableHead>
                    <TableHead>Integrity Score</TableHead>
                    <TableHead>Violations</TableHead>
                    <TableHead>Final Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedResults.map((result) => {
                    const candidateEmail = tenantUsers?.find(u => u.user_id === result.candidate_id)?.email || result.candidate_id.substring(0, 8) + '...';
                    const violationCount = allViolations?.filter(v => v.candidate_id === result.candidate_id).length || 0;
                    return (
                      <TableRow key={result.id}>
                        <TableCell className="font-medium">{candidateEmail}</TableCell>
                        <TableCell>{result.academic_score ?? 0}%</TableCell>
                        <TableCell className={getIntegrityColor(result.integrity_score ?? 100)}>
                          {result.integrity_score ?? 100}%
                        </TableCell>
                        <TableCell>
                          {violationCount > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                              <AlertTriangle className="w-3 h-3" />
                              {violationCount} violation{violationCount !== 1 ? 's' : ''}
                            </span>
                          ) : (
                            <span className="text-green-600 text-xs font-medium">Clean</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getBadgeVariant(result.final_result_status)}>
                            {result.final_result_status || 'Unknown'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={() => navigate(`/audit?exam=${result.exam_id}&candidate=${result.candidate_id}`)}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Review
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}