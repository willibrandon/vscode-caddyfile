import { describe, expect, it } from "vitest";

interface CanonicalizeVsixModule {
  readonly canonicalizeVsix: (value: Buffer) => Buffer;
}

const moduleUrl = new URL("../canonicalize-vsix.mjs", import.meta.url);
const { canonicalizeVsix } = (await import(moduleUrl.href)) as CanonicalizeVsixModule;

describe("VSIX canonicalization", () => {
  it("normalizes timestamps and permissions without changing entry data", () => {
    const first = archive(0x1111, 0x2222, 0o100600, "same");
    const second = archive(0x3333, 0x4444, 0o100777, "same");
    const normalized = canonicalizeVsix(first);
    expect(normalized).toEqual(canonicalizeVsix(second));
    expect(normalized).toEqual(canonicalizeVsix(normalized));
    expect(normalized.readUInt16LE(10)).toBe(0);
    expect(normalized.readUInt16LE(12)).toBe(33);
    const central = first.readUInt32LE(first.length - 6);
    expect(normalized.readUInt32LE(central + 38) >>> 16).toBe(0o100644);
  });

  it("retains content differences and rejects malformed archives", () => {
    expect(canonicalizeVsix(archive(1, 1, 0o100644, "one"))).not.toEqual(
      canonicalizeVsix(archive(1, 1, 0o100644, "two")),
    );
    expect(() => canonicalizeVsix(Buffer.alloc(32))).toThrow(
      "VSIX end-of-central-directory record is missing.",
    );
    const multidisk = archive(1, 1, 0o100644, "same");
    multidisk.writeUInt16LE(1, multidisk.length - 18);
    expect(() => canonicalizeVsix(multidisk)).toThrow(
      "VSIX must be a single-disk, non-ZIP64 archive.",
    );
  });

  it("sorts local and central entries by filename", () => {
    const first = archiveEntries([
      ["extension/z.txt", "last"],
      ["extension/a.txt", "first"],
    ]);
    const second = archiveEntries([
      ["extension/a.txt", "first"],
      ["extension/z.txt", "last"],
    ]);
    expect(canonicalizeVsix(first)).toEqual(canonicalizeVsix(second));
  });
});

function archive(time: number, date: number, mode: number, text: string): Buffer {
  return archiveEntries([["extension/file.txt", text]], { date, mode, time });
}

function archiveEntries(
  values: readonly (readonly [filename: string, data: string])[],
  metadata: Readonly<{ date: number; mode: number; time: number }> = {
    date: 1,
    mode: 0o100644,
    time: 1,
  },
): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let localOffset = 0;
  for (const [name, text] of values) {
    const filename = Buffer.from(name);
    const data = Buffer.from(text);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(metadata.time, 10);
    local.writeUInt16LE(metadata.date, 12);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(filename.length, 26);
    locals.push(local, filename, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x0314, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(metadata.time, 12);
    central.writeUInt16LE(metadata.date, 14);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(filename.length, 28);
    central.writeUInt32LE((metadata.mode << 16) >>> 0, 38);
    central.writeUInt32LE(localOffset, 42);
    centrals.push(central, filename);
    localOffset += local.length + filename.length + data.length;
  }
  const centralSize = centrals.reduce((size, part) => size + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(values.length, 8);
  end.writeUInt16LE(values.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(localOffset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}
