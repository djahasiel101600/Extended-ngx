import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {
  ColumnDefMeta,
  CustomField,
  Document,
  DocumentType,
  ExportOptions,
} from '@/types';

export interface ExportContext {
  customFields: CustomField[];
  documentTypes: DocumentType[];
  defs: ColumnDefMeta[];
  /** Human-readable summary of applied filters, printed on the PDF header. */
  filterSummary?: string;
}

/** Resolve a document's raw, typed value for a given column id. */
function resolveRaw(doc: Document, id: string, ctx: ExportContext): unknown {
  switch (id) {
    case 'id':
      return doc.id;
    case 'title':
      return doc.title;
    case 'content':
      return doc.content;
    case 'created':
      return doc.created;
    case 'owner':
      return doc.owner;
    case 'document_type':
      return ctx.documentTypes.find((t) => t.id === doc.document_type)?.name ?? '';
    default: {
      if (id.startsWith('cf_')) {
        const fieldId = Number(id.slice(3));
        const entry = doc.custom_fields.find((cf) => cf.field === fieldId);
        if (!entry || entry.value === null || entry.value === undefined) return '';
        const meta = ctx.customFields.find((f) => f.id === fieldId);
        if (!meta) return entry.value;
        if (meta.data_type === 'select') {
          const opt = meta.extra_data?.select_options?.find(
            (o) => String(o.id) === String(entry.value),
          );
          return opt?.label ?? String(entry.value);
        }
        if (meta.data_type === 'boolean') return entry.value;
        if (
          meta.data_type === 'monetary' ||
          meta.data_type === 'integer' ||
          meta.data_type === 'float'
        ) {
          const n = parseFloat(String(entry.value).replace(/[^\d.-]/g, ''));
          return isNaN(n) ? entry.value : n;
        }
        return entry.value;
      }
      return '';
    }
  }
}

function dataTypeFor(id: string, ctx: ExportContext): CustomField['data_type'] | undefined {
  if (!id.startsWith('cf_')) return undefined;
  const fieldId = Number(id.slice(3));
  return ctx.customFields.find((f) => f.id === fieldId)?.data_type;
}

const labelFor = (id: string, ctx: ExportContext): string =>
  ctx.defs.find((d) => d.id === id)?.label ?? id;

/** RFC-4180 quoting: wrap when the value contains a delimiter, quote, or newline. */
function escapeCSV(value: string): string {
  const s = value ?? '';
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvCell(id: string, raw: unknown, ctx: ExportContext): string {
  if (raw === null || raw === undefined) return '';
  if (typeof raw === 'boolean') return raw ? 'Yes' : 'No';
  // Numbers and ISO date strings pass through unformatted so downstream tools
  // can parse them without locale-specific cleanup.
  void dataTypeFor(id, ctx);
  return String(raw);
}

/** Type-aware, human-readable cell used for the PDF table. */
function pdfCell(id: string, raw: unknown, ctx: ExportContext): string {
  if (raw === null || raw === undefined || raw === '') return '';
  const dt = dataTypeFor(id, ctx);
  if (id === 'created') {
    const d = new Date(String(raw));
    return isNaN(d.getTime()) ? String(raw) : format(d, 'yyyy-MM-dd');
  }
  if (dt === 'monetary' && typeof raw === 'number') {
    return `$${raw.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  }
  if (dt === 'date') {
    const d = new Date(String(raw));
    return isNaN(d.getTime()) ? String(raw) : format(d, 'yyyy-MM-dd');
  }
  if (typeof raw === 'boolean' || dt === 'boolean') return raw ? 'Yes' : 'No';
  return String(raw);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function timestamp(): string {
  return format(new Date(), 'yyyy-MM-dd-HHmmss');
}

function effectiveColumnIds(opts: ExportOptions): string[] {
  // `content` (full OCR text) is only emitted when explicitly requested, so
  // default exports stay lightweight and focused on structured fields.
  return opts.includeContent
    ? opts.columnIds
    : opts.columnIds.filter((id) => id !== 'content');
}

/**
 * Build and download the export in the requested format. Kept fully synchronous
 * against the provided `docs` array — fetching "all filtered pages" is the
 * caller's responsibility so this module stays free of network/React concerns.
 */
export function runExport(docs: Document[], opts: ExportOptions, ctx: ExportContext): void {
  const columnIds = effectiveColumnIds(opts);
  const headers = columnIds.map((id) => labelFor(id, ctx));

  if (opts.format === 'json') {
    const records = docs.map((doc) => {
      const rec: Record<string, unknown> = {};
      columnIds.forEach((id) => {
        rec[labelFor(id, ctx)] = resolveRaw(doc, id, ctx);
      });
      return rec;
    });
    const json = JSON.stringify(records, null, 2);
    downloadBlob(
      new Blob([json], { type: 'application/json;charset=utf-8;' }),
      `paperless-export-${timestamp()}.json`,
    );
    return;
  }

  if (opts.format === 'csv') {
    const lines = [headers.map(escapeCSV).join(',')];
    docs.forEach((doc) => {
      const cells = columnIds.map((id) =>
        escapeCSV(csvCell(id, resolveRaw(doc, id, ctx), ctx)),
      );
      lines.push(cells.join(','));
    });
    // CRLF + BOM for maximum compatibility with Excel.
    const csv = '\uFEFF' + lines.join('\r\n');
    downloadBlob(
      new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
      `paperless-export-${timestamp()}.csv`,
    );
    return;
  }

  // PDF report
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const marginX = 36;
  let top = 40;
  pdf.setFontSize(15);
  pdf.text('Paperless-ngx Data Report', marginX, top);
  top += 18;
  pdf.setFontSize(9);
  pdf.setTextColor(110);
  pdf.text(`Generated ${format(new Date(), 'yyyy-MM-dd HH:mm')}`, marginX, top);
  top += 13;
  pdf.text(`Rows: ${docs.length}`, marginX, top);
  if (ctx.filterSummary) {
    top += 13;
    const summary = pdf.splitTextToSize(`Filters: ${ctx.filterSummary}`, 720);
    pdf.text(summary, marginX, top);
    top += summary.length * 11;
  }
  pdf.setTextColor(0);

  const body = docs.map((doc) =>
    columnIds.map((id) => pdfCell(id, resolveRaw(doc, id, ctx), ctx)),
  );

  autoTable(pdf, {
    head: [headers],
    body,
    startY: top + 8,
    styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
    headStyles: { fillColor: [35, 128, 120], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 247] },
    margin: { left: marginX, right: marginX },
  });

  pdf.save(`paperless-report-${timestamp()}.pdf`);
}
