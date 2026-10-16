import { Suspense } from "react";
import { LeadRoute } from "@/components/sales/lead-screen";

// Lead ids are only known at request time, so param access sits inside Suspense (Cache Components rule).
export default function LeadPage({ params }: PageProps<"/app/sales/leads/[id]">) {
  return <Suspense><LeadRoute params={params} /></Suspense>;
}
