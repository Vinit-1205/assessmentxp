import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTenantContext } from '@/hooks/useTenantContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Upload, Loader2, BookOpen } from "lucide-react";
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function QuestionBank() {
  const queryClient = useQueryClient();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const { user, tenantId } = useTenantContext();

  const { data: questions, isLoading } = useQuery({
    queryKey: ['bankQuestions', tenantId],
    queryFn: () => base44.entities.BankQuestion.filter({ institution_id: tenantId }, '-created_date'),
    enabled: !!tenantId,
  });

  const [newQuestion, setNewQuestion] = useState({
    institution_id: tenantId || '',
    question_text: '',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    correct_option: 'A',
    subject_tag: '',
    difficulty_level: 'Medium',
    marks_awarded: 1
  });

  // Keep institution_id in sync if tenantId changes after initial load
  React.useEffect(() => {
    if (tenantId) {
      setNewQuestion(prev => ({ ...prev, institution_id: tenantId }));
    }
  }, [tenantId]);

  const createMutation = useMutation({
    mutationFn: (qData) => base44.entities.BankQuestion.create(qData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bankQuestions'] });
      setIsAddModalOpen(false);
      setNewQuestion({
        institution_id: tenantId || '',
        question_text: '', option_a: '', option_b: '', option_c: '', option_d: '',
        correct_option: 'A', subject_tag: '', difficulty_level: 'Medium', marks_awarded: 1
      });
      toast.success('Question added successfully');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to save question');
      console.error(err);
    }
  });

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!newQuestion.question_text || !newQuestion.option_a || !newQuestion.option_b) {
      return toast.error("Please fill in the required fields");
    }
    createMutation.mutate({ ...newQuestion, institution_id: newQuestion.institution_id || tenantId });
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const rows = text.split('\n').filter(row => row.trim() !== '');
        const dataRows = rows.slice(1); // skip header row assuming first row is header
        
        const newQuestions = dataRows.map(row => {
          const cols = row.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
          return {
            institution_id: tenantId,
            question_text: cols[0],
            option_a: cols[1],
            option_b: cols[2],
            option_c: cols[3],
            option_d: cols[4],
            correct_option: cols[5] || 'A',
            subject_tag: cols[6] || '',
            difficulty_level: cols[7] || 'Medium',
            marks_awarded: Number(cols[8]) || 1
          };
        }).filter(q => q.question_text);

        if (newQuestions.length > 0) {
            await base44.entities.BankQuestion.bulkCreate(newQuestions);
            queryClient.invalidateQueries({ queryKey: ['bankQuestions'] });
            toast.success(`Successfully imported ${newQuestions.length} questions`);
        } else {
            toast.error("No valid questions found in the CSV");
        }
      } catch (err) {
        toast.error("Failed to parse CSV. Ensure it follows the correct format.");
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input so the same file can be uploaded again if needed
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-primary" />
            Question Bank
          </h1>
          <p className="text-muted-foreground mt-1">Manage and organize your repository of questions.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <input 
              type="file" 
              accept=".csv"
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={isUploading}
            />
            <Button variant="outline" className="gap-2" disabled={isUploading}>
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Bulk Import CSV
            </Button>
          </div>
          
          <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 gap-2">
                <Plus className="w-4 h-4" /> Add Question
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Question</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddSubmit} className="space-y-4 pt-4">
                <input type="hidden" name="institution_id" value={newQuestion.institution_id} />
                <div className="space-y-2">
                  <Label>Question Text</Label>
                  <Input required value={newQuestion.question_text} onChange={e => setNewQuestion({...newQuestion, question_text: e.target.value})} placeholder="Enter the question..." />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Option A</Label>
                    <Input required value={newQuestion.option_a} onChange={e => setNewQuestion({...newQuestion, option_a: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Option B</Label>
                    <Input required value={newQuestion.option_b} onChange={e => setNewQuestion({...newQuestion, option_b: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Option C</Label>
                    <Input required value={newQuestion.option_c} onChange={e => setNewQuestion({...newQuestion, option_c: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Option D</Label>
                    <Input required value={newQuestion.option_d} onChange={e => setNewQuestion({...newQuestion, option_d: e.target.value})} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Correct Option</Label>
                    <Select value={newQuestion.correct_option} onValueChange={v => setNewQuestion({...newQuestion, correct_option: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A">A</SelectItem>
                        <SelectItem value="B">B</SelectItem>
                        <SelectItem value="C">C</SelectItem>
                        <SelectItem value="D">D</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Difficulty Level</Label>
                    <Select value={newQuestion.difficulty_level} onValueChange={v => setNewQuestion({...newQuestion, difficulty_level: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Easy">Easy</SelectItem>
                        <SelectItem value="Medium">Medium</SelectItem>
                        <SelectItem value="Hard">Hard</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Subject Tag</Label>
                    <Input value={newQuestion.subject_tag} onChange={e => setNewQuestion({...newQuestion, subject_tag: e.target.value})} placeholder="e.g. Mathematics" />
                  </div>
                  <div className="space-y-2">
                    <Label>Marks Awarded</Label>
                    <Input type="number" min="1" value={newQuestion.marks_awarded} onChange={e => setNewQuestion({...newQuestion, marks_awarded: Number(e.target.value)})} />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Save Question
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Question</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Difficulty</TableHead>
                <TableHead className="text-right">Marks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                  </TableCell>
                </TableRow>
              ) : questions?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    No questions in the bank yet. Add manually or import via CSV.
                  </TableCell>
                </TableRow>
              ) : (
                questions?.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-medium max-w-md truncate">{q.question_text}</TableCell>
                    <TableCell>
                      {q.subject_tag ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-secondary text-secondary-foreground">
                          {q.subject_tag}
                        </span>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        q.difficulty_level === 'Easy' ? 'bg-green-100 text-green-800' :
                        q.difficulty_level === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {q.difficulty_level}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{q.marks_awarded}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}