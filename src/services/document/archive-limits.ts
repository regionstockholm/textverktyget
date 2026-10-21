import { crc32, inflateRawSync } from "node:zlib";

const MAX_EXPANDED_BYTES = 100 * 1024 * 1024;
const MAX_ENTRY_BYTES = 32 * 1024 * 1024;
const MAX_ENTRIES = 1000;

/** Check actual inflated bytes, not just attacker-controlled ZIP sizes. */
export function assertBoundedOfficeArchive(buffer: Buffer): void {
  if (buffer.length < 4 || buffer.readUInt32LE(0) !== 0x04034b50) return;
  const invalid = () => new Error("Office archive is invalid or exceeds extraction limits");
  let end = buffer.length - 22;
  for (; end >= Math.max(0, buffer.length - 65557); end--) {
    if (buffer.readUInt32LE(end) === 0x06054b50 && end + 22 + buffer.readUInt16LE(end + 20) === buffer.length) break;
  }
  if (end < 0 || end < buffer.length - 65557) throw invalid();
  const count = buffer.readUInt16LE(end + 10);
  const directorySize = buffer.readUInt32LE(end + 12);
  const directoryStart = buffer.readUInt32LE(end + 16);
  // shortcut: reject ZIP64, split and encrypted archives; add a bounded ZIP64 reader if real documents need it.
  if (buffer.readUInt16LE(end + 4) || buffer.readUInt16LE(end + 6) || count !== buffer.readUInt16LE(end + 8) || count > MAX_ENTRIES || directoryStart + directorySize !== end) throw invalid();
  let position = directoryStart;
  let expanded = 0;
  const ranges: [number, number][] = [];
  for (let entry = 0; entry < count; entry++) {
    if (position + 46 > end || buffer.readUInt32LE(position) !== 0x02014b50) throw invalid();
    const flags = buffer.readUInt16LE(position + 8);
    const method = buffer.readUInt16LE(position + 10);
    const packedSize = buffer.readUInt32LE(position + 20);
    const size = buffer.readUInt32LE(position + 24);
    const checksum = buffer.readUInt32LE(position + 16);
    const local = buffer.readUInt32LE(position + 42);
    const nameLength = buffer.readUInt16LE(position + 28);
    const next = position + 46 + nameLength + buffer.readUInt16LE(position + 30) + buffer.readUInt16LE(position + 32);
    if (next > end || flags & ~0x080e || ![0, 8].includes(method) || size > MAX_ENTRY_BYTES || expanded + size > MAX_EXPANDED_BYTES || local + 30 > directoryStart || buffer.readUInt32LE(local) !== 0x04034b50 || buffer.readUInt16LE(local + 8) !== method || buffer.readUInt16LE(local + 6) !== flags) throw invalid();
    const localNameLength = buffer.readUInt16LE(local + 26);
    const start = local + 30 + localNameLength + buffer.readUInt16LE(local + 28);
    if (start + packedSize > directoryStart) throw invalid();
    if (nameLength !== localNameLength || !buffer.subarray(position + 46, position + 46 + nameLength).equals(buffer.subarray(local + 30, local + 30 + localNameLength))) throw invalid();
    for (const [offset, expected] of [[18, packedSize], [22, size]] as const) {
      const declared = buffer.readUInt32LE(local + offset);
      if (declared !== expected && !(flags & 8 && declared === 0)) throw invalid();
    }
    const packed = buffer.subarray(start, start + packedSize);
    const content = method === 0 ? packed : inflateRawSync(packed, { maxOutputLength: Math.max(1, size) });
    if (content.length !== size || crc32(content) !== checksum) throw invalid();
    let entryEnd = start + packedSize;
    if (flags & 8) {
      if (entryEnd + 12 > directoryStart) throw invalid();
      const descriptor = entryEnd + (buffer.readUInt32LE(entryEnd) === 0x08074b50 ? 4 : 0);
      if (descriptor + 12 > directoryStart || buffer.readUInt32LE(descriptor) !== checksum || buffer.readUInt32LE(descriptor + 4) !== packedSize || buffer.readUInt32LE(descriptor + 8) !== size) throw invalid();
      entryEnd = descriptor + 12;
    } else if (buffer.readUInt32LE(local + 14) !== checksum) throw invalid();
    ranges.push([local, entryEnd]);
    expanded += content.length;
    position = next;
  }
  if (position !== end) throw invalid();
  // No hidden local entries: some Office parsers read local records, others the directory.
  let covered = 0;
  for (const [start, finish] of ranges.sort((a, b) => a[0] - b[0])) {
    if (start !== covered) throw invalid();
    covered = finish;
  }
  if (covered !== directoryStart) throw invalid();
}
