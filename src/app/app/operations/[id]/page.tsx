import { Suspense } from "react";
import { ShipmentRoute } from "@/components/operations/shipment-screen";

// Shipment ids are only known at request time, so param access sits inside Suspense (Cache Components rule).
export default function ShipmentPage({ params }: PageProps<"/app/operations/[id]">) {
  return <Suspense><ShipmentRoute params={params} /></Suspense>;
}
