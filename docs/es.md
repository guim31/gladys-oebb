# ÖBB

Los próximos trenes de sus estaciones en Austria, en Gladys: Railjet, Intercity, REX, S-Bahn, y
los autobuses, tranvías y U-Bahn que también cubre el horario de ÖBB, en tiempo real, con
retrasos, vías y cancelaciones.

Los datos proceden de [Scotty](https://fahrplan.oebb.at), el horario público de ÖBB: **sin cuenta
ni clave**. Es un uso **no oficial** de sus paneles de salidas públicos, no una API oficial: puede
cambiar sin previo aviso. Esta integración no está afiliada a ÖBB (Österreichische
Bundesbahnen).

> **Desarrollada fuera de Austria: sus comentarios son bienvenidos.** Se construyó y probó con el
> servicio Scotty real (Wien Hbf, Salzburg Hbf, pequeñas estaciones de Salzburgo y Carintia), aún
> no en el uso diario.

## Qué obtiene

- **Un dispositivo por estación seguida**, filtrado si lo desea por tipo de transporte (trenes,
  larga distancia, regional, transporte urbano) y por una estación de paso: minutos hasta la
  próxima salida y la siguiente, retraso de la próxima, su hora, su tren y su dirección («12:07 RJX
  161 → Wien Hbf»), su vía y el número de trenes cancelados en el panel.
- **Un widget del panel de control**: las próximas salidas de una estación, coloreadas según su
  retraso, con cancelaciones.
- **Tres disparadores de escena**: hora de salir (1 a 30 minutos antes de una salida, el tiempo que
  necesita para llegar a la estación), tren con retraso (5 a 60 minutos) y tren cancelado, cada uno
  una vez por tren.
- **Una acción de escena**: leer los próximos trenes de una estación, con una frase lista para
  enviar por mensaje o a un altavoz.

## Requisitos

- Gladys Assistant 5.3.0 o posterior.
- Acceso a Internet desde el equipo de Gladys (la integración llama a `fahrplan.oebb.at`).

## Instalación

1. En Gladys, abra **Integraciones → Instalar desde GitHub**.
2. Pegue `https://github.com/guim31/gladys-oebb` e instale.
3. Abra la pestaña **Configuración** de la integración para seguir estaciones (abajo).

## Configuración

### Ajustes

- **Idioma de los textos**: idioma de los nombres de las funciones, de los textos de los
  dispositivos y de las frases enviadas a sus escenas (francés por defecto). Los nombres se fijan
  al crear un dispositivo.
- **Intervalo de actualización**: 1, 2 o 5 minutos. Cada actualización lee un panel por estación
  seguida.

### Seguir una estación

1. **Buscar una estación**: escriba su nombre o una parte («Salzburg», «Wien Hbf», «Linz»). La
   respuesta muestra las estaciones encontradas con su número, como `[8100002]`. La búsqueda de
   Scotty es tolerante: siempre propone algo, incluso lejos.
2. **Seguir una estación**: escriba su nombre completo o su número. Filtros opcionales:
   - **Tipo de transporte**: solo trenes (Railjet, ICE, IC, EC, Nightjet, REX, R, CJX, S-Bahn),
     solo larga distancia, solo regionales (REX, R, CJX, S-Bahn) o solo transporte urbano (U-Bahn,
     tranvía, autobús). Vacío: todo lo que sirve la parada.
   - **Estación de paso**: solo conserva las salidas que paran allí después — `Linz/Donau Hbf`
     desde Wien conserva los trenes hacia el oeste, sea cual sea su destino final.
     Un nombre que coincide con varias estaciones responde con su lista: escriba el nombre completo
     o el número.
3. Abra la pestaña **Descubrir** y cree el dispositivo.

La misma estación puede seguirse varias veces con otros filtros: cada una es un dispositivo. Las
grandes estaciones tienen varias entradas en Scotty (Wien Hbf (U) cubre todo el nudo, Wien Hbf
(Bahnsteige 3-12) solo los andenes principales): elija aquella cuyo panel desea.

### Quitar, comprobar el estado

- **Dejar de seguir una estación**: escriba el nombre que muestra **Estado**. Su dispositivo queda
  en Gladys hasta que lo elimine.
- **Estado**: las estaciones seguidas, si su dispositivo está creado, la última lectura de Scotty
  y el último error.

Un fallo (nada encontrado, Scotty inaccesible) se muestra en rojo, un éxito en verde.

## Dispositivos

Cada estación seguida tiene seis funciones:

| Función                  | Valor                                                                     |
| ------------------------ | ------------------------------------------------------------------------- |
| Próximo tren             | minutos hasta la próxima salida que circula; 1440 si no hay ninguna       |
| Tren siguiente           | minutos hasta la siguiente; 1440 si no hay ninguna                        |
| Retraso del próximo tren | minutos de retraso (un tren adelantado cuenta como puntual); 0 si ninguno |
| Próximo tren y destino   | «12:07 RJX 161 → Wien Hbf», o «Ningún tren anunciado»                     |
| Vía del próximo tren     | la vía que anuncia Scotty, cambios incluidos; «–» si se desconoce         |
| Trenes cancelados        | el número de salidas canceladas en el panel de la estación seguida        |

Las horas son las de Austria, retraso incluido. Un tren cancelado nunca es «el próximo tren». ÖBB
da un retraso en tiempo real para la mayoría de los trenes, no para cada autobús o tranvía: sin
él, la salida cuenta como puntual. Entre dos lecturas, las cuentas atrás siguen desde la última
respuesta.

## Widgets del panel de control

**Próximos trenes**: elija una estación seguida. Cada fila muestra la hora y la dirección, luego
la espera, el tren, su vía y su retraso: verde puntual, naranja desde 3 minutos de retraso, rojo
desde 10 o si está cancelado. Ajustes: el número de salidas mostradas (3 a 10), la leyenda y los
trenes cancelados, que pueden ocultarse. El título es el nombre del dispositivo en Gladys.

## Disparadores de escena

- **Hora de salir**: un tren sale de la estación elegida en el número de minutos elegido (1 a 30):
  elija el tiempo que necesita para llegar a la estación.
- **Tren con retraso**: un tren que aún sale de la estación elegida alcanza el retraso elegido (5
  a 60 minutos).
- **Tren cancelado**: un tren que aún sale de la estación elegida se anuncia cancelado.

Cada umbral se dispara una vez por tren. Nada se dispara en la primera lectura tras un arranque:
lo que ya estaba en el panel no es noticia. Variables: estación, destino, categoría (RJX, REX,
S…), número de tren, minutos de espera, retraso, hora prevista y hora programada, vía.

## Acciones de escena

**Obtener los próximos trenes**: para una estación seguida, devuelve `sentence` («ICE 118 a
Münster(Westf)Hbf desde Salzburg Hbf: en 1 min, vía 1, luego RJX 19952 a Ötztal en 3 min.»),
`station_name`, `destination`, `category`, `train_number`, `minutes`, `following_minutes`,
`delay`, `expected_time`, `scheduled_time`, `platform` y `cancelled` (número de trenes
cancelados). Sin tren, `minutes` vale 1440 y la frase lo indica.

## Ejemplos de escenas

- _Cada día laborable a las 7:30_ → **Obtener los próximos trenes** (St. Pölten Hbf, trenes, por
  Wien Hbf) → enviar `sentence` a su teléfono.
- **Hora de salir** (su estación, 12 min) → anunciarlo en un altavoz.
- **Tren cancelado** (su estación) → enviar un mensaje con el número del tren y su hora.

## Datos, actualización y cuotas

La integración lee, solo para los dispositivos creados, el panel de salidas de cada estación
seguida (`stboard.exe`, las 20 próximas salidas, filtradas por el propio Scotty) al intervalo
elegido; la búsqueda de estaciones (`ajax-getstop.exe`) solo cuando busca o añade una estación.
ÖBB no publica cuota ni condiciones para este uso: manténgalo personal. Una petición por estación
seguida y por minuto como máximo mantiene un uso ligero. Solo se escribe `/data/watch.json`: las
estaciones seguidas y sus filtros.

## Solución de problemas

- **Sin valor en un dispositivo nuevo**: espere a la próxima actualización (un minuto) o consulte
  **Estado**.
- **«No se puede leer Scotty»**: el sitio es inaccesible o responde con una página de error; la
  integración lo reintenta en cada actualización y las cuentas atrás continúan.
- **Falta un tren**: ya ha salido, está más allá de las 20 próximas salidas o no coincide con los
  filtros de la estación seguida.
- **Registros**: configure `LOG_LEVEL=debug` para ver cada lectura.

## Límites

- Las salidas que muestra Scotty: ÖBB, los ferrocarriles privados, los autobuses y tranvías de su
  horario. Los trenes de Westbahn aparecen cuando Scotty los incluye.
- Las páginas públicas de Scotty son no oficiales y no están documentadas: un cambio por su parte
  puede romper la integración hasta una actualización.
- La cancelación de una sola parada o una cancelación parcial puede no indicarse.
- 10 estaciones seguidas como máximo. Los nombres de las funciones se fijan al crear el
  dispositivo.

## Créditos

Datos: [Scotty](https://fahrplan.oebb.at), ÖBB. Las páginas de panel de salidas utilizadas son las
de los monitores de salidas de la comunidad (sensor `oebb` de Home Assistant, MIT). Logotipo de la
portada: ÖBB (marca de su propietario).
