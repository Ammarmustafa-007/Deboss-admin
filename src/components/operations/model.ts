"use client";

import { useQuery } from "@tanstack/react-query";
import { responseData } from "@/lib/api";
import { useBrokerage } from "@/components/app/brokerage-context";

export type Shipment = {
  id: string;
  reference_number: string;
  customer_name?: string | null;
  pickup_location?: string | null;
  delivery_location?: string | null;
  status: string;
  assigned_to?: string | null;
  team_id?: string | null;
  carrier_name?: string | null;
  pickup_date?: string | null;
  delivery_date?: string | null;
  amount_quoted?: number | string | null;
  amount_invoiced?: number | string | null;
  amount_paid?: number | string | null;
  payment_status?: string | null;
  exception_note?: string | null;
  exception_resolution?: string | null;
  exception_owner_id?: string | null;
  invoice_ready?: boolean | null;
  updated_at?: string;
  customer_id?: string | null;
  amount_agreed?: number | string | null;
  sales_agent_name?: string | null;
} & LoadDetails;

/** What the Operations Agent records on a load (migration 019). The carrier block is never sent to Sales. */
export type LoadDetails = {
  carrier_mc?: string | null; dispatcher_name?: string | null; dispatcher_phone?: string | null; dispatcher_email?: string | null; driver_name?: string | null; driver_phone?: string | null;
  truck_type_size?: string | null; truck_number?: string | null; trailer_number?: string | null; carrier_rate?: number | string | null;
  pickup_facility?: string | null; pickup_address?: string | null; pickup_contact?: string | null; pickup_notes?: string | null; pickup_po?: string | null;
  delivery_facility?: string | null; delivery_address?: string | null; delivery_contact?: string | null; delivery_notes?: string | null;
  commodity_product?: string | null; commodity_weight?: string | null; commodity_pieces?: string | null;
  missed_pickup_reason?: string | null; cancel_reason?: string | null; cancelled_at?: string | null;
  miles?: number | string | null; load_notes?: string | null;
  profit?: number | null; profit_pct?: number | null;
};

/** Profit on a load, as the API computes it: agreed minus carrier rate, and that as a % of the agreed rate. */
export function loadProfit(agreed: unknown, carrier: unknown) {
  if (agreed === null || agreed === undefined || agreed === "" || carrier === null || carrier === undefined || carrier === "") return null;
  const a = Number(agreed); const c = Number(carrier);
  if (!Number.isFinite(a) || !Number.isFinite(c)) return null;
  const profit = Math.round((a - c) * 100) / 100;
  return { profit, pct: a > 0 ? Math.round((profit / a) * 1000) / 10 : null };
}

export type ShipmentDocument = { id: string; document_type: string; is_verified?: boolean; review_note?: string | null; created_at?: string };
export type ShipmentEvent = { id: string; event_type: string; body?: string | null; from_status?: string | null; to_status?: string | null; created_at: string };
export type ShipmentComment = { id: string; body: string; author_id?: string | null; created_at: string };
export type ShipmentDetail = { shipment: Shipment; documents: ShipmentDocument[]; events: ShipmentEvent[]; comments: ShipmentComment[]; invoice?: { invoice_number?: string; status?: string } | null };
export type Directory = { users: { id: string; full_name: string; email?: string; role?: string }[]; teams: { id: string; name: string }[] };

export const shipmentStatuses = ["BOOKED", "CARRIER_ASSIGNED", "PICKED_UP", "IN_TRANSIT", "DELIVERED", "COMPLETED", "EXCEPTION"];
export const progressStatuses = shipmentStatuses.filter((status) => status !== "EXCEPTION");
export const paymentStatuses = ["DRAFT", "SENT", "PENDING", "PAID", "OVERDUE", "CANCELLED"];
export const documentTypes = ["BOL", "POD", "RATE_CONFIRMATION", "INVOICE", "OTHER"];

export const statusLabel: Record<string, string> = { QUOTED: "Quoted", BOOKED: "Booked", CARRIER_ASSIGNED: "Carrier assigned", MISSED_PICKUP: "Missed pickup", PICKED_UP: "Picked up", IN_TRANSIT: "In transit", DELIVERED: "Delivered", COMPLETED: "Completed", EXCEPTION: "Exception", CANCELLED: "Cancelled" };

/** Before pickup a load can still miss its pickup or be cancelled (each with a reason). */
export const canMissPickup = (status: string) => ["BOOKED", "CARRIER_ASSIGNED"].includes(status);
export const canCancel = (status: string) => ["BOOKED", "CARRIER_ASSIGNED", "MISSED_PICKUP"].includes(status);

/** The single forward step an agent takes next, as a clear action. */
export const nextStatus: Record<string, { status: string; action: string }> = {
  BOOKED: { status: "CARRIER_ASSIGNED", action: "Mark carrier assigned" },
  CARRIER_ASSIGNED: { status: "PICKED_UP", action: "Mark picked up" },
  PICKED_UP: { status: "IN_TRANSIT", action: "Mark in transit" },
  IN_TRANSIT: { status: "DELIVERED", action: "Mark delivered" },
  DELIVERED: { status: "COMPLETED", action: "Mark completed" },
  MISSED_PICKUP: { status: "BOOKED", action: "Re-book load" },
};

/**
 * Statuses the menu offers (BO-2): the current one, one step forward or back, and never backwards once delivered.
 * Exception is reported and resolved from the Exception tab, never picked here.
 */
export function allowedStatuses(status: string) {
  const index = progressStatuses.indexOf(status);
  if (index < 0) return [status];
  const back = index > 0 && index < progressStatuses.indexOf("DELIVERED") ? [progressStatuses[index - 1]] : [];
  const forward = index < progressStatuses.length - 1 ? [progressStatuses[index + 1]] : [];
  return [...back, status, ...forward];
}

/** Open when the shipment is in Exception status, or has an unresolved exception note. */
export const exceptionOpen = (shipment: Shipment) => shipment.status === "EXCEPTION" || Boolean(shipment.exception_note && !shipment.exception_resolution);

/** Agents and teams the manager can assign to. Only loaded for department managers, as before. */
export function useOperationsDirectory(enabled: boolean) {
  const { api } = useBrokerage();
  return useQuery({
    queryKey: ["brokerage", "operations-directory"],
    queryFn: async () => responseData<Directory>(await api("/api/v1/brokerage/operations-directory")),
    enabled,
    staleTime: 60_000,
  });
}
