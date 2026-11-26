import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  ClipboardCheck,
  Flag,
  RotateCcw,
  Sparkles,
  Trophy,
  X,
  XCircle,
} from 'lucide-react';
import type { MindMapDocument, MindNode } from '../types/mindmap';
import { useI18n } from '../core/i18n/i18n';
import { StudyTracker } from '../core/study/StudyTracker';
import { hapticLight, hapticMedium, hapticSuccess } from '../core/native/NativeBridge';

interface MapQuizModalProps {
  isOpen: boolean;
  doc: MindMapDocument;
  onClose: () => void;
  onMarkNodesForReview?: (nodeIds: string[]) => void;
  onQuizComplete?: () => void;
}

interface QuizQuestion {
  id: string;
  targetNodeId: string;
  promptLabel: string;
  questionText: string;
  stickerUrl?: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function maskAnswerInText(text: string, answer: string): string {
  const cleanAns = answer.trim();
  if (cleanAns.length < 3) return text;
  const escaped = cleanAns.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(escaped, 'gi'), '____');
}

function buildQuestionsFromMindMap(
  doc: MindMapDocument,
  t: (tr: string, en: string) => string
): QuizQuestion[] {
  const allNodes = Object.values(doc.nodes);
  const nonRoot = allNodes.filter((n) => n.id !== doc.rootNodeId && n.title.trim().length > 0);
  if (nonRoot.length < 2) return [];

  const allTitles = Array.from(new Set(nonRoot.map((n) => n.title.trim())));
  const childrenByParent = new Map<string, MindNode[]>();
  for (const n of nonRoot) {
    if (n.parentId) {
      const list = childrenByParent.get(n.parentId) ?? [];
      list.push(n);
      childrenByParent.set(n.parentId, list);
    }
  }

  const pickDistractors = (correct: string, pool: string[], count = 3): string[] => {
    const normCorrect = correct.toLocaleLowerCase('tr-TR');
    const cands = shuffleArray(
      pool.filter((p) => p.trim() && p.toLocaleLowerCase('tr-TR') !== normCorrect)
    );
    return cands.slice(0, count);
  };

  const questions: QuizQuestion[] = [];
  const usedNodeIds = new Set<string>();

  // Prioritize exam & important nodes first
  const sortedNodes = [...nonRoot].sort((a, b) => {
    const rank = (n: MindNode) =>
      n.priorityTag === 'exam' ? 0 : n.priorityTag === 'important' ? 1 : n.priorityTag === 'review' ? 1 : 2;
    return rank(a) - rank(b);
  });

  // Type 1: Rich note / subtitle -> identify concept
  for (const n of sortedNodes) {
    if (questions.length >= 8) break;
    const rawDesc = (n.note || n.subtitle || '').trim();
    if (rawDesc.length < 14) continue;
    const firstSnippet = rawDesc.split('\n')[0].trim().slice(0, 170);
    const masked = maskAnswerInText(firstSnippet, n.title);
    const distractors = pickDistractors(n.title, allTitles, 3);
    if (distractors.length < 1) continue;

    questions.push({
      id: `q_note_${n.id}`,
      targetNodeId: n.id,
      promptLabel: t('Açıklamadan Kavramı Bul', 'Identify the Concept'),
      questionText: `"${masked}"`,
      options: shuffleArray([n.title, ...distractors]),
      correctAnswer: n.title,
      explanation: `${n.title}: ${firstSnippet}`,
    });
    usedNodeIds.add(n.id);
  }

  // Type 2: Tech badge / quantitative tag -> identify concept
  for (const n of sortedNodes) {
    if (questions.length >= 8) break;
    if (usedNodeIds.has(n.id) || !n.techBadge?.trim()) continue;
    const distractors = pickDistractors(n.title, allTitles, 3);
    if (distractors.length < 1) continue;

    questions.push({
      id: `q_badge_${n.id}`,
      targetNodeId: n.id,
      promptLabel: t('Değer / Rozet Eşleştirme', 'Match Badge / Value'),
      questionText: t(
        `"[${n.techBadge}]" etiketi aşağıdaki hangi kavrama aittir?`,
        `Which concept matches the tag "[${n.techBadge}]"?`
      ),
      options: shuffleArray([n.title, ...distractors]),
      correctAnswer: n.title,
      explanation: `${n.title} [${n.techBadge}]${n.note ? ` — ${n.note.split('\n')[0].slice(0, 110)}` : ''}`,
    });
    usedNodeIds.add(n.id);
  }

  // Type 3: Child node -> identify its parent branch (when >= 2 distinct parent branches exist)
  const mainBranches = nonRoot.filter((n) => n.parentId === doc.rootNodeId);
  const mainTitles = Array.from(new Set(mainBranches.map((m) => m.title.trim())));
  if (mainTitles.length >= 2) {
    for (const n of sortedNodes) {
      if (questions.length >= 8) break;
      if (usedNodeIds.has(n.id) || !n.parentId || n.parentId === doc.rootNodeId) continue;
      const parent = doc.nodes[n.parentId];
      if (!parent || !parent.title) continue;
      const distractors = pickDistractors(parent.title, mainTitles, 3);
      if (distractors.length < 1) continue;

      questions.push({
        id: `q_parent_${n.id}`,
        targetNodeId: n.id,
        promptLabel: t('Kavram Hiyerarşisi', 'Branch Hierarchy'),
        questionText: t(
          `"${n.title}" kavramı hangi ana başlığın altındadır?`,
          `Under which parent branch does "${n.title}" belong?`
        ),
        stickerUrl: n.sticker?.url,
        options: shuffleArray([parent.title, ...distractors]),
        correctAnswer: parent.title,
        explanation: `${parent.title} → ${n.title}`,
      });
      usedNodeIds.add(n.id);
    }
  }

  // Type 4: Parent with children -> identify which sub-branch belongs to it
  for (const parent of mainBranches) {
    if (questions.length >= 8) break;
    const kids = childrenByParent.get(parent.id) ?? [];
    if (kids.length === 0) continue;
    const kid = kids[0];
    if (usedNodeIds.has(kid.id)) continue;
    const kidSet = new Set(kids.map((k) => k.title.toLocaleLowerCase('tr-TR')));
    const outsidePool = allTitles.filter(
      (title) =>
        !kidSet.has(title.toLocaleLowerCase('tr-TR')) &&
        title.toLocaleLowerCase('tr-TR') !== parent.title.toLocaleLowerCase('tr-TR')
    );
    const distractors = pickDistractors(kid.title, outsidePool, 3);
    if (distractors.length < 1) continue;

    questions.push({
      id: `q_child_${kid.id}`,
      targetNodeId: kid.id,
      promptLabel: t('Alt Dal Eşleştirme', 'Sub-Branch Match'),
      questionText: t(
        `Aşağıdakilerden hangisi "${parent.title}" dalının alt kavramlarından biridir?`,
        `Which of the following is a sub-branch of "${parent.title}"?`
      ),
      options: shuffleArray([kid.title, ...distractors]),
      correctAnswer: kid.title,
      explanation: `${parent.title} → ${kids.map((k) => k.title).slice(0, 4).join(', ')}`,
    });
    usedNodeIds.add(kid.id);
  }

  return questions.slice(0, 8);
}

export const MapQuizModal: React.FC<MapQuizModalProps> = ({
  isOpen,
  doc,
  onClose,
  onMarkNodesForReview,
  onQuizComplete,
}) => {
  const { t } = useI18n();
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [missedNodeIds, setMissedNodeIds] = useState<string[]>([]);
  const [markedReviewDone, setMarkedReviewDone] = useState(false);
  const [finished, setFinished] = useState(false);

  const resetQuiz = useCallback(() => {
    const built = buildQuestionsFromMindMap(doc, t);
    setQuestions(built);
    setQIndex(0);
    setSelectedOption(null);
    setCorrectCount(0);
    setMissedNodeIds([]);
    setMarkedReviewDone(false);
    setFinished(false);
  }, [doc, t]);

  useEffect(() => {
    if (isOpen) {
      resetQuiz();
    }
  }, [isOpen, doc.id, resetQuiz]);

  if (!isOpen) return null;

  const current = questions[qIndex];
  const isAnswered = selectedOption !== null;
  const isCorrect = current ? selectedOption === current.correctAnswer : false;

  const handleSelectOption = (opt: string) => {
    if (!current || isAnswered) return;
    setSelectedOption(opt);
    StudyTracker.recordStudyActivity(1);
    if (opt === current.correctAnswer) {
      setCorrectCount((c) => c + 1);
      void hapticSuccess();
    } else {
      setMissedNodeIds((prev) =>
        prev.includes(current.targetNodeId) ? prev : [...prev, current.targetNodeId]
      );
      void hapticMedium();
    }
  };

  const handleNext = () => {
    void hapticLight();
    if (qIndex + 1 >= questions.length) {
      setFinished(true);
      onQuizComplete?.();
    } else {
      setQIndex((i) => i + 1);
      setSelectedOption(null);
    }
  };

  const scorePct =
    questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-3 py-6 backdrop-blur-xs"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      data-testid="map-quiz-modal"
    >
      <div
        className="relative flex max-h-full w-full max-w-[540px] flex-col overflow-hidden rounded-3xl border p-5 shadow-2xl"
        style={{
          backgroundColor: 'var(--canvas-bg)',
          borderColor: 'var(--hud-border)',
          color: 'var(--text-primary)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-300">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold sm:text-base">
                {t('Otomatik Mini Test (Quiz)', 'Automatic Mini Quiz')}
              </h2>
              <p className="text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                {doc.title} • {questions.length} {t('soru', 'questions')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('Kapat', 'Close')}
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-500/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-500/15">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-300"
            style={{
              width: `${
                finished
                  ? 100
                  : questions.length > 0
                  ? Math.round((qIndex / questions.length) * 100)
                  : 0
              }%`,
            }}
          />
        </div>

        {questions.length === 0 ? (
          <div className="py-10 text-center">
            <Sparkles className="mx-auto h-10 w-10 text-amber-500" />
            <p className="mt-3 text-sm font-bold">
              {t(
                'Otomatik test üretmek için haritanda en az 2 alt dal veya açıklamalı kart bulunmalı.',
                'Add at least 2 branches or notes to your map to generate a quiz.'
              )}
            </p>
          </div>
        ) : finished ? (
          <div className="py-7 text-center" data-testid="map-quiz-done">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-500/15 text-emerald-500">
              <Trophy className="h-8 w-8" />
            </div>
            <h3 className="mt-3 text-xl font-black">
              {scorePct >= 80
                ? t('Harika Skor!', 'Awesome Score!')
                : scorePct >= 50
                ? t('İyi Gidiyorsun!', 'Good Progress!')
                : t('Tekrar Zamanı!', 'Time to Review!')}
            </h3>
            <p className="mt-1 text-sm font-extrabold text-indigo-600 dark:text-indigo-300">
              {correctCount} / {questions.length} {t('Doğru', 'Correct')} (%{scorePct})
            </p>

            {missedNodeIds.length > 0 && onMarkNodesForReview && (
              <div className="mt-4">
                <button
                  type="button"
                  data-testid="quiz-mark-missed-btn"
                  disabled={markedReviewDone}
                  onClick={() => {
                    onMarkNodesForReview(missedNodeIds);
                    setMarkedReviewDone(true);
                    void hapticSuccess();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-amber-500/15 px-4 py-2.5 text-xs font-extrabold text-amber-700 hover:bg-amber-500/25 disabled:opacity-60 dark:text-amber-300"
                >
                  <Flag className="h-3.5 w-3.5" />
                  {markedReviewDone
                    ? t('Yanlış Dallar [TEKRAR] İşaretlendi ✓', 'Missed Branches Marked for Review ✓')
                    : t(
                        `Yanlış Yapılan ${missedNodeIds.length} Dalı Haritada [TEKRAR] İşaretle`,
                        `Mark ${missedNodeIds.length} Missed Branches for Review`
                      )}
                </button>
              </div>
            )}

            <div className="mt-5 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={resetQuiz}
                className="inline-flex items-center gap-1.5 rounded-2xl border px-4 py-2.5 text-xs font-extrabold hover:bg-slate-500/10"
                style={{ borderColor: 'var(--hud-border)' }}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {t('Yeni Test', 'New Quiz')}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl bg-slate-900 px-5 py-2.5 text-xs font-extrabold text-white dark:bg-sky-500 dark:text-slate-950"
              >
                {t('Haritaya Dön', 'Back to Map')}
              </button>
            </div>
          </div>
        ) : current ? (
          <div className="mt-4 flex flex-col gap-3 overflow-y-auto">
            <div className="flex items-center justify-between text-[11px] font-bold opacity-75">
              <span>
                {t('Soru', 'Question')} {qIndex + 1} / {questions.length}
              </span>
              <span className="rounded-full bg-indigo-500/15 px-2.5 py-0.5 text-indigo-700 dark:text-indigo-300">
                {current.promptLabel}
              </span>
            </div>

            <div
              className="rounded-2xl border p-4 text-center"
              style={{
                backgroundColor: 'var(--hud-bg)',
                borderColor: 'var(--hud-border)',
              }}
            >
              {current.stickerUrl && (
                <img
                  src={current.stickerUrl}
                  alt=""
                  className="mx-auto mb-2.5 h-14 w-14 rounded-xl object-contain"
                />
              )}
              <div className="text-sm leading-relaxed font-extrabold sm:text-base">
                {current.questionText}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2" data-testid="map-quiz-options">
              {current.options.map((opt, idx) => {
                const isSelected = selectedOption === opt;
                const isRightOption = opt === current.correctAnswer;
                let styleClass =
                  'border-slate-300/60 hover:bg-slate-500/10 dark:border-slate-700';
                if (isAnswered) {
                  if (isRightOption) {
                    styleClass =
                      'border-emerald-500 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200';
                  } else if (isSelected) {
                    styleClass =
                      'border-rose-500 bg-rose-500/15 text-rose-800 dark:text-rose-200';
                  } else {
                    styleClass = 'border-slate-300/40 opacity-50 dark:border-slate-700/50';
                  }
                }
                return (
                  <button
                    key={`${current.id}_${idx}`}
                    type="button"
                    data-testid={`quiz-option-${idx}`}
                    disabled={isAnswered}
                    onClick={() => handleSelectOption(opt)}
                    className={`flex items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-left text-xs font-extrabold transition sm:text-sm ${styleClass}`}
                  >
                    <span>
                      <span className="mr-2 opacity-55">
                        {String.fromCharCode(65 + idx)})
                      </span>
                      {opt}
                    </span>
                    {isAnswered && isRightOption && (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                    )}
                    {isAnswered && isSelected && !isRightOption && (
                      <XCircle className="h-4 w-4 shrink-0 text-rose-500" />
                    )}
                  </button>
                );
              })}
            </div>

            {isAnswered && (
              <div className="space-y-2.5 pt-1">
                <div
                  className={`rounded-2xl border p-3 text-xs font-semibold ${
                    isCorrect
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
                      : 'border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-200'
                  }`}
                >
                  <div className="font-black">
                    {isCorrect
                      ? t('Doğru cevap!', 'Correct!')
                      : t(`Doğru cevap: ${current.correctAnswer}`, `Correct answer: ${current.correctAnswer}`)}
                  </div>
                  <div className="mt-0.5 opacity-85">{current.explanation}</div>
                </div>
                <button
                  type="button"
                  data-testid="quiz-next-btn"
                  onClick={handleNext}
                  className="w-full rounded-2xl bg-slate-900 py-3 text-xs font-extrabold text-white transition active:scale-[0.99] dark:bg-sky-500 dark:text-slate-950"
                >
                  {qIndex + 1 >= questions.length
                    ? t('Sonuçları Gör', 'View Results')
                    : t('Sonraki Soru →', 'Next Question →')}
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};
