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
  Moon,
  Sun,
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
  
  // Dark mode state: default to dark for projector use
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);

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

  // Load saved theme preference (default to dark for classroom projector)
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem("lessonClockTheme");
      if (savedTheme !== null) {
        setIsDarkMode(savedTheme === "dark");
      } else {
        setIsDarkMode(true);
      }
    } catch (e) {
      setIsDarkMode(true);
    }
  }, []);

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("lessonClockTheme", next ? "dark" : "light");
      } catch (e) {}
      return next;
    });
  };

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

  // Format digital clock (HH:mm without seconds)
  const clockString = useMemo(() => {
    const d = effectiveDate;
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
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

  if (loading && lessons.length === 0) {
    return (
      <div
        className={`flex flex-col items-center justify-center min-h-screen p-6 transition-colors duration-300 ${
          isDarkMode ? "bg-slate-950 text-slate-200" : "bg-gray-50 text-gray-700"
        }`}
      >
        <RefreshCw className="animate-spin text-blue-500 mb-4" size={40} />
        <h2 className="text-xl font-semibold">Laddar lektionsklocka...</h2>
        <p className={`text-sm mt-1 ${isDarkMode ? "text-slate-400" : "text-gray-500"}`}>
          Hämtar lektioner för schemat
        </p>
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
    <div
      className={`min-h-screen flex flex-col justify-between p-3 sm:p-6 md:p-8 select-none transition-colors duration-300 ${
        isDarkMode
          ? "dark bg-slate-950 text-slate-100"
          : "bg-gradient-to-br from-slate-50 via-white to-blue-50/40 text-slate-800"
      }`}
    >
      {/* Top Header Bar */}
      <header
        className={`flex items-center justify-between gap-2 sm:gap-4 pb-2.5 sm:pb-4 border-b ${
          isDarkMode ? "border-slate-800" : "border-slate-200/80"
        }`}
      >
        <div className="flex items-center space-x-2 min-w-0">
          <div
            className={`p-1.5 sm:p-2 rounded-xl shadow-xs shrink-0 ${
              isDarkMode
                ? "bg-blue-950/80 text-blue-400 border border-blue-800/50"
                : "bg-blue-100 text-blue-600"
            }`}
          >
            <Clock size={20} className="stroke-[2.5]" />
          </div>
          <div className="min-w-0">
            <h1
              className={`text-sm sm:text-base md:text-lg font-bold tracking-tight leading-tight truncate ${
                isDarkMode ? "text-white" : "text-slate-900"
              }`}
            >
              Lektionsklocka
            </h1>
            <p
              className={`text-[11px] sm:text-xs truncate max-w-[140px] sm:max-w-xs md:max-w-md ${
                isDarkMode ? "text-slate-400" : "text-slate-500"
              }`}
            >
              {schemaId ? decodeURIComponent(schemaId) : "Schema"}
              {skola ? ` • ${decodeURIComponent(skola)}` : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
          {/* Dark / Light Mode Toggle */}
          <button
            onClick={toggleDarkMode}
            title={isDarkMode ? "Växla till ljust läge" : "Växla till mörkt läge (projektor)"}
            className={`p-1.5 sm:p-2 rounded-lg border transition-colors shadow-xs ${
              isDarkMode
                ? "bg-slate-900 border-slate-800 hover:bg-slate-800 text-amber-400 hover:text-amber-300"
                : "bg-white border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900"
            }`}
          >
            {isDarkMode ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          {/* Refresh schedule */}
          <button
            onClick={() => loadSchedule()}
            title="Uppdatera schema"
            className={`p-1.5 sm:p-2 rounded-lg border transition-colors shadow-xs ${
              isDarkMode
                ? "bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white"
                : "bg-white border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900"
            }`}
          >
            <RefreshCw size={17} />
          </button>

          {/* Fullscreen toggle */}
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? "Avsluta helskärm" : "Helskärm"}
            className={`p-1.5 sm:p-2 rounded-lg border transition-colors shadow-xs ${
              isDarkMode
                ? "bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white"
                : "bg-white border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900"
            }`}
          >
            {isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center my-auto py-2 sm:py-6 max-w-3xl w-full mx-auto space-y-3 sm:space-y-6 md:space-y-8">
        
        {/* Current Time Section ("Vad klockan är") */}
        <section className="text-center space-y-0.5 sm:space-y-1">
          <div
            className={`text-[clamp(2.5rem,13vw,6rem)] leading-none font-black font-mono tracking-tight tabular-nums drop-shadow-xs ${
              isDarkMode ? "text-white" : "text-slate-900"
            }`}
            aria-label={`Klockan är ${clockString}`}
          >
            {clockString}
          </div>
          <div
            className={`text-[clamp(0.75rem,2.8vw,1rem)] font-medium capitalize tracking-wide ${
              isDarkMode ? "text-slate-400" : "text-slate-500"
            }`}
          >
            {dateString}
          </div>
        </section>

        {/* Lesson Card */}
        {activeLesson ? (
          <section
            className={`w-full rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 shadow-lg border transition-all duration-500 ${
              isLastMinute
                ? isDarkMode
                  ? "bg-rose-950/50 border-rose-500/70 shadow-rose-950/50"
                  : "bg-rose-50/90 border-rose-300 shadow-rose-100"
                : isEndingSoon
                ? isDarkMode
                  ? "bg-amber-950/40 border-amber-500/70 shadow-amber-950/40"
                  : "bg-amber-50/90 border-amber-300 shadow-amber-100"
                : isDarkMode
                ? "bg-slate-900/90 border-slate-800 shadow-slate-950/60"
                : "bg-white border-slate-200/80 shadow-slate-100"
            }`}
          >
            {/* Top section: Lesson Subject on one row, Details & Start-End below */}
            <div className={`border-b pb-2.5 sm:pb-4 ${isDarkMode ? "border-slate-800" : "border-slate-100"}`}>
              {/* Row 1: Subject */}
              <div className="flex items-center space-x-2 sm:space-x-2.5 min-w-0">
                <span
                  className={`inline-block w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full shrink-0 ${
                    isEndingSoon ? "bg-amber-500 animate-ping" : "bg-emerald-500"
                  }`}
                />
                <h2
                  className={`text-[clamp(1.25rem,5.5vw,2.25rem)] leading-tight font-extrabold tracking-tight truncate ${
                    isDarkMode ? "text-white" : "text-slate-900"
                  }`}
                >
                  {lessonSubject}
                </h2>
              </div>

              {/* Row 2: Details and Start-End time (same font size as details) */}
              <div
                className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[clamp(0.75rem,2.8vw,0.875rem)] font-medium mt-1 ml-4.5 sm:ml-5.5 ${
                  isDarkMode ? "text-slate-400" : "text-slate-500"
                }`}
              >
                {lessonDetails && (
                  <>
                    <span className="truncate">{lessonDetails}</span>
                    <span className={isDarkMode ? "text-slate-600" : "text-slate-300"}>•</span>
                  </>
                )}
                <span className="font-mono shrink-0">
                  {formatTimeHM(activeLesson.timeStart)} – {formatTimeHM(activeLesson.timeEnd)}
                </span>
              </div>
            </div>

            {/* Time Remaining Section ("Hur lång tid det är kvar på lektionen") */}
            <div className="my-3 sm:my-6 text-center space-y-1">
              <div
                className={`text-[clamp(0.7rem,2.2vw,0.875rem)] uppercase tracking-wider font-semibold ${
                  isDarkMode ? "text-slate-400" : "text-slate-400"
                }`}
              >
                Tid kvar på lektionen
              </div>
              <div
                className={`text-[clamp(2.75rem,15vw,5.5rem)] leading-none font-black font-mono tracking-tight tabular-nums transition-colors duration-300 ${
                  isLastMinute
                    ? isDarkMode
                      ? "text-rose-400 animate-pulse"
                      : "text-rose-600 animate-pulse"
                    : isEndingSoon
                    ? isDarkMode
                      ? "text-amber-400"
                      : "text-amber-600"
                    : isDarkMode
                    ? "text-blue-400"
                    : "text-blue-600"
                }`}
              >
                {remainingFormatted.mmSS}
              </div>

              {/* Visual 3-minute notice */}
              {isEndingSoon && (
                <div
                  className={`pt-1.5 sm:pt-2 flex items-center justify-center space-x-1.5 text-xs sm:text-sm font-semibold rounded-lg py-1 px-2.5 sm:px-3 mx-auto max-w-fit animate-bounce ${
                    isDarkMode
                      ? "text-amber-300 bg-amber-950/60 border border-amber-800/60"
                      : "text-amber-700 bg-amber-50 border border-amber-200"
                  }`}
                >
                  <AlertTriangle size={15} />
                  <span>
                    {isLastMinute ? "Sista minuten! Avrunda lektionen." : "Mindre än 3 minuter kvar!"}
                  </span>
                </div>
              )}
            </div>

            {/* Progress Bar Section */}
            <div className="space-y-1.5 sm:space-y-2">
              <div
                className={`flex justify-between items-center text-[11px] sm:text-xs font-semibold ${
                  isDarkMode ? "text-slate-400" : "text-slate-500"
                }`}
              >
                <span>Avklarat: {Math.round(progressPercent)}%</span>
                <span className="font-mono">{formatTimeHM(activeLesson.timeEnd)}</span>
              </div>

              {/* Progress bar container */}
              <div
                className={`w-full rounded-full h-4 sm:h-5 md:h-6 p-0.5 overflow-hidden shadow-inner border ${
                  isDarkMode
                    ? "bg-slate-800/80 border-slate-700"
                    : "bg-slate-100 border-slate-200"
                }`}
              >
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
          <section
            className={`w-full rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 shadow-sm border text-center space-y-3 sm:space-y-4 ${
              isDarkMode
                ? "bg-slate-900/90 border-slate-800"
                : "bg-white border-slate-200/80"
            }`}
          >
            {status.isBreak && status.nextLesson ? (
              <div className="space-y-3">
                <div
                  className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-semibold ${
                    isDarkMode
                      ? "bg-amber-950/70 text-amber-300 border border-amber-800/60"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  <Coffee size={15} />
                  <span>Rast just nu</span>
                </div>
                <h2
                  className={`text-[clamp(1.25rem,5vw,2rem)] leading-tight font-bold ${
                    isDarkMode ? "text-white" : "text-slate-800"
                  }`}
                >
                  Ingen lektion för tillfället
                </h2>
                <div
                  className={`p-3 sm:p-4 rounded-xl border inline-block text-left max-w-md w-full ${
                    isDarkMode
                      ? "bg-slate-800/50 border-slate-700/80"
                      : "bg-slate-50 border-slate-100"
                  }`}
                >
                  <div className="text-xs uppercase tracking-wider font-semibold text-slate-400 mb-1">
                    Nästa lektion
                  </div>
                  <div className="flex justify-between items-baseline gap-2">
                    <span
                      className={`font-bold text-base sm:text-lg ${
                        isDarkMode ? "text-white" : "text-slate-900"
                      }`}
                    >
                      {(status.nextLesson.texts || [])[0] || "Lektion"}
                    </span>
                    <span
                      className={`text-xs font-mono px-2 py-0.5 rounded border ${
                        isDarkMode
                          ? "bg-slate-900 border-slate-700 text-slate-300"
                          : "bg-white border-slate-200 text-slate-600"
                      }`}
                    >
                      {formatTimeHM(status.nextLesson.timeStart)} – {formatTimeHM(status.nextLesson.timeEnd)}
                    </span>
                  </div>
                  <div
                    className={`text-sm font-semibold mt-2 ${
                      isDarkMode ? "text-blue-400" : "text-blue-600"
                    }`}
                  >
                    Börjar om {formatRemainingTime(status.timeUntilNextLessonSeconds).formattedText}
                  </div>
                </div>
              </div>
            ) : status.isBeforeSchoolDay && status.nextLesson ? (
              <div className="space-y-3">
                <div
                  className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-semibold ${
                    isDarkMode
                      ? "bg-blue-950/70 text-blue-300 border border-blue-800/60"
                      : "bg-blue-100 text-blue-800"
                  }`}
                >
                  <Calendar size={15} />
                  <span>Före skoldagens start</span>
                </div>
                <h2
                  className={`text-[clamp(1.25rem,5vw,2rem)] leading-tight font-bold ${
                    isDarkMode ? "text-white" : "text-slate-800"
                  }`}
                >
                  Första lektionen börjar kl. {formatTimeHM(status.nextLesson.timeStart)}
                </h2>
                <p className={isDarkMode ? "text-slate-400" : "text-slate-600"}>
                  <span className={`font-bold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                    {(status.nextLesson.texts || [])[0]}
                  </span>{" "}
                  (börjar om {formatRemainingTime(status.timeUntilNextLessonSeconds).formattedText})
                </p>
              </div>
            ) : status.isDayFinished ? (
              <div className="space-y-3">
                <div
                  className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-semibold ${
                    isDarkMode
                      ? "bg-emerald-950/70 text-emerald-300 border border-emerald-800/60"
                      : "bg-emerald-100 text-emerald-800"
                  }`}
                >
                  <CheckCircle2 size={15} />
                  <span>Dagens lektioner är slut</span>
                </div>
                <h2
                  className={`text-[clamp(1.25rem,5vw,2rem)] leading-tight font-bold ${
                    isDarkMode ? "text-white" : "text-slate-800"
                  }`}
                >
                  Alla dagens lektioner är avklarade!
                </h2>
                <p className={`text-sm ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                  Ha en trevlig eftermiddag/kväll.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <h2
                  className={`text-xl font-bold ${
                    isDarkMode ? "text-white" : "text-slate-800"
                  }`}
                >
                  Inga lektioner inlagda idag
                </h2>
                <p className={`text-sm ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                  Det finns inga schemalagda lektioner för denna dag.
                </p>
              </div>
            )}
          </section>
        )}

        {/* Small overview of today's schedule */}
        {status.todaysLessons.length > 0 && (
          <section
            className={`w-full rounded-xl p-3 sm:p-4 border shadow-xs ${
              isDarkMode
                ? "bg-slate-900/60 border-slate-800/80"
                : "bg-white/70 backdrop-blur-xs border-slate-200/60"
            }`}
          >
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Dagens lektioner ({status.todaysLessons.length} st)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 sm:gap-2">
              {status.todaysLessons.map((l, i) => {
                const isActive = activeLesson?.guidId === l.guidId || activeLesson === l;
                const endSec = parseTimeToSeconds(l.timeEnd);
                const currSec =
                  effectiveDate.getHours() * 3600 +
                  effectiveDate.getMinutes() * 60 +
                  effectiveDate.getSeconds();
                const isPassed = currSec >= endSec;

                return (
                  <div
                    key={l.guidId || i}
                    className={`p-1.5 sm:p-2.5 rounded-lg border text-[11px] sm:text-xs flex justify-between items-center transition-all ${
                      isActive
                        ? isDarkMode
                          ? "bg-blue-950/80 border-blue-700 text-blue-200 font-semibold shadow-xs"
                          : "bg-blue-50 border-blue-300 text-blue-900 font-semibold shadow-xs"
                        : isPassed
                        ? isDarkMode
                          ? "bg-slate-950/40 border-slate-850 text-slate-600 line-through decoration-slate-600"
                          : "bg-slate-50/50 border-slate-100 text-slate-400 line-through decoration-slate-300"
                        : isDarkMode
                        ? "bg-slate-900/90 border-slate-800 text-slate-300"
                        : "bg-white border-slate-200/80 text-slate-700"
                    }`}
                  >
                    <span className="truncate pr-1">{(l.texts || [])[0]}</span>
                    <span className="font-mono text-[10px] sm:text-[11px] opacity-75 shrink-0">
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
      <footer
        className={`pt-4 border-t text-center ${
          isDarkMode ? "border-slate-800/80" : "border-slate-200/70"
        }`}
      >
        <div className="inline-block">
          <button
            onClick={() => setShowSimControls(!showSimControls)}
            className={`text-xs inline-flex items-center space-x-1 py-1 px-2 rounded transition-colors ${
              isDarkMode
                ? "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
            }`}
          >
            <Sparkles size={13} />
            <span>Testa &amp; simulera lektionsklockan</span>
            {showSimControls ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          {showSimControls && (
            <div
              className={`mt-2 p-3 border rounded-xl shadow-sm text-xs space-y-2 text-left max-w-md mx-auto ${
                isDarkMode
                  ? "bg-slate-900 border-slate-800 text-slate-300"
                  : "bg-white border-slate-200 text-slate-700"
              }`}
            >
              <div
                className={`font-semibold ${
                  isDarkMode ? "text-slate-200" : "text-slate-700"
                }`}
              >
                Simulering för demonstration / test:
              </div>
              <p
                className={`text-[11px] ${
                  isDarkMode ? "text-slate-400" : "text-slate-500"
                }`}
              >
                Testa vad som visas vid olika tider på dagen, t.ex. när det är 2 minuter kvar på en lektion.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {status.todaysLessons.slice(0, 3).map((l, idx) => {
                  const [endH, endM] = l.timeEnd.split(":").map(Number);
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
                      className={`px-2 py-1 rounded font-mono text-[11px] border transition-colors ${
                        isDarkMode
                          ? "bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 border-amber-800/70"
                          : "bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200"
                      }`}
                    >
                      Testa &lt; 3 min: {(l.texts || [])[0]} ({simStr})
                    </button>
                  );
                })}
                {simulatedTime && (
                  <button
                    onClick={() => setSimulatedTime(null)}
                    className={`px-2 py-1 rounded font-semibold text-[11px] transition-colors ${
                      isDarkMode
                        ? "bg-slate-800 hover:bg-slate-700 text-slate-200"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                    }`}
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
