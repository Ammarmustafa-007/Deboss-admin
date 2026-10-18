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
};

export type ShipmentDocument = { id: string; document_type: string; is_verified?: boolean; review_note?: string | null; created_at?: string };
export type ShipmentEvent = { id: string; event_type: string; body?: string | null; from_status?: string | null; to_status?: string | null; created_at: string };
export type ShipmentComment = { id: string; body: string; author_id?: string | null; created_at: string };
export type ShipmentDetail = { shipment: Shipment; documents: ShipmentDocument[]; events: ShipmentEvent[]; comments: ShipmentComment[]; invoice?: { invoice_number?: string; status?: string } | null };
export type Directory = { users: { id: string; full_name: string; email?: string; role?: string }[]; teams: { id: string; name: string }[] };

export const shipmentStatuses = ["BOOKED", "CARRIER_ASSIGNED", "PICKED_UP", "IN_TRANSIT", "DELIVERED", "COMPLETED", "EXCEPTION"];
export const progressStatuses = shipmentStatuses.filter((status) => status !== "EXCEPTION");
export const paymentStatuses = ["DRAFT", "SENT", "PENDING", "PAID", "OVERDUE", "CANCELLED"];
export const documentTypes = ["BOL", "POD", "RATE_CONFIRMATION", "INVOICE", "OTHER"];

export const statusLabel: Record<string, string> = { BOOKED: "Booked", CARRIER_ASSIGNED: "Carrier assigned", PICKED_UP: "Picked up", IN_TRANSIT: "In transit", DELIVERED: "Delivered", COMPLETED: "Completed", EXCEPTION: "Exception" };

/** The single forward step an agent takes next, as a clear action. */
export const nextStatus: Record<string, { status: string; action: string }> = {
  BOOKED: { status: "CARRIER_ASSIGNED", action: "Mark carrier assigned" },
  CARRIER_ASSIGNED: { status: "PICKED_UP", action: "Mark picked up" },
  PICKED_UP: { status: "IN_TRANSIT", action: "Mark in transit" },
  IN_TRANSIT: { status: "DELIVERED", action: "Mark delivered" },
  DELIVERED: { status: "COMPLETED", action: "Mark completed" },
};

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
