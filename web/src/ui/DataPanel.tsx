import { useEffect, useState } from "react";
import type { LanAddress } from "../../../server/lan";
import type { AuditFinding, DataHealth } from "../../../shared/audit";
import type { Army, DataVersions } from "../../../shared/types";
import { fetchHealth } from "../api";
import { api, read } from "../client";

/** How many places a finding lists before "and N more". */
const PLACES = 30;

export function DataPanel({
  army,
  meta,
  checking,
  onCheck,
}: {
  army: Army;
  meta?: DataVersions;
  checking: boolean;
  onCheck: () => void;
}) {
  const versions = meta ?? army.data;
  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[420px_1fr] lg:gap-8">
      <section className="bg-panel hairline">
        <div className="border-b border-line px-6 py-4">
          <p className="micro">{"// "}Sources</p>
          <h2 className="mt-1 text-[18px] font-extrabold uppercase tracking-[0.04em]">
            Data versions
          </h2>
        </div>
        <dl className="flex flex-col px-6 py-2 text-[13px]">
          {army.format ? <Row label="List read as">{army.format.label}</Row> : null}
          <Row label="BSData commit">
            {versions.bsdataSha ? (
              <a
                className="underline decoration-line-strong underline-offset-4 hover:decoration-ink"
                href={`https://github.com/BSData/wh40k-11e/commit/${versions.bsdataSha}`}
                target="_blank"
                rel="noreferrer"
              >
                {versions.bsdataSha.slice(0, 7)}
              </a>
            ) : (
              "–"
            )}{" "}
            <span className="text-ink-dim">{formatDate(versions.bsdataDate)}</span>
          </Row>
          <Row label="Wahapedia">{versions.wahapediaUpdate ?? "–"}</Row>
          <Row label="Last checked">{formatDate(versions.checkedAt)}</Row>
          <Row label="Last change">{formatDate(versions.changedAt)}</Row>
          {versions.lastError ? (
            <Row label="Last error">
              <span className="text-seal">{versions.lastError}</span>
            </Row>
          ) : null}
        </dl>
        <div className="border-t border-line px-6 py-4">
          <button type="button" className="btn w-full" disabled={checking} onClick={onCheck}>
            {checking ? "Checking…" : "Check for updates now"}
          </button>
          <p className="mt-3 text-[12px] leading-relaxed text-ink-dim">
            The server also checks on its own every six hours. Datasheets come from BSData;
            stratagems and background text from Wahapedia.
          </p>
        </div>
      </section>

      <section className="bg-panel hairline">
        <div className="border-b border-line px-6 py-4">
          <p className="micro">{"// "}Cross-check</p>
          <h2 className="mt-1 text-[18px] font-extrabold uppercase tracking-[0.04em]">
            BSData against Wahapedia
          </h2>
        </div>
        {army.crossCheck.length ? (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left">
                {["Unit", "Field", "BSData", "Wahapedia"].map((heading) => (
                  <th key={heading} className="micro px-6 py-3 font-semibold">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {army.crossCheck.map((issue) => (
                <tr key={`${issue.unit}-${issue.field}`} className="border-t border-line">
                  <td className="px-6 py-2">{issue.unit}</td>
                  <td className="px-6 py-2 text-ink-dim">{issue.field}</td>
                  <td className="px-6 py-2 font-semibold text-seal">{issue.bsdata}</td>
                  <td className="px-6 py-2 font-semibold">{issue.wahapedia}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="px-6 py-5 text-[14px] leading-relaxed text-ink-dim">
            The two sources agree on every stat line and weapon profile in this army.
          </p>
        )}
      </section>

      <DataHealthPanel changedAt={versions.changedAt} />

      <OnYourNetwork />
    </div>
  );
}

/**
 * The server's audit of every faction's data, run after each update: whether
 * anything would show wrong on a card, and what's only worth knowing.
 */
function DataHealthPanel({ changedAt }: { changedAt?: string }) {
  const [state, setState] = useState<{ health: DataHealth | null; running: boolean }>();
  const [failed, setFailed] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: new data means a new audit, so ask again.
  useEffect(() => {
    let stopped = false;
    let timer: number | undefined;
    const load = () =>
      fetchHealth().then(
        (next) => {
          if (stopped) return;
          setState(next);
          setFailed(false);
          // While an audit runs, look again shortly.
          if (next.running) timer = window.setTimeout(load, 3000);
        },
        () => {
          if (!stopped) setFailed(true);
        },
      );
    void load();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [changedAt]);

  const health = state?.health;
  const errors = health?.findings.filter((f) => f.severity === "error") ?? [];
  const notes = health?.findings.filter((f) => f.severity === "note") ?? [];

  return (
    <section className="bg-panel hairline lg:col-span-2">
      <div className="border-b border-line px-6 py-4">
        <p className="micro">{"// "}Data health</p>
        <h2 className="mt-1 text-[18px] font-extrabold uppercase tracking-[0.04em]">
          Every faction, checked
        </h2>
      </div>
      <div className="px-6 py-5 text-[14px] leading-relaxed text-ink-dim">
        <p>
          After each data update the server reads every unit, weapon, ability, stratagem, detachment
          rule and enhancement of every faction, looking for anything a card would show wrong:
          missing text, markup left in it, a blank column.
        </p>
        {failed ? (
          <p className="mt-4">Couldn't reach the server for its data check.</p>
        ) : !state ? (
          <p className="mt-4">Loading…</p>
        ) : !health ? (
          <p className="mt-4">
            {state.running ? "Checking every faction's data for the first time…" : "No data yet."}
          </p>
        ) : (
          <>
            <p className={`mt-4 font-semibold ${health.errors ? "text-seal" : "text-ink"}`}>
              {health.errors
                ? `${health.errors} ${health.errors === 1 ? "thing" : "things"} in the data would show wrong.`
                : "Nothing in the data would show wrong."}
            </p>
            <p className="mt-1 text-[12px]">
              {health.units.toLocaleString("en")} units, {health.stratagems.toLocaleString("en")}{" "}
              stratagems and {health.detachments} detachments across {health.factions} factions ·
              checked {formatDate(health.checkedAt)}
              {state.running ? " · checking newer data now…" : ""}
            </p>
            <div className="mt-4">
              {errors.map((finding) => (
                <Finding key={finding.kind} finding={finding} open />
              ))}
            </div>
            {notes.length ? (
              <div className="mt-4">
                <p className="micro">Worth knowing</p>
                {notes.map((finding) => (
                  <Finding key={finding.kind} finding={finding} />
                ))}
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

function Finding({ finding, open }: { finding: AuditFinding; open?: boolean }) {
  const shown = finding.places.slice(0, PLACES);
  return (
    <details open={open} className="border-t border-line py-2 first:border-t-0">
      <summary className="cursor-pointer text-[13px]">
        <span className={finding.severity === "error" ? "text-seal" : "text-ink"}>
          {finding.kind.charAt(0).toUpperCase() + finding.kind.slice(1)}
        </span>
        <span className="text-ink-faint"> · {finding.places.length}</span>
      </summary>
      <ul className="mt-2 flex flex-col gap-0.5 pl-4 text-[12px] text-ink-dim">
        {shown.map((place) => (
          <li key={place}>{place}</li>
        ))}
      </ul>
      {finding.places.length > shown.length ? (
        <p className="mt-1 pl-4 text-[12px] text-ink-faint">
          … and {finding.places.length - shown.length} more
        </p>
      ) : null}
    </details>
  );
}

/** How to open the app on a phone or tablet on the same Wi-Fi, with a QR code to scan. */
function OnYourNetwork() {
  const [addresses, setAddresses] = useState<LanAddress[]>();
  const onLan = !["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);

  useEffect(() => {
    if (onLan) return;
    api.lan
      .$get()
      .then(read)
      .then(setAddresses, () => setAddresses([]));
  }, [onLan]);

  const reachable = addresses?.filter((address) => address.reachable) ?? [];

  return (
    <section className="bg-panel hairline lg:col-span-2">
      <div className="border-b border-line px-6 py-4">
        <p className="micro">{"// "}Play from the table</p>
        <h2 className="mt-1 text-[18px] font-extrabold uppercase tracking-[0.04em]">
          On a phone or tablet
        </h2>
      </div>
      <div className="px-6 py-5 text-[14px] leading-relaxed text-ink-dim">
        {onLan ? (
          <p>You're already on it: this device is using the network address.</p>
        ) : addresses === undefined ? (
          <p>Looking for this computer's network address…</p>
        ) : reachable.length ? (
          <div className="flex flex-wrap gap-6">
            {reachable.map((address) => (
              <div key={address.url} className="flex items-center gap-4">
                {/* Generated on our own server from the URL. */}
                <div
                  className="h-36 w-36 shrink-0 [&_svg]:h-full [&_svg]:w-full"
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: QR code SVG generated by our server.
                  dangerouslySetInnerHTML={{ __html: address.qrSvg }}
                />
                <div>
                  <p className="micro">{address.adapter}</p>
                  <p className="mt-1 text-[16px] font-semibold text-ink">{address.url}</p>
                  <p className="mt-2 max-w-[38ch] text-[13px]">
                    Scan with a phone or tablet on the same Wi-Fi, then open the Play tab.
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              Stop the app and start it with <code className="text-ink">pnpm dev:lan</code> instead
              of <code className="text-ink">pnpm dev</code>.
            </li>
            <li>If Windows asks, allow Node.js on private networks.</li>
            <li>Come back here for a QR code to scan with your phone or tablet.</li>
          </ol>
        )}
      </div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-3 last:border-b-0">
      <dt className="micro">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

function formatDate(value: string | undefined): string {
  if (!value) return "–";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
