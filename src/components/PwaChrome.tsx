"use client";

import { InstallHint } from "@/components/InstallHint";
import { OfflineBanner } from "@/components/OfflineBanner";

/** Wspólne nakładki PWA (instalacja + offline) dla całej aplikacji. */
export function PwaChrome({ children }: { children: React.ReactNode }) {
  return (
    <>
      <InstallHint />
      {children}
      <OfflineBanner />
    </>
  );
}
