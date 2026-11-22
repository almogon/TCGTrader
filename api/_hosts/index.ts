import { isHostId, type HostId } from "../../src/hostCatalog.js";
import type { CardHost } from "./CardHost.js";
import { ApitcgHost } from "./ApitcgHost.js";
import { TcggoHost } from "./TcggoHost.js";

export const HOSTS: Record<HostId, CardHost> = {
  tcggo: new TcggoHost(),
  apitcg: new ApitcgHost(),
};

export function getHost(id: string): CardHost | null {
  return isHostId(id) ? HOSTS[id] : null;
}
