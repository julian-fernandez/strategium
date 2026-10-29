import { readFileSync } from "node:fs";
import path from "node:path";
import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { isRosterJson, isRosterXml, parseRosterJson, parseRosterXml, readRosz } from "./roster";
import type { ListItem, ListUnit } from "./types";
import { parseXml } from "./xml";
import { readZipEntry } from "./zip";

const FORMATS = path.resolve(import.meta.dirname, "../../fixtures/formats");
const fixture = (file: string) => readFileSync(path.join(FORMATS, file), "utf8");

const nrRos = fixture("newrecruit.thousand-sons.ros");
const nrJson = fixture("newrecruit.thousand-sons.json");
const listForge = fixture("listforge.adeptus-custodes.json");

/** One line per unit, close to how the text exports print it. */
function describeUnit(unit: ListUnit): string {
  const items = (list: ListItem[]) => list.map((item) => `${item.count}x ${item.name}`).join(", ");
  return [
    `${unit.name} (${unit.points})`,
    ...unit.groups.map((group) => `${group.count}x ${group.name}: ${items(group.items)}`),
    ...(unit.items.length ? [items(unit.items)] : []),
  ].join(" | ");
}

describe("parseXml", () => {
  it("reads attributes in both quote styles and decodes entities", () => {
    const root = parseXml(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<!DOCTYPE roster [ <!ENTITY note "x > y"> ]>',
        "<!-- a comment with <tags> in it -->",
        `<roster a="1" b='two' c="&amp;&lt;&gt;&quot;&apos;" d="&#65;&#x42;&#x1F600;" e="&nbsp;">`,
        '  <![CDATA[ <selection name="not an element"/> ]]>',
        `  <selection name='It&apos;s "quoted"'/>`,
        '  <selection  name = "spaced"  ><!-- inside --></selection>',
        "  text is ignored",
        "</roster>",
      ].join("\n"),
    );
    expect(root.name).toBe("roster");
    expect(root.attributes).toEqual({ a: "1", b: "two", c: `&<>"'`, d: "AB😀", e: "&nbsp;" });
    expect(root.children.map((child) => child.attributes.name)).toEqual([
      `It's "quoted"`,
      "spaced",
    ]);
  });

  it("turns literal line breaks in an attribute into spaces", () => {
    expect(parseXml('<a b="one\ntwo&#10;three"/>').attributes.b).toBe("one two\nthree");
  });

  it("rejects broken documents", () => {
    expect(() => parseXml("<a><b></a>")).toThrow("Found </a> where </b> was expected.");
    expect(() => parseXml("<a>")).toThrow("<a> is never closed.");
    expect(() => parseXml("<a b=c/>")).toThrow(`Attribute "b" in <a> isn't quoted.`);
    expect(() => parseXml("<!-- only a comment -->")).toThrow("The document has no root element.");
  });
});

describe("readZipEntry", () => {
  const zip = buildZip([
    { name: "readme.txt", text: "hello" },
    { name: "rosters/", text: "" },
    { name: "rosters/list.ros", text: nrRos, deflate: true, dataDescriptor: true },
  ]);

  it("reads a stored entry", async () => {
    const entry = await readZipEntry(zip, (name) => name === "readme.txt");
    expect(new TextDecoder().decode(entry?.data)).toBe("hello");
  });

  it("inflates a deflated entry whose local header leaves the sizes to a data descriptor", async () => {
    expect(await readRosz(zip)).toBe(nrRos);
  });

  it("returns undefined when nothing matches, and rejects what isn't a ZIP", async () => {
    expect(await readZipEntry(zip, (name) => name.endsWith(".json"))).toBeUndefined();
    await expect(readRosz(new TextEncoder().encode(nrRos))).rejects.toThrow(
      "This file isn't a ZIP archive.",
    );
    await expect(readRosz(buildZip([{ name: "readme.txt", text: "hello" }]))).rejects.toThrow(
      "This .rosz has no .ros roster inside it.",
    );
  });
});

describe("roster detection", () => {
  it("tells rosters from other text", () => {
    expect(isRosterXml(nrRos)).toBe(true);
    expect(isRosterJson(nrJson)).toBe(true);
    expect(isRosterJson(listForge)).toBe(true);

    expect(isRosterXml(nrJson)).toBe(false);
    expect(isRosterJson(nrRos)).toBe(false);
    expect(isRosterJson('{ "roster": "no forces" }')).toBe(false);
    const text = "Thousand Sons\nChangehost of Deceit (2 Detachment Points)\n";
    expect(isRosterXml(text)).toBe(false);
    expect(isRosterJson(text)).toBe(false);
  });
});

describe("New Recruit Thousand Sons roster", () => {
  const list = parseRosterXml(nrRos);

  it("reads the same list from .ros, .json and .rosz", async () => {
    expect(parseRosterJson(nrJson)).toEqual(list);
    const rosz = buildZip([{ name: "Unnamed list.ros", text: nrRos, deflate: true }]);
    expect(parseRosterXml(await readRosz(rosz))).toEqual(list);
  });

  it("reads the header", () => {
    expect(list.note).toBeUndefined();
    expect(list.faction).toBe("Thousand Sons");
    expect(list.detachmentText).toBe("Changehost of Deceit");
    expect(list.detachmentPoints).toBe(2);
    expect(list.disposition).toBe("Reconnaissance");
    expect(list.battleSize).toEqual({ name: "Incursion", points: 1000 });
    expect(list.exporter).toBe("https://newrecruit.eu");
    expect(list.warnings).toEqual([]);
  });

  it("skips configuration and reads every unit with its section", () => {
    expect(list.units.map((unit) => [unit.name, unit.section, unit.points])).toEqual([
      ["Ahriman", "Epic Hero", 105],
      ["Brayherd Shaman [Crucible]", "Character", 60],
      ["Exalted Sorcerer", "Character", 100],
      ["Exalted Sorcerer", "Character", 100],
      ["Exalted Sorcerer on Disc of Tzeentch", "Character", 95],
      ["Flamers", "Infantry", 65],
      ["Flamers", "Infantry", 65],
      ["Chaos Spawn", "Beast", 65],
      ["Chaos Spawn", "Beast", 65],
      ["Chaos Predator Annihilator", "Vehicle", 140],
      ["Vengeance Weapon Battery [Legends]", "Fortification", 140],
    ]);
  });

  it("splits a squad into model groups with weapon totals", () => {
    const flamers = list.units.find((unit) => unit.name === "Flamers");
    expect(flamers?.groups).toEqual([
      {
        count: 1,
        name: "Pyrocaster",
        items: [
          { count: 1, name: "Flamer mouths" },
          { count: 1, name: "Flickering flames" },
        ],
      },
      {
        count: 2,
        name: "Flamer",
        items: [
          { count: 2, name: "Flamer mouths" },
          { count: 2, name: "Flickering flames" },
        ],
      },
    ]);
    expect(flamers?.items).toEqual([]);
  });

  it("reads the warlord and keeps the marker out of the wargear", () => {
    const warlords = list.units.filter((unit) => unit.isWarlord);
    expect(warlords.map((unit) => unit.name)).toEqual(["Ahriman"]);
    expect(warlords[0]?.groups).toEqual([]);
    expect(warlords[0]?.items.map((item) => item.name)).toEqual([
      "Black Staff of Ahriman",
      "Inferno bolt pistol",
      "Transmogrifying Blast",
    ]);
  });
});

describe("ListForge Adeptus Custodes share", () => {
  const list = parseRosterJson(listForge);

  it("reads the header", () => {
    expect(list.note).toBe("New Banana Boys");
    expect(list.faction).toBe("Adeptus Custodes");
    expect(list.detachmentText).toBe(
      "Emperor's Chosen and Lions of the Emperor and Might of the Moritoi",
    );
    expect(list.detachmentPoints).toBe(3);
    expect(list.disposition).toBe("Take and Hold");
    expect(list.battleSize).toEqual({ name: "Strike Force", points: 2000 });
    expect(list.exporter).toBe("ListForge");
    expect(list.warnings).toEqual([]);
  });

  it("reads the units and counts the detailed text export shows", () => {
    // Same units as `detailedText`, in roster order; the wrapper on the Telemon is flattened.
    expect(list.units.map(describeUnit)).toEqual([
      "Trajann Valoris (265) | 1x Eagle's Scream, 1x Watcher's Axe",
      "Allarus Custodians (180) | 1x Allarus Custodian: 1x Balistus Grenade Launcher, 1x Guardian Spear | 1x Allarus Custodian with Vexilla: 1x Balistus Grenade Launcher, 1x Guardian Spear, 1x Vexilla",
      "Venatari with Verutum Lances (270) | 3x Venatari: 3x Verutum Lance",
      "Prosecutor Squad (45) | 4x Prosecutor: 4x Boltgun, 4x Gun Stock",
      "Witchseeker Squad (55) | 4x Witchseeker: 4x Flamer, 4x Gun Stock",
      "Allarus Custodians (180) | 1x Allarus Custodian: 1x Balistus Grenade Launcher, 1x Guardian Spear | 1x Allarus Custodian with Vexilla: 1x Balistus Grenade Launcher, 1x Guardian Spear, 1x Vexilla",
      "Caladius Annihilator Grav-tank (250) | 1x Arachnus Blaze Carronade, 1x Armoured Hull, 1x Twin Lastrum Bolt Cannon",
      "Contemptor-Galatus Dreadnought (220) | 1x Warblade",
      "Contemptor-Galatus Dreadnought (220) | 1x Warblade",
      "Telemon Heavy Dreadnought (310) | 1x Dual Caestus Fists, 2x Twin Neutronium Cascade Projectors, 1x Spiculus Bolt Launcher",
    ]);
    expect(list.units.reduce((sum, unit) => sum + unit.points, 0)).toBe(1995);
  });

  it("groups the leader with the unit it is attached to", () => {
    const attached = list.units.filter((unit) => unit.attachment);
    expect(attached.map((unit) => [unit.name, unit.attachment])).toEqual([
      ["Trajann Valoris", { role: "leader", group: 1 }],
      ["Allarus Custodians", { role: "bodyguard", group: 1 }],
    ]);
    expect(list.units.indexOf(attached[1] as ListUnit)).toBe(1);
  });

  it("reads the warlord and the enhancement", () => {
    expect(list.units.filter((unit) => unit.isWarlord).map((unit) => unit.name)).toEqual([
      "Trajann Valoris",
    ]);
    const enhanced = list.units.filter((unit) => unit.enhancement);
    expect(enhanced.map((unit) => [unit.name, unit.enhancement])).toEqual([
      ["Telemon Heavy Dreadnought", "Augury Uplink"],
    ]);
  });
});

describe("roster edge cases", () => {
  const xml = `<roster name="Unnamed list">
    <forces><force catalogueName="Imperium - Adepta Sororitas"><selections>
      <selection id="d" name="Dialogus" type="model" number="1" attached="r">
        <costs><cost name="pts" value="40"/></costs>
        <categories><category name="Character" primary="true"/><category name="Support" primary="false"/></categories>
        <selections>
          <selection name="Triptych of Judgement" type="upgrade" number="1" group="Enhancements"><costs><cost name="pts" value="15"/></costs></selection>
          <selection name="Dialogus staff" type="upgrade" number="1"/>
        </selections>
      </selection>
      <selection id="c" name="Canoness" type="model" number="1" attached="gone">
        <costs><cost name="pts" value="50"/></costs>
      </selection>
      <selection id="r" name="Retributor Squad" type="unit" number="1">
        <costs><cost name="pts" value="115"/></costs>
        <selections>
          <selection name="Retributor Superior" type="model" number="1"/>
          <selection name="Retributor" type="model" number="4">
            <selections><selection name="Heavy bolter" type="upgrade" number="2"/></selections>
          </selection>
        </selections>
      </selection>
    </selections></force></forces>
  </roster>`;
  const list = parseRosterXml(xml);

  it("reads a Support character, an enhancement from its entry group, and warns about gaps", () => {
    const [dialogus, canoness, retributors] = list.units;
    expect(dialogus?.attachment).toEqual({ role: "support", group: 1 });
    expect(dialogus?.enhancement).toBe("Triptych of Judgement");
    expect(dialogus?.points).toBe(55);
    expect(dialogus?.items).toEqual([{ count: 1, name: "Dialogus staff" }]);
    expect(canoness?.attachment).toBeUndefined();
    expect(retributors?.attachment).toEqual({ role: "bodyguard", group: 1 });
    expect(list.note).toBeUndefined();
    expect(list.faction).toBe("Adepta Sororitas");
    expect(list.warnings).toEqual([
      "Couldn't find the detachment in the roster.",
      "Canoness is attached to a unit that isn't in the roster.",
    ]);
  });

  it("rejects JSON that isn't a roster", () => {
    expect(() => parseRosterJson("not json")).toThrow("This roster isn't valid JSON.");
    expect(() => parseRosterJson('{ "roster": {} }')).toThrow(/isn't a roster/);
    expect(() => parseRosterXml("<list/>")).toThrow(/its root is <list>/);
  });
});

// A minimal ZIP writer, so the `.rosz` path runs without a binary fixture.

type ZipInput = { name: string; text: string; deflate?: boolean; dataDescriptor?: boolean };

function buildZip(files: ZipInput[]): Uint8Array {
  const parts: Buffer[] = [];
  const directory: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.name, "utf8");
    const data = Buffer.from(file.text, "utf8");
    const body = file.deflate ? deflateRawSync(data) : data;
    const crc = crc32(data);
    const flags = 0x800 | (file.dataDescriptor ? 0x8 : 0);
    const method = file.deflate ? 8 : 0;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(method, 8);
    if (!file.dataDescriptor) {
      local.writeUInt32LE(crc, 14);
      local.writeUInt32LE(body.length, 18);
      local.writeUInt32LE(data.length, 22);
    }
    local.writeUInt16LE(name.length, 26);
    const entry = [local, name, body];
    if (file.dataDescriptor) {
      const descriptor = Buffer.alloc(16);
      descriptor.writeUInt32LE(0x08074b50, 0);
      descriptor.writeUInt32LE(crc, 4);
      descriptor.writeUInt32LE(body.length, 8);
      descriptor.writeUInt32LE(data.length, 12);
      entry.push(descriptor);
    }

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(flags, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    directory.push(central, name);

    parts.push(...entry);
    offset += entry.reduce((sum, part) => sum + part.length, 0);
  }

  const directorySize = directory.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directorySize, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...parts, ...directory, end]));
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
