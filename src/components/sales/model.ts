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
  fronter_prospect_id?: string | null;
} & LeadDetails;

/** Company details on a lead (migration 018): filled by Sales, or carried over from a Fronter's sheet. */
export type LeadDetails = {
  operator_name?: string | null; operator_number?: string | null; truck_type?: string | null; load_type?: string | null; shipping_volume?: string | null;
  commodity?: string | null; lanes?: string | null; physical_address?: string | null; other_locations?: string | null; billing_address?: string | null;
  billing_contact?: string | null; billing_phone?: string | null; billing_email?: string | null; payment_terms?: string | null; w9_received?: boolean | null;
  ein?: string | null; website?: string | null;
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
  ops_rejection_note?: string | null;
  updated_at?: string;
};

export type SalesShipment = {
  id: string;
  /** Set while in Exception: where Operations was when it was raised. */
  status_before_exception?: string | null;
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
  /** From Operations (migration 019). Carrier identity is never sent to Sales; the rate and profit are. */
  carrier_rate?: number | string | null; profit?: number | null; profit_pct?: number | null; operations_agent_name?: string | null;
  pickup_facility?: string | null; pickup_address?: string | null; pickup_contact?: string | null; pickup_notes?: string | null; pickup_po?: string | null;
  delivery_facility?: string | null; delivery_address?: string | null; delivery_contact?: string | null; delivery_notes?: string | null;
  commodity_product?: string | null; commodity_weight?: string | null; commodity_pieces?: string | null;
  missed_pickup_reason?: string | null; cancel_reason?: string | null; cancelled_at?: string | null;
  miles?: number | string | null; load_notes?: string | null;
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

/** The mined row a qualified lead came from (Fronters sheet). */
export type FronterProspect = Record<string, string | boolean | null> & { fronter_name: string | null; qualified_at: string | null };
export type LeadDetailData = { lead: Lead; activities: FeedItem[]; comments: FeedItem[]; customer: Customer | null; quotes: Quote[]; prospect?: FronterProspect | null };
/** A document Operations uploaded on one of the customer's loads (rate confirmations are never sent to Sales). */
export type LoadDocument = { id: string; shipment_id: string; document_type: string; is_verified?: boolean; created_at?: string };
export type CustomerProfile = { customer: Customer; can_edit?: boolean; activities: FeedItem[]; comments: FeedItem[]; quotes: Quote[]; shipments: SalesShipment[]; documents?: LoadDocument[] };
/** Who handles the quote's customer in Operations (set once, on the customer's first approved load). */
export type CustomerOperations = { department_id: string | null; department_name: string | null; agent_id: string | null; agent_name: string | null };
export type QuoteDetail = { quote: Quote; customer_operations?: CustomerOperations | null; attachments: Attachment[]; events: FeedItem[]; comments: FeedItem[] };

/**
 * Lead statuses (client flow v2): Lead -> Qualified -> Quoting -> Customer, or Not qualified / Not interested.
 * Agents pick from `editableStages`; Quoting and Customer follow the lead's loads automatically.
 */
export const pipelineStages = ["LEAD", "QUALIFIED", "QUOTING", "CUSTOMER", "NOT_QUALIFIED", "NOT_INTERESTED"] as const;
export const editableStages = ["LEAD", "QUALIFIED", "NOT_QUALIFIED", "NOT_INTERESTED"];
/** Statuses that end a lead's pipeline (counted as closed, not open). */
export const closedStages = ["CUSTOMER", "NOT_QUALIFIED", "NOT_INTERESTED"];
/** Statuses agents can no longer move by hand. */
export const automaticStages = ["QUOTING", "CUSTOMER"];
export const commercialStatuses = ["QUOTED", "BOOKED", "DELIVERED", "PAID"];
export const activityTypes = ["CALL", "CALLBACK", "EMAIL", "NOTE", "FOLLOW_UP", "APPOINTMENT"];

export const stageLabel: Record<string, string> = { LEAD: "Lead", QUALIFIED: "Qualified", QUOTING: "Quoting", CUSTOMER: "Customer", NOT_QUALIFIED: "Not qualified", NOT_INTERESTED: "Not interested", NEW: "Lead", CONTACTED: "Lead", LOST: "Not interested" };

export type NextAction = { key: "review" | "handoff" | "rework" | "ops_review" | "ops_rejected" | "operations" | "draft" | "none"; label: string; tone: Tone };

/** The one thing that should happen next on a lead, phrased for the person looking at it. */
export function nextAction(quotes: Quote[], manager: boolean): NextAction {
  const has = (stage: string) => quotes.some((quote) => quote.stage === stage);
  if (has("SUBMITTED")) return { key: "review", label: manager ? "Review required" : "Awaiting approval", tone: "brand" };
  if (has("APPROVED")) return { key: "handoff", label: manager ? "Ready to hand off" : "Approved", tone: "success" };
  if (has("REJECTED")) return { key: "rework", label: manager ? "Agent rework" : "Rework needed", tone: "danger" };
  if (has("OPS_REJECTED")) return { key: "ops_rejected", label: manager ? "Rejected by Operations: decide" : "Rejected by Operations", tone: "danger" };
  if (has("OPS_REVIEW")) return { key: "ops_review", label: "With the Ops Manager", tone: "accent" };
  if (has("HANDED_OFF")) return { key: "operations", label: "With Operations", tone: "info" };
  if (has("DRAFT")) return { key: "draft", label: manager ? "Agent draft" : "Quote draft", tone: "neutral" };
  return { key: "none", label: "No quote yet", tone: "neutral" };
}

export const quoteStageLabel: Record<string, string> = { DRAFT: "Draft", SUBMITTED: "Awaiting approval", APPROVED: "Approved", OPS_REVIEW: "With the Ops Manager", OPS_REJECTED: "Rejected by Operations", REJECTED: "Returned for rework", HANDED_OFF: "With Operations" };

export const journeySteps = ["Lead", "Qualified", "Quoting", "Customer", "Approved", "With Operations"];

/**
 * Index of the current journey step (steps before it are complete): the lead status up to Customer,
 * then the approval of its loads. With several quotes, the one still waiting on someone wins, matching `nextAction`.
 */
export function journeyPosition(stage: string, quotes: Quote[]): { current: number; blocked: boolean } {
  const has = (value: string) => quotes.some((quote) => quote.stage === value);
  if (has("SUBMITTED") || has("OPS_REVIEW")) return { current: 4, blocked: false };
  if (has("OPS_REJECTED")) return { current: 4, blocked: true };
  if (has("APPROVED")) return { current: 5, blocked: false };
  if (has("REJECTED")) return { current: 4, blocked: true };
  if (has("HANDED_OFF")) return { current: 6, blocked: false };
  if (stage === "NOT_QUALIFIED" || stage === "NOT_INTERESTED") return { current: 0, blocked: true };
  const rank: Record<string, number> = { LEAD: 0, NEW: 0, CONTACTED: 0, QUALIFIED: 1, QUOTING: 2, CUSTOMER: 3 };
  return { current: rank[stage] ?? 0, blocked: false };
}

/** A load's approval: the Sales Manager, then (a new customer's first load only) the Operations Manager. */
export const quoteSteps = ["Draft", "Sales Manager", "Ops Manager", "With Operations"];

export function quotePosition(stage?: string | null): { current: number; blocked: boolean } {
  switch (stage) {
    case "SUBMITTED": return { current: 1, blocked: false };
    case "APPROVED": case "OPS_REVIEW": return { current: 2, blocked: false };
    case "OPS_REJECTED": return { current: 2, blocked: true };
    case "HANDED_OFF": return { current: 4, blocked: false };
    case "REJECTED": return { current: 1, blocked: true };
    default: return { current: 0, blocked: false };
  }
}

export function lane(item: { pickup_location?: string | null; delivery_location?: string | null }) {
  return `${item.pickup_location || "—"} → ${item.delivery_location || "—"}`;
}

export const operationsSteps = ["Booked", "Picked up", "Delivered", "Invoiced", "Closed"];

/** Where a handed-off shipment is in Operations, read from the same shipment record and its invoice. */
export function operationsPosition(shipment: SalesShipment): { current: number; exception: boolean; invoice?: { invoice_number?: string; status?: string } } {
  const invoice = Array.isArray(shipment.brokerage_invoices) ? shipment.brokerage_invoices[0] : shipment.brokerage_invoices ?? undefined;
  const reached: Record<string, number> = { BOOKED: 0, CARRIER_ASSIGNED: 0, MISSED_PICKUP: 0, CANCELLED: 0, PICKED_UP: 1, IN_TRANSIT: 1, DELIVERED: 2, COMPLETED: 2, EXCEPTION: 0 };
  // An exception pauses the shipment where it was; the line holds that place in red instead of falling back.
  const status = shipment.status === "EXCEPTION" ? shipment.status_before_exception ?? "BOOKED" : shipment.status ?? "BOOKED";
  let step = reached[status] ?? 0;
  if (invoice) step = Math.max(step, 3);
  if (invoice?.status === "PAID") step = 4;
  // A missed pickup or a cancellation also shows the line in red at Booked.
  return { current: step + 1, exception: ["EXCEPTION", "MISSED_PICKUP", "CANCELLED"].includes(shipment.status ?? ""), invoice };
}
