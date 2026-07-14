export interface EncodingDetection {
  encoding: string;
  bom: boolean;
  text: string;
}

/** Strip UTF-8 BOM and report encoding. Browser FileReader gives decoded text; bytes path used when available. */
export function detectEncodingFromText(text: string): EncodingDetection {
  const bom = text.charCodeAt(0) === 0xfeff || text.startsWith('\uFEFF');
  return {
    encoding: 'utf-8',
    bom,
    text: bom ? text.replace(/^\uFEFF/, '') : text,
  };
}

/**
 * Detect BOM from raw bytes (UTF-8 / UTF-16 LE / UTF-16 BE).
 * Falls back to UTF-8 decode via TextDecoder.
 */
export function detectEncodingFromBytes(bytes: ArrayBuffer): EncodingDetection {
  const u8 = new Uint8Array(bytes);
  if (u8.length >= 3 && u8[0] === 0xef && u8[1] === 0xbb && u8[2] === 0xbf) {
    const text = new TextDecoder('utf-8').decode(u8.subarray(3));
    return { encoding: 'utf-8', bom: true, text };
  }
  if (u8.length >= 2 && u8[0] === 0xff && u8[1] === 0xfe) {
    const text = new TextDecoder('utf-16le').decode(u8.subarray(2));
    return { encoding: 'utf-16le', bom: true, text };
  }
  if (u8.length >= 2 && u8[0] === 0xfe && u8[1] === 0xff) {
    const text = new TextDecoder('utf-16be').decode(u8.subarray(2));
    return { encoding: 'utf-16be', bom: true, text };
  }
  const text = new TextDecoder('utf-8').decode(u8);
  return { encoding: 'utf-8', bom: false, text };
}

export async function readFileAsBytes(file: File): Promise<ArrayBuffer> {
  return file.arrayBuffer();
}
