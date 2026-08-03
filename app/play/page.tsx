import { WorshipKeysApp } from "../worship-keys-app";

export const metadata = {
  title: "Play · Worship Keys",
  description: "Play Sound Wall Pads with a Web MIDI keyboard directly in your browser.",
};

/**
 * Stable cloud-performance route. It also works on the local server, which
 * makes the Vercel behaviour testable without pretending that a LAN session
 * exists in a serverless deployment.
 */
export default function PlayPage() {
  return <WorshipKeysApp runtime="cloud" />;
}
