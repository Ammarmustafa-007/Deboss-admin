"use client";

import { AlertTriangle, CheckCircle2, Download, Upload } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { responseData } from "@/lib/api";
import { useBrokerage } from "@/components/app/brokerage-context";
import { useBrokerageAction } from "@/components/app/use-brokerage-action";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlay";
import { FilePicker } from "@/components/ui/field";

type Row = { company_name: string; contact_name: string; contact_email: string; contact_phone: string; source: string; estimated_monthly_value: string; next_follow_up_at: string };
type Parsed = { row: Row; line: number; problems: string[] };

/** Accepted column names (case-insensitive) for each lead field. */
const columns: Record<keyof Row, string[]> = {
  company_name: ["company", "company name", "company_name", "customer"],
  contact_name: ["contact", "contact name", "contact_name", "name"],
  contact_email: ["email", "contact email", "contact_email"],
  contact_phone: ["phone", "contact phone", "contact_phone", "mobile"],
  source: ["source", "lead source"],
  estimated_monthly_value: ["forecast", "monthly forecast", "estimated monthly value", "estimated_monthly_value", "value"],
  next_follow_up_at: ["follow-up", "follow up", "next follow-up", "next_follow_up_at", "next follow up"],
};
const template = "Company,Contact,Email,Phone,Source,Monthly forecast,Next follow-up\nNorthline Foods,Hina Tariq,hina@northline.com,+1 214 555 0101,Referral,31400,2026-11-02 10:00\n";

/** Minimal RFC 4180 parser: quoted fields, escaped quotes, commas and newlines inside quotes. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(cell); cell = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((cells) => cells.some((value) => value.trim()));
}

function toRows(text: string): { parsed: Parsed[]; missing: string[] } {
  const [header = [], ...body] = parseCsv(text.replace(/^﻿/, ""));
  const names = header.map((name) => name.trim().toLowerCase());
  const index = Object.fromEntries((Object.keys(columns) as (keyof Row)[]).map((field) => [field, names.findIndex((name) => columns[field].includes(name))])) as Record<keyof Row, number>;
  const missing = index.company_name < 0 ? ["Company"] : [];
  const parsed = body.map((cells, offset) => {
    const row = Object.fromEntries((Object.keys(columns) as (keyof Row)[]).map((field) => [field, index[field] >= 0 ? (cells[index[field]] ?? "").trim() : ""])) as Row;
    const problems: string[] = [];
    if (row.company_name.length < 2) problems.push("Company is required");
    if (row.contact_email && !/^\S+@\S+\.\S+$/.test(row.contact_email)) problems.push("Email is not valid");
    if (row.estimated_monthly_value && !(Number(row.estimated_monthly_value.replace(/[$,\s]/g, "")) >= 0)) problems.push("Forecast must be a number");
    if (row.next_follow_up_at && Number.isNaN(new Date(row.next_follow_up_at).getTime())) problems.push("Follow-up date not recognised");
    return { row, line: offset + 2, problems };
  });
  return { parsed, missing };
}

export function LeadImport({ onClose }: { onClose: () => void }) {
  const { api, report } = useBrokerage();
  const { busy, wrap, refresh } = useBrokerageAction();
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<Parsed[] | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ created: number; failed: { line: number; message: string }[] } | null>(null);
  const importing = busy("import");

  const choose = async (picked: File | null) => {
    setFile(picked);
    setResult(null);
    if (!picked) return setParsed(null);
    const { parsed: rows, missing: absent } = toRows(await picked.text());
    setParsed(rows);
    setMissing(absent);
  };

  const valid = (parsed ?? []).filter((item) => !item.problems.length);
  const invalid = (parsed ?? []).filter((item) => item.problems.length);

  const run = () => void wrap("import", async () => {
    const failed: { line: number; message: string }[] = [];
    let created = 0;
    setProgress(0);
    for (const [position, { row, line }] of valid.entries()) {
      try {
        await responseData(await api("/api/v1/brokerage/leads", { method: "POST", body: JSON.stringify({
          company_name: row.company_name,
          contact_name: row.contact_name || undefined,
          contact_email: row.contact_email || "",
          contact_phone: row.contact_phone || undefined,
          source: row.source || undefined,
          estimated_monthly_value: row.estimated_monthly_value ? Number(row.estimated_monthly_value.replace(/[$,\s]/g, "")) : undefined,
          next_follow_up_at: row.next_follow_up_at ? new Date(row.next_follow_up_at).toISOString() : undefined,
        }) }));
        created += 1;
      } catch (error) {
        failed.push({ line, message: error instanceof Error ? error.message : "Could not create" });
      }
      setProgress(position + 1);
    }
    void refresh();
    setResult({ created, failed });
    report(failed.length ? `${created} leads imported, ${failed.length} failed.` : `${created} leads imported.`, failed.length ? "error" : "success");
  });

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([template], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url; link.download = "lead-import-template.csv"; link.click();
    URL.revokeObjectURL(url);
  };

  return <Modal open onClose={onClose} dismissible={!importing} className="max-w-2xl" title="Import leads" subtitle="Upload a CSV exported from Excel or your old system"
    footer={result
      ? <Button variant="ink" onClick={onClose}>Done</Button>
      : <><Button variant="ghost" onClick={onClose} disabled={importing}>Cancel</Button><Button variant="primary" icon={<Upload size={15} />} disabled={!valid.length || missing.length > 0} pending={importing} pendingLabel={`Importing ${progress}/${valid.length}…`} onClick={run}>Import {valid.length || ""} lead{valid.length === 1 ? "" : "s"}</Button></>}>
    {!result && <div className="space-y-4">
      <FilePicker label="CSV file" file={file} onFile={(picked) => void choose(picked)} accept=".csv,text/csv" disabled={importing} hint="Columns: Company (required), Contact, Email, Phone, Source, Monthly forecast, Next follow-up" />
      <button type="button" onClick={downloadTemplate} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-deep hover:underline"><Download size={14} />Download template</button>

      {missing.length > 0 && <p className="rounded-control bg-danger/[.07] px-4 py-3 text-sm text-[#A5183F]">The file needs a <b>{missing.join(", ")}</b> column.</p>}
      {parsed && !missing.length && <>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/12 px-3 py-1 font-medium text-[#14693A]"><CheckCircle2 size={14} />{valid.length} ready</span>
          {invalid.length > 0 && <span className="inline-flex items-center gap-1.5 rounded-full bg-danger/12 px-3 py-1 font-medium text-[#A5183F]"><AlertTriangle size={14} />{invalid.length} will be skipped</span>}
        </div>
        <div className="max-h-64 overflow-auto rounded-control border border-line">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 bg-[#FBFAF7]"><tr className="text-left text-xs text-muted"><th className="px-3 py-2 font-medium">Row</th><th className="px-3 py-2 font-medium">Company</th><th className="px-3 py-2 font-medium">Contact</th><th className="px-3 py-2 font-medium">Status</th></tr></thead>
            <tbody>{parsed.slice(0, 200).map((item) => <tr key={item.line} className={cn("border-t border-line-soft", item.problems.length && "bg-danger/[.04]")}>
              <td className="px-3 py-2 text-muted">{item.line}</td>
              <td className="px-3 py-2 font-medium">{item.row.company_name || "—"}</td>
              <td className="px-3 py-2 text-ink/75">{item.row.contact_name || "—"}</td>
              <td className="px-3 py-2">{item.problems.length ? <span className="text-[#C4254B]">{item.problems.join("; ")}</span> : <span className="text-[#14693A]">Ready</span>}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </>}
    </div>}

    {result && <div className="space-y-4">
      <p className="flex items-center gap-2 text-sm"><CheckCircle2 size={18} className="text-success" /><b>{result.created}</b> lead{result.created === 1 ? "" : "s"} imported.</p>
      {result.failed.length > 0 && <div className="rounded-control border border-danger/30 bg-danger/[.05] p-4 text-sm">
        <p className="mb-2 font-semibold text-[#A5183F]">{result.failed.length} could not be created</p>
        <ul className="max-h-48 space-y-1 overflow-auto text-[13px] text-ink/80">{result.failed.map((item) => <li key={item.line}>Row {item.line}: {item.message}</li>)}</ul>
      </div>}
    </div>}
  </Modal>;
}
