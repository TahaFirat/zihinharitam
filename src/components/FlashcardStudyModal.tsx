import React, { useCallback, useEffect, useState } from 'react';
import {
  Brain,
  CheckCircle2,
  ClipboardCheck,
  Flame,
  RotateCw,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react';
import type { MindMapDocument, MindNode, SrsCardProgress } from '../types/mindmap';
import { LocalStore } from '../core/sync/LocalStore';
import { StudyTracker } from '../core/study/StudyTracker';
import { useI18n } from '../core/i18n/i18n';
import { hapticLight, hapticMedium, hapticSuccess } from '../core/native/NativeBridge';

interface FlashcardStudyModalProps {
  isOpen: boolean;
  doc: MindMapDocument;
  onClose: () => void;
  onSessionComplete?: () => void;
  onStartQuiz?: () => void;
}

interface FlashcardItem {
  cardKey: string;
  node: MindNode;
  parentTitle: string;
  childrenTitles: string[];
  retryCount: number;
}

export function computeNextSm2(
  prev: SrsCardProgress | undefined,
  mapId: string,
  nodeId: string,
  quality: 1 | 3 | 4 | 5
): SrsCardProgress {
  const now = Date.now();
  const prevEf = prev?.easeFactor ?? 2.5;
  const prevReps = prev?.repetitions ?? 0;
  const prevInterval = prev?.intervalDays ?? 0;

  let repetitions = prevReps;
  let intervalDays = prevInterval;
  if (quality < 3) {
    repetitions = 0;
    intervalDays = 0;
  } else {
    if (repetitions === 0) intervalDays = quality === 3 ? 1 : quality === 4 ? 2 : 4;
    else if (repetitions === 1) intervalDays = quality === 3 ? 3 : 6;
    else intervalDays = Math.max(1, Math.round(prevInterval * prevEf));
    repetitions += 1;
  }

  const nextEf = Math.max(
    1.3,
    prevEf + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  );
  const dueAt =
    intervalDays === 0 ? now + 60_000 : now + intervalDays * 24 * 60 * 60 * 1000;

  return {
    cardKey: `${mapId}::${nodeId}`,
    mapId,
    nodeId,
    repetitions,
    intervalDays,
    easeFactor: Number(nextEf.toFixed(2)),
    dueAt,
    lastReviewedAt: now,
  };
}

function buildFrozenDeck(
  doc: MindMapDocument,
  srsSnapshot: Record<string, SrsCardProgress>
): FlashcardItem[] {
  const allNodes = Object.values(doc.nodes);
  const childrenByParent = new Map<string, string[]>();
  for (const n of allNodes) {
    if (n.parentId) {
      if (!childrenByParent.has(n.parentId)) childrenByParent.set(n.parentId, []);
      childrenByParent.get(n.parentId)!.push(n.title);
    }
  }
  const items: FlashcardItem[] = [];
  for (const n of allNodes) {
    if (n.id === doc.rootNodeId) continue;
    const parentTitle = n.parentId ? doc.nodes[n.parentId]?.title || doc.title : doc.title;
    items.push({
      cardKey: `${doc.id}::${n.id}`,
      node: n,
      parentTitle,
      childrenTitles: childrenByParent.get(n.id) ?? [],
      retryCount: 0,
    });
  }
  const now = Date.now();
  return items.sort((a, b) => {
    const aDue = (srsSnapshot[a.cardKey]?.dueAt ?? 0) <= now ? 0 : 1;
    const bDue = (srsSnapshot[b.cardKey]?.dueAt ?? 0) <= now ? 0 : 1;
    if (aDue !== bDue) return aDue - bDue;
    const aPri =
      a.node.priorityTag === 'exam'
        ? 0
        : a.node.priorityTag === 'important'
        ? 1
        : a.node.priorityTag === 'review'
        ? 1
        : 2;
    const bPri =
      b.node.priorityTag === 'exam'
        ? 0
        : b.node.priorityTag === 'important'
        ? 1
        : b.node.priorityTag === 'review'
        ? 1
        : 2;
    return aPri - bPri;
  });
}

function formatSm2IntervalLabel(
  intervalDays: number,
  t: (tr: string, en: string) => string
): string {
  if (intervalDays <= 0) return t('Bu turda', 'This round');
  if (intervalDays === 1) return t('1 gün', '1 day');
  if (intervalDays < 30) return t(`${intervalDays} gün`, `${intervalDays} days`);
  const months = Math.max(1, Math.round(intervalDays / 30));
  return t(`${months} ay`, `${months} mo`);
}

export const FlashcardStudyModal: React.FC<FlashcardStudyModalProps> = ({
  isOpen,
  doc,
  onClose,
  onSessionComplete,
  onStartQuiz,
}) => {
  const { t } = useI18n();
  const [srsMap, setSrsMap] = useState<Record<string, SrsCardProgress>>({});
  const [sessionQueue, setSessionQueue] = useState<FlashcardItem[]>([]);
  const [initialDeckSize, setInitialDeckSize] = useState(0);
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [masteredCount, setMasteredCount] = useState(0);
  const [requeuedCount, setRequeuedCount] = useState(0);
  const [finished, setFinished] = useState(false);

  const startFreshSession = useCallback(
    (loadedSrs: Record<string, SrsCardProgress>) => {
      const deck = buildFrozenDeck(doc, loadedSrs);
      setSessionQueue(deck);
      setInitialDeckSize(deck.length);
      setCardIndex(0);
      setFlipped(false);
      setReviewedCount(0);
      setMasteredCount(0);
      setRequeuedCount(0);
      setFinished(false);
    },
    [doc]
  );

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    void LocalStore.loadSrsProgressMap().then((loaded) => {
      if (cancelled) return;
      setSrsMap(loaded);
      startFreshSession(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, doc.id, startFreshSession]);

  const current = sessionQueue[cardIndex];

  const handleGrade = useCallback(
    (quality: 1 | 3 | 4 | 5) => {
      if (!current) return;
      const nextRec = computeNextSm2(srsMap[current.cardKey], doc.id, current.node.id, quality);
      const nextMap = { ...srsMap, [current.cardKey]: nextRec };
      setSrsMap(nextMap);
      void LocalStore.saveSrsProgressMap(nextMap);
      StudyTracker.recordStudyActivity(1);

      setReviewedCount((c) => c + 1);
      if (quality >= 4) {
        setMasteredCount((c) => c + 1);
        void hapticSuccess();
      } else {
        void hapticLight();
      }

      // If learner picked "Again" (`quality === 1`), re-queue this card 2 slots ahead (max 2 retries in one round)
      let nextQueueLen = sessionQueue.length;
      if (quality === 1 && current.retryCount < 2) {
        const retryItem: FlashcardItem = {
          ...current,
          retryCount: current.retryCount + 1,
        };
        const insertAt = Math.min(sessionQueue.length, cardIndex + 3);
        const updatedQueue = [
          ...sessionQueue.slice(0, insertAt),
          retryItem,
          ...sessionQueue.slice(insertAt),
        ];
        setSessionQueue(updatedQueue);
        setRequeuedCount((c) => c + 1);
        nextQueueLen = updatedQueue.length;
      }

      if (cardIndex + 1 >= nextQueueLen) {
        setFinished(true);
        onSessionComplete?.();
      } else {
        setFlipped(false);
        setCardIndex((i) => i + 1);
      }
    },
    [cardIndex, current, doc.id, onSessionComplete, sessionQueue, srsMap]
  );

  // Desktop & Tablet Keyboard Shortcuts (`Space` flip, `1/2/3/4` grade, `Escape` close)
  useEffect(() => {
    if (!isOpen || finished || !current) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (!flipped && (e.code === 'Space' || e.key === 'Enter')) {
        e.preventDefault();
        void hapticLight();
        setFlipped(true);
        return;
      }
      if (flipped) {
        if (e.key === '1') {
          e.preventDefault();
          handleGrade(1);
        } else if (e.key === '2') {
          e.preventDefault();
          handleGrade(3);
        } else if (e.key === '3') {
          e.preventDefault();
          handleGrade(4);
        } else if (e.key === '4') {
          e.preventDefault();
          handleGrade(5);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [current, finished, flipped, handleGrade, isOpen, onClose]);

  if (!isOpen) return null;

  const progressPct =
    sessionQueue.length > 0
      ? Math.min(100, Math.round((cardIndex / sessionQueue.length) * 100))
      : 100;

  const previewHard = current
    ? formatSm2IntervalLabel(
        computeNextSm2(srsMap[current.cardKey], doc.id, current.node.id, 3).intervalDays,
        t
      )
    : t('1 gün', '1 day');
  const previewGood = current
    ? formatSm2IntervalLabel(
        computeNextSm2(srsMap[current.cardKey], doc.id, current.node.id, 4).intervalDays,
        t
      )
    : t('2 gün', '2 days');
  const previewEasy = current
    ? formatSm2IntervalLabel(
        computeNextSm2(srsMap[current.cardKey], doc.id, current.node.id, 5).intervalDays,
        t
      )
    : t('4 gün', '4 days');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-3 py-6 backdrop-blur-xs"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      data-testid="flashcard-study-modal"
    >
      <div
        className="relative flex max-h-full w-full max-w-[520px] flex-col overflow-hidden rounded-3xl border p-5 shadow-2xl"
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
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-600 dark:text-violet-300">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold sm:text-base">
                {t('Aralıklı Tekrar (Flashcard)', 'Spaced Repetition Flashcards')}
              </h2>
              <p className="text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                {doc.title} • {initialDeckSize} {t('kart', 'cards')}
                {requeuedCount > 0 && ` (+${requeuedCount} ${t('tekrar', 'retry')})`}
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
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-sky-500 transition-all duration-300"
            style={{ width: `${finished ? 100 : progressPct}%` }}
          />
        </div>

        {sessionQueue.length === 0 ? (
          <div className="py-12 text-center">
            <Sparkles className="mx-auto h-10 w-10 text-amber-500" />
            <p className="mt-3 text-sm font-bold">
              {t(
                'Kart üretmek için haritana en az 1 alt dal ekle.',
                'Add at least 1 branch to your map to generate study cards.'
              )}
            </p>
          </div>
        ) : finished ? (
          <div className="py-8 text-center" data-testid="flashcard-session-done">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-500/15 text-emerald-500">
              <Trophy className="h-8 w-8" />
            </div>
            <h3 className="mt-3 text-lg font-black">
              {t('Harika Çalışma! Tur Tamamlandı', 'Great Session! Round Complete')}
            </h3>
            <p className="mt-1 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
              {t(
                `${reviewedCount} değerlendirme yapıldı • ${masteredCount} kart kalıcı hafızaya eklendi (SM-2).`,
                `${reviewedCount} reviews completed • ${masteredCount} cards mastered (SM-2).`
              )}
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => startFreshSession(srsMap)}
                className="rounded-2xl border px-4 py-2.5 text-xs font-extrabold hover:bg-slate-500/10"
                style={{ borderColor: 'var(--hud-border)' }}
              >
                {t('Tekrar Çalış', 'Study Again')}
              </button>
              {onStartQuiz && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onStartQuiz();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-violet-600 px-4 py-2.5 text-xs font-extrabold text-white hover:bg-violet-700"
                >
                  <ClipboardCheck className="h-4 w-4" />
                  {t('Mini Teste Geç', 'Take Mini Quiz')}
                </button>
              )}
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
          <div className="mt-4 flex flex-col">
            <div className="mb-2 flex items-center justify-between text-[11px] font-bold opacity-75">
              <span className="inline-flex items-center gap-1.5" data-testid="flashcard-counter">
                <span>
                  {t('Kart', 'Card')} {cardIndex + 1} / {sessionQueue.length}
                </span>
                {current.retryCount > 0 && (
                  <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-black text-rose-600 dark:text-rose-300">
                    {t('Tekrar Turu', 'Retry')}
                  </span>
                )}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/10 px-2 py-0.5">
                {current.node.priorityTag === 'exam' && (
                  <Flame className="h-3 w-3 text-rose-500" />
                )}
                {current.parentTitle}
              </span>
            </div>

            {/* Interactive Flip Card */}
            <button
              type="button"
              data-testid="flashcard-flip-surface"
              onClick={() => {
                void hapticMedium();
                setFlipped((f) => !f);
              }}
              className="flex min-h-[235px] w-full flex-col items-center justify-center rounded-3xl border-2 p-6 text-center shadow-sm transition active:scale-[0.99]"
              style={{
                backgroundColor: 'var(--hud-bg)',
                borderColor: flipped ? current.node.branchColor : 'var(--hud-border)',
              }}
            >
              {!flipped ? (
                <>
                  {current.node.sticker && (
                    <img
                      src={current.node.sticker.url}
                      alt={current.node.title}
                      className="mb-3 h-16 w-16 rounded-xl object-contain drop-shadow-sm"
                    />
                  )}
                  <span
                    className="mb-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-black tracking-wide uppercase"
                    style={{
                      backgroundColor: `${current.node.branchColor}22`,
                      color: current.node.branchColor,
                    }}
                  >
                    {t('Aktif Hatırlama Sorusu', 'Active Recall Prompt')}
                  </span>
                  <div className="text-lg leading-snug font-black sm:text-xl" data-testid="flashcard-card-title">
                    {current.node.title}
                  </div>
                  <p
                    className="mt-2 max-w-xs text-xs font-medium"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {current.childrenTitles.length > 0
                      ? t(
                          `Bu kavramın ${current.childrenTitles.length} alt dalını ve açıklamasını hatırla`,
                          `Recall the ${current.childrenTitles.length} sub-branches and explanation`
                        )
                      : t(
                          'Bu kavramın anlamını, kuralını veya anahtar notunu hatırla',
                          'Recall the definition, rule, or key note for this concept'
                        )}
                  </p>
                  <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-slate-500/10 px-3 py-1 text-[11px] font-extrabold opacity-80">
                    <RotateCw className="h-3.5 w-3.5" />
                    {t('Cevabı Görmek İçin Dokun (Boşluk)', 'Tap to Reveal Answer (Space)')}
                  </div>
                </>
              ) : (
                <div className="w-full text-left">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                    <span className="text-sm font-black">{current.node.title}</span>
                    {current.node.techBadge && (
                      <span className="rounded-md bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-extrabold text-sky-600 dark:text-sky-300">
                        {current.node.techBadge}
                      </span>
                    )}
                  </div>
                  {current.node.subtitle && (
                    <p className="mt-2 text-xs leading-relaxed font-semibold opacity-90">
                      {current.node.subtitle}
                    </p>
                  )}
                  {current.node.note && (
                    <div
                      className="mt-2 max-h-28 overflow-y-auto rounded-xl border p-2.5 text-xs leading-relaxed whitespace-pre-line"
                      style={{
                        backgroundColor: 'var(--canvas-bg)',
                        borderColor: 'var(--hud-border)',
                      }}
                    >
                      {current.node.note}
                    </div>
                  )}
                  {current.childrenTitles.length > 0 && (
                    <div className="mt-3">
                      <div className="text-[10px] font-black tracking-wide uppercase opacity-60">
                        {t('Alt Dallar', 'Sub-branches')}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {current.childrenTitles.map((ct, idx) => (
                          <span
                            key={idx}
                            className="rounded-lg border px-2 py-0.5 text-[11px] font-bold"
                            style={{ borderColor: 'var(--hud-border)' }}
                          >
                            {ct}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {!current.node.subtitle &&
                    !current.node.note &&
                    current.childrenTitles.length === 0 && (
                      <p className="mt-2 text-xs font-medium opacity-75">
                        {t('Üst Konu:', 'Parent Topic:')} <strong>{current.parentTitle}</strong>
                      </p>
                    )}
                </div>
              )}
            </button>

            {/* SM-2 Rating Controls with Live Computed Intervals */}
            {flipped ? (
              <div className="mt-4 grid grid-cols-4 gap-1.5" data-testid="flashcard-sm2-buttons">
                <button
                  type="button"
                  data-testid="flashcard-grade-again"
                  onClick={() => handleGrade(1)}
                  className="rounded-2xl bg-rose-500/15 py-2.5 text-center text-xs font-extrabold text-rose-600 transition active:scale-95 dark:text-rose-300"
                >
                  <div>{t('Tekrar', 'Again')}</div>
                  <div className="text-[10px] opacity-75">
                    {current.retryCount < 2 ? t('Bu turda', 'This round') : t('1 dk', '1 min')}
                  </div>
                </button>
                <button
                  type="button"
                  data-testid="flashcard-grade-hard"
                  onClick={() => handleGrade(3)}
                  className="rounded-2xl bg-amber-500/15 py-2.5 text-center text-xs font-extrabold text-amber-700 transition active:scale-95 dark:text-amber-300"
                >
                  <div>{t('Zor', 'Hard')}</div>
                  <div className="text-[10px] opacity-75">{previewHard}</div>
                </button>
                <button
                  type="button"
                  onClick={() => handleGrade(4)}
                  data-testid="flashcard-grade-good"
                  className="rounded-2xl bg-sky-500/15 py-2.5 text-center text-xs font-extrabold text-sky-700 transition active:scale-95 dark:text-sky-300"
                >
                  <div>{t('İyi', 'Good')}</div>
                  <div className="text-[10px] opacity-75">{previewGood}</div>
                </button>
                <button
                  type="button"
                  data-testid="flashcard-grade-easy"
                  onClick={() => handleGrade(5)}
                  className="rounded-2xl bg-emerald-500/15 py-2.5 text-center text-xs font-extrabold text-emerald-700 transition active:scale-95 dark:text-emerald-300"
                >
                  <div>{t('Kolay', 'Easy')}</div>
                  <div className="text-[10px] opacity-75">{previewEasy}</div>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  void hapticLight();
                  setFlipped(true);
                }}
                className="mt-4 w-full rounded-2xl bg-slate-900 py-3 text-xs font-extrabold text-white shadow-sm transition active:scale-99 dark:bg-violet-500 dark:text-slate-950"
              >
                {t('Cevabı Göster', 'Show Answer')}
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};
