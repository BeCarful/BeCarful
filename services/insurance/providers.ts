// Maintained insurer metadata. This, not AI output, is the source of claim links.
// Re-verify URLs/phones when editing; see isOfficialUrl() for AI-suggested links.
export type InsuranceProvider = {
  id: string;
  name: string;
  shortName: string;
  color: string;
  claimsUrl: string;
  phone: string;
  officialDomains: string[];
  supportedStates: "all" | string[];
};

export const PROVIDERS: InsuranceProvider[] = [
  {
    id: "state-farm",
    name: "State Farm",
    shortName: "SF",
    color: "#e01a22",
    claimsUrl: "https://www.statefarm.com/claims",
    phone: "1-800-732-5246",
    officialDomains: ["statefarm.com"],
    supportedStates: "all",
  },
  {
    id: "geico",
    name: "GEICO",
    shortName: "GC",
    color: "#154b8b",
    claimsUrl: "https://www.geico.com/claims/",
    phone: "1-800-841-3000",
    officialDomains: ["geico.com"],
    supportedStates: "all",
  },
  {
    id: "progressive",
    name: "Progressive",
    shortName: "PG",
    color: "#0077c8",
    claimsUrl: "https://www.progressive.com/claims/",
    phone: "1-800-776-4737",
    officialDomains: ["progressive.com"],
    supportedStates: "all",
  },
  {
    id: "allstate",
    name: "Allstate",
    shortName: "AS",
    color: "#0033a0",
    claimsUrl: "https://www.allstate.com/claims",
    phone: "1-800-255-7828",
    officialDomains: ["allstate.com"],
    supportedStates: "all",
  },
  {
    id: "liberty-mutual",
    name: "Liberty Mutual",
    shortName: "LM",
    color: "#1a1446",
    claimsUrl: "https://www.libertymutual.com/claims-center",
    phone: "1-800-225-2467",
    officialDomains: ["libertymutual.com"],
    supportedStates: "all",
  },
  {
    id: "usaa",
    name: "USAA",
    shortName: "US",
    color: "#12395b",
    claimsUrl: "https://www.usaa.com/insurance/claims/",
    phone: "1-800-531-8722",
    officialDomains: ["usaa.com"],
    supportedStates: "all",
  },
];

export const DEFAULT_PROVIDER_ID = "state-farm";

export function getProvider(id: string | null | undefined): InsuranceProvider | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

/** True only for https URLs on one of the provider's official domains (or a subdomain). */
export function isOfficialUrl(provider: InsuranceProvider, url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" || u.username || u.password) return false;
  const host = u.hostname.toLowerCase();
  return provider.officialDomains.some((d) => host === d || host.endsWith(`.${d}`));
}
