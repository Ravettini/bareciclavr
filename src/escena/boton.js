import * as THREE from 'three';
import { malla } from './materiales.js';
import { texturaTexto } from './textos.js';

/** Botón 3D que se presiona apuntando con el rayo (o tocándolo) y apretando el gatillo. */
export function crearBoton(texto, posicion, alPresionar) {
  const boton = new THREE.Group();
  boton.name = `Boton_${texto}`;
  const base = malla(new THREE.CylinderGeometry(0.09, 0.1, 0.04, 16), '#f6c700');
  const tapa = malla(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 16), '#1f6f3a');
  tapa.position.y = 0.03;
  const etiqueta = new THREE.Mesh(
    new THREE.PlaneGeometry(0.34, 0.085),
    new THREE.MeshBasicMaterial({ map: texturaTexto(texto, { fondo: '#1f6f3a', color: '#ffffff', ancho: 512, alto: 128, tamano: 72 }) }),
  );
  etiqueta.position.set(0, 0.16, 0);
  boton.add(base, tapa, etiqueta);
  boton.position.set(...posicion);
  boton.userData.alPresionar = alPresionar;
  return boton;
}
