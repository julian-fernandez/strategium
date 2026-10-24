import type { Army, DataVersions } from "../../../shared/types";

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
    <div className="grid grid-cols-[420px_1fr] items-start gap-8">
      <section className="bg-panel hairline">
        <div className="border-b border-line px-6 py-4">
          <p className="micro">{"// "}Sources</p>
          <h2 className="mt-1 text-[18px] font-extrabold uppercase tracking-[0.04em]">
            Data versions
          </h2>
        </div>
        <dl className="flex flex-col px-6 py-2 text-[13px]">
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
    </div>
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
