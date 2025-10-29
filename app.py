from flask import Flask, jsonify, request, session, send_from_directory
from flask_cors import CORS
import random
import os

app = Flask(__name__, static_folder='pagina', static_url_path='/')
CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)
app.secret_key = 'clavesecreta_liceo11'

SALDO_INICIAL_DEFECTO = 500
APUESTA_MINIMA = 10
PLANTAR_17_SUAVE = True

PALOS = [
    ('corazones', '♥', 'rojo'),
    ('diamantes', '♦', 'rojo'),
    ('treboles', '♣', 'negro'),
    ('picas', '♠', 'negro')
]
RANGOS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

def crear_carta(rango, palo_nombre, simbolo, color):
    if rango == 'A':
        valor = 11
    elif rango in ['J', 'Q', 'K']:
        valor = 10
    else:
        valor = int(rango)
    return {
        'rango': rango,
        'palo': palo_nombre,
        'simbolo_palo': simbolo,
        'color': color,
        'valor': valor
    }

def crear_mazo():
    mazo = []
    for palo_nombre, simbolo, color in PALOS:
        for rango in RANGOS:
            mazo.append(crear_carta(rango, palo_nombre, simbolo, color))
    return mazo

def barajar_mazo(mazo):
    random.shuffle(mazo)

def repartir_carta(mazo):
    return mazo.pop()

def valor_mano(mano):
    total = sum(c['valor'] for c in mano)
    ases = sum(1 for c in mano if c['rango'] == 'A')
    while total > 21 and ases > 0:
        total -= 10
        ases -= 1
    return total

def estado_inicial(saldo_inicial=SALDO_INICIAL_DEFECTO):
    session['saldo'] = saldo_inicial
    session['apuesta'] = 0
    session['mazo'] = []
    session['mano_jugador'] = []
    session['mano_bot'] = []
    session['estado'] = 'listo'

def serializar_carta(c):
    return {
        'rango': c['rango'],
        'palo': c['palo'],
        'simbolo_palo': c['simbolo_palo'],
        'color': c['color']
    }

def asegurar_sesion():
    if 'saldo' not in session:
        estado_inicial()

@app.route('/')
def raiz():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/api/iniciar', methods=['POST'])
def api_iniciar():
    datos = request.get_json(silent=True) or {}
    saldo_inicial = datos.get('saldo_inicial', SALDO_INICIAL_DEFECTO)
    estado_inicial(saldo_inicial)
    return jsonify({
        'saldo': session['saldo'],
        'estado': session['estado'],
        'mensaje': 'Juego iniciado, ¡Haz tu apuesta!'
    })

@app.route('/api/apostar', methods=['POST'])
def api_apostar():
    asegurar_sesion()
    if session.get('estado') not in ['listo', 'fin']:
        return jsonify({'error': 'No puedes apostar ahora.'}), 400

    datos = request.get_json(silent=True) or {}
    apuesta = int(datos.get('apuesta', 0))

    if apuesta < APUESTA_MINIMA:
        return jsonify({'error': f'Apuesta mínima: ${APUESTA_MINIMA}'}), 400
    if apuesta > session['saldo']:
        return jsonify({'error': 'No tienes el dinero suficiente.'}), 400

    mazo = crear_mazo()
    barajar_mazo(mazo)
    mano_jugador = [repartir_carta(mazo), repartir_carta(mazo)]
    mano_bot = [repartir_carta(mazo), repartir_carta(mazo)]

    session['apuesta'] = apuesta
    session['mazo'] = mazo
    session['mano_jugador'] = mano_jugador
    session['mano_bot'] = mano_bot
    session['estado'] = 'turno_jugador'

    valor_jug = valor_mano(mano_jugador)
    valor_bot = valor_mano(mano_bot)

    if valor_jug == 21 or valor_bot == 21:
        resultado = 'empate'
        if valor_jug == 21 and valor_bot != 21:
            resultado = 'gano'
            session['saldo'] += apuesta
        elif valor_bot == 21 and valor_jug != 21:
            resultado = 'perdio'
            session['saldo'] -= apuesta
        session['estado'] = 'fin'
        if session['saldo'] <= 0:
            session['estado'] = 'reinicio'
        return jsonify({
            'saldo': session['saldo'],
            'apuesta': session['apuesta'],
            'cartas_jugador': [serializar_carta(c) for c in mano_jugador],
            'cartas_bot': [serializar_carta(c) for c in mano_bot],
            'valor_jugador': valor_jug,
            'valor_bot': valor_bot,
            'resultado': resultado,
            'estado': session['estado'],
        })

    carta_visible_bot = serializar_carta(mano_bot[0])
    return jsonify({
        'saldo': session['saldo'],
        'apuesta': session['apuesta'],
        'cartas_jugador': [serializar_carta(c) for c in mano_jugador],
        'carta_visible_bot': carta_visible_bot,
        'valor_jugador': valor_jug,
        'estado': session['estado'],
        'mensaje': 'Tú turno, puedes pedir o plantarte.'
    })

@app.route('/api/pedir', methods=['POST'])
def api_pedir():
    asegurar_sesion()
    if session.get('estado') != 'turno_jugador':
        return jsonify({'error': 'No es el turno del jugador.'}), 400

    mazo = session['mazo']
    mano_jugador = session['mano_jugador']
    mano_bot = session['mano_bot']

    mano_jugador.append(repartir_carta(mazo))
    session['mazo'] = mazo
    session['mano_jugador'] = mano_jugador

    valor_jug = valor_mano(mano_jugador)

    if valor_jug > 21:
        session['saldo'] -= session['apuesta']
        session['estado'] = 'fin'
        if session['saldo'] <= 0:
            session['estado'] = 'reinicio'
        return jsonify({
            'saldo': session['saldo'],
            'cartas_jugador': [serializar_carta(c) for c in mano_jugador],
            'cartas_bot': [serializar_carta(c) for c in mano_bot],
            'valor_jugador': valor_jug,
            'valor_bot': valor_mano(mano_bot),
            'resultado': 'perdio',
            'estado': session['estado'],
            'mensaje': 'Te pasaste de 21.'
        })

    return jsonify({
        'saldo': session['saldo'],
        'cartas_jugador': [serializar_carta(c) for c in mano_jugador],
        'valor_jugador': valor_jug,
        'estado': session['estado'],
    })

@app.route('/api/plantarse', methods=['POST'])
def api_plantarse():
    asegurar_sesion()
    if session.get('estado') != 'turno_jugador':
        return jsonify({'error': 'No puedes plantarte ahora.'}), 400

    mazo = session['mazo']
    mano_jugador = session['mano_jugador']
    mano_bot = session['mano_bot']

    while True:
        val_bot = valor_mano(mano_bot)
        es_17_suave = (val_bot == 17 and any(c['rango'] == 'A' for c in mano_bot))
        if val_bot < 17:
            mano_bot.append(repartir_carta(mazo))
        elif val_bot == 17 and es_17_suave and not PLANTAR_17_SUAVE:
            mano_bot.append(repartir_carta(mazo))
        else:
            break

    val_jug = valor_mano(mano_jugador)
    val_bot = valor_mano(mano_bot)

    resultado = 'empate'
    if val_jug > 21:
        resultado = 'perdio'
    elif val_bot > 21:
        resultado = 'gano'
    elif val_jug > val_bot:
        resultado = 'gano'
    elif val_jug < val_bot:
        resultado = 'perdio'

    if resultado == 'gano':
        session['saldo'] += session['apuesta']
    elif resultado == 'perdio':
        session['saldo'] -= session['apuesta']

    session['estado'] = 'fin'
    if session['saldo'] <= 0:
        session['estado'] = 'reinicio'

    session['mazo'] = mazo
    session['mano_bot'] = mano_bot

    return jsonify({
        'saldo': session['saldo'],
        'cartas_jugador': [serializar_carta(c) for c in mano_jugador],
        'cartas_bot': [serializar_carta(c) for c in mano_bot],
        'valor_jugador': val_jug,
        'valor_bot': val_bot,
        'resultado': resultado,
        'estado': session['estado'],
    })

@app.route('/api/nueva_mano', methods=['POST'])
def api_nueva_mano():
    asegurar_sesion()
    if session.get('saldo', 0) <= 0:
        session['estado'] = 'reinicio'
        return jsonify({
            'saldo': session['saldo'],
            'estado': session['estado'],
            'mensaje': 'Saldo agotado, Reiniciando juego.'
        })
    session['apuesta'] = 0
    session['mazo'] = []
    session['mano_jugador'] = []
    session['mano_bot'] = []
    session['estado'] = 'listo'
    return jsonify({
        'saldo': session['saldo'],
        'estado': session['estado'],
        'mensaje': 'Nueva mano, Haz tu apuesta.'
    })

@app.route('/api/reiniciar', methods=['POST'])
def api_reiniciar():
    estado_inicial(SALDO_INICIAL_DEFECTO)
    return jsonify({
        'saldo': session['saldo'],
        'estado': session['estado'],
        'mensaje': 'Juego reiniciado...'
    })

if __name__ == '__main__':
    puerto = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=puerto, debug=False)
