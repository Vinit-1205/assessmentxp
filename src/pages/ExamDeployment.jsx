import { useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTenantContext } from '@/hooks/useTenantContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UploadCloud, Send, ShieldCheck } from "lucide-react";
import { toast } from 'sonner';

export default function ExamDeployment() {
  const [selectedExamId, setSelectedExamId] = useState('');
  const [cohortId, setCohortId] = useState('');
  const [emails, setEmails] = useState([]);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef(null);

  const { user, tenantId } = useTenantContext();

  const { data: exams, isLoading: isLoadingExams } = useQuery({
    queryKey: ['exams', tenantId],
    queryFn: () => base44.entities.Exam.filter({ institution_id: tenantId, status: 'published' }, '-created_date'),
    enabled: !!tenantId,
  });

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      // Extract all email-like strings from the text
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const foundEmails = text.match(emailRegex) || [];
      const uniqueEmails = [...new Set(foundEmails)];
      setEmails(uniqueEmails);
      
      if (uniqueEmails.length === 0) {
        toast.error("No valid emails found in the CSV");
      } else {
        toast.success(`Found ${uniqueEmails.length} candidates in CSV`);
      }
    };
    reader.readAsText(file);
  };

  const deployMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        exam_id: selectedExamId,
        emails: emails,
        cohort_id: cohortId
      };
      const res = await base44.functions.invoke('deployExam', payload);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`Successfully deployed to ${data.count} candidates! Emails and tokens have been dispatched.`);
      setSelectedExamId('');
      setCohortId('');
      setEmails([]);
      setFileName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    onError: (error) => {
      toast.error(`Deployment failed: ${error.message}`);
    }
  });

  const handleDeploy = () => {
    if (!selectedExamId) {
      return toast.error("Please select an exam to deploy");
    }
    if (emails.length === 0) {
      return toast.error("Please upload a CSV file containing candidate emails");
    }
    deployMutation.mutate();
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold">Exam Deployment</h1>
        <p className="text-muted-foreground mt-1">Assign exams and issue secure access tokens to your cohorts.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Deployment Configuration</CardTitle>
            <CardDescription>Select the finalized exam and target cohort</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Select Exam</Label>
              <Select value={selectedExamId} onValueChange={setSelectedExamId} disabled={isLoadingExams}>
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingExams ? "Loading exams..." : "Select an exam..."} />
                </SelectTrigger>
                <SelectContent>
                  {exams?.map(exam => (
                    <SelectItem key={exam.id} value={exam.id}>
                      {exam.title} ({exam.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Cohort / Class ID (Optional)</Label>
              <Input 
                value={cohortId} 
                onChange={(e) => setCohortId(e.target.value)} 
                placeholder="e.g. CS101-Fall2026" 
              />
              <p className="text-xs text-muted-foreground">For organizational tracking</p>
            </div>

            <div className="space-y-2 pt-2">
              <Label>Bulk Enroll Candidates (CSV)</Label>
              <div className="border-2 border-dashed rounded-lg p-8 text-center bg-slate-50 hover:bg-slate-100 transition-colors">
                <input 
                  type="file" 
                  accept=".csv,.txt" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                />
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="mb-4">
                  <UploadCloud className="w-4 h-4 mr-2" />
                  Upload CSV File
                </Button>
                {fileName ? (
                  <p className="text-sm font-medium text-primary">Selected: {fileName} ({emails.length} candidates)</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Upload a CSV containing candidate email addresses</p>
                )}
              </div>
            </div>
            
            <div className="bg-primary/5 p-4 rounded-lg flex items-start gap-4">
              <ShieldCheck className="w-6 h-6 text-primary mt-1" />
              <div>
                <h4 className="font-semibold text-slate-800">Automated Provisioning</h4>
                <p className="text-sm text-slate-600 mt-1">
                  Deploying this exam will instantly generate a unique, encrypted Exam Token for every candidate. They will receive an automated email with their token and login instructions.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button 
                size="lg" 
                onClick={handleDeploy} 
                disabled={deployMutation.isPending || !selectedExamId || emails.length === 0}
                className="w-full md:w-auto"
              >
                {deployMutation.isPending ? "Deploying..." : "Deploy Exam"}
                {!deployMutation.isPending && <Send className="w-4 h-4 ml-2" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}