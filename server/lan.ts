import { networkInterfaces } from "node:os";
import QRCode from "qrcode";
import { WEB_PORT } from "../shared/config";

export type LanAddress = {
  /** The network adapter, e.g. "Wi-Fi". */
  adapter: string;
  url: string;
  /** Whether the web app answers on it, which it only does under `pnpm dev:lan`. */
  reachable: boolean;
  qrSvg: string;
};

/** Virtual adapters that a phone on the Wi-Fi can't reach. */
const VIRTUAL = /vethernet|wsl|hyper-v|virtualbox|vmware|loopback|docker|tailscale|zerotier/i;

/** Addresses a phone or tablet on the same network could open the app at. */
export async function lanAddresses(): Promise<LanAddress[]> {
  const found: { adapter: string; ip: string }[] = [];
  for (const [adapter, addresses] of Object.entries(networkInterfaces())) {
    if (VIRTUAL.test(adapter)) continue;
    for (const address of addresses ?? []) {
      if (address.family === "IPv4" && !address.internal)
        found.push({ adapter, ip: address.address });
    }
  }

  return Promise.all(
    found.map(async ({ adapter, ip }) => {
      const url = `http://${ip}:${WEB_PORT}/`;
      const qrSvg = await QRCode.toString(url, {
        type: "svg",
        margin: 1,
        color: { dark: "#1f1f1c", light: "#f3f1ec" },
      });
      return { adapter, url, reachable: await answers(url), qrSvg };
    }),
  );
}

async function answers(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(800) });
    return response.ok;
  } catch {
    return false;
  }
}
