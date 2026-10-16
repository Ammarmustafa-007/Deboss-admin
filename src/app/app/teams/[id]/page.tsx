import { Suspense } from "react";
import { TeamRoute } from "@/components/teams/teams-screens";

export default function TeamPage({ params }: PageProps<"/app/teams/[id]">) {
  return <Suspense><TeamRoute params={params} /></Suspense>;
}
