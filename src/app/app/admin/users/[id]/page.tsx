import { Suspense } from "react";
import { UserRoute } from "@/components/admin/users-screen";

export default function UserPage({ params }: PageProps<"/app/admin/users/[id]">) {
  return <Suspense><UserRoute params={params} /></Suspense>;
}
