export type LanAddress = { interface: string; address: string };

export function isPrivateIPv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return false;
  }
  const [first = -1, second = -1] = octets;
  return first === 10
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 168);
}

function addressScore(entry: LanAddress): number {
  const name = entry.interface.toLowerCase();
  let score = isPrivateIPv4(entry.address) ? 100 : 0;
  if (/^en\d+$/.test(name)) score += 50;
  if (/^(eth|wlan)\d+$/.test(name)) score += 45;
  if (/^(utun|awdl|llw|bridge|docker|vbox|vmnet)/.test(name)) score -= 80;
  if (entry.address.startsWith("169.254.")) score -= 100;
  return score;
}

export function sortLanAddresses(entries: LanAddress[]): LanAddress[] {
  return [...entries].sort((left, right) => addressScore(right) - addressScore(left));
}

export function selectPreferredLanAddress(entries: LanAddress[], override?: string): string | null {
  const requested = override?.trim();
  if (requested && entries.some((entry) => entry.address === requested)) return requested;
  return sortLanAddresses(entries)[0]?.address ?? null;
}
