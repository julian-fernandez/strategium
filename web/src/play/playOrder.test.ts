import { describe, expect, it } from "vitest";
import type { Army, Datasheet, Stratagem } from "../../../shared/types";
import { playEntries, usableNow } from "./playOrder";

function unit(id: string, name: string): Datasheet {
  return { id, name } as Datasheet;
}

function stratagem(id: string, phase: string, turn: string, usableBy: string[] = []): Stratagem {
  return { id, name: id, phase, turn, usableBy } as Stratagem;
}

describe("playEntries", () => {
  const army = {
    units: [unit("u1", "Canoness"), unit("u2", "Zephyrim Squad"), unit("u3", "Immolator")],
    groups: [{ id: 1, bodyguardId: "u2", characterIds: ["u1"], stratagemIds: ["led"] }],
    stratagems: [
      stratagem("led", "Fight phase", "Your turn", ["Canoness", "Zephyrim Squad"]),
      stratagem("smoke", "Shooting phase", "Opponent’s turn", ["Immolator"]),
      stratagem("orders", "Command phase", "Your turn"),
    ],
  } as unknown as Army;

  it("folds leaders into their bodyguard and keeps list order", () => {
    const entries = playEntries(army);
    expect(entries.map((e) => [e.unit.name, e.characters.map((c) => c.name)])).toEqual([
      ["Zephyrim Squad", ["Canoness"]],
      ["Immolator", []],
    ]);
  });

  it("gives each entry its own stratagems plus the army-wide ones", () => {
    const [zephyrim, immolator] = playEntries(army);
    expect(zephyrim?.stratagems.map((s) => s.id)).toEqual(["led", "orders"]);
    expect(immolator?.stratagems.map((s) => s.id)).toEqual(["smoke", "orders"]);
  });
});

describe("usableNow", () => {
  it("matches the phase, and lets 'any phase' and two-phase stratagems through", () => {
    const shootOrFight = stratagem("a", "Shooting or Fight phase", "Either player’s turn");
    expect(usableNow(shootOrFight, "shooting", "mine")).toBe(true);
    expect(usableNow(shootOrFight, "fight", "theirs")).toBe(true);
    expect(usableNow(shootOrFight, "movement", "mine")).toBe(false);
    expect(usableNow(stratagem("b", "Any phase", "Either player’s turn"), "charge", "mine")).toBe(
      true,
    );
  });

  it("matches the turn", () => {
    const smokescreen = stratagem("c", "Shooting phase", "Opponent’s turn");
    expect(usableNow(smokescreen, "shooting", "theirs")).toBe(true);
    expect(usableNow(smokescreen, "shooting", "mine")).toBe(false);
    expect(usableNow(stratagem("d", "Command phase", "Your turn"), "all", "theirs")).toBe(false);
  });
});
