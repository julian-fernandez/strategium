import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { META_POLL_MS } from "../../shared/config";
import { duplicateNumbers } from "../../shared/labels";
import type { Army, DataVersions } from "../../shared/types";
import {
  checkForUpdates,
  fetchArmy,
  fetchMeta,
  type ListSource,
  loadSavedOptions,
  loadSavedSource,
  saveOptions,
  saveSource,
} from "./api";
import type { DeckOptions } from "./cards/printOrder";
import { themeFor } from "./cards/themes";
import { ArmyView } from "./ui/ArmyView";
import { CardsView } from "./ui/CardsView";
import { DataPanel } from "./ui/DataPanel";
import { LoadPanel } from "./ui/LoadPanel";
import { Ornament } from "./ui/Ornament";
import { StratagemsView } from "./ui/StratagemsView";
import { TABS, type Tab, TopBar } from "./ui/TopBar";

export function App() {
  const [source, setSource] = useState<ListSource | undefined>(loadSavedSource);
  const [army, setArmy] = useState<Army>();
  const [listText, setListText] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [showLoader, setShowLoader] = useState(false);
  const [tab, setTab] = useState<Tab>("army");
  const [selectedId, setSelectedId] = useState<string>();
  const [options, setOptions] = useState<DeckOptions>(loadSavedOptions);
  const [meta, setMeta] = useState<DataVersions>();
  const [checking, setChecking] = useState(false);
  const fontsReady = useFontsReady();

  const load = useCallback(async (next: ListSource) => {
    setLoading(true);
    setError(undefined);
    try {
      const result = await fetchArmy(next);
      setArmy(result.army);
      setListText(result.text);
      setSource(next);
      saveSource(next);
      setShowLoader(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload the last list on start. A linked list is fetched again, so edits there show up.
  const started = useRef(false);
  useEffect(() => {
    if (started.current || !source) return;
    started.current = true;
    void load(source);
  }, [source, load]);

  useEffect(() => {
    const poll = () => fetchMeta().then(setMeta, () => undefined);
    poll();
    const timer = setInterval(poll, META_POLL_MS);
    return () => clearInterval(timer);
  }, []);

  const print = useCallback(() => {
    setTab("cards");
    // Let the deck render and fit its text before the print dialog opens.
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!army || showLoader || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
        return;
      const index = TABS.findIndex((t) => t.id === tab);
      const key = event.key.toLowerCase();
      if (key === "q") setTab(TABS[(index + TABS.length - 1) % TABS.length]?.id ?? tab);
      if (key === "e") setTab(TABS[(index + 1) % TABS.length]?.id ?? tab);
      if (key === "p") print();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [army, showLoader, tab, print]);

  const changeOptions = useCallback((next: DeckOptions) => {
    setOptions(next);
    saveOptions(next);
  }, []);

  const numbers = useMemo(
    () =>
      army && options.numberDuplicates ? duplicateNumbers(army.units) : new Map<string, number>(),
    [army, options.numberDuplicates],
  );

  const dataChanged = Boolean(army && meta?.changedAt && meta.changedAt !== army.data.changedAt);
  const theme = themeFor(army?.faction ?? "");

  return (
    <div
      className="relative min-h-screen"
      style={{ "--color-faction": theme.header } as React.CSSProperties}
    >
      <Ornament />
      <TopBar
        army={showLoader ? undefined : army}
        tab={tab}
        onTab={setTab}
        onPrint={print}
        onChangeList={() => setShowLoader(true)}
        factionColor={theme.header}
      />

      {dataChanged && source ? (
        <div className="no-print relative border-b border-line bg-panel">
          <div className="mx-auto flex max-w-[1400px] items-center gap-4 px-8 py-3">
            <span className="h-2 w-2 rotate-45 bg-gold" />
            <p className="flex-1 text-[13px]">
              <span className="font-semibold uppercase tracking-[0.18em]">Data updated</span>
              <span className="text-ink-dim">
                {" "}
                · new rules or datasheets arrived since these cards were built.
              </span>
            </p>
            <button
              type="button"
              className="btn"
              onClick={() => void load(source)}
              disabled={loading}
            >
              Rebuild cards
            </button>
          </div>
        </div>
      ) : null}

      <main className="relative mx-auto max-w-[1400px] px-8 py-10 print:max-w-none print:p-0">
        {!army || showLoader ? (
          <LoadPanel
            initialText={source && "text" in source ? source.text : listText}
            loading={loading}
            error={error}
            onLoad={(next) => void load(next)}
            onCancel={army ? () => setShowLoader(false) : undefined}
          />
        ) : null}

        {army && !showLoader && tab === "army" ? (
          <ArmyView
            army={army}
            numbers={numbers}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onOpenCards={() => setTab("cards")}
          />
        ) : null}
        {army && !showLoader && tab === "cards" ? (
          <CardsView
            army={army}
            numbers={numbers}
            options={options}
            onOptions={changeOptions}
            fontsReady={fontsReady}
          />
        ) : null}
        {army && !showLoader && tab === "stratagems" ? (
          <StratagemsView army={army} fontsReady={fontsReady} />
        ) : null}
        {army && !showLoader && tab === "data" ? (
          <DataPanel
            army={army}
            meta={meta}
            checking={checking}
            onCheck={async () => {
              setChecking(true);
              try {
                setMeta(await checkForUpdates());
              } finally {
                setChecking(false);
              }
            }}
          />
        ) : null}
      </main>
    </div>
  );
}

/** Text fitting needs the real fonts, so cards measure again once they load. */
function useFontsReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void document.fonts.ready.then(() => setReady(true));
  }, []);
  return ready;
}
