const elSaldo = document.getElementById('saldo');
const elEntradaApuesta = document.getElementById('entrada-apuesta');
const btnApostar = document.getElementById('boton-apostar');
const btnPedir = document.getElementById('boton-pedir');
const btnPlantarse = document.getElementById('boton-plantarse');
const btnNuevaMano = document.getElementById('boton-nueva-mano');
const elMensaje = document.getElementById('mensaje');
const contCartasJugador = document.getElementById('cartas-jugador');
const contCartasBot = document.getElementById('cartas-bot');
const elValorJugador = document.getElementById('valor-jugador');
const elValorBot = document.getElementById('valor-bot');
const capaInicio = document.getElementById('pantalla-inicio');
const btnComenzar = document.getElementById('boton-comenzar');

let estado = 'inicial'; 

function setMensaje(texto) {
  elMensaje.textContent = texto || '';
  elMensaje.classList.remove('mostrar');
  void elMensaje.offsetWidth;
  if (texto) elMensaje.classList.add('mostrar');
}

function setSaldo(valor) {
  elSaldo.textContent = (valor ?? 0);
}

function limpiarCartas() {
  contCartasJugador.innerHTML = '';
  contCartasBot.innerHTML = '';
  elValorJugador.textContent = '-';
  elValorBot.textContent = '-';
}

function crearNodoCarta(carta, oculta = false) {
  const div = document.createElement('div');
  div.className = 'carta';

  if (oculta) {
    div.classList.add('dorso');
    return div;
  }

  const clasePalo = carta.color === 'rojo' ? 'palo-rojo' : 'palo-negro';
  div.classList.add(clasePalo);

  const esquinaSup = document.createElement('div');
  esquinaSup.className = 'esquina esquina-superior';
  esquinaSup.innerHTML = `${carta.rango}<br>${carta.simbolo_palo}`;

  const esquinaInf = document.createElement('div');
  esquinaInf.className = 'esquina esquina-inferior';
  esquinaInf.innerHTML = `${carta.rango}<br>${carta.simbolo_palo}`;

  const paloCentral = document.createElement('div');
  paloCentral.className = 'palo-central';
  paloCentral.textContent = carta.simbolo_palo;

  div.appendChild(esquinaSup);
  div.appendChild(paloCentral);
  div.appendChild(esquinaInf);

  return div;
}

function renderCartasJugador(cartas) {
  contCartasJugador.innerHTML = '';
  (cartas || []).forEach(c => contCartasJugador.appendChild(crearNodoCarta(c)));
}

function renderCartasBot(cartas, ocultarSegunda = false) {
  contCartasBot.innerHTML = '';
  if (!cartas || cartas.length === 0) return;

  if (ocultarSegunda && cartas.length >= 2) {
    contCartasBot.appendChild(crearNodoCarta(cartas[0], false));
    contCartasBot.appendChild(crearNodoCarta(null, true));
    for (let i = 2; i < cartas.length; i++) {
      contCartasBot.appendChild(crearNodoCarta(cartas[i], false));
    }
  } else {
    cartas.forEach(c => contCartasBot.appendChild(crearNodoCarta(c)));
  }
}

function actualizarBotonera() {
  btnApostar.disabled = !(estado === 'listo');
  btnPedir.disabled = !(estado === 'turno_jugador');
  btnPlantarse.disabled = !(estado === 'turno_jugador');
  if (btnNuevaMano) btnNuevaMano.disabled = !(estado === 'fin');
}

const API_BASE = (window.API_BASE || '').replace(/\/$/, '');
function apiUrl(p) { return (API_BASE ? API_BASE : '') + p; }

async function api_iniciar() {
  try {
    const resp = await fetch(apiUrl('/api/iniciar'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const data = await resp.json();
    if (resp.ok) {
      setSaldo(data.saldo);
      estado = data.estado || 'listo';
      setMensaje(data.mensaje);
      limpiarCartas();
      elValorBot.textContent = '-';
      elValorJugador.textContent = '-';
      actualizarBotonera();
      if (capaInicio) capaInicio.classList.add('oculto');
    } else {
      setMensaje(data.error || 'Error al iniciar.');
    }
  } catch (e) {
    setMensaje('Error.');
  }
}

async function api_apostar() {
  try {
    const apuesta = parseInt(elEntradaApuesta.value || '0', 10);
    const resp = await fetch(apiUrl('/api/apostar'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apuesta })
    });
    const data = await resp.json();
    if (resp.ok) {
      setSaldo(data.saldo);
      renderCartasJugador(data.cartas_jugador);
      elValorJugador.textContent = data.valor_jugador ?? '-';

      if (data.cartas_bot) {
        renderCartasBot(data.cartas_bot, false);
        elValorBot.textContent = data.valor_bot ?? '-';
      } else if (data.carta_visible_bot) {
        renderCartasBot([data.carta_visible_bot], true);
        elValorBot.textContent = '-';
      }

      estado = data.estado || 'turno_jugador';
      setMensaje(data.mensaje || '');
      actualizarBotonera();

      if (estado === 'fin' || estado === 'reinicio') {
        if (btnNuevaMano) btnNuevaMano.disabled = estado !== 'fin';
        if (estado === 'fin') {
          try { mostrarResultadoGrande(data?.resultado); } catch (e) {}
          const msg = (data.mensaje || '') + (data.resultado ? ` Resultado: ${data.resultado.toUpperCase()}` : '');
          setMensaje(`${msg} | Nueva mano en 5 segundos...`);
          setTimeout(api_nueva_mano, 5000);
        }
        if (estado === 'reinicio') {
          setMensaje('Saldo agotado. Reiniciando partida...');
          setTimeout(api_reiniciar, 5000);
        }
      }
    } else {
      setMensaje(data.error || 'No se pudo apostar.');
    }
  } catch (e) {
    setMensaje('Error.');
  }
}

async function api_pedir() {
  try {
    const resp = await fetch(apiUrl('/api/pedir'), { method: 'POST' });
    const data = await resp.json();
    if (resp.ok) {
      setSaldo(data.saldo ?? elSaldo.textContent);
      renderCartasJugador(data.cartas_jugador);
      elValorJugador.textContent = data.valor_jugador ?? '-';

      if (data.cartas_bot) {
        renderCartasBot(data.cartas_bot, false);
        elValorBot.textContent = data.valor_bot ?? '-';
      }

      estado = data.estado || 'turno_jugador';
      setMensaje(data.mensaje || '');
      actualizarBotonera();

      if (estado === 'fin' || estado === 'reinicio') {
        btnNuevaMano.disabled = estado !== 'fin';
        if (estado === 'fin') {
          try { mostrarResultadoGrande(data?.resultado); } catch (e) {}
          const msg = (data.mensaje || '') + (data.resultado ? ` Resultado: ${data.resultado.toUpperCase()}` : '');
          setMensaje(`${msg} | Nueva mano en 5 segundos...`);
          setTimeout(api_nueva_mano, 5000);
        }
        if (estado === 'reinicio') {
          setMensaje('Saldo agotado. Reiniciando partida...');
          setTimeout(api_reiniciar, 5000);
        }
      }
    } else {
      setMensaje(data.error || 'No se pudo pedir carta.');
    }
  } catch (e) {
    setMensaje('Error.');
  }
}

async function api_plantarse() {
  try {
    const resp = await fetch(apiUrl('/api/plantarse'), { method: 'POST' });
    const data = await resp.json();
    if (resp.ok) {
      setSaldo(data.saldo ?? elSaldo.textContent);
      renderCartasJugador(data.cartas_jugador);
      renderCartasBot(data.cartas_bot, false);
      elValorJugador.textContent = data.valor_jugador ?? '-';
      elValorBot.textContent = data.valor_bot ?? '-';

      estado = data.estado || 'fin';
      setMensaje((data.mensaje || '') + (data.resultado ? ` Resultado: ${data.resultado.toUpperCase()}` : ''));
      actualizarBotonera();

      if (estado === 'fin') {
        try { mostrarResultadoGrande(data?.resultado); } catch (e) {}
        if (btnNuevaMano) btnNuevaMano.disabled = false;
        setMensaje(((data.mensaje || '') + (data.resultado ? ` Resultado: ${data.resultado.toUpperCase()}` : '') ) + ' | Nueva mano en 5 segundos...');
        setTimeout(api_nueva_mano, 5000);
      }
      if (estado === 'reinicio') {
        setMensaje('Saldo agotado. Reiniciando partida...');
        setTimeout(api_reiniciar, 5000);
      }
    } else {
      setMensaje(data.error || 'No te puedes plantar ahora.');
    }
  } catch (e) {
    setMensaje('Error.');
  }
}

async function api_nueva_mano() {
  try {
    const resp = await fetch(apiUrl('/api/nueva_mano'), { method: 'POST' });
    const data = await resp.json();
    if (resp.ok) {
      setSaldo(data.saldo);
      estado = data.estado || 'listo';
      setMensaje(data.mensaje || '');
      limpiarCartas();
      actualizarBotonera();

      if (estado === 'reinicio') {
        setMensaje('Saldo agotado. Reiniciando...');
        setTimeout(api_reiniciar, 1000);
      }
    } else {
      setMensaje(data.error || 'No se pudo iniciar nueva mano.');
    }
  } catch (e) {
    setMensaje('Error.');
  }
}

async function api_reiniciar() {
  try {
    const resp = await fetch(apiUrl('/api/reiniciar'), { method: 'POST' });
    const data = await resp.json();
    if (resp.ok) {
      setSaldo(data.saldo);
      estado = data.estado || 'listo';
      setMensaje(data.mensaje || '');
      limpiarCartas();
      actualizarBotonera();
    } else {
      setMensaje(data.error || 'No se pudo reiniciar.');
    }
  } catch (e) {
    setMensaje('Error.');
  }
}

btnComenzar.addEventListener('click', api_iniciar);
btnApostar.addEventListener('click', api_apostar);
btnPedir.addEventListener('click', api_pedir);
btnPlantarse.addEventListener('click', api_plantarse);
btnNuevaMano.addEventListener('click', api_nueva_mano);

estado = 'inicial';
actualizarBotonera();
setMensaje('Haz tu apuesta cuando inicies el juego.');

function mostrarResultadoGrande(resultado) {
  const capa = document.getElementById('overlay-resultado');
  const texto = document.getElementById('texto-resultado');
  if (!capa || !texto) return;
  texto.classList.remove('mostrar','ganaste','perdiste');
  capa.classList.remove('visible');
  if (resultado === 'gano') {
    texto.textContent = '¡Ganaste!';
    texto.classList.add('ganaste');
  } else if (resultado === 'perdio') {
    texto.textContent = '¡Perdiste!';
    texto.classList.add('perdiste');
  } else {
    texto.textContent = '';
  }
  void texto.offsetWidth;
  if (texto.textContent) {
    capa.classList.add('visible');
    texto.classList.add('mostrar');
    setTimeout(() => {
      texto.classList.remove('mostrar');
      capa.classList.remove('visible');
    }, 1800);
  }
}