# Guion de voz · La plaza que se vacía

Para generar en ElevenLabs **en un solo audio**. Las pausas de 3 segundos (`<break time="3.0s" />`)
separan las frases: después el audio se corta automáticamente en 9 archivos
(`sonidos/voz-01-inicio.mp3` … `voz-09-cierre.mp3`) detectando esos silencios.

**Importante:** no cambiar el orden de las frases ni sacar las pausas. Si una frase se cambia,
avisar para actualizar también el texto del panel (`datos/natalidad.json`).

**Voz:** adulta, cálida, acento rioplatense, ritmo pausado, sin tono publicitario.
En el dato y el cierre, más lenta.

## Texto para pegar

```
Es una tarde cualquiera en una plaza de Buenos Aires. Los chicos juegan. Uno te quiere pasar la pelota... ¡Atajala!
<break time="3.0s" />
¡Muy bien! Ahora, devolvésela.
<break time="3.0s" />
Pasan los años...
<break time="3.0s" />
Dos mil dieciséis. ¡A jugar al básquet! Tirá la pelota al aro.
<break time="3.0s" />
Dos mil diecinueve. Empujá la hamaca. La de al lado... ya está vacía.
<break time="3.0s" />
Dos mil veintidós. ¡Burbujas! Reventalas con las manos.
<break time="3.0s" />
Dos mil veinticuatro. Tirá la pelota.
<break time="3.0s" />
En diez años, en la Ciudad de Buenos Aires, nacen la mitad de chicos.
<break time="3.0s" />
Tener hijos es una decisión de cada persona. Que quien quiera, pueda: eso se acompaña entre todos.
```

## Cuándo suena cada frase

| # | Archivo | Momento |
|---|---|---|
| 1 | voz-01-inicio | Al entrar en VR (2014) |
| 2 | voz-02-devolvela | Cuando el jugador ataja la primera pelota |
| 3 | voz-03-pasan-los-anios | Al empezar cada paso de los años |
| 4 | voz-04-basquet | Comienzo del básquet (2016) |
| 5 | voz-05-hamaca | Comienzo de la hamaca (2019) |
| 6 | voz-06-burbujas | Comienzo de las burbujas (2022) |
| 7 | voz-07-final | Cuando la pelota vuelve rodando (2024) |
| 8 | voz-08-dato | El dato |
| 9 | voz-09-cierre | El cierre |

---

# Parte 2 · Frases nuevas (grabadas el 19/11)

Mismas indicaciones: misma voz (Martin Kalbin – Argentinian Narrator), mismo modelo y ajustes,
**en un solo audio**. No hace falta que respete las pausas: el audio se corta con la transcripción.

## Texto para pegar

```
Este año hay un chico menos en la plaza.
<break time="3.0s" />
Este año hay dos chicos menos en la plaza.
<break time="3.0s" />
Este año hay tres chicos menos en la plaza.
<break time="3.0s" />
Tu compañero de juego... ya no está.
<break time="3.0s" />
Agarrá la pelota y tirásela.
```

| # | Archivo | Momento |
|---|---|---|
| 10 | voz-10-menos-1 | En un salto de tiempo, el año en que se va un chico |
| 11 | voz-11-menos-2 | …el año en que se van dos |
| 12 | voz-12-menos-3 | …el año en que se van tres |
| 13 | voz-13-sin-companero | 2016: el compañero de básquet se esfuma |
| 14 | voz-14-agarrala | La pelota quedó cerca y el jugador no la agarra |
