import { Suspense } from "react";
import { CarrierScreen } from "@/components/dispatch/carrier-screen";

// Carrier ids are only known at request time, so param access sits inside Suspense (Cache Components rule).
export default function CarrierPage({ params }: PageProps<"/app/dispatch/carriers/[id]">) {
  return <Suspense><CarrierScreen params={params} /></Suspense>;
}
