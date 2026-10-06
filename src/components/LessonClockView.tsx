"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Clock,
  Maximize2,
  Minimize2,
  RefreshCw,
  AlertTriangle,
  Coffee,
  CheckCircle2,
  Calendar,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { getWeeklySchedule } from "@/app/actions";
import {
  Lesson,
  getLessonStatus,
  formatTimeHM,
  formatRemainingTime,
  formatMMSS,
  isRealLesson,
  parseTimeToSeconds,
} from "@/utils/lessonClockUtils";

interface LessonClockViewProps {
  kommun: string;
  skola: string;
  schemaId: string;
  unitGuid: string;
}

export default function LessonClockView({
  kommun,
  skola,
  schemaId,
  unitGuid,
}: LessonClockViewProps) {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [colors, setColors] = useState<Record<string, string>>({});
  
  // Simulation / Testing state for outside school hours
  const [simulatedTime, setSimulatedTime] = useState<string | null>(null);
  const [showSimControls, setShowSimControls] = useState(false);

  // Initialize time on client mount to avoid hydration mismatch
  useEffect(() => {
    setCurrentTime(new Date());
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Load colors and lessons from localStorage (instant load from opener) or fetch from API
  const loadSchedule = useCallback(async () => {
    // Load colors
    try {
      const savedColors = localStorage.getItem("scheduleColors");
      if (savedColors) {
        setColors(JSON.parse(savedColors));
      }
    } catch (e) {
      console.error(e);
    }

    // Try loading cached lessons from localStorage first
    try {
      const cached = localStorage.getItem("mittSchemaLessons");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setLessons(parsed);
          setLoading(false);
        }
      }
    } catch (e) {
      console.error(e);
    }

    // Fetch fresh schedule if we have search params
    if (kommun && schemaId) {
      const res = await getWeeklySchedule(kommun, unitGuid, schemaId);
      if (res.success && Array.isArray(res.timetable)) {
        setLessons(res.timetable);
        try {
          localStorage.setItem("mittSchemaLessons", JSON.stringify(res.timetable));
        } catch (e) {}
      }
    }
    setLoading(false);
  }, [kommun, unitGuid, schemaId]);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // Compute effective date (real or simulated)
  const effectiveDate = useMemo(() => {
    if (!currentTime) return new Date();
    if (!simulatedTime) return currentTime;

    // Use current date but override hours, minutes, seconds from simulatedTime ("HH:mm:ss" or "HH:mm")
    const [h, m, s] = simulatedTime.split(":").map(Number);
    const d = new Date(currentTime);
    d.setHours(h ?? 0, m ?? 0, s ?? 0, 0);
    return d;
  }, [currentTime, simulatedTime]);

  // Calculate lesson status
  const status = useMemo(() => {
    return getLessonStatus(lessons, effectiveDate);
  }, [lessons, effectiveDate]);

  // Format digital clock
  const clockString = useMemo(() => {
    const d = effectiveDate;
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    const s = String(d.getSeconds()).padStart(2, "0");
    return `${h}:${m}:${s}`;
  }, [effectiveDate]);

  // Format Swedish date
  const dateString = useMemo(() => {
    return effectiveDate.toLocaleDateString("sv-SE", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }, [effectiveDate]);

  // Colors helper
  const getSubjectColor = (lesson: Lesson | null) => {
    if (!lesson) return null;
    const name = (lesson.texts || [])[0] || "";
    const group = (lesson.texts || []).length > 1 ? (lesson.texts || [])[1] : "";
    const key = group ? `${name} (${group})` : name;
    return colors[key] || colors[name] || null;
  };

  if (loading && lessons.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-gray-700 p-6">
        <RefreshCw className="animate-spin text-blue-600 mb-4" size={40} />
        <h2 className="text-xl font-semibold">Laddar lektionsklocka...</h2>
        <p className="text-sm text-gray-500 mt-1">Hämtar lektioner för schemat</p>
      </div>
    );
  }

  const { activeLesson, remainingSeconds, progressPercent, isEndingSoon, isLastMinute } = status;
  const remainingFormatted = formatRemainingTime(remainingSeconds);

  // Lesson titles
  const lessonSubject = activeLesson
    ? (activeLesson.texts || []).filter((t) => t && t.trim())[0] || "Lektion"
    : "";
  const lessonDetails = activeLesson
    ? (activeLesson.texts || []).filter((t) => t && t.trim()).slice(1).join(" • ")
    : "";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/40 text-slate-800 flex flex-col justify-between p-4 sm:p-8 select-none transition-colors duration-500">
      {/* Top Header Bar */}
      <header className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div className="flex items-center space-x-2">
          <div className="p-2 bg-blue-100 text-blue-600 rounded-xl shadow-sm">
            <Clock size={22} className="stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 leading-tight">
              Lektionsklocka
            </h1>
            <p className="text-xs text-slate-500 truncate max-w-[220px] sm:max-w-md">
              {schemaId ? decodeURIComponent(schemaId) : "Schema"}
              {skola ? ` • ${decodeURIComponent(skola)}` : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => loadSchedule()}
            title="Uppdatera schema"
            className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors shadow-xs"
          >
            <RefreshCw size={18} />
          </button>
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? "Avsluta helskärm" : "Helskärm"}
            className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors shadow-xs"
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center my-6 max-w-3xl w-full mx-auto space-y-8">
        
        {/* Current Time Section ("Vad klockan är") */}
        <section className="text-center space-y-1">
          <div
            className="text-6xl sm:text-7xl md:text-8xl font-black font-mono tracking-tight text-slate-900 tabular-nums drop-shadow-xs"
            aria-label={`Klockan är ${clockString}`}
          >
            {clockString}
          </div>
          <div className="text-sm sm:text-base font-medium text-slate-500 capitalize tracking-wide">
            {dateString}
          </div>
        </section>

        {/* Lesson Card */}
        {activeLesson ? (
          <section
            className={`w-full rounded-2xl p-6 sm:p-8 shadow-lg border transition-all duration-500 ${
              isLastMinute
                ? "bg-rose-50/90 border-rose-300 shadow-rose-100"
                : isEndingSoon
                ? "bg-amber-50/90 border-amber-300 shadow-amber-100"
                : "bg-white border-slate-200/80 shadow-slate-100"
            }`}
          >
            {/* Top row: Lesson name & small start/end time */}
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center space-x-2">
                  <span
                    className={`inline-block w-3 h-3 rounded-full ${
                      isEndingSoon ? "bg-amber-500 animate-ping" : "bg-emerald-500"
                    }`}
                  />
                  <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                    {lessonSubject}
                  </h2>
                </div>
                {lessonDetails && (
                  <p className="text-sm font-medium text-slate-500 mt-0.5 ml-5">
                    {lessonDetails}
                  </p>
                )}
              </div>

              {/* Start- and End time ("kan vara ganska litet") */}
              <div className="text-xs sm:text-sm font-mono font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full self-start sm:self-auto border border-slate-200/60">
                {formatTimeHM(activeLesson.timeStart)} – {formatTimeHM(activeLesson.timeEnd)}
              </div>
            </div>

            {/* Time Remaining Section ("Hur lång tid det är kvar på lektionen") */}
            <div className="my-6 text-center space-y-1">
              <div className="text-xs sm:text-sm uppercase tracking-wider font-semibold text-slate-400">
                Tid kvar på lektionen
              </div>
              <div
                className={`text-5xl sm:text-6xl md:text-7xl font-black font-mono tracking-tight tabular-nums transition-colors duration-300 ${
                  isLastMinute
                    ? "text-rose-600 animate-pulse"
                    : isEndingSoon
                    ? "text-amber-600"
                    : "text-blue-600"
                }`}
              >
                {remainingFormatted.mmSS}
                <span className="text-2xl sm:text-3xl font-sans font-semibold text-slate-400 ml-2"></span>
              </div>

              {/* Visual 3-minute notice */}
              {isEndingSoon && (
                <div className="pt-2 flex items-center justify-center space-x-1.5 text-xs sm:text-sm font-semibold text-amber-700 animate-bounce">
                  <AlertTriangle size={16} />
                  <span>
                    {isLastMinute ? "Sista minuten! Avrunda lektionen." : "Mindre än 3 minuter kvar!"}
                  </span>
                </div>
              )}
            </div>

            {/* Progress Bar Section */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-semibold text-slate-500">
                <span>Avklarat: {Math.round(progressPercent)}%</span>
                <span>{formatTimeHM(activeLesson.timeEnd)}</span>
              </div>

              {/* Progress bar container */}
              <div className="w-full bg-slate-100 rounded-full h-5 sm:h-6 p-0.5 overflow-hidden shadow-inner border border-slate-200">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ease-linear shadow-xs ${
                    isLastMinute
                      ? "bg-rose-500 animate-pulse"
                      : isEndingSoon
                      ? "bg-amber-500"
                      : "bg-blue-600"
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </section>
        ) : (
          /* When there is NO ongoing lesson */
          <section className="w-full bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-200/80 text-center space-y-4">
            {status.isBreak && status.nextLesson ? (
              <div className="space-y-3">
                <div className="inline-flex items-center space-x-2 px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold">
                  <Coffee size={15} />
                  <span>Rast just nu</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">
                  Ingen lektion för tillfället
                </h2>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 inline-block text-left max-w-md w-full">
                  <div className="text-xs uppercase tracking-wider font-semibold text-slate-400 mb-1">
                    Nästa lektion
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="font-bold text-lg text-slate-900">
                      {(status.nextLesson.texts || [])[0] || "Lektion"}
                    </span>
                    <span className="text-xs font-mono bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-600">
                      {formatTimeHM(status.nextLesson.timeStart)} – {formatTimeHM(status.nextLesson.timeEnd)}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-blue-600 mt-2">
                    Börjar om {formatRemainingTime(status.timeUntilNextLessonSeconds).formattedText}
                  </div>
                </div>
              </div>
            ) : status.isBeforeSchoolDay && status.nextLesson ? (
              <div className="space-y-3">
                <div className="inline-flex items-center space-x-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                  <Calendar size={15} />
                  <span>Före skoldagens start</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">
                  Första lektionen börjar kl. {formatTimeHM(status.nextLesson.timeStart)}
                </h2>
                <p className="text-slate-600">
                  <span className="font-bold">{(status.nextLesson.texts || [])[0]}</span> (börjar om{" "}
                  {formatRemainingTime(status.timeUntilNextLessonSeconds).formattedText})
                </p>
              </div>
            ) : status.isDayFinished ? (
              <div className="space-y-3">
                <div className="inline-flex items-center space-x-2 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold">
                  <CheckCircle2 size={15} />
                  <span>Dagens lektioner är slut</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">
                  Alla dagens lektioner är avklarade!
                </h2>
                <p className="text-sm text-slate-500">Ha en trevlig eftermiddag/kväll.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-slate-800">Inga lektioner inlagda idag</h2>
                <p className="text-sm text-slate-500">
                  Det finns inga schemalagda lektioner för denna dag.
                </p>
              </div>
            )}
          </section>
        )}

        {/* Small overview of today's schedule */}
        {status.todaysLessons.length > 0 && (
          <section className="w-full bg-white/70 backdrop-blur-xs rounded-xl p-4 border border-slate-200/60 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Dagens lektioner ({status.todaysLessons.length} st)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {status.todaysLessons.map((l, i) => {
                const isActive = activeLesson?.guidId === l.guidId || activeLesson === l;
                const startSec = parseTimeToSeconds(l.timeStart);
                const endSec = parseTimeToSeconds(l.timeEnd);
                const currSec =
                  effectiveDate.getHours() * 3600 +
                  effectiveDate.getMinutes() * 60 +
                  effectiveDate.getSeconds();
                const isPassed = currSec >= endSec;

                return (
                  <div
                    key={l.guidId || i}
                    className={`p-2.5 rounded-lg border text-xs flex justify-between items-center transition-all ${
                      isActive
                        ? "bg-blue-50 border-blue-300 text-blue-900 font-semibold shadow-xs"
                        : isPassed
                        ? "bg-slate-50/50 border-slate-100 text-slate-400 line-through decoration-slate-300"
                        : "bg-white border-slate-200/80 text-slate-700"
                    }`}
                  >
                    <span className="truncate pr-1">{(l.texts || [])[0]}</span>
                    <span className="font-mono text-[11px] opacity-75 shrink-0">
                      {formatTimeHM(l.timeStart)}-{formatTimeHM(l.timeEnd)}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>

      {/* Footer / Simulation & Testing bar */}
      <footer className="pt-4 border-t border-slate-200/70 text-center">
        <div className="inline-block">
          <button
            onClick={() => setShowSimControls(!showSimControls)}
            className="text-xs text-slate-500 hover:text-slate-800 inline-flex items-center space-x-1 py-1 px-2 rounded hover:bg-slate-100 transition-colors"
          >
            <Sparkles size={13} />
            <span>Testa &amp; simulera lektionsklockan</span>
            {showSimControls ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          {showSimControls && (
            <div className="mt-2 p-3 bg-white border border-slate-200 rounded-xl shadow-sm text-xs space-y-2 text-left max-w-md mx-auto">
              <div className="font-semibold text-slate-700">
                Simulering för demonstration / test:
              </div>
              <p className="text-slate-500 text-[11px]">
                Testa vad som visas vid olika tider på dagen, t.ex. när det är 2 minuter kvar på en lektion.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {status.todaysLessons.slice(0, 3).map((l, idx) => {
                  const [endH, endM] = l.timeEnd.split(":").map(Number);
                  // Calculate time 2 minutes before end:
                  let simM = endM - 2;
                  let simH = endH;
                  if (simM < 0) {
                    simM += 60;
                    simH -= 1;
                  }
                  const simStr = `${String(simH).padStart(2, "0")}:${String(simM).padStart(2, "0")}:15`;

                  return (
                    <button
                      key={idx}
                      onClick={() => setSimulatedTime(simStr)}
                      className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded font-mono text-[11px]"
                    >
                      Testa &lt; 3 min: {(l.texts || [])[0]} ({simStr})
                    </button>
                  );
                })}
                {simulatedTime && (
                  <button
                    onClick={() => setSimulatedTime(null)}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold text-[11px]"
                  >
                    Återställ till realtid
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
