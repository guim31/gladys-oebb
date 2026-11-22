# ÖBB for Gladys Assistant

A [Gladys Assistant](https://gladysassistant.com) external integration for **Austria**: the next
trains of your stations (Railjet, Intercity, REX, S-Bahn, and the buses, trams and U-Bahn of the
same timetable), in real time, with delays, platforms and cancellations, from
[Scotty](https://fahrplan.oebb.at), the public timetable of ÖBB. No account, no key. **Unofficial**:
it reads the public departure boards of the ÖBB website, not an official API.

> **Developed without being in Austria: feedback welcome.** The integration is built and tested on
> real Scotty answers (recorded on a Sunday at midday at Wien Hbf, Salzburg Hbf, Salzburg Süd and
> Krumpendorf/Wörther See) and its container was run against the live service; it has not yet run
> in a Gladys installation. Please report what works and what does not in the
> [issues](https://github.com/guim31/gladys-oebb/issues) or on the Gladys forum.

## What it does

- **A device per watched station**, optionally filtered by type of transport (trains, long
  distance, regional, local transport) and by a station the trains pass: minutes to the next
  departure and to the following one, delay of the next one, its time, train and direction, its
  platform, and the number of cancelled trains on the board.
- **A dashboard widget**: the next departures of a station, coloured by delay, cancellations
  included.
- **Three scene triggers**: time to leave, train delayed, train cancelled, each once per train.
- **A scene action**: the next trains of a station, with a sentence ready for a message or a
  speaker.

Texts and documentation in English, French, German and Spanish: [en](docs/en.md),
[fr](docs/fr.md), [de](docs/de.md), [es](docs/es.md).

## Requirements

- Gladys Assistant 5.3.0 or later.
- Internet access from the Gladys host.

## Installation

1. In Gladys, open **Integrations → Install from GitHub**.
2. Paste `https://github.com/guim31/gladys-oebb` and install.
3. In the **Configuration** tab, use **Find a station** and **Watch a station**, then create the
   device in the **Discover** tab.

## How it works

Every minute (or two, or five), for the created devices only, the integration reads the departure
board of each watch (`stboard.exe` in its live ticker layout, the next 20 departures, filtered by
Scotty itself by product and by a station passed). The station search (`ajax-getstop.exe`) runs only
when you search or add a station. Both answer in ISO-8859-1 JavaScript statements with HTML
entities; times are Austrian time. ÖBB publishes no quota nor terms for these pages: one request
per watch per refresh, one minute at the shortest, for personal use. Only `/data/watch.json` is
written: the watched stations and their filters.

## Limits

- The departures Scotty shows: ÖBB, the private railways and the buses and trams of its timetable.
- The pages are unofficial and undocumented: a change on the ÖBB side may break the integration
  until an update.
- A real-time delay is known for most trains, not for every bus or tram; partial cancellations may
  show as running.
- Up to 10 watched stations. Feature names are set when the device is created.

## Development

```bash
npm ci
npm run format:check && npm run lint && npm test
npx -y github:GladysAssistant/integration-store --skip-image-check .
```

The tests run against the SDK's fake Gladys and real Scotty answers recorded in
`test/fixtures/oebb`; they never touch the network. See [`CLAUDE.md`](CLAUDE.md) for the project
rules.

## Credits

- Data: [Scotty](https://fahrplan.oebb.at), ÖBB.
- Cover: the ÖBB logo from [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Logo_%C3%96BB.svg)
  (public domain), in white on the ÖBB red.
- The board and search pages are the ones used by the community departure monitors, such as the
  Home Assistant [`oebb` sensor](https://github.com/lollopod/home-assistant-oebb) (MIT). Modelled on
  the `gladys-trenitalia` integration.

Not affiliated with ÖBB (Österreichische Bundesbahnen). The logo is a trademark of its owner.

## License

Apache-2.0
