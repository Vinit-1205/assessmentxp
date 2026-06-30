import { useState, useRef, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { entities } from '@/api/entities';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plus, List, AlignLeft, Code, X, ChevronDown, CheckCircle2, Upload, FileSpreadsheet, AlertTriangle, Loader2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from 'sonner';

// ── CSV PARSER ──────────────────────────────────────────────────────────────
// Expected CSV format (header row required):
//   question,option1,option2,option3,option4,correct_answer,marks
//   "What is 2+2?","1","2","3","4","4","2"
//
// correct_answer = the text of the correct option OR 1-based index (1/2/3/4)
// marks is optional (defaults to 2)
function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row.');

  // Naive CSV parser that handles quoted fields
  const parseRow = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const header = parseRow(lines[0]).map(h => h.toLowerCase().replace(/[\s_-]+/g, '_'));
  const qi = header.findIndex(h => h.includes('question') || h === 'q');
  const o1i = header.findIndex(h => h.includes('option') && (h.includes('1') || h.includes('a')));
  const o2i = header.findIndex(h => h.includes('option') && (h.includes('2') || h.includes('b')));
  const o3i = header.findIndex(h => h.includes('option') && (h.includes('3') || h.includes('c')));
  const o4i = header.findIndex(h => h.includes('option') && (h.includes('4') || h.includes('d')));
  const cai = header.findIndex(h => h.includes('correct') || h.includes('answer'));
  const mi  = header.findIndex(h => h.includes('mark') || h.includes('point'));

  if (qi === -1 || o1i === -1 || cai === -1)
    throw new Error('CSV must have columns: question, option1, option2, option3, option4, correct_answer');

  const questions = [];
  for (let r = 1; r < lines.length; r++) {
    const row = parseRow(lines[r]);
    if (!row[qi]) continue; // skip blank rows

    const options = [row[o1i] || '', row[o2i] || '', row[o3i] || '', row[o4i] || ''].filter(Boolean);
    const correctRaw = (row[cai] || '').trim();
    // Try as 1-based index first, then match text
    let correctIdx = parseInt(correctRaw, 10) - 1;
    if (isNaN(correctIdx) || correctIdx < 0 || correctIdx >= options.length) {
      correctIdx = options.findIndex(o => o.toLowerCase() === correctRaw.toLowerCase());
    }
    if (correctIdx < 0) correctIdx = 0; // fallback to first

    questions.push({
      text: row[qi],
      options,
      correct_option_index: correctIdx,
      marks_awarded: mi !== -1 && row[mi] ? Number(row[mi]) : 2,
      type: 'MCQ',
    });
  }
  if (questions.length === 0) throw new Error('No valid questions found in the CSV.');
  return questions;
}

// ── DEBOUNCE HOOK ────────────────────────────────────────────────────────────
function useDebounce(fn, delay = 700) {
  const timer = useRef(null);
  return useCallback((...args) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]);
}

// ── COMPONENT ────────────────────────────────────────────────────────────────
export default function QuestionsTab({ exam, questions }) {
  const queryClient = useQueryClient();
  const [selectedQuestionId, setSelectedQuestionId] = useState(questions[0]?.id || null);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvPreview, setCsvPreview] = useState([]);   // parsed rows before import
  const [csvError, setCsvError] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const csvInputRef = useRef(null);

  // Local editor state — changes here don't hit the DB until debounce fires
  const selectedQuestion = questions.find(q => q.id === selectedQuestionId);
  const [localText, setLocalText] = useState('');
  const [localOptions, setLocalOptions] = useState([]);
  const [localExplanation, setLocalExplanation] = useState('');
  const [editingId, setEditingId] = useState(null);

  const seedLocal = (q) => {
    if (!q || q.id === editingId) return;
    setEditingId(q.id);
    setLocalText(q.text || '');
    setLocalOptions(q.options ? [...q.options] : []);
    setLocalExplanation(q.explanation || '');
  };
  if (selectedQuestion && selectedQuestion.id !== editingId) seedLocal(selectedQuestion);

  // ── Mutations ──
  const createQuestionMutation = useMutation({
    mutationFn: (type) => entities.Question.create({
      exam_id: exam.id,
      institution_id: exam.institution_id,
      type,
      text: 'New Question',
      marks_awarded: 2,
      options: type === 'MCQ' ? ['Option A', 'Option B', 'Option C', 'Option D'] : [],
      correct_option_index: type === 'MCQ' ? 0 : null,
      section: 'Section A',
    }),
    onSuccess: (newQ) => {
      queryClient.invalidateQueries({ queryKey: ['questions', exam.id] });
      setSelectedQuestionId(newQ.id);
      setEditingId(null); // force re-seed
    },
  });

  const updateQuestionMutation = useMutation({
    mutationFn: ({ id, data }) => entities.Question.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['questions', exam.id] }),
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: (id) => entities.Question.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions', exam.id] });
      setSelectedQuestionId(null);
      setEditingId(null);
    },
  });

  // ── Debounced field updaters ──
  const debouncedUpdate = (field, value) => {
    if (!selectedQuestion) return;
    updateQuestionMutation.mutate({ id: selectedQuestion.id, data: { [field]: value } });
  };

  const debouncedText = useDebounce(
    useCallback((val) => debouncedUpdate('text', val), [selectedQuestion?.id]),
    700
  );
  const debouncedOptions = useDebounce(
    useCallback((val) => debouncedUpdate('options', val), [selectedQuestion?.id]),
    700
  );
  const debouncedExplanation = useDebounce(
    useCallback((val) => debouncedUpdate('explanation', val), [selectedQuestion?.id]),
    700
  );

  // Immediate update (no debounce) for things like radio / switch / number
  const immediateUpdate = (field, value) => {
    if (!selectedQuestion) return;
    updateQuestionMutation.mutate({ id: selectedQuestion.id, data: { [field]: value } });
  };

  // ── CSV Handlers ──
  const handleCsvFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCsvError('');
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = parseCSV(ev.target.result);
        setCsvPreview(parsed);
        setIsCsvModalOpen(true);
      } catch (err) {
        setCsvError(err.message);
        setIsCsvModalOpen(true);
      }
    };
    reader.readAsText(file);
    // reset so same file can be re-selected
    e.target.value = '';
  };

  const handleImportCSV = async () => {
    if (!csvPreview.length) return;
    setIsImporting(true);
    try {
      for (const q of csvPreview) {
        await entities.Question.create({
          exam_id: exam.id,
          institution_id: exam.institution_id,
          section: 'Section A',
          is_required: true,
          ...q,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['questions', exam.id] });
      toast.success(`${csvPreview.length} questions imported successfully!`);
      setIsCsvModalOpen(false);
      setCsvPreview([]);
    } catch (err) {
      toast.error('Import failed: ' + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  const mcqCount   = questions.filter(q => q.type === 'MCQ').length;
  const shortCount = questions.filter(q => q.type === 'Short Answer').length;
  const codeCount  = questions.filter(q => q.type === 'Coding Problem').length;
  const letters    = ['A', 'B', 'C', 'D', 'E', 'F'];

  return (
    <div className="flex h-full">

      {/* ── Left Pane: Question List ── */}
      <div className="w-80 bg-white border-r flex flex-col">
        <div className="p-4 border-b space-y-3">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-semibold text-slate-800">Questions</h3>
              <p className="text-xs text-slate-500">{questions.length} questions • {questions.reduce((s, q) => s + (q.marks_awarded || 0), 0)} pts</p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-4 gap-1.5 h-8">
                  <Plus className="w-4 h-4" /> Add
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={() => createQuestionMutation.mutate('MCQ')} className="gap-2 cursor-pointer">
                  <List className="w-4 h-4 text-slate-500" /> Multiple Choice
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => createQuestionMutation.mutate('Short Answer')} className="gap-2 cursor-pointer">
                  <AlignLeft className="w-4 h-4 text-slate-500" /> Short Answer
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => createQuestionMutation.mutate('Coding Problem')} className="gap-2 cursor-pointer">
                  <Code className="w-4 h-4 text-slate-500" /> Coding Problem
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => csvInputRef.current?.click()}
                  className="gap-2 cursor-pointer border-t mt-1 pt-2 text-blue-600"
                >
                  <FileSpreadsheet className="w-4 h-4" /> Import from CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* CSV upload helper button */}
          <button
            onClick={() => csvInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 border border-dashed border-blue-300 rounded-lg py-2 text-xs text-blue-600 hover:bg-blue-50 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" /> Upload CSV file
          </button>
          <input ref={csvInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleCsvFile} />
        </div>

        {/* Question list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between items-center px-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Section A</span>
              <span className="text-[10px] font-medium text-slate-400">
                {questions.reduce((s, q) => q.section === 'Section A' ? s + (q.marks_awarded || 0) : s, 0)} pts
              </span>
            </div>

            {questions.length === 0 && (
              <div className="text-center py-8 text-slate-400">
                <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-sm">No questions yet.</p>
                <p className="text-xs mt-1">Use Add or upload a CSV.</p>
              </div>
            )}

            {questions.map((q, idx) => {
              const isSelected = selectedQuestionId === q.id;
              return (
                <div
                  key={q.id}
                  onClick={() => { setSelectedQuestionId(q.id); setEditingId(null); }}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50/50 shadow-sm ring-1 ring-blue-500/20'
                      : 'border-slate-200 bg-white hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 ${
                      isSelected ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                    }`}>{idx + 1}</div>
                    <div className="flex-1 overflow-hidden">
                      <div className="flex justify-between items-center mb-1">
                        <span className={`text-[10px] font-bold uppercase ${isSelected ? 'text-blue-600' : 'text-slate-400'}`}>
                          {q.type === 'MCQ' ? 'MCQ' : q.type === 'Short Answer' ? 'Short' : 'Code'}
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

        {/* Stats footer */}
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

      {/* ── Right Pane: Question Editor ── */}
      <div className="flex-1 overflow-y-auto bg-slate-50 p-8">
        {selectedQuestion ? (
          <div className="max-w-3xl mx-auto space-y-8">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-sm font-medium text-blue-600 mb-1">
                  Question {questions.findIndex(q => q.id === selectedQuestion.id) + 1}
                </div>
                <h2 className="text-xl font-semibold text-slate-800">{selectedQuestion.type} — {selectedQuestion.section}</h2>
              </div>
              <Button variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => deleteQuestionMutation.mutate(selectedQuestion.id)}>
                Delete Question
              </Button>
            </div>

            {/* Meta fields */}
            <div className="grid grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label className="text-slate-600 text-xs font-bold uppercase tracking-wider">Section</Label>
                <div className="relative">
                  <select
                    value={selectedQuestion.section}
                    onChange={e => immediateUpdate('section', e.target.value)}
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
                <Label className="text-slate-600 text-xs font-bold uppercase tracking-wider">Points</Label>
                <Input
                  type="number"
                  value={selectedQuestion.marks_awarded}
                  onChange={e => immediateUpdate('marks_awarded', Number(e.target.value))}
                  className="bg-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-600 text-xs font-bold uppercase tracking-wider">Time Limit <span className="text-slate-400 font-normal normal-case">(min, optional)</span></Label>
                <Input
                  type="number"
                  placeholder="No limit"
                  value={selectedQuestion.time_limit || ''}
                  onChange={e => immediateUpdate('time_limit', e.target.value ? Number(e.target.value) : null)}
                  className="bg-white"
                />
              </div>
            </div>

            {/* Question text */}
            <div className="space-y-2">
              <Label className="text-slate-800 text-sm font-bold">Question Text <span className="text-red-500">*</span></Label>
              <p className="text-xs text-slate-500 mb-2">Write the full question as students will see it.</p>
              <Textarea
                value={localText}
                onChange={e => {
                  setLocalText(e.target.value);
                  debouncedText(e.target.value);
                }}
                className="min-h-[120px] bg-white text-base leading-relaxed p-4"
              />
              <div className="text-right text-[10px] text-slate-400">{localText.length} chars</div>
            </div>

            {/* MCQ Options */}
            {selectedQuestion.type === 'MCQ' && (
              <div className="space-y-3">
                <Label className="text-slate-800 text-sm font-bold block mb-4">
                  Answer Options <span className="text-xs text-slate-400 font-normal ml-2">(click the circle to mark the correct answer)</span>
                </Label>
                {localOptions.map((opt, idx) => {
                  const isCorrect = selectedQuestion.correct_option_index === idx;
                  return (
                    <div key={idx} className={`flex items-center gap-4 p-2 rounded-xl border-2 transition-all ${isCorrect ? 'border-green-500 bg-green-50/30' : 'border-transparent hover:border-slate-200'}`}>
                      <button onClick={() => immediateUpdate('correct_option_index', idx)} className="flex-shrink-0">
                        {isCorrect
                          ? <CheckCircle2 className="w-6 h-6 text-green-500" />
                          : <div className="w-6 h-6 rounded-full border-2 border-slate-300 hover:border-green-400" />}
                      </button>
                      <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 flex-shrink-0">
                        {letters[idx]}
                      </div>
                      <Input
                        value={opt}
                        onChange={e => {
                          const next = [...localOptions];
                          next[idx] = e.target.value;
                          setLocalOptions(next);
                          debouncedOptions(next);
                        }}
                        className={`bg-white border-slate-200 shadow-sm ${isCorrect ? 'ring-1 ring-green-500/50' : ''}`}
                      />
                      <Button variant="ghost" size="icon" className="text-slate-400 hover:text-red-500" onClick={() => {
                        const next = localOptions.filter((_, i) => i !== idx);
                        setLocalOptions(next);
                        immediateUpdate('options', next);
                        if (isCorrect) immediateUpdate('correct_option_index', 0);
                      }}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  );
                })}
                <Button variant="outline" className="w-full mt-4 border-dashed text-slate-500" onClick={() => {
                  const next = [...localOptions, 'New Option'];
                  setLocalOptions(next);
                  immediateUpdate('options', next);
                }}>
                  <Plus className="w-4 h-4 mr-2" /> Add option
                </Button>
              </div>
            )}

            {/* Explanation */}
            <div className="space-y-2 pt-6 border-t">
              <Label className="text-slate-800 text-sm font-bold block mb-2">
                Answer Explanation <span className="text-xs text-slate-400 font-normal ml-2">(optional, shown after submission)</span>
              </Label>
              <Textarea
                value={localExplanation}
                onChange={e => {
                  setLocalExplanation(e.target.value);
                  debouncedExplanation(e.target.value);
                }}
                className="bg-white text-sm p-4"
              />
            </div>

            {/* Required toggle */}
            <div className="flex items-center justify-between pt-6 border-t">
              <div>
                <Label className="text-slate-800 text-sm font-bold block">Required Question</Label>
                <p className="text-xs text-slate-500">Students cannot submit without answering this</p>
              </div>
              <Switch
                checked={selectedQuestion.is_required !== false}
                onCheckedChange={c => immediateUpdate('is_required', c)}
              />
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center text-slate-400">
              <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p className="font-medium">No question selected</p>
              <p className="text-sm mt-1">Select a question from the list, or add a new one.</p>
            </div>
          </div>
        )}
      </div>

      {/* ── CSV Preview / Import Modal ── */}
      <Dialog open={isCsvModalOpen} onOpenChange={setIsCsvModalOpen}>
        <DialogContent className="sm:max-w-[760px] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-blue-600" />
              Import Questions from CSV
            </DialogTitle>
            <DialogDescription>
              Expected columns: <code className="bg-slate-100 px-1 rounded text-xs">question, option1, option2, option3, option4, correct_answer, marks</code>
            </DialogDescription>
          </DialogHeader>

          {csvError ? (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-1">Could not parse CSV</p>
                <p>{csvError}</p>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-600 font-medium">{csvPreview.length} questions ready to import:</p>
              <div className="flex-1 overflow-y-auto space-y-2 max-h-[50vh] pr-1">
                {csvPreview.map((q, i) => (
                  <div key={i} className="border rounded-lg p-3 text-sm">
                    <div className="font-medium text-slate-800 mb-1">{i + 1}. {q.text}</div>
                    <div className="grid grid-cols-2 gap-1">
                      {q.options.map((opt, oi) => (
                        <div key={oi} className={`text-xs px-2 py-1 rounded ${oi === q.correct_option_index ? 'bg-green-100 text-green-700 font-semibold' : 'bg-slate-100 text-slate-600'}`}>
                          {letters[oi]}. {opt} {oi === q.correct_option_index && '✓'}
                        </div>
                      ))}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">{q.marks_awarded} pts</div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => { setIsCsvModalOpen(false); setCsvPreview([]); }}>Cancel</Button>
                <Button
                  className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
                  onClick={handleImportCSV}
                  disabled={isImporting}
                >
                  {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Import {csvPreview.length} Questions
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}