# Buenos Aires Recicla VR

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

Abrí <http://localhost:8080>. Con el mouse podés agarrar los residuos y arrastrarlos a los
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

Para jugar no hace falta caminar: se puede jugar de pie o sentado.

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
index.html              página y "import map" (three.js local)
datos/reglas.json       reglas, puntajes y textos editables
src/arranque.js         emulador opcional (?emular=1) y modo offline
src/main.js             arma la escena y conecta todo
src/config.js           medidas de la escena (mesa, contenedores, panel)
src/logica/             reglas y partida (sin 3D, con tests unitarios)
src/escena/             plaza, contenedores, residuos, panel de mensajes, botón
src/interaccion/        agarrar y soltar (controles y mouse) y física mínima
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
