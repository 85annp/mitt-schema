import { Suspense } from "react";
import SearchForm from "@/components/SearchForm";
import ScheduleViewer from "@/components/ScheduleViewer";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const kommun = typeof params.kommun === "string" ? params.kommun : "";
  const skola = typeof params.skola === "string" ? params.skola : "";
  const id = typeof params.id === "string" ? params.id : "";
  const unitGuid = typeof params.unitGuid === "string" ? params.unitGuid : "";

  const hasSelection = kommun && skola && id;

  return (
    <main className="min-h-screen bg-gray-50 p-4 font-sans text-gray-900">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="print:hidden flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <h1 className="text-xl font-bold tracking-tight text-blue-600">Mitt schema</h1>
          {hasSelection && (
            <a href="/" className="text-sm text-gray-500 hover:text-gray-900 underline">
              Ny sökning
            </a>
          )}
        </header>

        {hasSelection ? (
          <Suspense fallback={<div className="p-8 text-center animate-pulse">Laddar schema...</div>}>
            <ScheduleViewer kommun={kommun} skola={skola} schemaId={id} unitGuid={unitGuid} />
          </Suspense>
        ) : (
          <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 max-w-lg mx-auto">
            <h2 className="text-lg font-medium mb-4">Sök fram ditt schema</h2>
            <SearchForm />
          </section>
        )}
      </div>
    </main>
  );
}

