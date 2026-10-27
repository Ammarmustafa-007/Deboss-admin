"use client";

import { ChevronLeft, ChevronRight, Lock, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * A light spreadsheet grid: click a cell to edit, Enter or leaving the cell saves, arrow keys move between rows,
 * and pasting a block copied from Excel / Google Sheets adds every pasted line as a new row.
 * Edge buttons scroll sideways for mouse users (Shift + wheel works too).
 */

export type SheetColumn<T> = {
  key: keyof T & string;
  label: string;
  width?: number;
  type?: "text" | "select" | "boolean";
  options?: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
  /** Read-only display instead of an input. */
  render?: (row: T) => ReactNode;
  sticky?: boolean;
};

type Props<T extends { id: string }> = {
  columns: SheetColumn<T>[];
  rows: T[];
  locked: (row: T) => boolean;
  rowTone?: (row: T) => string | undefined;
  onChange: (row: T, key: keyof T & string, value: string | boolean | null) => void;
  onPasteRows?: (rows: Record<string, string>[]) => void;
  onDelete?: (row: T) => void;
  busy?: (row: T) => boolean;
  empty?: ReactNode;
  /** CSS max-height of the scrolling grid (defaults to fitting under a page header). */
  maxHeight?: string;
};

const DEFAULT_WIDTH = 120;
const INDEX_WIDTH = 40;

export function Sheet<T extends { id: string }>({ columns, rows, locked, rowTone, onChange, onPasteRows, onDelete, busy, empty, maxHeight = "calc(100dvh - 330px)" }: Props<T>) {
  const grid = useRef<HTMLTableElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const stickyWidth = INDEX_WIDTH + columns.filter((column) => column.sticky).reduce((sum, column) => sum + (column.width ?? DEFAULT_WIDTH), 0);

  const measure = useCallback(() => {
    const box = scroller.current;
    if (!box) return;
    const left = box.scrollLeft > 4; const right = box.scrollLeft + box.clientWidth < box.scrollWidth - 4;
    setEdges((current) => current.left === left && current.right === right ? current : { left, right });
  }, []);
  useEffect(() => {
    const box = scroller.current;
    if (!box) return;
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    if (grid.current) observer.observe(grid.current);
    return () => observer.disconnect();
  }, [measure]);
  const scrollBy = (direction: 1 | -1) => {
    const box = scroller.current;
    if (box) box.scrollBy({ left: direction * Math.max(240, (box.clientWidth - stickyWidth) * 0.8), behavior: "smooth" });
  };

  const focusCell = (rowIndex: number, columnIndex: number) => {
    const target = grid.current?.querySelector<HTMLElement>(`[data-cell="${rowIndex}:${columnIndex}"]`);
    target?.focus();
  };
  const onKey = (event: KeyboardEvent<HTMLElement>, rowIndex: number, columnIndex: number) => {
    if (event.key === "ArrowDown" || (event.key === "Enter" && !event.shiftKey)) { event.preventDefault(); (event.currentTarget as HTMLElement).blur(); focusCell(rowIndex + 1, columnIndex); }
    if (event.key === "ArrowUp") { event.preventDefault(); (event.currentTarget as HTMLElement).blur(); focusCell(rowIndex - 1, columnIndex); }
    if (event.key === "Escape") (event.currentTarget as HTMLElement).blur();
  };
  // A pasted block (tabs or several lines) becomes new rows, filled from the column you pasted into.
  const onPaste = (event: ClipboardEvent<HTMLElement>, columnIndex: number) => {
    if (!onPasteRows) return;
    const text = event.clipboardData.getData("text/plain");
    if (!text.includes("\t") && !text.trim().includes("\n")) return;
    event.preventDefault();
    const lines = text.replace(/\r/g, "").split("\n").filter((line) => line.trim());
    const editable = columns.filter((column) => !column.render);
    const start = Math.max(0, editable.findIndex((column) => column.key === columns[columnIndex].key));
    onPasteRows(lines.map((line) => Object.fromEntries(line.split("\t").map((value, index) => [editable[start + index]?.key, value.trim()]).filter(([key]) => key))));
  };

  const edgeButton = "absolute top-1/2 z-40 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-line bg-white/95 text-ink shadow-[0_6px_18px_-6px_rgba(31,26,20,.35)] backdrop-blur transition hover:border-brand hover:text-brand-deep active:scale-95 animate-fade";

  return <div className="relative">
    <div ref={scroller} onScroll={measure} className="overflow-auto rounded-[12px] border border-line" style={{ maxHeight, minHeight: 240 }}>
      <table ref={grid} className="border-separate border-spacing-0 text-[12px]" style={{ minWidth: columns.reduce((sum, column) => sum + (column.width ?? DEFAULT_WIDTH), INDEX_WIDTH + (onDelete ? 36 : 0)) }}>
        <thead className="sticky top-0 z-20">
          <tr>
            <th style={{ width: INDEX_WIDTH, minWidth: INDEX_WIDTH, maxWidth: INDEX_WIDTH }} className="sticky left-0 z-30 border-b border-r border-line bg-[#F3EEE6] px-1 py-1.5 text-center text-[10px] font-semibold text-muted">#</th>
            {columns.map((column) => <th key={column.key} style={{ width: column.width ?? DEFAULT_WIDTH, minWidth: column.width ?? DEFAULT_WIDTH, left: column.sticky ? INDEX_WIDTH : undefined }} className={cn("border-b border-r border-line bg-[#F3EEE6] px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-ink/70", column.sticky && "sticky z-30")}>{column.label}{column.required && <span className="text-brand-deep"> *</span>}</th>)}
            {onDelete && <th style={{ width: 36 }} className="border-b border-line bg-[#F3EEE6]" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => {
            const isLocked = locked(row); const pending = busy?.(row);
            return <tr key={row.id} className={cn(rowTone?.(row), pending && "opacity-60", "transition-opacity")}>
              <td style={{ width: INDEX_WIDTH, minWidth: INDEX_WIDTH, maxWidth: INDEX_WIDTH }} className="sticky left-0 z-10 border-b border-r border-line-soft bg-[#FAF8F4] px-1 text-center text-[10px] text-muted">{isLocked ? <Lock size={11} className="mx-auto" /> : rowIndex + 1}</td>
              {columns.map((column, columnIndex) => <td key={column.key} style={{ left: column.sticky ? INDEX_WIDTH : undefined }} className={cn("border-b border-r border-line-soft bg-white p-0", column.sticky && "sticky z-10", isLocked && "bg-[#F7F5F1]")}>
                {column.render ? <div className="px-2 py-1">{column.render(row)}</div>
                  : <Cell column={column} value={row[column.key] as unknown} disabled={isLocked || Boolean(pending)} dataCell={`${rowIndex}:${columnIndex}`}
                      onCommit={(value) => onChange(row, column.key, value)} onKey={(event) => onKey(event, rowIndex, columnIndex)} onPaste={(event) => onPaste(event, columnIndex)} />}
              </td>)}
              {onDelete && <td className="border-b border-line-soft bg-white px-1 text-center">{!isLocked && <button type="button" aria-label="Delete row" onClick={() => onDelete(row)} className="grid h-6 w-6 place-items-center rounded-md text-muted hover:bg-danger/10 hover:text-[#C4254B]"><Trash2 size={12} /></button>}</td>}
            </tr>;
          })}
          {!rows.length && <tr><td colSpan={columns.length + 2} className="px-6 py-12 text-center text-sm text-muted">{empty ?? "No rows yet."}</td></tr>}
        </tbody>
      </table>
    </div>
    {edges.left && <button type="button" aria-label="Scroll left" title="Scroll left" onClick={() => scrollBy(-1)} className={edgeButton} style={{ left: stickyWidth + 6 }}><ChevronLeft size={18} /></button>}
    {edges.right && <button type="button" aria-label="Scroll right" title="Scroll right" onClick={() => scrollBy(1)} className={cn(edgeButton, "right-3")}><ChevronRight size={18} /></button>}
  </div>;
}

function Cell<T>({ column, value, disabled, dataCell, onCommit, onKey, onPaste }: { column: SheetColumn<T>; value: unknown; disabled: boolean; dataCell: string; onCommit: (value: string | boolean | null) => void; onKey: (event: KeyboardEvent<HTMLElement>) => void; onPaste: (event: ClipboardEvent<HTMLElement>) => void }) {
  const original = value === null || value === undefined ? "" : String(value);
  const [draft, setDraft] = useState(original);
  const [editing, setEditing] = useState(false);
  useEffect(() => { if (!editing) setDraft(original); }, [original, editing]); // eslint-disable-line react-hooks/set-state-in-effect
  const base = "h-8 w-full bg-transparent px-2 outline-none focus:bg-brand-tint/50 focus:ring-2 focus:ring-inset focus:ring-brand disabled:cursor-not-allowed disabled:text-ink/60";
  if (column.type === "boolean") return <label className="flex h-8 items-center justify-center"><input data-cell={dataCell} type="checkbox" checked={value === true} disabled={disabled} onKeyDown={onKey} onChange={(event) => onCommit(event.target.checked)} className="h-3.5 w-3.5 accent-[#F7941D]" /></label>;
  if (column.type === "select") return <select data-cell={dataCell} value={original} disabled={disabled} onKeyDown={onKey} onChange={(event) => onCommit(event.target.value || null)} className={cn(base, "cursor-pointer pr-5")}>
    <option value="">{column.placeholder ?? "—"}</option>{column.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
  </select>;
  return <input data-cell={dataCell} value={draft} disabled={disabled} placeholder={column.placeholder} title={draft.length > 18 ? draft : undefined} onFocus={() => setEditing(true)} onChange={(event) => setDraft(event.target.value)} onKeyDown={onKey} onPaste={onPaste}
    onBlur={() => { setEditing(false); if (draft.trim() !== original.trim()) { if (column.required && !draft.trim()) { setDraft(original); return; } onCommit(draft.trim() || null); } }} className={base} />;
}
