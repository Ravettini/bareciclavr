# Buenos Aires Recicla VR · La plaza que se vacía

Experiencias de realidad virtual para jornadas del Gobierno de la Ciudad, en **Meta Quest 2**:

La página de inicio (`index.html`) es un **selector**: se elige la experiencia y después se toca
**ENTRAR EN VR**. Desde cada experiencia, el botón "← Elegir experiencia" vuelve al inicio.

| Experiencia | Dirección | Estado |
|---|---|---|
| **Buenos Aires Recicla**: separar residuos en la Estación Saludable | `/reciclaje.html` | Prueba jugable |
| **La plaza que se vacía**: la baja de la natalidad (Subsecretaría de Familia y Natalidad) | `/natalidad.html` | Parte 1 jugable |

## La plaza que se vacía

Unos 3 minutos (tope de seguridad: 4), de pie o sentado, con controles o con las manos. Un
minijuego por año en la misma plaza; cada año hay **menos chicos** y **menos espacios de infancia**.

| Año | Minijuego | Chicos | La plaza |
|---|---|---|---|
| 2014 | Atajar y devolver la pelota | 16 | Colores vivos, todo funciona |
| 2016 | Básquet. El compañero se esfuma con la pelota en el aire | 15 → 14 | Tobogán cerrado con cinta |
| 2019 | Empujar la hamaca (desde atrás) | 12 | A la hamaca de al lado le sacaron el asiento |
| 2022 | Reventar burbujas (una sola chica en el arenero) | 9 | Arenero tapado con una lona; menos color |
| 2024 | La pelota vuelve rodando; la tirás y nadie la devuelve | 8 | Juegos vallados, todo gris |

**Cómo se nota que se van:** entre capítulos hay un fundido a negro; a oscuras, los chicos que se van
se ubican jugando frente al jugador. Al volver la luz avanzan los años y, en cada año, los que
corresponden según la serie de nacimientos **saludan y se esfuman** a la vista (se vuelven blancos y
desaparecen en destellos), dejando su juguete en el piso. El panel cuenta cuántos quedan. La plaza
pierde color de a poco; los chicos conservan el suyo hasta que se van.

**Cartel de mensajes:** sigue la mirada de forma suave (a 2,4 m, un poco por encima de los ojos);
si el jugador gira la cabeza más de 30°, se reacomoda frente a él, y cada texto nuevo aparece donde
está mirando. Se dibuja por encima de todo para que nunca quede tapado.

**Jugar sentado:** al entrar en VR (y en cada cambio de año) se mide la altura de la cabeza; si está
por debajo de 1,3 m, el jugador "sube" hasta que sus ojos quedan a 1,45 m. La pelota que está en el
piso cerca salta a la mano cuando se baja la mano (con controles, apretando el gatillo).

**Tiros:** si al soltar la mano todavía se mueve, es un tiro: la velocidad es la máxima de los
últimos ~250 ms (medida en tramos de 50 ms) con un refuerzo del 30 %, así la pelota no "se cae" al
soltarla. Si la mano ya estaba casi quieta, es apoyar o dejar caer: cae suave (por ejemplo, un
residuo en el contenedor).

La pérdida de espacios es una **metáfora** (cinta, asiento quitado, lona, vallas, color): no hay
carteles literales de cierre.

**Con las manos** (seguimiento de manos): cerrar la mano cerca de la pelota la agarra y abrirla la
suelta; si la pelota llega volando a la palma, queda atajada, y se tira con un movimiento rápido.
También sirve pellizcar. **Con controles:** gatillo o botón lateral.

Textos, años y duración de cada capítulo están en [`datos/natalidad.json`](datos/natalidad.json).

**Locución:** 9 frases en `sonidos/voz-*.mp3` (ElevenLabs, voz "Martin Kalbin – Argentinian
Narrator"). El guion está en [`docs/guion-voz.md`](docs/guion-voz.md). Para regenerarla: se genera el
guion completo en un solo audio y se corta en frases con la transcripción de cada palabra (Whisper)
para encontrar los cortes; el volumen se normaliza a −16 LUFS. Mientras habla la voz, el ambiente
baja. Si falta un archivo, el juego sigue sin esa frase.

**Pendiente:** reemplazar la serie ilustrativa por la oficial del IDECBA, la revisión de
comunicación institucional, sonido ambiente grabado (plaza, risas) y una parte final sobre "¿Qué
hace falta?" con los programas de la subsecretaría.

---

## Buenos Aires Recicla

Juego educativo de realidad virtual para **Meta Quest 2**: en una plaza porteña, frente a la
Estación Saludable, el jugador separa residuos entre el contenedor **verde** (reciclables) y el
**negro** (basura).

Es una aplicación **WebXR**: se juega desde el navegador del visor (Meta Quest Browser), sin
instalar nada. Funciona **sin internet** (three.js va incluido en `vendor/` y un service worker
guarda el juego en el visor).

> **Estado: primera entrega (prueba jugable).** Incluye un escenario mínimo, dos contenedores,
> tres residuos, agarrar y soltar, validación de la clasificación, mensajes educativos, puntaje y
> reinicio. Todavía no tiene niveles adicionales.

## Cómo probarlo

### En una PC (sin visor)

Requiere Node.js 18 o más nuevo.

```bash
npm run serve
```

Abrí <http://localhost:8080> y elegí la experiencia. Con el mouse podés agarrar los residuos y arrastrarlos a los
contenedores. Si abrís <http://localhost:8080/?emular=1> se simula un Quest 2 (emulador IWER de
Meta): tocá **ENTRAR EN VR** para ver el modo VR en la pantalla.

### En el Meta Quest 2: por cable USB (recomendado para la primera prueba)

WebXR solo funciona en páginas seguras (`https://` o `localhost`). Con `adb reverse`, el visor
ve el servidor de tu PC como si fuera `localhost`.

1. Activá el **modo desarrollador** del visor desde la app Meta Horizon en el celular
   (Dispositivos → tu Quest 2 → Configuración del visor → Modo desarrollador).
2. Instalá [Android Platform Tools](https://developer.android.com/tools/releases/platform-tools)
   (incluye `adb`) en la PC.
3. Conectá el visor por USB y aceptá el permiso de depuración USB que aparece adentro del visor.
4. En la PC, en esta carpeta:

   ```bash
   npm run serve
   ```

   ```bash
   adb reverse tcp:8080 tcp:8080
   ```

5. En el visor, abrí el **navegador** y entrá a `http://localhost:8080`.
6. Tocá **ENTRAR EN VR**.

### En el Meta Quest 2: desde Vercel (lo más fácil)

1. En Vercel: **Add New → Project** e importá este repositorio.
2. En **Framework Preset** elegí **Other**. No hace falta comando de build: el juego son archivos
   estáticos (`.vercelignore` deja afuera tests y scripts).
3. Deploy. Usá la dirección de **producción** (`<proyecto>.vercel.app`): las de preview suelen
   pedir login de Vercel.
4. En el visor, abrí esa dirección en el navegador y tocá **ENTRAR EN VR**.

### Sin conexión en el evento

1. En el visor, abrí la dirección **una vez con internet**.
3. A partir de ahí el service worker sirve el juego aunque no haya conexión.

## Cómo se juega

| Acción | Control |
|---|---|
| Agarrar | Gatillo **o** botón lateral (grip) |
| Soltar o tirar | Soltar el botón (el objeto conserva el impulso de la mano) |
| Agarrar a distancia | Apuntar con el rayo y apretar: el objeto viene a la mano (sirve para jugar sentado) |
| Reiniciar | Al terminar, apuntar al botón **Reiniciar** y apretar el gatillo |
| **Con las manos** (sin controles) | Pellizcar índice y pulgar cerca del residuo para agarrarlo; abrir los dedos para soltarlo. Apuntando con el rayo y pellizcando se agarra a distancia o se presiona Reiniciar |

Para usar las manos, el seguimiento de manos tiene que estar activado en el Quest
(Configuración → Movimiento → Seguimiento de manos). Basta con dejar los controles apoyados.

Para jugar no hace falta caminar: se puede jugar de pie o sentado.

## Si algo no funciona en el visor

Si el juego no carga o no puede entrar en VR, aparece un recuadro naranja arriba con el motivo
y la versión del juego. Una foto de ese recuadro alcanza para diagnosticar el problema.

## Reglas y textos (para revisión institucional)

Todas las reglas de clasificación, los puntajes y los mensajes están en
[`datos/reglas.json`](datos/reglas.json), separados del código:

- `contenedores`: qué categorías acepta cada contenedor.
- `residuos`: nombre, categoría, forma, posición en la mesa y los mensajes de acierto y de error.
- `puntaje`: 10 puntos si acierta al primer intento, 5 si acierta después de un error. Un error
  no resta puntos: el residuo vuelve a la mesa con una explicación.
- `textos`: bienvenida, caída al piso y resultados.

Después de editarlo, corré `npm test`: valida que el archivo siga siendo coherente.

## Reemplazar las formas provisionales por modelos 3D

Los residuos se dibujan con primitivas. Para usar un modelo definitivo:

1. Exportá el modelo como `.glb` (pocos polígonos; idealmente menos de 2.000 triángulos por
   objeto) y guardalo en `modelos/`.
2. En `datos/reglas.json`, completá `"modelo": "modelos/botella.glb"` en el residuo.
3. Sumá el archivo a la lista `ARCHIVOS` de `sw.js` y subí `VERSION`, así funciona offline.

Si el modelo no carga, el juego sigue con la forma provisional. El escenario (`src/escena/plaza.js`)
se puede reemplazar por un único `.glb` de la plaza.

## Estructura

```
index.html              selector de experiencias
reciclaje.html          página de Buenos Aires Recicla ("import map" con three.js local)
datos/reglas.json       reglas, puntajes y textos editables
natalidad.html          página de La plaza que se vacía
datos/natalidad.json    textos, tiempos y serie de nacimientos (a validar)
src/natalidad/          plaza que se vacía: chicos, juegos, capítulos, pelota, sonido y guion
src/arranque.js         emulador opcional (?emular=1) y modo offline
src/main.js             arma la escena y conecta todo
src/config.js           medidas de la escena (mesa, contenedores, panel)
src/logica/             reglas y partida (sin 3D, con tests unitarios)
src/escena/             plaza, contenedores, residuos, panel de mensajes, botón
src/interaccion/        agarrar y soltar (controles, manos y mouse), botón VR y física mínima
src/feedback/           sonidos sintetizados (sin archivos)
vendor/                 three.js 0.186.1 e IWER 2.7.0 (copiados con npm run vendor)
sw.js                   service worker (modo offline)
tests/unit/             tests de la lógica
tests/e2e/              prueba de punta a punta en VR emulado
```

## Pruebas

```bash
npm install
```

```bash
npm test
```

```bash
npm run test:e2e
```

`npm test` corre los tests de la lógica. `npm run test:e2e` simula un Quest 2 con sus controles
(Meta IWER, en Chromium con Playwright). Entra en VR, agarra y suelta residuos con las dos manos,
de cerca y con el rayo, y verifica aciertos, errores, puntaje, la caída al piso, la pantalla de
resultados y el reinicio. Guarda capturas en `tests/e2e/capturas/`.

## Rendimiento (objetivo: 72 FPS en Quest 2)

- Unos 58 draw calls y 3.800 triángulos por frame (las dos vistas).
- Materiales Lambert (baratos en GPU móvil) y árboles y edificios con `InstancedMesh`.
- Sin sombras en tiempo real, sin postprocesado y sin transparencias.
- Foveated rendering fijo activado (`renderer.xr.setFoveation(1)`).
- Las texturas de texto se redibujan solo cuando cambia el mensaje.

## Qué está verificado y qué falta validar

**Verificado automáticamente** (Chromium + emulador IWER de Quest 2):

- Carga sin errores y entra en VR.
- Agarre cercano, agarre a distancia, soltar y tirar.
- Clasificación correcta e incorrecta, mensajes, puntaje y caída al piso.
- Pantalla de resultados y reinicio.
- Carga sin conexión, en Chromium de escritorio.

**Pendiente de validación manual en un Quest 2 real:**

- [ ] FPS reales (activar el contador con el Meta Quest Developer Hub u OVR Metrics Tool).
- [ ] Sensación del agarre: distancias, el offset del control y el impulso al tirar.
- [ ] Altura de la mesa y alcance a los contenedores, de pie y sentado.
- [ ] Legibilidad de los textos dentro del visor.
- [ ] Sonido y vibración de los controles.
- [ ] Funcionamiento sin internet en el navegador del Quest (service worker).
- [ ] Revisión institucional de los textos y criterios de `datos/reglas.json`.

## Compatibilidad

- WebXR en Meta Quest Browser. No usa APIs exclusivas de Quest 3, así que también funciona en
  Quest 3 y 3S.
- Meta anunció que Horizon OS v2.13 (marzo de 2027) es la última actualización de funciones para
  Quest 2. Este juego usa solo WebXR básico (`immersive-vr`, `local-floor`, controles), que ya
  está soportado en las versiones actuales.
