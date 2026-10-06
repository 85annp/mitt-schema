"use client";

import { useEffect, useState, useMemo } from "react";
import { getWeeklySchedule } from "@/app/actions";
import { LayoutGrid, List as ListIcon, Settings, Printer, Clock } from "lucide-react";
import ColorSettings from "./ColorSettings";
import { isRealLesson } from "@/utils/lessonClockUtils";

interface ScheduleViewerProps {
  kommun: string;
  skola: string;
  schemaId: string;
  unitGuid: string;
}

export default function ScheduleViewer({ kommun, skola, schemaId, unitGuid }: ScheduleViewerProps) {
  const [lessons, setLessons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showSettings, setShowSettings] = useState(false);
  
  const [colors, setColors] = useState<Record<string, string>>({});

  const [currentWeek, setCurrentWeek] = useState<number | undefined>();
  const [currentYear, setCurrentYear] = useState<number | undefined>();

  useEffect(() => {
    // Load saved colors
    const saved = localStorage.getItem("scheduleColors");
    if (saved) {
      try {
        setColors(JSON.parse(saved));
      } catch (e) {}
    }

    const fetchSchedule = async () => {
      setLoading(true);
      const res = await getWeeklySchedule(kommun, unitGuid, schemaId, currentYear, currentWeek);
      if (res.success) {
        setLessons(res.timetable);
        if (res.week) setCurrentWeek(res.week);
        if (res.year) setCurrentYear(res.year);
      }
      setLoading(false);
    };
    fetchSchedule();
  }, [kommun, unitGuid, schemaId, currentWeek, currentYear]);

  const uniqueSubjects = useMemo(() => {
    const subjects = new Set<string>();
    lessons.forEach(l => {
      if (!isRealLesson(l)) return;
      const name = (l.texts || [])[0] || "";
      const group = (l.texts || []).length > 1 ? (l.texts || [])[1] : "";
      if (name) {
        subjects.add(group ? `${name} (${group})` : name);
      }
    });
    return Array.from(subjects).sort((a, b) => a.localeCompare(b));
  }, [lessons]);

  const handleColorChange = (subject: string, color: string) => {
    const newColors = { ...colors, [subject]: color };
    setColors(newColors);
    localStorage.setItem("scheduleColors", JSON.stringify(newColors));
  };

  const handleOpenClockWindow = () => {
    // Cache current lessons in localStorage for immediate display in the new window
    if (lessons && lessons.length > 0) {
      try {
        localStorage.setItem("mittSchemaLessons", JSON.stringify(lessons));
      } catch (e) {
        console.error(e);
      }
    }

    const params = new URLSearchParams();
    if (kommun) params.set("kommun", kommun);
    if (skola) params.set("skola", skola);
    if (schemaId) params.set("id", schemaId);
    if (unitGuid) params.set("unitGuid", unitGuid);

    const url = `/klocka?${params.toString()}`;
    const windowFeatures = "width=720,height=640,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes";
    const newWindow = window.open(url, "mittSchemaLektionsklocka", windowFeatures);
    if (!newWindow) {
      // Fallback if popup blocker intercepted
      window.open(url, "_blank");
    }
  };

  if (loading) {
    return <div className="p-8 text-center animate-pulse">Laddar schema...</div>;
  }

  const hslToHex = (h: number, s: number, l: number) => {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  };

  const getDeterministicColor = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash) % 360;
    return hslToHex(h, 70, 85);
  };

  if (lessons.length === 0) {
    return <div className="p-8 text-center text-red-500">Kunde inte hitta några lektioner för denna vecka.</div>;
  }

  const getLessonColor = (lesson: any) => {
    const name = (lesson.texts || [])[0] || "Okänd";
    const group = (lesson.texts || []).length > 1 ? (lesson.texts || [])[1] : "";
    const key = group ? `${name} (${group})` : name;
    return colors[key] || getDeterministicColor(key);
  };

  const getTextColor = (bgColor: string) => {
    if (!bgColor) return "#000000";
    const hex = bgColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? '#000000' : '#ffffff';
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return "";
    return timeStr.split(":").slice(0, 2).join(":");
  };

  // Group lessons by day (1 = Monday, 5 = Friday)
  const days = [1, 2, 3, 4, 5];
  const dayNames = ["Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag"];

  return (
    <div className="space-y-4">
      {/* Print-only Header */}
      <div className="hidden print:block text-center mb-6">
        <h1 className="text-2xl font-bold">
          Schema: {decodeURIComponent(schemaId)}
        </h1>
        <p className="text-gray-600 text-lg">
          {decodeURIComponent(skola)} ({decodeURIComponent(kommun)}) • Vecka {currentWeek || ""}
        </p>
      </div>

      <div className="print:hidden flex justify-between items-center bg-white p-2 rounded-xl shadow-sm border border-gray-100 flex-wrap gap-2">
        <div className="flex space-x-2">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-2 rounded-lg flex items-center space-x-1 ${viewMode === "grid" ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100"}`}
          >
            <LayoutGrid size={18} />
            <span className="hidden sm:inline">Rutnät</span>
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-2 rounded-lg flex items-center space-x-1 ${viewMode === "list" ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100"}`}
          >
            <ListIcon size={18} />
            <span className="hidden sm:inline">Lista</span>
          </button>
        </div>
        
        {currentWeek && (
          <div className="flex items-center space-x-3 font-semibold">
            <button 
              onClick={() => setCurrentWeek(currentWeek - 1)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              &lt;
            </button>
            <span>Vecka {currentWeek}</span>
            <button 
              onClick={() => setCurrentWeek(currentWeek + 1)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              &gt;
            </button>
          </div>
        )}

        <div className="flex space-x-2">
          <button
            onClick={handleOpenClockWindow}
            title="Öppna lektionsklocka i ett nytt fönster"
            className="p-2 rounded-lg flex items-center space-x-1 hover:bg-blue-50 text-blue-700 font-medium border border-blue-200 transition-colors"
          >
            <Clock size={18} />
            <span className="hidden sm:inline">Lektionsklocka</span>
          </button>
          <button
            onClick={() => window.print()}
            className="p-2 rounded-lg flex items-center space-x-1 hover:bg-gray-100"
          >
            <Printer size={18} />
            <span className="hidden sm:inline">Skriv ut</span>
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-lg flex items-center space-x-1 ${showSettings ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100"}`}
          >
            <Settings size={18} />
            <span className="hidden sm:inline">Färginställningar</span>
          </button>
        </div>
      </div>

      {showSettings && (
        <ColorSettings subjects={uniqueSubjects} colors={colors} onChange={handleColorChange} />
      )}

      {viewMode === "grid" ? (
        <div className="grid grid-cols-5 gap-2 bg-white p-4 rounded-xl shadow-sm border border-gray-100 overflow-x-auto min-w-[700px]">
          {days.map((day, idx) => (
            <div key={day} className="flex flex-col space-y-2">
              <h3 className="font-bold text-center border-b pb-2">{dayNames[idx]}</h3>
              <div className="relative h-[900px]">
                {lessons
                  .filter((l) => l.dayOfWeekNumber === day)
                  .sort((a, b) => {
                    const getDuration = (lesson: any) => {
                      const [startH, startM] = lesson.timeStart.split(":").map(Number);
                      const [endH, endM] = lesson.timeEnd.split(":").map(Number);
                      return (endH * 60 + endM) - (startH * 60 + startM);
                    };
                    return getDuration(b) - getDuration(a); // Longest first (so they render in the background)
                  })
                  .map((lesson, i) => {
                    const bgColor = getLessonColor(lesson);
                    const textColor = getTextColor(bgColor);
                    
                    // Simple height/top calculation based on time
                    const [startH, startM] = lesson.timeStart.split(":").map(Number);
                    const [endH, endM] = lesson.timeEnd.split(":").map(Number);
                    
                    // Assume schedule starts at 07:00 (420 minutes) to avoid missing early lessons
                    const scheduleStartMinutes = 7 * 60;
                    const startMinutes = (startH * 60 + startM) - scheduleStartMinutes;
                    const endMinutes = (endH * 60 + endM) - scheduleStartMinutes;
                    const duration = Math.max(endMinutes - startMinutes, 10); // at least 10px height
                    
                    // 1 minute = 1.5px (just to scale nicely)
                    const scale = 1.5;

                    return (
                      <div
                        key={lesson.guidId}
                        className="absolute w-full rounded-md p-1 text-xs shadow-sm overflow-hidden opacity-95 hover:opacity-100 hover:z-10 transition-all border border-white cursor-default"
                        style={{
                          top: `${Math.max(startMinutes * scale, 0)}px`,
                          height: `${duration * scale}px`,
                          backgroundColor: bgColor,
                          color: textColor,
                          WebkitPrintColorAdjust: "exact",
                          printColorAdjust: "exact"
                        }}
                      >
                        <div className="font-semibold truncate">{(lesson.texts || [])[0]}</div>
                        {(lesson.texts || []).slice(1).map((t: string, ti: number) => (
                          <div key={ti} className="truncate opacity-90 text-[10px]">{t}</div>
                        ))}
                        <div className="absolute bottom-1 right-1 opacity-75 text-[9px]">
                          {formatTime(lesson.timeStart)}-{formatTime(lesson.timeEnd)}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {days.map((day, idx) => {
            const dayLessons = lessons
              .filter((l) => l.dayOfWeekNumber === day)
              .sort((a, b) => a.timeStart.localeCompare(b.timeStart));
              
            if (dayLessons.length === 0) return null;

            return (
              <div key={day} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-lg border-b pb-2 mb-3">{dayNames[idx]}</h3>
                <div className="space-y-2">
                  {dayLessons.map((lesson) => {
                    const bgColor = getLessonColor(lesson);
                    const textColor = getTextColor(bgColor);

                    return (
                      <div
                        key={lesson.guidId}
                        className="flex justify-between items-center p-3 rounded-lg shadow-sm"
                        style={{ 
                          backgroundColor: bgColor, 
                          color: textColor,
                          WebkitPrintColorAdjust: "exact",
                          printColorAdjust: "exact"
                        }}
                      >
                        <div>
                          <div className="font-bold">{(lesson.texts || [])[0]}</div>
                          <div className="text-sm opacity-90">{(lesson.texts || []).slice(1).join(" • ")}</div>
                        </div>
                        <div className="font-mono text-sm opacity-80">
                          {formatTime(lesson.timeStart)} - {formatTime(lesson.timeEnd)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

