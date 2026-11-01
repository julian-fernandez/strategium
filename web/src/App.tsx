import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { META_POLL_MS } from "../../shared/config";
import { duplicateNumbers } from "../../shared/labels";
import type { Army, DataVersions } from "../../shared/types";
import {
  checkForUpdates,
  fetchMeta,
  loadSavedOptions,
  loadSavedSource,
  saveOptions,
  saveSource,
} from "./api";
import { FactionIconContext, useFactionIcon } from "./cards/factionIcon";
import type { DeckOptions } from "./cards/printOrder";
import { themeFor } from "./cards/themes";
import { engine, type ListSource } from "./engine";
import { PlayView } from "./play/PlayView";
import { entryFor, playEntries } from "./play/playOrder";
import { RulesProvider } from "./rules/Rules";
import { RulesView } from "./rules/RulesView";
import { ArmyView } from "./ui/ArmyView";
import { CardsView } from "./ui/CardsView";
import { DataPanel } from "./ui/DataPanel";
import { LoadPanel } from "./ui/LoadPanel";
import { Ornament } from "./ui/Ornament";
import { StratagemsView } from "./ui/StratagemsView";
import { BottomNav, TABS, type Tab, TopBar } from "./ui/TopBar";
import { useStored } from "./ui/useStored";
import { useWakeLock } from "./ui/useWakeLock";

export function App() {
  const [source, setSource] = useState<ListSource | undefined>(loadSavedSource);
  const [army, setArmy] = useState<Army>();
  const [listText, setListText] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [showLoader, setShowLoader] = useState(false);
  // Remembered, so a reload mid-game comes back to the same tab and unit. The cards are
  // what Strategium is for, so a list opens on them.
  const [storedTab, setTab] = useStored<Tab>("army-cards:tab", "cards");
  const tab = TABS.some((t) => t.id === storedTab) ? storedTab : "cards";
  const [playUnit, setPlayUnit] = useStored<string | null>("army-cards:play-unit", null);
  const [selectedId, setSelectedId] = useState<string>();
  const [options, setOptions] = useState<DeckOptions>(loadSavedOptions);
  const [meta, setMeta] = useState<DataVersions>();
  const [checking, setChecking] = useState(false);
  const fontsReady = useFontsReady();

  /** Builds a list's army. A list just loaded opens on its cards; a reload keeps the tab you were on. */
  const load = useCallback(
    async (next: ListSource, { opened = false } = {}) => {
      setLoading(true);
      setError(undefined);
      try {
        const result = await engine.build(next);
        setArmy(result.army);
        setListText(result.text);
        // A file is remembered as the text read from it, so a reload rebuilds the same list.
        const kept = "file" in next ? { text: result.text } : next;
        setSource(kept);
        saveSource(kept);
        setShowLoader(false);
        if (opened) setTab("cards");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        setLoading(false);
      }
    },
    [setTab],
  );

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
  }, [setTab]);

  /** Shows a unit in Play, on the page of the unit it leads if it's a leader. */
  const openUnit = useCallback(
    (unitId: string) => {
      const entry = army ? entryFor(playEntries(army), unitId) : undefined;
      if (entry) setPlayUnit(entry.key);
      setTab("play");
    },
    [army, setPlayUnit, setTab],
  );

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
  }, [army, showLoader, tab, print, setTab]);

  const changeOptions = useCallback((next: DeckOptions) => {
    setOptions(next);
    saveOptions(next);
  }, []);

  const numbers = useMemo(
    () =>
      army && options.numberDuplicates ? duplicateNumbers(army.units) : new Map<string, number>(),
    [army, options.numberDuplicates],
  );

  const inGame = tab === "play" || tab === "stratagems" || tab === "rules";
  useWakeLock(Boolean(army) && !showLoader && inGame);

  const dataChanged = Boolean(army && meta?.changedAt && meta.changedAt !== army.data.changedAt);
  const theme = themeFor(army?.faction ?? "");
  const icon = useFactionIcon(army?.faction);

  return (
    <RulesProvider glossary={army?.glossary ?? NO_RULES} ruleBook={army?.ruleBook ?? NO_RULES}>
      <FactionIconContext.Provider value={icon}>
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
              <div className="mx-auto flex max-w-[1400px] items-center gap-4 px-4 py-3 md:px-8">
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

          <main className="relative mx-auto max-w-[1400px] px-4 pb-24 pt-6 md:px-8 md:pt-10 lg:pb-10 print:max-w-none print:p-0">
            {!army || showLoader ? (
              <LoadPanel
                initialText={source && "text" in source ? source.text : listText}
                loading={loading}
                error={error}
                onLoad={(next) => void load(next, { opened: true })}
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
                onOpenData={() => setTab("data")}
                onChangeList={() => setShowLoader(true)}
              />
            ) : null}
            {army && !showLoader && tab === "play" ? (
              <PlayView
                army={army}
                numbers={numbers}
                fontsReady={fontsReady}
                unitKey={playUnit ?? undefined}
                onUnitKey={setPlayUnit}
              />
            ) : null}
            {army && !showLoader && tab === "cards" ? (
              <CardsView
                army={army}
                numbers={numbers}
                options={options}
                onOptions={changeOptions}
                onPrint={print}
                fontsReady={fontsReady}
              />
            ) : null}
            {army && !showLoader && tab === "stratagems" ? (
              <StratagemsView army={army} numbers={numbers} fontsReady={fontsReady} />
            ) : null}
            {army && !showLoader && tab === "rules" ? (
              <RulesView army={army} numbers={numbers} onOpenUnit={openUnit} />
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
          {army && !showLoader ? <BottomNav tab={tab} onTab={setTab} /> : null}
        </div>
      </FactionIconContext.Provider>
    </RulesProvider>
  );
}

const NO_RULES: Army["glossary"] = [];

/**
 * The cards' faces. A browser fetches a face only when text first uses it, so
 * without asking for these up front, opening the cards would fit every card's
 * text twice: once in a fallback font, then again when Barlow arrives.
 */
const CARD_FONTS = [
  "400 1em Barlow",
  "italic 400 1em Barlow",
  "500 1em Barlow",
  "600 1em Barlow",
  "700 1em Barlow",
  "600 1em 'Barlow Condensed'",
  "700 1em 'Barlow Condensed'",
  "800 1em 'Barlow Condensed'",
];

/** Text fitting needs the real fonts, so cards measure again once they load. */
function useFontsReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const cardFonts = CARD_FONTS.map((font) => document.fonts.load(font));
    void Promise.allSettled(cardFonts)
      .then(() => document.fonts.ready)
      .then(() => setReady(true));
  }, []);
  return ready;
}
