# ÖBB

The next trains of your stations in Austria, in Gladys: Railjet, Intercity, REX, S-Bahn, and the
buses, trams and U-Bahn that the ÖBB timetable also covers, in real time, with delays, platforms
and cancellations.

The data comes from [Scotty](https://fahrplan.oebb.at), the public timetable of ÖBB: **no account,
no key**. This is an **unofficial** use of its public departure boards, not an official API: it
may change without notice. This integration is not affiliated with ÖBB (Österreichische
Bundesbahnen).

> **Developed from outside Austria: feedback welcome.** It was built and tested on the live
> Scotty service (Wien Hbf, Salzburg Hbf, small stations of Salzburg and Carinthia), not yet in
> daily use.

## What you get

- **A device per watched station**, optionally filtered by type of transport (trains, long
  distance, regional, local transport) and by a station the trains pass: minutes to the next
  departure and to the following one, the delay of the next one, its time, train and direction
  (“12:07 RJX 161 → Wien Hbf”), its platform, and the number of cancelled trains on the board.
- **A dashboard widget**: the next departures of a station, coloured by delay, cancellations
  included.
- **Three scene triggers**: time to leave (1 to 30 minutes before a departure, the time you need
  to reach the station), train delayed (5 to 60 minutes late) and train cancelled, each once per
  train.
- **A scene action**: read the next trains of a station, with a sentence ready to send by message
  or to a speaker.

## Requirements

- Gladys Assistant 5.3.0 or later.
- Internet access from the Gladys host (the integration calls `fahrplan.oebb.at`).

## Installation

1. In Gladys, open **Integrations → Install from GitHub**.
2. Paste `https://github.com/guim31/gladys-oebb` and install.
3. Open the integration's **Configuration** tab to watch stations (below).

## Configuration

### Settings

- **Language of the texts**: language of the feature names, of the texts of the devices and of
  the sentences sent to your scenes (French by default). Feature names are set when a device is
  created.
- **Refresh interval**: 1, 2 or 5 minutes. Each refresh reads one board per watched station.

### Watching a station

1. **Find a station**: type its name or part of it (“Salzburg”, “Wien Hbf”, “Linz”). The answer
   lists the matching stations with their number, such as `[8100002]`. Scotty's search is
   tolerant: it always suggests something, even far away.
2. **Watch a station**: type its full name or its number. Optional filters:
   - **Type of transport**: trains only (Railjet, ICE, IC, EC, Nightjet, REX, R, CJX, S-Bahn),
     long distance only, regional only (REX, R, CJX, S-Bahn) or local transport only (U-Bahn,
     tram, bus). Empty: everything the stop serves.
   - **Station the trains pass**: keeps only the departures that stop there later — `Linz/Donau
Hbf` from Wien keeps the trains towards the west, whatever their final destination.
     A name matching several stations answers with their list: type the full name or the number.
3. Open the **Discover** tab and create the device.

The same station can be watched several times with other filters: each one is a device. Large
stations have several entries in Scotty (Wien Hbf (U) covers the whole hub; Wien Hbf (Bahnsteige
3-12) only the main platforms): pick the one whose board you want.

### Removing, checking the state

- **Stop watching a station**: type the name shown by **Status**. Its device stays in Gladys
  until you delete it.
- **Status**: the watched stations, whether their device is created, the last read of Scotty and
  the last error.

A failure (nothing found, Scotty unreachable) shows in red, a success in green.

## Devices

Each watched station has six features:

| Feature                    | Value                                                                |
| -------------------------- | -------------------------------------------------------------------- |
| Next train                 | minutes to the next departure that runs; 1440 when none is announced |
| Following train            | minutes to the one after; 1440 when none                             |
| Delay of the next train    | minutes late (an early train counts as on time); 0 when none         |
| Next train and destination | “12:07 RJX 161 → Wien Hbf”, or “No train announced”                  |
| Platform of the next train | the platform Scotty announces, changes included; “–” when unknown    |
| Cancelled trains           | the number of cancelled departures on the board of the watch         |

Times are Austrian time, delay included. A cancelled train is never “the next train”. ÖBB gives
a real-time delay for most trains, not for every bus or tram: without one, the departure counts
as on time. Between two reads the countdowns go on from the last answer.

## Dashboard widgets

**Next trains**: pick a watched station. Each row shows the time and direction, then the wait,
the train, its platform and its delay: green on time, orange from 3 minutes late, red from 10 or
when cancelled. Settings: the number of departures shown (3 to 10), the legend and the cancelled
trains, both of which can be hidden. The heading is the name of the device in Gladys.

## Scene triggers

- **Time to leave**: a train leaves the chosen station in the chosen number of minutes (1 to 30):
  choose the time you need to reach the station.
- **Train delayed**: a train still to leave the chosen station reaches the chosen delay (5 to 60
  minutes).
- **Train cancelled**: a train still to leave the chosen station is announced cancelled.

Each threshold fires once per train. Nothing fires at the first read after a start: what was
already on the board is not news. Variables: station, destination, category (RJX, REX, S…),
train number, minutes to wait, delay, expected and scheduled time, platform.

## Scene actions

**Get the next trains**: for a watched station, returns `sentence` (“ICE 118 to Münster(Westf)Hbf
from Salzburg Hbf: in 1 min, platform 1, then RJX 19952 to Ötztal in 3 min.”), `station_name`,
`destination`, `category`, `train_number`, `minutes`, `following_minutes`, `delay`,
`expected_time`, `scheduled_time`, `platform` and `cancelled` (number of cancelled trains). With
no train, `minutes` is 1440 and the sentence says so.

## Scene examples

- _Every weekday at 7:30_ → **Get the next trains** (St. Pölten Hbf, trains, via Wien Hbf) → send
  `sentence` to your phone.
- **Time to leave** (your station, 12 min) → announce it on a speaker.
- **Train cancelled** (your station) → send a message with the train number and its time.

## Data, refresh and quotas

The integration reads, for the created devices only, the departure board of each watch
(`stboard.exe`, the next 20 departures, filtered by Scotty itself) at the chosen interval; the
station search (`ajax-getstop.exe`) only when you search or add a station. ÖBB publishes no quota
nor terms for this use: keep it personal. One request per watch per minute at most keeps the use
light. Only `/data/watch.json` is written: the stations you watch and their filters.

## Troubleshooting

- **No value on a new device**: wait for the next refresh (one minute), or check **Status**.
- **“Scotty cannot be read”**: the site is unreachable or answers an error page; the integration
  retries at each refresh and the countdowns go on meanwhile.
- **A train is missing**: it has left, or is beyond the next 20 departures, or does not match the
  filters of the watch.
- **Logs**: set `LOG_LEVEL=debug` to see every read.

## Limits

- The departures Scotty shows: ÖBB, the private railways and the buses and trams of its
  timetable. Westbahn trains appear when Scotty lists them.
- Scotty's public pages are unofficial and undocumented: a change on their side can break the
  integration until an update.
- The cancellation of a single stop or a partial cancellation may not be reported.
- Up to 10 watched stations. Feature names are set when the device is created.

## Credits

Data: [Scotty](https://fahrplan.oebb.at), ÖBB. The departure board pages used here are the ones
of the community departure monitors (Home Assistant `oebb` sensor, MIT). Logo on the cover: ÖBB
(trademark of its owner).
