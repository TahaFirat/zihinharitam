export interface StudyTrackerState {
  currentStreak: number;
  longestStreak: number;
  lastStudyDateIso: string | null; // YYYY-MM-DD in local time
  todayDateIso: string;
  todayReviewedCount: number;
  totalReviewedAllTime: number;
  examTitle: string;
  examDateIso: string; // YYYY-MM-DD or ''
}

const STORAGE_KEY = 'zh_v11_study_tracker_v1';

function toLocalDateIso(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function diffCalendarDays(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = fromIso.split('-').map(Number);
  const [ty, tm, td] = toIso.split('-').map(Number);
  if (!fy || !fm || !fd || !ty || !tm || !td) return 0;
  const a = Date.UTC(fy, fm - 1, fd);
  const b = Date.UTC(ty, tm - 1, td);
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

function defaultState(): StudyTrackerState {
  return {
    currentStreak: 0,
    longestStreak: 0,
    lastStudyDateIso: null,
    todayDateIso: toLocalDateIso(),
    todayReviewedCount: 0,
    totalReviewedAllTime: 0,
    examTitle: '',
    examDateIso: '',
  };
}

function normalizeForToday(raw: StudyTrackerState): StudyTrackerState {
  const today = toLocalDateIso();
  const todayReviewedCount = raw.todayDateIso === today ? raw.todayReviewedCount : 0;
  let currentStreak = raw.currentStreak;
  if (raw.lastStudyDateIso) {
    const gap = diffCalendarDays(raw.lastStudyDateIso, today);
    if (gap > 1) {
      currentStreak = 0;
    }
  }
  return {
    ...raw,
    todayDateIso: today,
    todayReviewedCount,
    currentStreak,
  };
}

const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((fn) => fn());
}

export const StudyTracker = {
  load(): StudyTrackerState {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw) as Partial<StudyTrackerState>;
      return normalizeForToday({
        ...defaultState(),
        ...parsed,
      });
    } catch {
      return defaultState();
    }
  },

  save(state: StudyTrackerState): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      }
    } catch {
      // Ignore storage quota errors
    }
    notify();
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  recordStudyActivity(count = 1): StudyTrackerState {
    const today = toLocalDateIso();
    const prev = this.load();
    let nextStreak = prev.currentStreak;

    if (!prev.lastStudyDateIso) {
      nextStreak = 1;
    } else {
      const gap = diffCalendarDays(prev.lastStudyDateIso, today);
      if (gap === 0) {
        nextStreak = Math.max(1, prev.currentStreak);
      } else if (gap === 1) {
        nextStreak = prev.currentStreak + 1;
      } else {
        nextStreak = 1;
      }
    }

    const next: StudyTrackerState = {
      ...prev,
      currentStreak: nextStreak,
      longestStreak: Math.max(prev.longestStreak, nextStreak),
      lastStudyDateIso: today,
      todayDateIso: today,
      todayReviewedCount: prev.todayReviewedCount + Math.max(1, count),
      totalReviewedAllTime: prev.totalReviewedAllTime + Math.max(1, count),
    };
    this.save(next);
    return next;
  },

  setExamCountdown(examTitle: string, examDateIso: string): StudyTrackerState {
    const prev = this.load();
    const next: StudyTrackerState = {
      ...prev,
      examTitle: examTitle.trim().slice(0, 40),
      examDateIso: /^\d{4}-\d{2}-\d{2}$/.test(examDateIso.trim()) ? examDateIso.trim() : '',
    };
    this.save(next);
    return next;
  },

  getDaysUntilExam(state: StudyTrackerState): number | null {
    if (!state.examDateIso) return null;
    const today = toLocalDateIso();
    return diffCalendarDays(today, state.examDateIso);
  },
};
