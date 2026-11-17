/**
 * Dependency-free ZIP/XLSX inspector used by development tests.
 * Bolt WebContainers do not necessarily supply Python, 'unzip', or a system shell.
 * This reads the ZIP central directory and inflates workbook XML in pure Node.js.
 * It must not be used to interpret untrusted archives in production.
 */
import {inflateRawSync} from 'node:zlib';

export function readZipEntries(input) {
  const bytes = Buffer.isBuffer(input) ? input : Buffer.from(input);
  let eocd = -1;
  const min = Math.max(0, bytes.length - 65557);
  for (let pos = bytes.length - 22; pos >= min; pos--) {
    if (bytes.readUInt32LE(pos) === 0x06054b50) { eocd = pos; break; }
  }
  if (eocd < 0) throw new Error('Not a valid ZIP archive: end record missing');
  const count = bytes.readUInt16LE(eocd + 10);
  const offset = bytes.readUInt32LE(eocd + 16);
  if (count === 0xffff || offset === 0xffffffff) throw new Error('ZIP64 is not supported by this test helper');
  let cursor = offset;
  const entries = new Map();
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > bytes.length || bytes.readUInt32LE(cursor) !== 0x02014b50) {
      throw new Error(`Invalid ZIP central-directory entry ${i}`);
    }
    const flags = bytes.readUInt16LE(cursor + 8);
    const method = bytes.readUInt16LE(cursor + 10);
    const packed = bytes.readUInt32LE(cursor + 20);
    const unpacked = bytes.readUInt32LE(cursor + 24);
    const nameSize = bytes.readUInt16LE(cursor + 28);
    const extraSize = bytes.readUInt16LE(cursor + 30);
    const commentSize = bytes.readUInt16LE(cursor + 32);
    const local = bytes.readUInt32LE(cursor + 42);
    const name = bytes.toString('utf8', cursor + 46, cursor + 46 + nameSize);
    cursor += 46 + nameSize + extraSize + commentSize;
    if (flags & 1) throw new Error(`Encrypted ZIP entry unsupported: ${name}`);
    if (unpacked > 32 * 1024 * 1024) throw new Error(`Test XML is too large: ${name}`);
    if (local + 30 > bytes.length || bytes.readUInt32LE(local) !== 0x04034b50) {
      throw new Error(`Invalid ZIP local header: ${name}`);
    }
    const dataStart = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
    const slice = bytes.subarray(dataStart, dataStart + packed);
    if (slice.length !== packed) throw new Error(`Truncated ZIP entry: ${name}`);
    const content = method === 0 ? Buffer.from(slice) : method === 8 ? inflateRawSync(slice) : null;
    if (!content) throw new Error(`Unsupported ZIP compression method ${method} for ${name}`);
    if (content.length !== unpacked) throw new Error(`ZIP entry length mismatch: ${name}`);
    entries.set(name, content);
  }
  return entries;
}

export function inspectXlsxFormulas(input) {
  const entries = readZipEntries(input);
  const sheets = [...entries].filter(([name]) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name));
  if (!sheets.length) throw new Error('XLSX workbook has no worksheet XML');
  const xml = sheets.map(([, content]) => content.toString('utf8')).join('\n');
  return { entries, xml, sheets: sheets.length, formulas: (xml.match(/<f(?:\s[^>]*)?>/g) || []).length };
}
