const Qe = (v) => v !== null && typeof v === 'object';

/**
 * Validates the epak header.
 * @param {object} header
 * @returns {boolean}
 */
function isValidHeader(header) {
    if (Qe(header)) {
        if (Qe(header.dimensions)) return Object.values(header.dimensions).every(r => typeof r.length == 'number');
        if (Qe(header.variables)) return Object.values(header.variables).every(r => Array.isArray(r.dimensions));
        if (Qe(header.columns)) return Object.values(header.columns).every(Qe);
    }
    return false;
}

/**
 * Decodes variable-length integers from a Uint8Array into a typed array.
 * @param {TypedArray} out The array to write decoded integers into.
 * @param {Uint8Array} data The raw byte data.
 * @returns {TypedArray} The output array.
 */
function decodeVarInt(out, data) {
    let n = 0, // out index
        r = 0; // data index
    while (r < data.length) {
        let o = data[r++];
        if (o < 128) {
            o = o << 25 >> 25;
        } else {
            switch (o >> 4) {
                case 8: case 9: case 10: case 11: // 14-bit signed
                    o = (((o & 0x3f) << 8 | data[r++]) << 18) >> 18;
                    break;
                case 12: case 13: // 21-bit signed
                    o = (((o & 0x1f) << 16 | data[r++] << 8 | data[r++]) << 11) >> 11;
                    break;
                case 14: // 28-bit signed
                    o = (((o & 0x0f) << 24 | data[r++] << 16 | data[r++] << 8 | data[r++]) << 4) >> 4;
                    break;
                case 15:
                    if (o === 255) {
                        for (let i = 1 + data[r++]; i > 0; i--) out[n++] = NaN;
                        continue
                    } else {
                        switch (o & 7) {
                            case 0: case 1: case 2: case 3: case 4: case 5: case 6: case 7:
                                o = data[r++] << 24 | data[r++] << 16 | data[r++] << 8 | data[r++];
                                break;
                            default:
                                throw new Error('NYI');
                        }
                    }
                    break;
            }
        }
        out[n++] = o;
    }
    return out;
}

/**
 * Reverses a 2D delta encoding with prediction. (from fv)
 * @param {Float32Array} e data
 * @param {number} t cols
 * @param {number} r rows
 * @param {number} n grids
 * @returns {Float32Array}
 */
function reverse2dDelta(e, t, r, n) {
    let o, i, a, s, c, l, u;
    for (a = 0; a < n; a++) {
        for (l = a * t * r, o = 1; o < t; o++) s = l + o,
        u = e[s - 1],
        e[s] += u === u ? u : 0;
        for (i = 1; i < r; i++) for (c = l + i * t, u = e[c - t], e[c] += u === u ? u : 0, o = 1; o < t; o++) {
            s = c + o;
            let f = e[s - 1],
                p = e[s - t],
                m = e[s - t - 1];
            u = f + p - m,
            e[s] += u === u ? u : f === f ? f : p === p ? p : m === m ? m : 0
        }
    }
    return e
}

/**
 * Applies a scaling factor to the data.
 * @param {TypedArray} data The data array.
 * @param {number} scaleFactor The factor to divide by.
 * @returns {TypedArray} The scaled data array.
 */
function scaleData(data, scaleFactor) {
    for (let i = 0; i < data.length; i++) {
        data[i] /= scaleFactor;
    }
    return data;
}

/**
 * Decodes a PPAK data block payload. (from pv)
 * @returns {Float32Array} The decoded data.
 */
function decodePpakData(rawData, cols, rows, grids, scaleFactor) {
    const data = new Float32Array(cols * rows * grids);
    decodeVarInt(data, rawData);
    reverse2dDelta(data, cols, rows, grids);
    scaleData(data, scaleFactor);
    return data;
}

/**
 * Parses a 'ppak' data block from the file buffer. (from mv)
 * @returns {object} The parsed block.
 */
function parsePpakBlock(buffer, offset, length) {
    const view = new DataView(buffer, offset, length);
    const rawData = new Uint8Array(buffer, offset + 16, length - 16);
    const cols = view.getInt32(0);
    const rows = view.getInt32(4);
    const grids = view.getInt32(8);
    const scaleFactor = Math.pow(10, view.getFloat32(12));

    return {
        type: 'ppak',
        data: decodePpakData(rawData, cols, rows, grids, scaleFactor),
        cols,
        rows,
        grids,
        scaleFactor,
        missingValue: NaN
    };
}

/**
 * Creates a typed array for QPAK data. (from dv)
 */
function createTypedArray(elementType, length) {
    switch (elementType) {
        case 0: return [];
        case 8: return new Float32Array(length);
        case 9: return new Float64Array(length);
        default: throw new Error(`unknown element type: ${elementType}`);
    }
}

/**
 * Reverses 1D delta encoding. (from yv)
 */
function reverse1dDelta(e, t) {
    for (let r = 0, n = 0; n < e.length; n++) t[n] = r = r + e[n]
}

/**
 * Decodes a QPAK data block payload. (from hv)
 */
function decodeQpakData(rawData, elementType, length, scaleFactor) {
    const data = createTypedArray(elementType, length);
    decodeVarInt(data, rawData);
    reverse1dDelta(data, data);
    scaleData(data, scaleFactor);
    return data;
}

/**
 * Parses a 'qpak' data block from the file buffer. (from gv)
 */
function parseQpakBlock(buffer, offset, length) {
    const view = new DataView(buffer, offset, length);
    const rawData = new Uint8Array(buffer, offset + 13, length - 13);
    const elementType = view.getUint8(0);
    const arrLength = view.getInt32(1);
    const scaleFactor = view.getFloat64(5);

    return {
        type: 'qpak',
        data: decodeQpakData(rawData, elementType, arrLength, scaleFactor),
        scaleFactor,
        missingValue: NaN
    };
}

/**
 * Parses an EPAK file from its binary data.
 * @param {ArrayBuffer} arrayBuffer The EPAK file content.
 * @returns {{type: string, header: object, blocks: Array<object>}}
 */
export function parseEpak(arrayBuffer) {
    let offset = 0;
    const dataView = new DataView(arrayBuffer);
    const decoder = new TextDecoder('utf-8');

    const headMarker = decoder.decode(new Uint8Array(arrayBuffer, offset, 4));
    offset += 4;
    if (headMarker !== 'head') {
        throw new Error(`expected 'head' but found '${headMarker}'`);
    }

    const headerSize = dataView.getInt32(offset);
    offset += 4;
    const headerJson = decoder.decode(new Uint8Array(arrayBuffer, offset, headerSize));
    const header = JSON.parse(headerJson);
    offset += headerSize;

    if (!isValidHeader(header)) {
        throw new Error('epak header is not valid');
    }

    const blocks = [];
    while (offset < arrayBuffer.byteLength) {
        const blockMarker = decoder.decode(new Uint8Array(arrayBuffer, offset, 4));
        if (blockMarker === 'tail') {
            break;
        }
        offset += 4;

        const blockSize = dataView.getInt32(offset);
        offset += 4;

        let blockData;
        switch (blockMarker) {
            case 'ppak':
                blockData = parsePpakBlock(arrayBuffer, offset, blockSize);
                break;
            case 'qpak':
                blockData = parseQpakBlock(arrayBuffer, offset, blockSize);
                break;
            default:
                throw new Error('unknown block type: ' + blockMarker);
        }
        blocks.push(blockData);
        offset += blockSize;
    }

    return {
        type: 'epak',
        header,
        blocks,
    };
}
