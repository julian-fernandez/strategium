# Strategium

Turns a Warhammer 40,000 list into printable datasheets that hold only what
that army needs:

- **Weapons:** only the ones each unit took, marked with how many models carry
  each (`7× Null mace`).
- **Stratagems:** only those from the army's detachments (plus core
  stratagems) that one of its units can actually use.
- **Squad leaders:** a weapon only the Superior, Sergeant or Nob carries is
  marked with who carries it (`1× Inferno pistol  SUPERIOR`).
- **Leaders:** every character prints on the same full datasheet as any other
  unit. A leader can go on the back of the unit it joins.
- **Army rules card:** the army rule, each detachment's rules and the
  enhancements taken, on the first card.
- **Rules reference:** the full text of every core ability, faction rule and
  weapon keyword the cards name, at the back of the deck. On screen, tap any of
  those names to read it.
- **Points:** every unit priced from the current data: its size, wargear that
  costs extra (a meltagun, a multi-melta), its enhancement, and the surcharge on
  a repeated datasheet. When the list's own total differs, the army says so.

The cards follow the official 11th-edition datasheet layout and print one per
A5 landscape page.

Strategium reads lists; it doesn't build or edit them. Change a list in the
app you built it with, then load it again.

A personal tool. It reproduces Games Workshop's rules text and faction
emblems, so don't host it publicly. Neither is in the repo: both are fetched
into `data/cache/` when the app runs.

## Run it

```bash
pnpm install
pnpm sync-data   # first run only: downloads Wahapedia's export and pins a BSData commit
pnpm dev         # API on :8787, app on http://localhost:5173
```

Paste a list, open a roster file, or paste a Listhammer link (for example
`https://listhammer.info/list/b29e2c836943545e89`, the demo list).

## Printing

The Cards tab shows the deck as it will print: A5 landscape, one card per page.
Printed double-sided, each sheet is one card with its back. On screen, each
sheet has a flip button to show its back. Every option is on by default:

| Option              | What it does                                                                                               |
| ------------------- | ---------------------------------------------------------------------------------------------------------- |
| Leaders on the back | A character's datasheet prints on the back of the unit it joins.                                           |
| Double-sided        | Every card gets a back, so each stays on its own sheet. Flip on the short edge.                            |
| Stratagem deck      | Four stratagem cards per page, after the datasheets. Its pages back onto each other.                       |
| Army rules card     | The army rule, detachment rules and enhancements taken, on the first card.                                 |
| Rules reference     | Every core ability and weapon keyword the cards name, in full, at the end. Its pages back onto each other. |
| Number repeats      | Units that share a name become #1, #2, #3, easy to call out mid-game.                                      |

On a phone the cards are reflowed for reading instead, and Double-sided, which
only means something on paper, stays visible but greyed out.

No text is cut short. Long text shrinks to fit its card, and an army rules
card or rules reference that still doesn't fit at its smallest size takes
another page.

## List formats

Any export in use today, detected automatically:

| Format                                                                   | How it's read                                                                            |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Warhammer 40,000 app, both dialects (about 80% of lists)                 | Its own grammar. The flat dialect loses its structure when pasted; that's handled.       |
| The app's export in German, Spanish, French, Italian, Japanese or Korean | Same grammar, translated labels. Unit names must be English (see below).                 |
| New Recruit: GW, WTC, WTC-Compact, NR, and its older GW export           | GW through the app's grammar; the rest through the faction's vocabulary.                 |
| ListForge: WTC, detailed, short, simple                                  | The faction's vocabulary. "Simple" names no wargear, so units get their default loadout. |
| Warmind, WarOrgan, Ironbuilt, 40k.app, BattleBase                        | The faction's vocabulary (BattleBase copies the app's export).                           |
| Roster files: `.ros`, `.rosz`, New Recruit JSON, ListForge share JSON    | Parsed as BattleScribe rosters, in the browser (`.rosz` is unzipped there too).          |
| Hand-typed lists and WTC headers pasted on top of any of these           | The faction's vocabulary, plus the WTC header's warlord and enhancements.                |

"The faction's vocabulary" means the list is read against the faction's own
unit, model, wargear and enhancement names rather than a fixed grammar, so
`Grey Hunters ×10 — 180 pts`, `Char1: 1x Overlord (110 pts): …` and
`5× Bolt Pistol + Ceramite Fists / 4× Heavy Bolt Rifle` all read the same way.

The formats and how common each is come from a survey of about 2,000 tournament
lists on Listhammer (October 2026).

**Writing a list by hand.** The reader takes any layout, as long as:

- the faction is named near the top (`Adepta Sororitas`);
- every unit line carries points (`Canoness (60 pts)`), since that's how it
  tells a unit from its wargear;
- units use their full names (`Dominion Squad`, not `Dominion`);
- a leader joins its unit with `+` (`Morvenn Vahl + 3 Paragon Warsuits (380 pts)`);
- wargear is named in full or not at all. A unit given only a model count gets
  its default loadout, but naming some of its wargear drops the rest of the
  defaults. So write `10 Dominion Squad (110 pts): 10 Bolt pistol, 6 Boltgun,
  4 Meltagun, 10 Close combat weapon`, not just `4 Meltagun`.

**Names that don't quite match.** Exports and the data don't always spell
things the same way, so the reader also takes:

- a slip of a letter or two in a longer name, on either side
  (`Chirurgeon’s tools` for BSData's `Chirugeon's tools`), when only one name
  is that close;
- a weapon by its official name where BSData calls it something else
  (`Master-crafted Power Sword` for `Master-crafted power weapon`). Wahapedia's
  wargear table gives the official name, and the BSData weapon with the same
  profile is the one meant;
- a model named with a word left out (`Deathshroud Champion`), and a unit
  without its "Squad" (`Vigilators`);
- a unit whose name line the export lost: its models' lines are read as that
  unit, with a warning.

`pnpm coverage` counts the lists that resolve cleanly, and separately those
whose only warning is points that changed since they were exported.

**Known limits:**

- BSData only has English names. Japanese, Korean, French and Italian exports
  translate unit names, so those units can't be found; the app says so and
  asks for an English export. German and Spanish exports mostly keep English
  names and work.
- A list that names a unit its faction's data doesn't have gets a warning, not
  a card. For example, a list marked plain "Space Marines" with Roboute
  Guilliman in it: he's only in the Ultramarines data.

## Playing from a phone or tablet

The **Play** tab is for keeping the army digital during a game:

- **One unit at a time:** page through units with the arrows, a swipe, or the
  unit strip. Leaders come along with the unit they lead.
- **Usable now:** pick the phase and whose turn it is, and the unit's
  stratagems narrow to those it can use right then. Tap one for its full text.
- **Datasheet sized to the screen:** the printed card, scaled to fit, on
  tablets and larger; a reflowed version of it on phones.
- **All units:** every stratagem usable now, and the army rules.

To open it on a phone or tablet on the same Wi-Fi, start the app with:

```bash
pnpm dev:lan     # like `pnpm dev`, but the app is also served on your network
```

Then open the Data tab on the computer and scan the QR code. If Windows asks,
allow Node.js on private networks.

### Not a game tracker

Strategium is a reference, the same cards on paper or on a screen. Tracking a
game is out of scope: no wound counters, command points, victory points,
turn or round tracking, or army state shared between players. The phase and
turn picker in Play only filters which stratagems show; it doesn't record
anything.

## How it works

```
BSData (catalogues)  ─┐
                      ├─► server: compile ─► faction bundle (JSON, Zod-validated, cached per data version)
Wahapedia (CSV)      ─┘                              │
                                                     ▼  GET /api/bundle (ETag, gzip)
browser: Web Worker ─ detect format ─ read list ─ resolve units ─► Army ─► React: cards, Play, print
```

- **Compiler** (`shared/compile/`). On the server, each faction's BSData
  catalogue and linked libraries plus Wahapedia's export become one bundle:
  - every unit's stats, models, options, abilities and keywords;
  - each model's default loadout and how many of it a unit takes;
  - each unit's points: its base cost, the rules that change it by squad
    size, the surcharge on a repeated datasheet, and what each costed option
    adds;
  - detachments, enhancements, stratagems and which units can use them;
  - the text of every rule.

  BSData modifiers that depend only on the unit are applied while compiling;
  ones that depend on a selection travel with the bundle and apply when the
  list takes that selection. Both upstream formats are validated with Zod, so
  a change in either fails the compile with a clear error instead of producing
  wrong cards. Bundles are cached per compiler version, BSData commit and
  Wahapedia update.
- **Engine** (`shared/list/`, `shared/resolve/`). In a Web Worker (Comlink),
  the browser detects the list's format, reads it, fetches the faction's
  bundle, and builds the army. The server never sees a list, except to fetch a
  Listhammer link.
- **Typed API** (`server/app.ts`). Hono RPC: the web app's client is typed
  from the server's own routes, so a changed response fails the typecheck.
- **Cross-check.** Every stat line and weapon a list uses is compared with
  Wahapedia's numbers, and differences show on the Data tab. They are usually
  places where the two sources disagree, or a BSData modifier the compiler
  doesn't apply yet.
- **Points.** Each unit is priced from its bundle, so the total always reflects
  the current data, whatever points the list was exported with. The list's
  own points are kept, and a difference in the total shows as a warning on
  the Army tab. A unit with a points rule the compiler can't read is marked
  `≈`.

## Where the data comes from

| What                                                                                  | Source                                                                                              |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Datasheets: stats, weapons, abilities, keywords, default loadouts, points             | [BSData/wh40k-11e](https://github.com/BSData/wh40k-11e), the data New Recruit builds lists from     |
| Stratagems, detachment rules, enhancements, which units can use them, background text | [Wahapedia's data export](https://wahapedia.ru/wh40k11ed/the-rules/data-export/)                    |
| Faction emblems on the cards and in the app                                           | [warhammer40kgroup/wh40k-icon](https://github.com/warhammer40kgroup/wh40k-icon), at a pinned commit |

The server checks BSData and Wahapedia on start and every six hours, syncs
anything new into `data/cache/`, and keeps the previous snapshot. The app then
shows a "Data updated" banner.

A faction's emblem is fetched the first time an army of that faction loads,
and kept in `data/cache/icons/`. The set has no emblem for Aeldari, Drukhari,
Orks, Tyranids, Genestealer Cults, Leagues of Votann, Grey Knights, Black
Templars, Deathwatch, or either Knights faction; those keep the app's own
emblem. The mapping is in `shared/icons.ts`.

## Checks

```bash
pnpm test         # everything, on committed fixtures: no synced data needed
pnpm coverage     # every fixture against the live synced data, with a report
pnpm typecheck
pnpm lint
pnpm print-check  # with `pnpm dev` running: prints the demo deck to print-check.pdf
```

The tests run on `fixtures/`:

- `lists/`: one real tournament list for each of the 34 factions and chapters.
- `formats/`: one list in each export format.
- `bundles/`: those factions' compiled bundles, trimmed to the units the
  fixtures use, with every piece of rules text removed.
- `expected.json`: how each fixture resolved last time.

`pnpm coverage --write` regenerates the bundles and expectations from the
synced data. A test fails whenever a list resolves differently, so every
change to the parsers or the compiler shows up as a diff.

## Not built yet

- Unit photos: a custom upload per unit, and a default render. The card keeps an
  emblem placeholder in that slot.
- Use away from home: that would need hosting, which should stay private.
- Crusade.
- BSData modifiers inside condition groups or modifier groups, and ones that
  depend on the rest of the army.
