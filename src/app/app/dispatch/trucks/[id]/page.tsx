import { Suspense } from "react";
import { TruckScreen } from "@/components/dispatch/truck-screen";

// Truck ids are only known at request time, so param access sits inside Suspense (Cache Components rule).
export default function TruckPage({ params }: PageProps<"/app/dispatch/trucks/[id]">) {
  return <Suspense><TruckScreen params={params} /></Suspense>;
}
