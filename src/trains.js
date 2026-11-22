// -----------------------------------------------------------------------------
// From the raw Scotty journeys to what the integration works with: the trains
// still to leave a station (minutes, delay, platform, cancelled) and the
// names. Pure functions: the clock is a parameter.
//
// Scotty writes its times in the time of Austria ("11:30", "22.11.2026"),
// whatever the time zone of the container: they are read as such.
// -----------------------------------------------------------------------------

import { PRODUCT_GROUPS, decodeEntities } from './scotty.js';

// The groups of products a watch can keep (manifest action `add_station`).
export const GROUPS = Object.keys(PRODUCT_GROUPS);
// Status of a cancelled journey in the real-time block.
const CANCELLED = /ausfall/i;
const CANCELLED_KEPT_MS = 3600000;
const VIENNA = 'Europe/Vienna';
const VIENNA_TIME = new Intl.DateTimeFormat('en-GB', {
  timeZone: VIENNA,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const VIENNA_PARTS = new Intl.DateTimeFormat('en-GB', {
  timeZone: VIENNA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Lower case, without accents nor punctuation: "Wien Hbf (U)" matches "wien hbf u". */
export function fold(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .replace(/[’'`()[\],]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "22:50", the time of Austria. */
export const viennaTime = (ms) => (Number.isFinite(ms) ? VIENNA_TIME.format(new Date(ms)) : '');

/** The offset of Vienna from UTC at an instant, in ms (1 h in winter, 2 h in summer). */
function viennaOffset(ms) {
  const parts = Object.fromEntries(
    VIENNA_PARTS.formatToParts(new Date(ms)).map((part) => [part.type, part.value]),
  );
  const wall = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
  );
  return wall - Math.floor(ms / 60000) * 60000;
}

/**
 * The instant of a time of Austria: ("22.11.2026", "11:30") → ms, NaN when
 * unreadable.
 */
export function viennaMs(date, time) {
  const d = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(String(date ?? '').trim());
  const t = /^(\d{1,2}):(\d{2})$/.exec(String(time ?? '').trim());
  if (!d || !t) {
    return NaN;
  }
  const wall = Date.UTC(Number(d[3]), Number(d[2]) - 1, Number(d[1]), Number(t[1]), Number(t[2]));
  // Two passes: the offset at the guessed instant, then at the corrected one.
  const guess = wall - viennaOffset(wall);
  return wall - viennaOffset(guess);
}

/** "RJX 162" → "RJX", "U1" → "U", "Bus 13A" → "Bus". */
export const categoryOf = (product) => (/^\p{L}+/u.exec(product)?.[0] ?? '').toUpperCase();

/**
 * One departure per journey still to leave the station, soonest first.
 * @param {object[]} journeys from Scotty.board
 * @param {number} now ms, when the board was read
 */
export function parseDepartures(journeys, now) {
  const departures = new Map();
  for (const journey of Array.isArray(journeys) ? journeys : []) {
    const scheduledAt = viennaMs(journey?.da, journey?.ti);
    // "RJX19952" is written without its space by Scotty: "RJX 19952".
    const number = decodeEntities(journey?.pr).replace(/^(\p{Lu}{2,})(\d{3,})$/u, '$1 $2');
    if (!Number.isFinite(scheduledAt) || !number) {
      continue;
    }
    const key = `${journey.id ?? number}|${journey.da}|${journey.ti}`;
    if (departures.has(key)) {
      continue;
    }
    // `rt` is false without real-time data, else { status, dlm, dlt, dld }.
    const rt = journey.rt && typeof journey.rt === 'object' ? journey.rt : null;
    const cancelled = CANCELLED.test(String(rt?.status ?? ''));
    let expected = scheduledAt;
    if (rt && !cancelled) {
      const realTime = viennaMs(rt.dld || journey.da, rt.dlt);
      const minutes = Number(rt.dlm);
      if (Number.isFinite(realTime)) {
        // A delay past midnight without its date ("23:55" → "00:05"): the next day.
        expected = realTime < scheduledAt - 12 * 3600000 ? realTime + 86400000 : realTime;
      } else if (Number.isFinite(minutes) && rt.dlm !== '' && rt.dlm !== null) {
        expected = scheduledAt + minutes * 60000;
      }
    }
    // Left more than a minute ago: gone (a cancelled train stays until its time).
    if (!cancelled && expected < now - 60000) {
      continue;
    }
    const late = cancelled ? 0 : Math.max(0, Math.round((expected - scheduledAt) / 60000));
    departures.set(key, {
      key,
      number,
      category: categoryOf(number),
      destination: decodeEntities(journey.st) || decodeEntities(journey.lastStop) || '?',
      time: viennaTime(expected),
      scheduled: viennaTime(scheduledAt),
      late,
      platform: decodeEntities(journey.tr),
      platformChanged: journey.trChg === true,
      cancelled,
      minutes: Math.max(0, Math.ceil((expected - now) / 60000)),
      expected,
    });
  }
  return [...departures.values()].sort((a, b) => a.expected - b.expected);
}

/**
 * The departures of an earlier read, as of `now`: minutes counted again, the
 * gone ones dropped.
 */
export const aged = (departures, now) =>
  departures
    // A cancelled train stays as long as Scotty lists it (the next read
    // decides), an hour past its time at most when the reads fail.
    .filter((departure) =>
      departure.cancelled
        ? departure.expected >= now - CANCELLED_KEPT_MS
        : departure.expected >= now - 60000,
    )
    .map((departure) => ({
      ...departure,
      minutes: Math.max(0, Math.ceil((departure.expected - now) / 60000)),
    }));

/** The trains that run: a cancelled one is never "the next train". */
export const running = (departures) => departures.filter((departure) => !departure.cancelled);

/**
 * The station a typed text designates among search results: the exact name,
 * else the names containing the text, else the only result.
 * @param {{ code: string, name: string }[]} stations
 * @param {string} text
 * @returns {{ code: string, name: string }[]} one station, or the candidates
 */
export function pickStations(stations, text) {
  const wanted = fold(text);
  const exact = stations.filter((station) => fold(station.name) === wanted);
  if (exact.length > 0) {
    return exact.slice(0, 1);
  }
  const containing = stations.filter((station) => fold(station.name).includes(wanted));
  return containing.length > 0 ? containing : stations;
}
