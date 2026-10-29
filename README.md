# Army Cards

Turns a Warhammer 40,000 list into printable datasheets that hold only what
that army needs:

- **Weapons:** only the ones each unit took, marked with how many models carry
  each (`7× Null mace`).
- **Stratagems:** only those from the army's detachments (plus core
  stratagems) that one of its units can actually use.
- **Leaders:** optionally printed on the back of the unit they join.

The cards follow the official 11th-edition datasheet layout and print one per
A5 landscape page.

A personal tool. It reproduces Games Workshop's rules text, so don't host it
publicly.

## Run it

```bash
pnpm install
pnpm sync-data   # first run only: downloads Wahapedia's export and pins a BSData commit
pnpm dev         # API on :8787, app on http://localhost:5173
```

Paste a list exported from New Recruit or the Warhammer 40,000 app, or a
Listhammer link (for example
`https://listhammer.info/list/b29e2c836943545e89`, the demo list).

## Where the data comes from

| What                                                  | Source                                                                                          |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Datasheets: stats, weapons, abilities, keywords       | [BSData/wh40k-11e](https://github.com/BSData/wh40k-11e), the data New Recruit builds lists from |
| Stratagems, which units can use them, background text | [Wahapedia's data export](https://wahapedia.ru/wh40k11ed/the-rules/data-export/)                |

The server checks both sources on start and every six hours, syncs anything
new into `data/cache/`, and keeps the previous snapshot. The app then shows a
"Data updated" banner. The Data tab compares every stat line and weapon on
the cards against Wahapedia's numbers, because BSData's conditional modifiers
aren't applied.

## Checks

```bash
pnpm test         # parser, resolver and stratagem filter, on the demo list (needs synced data)
pnpm typecheck
pnpm lint
pnpm print-check  # with `pnpm dev` running: prints the demo deck to print-check.pdf
```

## Not built yet

- Unit photos: a custom upload per unit, and a default render. The card keeps an
  emblem placeholder in that slot.
- A phone layout.
- Crusade.
- Applying BSData's conditional modifiers.
