import { Suspense } from "react";
import { AppFrame } from "@/components/app/app-frame";
import { WorkspaceSplash } from "@/components/app/workspace-splash";

// Everything under /app depends on the browser session, so the whole frame renders on the client.
// The Suspense boundary also covers usePathname/useParams once record routes ([id]) are added.
export default function AppLayout({ children }: LayoutProps<"/app">) {
  return <Suspense fallback={<WorkspaceSplash />}><AppFrame>{children}</AppFrame></Suspense>;
}
