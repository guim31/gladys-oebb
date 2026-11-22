// -----------------------------------------------------------------------------
// The integration end to end, against the SDK's fake Gladys and a fake Scotty
// answering the real recorded boards: the actions (green on success, red on
// failure), the devices and their states, the filters, a cancelled train, an
// unknown station, Scotty down or answering garbage, the triggers, the scene
// action, the widget, the restoration after /data is lost, the container's
// own timer and the quiet logs.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { NO_DEPARTURE_MINUTES } from '../src/devices.js';
import { USER_AGENT, productsFilter } from '../src/scotty.js';
import { TRIGGERS } from '../src/service.js';
import { SALZBURG_TRAINS, stageEverything } from './helpers/scenario.js';
import {
  CANCELLED_RT,
  action,
  boardKey,
  captureLogs,
  changeJourney,
  create,
  createFetch,
  createWorld,
  lastState,
} from './helpers/world.js';

async function watched(t, fields, name, options = {}) {
  const world = await createWorld(options);
  t.after(() => world.app.stop());
  await action(world, 'add_station', fields);
  const device = await create(world, name);
  return { world, device };
}
const salzburg = (t, options) =>
  watched(t, { station: 'Salzburg Hbf', group: 'trains' }, 'Salzburg Hbf', options);
const KRUMPENDORF = boardKey('8100079', productsFilter('trains'));

test('search: the stations matching a text, with their number', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const message = await action(world, 'search_stations', { query: 'Salzburg' });
  assert.match(message.en, /station\(s\) found/);
  assert.match(message.fr, /• Salzburg Hbf \[8100002\]/);
  assert.equal(message.en.split('\n').filter((line) => line.startsWith('•')).length, 10);
  const empty = await world.fake.action('search_stations', { query: '  ' });
  assert.equal(empty.success, false);
  assert.match(empty.error.de, /Gib den Anfang/);
  world.network.fail = new Error('ECONNREFUSED');
  const down = await world.fake.action('search_stations', { query: 'Linz' });
  assert.equal(down.success, false);
  assert.match(down.error.fr, /Scotty est illisible \(fahrplan\.oebb\.at: unreachable\)/);
});

test('add: by name, by number, with a filter and a station passed; errors in red', async (t) => {
  const world = await createWorld({ config: { language: 'en' } });
  t.after(() => world.app.stop());
  const added = await action(world, 'add_station', { station: 'salzburg hbf' });
  assert.match(added.fr, /Salzburg Hbf ajoutée/);
  const filtered = await action(world, 'add_station', {
    station: 'Wien Hbf',
    group: 'trains',
    via: 'Salzburg Hbf',
  });
  assert.match(filtered.en, /Wien Hbf \(U\) \(Trains · via Salzburg Hbf\) added/);
  const byNumber = await action(world, 'add_station', { station: '8100079', group: 'trains' });
  assert.match(byNumber.de, /Krumpendorf\/Wörther See Bahnhof \(Züge\) hinzugefügt/);
  assert.equal(world.fake.discoveredDevices.length, 3);

  // The number as the search writes it, with leading zeros: the same station.
  const zeros = await world.fake.action('add_station', { station: '008100002' });
  assert.match(zeros.data.message.en, /Salzburg Hbf is already watched/);
  const twice = await world.fake.action('add_station', { station: '8100002' });
  assert.equal(twice.success, true);
  assert.match(twice.data.message.en, /already watched/);

  const unknownNumber = await world.fake.action('add_station', { station: '1130165' });
  assert.equal(unknownNumber.success, false);
  assert.match(unknownNumber.error.es, /Ninguna estación coincide con «1130165»/);

  // Scotty's search is fuzzy: a name matching nothing lists far stations.
  const nonsense = await world.fake.action('add_station', { station: 'zzqq' });
  assert.equal(nonsense.success, false);
  assert.match(nonsense.error.fr, /Plusieurs gares correspondent à « zzqq »/);
  assert.match(nonsense.error.fr, /• Zaragoza Delicias \[7175506\]/);

  const same = await world.fake.action('add_station', {
    station: '8100002',
    via: 'Salzburg Hbf',
  });
  assert.equal(same.success, false);
  assert.match(same.error.en, /must differ/);
});

test('a created station publishes its next trains, delay, platform and cancellations', async (t) => {
  const { world, device } = await salzburg(t);
  assert.equal(device.should_poll, false);
  assert.equal(device.poll_frequency, undefined);
  assert.match(device.name, /^ÖBB · Salzburg Hbf \(Trains\)$/);
  assert.equal(lastState(world, device, 'next'), 1);
  assert.equal(lastState(world, device, 'following'), 3);
  assert.equal(lastState(world, device, 'delay'), 0);
  assert.equal(lastState(world, device, 'destination'), '12:00 ICE 118 → Münster(Westf)Hbf');
  assert.equal(lastState(world, device, 'platform'), '1');
  assert.equal(lastState(world, device, 'cancelled'), 0);
  assert.deepEqual(world.fake.widgetRefreshes, ['departures']);
  // The filter is applied by Scotty: the trains-only board was asked for.
  const [request] = world.network.boardRequests();
  const params = new URL(request.url).searchParams;
  assert.equal(params.get('productsFilter'), '11111100000011');
  assert.equal(params.get('evaId'), '8100002');
  assert.equal(request.headers['User-Agent'], USER_AGENT);
  // Three minutes later without a new read: the countdowns go on.
  world.network.fail = 503;
  world.clock.advance(180000);
  await world.service.refresh();
  assert.equal(lastState(world, device, 'next'), 0, 'the RJX 19952, 6 min late, leaves now');
  assert.equal(lastState(world, device, 'delay'), 6);
});

test('the station passed: Wien Hbf, trains via Salzburg Hbf', async (t) => {
  const { world, device } = await watched(
    t,
    { station: 'Wien Hbf', group: 'trains', via: 'Salzburg Hbf' },
    'via',
    { config: { language: 'fr' } },
  );
  assert.equal(lastState(world, device, 'next'), 36);
  assert.equal(lastState(world, device, 'delay'), 7);
  assert.equal(lastState(world, device, 'destination'), '12:35 RJX 19982 → Ötztal');
  const params = new URL(world.network.boardRequests()[0].url).searchParams;
  assert.equal(params.get('dirInput'), '8100002');
});

test('a cancelled train: counted, never the next train, shown in red', async (t) => {
  const network = createFetch();
  network.boards[KRUMPENDORF] = changeJourney(network.boards[KRUMPENDORF], 'S 4', {
    rt: CANCELLED_RT,
  });
  const { world, device } = await watched(
    t,
    { station: '8100079', group: 'trains' },
    'Krumpendorf',
    { network },
  );
  assert.ok(lastState(world, device, 'cancelled') >= 3);
  assert.equal(lastState(world, device, 'destination'), '15:17 S 1 → Wolfsberg in Ktn');
  const widget = await world.fake.widgetGet('departures', {
    settings: { station: device.external_id },
    language: 'fr',
  });
  assert.deepEqual(validateWidgetContent(widget.data.content), []);
  const rows = widget.data.content.components.at(-1).items;
  assert.deepEqual(rows[0], {
    label: '12:18 → Hermagor',
    value: 'S 4 · supprimé',
    color: 'danger',
  });
  const hidden = await world.fake.widgetGet('departures', {
    settings: { station: device.external_id, show_cancelled: false },
    language: 'fr',
  });
  assert.equal(hidden.data.content.components.at(-1).items[0].label, '15:17 → Wolfsberg in Ktn');
});

test('an empty board: no train announced', async (t) => {
  const network = createFetch();
  network.boards[KRUMPENDORF] = { ...network.boards[KRUMPENDORF], journey: [] };
  const { world, device } = await watched(
    t,
    { station: '8100079', group: 'trains' },
    'Krumpendorf',
    { network },
  );
  assert.equal(lastState(world, device, 'next'), NO_DEPARTURE_MINUTES);
  assert.equal(lastState(world, device, 'following'), NO_DEPARTURE_MINUTES);
  assert.equal(lastState(world, device, 'delay'), 0);
  assert.equal(lastState(world, device, 'destination'), 'Aucun train annoncé');
  assert.equal(lastState(world, device, 'platform'), '–');
  const result = await world.fake.sceneAction('get_next_departures', {
    station: device.external_id,
  });
  assert.equal(result.success, true);
  assert.match(result.data.outputs.sentence, /Aucun train annoncé au départ de Krumpendorf/);
});

test('Scotty down: one warning, the status says it in four languages, then it comes back', async (t) => {
  const { world } = await salzburg(t);
  const logs = captureLogs(t, 'info');
  world.network.fail = new Error('ETIMEDOUT');
  for (let i = 0; i < 3; i += 1) {
    world.clock.advance(60000);
    await world.service.refresh();
  }
  const status = world.fake.connectionStatus;
  assert.equal(status.connected, false);
  assert.deepEqual(Object.keys(status.message).sort(), ['de', 'en', 'es', 'fr']);
  assert.match(status.message.en, /Scotty cannot be read \(fahrplan\.oebb\.at: unreachable\)/);
  assert.equal(logs.filter((line) => line.level === 'warn').length, 1);
  world.network.fail = null;
  world.clock.advance(60000);
  await world.service.refresh();
  assert.equal(world.fake.connectionStatus.connected, true);
  assert.equal(logs.filter((line) => /reachable again/.test(line.text)).length, 1);
  const answer = await action(world, 'status');
  assert.match(answer.fr, /Salzburg Hbf \(Trains\) \[8100002\] — appareil créé/);
});

test('an HTTP error or a maintenance page: an error, not an empty board', async (t) => {
  const { world, device } = await salzburg(t);
  world.network.fail = 502;
  world.clock.advance(60000);
  await world.service.refresh();
  assert.equal(world.fake.connectionStatus.connected, false);
  assert.match(world.fake.connectionStatus.message.en, /HTTP 502/);
  world.network.fail = null;
  world.service.api.fetch = async () => new Response('<html>Wartungsarbeiten</html>');
  world.service.lastError = null;
  world.clock.advance(60000);
  await world.service.refresh();
  assert.match(world.fake.connectionStatus.message.en, /unexpected answer/);
  assert.equal(lastState(world, device, 'next'), 0, 'the last board, aged');
});

test('triggers: silent at the first read, then each threshold once per train', async (t) => {
  const world = await createWorld({ config: { language: 'en' } });
  t.after(() => world.app.stop());
  const { station, events } = await stageEverything(world);
  const delayed = events.filter((event) => event.key === TRIGGERS.DELAYED);
  assert.deepEqual(
    delayed.map((event) => [event.data.train_number, event.data.threshold]),
    [
      ['RJX 161', '5'],
      ['RJX 161', '10'],
    ],
  );
  assert.equal(delayed[0].data.station, station.external_id);
  assert.equal(delayed[0].data.station_name, 'Salzburg Hbf');
  assert.equal(delayed[0].data.delay, 12);
  assert.equal(delayed[0].data.category, 'RJX');
  assert.equal(delayed[0].data.destination, 'Wien Hbf');
  assert.equal(delayed[0].data.platform, '4');
  assert.equal(delayed[0].data.expected_time, '12:19');
  assert.equal(delayed[0].data.scheduled_time, '12:07');
  const soon = events.filter((event) => event.key === TRIGGERS.SOON);
  assert.deepEqual(
    soon.map((event) => [event.data.train_number, event.data.threshold]),
    [
      ['RJX 19952', '2'],
      ['RJX 162', '2'],
      ['RJX 186', '7'],
      ['EC 115', '7'],
      ['EC 1216', '10'],
      ['S 3', '15'],
      ['S 2', '30'],
    ],
  );
  // The delayed RJX 161 now leaves in 18 minutes: no countdown threshold crossed.
  assert.ok(!soon.some((event) => event.data.train_number === 'RJX 161'));
  const cancelled = events.filter((event) => event.key === TRIGGERS.CANCELLED);
  assert.deepEqual(
    cancelled.map((event) => [event.data.train_number, event.data.destination]),
    [['RE5', 'München Hbf Gl.5-10']],
  );
  // The same board again: nothing new.
  const count = world.fake.sceneEvents.length;
  world.clock.advance(1000);
  await world.service.refresh();
  assert.equal(world.fake.sceneEvents.length, count);
});

test('a cancelled train never says "time to leave"', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  await stageEverything(world);
  const before = world.fake.sceneEvents.length;
  for (let i = 0; i < 4; i += 1) {
    world.clock.advance(60000);
    await world.service.refresh();
  }
  const events = world.fake.sceneEvents.slice(before);
  assert.ok(!events.some((event) => event.data.train_number === 'RE5'));
});

test('a train missing from one answer does not fire its delay twice', async (t) => {
  const world = await createWorld({ config: { language: 'en' } });
  t.after(() => world.app.stop());
  await stageEverything(world);
  const full = world.network.boards[SALZBURG_TRAINS];
  world.network.boards[SALZBURG_TRAINS] = {
    ...full,
    journey: full.journey.filter((journey) => journey.pr !== 'RJX 161'),
  };
  world.clock.advance(1000);
  await world.service.refresh();
  world.network.boards[SALZBURG_TRAINS] = full;
  world.clock.advance(1000);
  const before = world.fake.sceneEvents.length;
  await world.service.refresh();
  const again = world.fake.sceneEvents
    .slice(before)
    .filter((event) => event.key === TRIGGERS.DELAYED);
  assert.deepEqual(again, []);
});

test('the scene action: numbers and a sentence; a station no longer watched fails in red', async (t) => {
  const { world, device } = await salzburg(t, { config: { language: 'en' } });
  const result = await world.fake.sceneAction('get_next_departures', {
    station: device.external_id,
  });
  assert.equal(result.success, true);
  assert.deepEqual(result.data.outputs, {
    sentence:
      'ICE 118 to Münster(Westf)Hbf from Salzburg Hbf: in 1 min, platform 1, then RJX 19952 to Ötztal in 3 min.',
    station_name: 'Salzburg Hbf',
    destination: 'Münster(Westf)Hbf',
    category: 'ICE',
    train_number: 'ICE 118',
    minutes: 1,
    following_minutes: 3,
    delay: 0,
    expected_time: '12:00',
    scheduled_time: '12:00',
    platform: '1',
    cancelled: 0,
  });
  await action(world, 'remove_station', { name: 'Salzburg Hbf (Trains)' });
  const gone = await world.fake.sceneAction('get_next_departures', {
    station: device.external_id,
  });
  assert.equal(gone.success, false);
  assert.match(gone.error.fr, /Cette gare n'est plus suivie/);
});

test('the widget: a row per departure, coloured by delay, within the core budget', async (t) => {
  const { world, device } = await watched(
    t,
    { station: 'Wien Hbf', group: 'long_distance' },
    'Wien Hbf',
  );
  const ack = await world.fake.widgetGet('departures', {
    settings: { station: device.external_id, rows: '8' },
    language: 'en',
  });
  const content = ack.data.content;
  assert.deepEqual(validateWidgetContent(content), []);
  assert.equal(content.components[0].text, device.name.slice(0, 40));
  const rows = content.components.at(-1).items;
  assert.equal(rows.length, 8);
  assert.deepEqual(rows[0], {
    label: '12:00 → Graz Hbf',
    value: '1 min · IC 535 · pl. 7A-B · +7 min',
    color: 'warning',
  });
  assert.equal(rows[2].color, 'danger', 'EC 140, 34 min late');
  assert.equal(rows[1].value, '1 min · EC 203 · pl. 6A-B · on time');
  for (const row of rows) {
    assert.ok(row.label.length <= 40 && row.value.length <= 40);
  }
  const bare = await world.fake.widgetGet('departures', {
    settings: { station: device.external_id, show_legend: false, rows: '3' },
    language: 'de',
  });
  assert.equal(bare.data.content.components.length, 2);
  assert.equal(bare.data.content.components[1].items.length, 3);
  assert.equal(
    bare.data.content.components[1].items[0].value,
    '1 Min. · IC 535 · Gl. 7A-B · +7 Min.',
  );
  const none = await world.fake.widgetGet('departures', { settings: {}, language: 'es' });
  assert.match(none.data.content.components[0].text, /Elija una estación/);
});

test('a lost /data: the stations are rebuilt from the Gladys devices', async (t) => {
  const first = await createWorld();
  await action(first, 'add_station', {
    station: 'Wien Hbf',
    group: 'trains',
    via: '8100002',
  });
  const device = await create(first, 'Wien Hbf');
  await first.app.stop();
  const world = await createWorld({ devices: [device] });
  t.after(() => world.app.stop());
  assert.deepEqual(
    world.service.watches.map((watch) => [
      watch.code,
      watch.name,
      watch.group,
      watch.via,
      watch.viaName,
    ]),
    [['1290401', 'Wien Hbf (U)', 'trains', '8100002', 'Salzburg Hbf']],
  );
  assert.equal(lastState(world, device, 'destination'), '12:35 RJX 19982 → Ötztal');
});

test('remove: by the name shown in the status; an unknown name fails in red', async (t) => {
  const { world } = await salzburg(t);
  const failed = await world.fake.action('remove_station', { name: 'Graz' });
  assert.equal(failed.success, false);
  assert.match(failed.error.es, /Ninguna estación seguida se llama «Graz»/);
  const removed = await action(world, 'remove_station', { name: 'salzburg hbf (züge)' });
  assert.match(removed.en, /no longer watched/);
  assert.equal(world.fake.discoveredDevices.length, 0);
  assert.deepEqual(world.service.watches, []);
});

test('the container refreshes on its own timer, without Gladys polling', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const { world } = await salzburg(t, { timers: true });
  const before = world.network.boardRequests().length;
  t.mock.timers.tick(60000);
  await world.service.inflight;
  assert.equal(world.network.boardRequests().length, before + 1);
});

test('a normal cycle writes nothing at the info level', async (t) => {
  const { world } = await salzburg(t);
  const logs = captureLogs(t, 'info');
  world.network.boards[SALZBURG_TRAINS] = changeJourney(
    world.network.boards[SALZBURG_TRAINS],
    'RE5',
    { rt: { status: null, dlm: '2', dlt: '12:07', dld: '22.11.2026' } },
  );
  world.clock.advance(60000);
  await world.service.refresh();
  assert.deepEqual(logs, []);
});

test('a failed read does not leave a rejection for the next callers', async (t) => {
  const { world } = await salzburg(t);
  const original = world.service.doRefresh.bind(world.service);
  let calls = 0;
  world.service.doRefresh = async (options) => {
    calls += 1;
    if (calls === 1) {
      throw new Error('boom');
    }
    return original(options);
  };
  const first = world.service.refresh().catch(() => 'failed');
  const queued = world.service.refresh();
  assert.equal(await first, 'failed');
  await queued;
  assert.equal(calls, 2);
});

test('at a 5-minute interval, the countdowns go on every minute from the last board', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const { world, device } = await salzburg(t, {
    timers: true,
    config: { refresh_interval: '300' },
  });
  const reads = world.network.boardRequests().length;
  world.clock.advance(60000);
  t.mock.timers.tick(60000);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(lastState(world, device, 'next'), 0);
  assert.equal(world.network.boardRequests().length, reads, 'no new read');
});

test('a failed start is tried again at the next connection', async (t) => {
  const world = await createWorld({ connect: false });
  t.after(() => world.app.stop());
  const load = world.store.load.bind(world.store);
  let calls = 0;
  world.store.load = async () => {
    calls += 1;
    if (calls === 1) {
      throw new Error('disk');
    }
    return load();
  };
  await world.gladys.connect();
  await world.app.ready;
  assert.equal(world.fake.connectionStatus.connected, false);
  world.gladys.emit('connected');
  await new Promise((resolve) => setTimeout(resolve, 50));
  await world.service.inflight;
  assert.equal(calls, 2);
  assert.equal(world.fake.connectionStatus.connected, true);
});
