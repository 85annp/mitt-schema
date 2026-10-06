import { Suspense } from "react";
import LessonClockView from "@/components/LessonClockView";

export const metadata = {
  title: "Lektionsklocka | Mitt schema",
  description: "Visar nuvarande lektion, återstående tid och progressbar för lektionen.",
};

export default async function ClockPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const kommun = typeof params.kommun === "string" ? params.kommun : "";
  const skola = typeof params.skola === "string" ? params.skola : "";
  const id = typeof params.id === "string" ? params.id : "";
  const unitGuid = typeof params.unitGuid === "string" ? params.unitGuid : "";

  return (
    <main className="min-h-screen">
      <Suspense fallback={<div className="p-8 text-center animate-pulse">Laddar lektionsklocka...</div>}>
        <LessonClockView
          kommun={kommun}
          skola={skola}
          schemaId={id}
          unitGuid={unitGuid}
        />
      </Suspense>
    </main>
  );
}
