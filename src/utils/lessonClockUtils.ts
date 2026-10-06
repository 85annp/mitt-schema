/**
 * Utility functions for Lesson Clock (Lektionsklocka)
 */

export interface Lesson {
  guidId?: string;
  texts?: string[];
  timeStart: string; // e.g. "08:30:00" or "08:30"
  timeEnd: string;   // e.g. "09:30:00" or "09:30"
  dayOfWeekNumber: number; // 1 = Monday, ..., 5 = Friday, 6 = Saturday, 7 = Sunday
  blockName?: string;
  [key: string]: any;
}

/**
 * Checks if a lesson has actual subject/title text.
 * Skola24 represents teacher working hours ("arbetstider") or free blocks as entries without text.
 * These should be ignored according to requirements.
 */
export function isRealLesson(lesson: any): boolean {
  if (!lesson) return false;
  if (!lesson.texts || !Array.isArray(lesson.texts) || lesson.texts.length === 0) {
    return false;
  }
  return lesson.texts.some(
    (t: any) => typeof t === "string" && t.trim().length > 0
  );
}

/**
 * Converts "HH:mm" or "HH:mm:ss" string to seconds from midnight.
 */
export function parseTimeToSeconds(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(":").map(Number);
  const h = parts[0] || 0;
  const m = parts[1] || 0;
  const s = parts[2] || 0;
  return h * 3600 + m * 60 + s;
}

/**
 * Formats time string to "HH:mm"
 */
export function formatTimeHM(timeStr: string): string {
  if (!timeStr) return "";
  const parts = timeStr.split(":");
  return `${parts[0].padStart(2, "0")}:${(parts[1] || "00").padStart(2, "0")}`;
}

/**
 * Formats duration in seconds to Swedish readable text.
 * e.g. "14 min 20 sek", "3 min", "45 sek"
 */
export function formatRemainingTime(seconds: number): {
  minutes: number;
  remainingSeconds: number;
  formattedText: string;
} {
  const safeSec = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSec / 60);
  const remainingSeconds = safeSec % 60;

  let formattedText = "";
  if (minutes > 0 && remainingSeconds > 0) {
    formattedText = `${minutes} min ${remainingSeconds} sek`;
  } else if (minutes > 0) {
    formattedText = `${minutes} min`;
  } else {
    formattedText = `${remainingSeconds} sek`;
  }

  return { minutes, remainingSeconds, formattedText };
}

export interface LessonStatusResult {
  hasLessonsToday: boolean;
  todaysLessons: Lesson[];
  activeLesson: Lesson | null;
  nextLesson: Lesson | null;
  previousLesson: Lesson | null;
  
  // Active lesson details (if active)
  totalDurationSeconds: number;
  elapsedSeconds: number;
  remainingSeconds: number;
  progressPercent: number;
  isEndingSoon: boolean; // true when remainingSeconds <= 180 (3 min)
  isLastMinute: boolean; // true when remainingSeconds <= 60
  
  // Status info
  isBreak: boolean;
  timeUntilNextLessonSeconds: number;
  isDayFinished: boolean;
  isBeforeSchoolDay: boolean;
}

/**
 * Analyzes the list of lessons against a given date/time and returns current lesson state.
 */
export function getLessonStatus(
  lessons: Lesson[],
  currentDate: Date = new Date()
): LessonStatusResult {
  const jsDay = currentDate.getDay(); // 0 is Sunday, 1 is Monday, etc.
  const todayDayOfWeekNumber = jsDay === 0 ? 7 : jsDay;

  // Filter lessons for today and ensure they are real lessons (excluding textless working hours)
  const todaysLessons = (lessons || [])
    .filter((l) => l.dayOfWeekNumber === todayDayOfWeekNumber && isRealLesson(l))
    .sort((a, b) => parseTimeToSeconds(a.timeStart) - parseTimeToSeconds(b.timeStart));

  const currentSeconds =
    currentDate.getHours() * 3600 +
    currentDate.getMinutes() * 60 +
    currentDate.getSeconds();

  if (todaysLessons.length === 0) {
    return {
      hasLessonsToday: false,
      todaysLessons: [],
      activeLesson: null,
      nextLesson: null,
      previousLesson: null,
      totalDurationSeconds: 0,
      elapsedSeconds: 0,
      remainingSeconds: 0,
      progressPercent: 0,
      isEndingSoon: false,
      isLastMinute: false,
      isBreak: false,
      timeUntilNextLessonSeconds: 0,
      isDayFinished: false,
      isBeforeSchoolDay: false,
    };
  }

  // Find active lesson (if any)
  const activeLesson =
    todaysLessons.find((l) => {
      const start = parseTimeToSeconds(l.timeStart);
      const end = parseTimeToSeconds(l.timeEnd);
      return currentSeconds >= start && currentSeconds < end;
    }) || null;

  let totalDurationSeconds = 0;
  let elapsedSeconds = 0;
  let remainingSeconds = 0;
  let progressPercent = 0;
  let isEndingSoon = false;
  let isLastMinute = false;

  if (activeLesson) {
    const start = parseTimeToSeconds(activeLesson.timeStart);
    const end = parseTimeToSeconds(activeLesson.timeEnd);
    totalDurationSeconds = Math.max(1, end - start);
    elapsedSeconds = Math.max(0, currentSeconds - start);
    remainingSeconds = Math.max(0, end - currentSeconds);
    progressPercent = Math.min(100, Math.max(0, (elapsedSeconds / totalDurationSeconds) * 100));
    isEndingSoon = remainingSeconds <= 180 && remainingSeconds > 0;
    isLastMinute = remainingSeconds <= 60 && remainingSeconds > 0;
  }

  // Find next and previous lessons
  const nextLesson =
    todaysLessons.find((l) => parseTimeToSeconds(l.timeStart) > currentSeconds) || null;

  const previousLessons = todaysLessons.filter(
    (l) => parseTimeToSeconds(l.timeEnd) <= currentSeconds
  );
  const previousLesson =
    previousLessons.length > 0 ? previousLessons[previousLessons.length - 1] : null;

  const firstLessonStart = parseTimeToSeconds(todaysLessons[0].timeStart);
  const lastLessonEnd = parseTimeToSeconds(
    todaysLessons[todaysLessons.length - 1].timeEnd
  );

  const isBeforeSchoolDay = currentSeconds < firstLessonStart;
  const isDayFinished = currentSeconds >= lastLessonEnd;
  const isBreak = !activeLesson && !isBeforeSchoolDay && !isDayFinished && nextLesson !== null;

  const timeUntilNextLessonSeconds = nextLesson
    ? Math.max(0, parseTimeToSeconds(nextLesson.timeStart) - currentSeconds)
    : 0;

  return {
    hasLessonsToday: true,
    todaysLessons,
    activeLesson,
    nextLesson,
    previousLesson,
    totalDurationSeconds,
    elapsedSeconds,
    remainingSeconds,
    progressPercent,
    isEndingSoon,
    isLastMinute,
    isBreak,
    timeUntilNextLessonSeconds,
    isDayFinished,
    isBeforeSchoolDay,
  };
}
