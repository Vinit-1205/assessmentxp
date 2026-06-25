import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plus, List, AlignLeft, Code, X, ChevronDown, CheckCircle2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function QuestionsTab({ exam, questions }) {
  const queryClient = useQueryClient();
  const [selectedQuestionId, setSelectedQuestionId] = useState(questions[0]?.id || null);

  const createQuestionMutation = useMutation({
    mutationFn: (type) => base44.entities.Question.create({
      exam_id: exam.id,
      institution_id: exam.institution_id,
      type: type,
      text: 'New Question',
      marks_awarded: 2,
      options: type === 'MCQ' ? ['Option A', 'Option B', 'Option C', 'Option D'] : [],
      correct_option_index: type === 'MCQ' ? 0 : null,
      section: 'Section A'
    }),
    onSuccess: (newQ) => {
      queryClient.invalidateQueries({ queryKey: ['questions', exam.id] });
      setSelectedQuestionId(newQ.id);
    }
  });

  const updateQuestionMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Question.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions', exam.id] });
    }
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: (id) => base44.entities.Question.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions', exam.id] });
      setSelectedQuestionId(null);
    }
  });

  const selectedQuestion = questions.find(q => q.id === selectedQuestionId);

  const handleUpdate = (field, value) => {
    if (!selectedQuestion) return;
    updateQuestionMutation.mutate({ id: selectedQuestion.id, data: { [field]: value } });
  };

  const handleOptionUpdate = (idx, value) => {
    if (!selectedQuestion) return;
    const newOptions = [...selectedQuestion.options];
    newOptions[idx] = value;
    handleUpdate('options', newOptions);
  };

  const mcqCount = questions.filter(q => q.type === 'MCQ').length;
  const shortCount = questions.filter(q => q.type === 'Short Answer').length;
  const codeCount = questions.filter(q => q.type === 'Coding Problem').length;

  return (
    <div className="flex h-[calc(100vh-130px)]">
      {/* Left Pane: Question List */}
      <div className="w-80 bg-white border-r flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <div>
            <h3 className="font-semibold text-slate-800">Questions</h3>
            <p className="text-xs text-slate-500">{questions.length} questions • {questions.reduce((sum, q) => sum + (q.marks_awarded||0), 0)} pts</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-4 gap-1.5 h-8">
                <Plus className="w-4 h-4" /> Add
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => createQuestionMutation.mutate('MCQ')} className="gap-2 cursor-pointer">
                <List className="w-4 h-4 text-slate-500" /> Multiple Choice
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => createQuestionMutation.mutate('Short Answer')} className="gap-2 cursor-pointer">
                <AlignLeft className="w-4 h-4 text-slate-500" /> Short Answer
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => createQuestionMutation.mutate('Coding Problem')} className="gap-2 cursor-pointer">
                <Code className="w-4 h-4 text-slate-500" /> Coding Problem
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Mocking Section grouping for now */}
          <div className="space-y-2">
            <div className="flex justify-between items-center px-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Section A</span>
              <span className="text-[10px] font-medium text-slate-400">
                {questions.reduce((sum, q) => q.section === 'Section A' ? sum + (q.marks_awarded||0) : sum, 0)} pts
              </span>
            </div>
            
            {questions.map((q, idx) => {
              const isSelected = selectedQuestionId === q.id;
              return (
                <div 
                  key={q.id}
                  onClick={() => setSelectedQuestionId(q.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    isSelected 
                      ? 'border-blue-500 bg-blue-50/50 shadow-sm ring-1 ring-blue-500/20' 
                      : 'border-slate-200 bg-white hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                      isSelected ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className="flex justify-between items-center mb-1">
                        <span className={`text-[10px] font-bold uppercase ${isSelected ? 'text-blue-600' : 'text-slate-400'}`}>
                          {q.type === 'Multiple Choice' ? 'MCQ' : q.type === 'Short Answer' ? 'Short' : q.type === 'Coding Problem' ? 'Code' : 'MCQ'}
                        </span>
                        <span className="text-[10px] text-slate-400">{q.marks_awarded}pts</span>
                      </div>
                      <p className={`text-sm line-clamp-2 leading-snug ${isSelected ? 'text-blue-900 font-medium' : 'text-slate-600'}`}>
                        {q.text}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-t p-4 bg-slate-50 grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-lg font-semibold text-slate-800">{mcqCount}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">MCQ</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-slate-800">{shortCount}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Short</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-slate-800">{codeCount}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Code</div>
          </div>
        </div>
      </div>

      {/* Right Pane: Question Editor */}
      <div className="flex-1 overflow-y-auto bg-slate-50 p-8">
        {selectedQuestion ? (
          <div className="max-w-3xl mx-auto space-y-8">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-sm font-medium text-blue-600 mb-1">Question {questions.findIndex(q => q.id === selectedQuestion.id) + 1}</div>
                <h2 className="text-xl font-semibold text-slate-800">{selectedQuestion.type} - {selectedQuestion.section}</h2>
              </div>
              <Button variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => deleteQuestionMutation.mutate(selectedQuestion.id)}>
                Delete Question
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label className="text-slate-600 text-xs font-bold uppercase tracking-wider">Section</Label>
                <div className="relative">
                  <select 
                    value={selectedQuestion.section}
                    onChange={e => handleUpdate('section', e.target.value)}
                    className="w-full h-10 px-3 py-2 rounded-md border border-input bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent appearance-none"
                  >
                    <option value="Section A">Section A</option>
                    <option value="Section B">Section B</option>
                    <option value="Section C">Section C</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-600 text-xs font-bold uppercase tracking-wider">Points (per question)</Label>
                <Input 
                  type="number" 
                  value={selectedQuestion.marks_awarded} 
                  onChange={e => handleUpdate('marks_awarded', Number(e.target.value))}
                  className="bg-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-600 text-xs font-bold uppercase tracking-wider">Time Limit <span className="text-slate-400 font-normal normal-case">(minutes, optional)</span></Label>
                <Input 
                  type="number" 
                  placeholder="No limit"
                  value={selectedQuestion.time_limit || ''} 
                  onChange={e => handleUpdate('time_limit', e.target.value ? Number(e.target.value) : null)}
                  className="bg-white"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-800 text-sm font-bold">Question Text <span className="text-red-500">*</span></Label>
              <p className="text-xs text-slate-500 mb-2">Write the full question as students will see it. Markdown is supported.</p>
              <Textarea 
                value={selectedQuestion.text} 
                onChange={e => handleUpdate('text', e.target.value)}
                className="min-h-[120px] bg-white text-base leading-relaxed p-4"
              />
              <div className="text-right text-[10px] text-slate-400">{selectedQuestion.text.length} chars</div>
            </div>

            {selectedQuestion.type === 'MCQ' && (
              <div className="space-y-3">
                <Label className="text-slate-800 text-sm font-bold block mb-4">Answer Options <span className="text-xs text-slate-400 font-normal ml-2">(click radio to set correct answer)</span></Label>
                
                {selectedQuestion.options.map((opt, idx) => {
                  const isCorrect = selectedQuestion.correct_option_index === idx;
                  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
                  return (
                    <div key={idx} className={`flex items-center gap-4 p-2 rounded-xl border-2 transition-all ${isCorrect ? 'border-green-500 bg-green-50/30' : 'border-transparent hover:border-slate-200'}`}>
                      <button 
                        onClick={() => handleUpdate('correct_option_index', idx)}
                        className="flex-shrink-0"
                      >
                        {isCorrect ? (
                          <CheckCircle2 className="w-6 h-6 text-green-500" />
                        ) : (
                          <div className="w-6 h-6 rounded-full border-2 border-slate-300 hover:border-green-400"></div>
                        )}
                      </button>
                      <div className={`w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 flex-shrink-0`}>
                        {letters[idx]}
                      </div>
                      <Input 
                        value={opt} 
                        onChange={e => handleOptionUpdate(idx, e.target.value)}
                        className={`bg-white border-slate-200 shadow-sm ${isCorrect ? 'ring-1 ring-green-500/50' : ''}`}
                      />
                      <Button variant="ghost" size="icon" className="text-slate-400 hover:text-red-500" onClick={() => {
                        const newOpts = selectedQuestion.options.filter((_, i) => i !== idx);
                        handleUpdate('options', newOpts);
                        if (isCorrect) handleUpdate('correct_option_index', 0);
                      }}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  );
                })}
                <Button variant="outline" className="w-full mt-4 border-dashed text-slate-500" onClick={() => {
                  handleUpdate('options', [...selectedQuestion.options, 'New Option']);
                }}>
                  <Plus className="w-4 h-4 mr-2" /> Add option
                </Button>
              </div>
            )}

            <div className="space-y-2 pt-6 border-t">
              <Label className="text-slate-800 text-sm font-bold block mb-2">Answer Explanation <span className="text-xs text-slate-400 font-normal ml-2">(shown to students after submission)</span></Label>
              <Textarea 
                value={selectedQuestion.explanation || ''} 
                onChange={e => handleUpdate('explanation', e.target.value)}
                className="bg-white text-sm p-4"
              />
            </div>

            <div className="flex items-center justify-between pt-6 border-t">
              <div>
                <Label className="text-slate-800 text-sm font-bold block">Required Question</Label>
                <p className="text-xs text-slate-500">Students cannot submit without answering this question</p>
              </div>
              <Switch 
                checked={selectedQuestion.is_required !== false} 
                onCheckedChange={c => handleUpdate('is_required', c)}
              />
            </div>

          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-slate-400">
            Select or create a question to edit
          </div>
        )}
      </div>
    </div>
  );
}