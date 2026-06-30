import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entities } from '@/api/entities';
import { useTenantContext } from '@/hooks/useTenantContext';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Upload, Loader2, BookOpen, Pencil, Trash2 } from "lucide-react";
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const EMPTY_QUESTION = (tenantId = '') => ({
  institution_id: tenantId,
  question_text: '',
  option_a: '',
  option_b: '',
  option_c: '',
  option_d: '',
  correct_option: 'A',
  subject_tag: '',
  difficulty_level: 'Medium',
  marks_awarded: 1,
});

function QuestionForm({ value, onChange, onSubmit, onCancel, isPending, submitLabel = 'Save Question' }) {
  return (
    <form onSubmit={onSubmit} className="space-y-4 pt-4">
      <div className="space-y-2">
        <Label>Question Text</Label>
        <Input required value={value.question_text} onChange={e => onChange({ ...value, question_text: e.target.value })} placeholder="Enter the question..." />
      </div>
      <div className="grid grid-cols-2 gap-4">
        {['a', 'b', 'c', 'd'].map(opt => (
          <div key={opt} className="space-y-2">
            <Label>Option {opt.toUpperCase()}</Label>
            <Input
              required={opt === 'a' || opt === 'b'}
              value={value[`option_${opt}`]}
              onChange={e => onChange({ ...value, [`option_${opt}`]: e.target.value })}
            />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Correct Option</Label>
          <Select value={value.correct_option} onValueChange={v => onChange({ ...value, correct_option: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {['A', 'B', 'C', 'D'].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Difficulty</Label>
          <Select value={value.difficulty_level} onValueChange={v => onChange({ ...value, difficulty_level: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {['Easy', 'Medium', 'Hard'].map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Subject Tag</Label>
          <Input value={value.subject_tag} onChange={e => onChange({ ...value, subject_tag: e.target.value })} placeholder="e.g. Mathematics" />
        </div>
        <div className="space-y-2">
          <Label>Marks</Label>
          <Input type="number" min="1" value={value.marks_awarded} onChange={e => onChange({ ...value, marks_awarded: Number(e.target.value) })} />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

export default function QuestionBank() {
  const queryClient = useQueryClient();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [editQuestion, setEditQuestion] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [deleteQuestion, setDeleteQuestion] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const { tenantId } = useTenantContext();

  const { data: questions, isLoading } = useQuery({
    queryKey: ['bankQuestions', tenantId],
    queryFn: () => entities.BankQuestion.filter({ institution_id: tenantId }, '-created_date'),
    enabled: !!tenantId,
  });

  const [newQuestion, setNewQuestion] = useState(EMPTY_QUESTION(tenantId));

  React.useEffect(() => {
    if (tenantId) setNewQuestion(prev => ({ ...prev, institution_id: tenantId }));
  }, [tenantId]);

  const createMutation = useMutation({
    mutationFn: (data) => entities.BankQuestion.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bankQuestions'] });
      setIsAddModalOpen(false);
      setNewQuestion(EMPTY_QUESTION(tenantId));
      toast.success('Question added successfully');
    },
    onError: (err) => toast.error(err.message || 'Failed to save question'),
  });

  const editMutation = useMutation({
    mutationFn: (data) => entities.BankQuestion.update(editQuestion.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bankQuestions'] });
      setIsEditModalOpen(false);
      setEditQuestion(null);
      toast.success('Question updated');
    },
    onError: (err) => toast.error(err.message || 'Failed to update question'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => entities.BankQuestion.delete(deleteQuestion.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bankQuestions'] });
      setIsDeleteModalOpen(false);
      setDeleteQuestion(null);
      toast.success('Question deleted');
    },
    onError: (err) => toast.error(err.message || 'Failed to delete question'),
  });

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!newQuestion.question_text || !newQuestion.option_a || !newQuestion.option_b) {
      return toast.error("Please fill in the required fields");
    }
    createMutation.mutate({ ...newQuestion, institution_id: newQuestion.institution_id || tenantId });
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (!editQuestion.question_text || !editQuestion.option_a || !editQuestion.option_b) {
      return toast.error("Please fill in the required fields");
    }
    editMutation.mutate(editQuestion);
  };

  const handleEditOpen = (q) => {
    setEditQuestion({ ...q });
    setIsEditModalOpen(true);
  };

  const handleDeleteOpen = (q) => {
    setDeleteQuestion(q);
    setIsDeleteModalOpen(true);
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
        const dataRows = rows.slice(1);
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
            marks_awarded: Number(cols[8]) || 1,
          };
        }).filter(q => q.question_text);

        if (newQuestions.length > 0) {
          await entities.BankQuestion.bulkCreate(newQuestions);
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
    e.target.value = '';
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
            <input type="file" accept=".csv" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={isUploading} />
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
              <DialogHeader><DialogTitle>Add New Question</DialogTitle></DialogHeader>
              <QuestionForm
                value={newQuestion}
                onChange={setNewQuestion}
                onSubmit={handleAddSubmit}
                onCancel={() => setIsAddModalOpen(false)}
                isPending={createMutation.isPending}
                submitLabel="Save Question"
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Question</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Difficulty</TableHead>
                <TableHead className="text-center">Marks</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                  </TableCell>
                </TableRow>
              ) : questions?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No questions in the bank yet. Add manually or import via CSV.
                  </TableCell>
                </TableRow>
              ) : (
                questions?.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-medium max-w-sm truncate">{q.question_text}</TableCell>
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
                    <TableCell className="text-center">{q.marks_awarded}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => handleEditOpen(q)}>
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 gap-1 text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleDeleteOpen(q)}>
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Question</DialogTitle></DialogHeader>
          {editQuestion && (
            <QuestionForm
              value={editQuestion}
              onChange={setEditQuestion}
              onSubmit={handleEditSubmit}
              onCancel={() => setIsEditModalOpen(false)}
              isPending={editMutation.isPending}
              submitLabel="Update Question"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Question</DialogTitle></DialogHeader>
          <div className="pt-2 space-y-4">
            <p className="text-muted-foreground">
              Are you sure you want to delete this question? This cannot be undone.
            </p>
            {deleteQuestion && (
              <p className="text-sm font-medium text-foreground bg-muted px-3 py-2 rounded-md line-clamp-2">
                "{deleteQuestion.question_text}"
              </p>
            )}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Delete Question
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}