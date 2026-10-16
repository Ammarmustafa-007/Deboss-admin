import { AlertTriangle, Bell, ClipboardCheck, FileText, Hourglass, MessageSquare, ReceiptText, Truck, type LucideIcon } from "lucide-react";
import type { Tone } from "@/components/ui/surface";
import type { Quote } from "@/components/sales/model";

export type NotificationItem = { id: string; title: string; body?: string | null; kind: string; created_at: string; read_at?: string | null; entity_type?: string | null; entity_id?: string | null };

export function kindStyle(kind: string): { icon: LucideIcon; tone: Tone } {
  if (kind.includes("COMMENT")) return { icon: MessageSquare, tone: "info" };
  if (kind.includes("SUBMITTED") || kind.includes("REVIEW")) return { icon: Hourglass, tone: "brand" };
  if (kind.includes("APPROVED") || kind.includes("VERIFIED")) return { icon: ClipboardCheck, tone: "success" };
  if (kind.includes("EXCEPTION") || kind.includes("REJECT") || kind.includes("OVERDUE")) return { icon: AlertTriangle, tone: "danger" };
  if (kind.includes("INVOICE")) return { icon: ReceiptText, tone: "accent" };
  if (kind.includes("DOCUMENT")) return { icon: FileText, tone: "aqua" };
  if (kind.includes("SHIPMENT") || kind.includes("ASSIGN") || kind.includes("HANDOFF")) return { icon: Truck, tone: "aqua" };
  return { icon: Bell, tone: "neutral" };
}

/** Where a notification's record lives in the app, when the viewer can open it. */
export function notificationHref(item: NotificationItem, sales: boolean, quotes: Quote[]) {
  if (!item.entity_id) return null;
  switch (item.entity_type) {
    case "LEAD": return sales ? `/app/sales/leads/${item.entity_id}` : null;
    case "CUSTOMER": return sales ? `/app/customers/${item.entity_id}` : null;
    case "QUOTE": { const quote = quotes.find((candidate) => candidate.id === item.entity_id); return quote ? `/app/sales/leads/${quote.lead_id}` : null; }
    case "SHIPMENT": return sales ? null : `/app/operations/${item.entity_id}`;
    case "INVOICE": return sales ? null : "/app/invoices";
    default: return null;
  }
}

/** "5m", "3h", "2d" style age for compact lists. */
export function timeAgo(value: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return days < 7 ? `${days}d` : new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
