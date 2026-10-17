import type { Tone } from "@/components/ui/surface";

export type Lead = {
  id: string;
  company_name: string;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  source?: string | null;
  estimated_monthly_value?: number | string | null;
  next_follow_up_at?: string | null;
  notes?: string | null;
  stage: string;
  archived_at?: string | null;
  owner_id?: string | null;
  team_id?: string | null;
  updated_at?: string;
};

export type Quote = {
  id: string;
  lead_id: string;
  stage: string;
  pickup_location?: string | null;
  delivery_location?: string | null;
  equipment_type?: string | null;
  quoted_rate?: number | string | null;
  rejection_note?: string | null;
  updated_at?: string;
};

export type SalesShipment = {
  id: string;
  quote_id?: string | null;
  reference_number: string;
  pickup_location?: string | null;
  delivery_location?: string | null;
  equipment_type?: string | null;
  amount_quoted?: number | string | null;
  amount_agreed?: number | string | null;
  pickup_date?: string | null;
  delivery_date?: string | null;
  sales_status?: string | null;
  status?: string | null;
  operations_department_id?: string | null;
  brokerage_invoices?: { invoice_number?: string; status?: string } | { invoice_number?: string; status?: string }[] | null;
};

export type Customer = {
  id: string;
  lead_id?: string | null;
  owner_id?: string | null;
  company_name: string;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  updated_at?: string;
};

export type FeedItem = {
  id: string;
  body?: string | null;
  activity_type?: string | null;
  event_type?: string | null;
  due_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  author_name?: string | null;
  can_delete?: boolean;
};

export type Attachment = { id: string; file_name: string; created_at?: string };

export type LeadDetailData = { lead: Lead; activities: FeedItem[]; comments: FeedItem[]; customer: Customer | null; quotes: Quote[] };
export type CustomerProfile = { customer: Customer; can_edit?: boolean; activities: FeedItem[]; comments: FeedItem[]; quotes: Quote[]; shipments: SalesShipment[] };
export type QuoteDetail = { quote: Quote; attachments: Attachment[]; events: FeedItem[]; comments: FeedItem[] };

export const pipelineStages = ["NEW", "CONTACTED", "QUALIFIED", "CUSTOMER", "LOST"] as const;
export const editableStages = ["NEW", "CONTACTED", "QUALIFIED", "LOST"];
export const commercialStatuses = ["QUOTED", "BOOKED", "DELIVERED", "PAID"];
export const activityTypes = ["CALL", "CALLBACK", "EMAIL", "NOTE", "FOLLOW_UP", "APPOINTMENT"];

export const stageLabel: Record<string, string> = { NEW: "New", CONTACTED: "Contacted", QUALIFIED: "Qualified", CUSTOMER: "Customer", LOST: "Not interested" };

export type NextAction = { key: "review" | "handoff" | "rework" | "operations" | "draft" | "none"; label: string; tone: Tone };

/** The one thing that should happen next on a lead, phrased for the person looking at it. */
export function nextAction(quotes: Quote[], manager: boolean): NextAction {
  const has = (stage: string) => quotes.some((quote) => quote.stage === stage);
  if (has("SUBMITTED")) return { key: "review", label: manager ? "Review required" : "Awaiting approval", tone: "brand" };
  if (has("APPROVED")) return { key: "handoff", label: manager ? "Ready to hand off" : "Approved", tone: "success" };
  if (has("REJECTED")) return { key: "rework", label: manager ? "Agent rework" : "Rework needed", tone: "danger" };
  if (has("HANDED_OFF")) return { key: "operations", label: "With Operations", tone: "info" };
  if (has("DRAFT")) return { key: "draft", label: manager ? "Agent draft" : "Quote draft", tone: "neutral" };
  return { key: "none", label: "No quote yet", tone: "neutral" };
}

export const quoteStageLabel: Record<string, string> = { DRAFT: "Draft", SUBMITTED: "Awaiting approval", APPROVED: "Approved", REJECTED: "Returned for rework", HANDED_OFF: "With Operations" };

export const journeySteps = ["Lead", "Contacted", "Qualified", "Customer", "Quote submitted", "Approved", "With Operations"];

/**
 * Index of the current journey step (steps before it are complete).
 * With several quotes, the one still waiting on someone wins, matching `nextAction`.
 */
export function journeyPosition(lead: Lead, quotes: Quote[]): { current: number; blocked: boolean } {
  const has = (stage: string) => quotes.some((quote) => quote.stage === stage);
  if (has("SUBMITTED")) return { current: 5, blocked: false };
  if (has("APPROVED")) return { current: 6, blocked: false };
  if (has("REJECTED")) return { current: 4, blocked: true };
  if (has("HANDED_OFF")) return { current: 7, blocked: false };
  if (lead.stage === "CUSTOMER") return { current: 4, blocked: false };
  const reached: Record<string, number> = { NEW: 0, CONTACTED: 1, QUALIFIED: 2 };
  return { current: (reached[lead.stage] ?? 0) + 1, blocked: false };
}

export const quoteSteps = ["Draft", "Submitted", "Approved", "With Operations"];

export function quotePosition(stage?: string | null): { current: number; blocked: boolean } {
  switch (stage) {
    case "SUBMITTED": return { current: 2, blocked: false };
    case "APPROVED": return { current: 3, blocked: false };
    case "HANDED_OFF": return { current: 4, blocked: false };
    case "REJECTED": return { current: 1, blocked: true };
    default: return { current: 1, blocked: false };
  }
}

export function lane(item: { pickup_location?: string | null; delivery_location?: string | null }) {
  return `${item.pickup_location || "—"} → ${item.delivery_location || "—"}`;
}

export const operationsSteps = ["Booked", "Picked up", "Delivered", "Invoiced", "Closed"];

/** Where a handed-off shipment is in Operations, read from the same shipment record and its invoice. */
export function operationsPosition(shipment: SalesShipment): { current: number; exception: boolean; invoice?: { invoice_number?: string; status?: string } } {
  const invoice = Array.isArray(shipment.brokerage_invoices) ? shipment.brokerage_invoices[0] : shipment.brokerage_invoices ?? undefined;
  const reached: Record<string, number> = { BOOKED: 0, CARRIER_ASSIGNED: 0, PICKED_UP: 1, IN_TRANSIT: 1, DELIVERED: 2, COMPLETED: 2, EXCEPTION: 0 };
  let step = reached[shipment.status ?? "BOOKED"] ?? 0;
  if (invoice) step = Math.max(step, 3);
  if (invoice?.status === "PAID") step = 4;
  return { current: step + 1, exception: shipment.status === "EXCEPTION", invoice };
}
