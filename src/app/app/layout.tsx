import { Suspense } from "react";
import { AppFrame } from "@/components/app/app-frame";
import { IntroBackdrop } from "@/components/app/intro";

// Everything under /app depends on the browser session, so the whole frame renders on the client.
// The Suspense boundary also covers usePathname/useParams once record routes ([id]) are added.
export default function AppLayout({ children }: LayoutProps<"/app">) {
  return <Suspense fallback={<IntroBackdrop />}><AppFrame>{children}</AppFrame></Suspense>;
}
