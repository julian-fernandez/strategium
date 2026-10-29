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

## Playing from a phone or tablet

The **Play** tab is for keeping the army digital during a game:

- **One unit at a time:** page through units with the arrows, a swipe, or the
  unit strip. Leaders come along with the unit they lead.
- **Usable now:** pick the phase and whose turn it is, and the unit's
  stratagems narrow to those it can use right then. Tap one for its full text.
- **Datasheet sized to the screen:** the printed card, scaled to fit, on
  tablets and larger; a reflowed version of it on phones.

To open it on a phone or tablet on the same Wi-Fi, start the app with:

```bash
pnpm dev:lan     # like `pnpm dev`, but the app is also served on your network
```

Then open the Data tab on the computer and scan the QR code. If Windows asks,
allow Node.js on private networks. The API server stays on the computer only;
the phone talks to it through the web app.

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
- Use away from home: that would need hosting, which should stay private.
- Crusade.
- Applying BSData's conditional modifiers.
