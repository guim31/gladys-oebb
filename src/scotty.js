// -----------------------------------------------------------------------------
// Scotty (https://fahrplan.oebb.at), the public timetable of ÖBB: two reads of
// its web pages, public and without key, used by the departure boards of many
// home automation projects, but neither documented nor officially supported.
//
// - the station search (`ajax-getstop.exe`): the suggestions of the timetable
//   form, a JavaScript statement `SLs.sls={...};SLs.showSuggestion();`;
// - the departure board (`stboard.exe`, live ticker layout): a JavaScript
//   statement `journeysObj = {...}`, with the scheduled time, the product
//   ("RJX 162"), the direction, the platform and, when ÖBB knows it, the
//   real-time delay ("rt") or a cancellation (status "Ausfall").
//
// Both answer in ISO-8859-1, the board with HTML entities ("&#214;tztal").
// An unknown station number answers a board without station name.
// -----------------------------------------------------------------------------

export const BASE_URL = 'https://fahrplan.oebb.at/bin';
const HOST = 'fahrplan.oebb.at';
const TIMEOUT_MS = 20000;
export const USER_AGENT = 'gladys-oebb (Gladys Assistant integration)';
// Departures read per board: the widget shows ten at most, the filters are
// applied by Scotty itself.
export const MAX_JOURNEYS = 20;
// Station numbers (IBNR / EVA): "8100002" (Salzburg Hbf), "1290401" (Wien Hbf).
export const STATION_CODE = /^\d{6,9}$/;

// The products of a board, by position in `productsFilter` (checked against
// the real boards: 0 Railjet, 2 IC/EC, 4 REX/R/CJX, 5 S-Bahn, 6 and 10 buses,
// 8 U-Bahn, 9 tram, 7 ferries, 11 on-call services).
export const PRODUCT_GROUPS = {
  trains: [0, 1, 2, 3, 4, 5, 12, 13],
  long_distance: [0, 1, 2, 3],
  regional: [4, 5, 12, 13],
  local: [6, 7, 8, 9, 10, 11],
};
const PRODUCT_BITS = 14;

/** The `productsFilter` of a group ("" or unknown: every product). */
export function productsFilter(group) {
  const bits = PRODUCT_GROUPS[group];
  return Array.from({ length: PRODUCT_BITS }, (_, index) =>
    !bits || bits.includes(index) ? '1' : '0',
  ).join('');
}

export class ScottyError extends Error {}

const ENTITIES = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };

/** "&#214;tztal" → "Ötztal". */
export function decodeEntities(text) {
  return String(text ?? '')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&(amp|quot|apos|lt|gt|nbsp);/g, (_, name) => ENTITIES[name])
    .replace(/\s+/g, ' ')
    .trim();
}

/** The JSON object of a JavaScript statement `name = {...}` (the first one). */
export function extractObject(text, marker) {
  const start = text.indexOf(marker);
  if (start < 0) {
    return null;
  }
  const open = text.indexOf('{', start + marker.length);
  if (open < 0) {
    return null;
  }
  // The object ends where the braces balance (strings may hold braces).
  let depth = 0;
  let inString = false;
  for (let index = open; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (char === '\\') {
        index += 1;
      } else if (char === '"') {
        inString = false;
      }
    } else if (char === '"') {
      inString = true;
    } else if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(open, index + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

export class Scotty {
  /** @param {{ fetch?: typeof fetch }} [options] */
  constructor({ fetch: fetchImpl = globalThis.fetch } = {}) {
    this.fetch = fetchImpl;
  }

  /** The body of a GET, decoded from ISO-8859-1. */
  async get(path, params) {
    const query = new URLSearchParams(params).toString();
    let response;
    try {
      response = await this.fetch(`${BASE_URL}/${path}?${query}`, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/javascript, */*' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw new ScottyError(`${HOST}: ${err.name === 'TimeoutError' ? 'timeout' : 'unreachable'}`);
    }
    if (!response.ok) {
      throw new ScottyError(`${HOST}: HTTP ${response.status}`);
    }
    const bytes = await response.arrayBuffer().catch(() => new ArrayBuffer(0));
    return new TextDecoder('latin1').decode(bytes);
  }

  /** The stations whose name matches a text: [{ code, name }], best first. */
  async search(text) {
    const wanted = String(text ?? '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!wanted) {
      return [];
    }
    const body = await this.get('ajax-getstop.exe/dn', {
      REQ0JourneyStopsS0A: '1',
      // The trailing "?" asks for a prefix search, as the timetable form does.
      REQ0JourneyStopsS0G: `${wanted}?`,
      js: 'true',
    });
    const data = extractObject(body, 'SLs.sls=');
    if (!data || !Array.isArray(data.suggestions)) {
      throw new ScottyError(`${HOST}: unexpected answer`);
    }
    const seen = new Set();
    const stations = [];
    for (const entry of data.suggestions) {
      // type 1: a station or stop (2 is an address, 4 a point of interest).
      const code = String(Number(entry?.extId ?? NaN));
      const name = decodeEntities(entry?.value);
      if (String(entry?.type) !== '1' || !STATION_CODE.test(code) || !name || seen.has(code)) {
        continue;
      }
      seen.add(code);
      stations.push({ code, name });
    }
    return stations;
  }

  /**
   * The departure board of a station: { name, journeys } where name is ""
   * for an unknown station number.
   * @param {string} code station number
   * @param {{ group?: string, via?: string }} [filters] product group, station number it passes
   */
  async board(code, { group = '', via = '' } = {}) {
    if (!STATION_CODE.test(String(code))) {
      return { name: '', journeys: [] };
    }
    const body = await this.get('stboard.exe/dn', {
      L: 'vs_scotty.vs_liveticker',
      evaId: String(code),
      boardType: 'dep',
      productsFilter: productsFilter(group),
      dirInput: STATION_CODE.test(String(via)) ? String(via) : '',
      maxJourneys: String(MAX_JOURNEYS),
      tickerID: 'dep',
      start: 'yes',
      eqstops: 'false',
      additionalTime: '0',
      outputMode: 'tickerDataOnly',
    });
    const data = extractObject(body, 'journeysObj');
    if (!data || typeof data !== 'object') {
      throw new ScottyError(`${HOST}: unexpected answer`);
    }
    return {
      name: decodeEntities(data.stationName),
      journeys: Array.isArray(data.journey) ? data.journey : [],
    };
  }

  /** The station of a number, or null when Scotty does not know it. */
  async station(code) {
    const { name } = await this.board(code);
    return name ? { code: String(code), name } : null;
  }
}
