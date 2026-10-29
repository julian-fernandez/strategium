/**
 * Parses Wahapedia's export format: pipe-delimited, a header row, and a trailing
 * pipe on every row. A field can contain line breaks, so a row is only complete
 * once it has as many fields as the header.
 */
export function parsePipeCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  const headerLine = lines.shift();
  if (!headerLine) return [];

  const header = splitRow(headerLine);
  const rows: Record<string, string>[] = [];
  let pending = "";

  for (const line of lines) {
    pending = pending ? `${pending}\n${line}` : line;
    const fields = splitRow(pending);
    if (fields.length < header.length) continue;

    const row: Record<string, string> = {};
    header.forEach((name, i) => {
      row[name] = fields[i] ?? "";
    });
    rows.push(row);
    pending = "";
  }

  return rows;
}

function splitRow(line: string): string[] {
  const parts = line.split("|");
  // Every row ends with a pipe, which leaves an empty last element.
  if (parts.at(-1) === "") parts.pop();
  return parts;
}
