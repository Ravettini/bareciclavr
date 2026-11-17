import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Partida } from '../../src/logica/partida.js';
import { validarReglas } from '../../src/logica/reglas.js';

const reglas = JSON.parse(readFileSync(new URL('../../datos/reglas.json', import.meta.url)));

test('las reglas del juego son válidas', () => {
  assert.deepEqual(validarReglas(reglas), []);
});

test('detecta reglas inválidas', () => {
  const malas = structuredClone(reglas);
  malas.residuos[0].categoria = 'inexistente';
  delete malas.residuos[1].error;
  const problemas = validarReglas(malas);
  assert.equal(problemas.length, 2);
});

test('clasificación correcta suma el puntaje de primer intento', () => {
  const p = new Partida(reglas);
  const r = p.depositar('botella', 'verde');
  assert.equal(r.correcto, true);
  assert.equal(r.puntos, 10);
  assert.equal(p.puntaje, 10);
  assert.match(r.mensaje, /limpia|seca|enjuag/i);
});

test('un error no resta puntos y permite reintentar con menos puntaje', () => {
  const p = new Partida(reglas);
  const e = p.depositar('servilleta', 'verde');
  assert.equal(e.correcto, false);
  assert.equal(p.puntaje, 0);
  assert.equal(p.restantes, 3);
  const ok = p.depositar('servilleta', 'negro');
  assert.equal(ok.correcto, true);
  assert.equal(ok.puntos, 5);
});

test('la partida termina al clasificar todo y se puede reiniciar', () => {
  const p = new Partida(reglas);
  p.depositar('botella', 'verde');
  p.depositar('lata', 'verde');
  const fin = p.depositar('servilleta', 'negro');
  assert.equal(fin.terminada, true);
  assert.equal(p.puntaje, p.puntajeMaximo);
  assert.throws(() => p.depositar('lata', 'verde'));
  p.reiniciar();
  assert.equal(p.puntaje, 0);
  assert.equal(p.terminada, false);
});
