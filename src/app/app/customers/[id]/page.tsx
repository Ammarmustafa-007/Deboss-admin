import { Suspense } from "react";
import { CustomerRoute } from "@/components/sales/customers-screen";

export default function CustomerPage({ params }: PageProps<"/app/customers/[id]">) {
  return <Suspense><CustomerRoute params={params} /></Suspense>;
}
