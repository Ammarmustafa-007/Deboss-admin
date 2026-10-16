"use client";

import { LoaderCircle, ReceiptText, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { PendingButton, useSingleFlight } from "@/components/action-state";
import { useApi } from "@/lib/api";

const statuses = ["DRAFT", "SENT", "PENDING", "PAID", "OVERDUE", "CANCELLED"];

type InvoiceDraft = {
  amount: string;
  amount_paid: string;
  due_date: string;
  status: string;
};

function toDraft(invoice: any): InvoiceDraft {
  return {
    amount: String(invoice.amount ?? ""),
    amount_paid: String(invoice.amount_paid ?? ""),
    due_date: invoice.due_date ?? "",
    status: invoice.status ?? "DRAFT",
  };
}

export function InvoiceLedger({ embedded = false }: { embedded?: boolean }) {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [drafts, setDrafts] = useState<Record<string, InvoiceDraft>>({});
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const actions = useSingleFlight();
  const api = useApi();

  async function load() {
    try {
      const response = await api("/api/v1/brokerage/invoices");
      const body = await response.json().catch(() => ({}));
      if (!response.ok) setNotice(body.error ?? "Unable to load invoices.");
      else setInvoices(body.invoices ?? []);
    } catch {
      setNotice("Unable to load invoices.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const updateDraft = (invoice: any, field: keyof InvoiceDraft, value: string) => {
    setDrafts((current) => ({
      ...current,
      [invoice.id]: { ...toDraft(invoice), ...(current[invoice.id] ?? {}), [field]: value },
    }));
  };

  const saveInvoice = (invoice: any) => void actions.run(`invoice:${invoice.id}`, async () => {
    const draft = drafts[invoice.id] ?? toDraft(invoice);
    const patch = {
      amount: draft.amount === "" ? 0 : Number(draft.amount),
      amount_paid: draft.amount_paid === "" ? 0 : Number(draft.amount_paid),
      due_date: draft.due_date || null,
      status: draft.status,
    };

    try {
      const response = await api(`/api/v1/brokerage/invoices/${invoice.id}`, { method: "PATCH", body: JSON.stringify(patch) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Unable to update invoice.");
      setInvoices((current) => current.map((item) => item.id === invoice.id ? { ...item, ...patch } : item));
      setDrafts((current) => {
        const next = { ...current };
        delete next[invoice.id];
        return next;
      });
      setNotice("Invoice updated.");
      void load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to update invoice.");
    }
  });

  return <main className={`${embedded ? "" : "min-h-screen p-5 lg:p-10"} bg-canvas text-ink`}><div className="mx-auto max-w-7xl"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-brand-deep">Brokerage Operations</p><h1 className="mt-2 text-3xl font-semibold">Invoice ledger</h1><p className="mt-2 text-sm text-black/50">Edit a row, then save the complete change set once.</p></div><div className="flex items-center gap-2 rounded-md border border-black/10 bg-white px-3 py-2 text-sm"><ReceiptText size={16}/> {invoices.length} invoices</div></div>{notice && <p role="status" className="mt-5 rounded-md border border-brand/30 bg-[#fff2dd] px-4 py-3 text-sm text-[#7c4400]">{notice}</p>}{loading ? <div className="mt-8 grid place-items-center py-24"><LoaderCircle className="animate-spin text-brand"/></div> : <div className="mt-7 overflow-x-auto rounded-lg border border-black/8 bg-white"><div className="min-w-[900px]"><div className="grid grid-cols-[1.2fr_.75fr_.75fr_1fr_1fr_.8fr] gap-4 border-b border-black/8 px-5 py-3 text-[10px] font-bold uppercase tracking-[.12em] text-black/45"><span>Invoice / shipment</span><span>Amount</span><span>Paid</span><span>Due date</span><span>Status</span><span>Action</span></div>{invoices.map((invoice) => {
        const draft = drafts[invoice.id] ?? toDraft(invoice);
        const dirty = draft.amount !== String(invoice.amount ?? "") || draft.amount_paid !== String(invoice.amount_paid ?? "") || draft.due_date !== (invoice.due_date ?? "") || draft.status !== invoice.status;
        const saving = actions.isBusy(`invoice:${invoice.id}`);
        const anySaveBusy = actions.isBusy();
        return <div key={invoice.id} className="grid grid-cols-[1.2fr_.75fr_.75fr_1fr_1fr_.8fr] items-center gap-4 border-b border-black/5 px-5 py-4 text-sm last:border-0"><div><b>{invoice.invoice_number}</b><p className="mt-1 text-xs text-black/50">{invoice.brokerage_shipments?.reference_number} · {invoice.brokerage_shipments?.customer_name}</p></div><input disabled={anySaveBusy} value={draft.amount} onChange={(event) => updateDraft(invoice, "amount", event.target.value)} type="number" min="0" className="h-9 rounded-md border border-black/10 px-2 disabled:opacity-50"/><input disabled={anySaveBusy} value={draft.amount_paid} onChange={(event) => updateDraft(invoice, "amount_paid", event.target.value)} type="number" min="0" className="h-9 rounded-md border border-black/10 px-2 disabled:opacity-50"/><input disabled={anySaveBusy} value={draft.due_date} onChange={(event) => updateDraft(invoice, "due_date", event.target.value)} type="date" className="h-9 rounded-md border border-black/10 px-2 disabled:opacity-50"/><select disabled={anySaveBusy} value={draft.status} onChange={(event) => updateDraft(invoice, "status", event.target.value)} className="h-9 rounded-md border border-black/10 bg-white px-2 text-xs font-bold disabled:opacity-50">{statuses.map((status) => <option key={status}>{status}</option>)}</select><PendingButton type="button" pending={saving} pendingLabel="Saving..." disabled={!dirty || (anySaveBusy && !saving)} onClick={() => saveInvoice(invoice)} className="h-9 rounded-md bg-ink-soft px-3 text-xs font-bold text-white disabled:opacity-40"><Save size={13}/>Save</PendingButton></div>;
      })}{!invoices.length && <p className="p-12 text-center text-sm text-black/50">Delivered shipments with generated invoices will appear here.</p>}</div></div>}</div></main>;
}

