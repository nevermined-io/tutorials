"use client";

import { Thread } from "@/components/thread";
import { PaymentBanner } from "@/components/thread/payment-banner";
import { StreamProvider } from "@/providers/Stream";
import { ThreadProvider } from "@/providers/Thread";
import { ArtifactProvider } from "@/components/thread/artifact";
import { Toaster } from "@/components/ui/sonner";
import React from "react";

export default function DemoPage(): React.ReactNode {
  return (
    <React.Suspense fallback={<div>Loading (layout)...</div>}>
      <Toaster />
      <div className="flex h-screen w-full flex-col overflow-hidden">
        <PaymentBanner />
        <div className="min-h-0 flex-1">
          <ThreadProvider>
            <StreamProvider>
              <ArtifactProvider>
                <Thread />
              </ArtifactProvider>
            </StreamProvider>
          </ThreadProvider>
        </div>
      </div>
    </React.Suspense>
  );
}
