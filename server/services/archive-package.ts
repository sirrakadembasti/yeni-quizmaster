import { createHash } from 'node:crypto';

export const sha256 = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
export const MAX_PACKAGE_BYTES = 256 * 1024 * 1024;
export const MAX_SNAPSHOT_JSON_BYTES = 64 * 1024 * 1024;
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let crc = n;
  for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  return crc >>> 0;
});
export function crc32(bytes: Buffer) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 255];
  return (crc ^ 0xffffffff) >>> 0;
}

/** A bounded, uncompressed ZIP32 writer. Names are safe internal relative paths. */
export function packArchive(files: Map<string, Buffer>): Buffer {
  if (files.size > 65535) throw new Error('ZIP32 entry limit exceeded');
  const local: Buffer[] = [], central: Buffer[] = [];
  let offset = 0, centralSize = 0;
  for (const [name, bytes] of files) {
    if (!/^[a-zA-Z0-9.-]+(?:\/[a-zA-Z0-9.-]+)*$/.test(name) || name.split('/').some(part => part === '.' || part === '..')) throw new Error('Unsafe ZIP entry name');
    const encoded = Buffer.from(name, 'utf8');
    if (encoded.length > 65535 || bytes.length > MAX_PACKAGE_BYTES) throw new Error('Archive size limit exceeded');
    const checksum = crc32(bytes), header = Buffer.alloc(30), directory = Buffer.alloc(46);
    header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4); header.writeUInt16LE(0x800, 6);
    header.writeUInt16LE(33, 12); header.writeUInt32LE(checksum, 14);
    header.writeUInt32LE(bytes.length, 18); header.writeUInt32LE(bytes.length, 22); header.writeUInt16LE(encoded.length, 26);
    directory.writeUInt32LE(0x02014b50); directory.writeUInt16LE(20, 4); directory.writeUInt16LE(20, 6);
    directory.writeUInt16LE(0x800, 8); directory.writeUInt16LE(33, 14); directory.writeUInt32LE(checksum, 16);
    directory.writeUInt32LE(bytes.length, 20); directory.writeUInt32LE(bytes.length, 24);
    directory.writeUInt16LE(encoded.length, 28); directory.writeUInt32LE(offset, 42);
    local.push(header, encoded, bytes); central.push(directory, encoded);
    offset += header.length + encoded.length + bytes.length; centralSize += directory.length + encoded.length;
    if (offset + centralSize + 22 > MAX_PACKAGE_BYTES) throw new Error('Archive size limit exceeded');
  }
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(files.size, 8); end.writeUInt16LE(files.size, 10);
  end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, ...central, end]);
}
