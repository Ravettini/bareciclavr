/**
 * Arranque. Con ?emular=1 instala el emulador WebXR de Meta (IWER) simulando un
 * Quest 2: permite probar el modo VR en una PC sin visor (y lo usan las pruebas automáticas).
 * Sin ese parámetro, registra el service worker para que el juego funcione sin internet.
 */
const params = new URLSearchParams(location.search);

if (params.has('emular')) {
  const { XRDevice, metaQuest2 } = await import('../vendor/iwer/iwer.module.js');
  const dispositivo = new XRDevice(metaQuest2);
  dispositivo.installRuntime({ forceInstall: true }); // reemplaza el WebXR nativo del navegador
  window.__dispositivoXR = dispositivo;
} else if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Sin modo offline:', e));
}

// Cada página elige su experiencia con <body data-experiencia="...">.
if (document.body.dataset.experiencia === 'natalidad') await import('./natalidad/main.js');
else await import('./main.js');
