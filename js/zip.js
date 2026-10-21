// Minimal dependency-free ZIP writer (STORE method only - fine for small text config files).
// Produces a downloadable Blob without needing any external library.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = (CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)) >>> 0;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(v) {
  return [v & 0xff, (v >>> 8) & 0xff];
}
function u32(v) {
  return [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];
}

// DOS date/time: fixed timestamp is fine for generated labs.
const DOS_TIME = 0;
const DOS_DATE = ((2024 - 1980) << 9) | (1 << 5) | 1;

class ZipWriter {
  constructor() {
    this.files = []; // { name, data(Uint8Array), crc, size }
  }

  file(path, content) {
    const data = typeof content === "string" ? new TextEncoder().encode(content) : content;
    this.files.push({ name: path.replace(/\\/g, "/"), data, crc: crc32(data), size: data.length });
  }

  generateBlob() {
    const localChunks = [];
    const centralChunks = [];
    let offset = 0;

    for (const f of this.files) {
      const nameBytes = new TextEncoder().encode(f.name);
      const localHeader = new Uint8Array([
        0x50, 0x4b, 0x03, 0x04, // local file header signature
        ...u16(20), // version needed
        ...u16(0), // flags
        ...u16(0), // compression = store
        ...u16(DOS_TIME),
        ...u16(DOS_DATE),
        ...u32(f.crc),
        ...u32(f.size), // compressed size
        ...u32(f.size), // uncompressed size
        ...u16(nameBytes.length),
        ...u16(0), // extra field length
      ]);
      localChunks.push(localHeader, nameBytes, f.data);

      const centralHeader = new Uint8Array([
        0x50, 0x4b, 0x01, 0x02, // central directory signature
        ...u16(20), // version made by
        ...u16(20), // version needed
        ...u16(0), // flags
        ...u16(0), // compression
        ...u16(DOS_TIME),
        ...u16(DOS_DATE),
        ...u32(f.crc),
        ...u32(f.size),
        ...u32(f.size),
        ...u16(nameBytes.length),
        ...u16(0), // extra length
        ...u16(0), // comment length
        ...u16(0), // disk number start
        ...u16(0), // internal attrs
        ...u32(0o644 << 16), // external attrs (unix perms)
        ...u32(offset), // relative offset of local header
      ]);
      centralChunks.push(centralHeader, nameBytes);

      offset += localHeader.length + nameBytes.length + f.data.length;
    }

    const centralSize = centralChunks.reduce((a, c) => a + c.length, 0);
    const centralOffset = offset;

    const eocd = new Uint8Array([
      0x50, 0x4b, 0x05, 0x06, // end of central dir signature
      ...u16(0), // disk number
      ...u16(0), // disk with central dir
      ...u16(this.files.length), // entries on this disk
      ...u16(this.files.length), // total entries
      ...u32(centralSize),
      ...u32(centralOffset),
      ...u16(0), // comment length
    ]);

    const allChunks = [...localChunks, ...centralChunks, eocd];
    return new Blob(allChunks, { type: "application/zip" });
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
