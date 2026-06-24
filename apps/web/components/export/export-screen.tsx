"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Spinner } from "@/components/kit/spinner";
import { PageHero } from "@/components/kit/page-hero";
import { Tab, TabBar } from "@/components/kit/tab";
import { hu } from "@/lib/i18n/hu";
import { useResolvedBook } from "@/lib/api/export-hooks";
import { ExportTab } from "./export-tab";
import { ImportTab } from "./import-tab";

type IoTab = "export" | "import";

/**
 * Import / Export screen (the `export` route body). Underline tabs switch
 * between the real Markdown EXPORT tab and the V1 IMPORT stub. The book title
 * (for the filename) is resolved from the route `bookId`; load/error states are
 * surfaced honestly (never swallowed).
 */
export function ExportScreen() {
  const params = useParams<{ bookId: string }>();
  const bookId = params?.bookId;

  const [tab, setTab] = useState<IoTab>("export");
  const bookQuery = useResolvedBook(bookId);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-8 py-12">
      <div className="mx-auto max-w-[560px]">
        <PageHero
          eyebrow={hu.exportScreen.eyebrow}
          title={hu.exportScreen.title}
          subtitle={hu.exportScreen.heroSubtitle}
        />

        <TabBar aria-label={hu.exportScreen.title} className="mb-[22px]">
          <Tab active={tab === "export"} onClick={() => setTab("export")}>
            {hu.exportScreen.tabExport}
          </Tab>
          <Tab active={tab === "import"} onClick={() => setTab("import")}>
            {hu.exportScreen.tabImport}
          </Tab>
        </TabBar>

        {tab === "export" ? (
          <ExportBody bookId={bookId} bookQuery={bookQuery} />
        ) : (
          <ImportTab />
        )}
      </div>
    </div>
  );
}

/** EXPORT tab body — gated on the book (title) resolution. */
function ExportBody({
  bookId,
  bookQuery,
}: {
  bookId: string | undefined;
  bookQuery: ReturnType<typeof useResolvedBook>;
}) {
  if (!bookId || bookQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-[13px] text-text-muted">
        <Spinner size={16} />
        {hu.exportScreen.bookLoading}
      </div>
    );
  }

  if (bookQuery.isError || !bookQuery.data) {
    return (
      <div className="py-8 text-[13px] text-danger-text" role="alert">
        {hu.exportScreen.bookError}
        {bookQuery.error ? (
          <span className="mt-1 block text-[12px] text-text-muted">
            {bookQuery.error.message}
          </span>
        ) : null}
      </div>
    );
  }

  return <ExportTab bookId={bookId} title={bookQuery.data.title} />;
}
