/**
 * Just enough ZIP for `.rosz` rosters: stored and deflated entries, no
 * encryption, no ZIP64. Sizes come from the central directory, because a
 * local header written with a trailing data descriptor leaves them blank.
 * Inflating uses the platform's `DecompressionStream`, which browsers, workers
 * and Node all have.
 */

export type ZipEntry = { name: string; data: Uint8Array };

const LOCAL_HEADER = 0x04034b50;
const CENTRAL_HEADER = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const STORED = 0;
const DEFLATED = 8;
const ENCRYPTED_FLAG = 0x1;

/**
 * Unpacks the first file whose name passes `match`, or returns undefined when
 * none does. Throws on a damaged archive or one this reader doesn't support.
 */
export async function readZipEntry(
  bytes: Uint8Array,
  match: (name: string) => boolean,
): Promise<ZipEntry | undefined> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = findEndOfCentralDirectory(view);
  const count = view.getUint16(end + 10, true);
  const directorySize = view.getUint32(end + 12, true);
  let offset = view.getUint32(end + 16, true);
  if (count === 0xffff || directorySize === 0xffffffff || offset === 0xffffffff) {
    throw new Error("This ZIP uses the ZIP64 format, which isn't supported.");
  }

  for (let index = 0; index < count; index++) {
    if (offset + 46 > view.byteLength || view.getUint32(offset, true) !== CENTRAL_HEADER) {
      throw new Error("The ZIP's file list is damaged.");
    }
    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const size = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    // Names are UTF-8 when flagged, else CP437; the two agree on the ASCII names rosters use.
    const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    offset += 46 + nameLength + extraLength + commentLength;

    if (name.endsWith("/") || !match(name)) continue;
    if (flags & ENCRYPTED_FLAG) throw new Error(`"${name}" in the ZIP is encrypted.`);

    if (localOffset + 30 > view.byteLength || view.getUint32(localOffset, true) !== LOCAL_HEADER) {
      throw new Error(`The ZIP's header for "${name}" is damaged.`);
    }
    const start =
      localOffset +
      30 +
      view.getUint16(localOffset + 26, true) +
      view.getUint16(localOffset + 28, true);
    const stored = bytes.slice(start, start + compressedSize);
    if (stored.length !== compressedSize) throw new Error(`"${name}" in the ZIP is cut short.`);

    if (method !== STORED && method !== DEFLATED) {
      throw new Error(
        `"${name}" in the ZIP uses compression method ${method}, which isn't supported.`,
      );
    }
    const data = method === STORED ? stored : await inflateRaw(stored, name);
    if (data.length !== size) {
      throw new Error(`"${name}" in the ZIP unpacked to the wrong size.`);
    }
    return { name, data };
  }
  return undefined;
}

/** The end-of-central-directory record sits in the last 22 bytes plus up to 64 KB of comment. */
function findEndOfCentralDirectory(view: DataView): number {
  const last = view.byteLength - 22;
  for (let offset = last; offset >= 0 && offset >= last - 0xffff; offset--) {
    if (view.getUint32(offset, true) === END_OF_CENTRAL_DIRECTORY) return offset;
  }
  throw new Error("This file isn't a ZIP archive.");
}

async function inflateRaw(data: Uint8Array<ArrayBuffer>, name: string): Promise<Uint8Array> {
  try {
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    throw new Error(`"${name}" in the ZIP couldn't be unpacked.`);
  }
}
