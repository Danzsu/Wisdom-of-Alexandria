import { ExportScreen } from "@/components/export";

/**
 * Export route — Import / Export tabs. Markdown export is REAL (wired to
 * POST /books/{id}/exports → browser download with an ASCII-folded filename);
 * DOCX/EPUB/PDF/TXT + Import are V1/V2 stubs (M8). The route param `bookId` is
 * read inside the client {@link ExportScreen}.
 */
export default function ExportPage() {
  return <ExportScreen />;
}
