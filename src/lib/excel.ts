"use client";

/**
 * Styled Excel exports (RP-6). Every download in the app goes through here so they all share one look:
 * the data table starting in row 1 (as a plain export), an orange frozen header with filters, aligned and formatted values,
 * status colours that match the app, banded rows and a bold totals row.
 */

export type CellType = "text" | "money" | "number" | "percent" | "date" | "datetime" | "status";
export type ExcelColumn = { header: string; key: string; type?: CellType | ((row: ExcelRow) => CellType); width?: number };
export type ExcelRow = Record<string, unknown>;
export type ExcelSheet = {
  name: string;
  title: string;
  columns: ExcelColumn[];
  rows: ExcelRow[];
  /** Optional totals row, keyed like the rows. The first column reads "Total" unless given. */
  totals?: ExcelRow;
  note?: string;
};
export type ExcelMeta = { period?: string; exportedBy?: string };

const brand = "FFF7941D";
const ink = "FF1F1A14";
const muted = "FF7A7268";
const line = "FFE8E3DA";
const band = "FFFBFAF7";
const totalFill = "FFF6EFE4";
const font = "Poppins";

const statusTones: [RegExp, { fill: string; color: string }][] = [
  [/^(paid|completed|delivered|approved|resolved|customer|handed off|with operations|yes)$/i, { fill: "FFE3F4EA", color: "FF1E7A46" }],
  [/^(overdue|exception|open|lost|not interested|rejected|cancelled|returned)$/i, { fill: "FFFBE4E8", color: "FFA5183F" }],
  [/^(sent|pending|submitted|booked|carrier assigned|picked up|in transit|quoted|contacted|qualified)$/i, { fill: "FFE6F0FB", color: "FF22548F" }],
  [/^(draft|new|not invoiced|unassigned)$/i, { fill: "FFF1EEE8", color: "FF5E574D" }],
];

const humanize = (value: string) => /^[A-Z_]+$/.test(value) ? value.charAt(0) + value.slice(1).toLowerCase().replaceAll("_", " ") : value;

/** Excel dates have no time zone, so write the wall-clock date and time the user sees. */
function toDate(value: unknown) {
  if (typeof value !== "string" && !(value instanceof Date)) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
}

function cellValue(value: unknown, type: CellType) {
  if (value === null || value === undefined || value === "") return null;
  if (type === "money" || type === "number" || type === "percent") {
    const number = Number(value);
    return Number.isFinite(number) ? (type === "percent" ? number / 100 : number) : String(value);
  }
  if (type === "date" || type === "datetime") return toDate(value) ?? String(value);
  if (type === "status") return humanize(String(value));
  return typeof value === "number" ? value : String(value);
}

const formats: Partial<Record<CellType, string>> = { money: '"$"#,##0.00;[Red]-"$"#,##0.00', number: "#,##0", percent: "0.00%", date: "dd mmm yyyy", datetime: "dd mmm yyyy hh:mm" };

/** Builds the workbook and downloads it as `${fileName}.xlsx`. ExcelJS loads only when someone exports. */
export async function downloadExcel(fileName: string, sheets: ExcelSheet[], meta: ExcelMeta = {}) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "DEBOSS GLOBAL";
  workbook.created = new Date();

  for (const sheet of sheets) {
    const width = Math.max(sheet.columns.length, 2);
    const ws = workbook.addWorksheet(sheet.name.slice(0, 31).replace(/[\\/?*[\]:]/g, " "), {
      views: [{ state: "frozen", ySplit: 1, showGridLines: false }],
      pageSetup: { orientation: sheet.columns.length > 6 ? "landscape" : "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 } },
      // The data starts at row 1 like a plain export; who/when/period go in the printed header instead.
      headerFooter: { oddHeader: `&L&9&B${sheet.title}&R&8${[meta.period, meta.exportedBy ? `Exported by ${meta.exportedBy}` : "", new Date().toLocaleDateString()].filter(Boolean).join(" · ")}`, oddFooter: "&L&8DEBOSS GLOBAL&R&8Page &P of &N" },
    });

    // Header row.
    const header = ws.getRow(1);
    sheet.columns.forEach((column, index) => {
      const cell = header.getCell(index + 1);
      cell.value = column.header;
      cell.font = { name: font, size: 10, bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: brand } };
      cell.alignment = { vertical: "middle", horizontal: typeOf(column) === "text" || typeOf(column) === "status" ? "left" : "right", wrapText: true, indent: 1 };
      cell.border = { bottom: { style: "medium", color: { argb: "FFD97A0B" } } };
    });
    header.height = 26;

    // Data rows.
    sheet.rows.forEach((row, rowIndex) => {
      const excelRow = ws.getRow(2 + rowIndex);
      sheet.columns.forEach((column, index) => {
        const type = typeof column.type === "function" ? column.type(row) : column.type ?? "text";
        const cell = excelRow.getCell(index + 1);
        cell.value = cellValue(row[column.key], type) as never;
        cell.font = { name: font, size: 10, color: { argb: ink }, bold: index === 0 };
        cell.alignment = { vertical: "middle", horizontal: type === "text" || type === "status" ? "left" : "right", indent: 1, wrapText: type === "text" };
        if (formats[type]) cell.numFmt = formats[type]!;
        cell.border = { bottom: { style: "thin", color: { argb: line } } };
        if (rowIndex % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: band } };
        if (type === "status" && cell.value) {
          const tone = statusTones.find(([pattern]) => pattern.test(String(cell.value)))?.[1];
          if (tone) { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: tone.fill } }; cell.font = { name: font, size: 10, bold: true, color: { argb: tone.color } }; }
        }
        if (type === "money" && typeof cell.value === "number" && /outstanding|owed/i.test(column.header) && cell.value > 0) cell.font = { name: font, size: 10, bold: true, color: { argb: "FFA5183F" } };
      });
      excelRow.height = 20;
    });

    if (!sheet.rows.length) {
      ws.mergeCells(2, 1, 2, width);
      const empty = ws.getCell(2, 1);
      empty.value = "No records in this period.";
      empty.font = { name: font, size: 10, italic: true, color: { argb: muted } };
      empty.alignment = { horizontal: "center" };
    }

    // Totals row.
    if (sheet.totals && sheet.rows.length) {
      const totals = ws.getRow(2 + sheet.rows.length);
      sheet.columns.forEach((column, index) => {
        const type = typeof column.type === "function" ? "text" : column.type ?? "text";
        const cell = totals.getCell(index + 1);
        const raw = index === 0 ? sheet.totals![column.key] ?? "Total" : sheet.totals![column.key];
        cell.value = (index === 0 ? raw : cellValue(raw, type)) as never;
        cell.font = { name: font, size: 10, bold: true, color: { argb: ink } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: totalFill } };
        cell.alignment = { vertical: "middle", horizontal: index === 0 || type === "text" ? "left" : "right", indent: 1 };
        if (formats[type]) cell.numFmt = formats[type]!;
        cell.border = { top: { style: "medium", color: { argb: brand } }, bottom: { style: "medium", color: { argb: brand } } };
      });
      totals.height = 22;
    }

    if (sheet.rows.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1 + sheet.rows.length, column: sheet.columns.length } };

    // Column widths fit the content (within sensible limits).
    sheet.columns.forEach((column, index) => {
      const type = typeOf(column);
      const longest = Math.max(column.header.length, ...sheet.rows.map((row) => display(row[column.key], type).length));
      ws.getColumn(index + 1).width = column.width ?? Math.min(48, Math.max(type === "money" ? 14 : 10, longest + 4));
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileName.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "")}.xlsx`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function typeOf(column: ExcelColumn): CellType {
  return typeof column.type === "function" ? "text" : column.type ?? "text";
}

function display(value: unknown, type: CellType) {
  if (value === null || value === undefined) return "";
  if (type === "money") return `$${Number(value).toLocaleString()}.00`;
  if (type === "date") return "00 Mmm 0000";
  if (type === "datetime") return "00 Mmm 0000 00:00";
  return String(value);
}

/** "1 Oct 2026 – 19 Oct 2026", or "All time" when the range is open. */
export function periodLabel(from?: string, to?: string) {
  const day = (value?: string) => value ? new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "";
  if (!from && !to) return "All time";
  return `${day(from) || "Start"} – ${day(to) || "Today"}`;
}
