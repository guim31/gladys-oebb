// -----------------------------------------------------------------------------
// A scenario staging the three triggers on the real midday data of Salzburg
// Hbf (trains only): the first read is silent, then, a minute later, the two
// parts of the Railjet to Innsbruck and Ötztal leave in 2 minutes ("time to
// leave"), the RJX 161 to Wien Hbf reports 12 minutes of delay and the RE5 to
// München is cancelled.
// -----------------------------------------------------------------------------

import { productsFilter } from '../../src/scotty.js';
import { CANCELLED_RT, action, boardKey, changeJourney, create } from './world.js';

export const SALZBURG_TRAINS = boardKey('8100002', productsFilter('trains'));

/** Resolves with the station device and the scene events fired after the first read. */
export async function stageEverything(world) {
  await action(world, 'add_station', { station: '8100002', group: 'trains' });
  const station = await create(world, 'Salzburg Hbf');
  const before = world.fake.sceneEvents.length;
  let board = world.network.boards[SALZBURG_TRAINS];
  board = changeJourney(board, 'RJX 161', {
    rt: { status: null, dlm: '12', dlt: '12:19', dld: '22.11.2026' },
  });
  board = changeJourney(board, 'RE5', { rt: CANCELLED_RT });
  world.network.boards[SALZBURG_TRAINS] = board;
  world.clock.advance(60000);
  await world.service.refresh();
  return { station, events: world.fake.sceneEvents.slice(before) };
}
