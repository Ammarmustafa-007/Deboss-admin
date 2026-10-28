"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ChevronRight, ExternalLink, FileText, Hourglass, Inbox, RotateCcw, Send, Truck } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { errorMessage, responseData } from "@/lib/api";
import { money } from "@/lib/format";
import { useBrokerage } from "@/components/app/brokerage-context";
import { Card, Chip, EmptyState, Skeleton, toneFor } from "@/components/ui/surface";
import { Stepper } from "@/components/ui/navigation";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/overlay";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { ActivityFeed, CommentFeed, Composer } from "@/components/sales/feed";
import { useBrokerageAction } from "@/components/app/use-brokerage-action";
import { lane, quotePosition, quoteStageLabel, quoteSteps, type CustomerProfile, type Lead, type Quote, type QuoteDetail } from "@/components/sales/model";

function useQuoteDetail(quoteId: string) {
  const { api } = useBrokerage();
  return useQuery({ queryKey: ["brokerage", "quote", quoteId], queryFn: async () => responseData<QuoteDetail>(await api(`/api/v1/brokerage/quotes/${quoteId}/detail`)), staleTime: 10_000 });
}

const decisionHint: Record<string, string> = {
  SUBMITTED: "Waiting for your decision",
  APPROVED: "Approved · hand off to Operations",
  OPS_REVIEW: "With the Ops Manager",
  OPS_REJECTED: "Rejected by Operations · decide",
  REJECTED: "Returned to the agent",
  HANDED_OFF: "Handed off to Operations",
  DRAFT: "Agent hasn't submitted yet",
};

/** Manager view: every quote on the lead, ordered by what needs attention first. */
export function QuoteList({ quotes, lead, customerId }: { quotes: Quote[]; lead: Lead; customerId?: string | null }) {
  const { api } = useBrokerage();
  // The Sales shipment behind each quote already has a reference number; handoff reuses it by default.
  const customer = useQuery({ queryKey: ["brokerage", "customer", customerId], queryFn: async () => responseData<CustomerProfile>(await api(`/api/v1/brokerage/customers/${customerId}/profile`)), enabled: Boolean(customerId), staleTime: 15_000 });
  const referenceFor = (quoteId: string) => customer.data?.shipments.find((shipment) => shipment.quote_id === quoteId)?.reference_number;
  const [openId, setOpenId] = useState<string | null>(null);
  const order: Record<string, number> = { SUBMITTED: 0, APPROVED: 1, REJECTED: 2, DRAFT: 3, HANDED_OFF: 4 };
  const sorted = [...quotes].sort((a, b) => (order[a.stage] ?? 9) - (order[b.stage] ?? 9));
  const open = quotes.find((quote) => quote.id === openId);

  if (!quotes.length) return <Card><EmptyState icon={Inbox} title="No quotes on this lead" body="Quotes appear here when the Sales Agent adds a shipment for this customer." /></Card>;
  return <>
    <div className="grid gap-4 lg:grid-cols-2">
      {sorted.map((quote) => {
        const attention = quote.stage === "SUBMITTED" || quote.stage === "APPROVED";
        return <button key={quote.id} type="button" onClick={() => setOpenId(quote.id)} className={cn("group flex flex-col gap-3 rounded-card border bg-white p-5 text-left transition-[border-color,box-shadow] hover:shadow-[0_10px_30px_-14px_rgba(17,17,17,.25)]", attention ? "border-brand/50" : "border-line")}>
          <div className="flex w-full items-start justify-between gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-control bg-aqua/12 text-aqua"><Truck size={18} /></span>
            <Chip tone={toneFor(quote.stage)}>{quoteStageLabel[quote.stage] ?? quote.stage}</Chip>
          </div>
          <div><p className="font-semibold">{lane(quote)}</p><p className="mt-0.5 text-sm text-muted">{quote.equipment_type || "Equipment not specified"} · {quote.quoted_rate ? money(quote.quoted_rate) : "Rate pending"}</p></div>
          <div className="flex items-center justify-between border-t border-line-soft pt-3 text-[13px]">
            <span className={cn("font-medium", attention ? "text-brand-deep" : "text-muted")}>{decisionHint[quote.stage] ?? ""}</span>
            <span className="inline-flex items-center gap-1 font-semibold">{quote.stage === "SUBMITTED" ? "Review" : "Open"}<ChevronRight size={15} className="transition-transform group-hover:translate-x-0.5" /></span>
          </div>
        </button>;
      })}
    </div>
    {open && <QuoteReviewDrawer quote={open} lead={lead} reference={referenceFor(open.id)} onClose={() => setOpenId(null)} />}
  </>;
}

function QuoteReviewDrawer({ quote, lead, reference, onClose }: { quote: Quote; lead: Lead; reference?: string; onClose: () => void }) {
  const { workspace, api, report } = useBrokerage();
  const caps = workspace.capabilities ?? {};
  const queryClient = useQueryClient();
  const { run, busy, wrap, refresh } = useBrokerageAction();
  const [reviewNote, setReviewNote] = useState("");
  const departments = (workspace.operationsDepartments ?? []) as { id: string; name: string }[];
  const [handoff, setHandoff] = useState({ operations_department_id: departments[0]?.id ?? "", customer_name: lead.company_name ?? "" });
  const [typedReference, setTypedReference] = useState<string | null>(null);
  const referenceNumber = typedReference ?? reference ?? "";
  const detail = useQuoteDetail(quote.id);
  const stage = detail.data?.quote.stage ?? quote.stage;
  const { current, blocked } = quotePosition(stage);
  const anyBusy = busy();
  const path = `/api/v1/brokerage/quotes/${quote.id}`;

  // Approving: a customer with an Operations agent gets the load straight away; a new customer goes to the Ops Manager
  // of the department picked here (picked once, then remembered on the customer).
  const ops = detail.data?.customer_operations;
  const [opsDepartment, setOpsDepartment] = useState<string>("");
  const chosenDepartment = opsDepartment || ops?.department_id || departments[0]?.id || "";
  const approve = () => void wrap("approve", async () => {
    try {
      await responseData(await api(`${path}/review`, { method: "POST", body: JSON.stringify({ action: "APPROVE", ...(ops?.agent_id ? {} : { operations_department_id: chosenDepartment }) }) }));
      // Reflect the decision immediately; the refetch then reconciles with the server.
      queryClient.setQueryData<QuoteDetail>(["brokerage", "quote", quote.id], (current) => current ? { ...current, quote: { ...current.quote, stage: ops?.agent_id ? "HANDED_OFF" : "OPS_REVIEW" } } : current);
      void refresh();
      report(ops?.agent_id ? `Approved. Sent straight to ${ops.agent_name ?? "the customer's Operations agent"}.` : "Approved. It's now with the Operations Manager for review.");
    } catch (error) {
      report(errorMessage(error), "error");
    }
  });
  const [opsNote, setOpsNote] = useState("");

  const submitHandoff = async (event: FormEvent) => {
    event.preventDefault();
    await run("handoff", `${path}/handoff`, "POST", { ...handoff, reference_number: referenceNumber }, "Quote handed to Operations.");
  };

  return <Drawer open onClose={onClose} dismissible={!anyBusy} className="max-w-2xl" title={lane(quote)} subtitle={`${quote.equipment_type || "Equipment not specified"} · ${quote.quoted_rate ? money(quote.quoted_rate) : "Rate pending"}`}>
    <div className="rounded-[12px] border border-line-soft bg-[#FBFAF7] p-4"><Stepper steps={quoteSteps.map((label) => ({ label }))} current={current} tone={blocked ? "danger" : "brand"} /></div>

    {caps.canReviewQuotes && stage === "SUBMITTED" && <DecisionCard step={1} title="Review & decide" icon={<Hourglass size={16} />}>
      <TextAreaField label="Reason for returning" maxLength={1000} hint="Required only when returning the quote for rework." value={reviewNote} disabled={anyBusy} onChange={(event) => setReviewNote(event.target.value)} className="min-h-20" />
      {ops?.agent_id
        ? <p className="mt-4 rounded-[12px] bg-aqua/[.08] px-4 py-3 text-sm"><b>{ops.agent_name ?? "The customer's Operations agent"}</b> already handles this customer{ops.department_name ? ` (${ops.department_name})` : ""}. Approving sends the load straight to them.</p>
        : <div className="mt-4"><SelectField label="Operations department for this customer" required hint="A new customer: its first load goes to this department's Operations Manager to approve and assign an agent. It's remembered for later loads." value={chosenDepartment} disabled={anyBusy || Boolean(ops?.department_id)} onChange={(event) => setOpsDepartment(event.target.value)} options={departments.map((department) => ({ value: department.id, label: department.name }))} /></div>}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="success" icon={<CheckCircle2 size={15} />} pending={busy("approve")} pendingLabel="Approving…" disabled={anyBusy || (!ops?.agent_id && !chosenDepartment)} onClick={approve}>{ops?.agent_id ? "Approve" : "Approve & send to Operations"}</Button>
        <Button variant="danger" icon={<RotateCcw size={15} />} pending={busy("reject")} pendingLabel="Returning…" disabled={anyBusy || !reviewNote.trim()} onClick={() => void run("reject", `${path}/review`, "POST", { action: "REJECT", note: reviewNote }, "Quote returned for rework.").then((result) => { if (result !== undefined) setReviewNote(""); })} className="sm:ml-auto">Return for rework</Button>
      </div>
    </DecisionCard>}

    {caps.canHandoffQuotes && stage === "APPROVED" && <DecisionCard step={2} title="Hand off to Operations" icon={<Truck size={16} />}>
      <form onSubmit={submitHandoff} className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Receiving department" required wrapperClassName="sm:col-span-2" value={handoff.operations_department_id} disabled={anyBusy} placeholder="Choose Brokerage Operations" onChange={(event) => setHandoff({ ...handoff, operations_department_id: event.target.value })} options={departments.map((department) => ({ value: department.id, label: department.name }))} />
        <TextField label="Shipment reference" required minLength={3} maxLength={64} placeholder="e.g. DG-2026-001" value={referenceNumber} disabled={anyBusy} onChange={(event) => setTypedReference(event.target.value)} />
        <TextField label="Customer name" required minLength={2} value={handoff.customer_name} disabled={anyBusy} onChange={(event) => setHandoff({ ...handoff, customer_name: event.target.value })} />
        <div className="sm:col-span-2"><Button type="submit" variant="primary" pending={busy("handoff")} pendingLabel="Creating shipment…" disabled={anyBusy && !busy("handoff")} icon={<Send size={15} />}>Confirm handoff</Button></div>
      </form>
    </DecisionCard>}

    {stage === "OPS_REVIEW" && <Notice tone="neutral">Approved by Sales. Waiting for the {ops?.department_name ?? "Operations"} Ops Manager to approve it and assign the customer&apos;s agent.</Notice>}
    {stage === "OPS_REJECTED" && (caps.canReviewQuotes
      ? <DecisionCard step={2} title="Rejected by Operations: your decision" icon={<RotateCcw size={16} />}>
          <p className="mb-4 rounded-[12px] bg-danger/[.06] px-4 py-3 text-sm text-[#A5183F]"><b>Operations Manager:</b> {detail.data?.quote.ops_rejection_note ?? quote.ops_rejection_note}</p>
          <TextAreaField label="Note for the agent" maxLength={1000} hint="Optional. Sent with the decision." value={opsNote} disabled={anyBusy} onChange={(event) => setOpsNote(event.target.value)} className="min-h-16" />
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="primary" icon={<RotateCcw size={15} />} pending={busy("send-back")} pendingLabel="Sending…" disabled={anyBusy} onClick={() => void run("send-back", `${path}/ops-rejection`, "POST", { action: "SEND_BACK", note: opsNote || undefined }, "Sent back to the agent to fix and resubmit.")}>Send back to the agent</Button>
            <Button variant="danger" pending={busy("close-out")} pendingLabel="Closing…" disabled={anyBusy} onClick={() => void run("close-out", `${path}/ops-rejection`, "POST", { action: "CLOSE_OUT", note: opsNote || undefined }, "Load closed out.")} className="sm:ml-auto">Close out this load</Button>
          </div>
        </DecisionCard>
      : <Notice tone="danger">Rejected by Operations{(detail.data?.quote.ops_rejection_note ?? quote.ops_rejection_note) ? `: ${detail.data?.quote.ops_rejection_note ?? quote.ops_rejection_note}` : "."} Your Sales Manager decides what happens next.</Notice>)}
    {stage === "REJECTED" && <Notice tone="danger">Returned to the agent for rework{quote.rejection_note ? `: ${quote.rejection_note}` : "."}</Notice>}
    {stage === "HANDED_OFF" && <Notice tone="success">Handed off. Operations now owns this shipment.</Notice>}
    {stage === "DRAFT" && <Notice tone="neutral">The agent hasn&apos;t submitted this quote yet.</Notice>}

    <div className="mt-8 border-t border-line-soft pt-6">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold"><FileText size={15} />Quote file</h3>
      <QuoteFile quoteId={quote.id} detail={detail} />
    </div>
  </Drawer>;
}

function DecisionCard({ step, title, icon, children }: { step: number; title: string; icon: ReactNode; children: ReactNode }) {
  return <section className="mt-5 rounded-[14px] border border-brand/40 bg-brand-tint/60 p-5">
    <div className="mb-4 flex items-center gap-2.5">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-brand text-xs font-bold text-ink">{step}</span>
      <h3 className="flex items-center gap-1.5 font-semibold">{icon}{title}</h3>
    </div>
    {children}
  </section>;
}

function Notice({ tone, children }: { tone: "danger" | "success" | "neutral"; children: ReactNode }) {
  return <p className={cn("mt-5 rounded-[12px] px-4 py-3 text-sm", tone === "danger" && "bg-danger/[.07] text-[#A5183F]", tone === "success" && "bg-success/10 text-[#14693A]", tone === "neutral" && "bg-canvas text-muted")}>{children}</p>;
}

/** Attachments, revision history and comments for one quote. */
export function QuoteFile({ quoteId, detail: provided, readOnly = false }: { quoteId: string; detail?: ReturnType<typeof useQuoteDetail>; readOnly?: boolean }) {
  const own = useQuoteDetail(quoteId);
  const detail = provided ?? own;
  const { api, report } = useBrokerage();
  const { run, busy, wrap } = useBrokerageAction();

  if (detail.isLoading) return <div className="space-y-3"><Skeleton className="h-12" /><Skeleton className="h-24" /></div>;
  if (detail.isError || !detail.data) return <p className="text-sm text-[#C4254B]">{errorMessage(detail.error, "Quote details could not be loaded.")}</p>;
  const { attachments, events, comments } = detail.data;

  const openAttachment = (id: string) => void wrap(`download:${id}`, async () => {
    try {
      const link = await responseData<{ signed_url: string }>(await api(`/api/v1/brokerage/quote-attachments/${id}/download-url`));
      window.open(link.signed_url, "_blank", "noopener,noreferrer");
    } catch (error) { report(errorMessage(error), "error"); }
  });

  return <div className="space-y-6">
    <div>
      <p className="mb-2 text-xs font-medium text-muted">Attachments · {attachments.length}</p>
      {attachments.length ? <ul className="space-y-1.5">{attachments.map((attachment) => <li key={attachment.id}><button type="button" disabled={busy(`download:${attachment.id}`)} onClick={() => openAttachment(attachment.id)} className="flex w-full items-center gap-3 rounded-control border border-line bg-white px-3 py-2.5 text-left text-sm transition hover:border-brand disabled:opacity-60"><FileText size={16} className="shrink-0 text-brand" /><span className="min-w-0 flex-1 truncate">{attachment.file_name}</span><ExternalLink size={14} className="text-muted" /></button></li>)}</ul> : <p className="text-sm text-muted">No supporting files.</p>}
    </div>
    <div>
      <p className="mb-2 text-xs font-medium text-muted">Comments</p>
      <div className="space-y-4">
        {!readOnly && <Composer placeholder="Add a review note or comment" pending={busy(`quote-comment:${quoteId}`)} onSubmit={async (body) => (await run(`quote-comment:${quoteId}`, `/api/v1/brokerage/quotes/${quoteId}/comments`, "POST", { body }, "Quote comment added.")) !== undefined} />}
        <CommentFeed rows={comments} empty="No comments on this quote." busy={busy} onDelete={readOnly ? undefined : (row) => void run(`delete-comment:${row.id}`, `/api/v1/brokerage/comments/${row.id}`, "DELETE", undefined, "Quote comment deleted.")} />
      </div>
    </div>
    <div>
      <p className="mb-2 text-xs font-medium text-muted">Revision history</p>
      <ActivityFeed rows={events} empty="No quote events yet." />
    </div>
  </div>;
}
