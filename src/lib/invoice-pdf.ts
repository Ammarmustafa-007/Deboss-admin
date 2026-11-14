"use client";

import type { DispatchInvoice, Load } from "@/components/dispatch/model";

/**
 * Builds a Dispatch weekly invoice as a real PDF and downloads it (no print dialog).
 * Dispatch invoices go out under BACKEND SOLUTIONS (client request), not DEBOSS GLOBAL: black header band with the
 * Backend Solutions logo (drawn on black), its yellow and purple, bill-to and invoice details, the loads table, then the
 * totals, with a footer and page numbers on every page. The dispatcher shows under their pseudo name when they have one.
 */

const company = { name: "BACKEND SOLUTIONS", tagline: "Your one stop trucking solutions", logo: "/brand/backend-solutions-logo.jpg", logoRatio: 266 / 800 };
const brand: [number, number, number] = [237, 210, 43]; // logo yellow
const accent: [number, number, number] = [112, 30, 210]; // logo purple
const ink: [number, number, number] = [0, 0, 0];
const muted: [number, number, number] = [92, 90, 104];
const line: [number, number, number] = [228, 225, 236];
const tint: [number, number, number] = [244, 239, 253];

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const money = (value: unknown) => { const number = Number(value); return Number.isFinite(number) ? usd.format(number) : "-"; };
const day = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};
const statusLabel: Record<string, string> = { DRAFT: "Draft", SUBMITTED: "Submitted for review", FORWARDED: "Sent to accounting", PAID: "Paid", CANCELLED: "Cancelled" };
const paymentLabel: Record<string, string> = { ACH: "ACH", CHECK: "Check", ZELLE: "Zelle", WIRE: "Wire transfer", FACTORING: "Factoring", OTHER: "Other" };
const truckLabel: Record<string, string> = { DRY_VAN: "Dry van", REEFER: "Reefer", FLATBED: "Flatbed", STEP_DECK: "Step deck", POWER_ONLY: "Power only", BOX_TRUCK: "Box truck", HOTSHOT: "Hotshot", OTHER: "Other" };

async function logoDataUrl() {
  try {
    const response = await fetch(company.logo);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string | null>((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => resolve(null); reader.readAsDataURL(blob); });
  } catch { return null; }
}

export async function downloadDispatchInvoicePdf(invoice: DispatchInvoice, loads: Load[]) {
  const doc = await buildDispatchInvoicePdf(invoice, loads, await logoDataUrl());
  doc.save(/^\d+$/.test(invoice.invoice_number) ? `Invoice-${invoice.invoice_number}.pdf` : `${invoice.invoice_number}.pdf`);
}

/** The invoice document itself (also used to preview it outside the browser). */
export async function buildDispatchInvoicePdf(invoice: DispatchInvoice, loads: Load[], logo: string | null) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 16;
  const carrier = invoice.carrier;
  const truck = invoice.truck;
  const live = loads.filter((load) => load.status !== "CANCELLED");

  // Header band with the logo (it is drawn on black, so the band is black too).
  doc.setFillColor(...ink); doc.rect(0, 0, width, 34, "F");
  doc.setFillColor(...accent); doc.rect(0, 34, width, 1.4, "F");
  if (logo) doc.addImage(logo, "JPEG", margin - 4, 6, 66, 66 * company.logoRatio);
  else { doc.setTextColor(...brand); doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.text(company.name, margin, 20); }
  doc.setTextColor(...brand); doc.setFont("helvetica", "bold"); doc.setFontSize(24); doc.text("INVOICE", width - margin, 18, { align: "right" });
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.text(`#${invoice.invoice_number}`, width - margin, 25, { align: "right" });

  // Bill to (left) and invoice details (right).
  let y = 47;
  const label = (text: string, x: number, at: number) => { doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(...muted); doc.text(text.toUpperCase(), x, at); };
  label("Bill to", margin, y);
  doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...ink);
  const billName = doc.splitTextToSize(carrier?.company_name ?? "Carrier", 88);
  doc.text(billName, margin, y + 6);
  let left = y + 6 + billName.length * 5.2;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(...muted);
  const billLines = [
    [carrier?.mc_number && `MC ${carrier.mc_number}`, carrier?.dot_number && `DOT ${carrier.dot_number}`].filter(Boolean).join("   ·   "),
    carrier?.contact_name ?? "", carrier?.phone ?? "", carrier?.email ?? "",
    carrier?.payment_method ? `Payment method: ${paymentLabel[carrier.payment_method] ?? carrier.payment_method}` : "",
  ].filter(Boolean);
  for (const text of billLines) { doc.text(text, margin, left); left += 4.8; }

  const detailX = width / 2 + 10;
  label("Invoice details", detailX, y);
  const details: [string, string][] = [
    ["Invoice #", `#${invoice.invoice_number}`],
    ["Issued", day(invoice.created_at)],
    ["Week", `${day(invoice.week_start)} - ${day(invoice.week_end)}`],
    ["Due date", day(invoice.due_date)],
    ["Truck", truck ? `${truck.unit_number} · ${truckLabel[truck.truck_type] ?? truck.truck_type}` : "-"],
    ["Dispatcher", invoice.dispatcher_pseudo_name || invoice.dispatcher_name || "-"],
    ["Status", statusLabel[invoice.status] ?? invoice.status],
  ];
  let right = y + 6;
  for (const [key, value] of details) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...muted); doc.text(key, detailX, right);
    doc.setFont("helvetica", "bold"); doc.setTextColor(...ink); doc.text(value, width - margin, right, { align: "right" });
    right += 5.4;
  }
  y = Math.max(left, right) + 4;
  doc.setDrawColor(...line); doc.setLineWidth(0.3); doc.line(margin, y, width - margin, y);

  // Loads on this invoice.
  autoTable(doc, {
    startY: y + 5,
    margin: { left: margin, right: margin, bottom: 22 },
    head: [["Pickup", "Load #", "Broker", "Lane", "Delivery", "Miles", "Rate"]],
    body: live.length ? live.map((load) => [
      day(load.pickup_date), load.load_number || "-", load.broker_name || "-",
      `${[load.pickup_city, load.pickup_zip].filter(Boolean).join(" ") || "-"}  ->  ${[load.delivery_city, load.delivery_zip].filter(Boolean).join(" ") || "-"}`,
      day(load.delivery_date), load.miles != null ? Number(load.miles).toLocaleString("en-US") : "-", money(load.rate),
    ]) : [[{ content: "No loads on this invoice.", colSpan: 7, styles: { halign: "center", textColor: muted } }]],
    foot: live.length ? [[{ content: `${live.length} load${live.length === 1 ? "" : "s"}`, colSpan: 5 }, live.reduce((sum, load) => sum + Number(load.miles ?? 0), 0).toLocaleString("en-US"), money(live.reduce((sum, load) => sum + Number(load.rate), 0))]] : undefined,
    theme: "grid",
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 2.4, textColor: ink, lineColor: line, lineWidth: 0.2, valign: "middle" },
    headStyles: { fillColor: accent, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
    footStyles: { fillColor: tint, textColor: ink, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 249, 253] },
    columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 20 }, 2: { cellWidth: 30 }, 4: { cellWidth: 22 }, 5: { cellWidth: 15, halign: "right" }, 6: { cellWidth: 22, halign: "right" } },
  });

  // Totals, right-aligned under the table.
  const afterTable = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 20;
  let totalsY = afterTable + 8;
  if (totalsY + 53 > height - 22) { doc.addPage(); totalsY = 24; }
  const boxX = width - margin - 84;
  const rows: [string, string, boolean?][] = [
    ["Loads total (gross)", money(invoice.gross_amount)],
    ["Charge", `${Number(invoice.charge_percent)}%`],
    ["Invoice amount", money(invoice.amount)],
    ["Paid", money(invoice.amount_paid)],
  ];
  doc.setFontSize(9.5);
  rows.forEach(([key, value], index) => {
    const at = totalsY + index * 6.4;
    doc.setFont("helvetica", "normal"); doc.setTextColor(...muted); doc.text(key, boxX, at);
    doc.setFont("helvetica", "bold"); doc.setTextColor(...ink); doc.text(value, width - margin, at, { align: "right" });
  });
  const dueY = totalsY + rows.length * 6.4 + 1;
  const outstanding = invoice.status === "CANCELLED" ? 0 : Math.max(0, Number(invoice.amount) - Number(invoice.amount_paid));
  doc.setFillColor(...ink); doc.roundedRect(boxX - 4, dueY, 88, 12, 2, 2, "F");
  doc.setTextColor(255, 255, 255); doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.text("Balance due", boxX, dueY + 7.8);
  doc.setTextColor(...brand); doc.setFontSize(13); doc.text(money(outstanding), width - margin - 4, dueY + 8, { align: "right" });

  // Note on the left of the totals.
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...muted);
  doc.text(doc.splitTextToSize(`Dispatch service charge for the week of ${day(invoice.week_start)}, calculated as ${Number(invoice.charge_percent)}% of the loads total. Please pay by ${day(invoice.due_date)} and quote invoice #${invoice.invoice_number} with your payment.`, boxX - margin - 12), margin, totalsY);

  // Keep the payment destination beside the balance so it remains visible on a printed invoice.
  const paymentWidth = boxX - margin - 10;
  doc.setFillColor(...tint); doc.roundedRect(margin, dueY - 4, paymentWidth, 20, 2, 2, "F");
  doc.setTextColor(...accent); doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.text("PAY WITH ZELLE", margin + 4, dueY + 1);
  doc.setTextColor(...ink); doc.setFontSize(9); doc.text("Backend Solutions LLC", margin + 4, dueY + 7);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.text("backendsolllc@gmail.com", margin + 4, dueY + 12);

  // Footer on every page.
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(...line); doc.line(margin, height - 14, width - margin, height - 14);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...muted);
    doc.text(`${company.name}  ·  ${company.tagline}  ·  Thank you for your business`, margin, height - 9);
    doc.text(`Page ${page} of ${pages}`, width - margin, height - 9, { align: "right" });
  }
  return doc;
}
