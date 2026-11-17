/**
 * Botón "Entrar en VR" propio, en español, con diagnóstico: si el visor no puede
 * entrar en VR, muestra el motivo en pantalla (para poder reportarlo).
 * Reemplaza al VRButton de three.js.
 */
export function crearBotonVR(renderer, opcionesSesion, mostrarAviso) {
  const boton = document.createElement('button');
  boton.id = 'botonVR';
  boton.disabled = true;
  boton.textContent = 'Buscando visor…';
  document.body.appendChild(boton);

  if (!window.isSecureContext) {
    boton.textContent = 'VR NO DISPONIBLE';
    mostrarAviso('La página no es segura: abrila con https:// (o localhost).');
    return boton;
  }
  if (!('xr' in navigator)) {
    boton.textContent = 'VR NO DISPONIBLE · USÁ EL MOUSE';
    mostrarAviso('Este navegador no tiene WebXR. En el Quest, usá el navegador del visor (Meta Quest Browser).');
    return boton;
  }

  let sesion = null;
  const alTerminar = () => {
    sesion = null;
    boton.textContent = 'ENTRAR EN VR';
  };

  navigator.xr.isSessionSupported('immersive-vr').then((soportado) => {
    if (!soportado) {
      boton.textContent = 'VR NO DISPONIBLE · USÁ EL MOUSE';
      return;
    }
    boton.disabled = false;
    boton.textContent = 'ENTRAR EN VR';
  }).catch((e) => {
    boton.textContent = 'VR NO DISPONIBLE';
    mostrarAviso(`No se pudo consultar el visor: ${e.name}: ${e.message}`);
  });

  boton.addEventListener('click', () => {
    if (sesion) { sesion.end(); return; }
    boton.disabled = true;
    boton.textContent = 'Entrando…';
    // requestSession tiene que llamarse directo desde el clic (gesto del usuario).
    navigator.xr.requestSession('immersive-vr', opcionesSesion)
      .then(async (s) => {
        sesion = s;
        s.addEventListener('end', alTerminar);
        await renderer.xr.setSession(s);
        boton.textContent = 'SALIR DE VR';
        boton.disabled = false;
      })
      .catch((e) => {
        boton.disabled = false;
        boton.textContent = 'ENTRAR EN VR';
        mostrarAviso(`No se pudo entrar en VR: ${e.name}: ${e.message}`);
      });
  });
  return boton;
}
