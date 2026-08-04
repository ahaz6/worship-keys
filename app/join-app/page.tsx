import type { Metadata } from "next";

import { JoinCodeClient } from "./join-code-client";

export const metadata: Metadata = {
  title: "Worship Join",
  description: "Join a live Worship Keys session locally or through Cloud Live.",
  applicationName: "Worship Join",
  manifest: "/join-manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Worship Join",
    statusBarStyle: "black-translucent",
  },
};

export default function JoinAppPage() {
  return <JoinCodeClient />;
}
