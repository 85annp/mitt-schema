import { isRealLesson } from "./lessonClockUtils";

export interface LaidOutLesson {
  lesson: any;
  colIndex: number;
  colSpan: number;
  totalColumns: number;
  isColliding: boolean;
  leftPercent: number;
  widthPercent: number;
}

export interface DayLayoutResult {
  backgroundLessons: any[];
  realLessons: LaidOutLesson[];
}

function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(":").map(Number);
  const h = parts[0] || 0;
  const m = parts[1] || 0;
  return h * 60 + m;
}

function getDurationMinutes(lesson: any): number {
  const start = parseTimeToMinutes(lesson.timeStart);
  const end = parseTimeToMinutes(lesson.timeEnd);
  return Math.max(end - start, 0);
}

/**
 * Computes layout for schedule lessons for a single day.
 * Separates background passes (working hours without text) from real lessons.
 * Colliding real lessons are assigned side-by-side columns sharing available width.
 */
export function computeDayScheduleLayout(dayLessons: any[]): DayLayoutResult {
  if (!dayLessons || dayLessons.length === 0) {
    return { backgroundLessons: [], realLessons: [] };
  }

  // 1. Separate background passes (working hours / arbetstid) from real lessons
  const backgroundLessons = dayLessons
    .filter((l) => !isRealLesson(l))
    .sort((a, b) => getDurationMinutes(b) - getDurationMinutes(a)); // Longest first

  const unpositionedReal = dayLessons
    .filter((l) => isRealLesson(l))
    .map((lesson) => ({
      lesson,
      start: parseTimeToMinutes(lesson.timeStart),
      end: parseTimeToMinutes(lesson.timeEnd),
    }))
    .sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));

  if (unpositionedReal.length === 0) {
    return { backgroundLessons, realLessons: [] };
  }

  // 2. Group overlapping real lessons into clusters (connected overlapping intervals)
  type LessonItem = (typeof unpositionedReal)[number];
  const clusters: LessonItem[][] = [];
  let currentCluster: LessonItem[] = [];
  let currentClusterEnd = -1;

  for (const item of unpositionedReal) {
    if (currentCluster.length === 0) {
      currentCluster.push(item);
      currentClusterEnd = item.end;
    } else if (item.start < currentClusterEnd) {
      // Overlaps with the current cluster
      currentCluster.push(item);
      currentClusterEnd = Math.max(currentClusterEnd, item.end);
    } else {
      // Starts at or after the end of previous cluster -> new cluster
      clusters.push(currentCluster);
      currentCluster = [item];
      currentClusterEnd = item.end;
    }
  }
  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  // 3. Assign columns within each cluster using greedy interval coloring
  const realLessons: LaidOutLesson[] = [];

  for (const cluster of clusters) {
    const columns: LessonItem[][] = [];
    const itemToCol = new Map<LessonItem, number>();

    for (const item of cluster) {
      let placedCol = -1;
      for (let c = 0; c < columns.length; c++) {
        const lastInCol = columns[c][columns[c].length - 1];
        if (lastInCol.end <= item.start) {
          columns[c].push(item);
          placedCol = c;
          break;
        }
      }
      if (placedCol === -1) {
        placedCol = columns.length;
        columns.push([item]);
      }
      itemToCol.set(item, placedCol);
    }

    const totalColumns = columns.length;

    for (const item of cluster) {
      const colIndex = itemToCol.get(item) ?? 0;
      
      // Calculate how many adjacent empty columns this item can span to the right
      let colSpan = 1;
      while (colIndex + colSpan < totalColumns) {
        const nextCol = columns[colIndex + colSpan];
        const hasOverlap = nextCol.some(
          (other) => item.start < other.end && other.start < item.end
        );
        if (hasOverlap) break;
        colSpan++;
      }

      const isColliding = totalColumns > 1 && (colSpan < totalColumns || colIndex > 0);
      const leftPercent = (colIndex * 100) / totalColumns;
      const widthPercent = (colSpan * 100) / totalColumns;

      realLessons.push({
        lesson: item.lesson,
        colIndex,
        colSpan,
        totalColumns,
        isColliding,
        leftPercent,
        widthPercent,
      });
    }
  }

  return {
    backgroundLessons,
    realLessons,
  };
}
