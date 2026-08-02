import { Suspense } from "react";

import { JoinClient } from "./join-client";

export const metadata = {
  title: "Join · Worship Keys",
};

export default function JoinPage() {
  return (
    <Suspense fallback={<div className="centered-page" />}>
      <JoinClient />
    </Suspense>
  );
}
