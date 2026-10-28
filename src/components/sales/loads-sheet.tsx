"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { money } from "@/lib/format";
import { errorMessage, responseData } from "@/lib/api";
import { useBrokerage } from "@/components/app/brokerage-context";
import { Chip, StatusChip, toneFor } from "@/components/ui/surface";
import { FullSheet, Sheet, type SheetColumn } from "@/components/fronter/sheet";
import { quoteStageLabel, type Quote, type SalesShipment } from "@/components/sales/model";

/**
 * A customer's Loads / Quotes sheet (client flow v2, section 3.2): Date, Pickup, Delivery, Miles, Truck, Weight,
 * Commodity, Quoted rate, Agreed rate, Notes, edited in place. Entering an agreed rate makes the lead a Customer,
 * as it does from the load drawer. Carrier rate and profit come from Operations and are read-only here.
 */

/** Sheet column -> field the Sales shipment API expects (rates are named differently there). */
const apiField: Record<string, string> = { amount_quoted: "quoted_rate", amount_agreed: "agreed_rate" };
const numeric = new Set(["miles", "amount_quoted", "amount_agreed"]);

export function LoadsSheet({ customerId, shipments, quotes, canEdit, onClose }: { customerId: string; shipments: SalesShipment[]; quotes: Quote[]; canEdit: boolean; onClose: () => void }) {
  const { api, report } = useBrokerage();
  const queryClient = useQueryClient();
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const quoteOf = new Map(quotes.map((quote) => [quote.id, quote]));
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["brokerage"] });
  const setBusy = (id: string, value: boolean) => setBusyIds((current) => { const next = new Set(current); if (value) next.add(id); else next.delete(id); return next; });
  const cancelled = (load: SalesShipment) => load.sales_status === "CANCELLED" || load.status === "CANCELLED";
  const toApi = (key: string, value: string | boolean | null) => [apiField[key] ?? key, numeric.has(key) ? (value === null || value === "" ? null : Number(value)) : value] as const;

  const patch = async (load: SalesShipment, key: string, value: string | boolean | null) => {
    setBusy(load.id, true);
    // Show the edit straight away; the refreshed profile settles it.
    queryClient.setQueryData<{ shipments: SalesShipment[] }>(["brokerage", "customer", customerId], (current) => current ? { ...current, shipments: current.shipments.map((item) => item.id === load.id ? { ...item, [key]: value } : item) } : current);
    const [field, sent] = toApi(key, value);
    try { await responseData(await api(`/api/v1/brokerage/sales-shipments/${load.id}`, { method: "PATCH", body: JSON.stringify({ [field]: sent }) })); if (key === "amount_agreed" && sent) report("Agreed rate saved."); }
    catch (error) { report(errorMessage(error), "error"); }
    finally { setBusy(load.id, false); void refresh(); }
  };
  // Pasted rows become new loads; each needs a reference, a pickup and a delivery.
  const create = async (rows: Record<string, string>[]) => {
    let added = 0; let skipped = 0;
    for (const row of rows) {
      const body = Object.fromEntries(Object.entries(row).filter(([, value]) => value !== "").map(([key, value]) => toApi(key, value)));
      if (!body.reference_number || !body.pickup_location || !body.delivery_location) { skipped++; continue; }
      try { await responseData(await api(`/api/v1/brokerage/customers/${customerId}/shipments`, { method: "POST", body: JSON.stringify(body) })); added++; } catch { skipped++; }
    }
    report(`${added} load${added === 1 ? "" : "s"} added${skipped ? `, ${skipped} skipped (each needs a reference, pickup and delivery)` : ""}.`, added ? "success" : "error");
    void refresh();
  };

  const profitCell = (load: SalesShipment) => load.profit == null ? <span className="text-muted">—</span>
    : <span className={cn("font-semibold tabular-nums", load.profit < 0 ? "text-[#A5183F]" : "text-[#14693A]")}>{money(load.profit)}{load.profit_pct != null ? ` · ${load.profit_pct}%` : ""}</span>;
  const statusCell = (load: SalesShipment) => {
    if (cancelled(load)) return <StatusChip status="CANCELLED" label="Cancelled" />;
    if (load.status === "MISSED_PICKUP") return <StatusChip status="MISSED_PICKUP" label="Missed pickup" />;
    const quote = load.quote_id ? quoteOf.get(load.quote_id) : undefined;
    return quote ? <Chip tone={toneFor(quote.stage)}>{quoteStageLabel[quote.stage] ?? quote.stage}</Chip> : <StatusChip status={load.sales_status ?? load.status} />;
  };

  const columns: SheetColumn<SalesShipment>[] = [
    { key: "reference_number", label: "Reference", width: 125, required: true, sticky: true },
    { key: "quote_id", label: "Status", width: 135, render: statusCell },
    { key: "pickup_date", label: "Date", width: 130, type: "date" },
    { key: "pickup_location", label: "Pickup", width: 150, required: true },
    { key: "delivery_location", label: "Delivery", width: 150, required: true },
    { key: "miles", label: "Miles", width: 80, type: "number" },
    { key: "equipment_type", label: "Truck", width: 110 },
    { key: "commodity_weight", label: "Weight", width: 105 },
    { key: "commodity_product", label: "Commodity", width: 130 },
    { key: "amount_quoted", label: "Quoted rate", width: 105, type: "number" },
    { key: "amount_agreed", label: "Agreed rate", width: 105, type: "number" },
    { key: "load_notes", label: "Notes", width: 200 },
    { key: "carrier_rate", label: "Carrier rate", width: 105, render: (load) => <span className="tabular-nums text-ink/70">{load.carrier_rate == null ? "—" : money(load.carrier_rate)}</span> },
    { key: "profit", label: "Profit", width: 140, render: profitCell },
    { key: "operations_agent_name", label: "Ops agent", width: 130, render: (load) => <span className="text-ink/70">{load.operations_agent_name ?? "—"}</span> },
  ];

  return <FullSheet title="Loads / Quotes" noun={["load", "loads"]} count={shipments.length} total={shipments.length} onClose={onClose}>
    <Sheet columns={columns} rows={shipments} locked={(load) => !canEdit || cancelled(load)} busy={(load) => busyIds.has(load.id)} maxHeight="calc(100dvh - 120px)"
      onChange={(load, key, value) => void patch(load, key, value)}
      onPasteRows={canEdit ? (rows) => void create(rows) : undefined}
      empty={canEdit ? "No loads yet. Add the first one from the profile; after that you can paste more rows here (Reference, Date, Pickup, Delivery, Miles, …)." : "No loads yet."} />
  </FullSheet>;
}
