// -----------------------------------------------------------------------------
// A complete test world: the SDK's fake Gladys, a fake `fetch` answering like
// Scotty from the real answers of test/fixtures/oebb (captured on Sunday
// 2026-11-22 at 11:59 in Austria: Wien Hbf with every product, trains only,
// long distance only and trains via Salzburg Hbf; Salzburg Hbf; Salzburg Süd,
// a small station; Krumpendorf/Wörther See, a small station of Carinthia; an
// unknown station number; the station searches of "Wien Hbf", "Salzburg",
// "Salzburg Hbf", "Salzburg Süd", "Krumpendorf", "Linz" and "zzqq"), a manual
// clock, a temporary /data, and the integration wired on top through
// registerHandlers. Nothing touches the network.
// -----------------------------------------------------------------------------

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';
import { Store } from '../../src/store.js';
import { extractObject, productsFilter } from '../../src/scotty.js';
import { fold } from '../../src/trains.js';

process.env.LOG_LEVEL ??= 'silent';
process.env.TZ = 'Europe/Vienna';

const fixturePath = (name) => new URL(`../fixtures/oebb/${name}`, import.meta.url);
/** A recorded answer, decoded from ISO-8859-1 as Scotty sends it. */
export const fixtureText = (name) => readFileSync(fixturePath(name)).toString('latin1');

// 2026-11-22 11:59:00 in Austria: the time the boards were read.
export const FIXTURE_TIME = Date.parse('2026-11-22T10:59:00Z');

const ALL = productsFilter('');
const TRAINS = productsFilter('trains');
const LONG = productsFilter('long_distance');
// The recorded boards: station number, products, station passed.
export const RECORDED = [
  ['1290401', ALL, ''],
  ['1290401', TRAINS, ''],
  ['1290401', LONG, ''],
  ['1290401', TRAINS, '8100002'],
  ['8100002', ALL, ''],
  ['8100002', TRAINS, ''],
  ['1250109', ALL, ''],
  ['1250109', TRAINS, ''],
  ['8100079', ALL, ''],
  ['8100079', TRAINS, ''],
];
export const boardKey = (code, products = ALL, via = '') => `${code}-${products}-${via}`;

/** A recorded board, parsed: { stationName, journey: [...] } (a copy the test may change). */
export const recordedBoard = (code, products = ALL, via = '') =>
  extractObject(fixtureText(`board-${boardKey(code, products, via)}.txt`), 'journeysObj');

const SEARCHES = {
  'wien hbf': 'search-wien-hbf.txt',
  salzburg: 'search-salzburg.txt',
  'salzburg hbf': 'search-salzburg-hbf.txt',
  'salzburg sud': 'search-salzburg-sud.txt',
  krumpendorf: 'search-krumpendorf.txt',
  linz: 'search-linz.txt',
};

/**
 * A fake `fetch` answering like Scotty. `boards` holds the parsed board of
 * each recorded (station, products, via) key (change them to stage a delay);
 * an unknown station answers a board without name, like Scotty. `fail`
 * makes every request fail with an Error or an HTTP status. Every call is
 * recorded in `calls`.
 */
export function createFetch() {
  const boards = {};
  for (const [code, products, via] of RECORDED) {
    boards[boardKey(code, products, via)] = recordedBoard(code, products, via);
  }
  const network = { boards, calls: [], fail: null };
  const latin1 = (text) =>
    new Response(Buffer.from(text, 'latin1'), {
      status: 200,
      headers: { 'content-type': 'text/html; charset=ISO-8859-1' },
    });
  network.fetch = async (url, options = {}) => {
    network.calls.push({ url, headers: options.headers });
    if (network.fail instanceof Error) {
      throw network.fail;
    }
    if (typeof network.fail === 'number') {
      return new Response('<html>error</html>', { status: network.fail });
    }
    const parsed = new URL(url);
    const params = parsed.searchParams;
    if (parsed.pathname.endsWith('/ajax-getstop.exe/dn')) {
      const query = fold(String(params.get('REQ0JourneyStopsS0G')).replace(/\?$/, ''));
      // Scotty's search is fuzzy: a text matching nothing still lists far stations.
      return latin1(fixtureText(SEARCHES[query] ?? 'search-zzqq.txt'));
    }
    if (parsed.pathname.endsWith('/stboard.exe/dn')) {
      const board = network.boards[
        boardKey(params.get('evaId'), params.get('productsFilter'), params.get('dirInput'))
      ] ?? { stationName: '', stationEvaId: params.get('evaId'), maxJ: null };
      return latin1(`journeysObj = ${JSON.stringify(board)}`);
    }
    return new Response('not found', { status: 404 });
  };
  network.boardRequests = () => network.calls.filter((call) => /stboard/.test(call.url));
  return network;
}

/** Changes the journeys of a board whose product ("RJX 162") matches. */
export const changeJourney = (board, product, change) => ({
  ...board,
  journey: board.journey.map((journey) =>
    String(journey.pr).replace(/\s+/g, ' ') === product ? { ...journey, ...change } : journey,
  ),
});

/** The real-time block of a cancelled journey, as Scotty writes it. */
export const CANCELLED_RT = { status: 'Ausfall', dlm: '', dlt: '', dld: '' };

/** A manual clock. */
export function createClock(start = FIXTURE_TIME) {
  const clock = {
    time: start,
    now: () => clock.time,
    advance(ms) {
      clock.time += ms;
    },
  };
  return clock;
}

/**
 * @param {object} [options]
 * @param {object} [options.config] raw integration config
 * @param {object} [options.network] from createFetch
 * @param {Array} [options.devices] devices already created in Gladys
 * @param {object} [options.saved] content of /data/watch.json before the start
 * @param {boolean} [options.connect]
 * @param {boolean} [options.timers]
 */
export async function createWorld({
  config = {},
  network = createFetch(),
  devices = [],
  saved,
  connect = true,
  timers = false,
  clock = createClock(),
  dataDir = mkdtempSync(join(tmpdir(), 'gladys-oebb-')),
} = {}) {
  const gladys = createFakeGladys({ config, devices });
  const store = new Store(dataDir);
  if (saved) {
    await store.save(saved);
    await store.flush();
  }
  const app = registerHandlers(gladys, {
    store,
    fetch: network.fetch,
    timers,
    now: clock.now,
    dataDir,
  });
  const world = { gladys, fake: gladys.fake, app, service: app.service, network, clock, store };
  if (connect) {
    await gladys.connect();
    await app.ready;
    await app.service.inflight;
  }
  return world;
}

/** Run a configuration action; resolves with its message (multi-language). */
export async function action(world, key, fields = {}) {
  const ack = await world.fake.action(key, fields);
  if (!ack.success) {
    throw new Error(`action ${key} failed: ${JSON.stringify(ack.error)}`);
  }
  return ack.data.message;
}

/** The discovered device whose name contains `name`. */
export function discovered(world, name) {
  const device = world.fake.discoveredDevices.find((d) => d.name.includes(name));
  if (!device) {
    throw new Error(`no discovered device named ${name}`);
  }
  return device;
}

/** "Add to Gladys" on the discovered device named `name`; resolves with it. */
export async function create(world, name) {
  const device = discovered(world, name);
  await world.fake.deviceCreated(device);
  return device;
}

/** The last state published on a feature of a device. */
export const lastState = (world, device, key) =>
  world.fake.lastState(`${device.external_id}:${key}`);

/** Captures the log lines of the integration at `level` and above. */
export function captureLogs(t, level = 'info') {
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = level;
  const lines = [];
  const record = (...args) => {
    const text = args.map((arg) => (arg instanceof Error ? arg.message : String(arg))).join(' ');
    const match = /^\[[^\]]+\] \[(\w+)\]/.exec(text);
    lines.push({ level: match ? match[1].toLowerCase() : 'raw', text });
  };
  t.mock.method(console, 'log', record);
  t.mock.method(console, 'error', record);
  t.after(() => {
    process.env.LOG_LEVEL = previous;
  });
  return lines;
}
