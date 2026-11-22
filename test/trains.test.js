// -----------------------------------------------------------------------------
// The pure functions, on the real answers of Scotty: the departures of a
// station (real-time delays, platforms, HTML entities, Austrian time), a
// cancellation, the station search, the product filters and the station pick.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Scotty, decodeEntities, extractObject, productsFilter } from '../src/scotty.js';
import {
  aged,
  categoryOf,
  fold,
  parseDepartures,
  pickStations,
  running,
  viennaMs,
  viennaTime,
} from '../src/trains.js';
import {
  CANCELLED_RT,
  FIXTURE_TIME,
  changeJourney,
  createFetch,
  recordedBoard,
} from './helpers/world.js';

const TRAINS = productsFilter('trains');
const board = (code, products, via) =>
  parseDepartures(recordedBoard(code, products, via).journey, FIXTURE_TIME);

test('Austrian time, winter and summer, whatever the time zone of the container', () => {
  assert.equal(viennaMs('22.11.2026', '11:59'), FIXTURE_TIME);
  assert.equal(viennaMs('1.7.2027', '08:05'), Date.parse('2027-07-01T06:05:00Z'));
  // The night of the change to summer time: 03:30 exists, in UTC+2.
  assert.equal(viennaMs('28.03.2027', '03:30'), Date.parse('2027-03-28T01:30:00Z'));
  assert.ok(Number.isNaN(viennaMs('', '12:00')));
  assert.equal(viennaTime(FIXTURE_TIME), '11:59');
});

test('the product filters: one bit per product family, in the order of Scotty', () => {
  assert.equal(productsFilter(''), '11111111111111');
  assert.equal(productsFilter('trains'), '11111100000011');
  assert.equal(productsFilter('long_distance'), '11110000000000');
  assert.equal(productsFilter('regional'), '00001100000011');
  assert.equal(productsFilter('local'), '00000011111100');
});

test('Wien Hbf, trains: real-time delays, platforms, the train that left is dropped', () => {
  const departures = board('1290401', TRAINS);
  const [first, second] = departures;
  const third = departures.find((d) => d.number === 'EC 140');
  // EC 140, scheduled 11:30, 34 minutes late: leaves at 12:04.
  assert.deepEqual(
    [third.number, third.category, third.destination, third.scheduled, third.time, third.late],
    ['EC 140', 'EC', 'Wien Westbahnhof', '11:30', '12:04', 34],
  );
  assert.deepEqual([third.platform, third.platformChanged, third.minutes], ['8A-B', true, 5]);
  // REX 1 at 11:59 without real-time data: leaves now.
  assert.deepEqual([first.number, first.minutes, first.late], ['REX 1', 0, 0]);
  // IC 535, 11:53 + 7: in a minute.
  assert.deepEqual(
    [second.number, second.time, second.minutes, second.late],
    ['IC 535', '12:00', 1, 7],
  );
  assert.ok(departures.every((d, i) => i === 0 || d.expected >= departures[i - 1].expected));
  assert.equal(running(departures).length, departures.length);
});

test('HTML entities and ISO-8859-1: "&#214;tztal", "München Hbf"', () => {
  const departures = board('1290401', TRAINS, '8100002');
  assert.ok(departures.some((d) => d.destination === 'Ötztal'));
  assert.ok(departures.some((d) => d.destination === 'München Hbf'));
  assert.equal(decodeEntities('M&#252;nster(Westf)Hbf &amp; co'), 'Münster(Westf)Hbf & co');
  assert.equal(categoryOf('U1'), 'U');
  assert.equal(categoryOf('Bus 13A'), 'BUS');
});

test('a small station: Krumpendorf, trains every hour or two', () => {
  const departures = board('8100079', TRAINS);
  assert.deepEqual(
    departures.slice(0, 2).map((d) => `${d.time} ${d.number} ${d.destination} ${d.minutes}`),
    ['12:18 S 4 Hermagor 19', '13:41 S 4 Klagenfurt Hbf 102'],
  );
});

test('a cancelled train: on the board until its time, never running', () => {
  const raw = changeJourney(recordedBoard('8100079', TRAINS), 'S 4', { rt: CANCELLED_RT });
  const departures = parseDepartures(raw.journey, FIXTURE_TIME);
  const cancelled = departures.filter((d) => d.cancelled);
  assert.ok(cancelled.length >= 2);
  assert.ok(cancelled.every((d) => d.late === 0 && d.time === d.scheduled));
  assert.ok(!running(departures).some((d) => d.cancelled));
  // Past its time, a cancelled train stays an hour at most.
  const first = cancelled[0];
  assert.ok(aged([first], first.expected + 30 * 60000).length === 1);
  assert.deepEqual(aged([first], first.expected + 61 * 60000), []);
});

test('the countdowns age between two reads, the trains gone are dropped', () => {
  const later = aged(board('1290401', TRAINS), FIXTURE_TIME + 3 * 60000);
  assert.ok(!later.some((d) => d.scheduled === '11:59'), 'left 3 minutes ago');
  assert.equal(later.find((d) => d.number === 'EC 140').minutes, 2);
  assert.deepEqual(parseDepartures(null, FIXTURE_TIME), []);
});

test('the search: stations only, numbers without leading zeros, ISO-8859-1 names', async () => {
  const scotty = new Scotty({ fetch: createFetch().fetch });
  const salzburg = await scotty.search('Salzburg');
  assert.deepEqual(salzburg[0], { code: '1150101', name: 'Salzburg' });
  assert.ok(salzburg.some((s) => s.code === '8100002' && s.name === 'Salzburg Hbf'));
  assert.ok(salzburg.some((s) => s.name === 'Salzburg Süd Bahnhst [in Elsbethen]'));
  assert.ok(salzburg.every((s) => /^\d+$/.test(s.code)));
  assert.deepEqual(await scotty.search('  '), []);
  // Unknown station number: a board without name.
  assert.equal(await scotty.station('1130165'), null);
  assert.deepEqual(await scotty.station('8100002'), { code: '8100002', name: 'Salzburg Hbf' });
});

test('the station of a typed name: exact, then containing, then the candidates', () => {
  const stations = [
    { code: '8100002', name: 'Salzburg Hbf' },
    { code: '1150101', name: 'Salzburg' },
    { code: '1250109', name: 'Salzburg Süd Bahnhst [in Elsbethen]' },
  ];
  assert.deepEqual(pickStations(stations, 'salzburg hbf'), [stations[0]]);
  assert.deepEqual(pickStations(stations, 'SALZBURG'), [stations[1]]);
  assert.equal(pickStations(stations, 'sud').length, 1);
  assert.equal(pickStations(stations, 'linz').length, 3);
  assert.equal(fold('Straße'), 'strasse');
});

test('the object of a JavaScript statement, braces inside strings included', () => {
  assert.deepEqual(extractObject('x = {"a":"}{","b":{"c":1}};y()', 'x'), { a: '}{', b: { c: 1 } });
  assert.equal(extractObject('<html>maintenance</html>', 'journeysObj'), null);
});
