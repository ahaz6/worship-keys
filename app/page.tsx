import { WorshipKeysApp } from "./worship-keys-app";

export default function HostPage() {
  const cloudDeployment =
    process.env.VERCEL === "1" || process.env.NEXT_PUBLIC_WORSHIP_KEYS_CLOUD === "1";
  return <WorshipKeysApp runtime={cloudDeployment ? "cloud" : "local"} />;
}
