import { describe, expect, it } from 'vitest';
import {
  agregarOculto,
  armarLlamado,
  armarPlan,
  construir,
  EQUIPO_ESPECIAL,
  equipoDeMovimiento,
  equipoDeTecnico,
  escenaPorFirma,
  leerCantidad,
  marcasDeElemento,
  quitarDeLineaOculta,
  sugerenciasDeElemento,
  sumarEquipoTecnico,
  type Cambio,
} from '../src/motor';

const aplicar = (t: string, cs: Cambio[]) => [...cs].sort((a, b) => b.desde - a.desde).reduce((s, c) => s.slice(0, c.desde) + c.texto + s.slice(c.hasta), t);

describe('equipo especial del guion técnico', () => {
  it('los movimientos que piden equipo se vuelven equipo especial; los demás no', () => {
    expect(['steadicam', 'grúa', 'Dron', 'gimbal'].map(equipoDeMovimiento)).toEqual(['Steadicam', 'Grúa', 'Dron', 'Gimbal']);
    expect(['dolly in', 'dolly out', 'travelling', 'Travelling'].map(equipoDeMovimiento)).toEqual(['Dolly', 'Dolly', 'Dolly', 'Dolly']);
    expect(['fija', 'paneo', 'tilt', 'zoom in', 'zoom out', 'en mano', 'cámara en mano', 'barrido', '', '—'].map(equipoDeMovimiento)).toEqual(Array(10).fill(null));
    expect(equipoDeMovimiento('slider')).toBe('Slider');
  });

  it('solo cuenta equipo conocido: lo demás que se escriba como movimiento no es equipo', () => {
    expect(['handheld', 'Paneo lento', 'N/A', 'Fija.', 'Panorámica', 'Tilt up', 'cable cam'].map(equipoDeMovimiento)).toEqual(Array(7).fill(null));
    // El nombre sale siempre igual, aunque se escriba distinto.
    expect(['**steadicam**', 'STEADICAM', 'Grua', 'drone', 'Jib', 'alta velocidad'].map(equipoDeMovimiento)).toEqual(['Steadicam', 'Steadicam', 'Grúa', 'Dron', 'Grúa', 'Cámara de alta velocidad']);
  });

  it('lee el movimiento de «Descripción técnica» o de una columna «Movimiento», escena por escena', () => {
    const tecnico = [
      '| Esc. | Set | Planos | Duración |',
      '|---:|---|---:|---:|',
      '| 1 | — | — | — |',
      '',
      '| Escena | N. de plano | Plano | Descripción técnica | Duración |',
      '|---:|---:|---|---|---:|',
      '| 1 | 1 | P.G. | 24 mm · steadicam · normal | 0:06 |',
      '| 1 | 2 | P.M. | 50 mm · fija | 0:04 |',
      '| 2 | 1 | P.G. | travelling | 0:05 |',
      '| 2 | 2 | — | — | — |',
      '',
      '| Escena | Plano | Movimiento |',
      '|---|---|---|',
      '| 3 | P.G. | Grúa |',
      '| 3 | P.M. | paneo |',
      '| 3 | P.M. | fija · cámara baja |',
      '| 4 | P.G. | Steadicam, grúa |',
      '| 4 | P.M. | 24 mm · **steadicam** |',
    ].join('\n');
    expect(equipoDeTecnico(tecnico)).toEqual([
      { escena: '1', equipo: 'Steadicam' },
      { escena: '2', equipo: 'Dolly' },
      { escena: '3', equipo: 'Grúa' },
      { escena: '4', equipo: 'Steadicam' },
      { escena: '4', equipo: 'Grúa' },
    ]);
    // El equipo conocido se reconoce aunque no esté en los movimientos del proyecto.
    expect(equipoDeTecnico('| Escena | Descripción técnica |\n|---|---|\n| 5 | 35 mm · slider |')).toEqual([{ escena: '5', equipo: 'Slider' }]);
  });

  it('se suma al breakdown de su escena marcado como del guion técnico, sin duplicar lo que ya está a mano', () => {
    const g = construir('INT. A - DÍA\n\nAna corre.\n\nINT. B - NOCHE\n\nBeto {equipo:vuela|Dron}.\n');
    sumarEquipoTecnico(g, [
      { escena: '1', equipo: 'Steadicam' },
      { escena: '1', equipo: 'Steadicam' },
      { escena: '2', equipo: 'dron' },
      { escena: '9', equipo: 'Grúa' },
    ]);
    expect(g.breakdown[0].elementos.equipo).toEqual([{ nombre: 'Steadicam', cantidad: 1, origen: 'tecnico' }]);
    expect(g.breakdown[1].elementos.equipo).toEqual([{ nombre: 'Dron', cantidad: 1 }]);
  });

  it('el número de escena se compara sin mayúsculas ni espacios', () => {
    const g = construir('INT. A - DÍA #5A#\n\nAna corre.\n');
    sumarEquipoTecnico(g, [{ escena: ' 5a ', equipo: 'Gimbal' }]);
    expect(g.breakdown[0].elementos.equipo).toEqual([{ nombre: 'Gimbal', cantidad: 1, origen: 'tecnico' }]);
  });
});

describe('agregar a mano desde el breakdown', () => {
  it('la cantidad se escribe al final: «Extras ×6» o «Extras x 6», pero «Camioneta 4x4» es un nombre', () => {
    expect(leerCantidad('Extras ×6')).toEqual({ nombre: 'Extras', cantidad: 6 });
    expect(leerCantidad('Extras×6')).toEqual({ nombre: 'Extras', cantidad: 6 });
    expect(leerCantidad('Extras x 6')).toEqual({ nombre: 'Extras', cantidad: 6 });
    expect(leerCantidad('Camioneta 4x4')).toEqual({ nombre: 'Camioneta 4x4', cantidad: 1 });
    expect(leerCantidad('  Rig   de auto ')).toEqual({ nombre: 'Rig de auto', cantidad: 1 });
    expect(leerCantidad('Paraguas ×0')).toEqual({ nombre: 'Paraguas', cantidad: 1 });
    // Sin los caracteres que romperían la marca.
    expect(leerCantidad('Llave {rara}|%%x')).toEqual({ nombre: 'Llave rara x', cantidad: 1 });
    expect(leerCantidad(' {} ')).toEqual({ nombre: '', cantidad: 1 });
  });

  const F = 'INT. A - DÍA\n\nAna con {ut:taza}.\n\nINT. B - NOCHE\n%%escena: id=b%%\n\nBeto.\n';

  it('escribe una marca oculta bajo el encabezado (o sus metadatos) y cuenta en el breakdown sin mover los octavos', () => {
    const t = aplicar(F, agregarOculto(F, 1, 'equipo', 'Steadicam', 1));
    expect(t).toBe('INT. A - DÍA\n\nAna con {ut:taza}.\n\nINT. B - NOCHE\n%%escena: id=b%%\n%%{equipo:|Steadicam}%%\n\nBeto.\n');
    expect(construir(t).breakdown[1].elementos.equipo).toEqual([{ nombre: 'Steadicam', cantidad: 1 }]);
    expect(construir(t).octavos.porEscena).toEqual(construir(F).octavos.porEscena);
    const t2 = aplicar(F, agregarOculto(F, 0, 'extra', 'Extras', 6));
    expect(t2).toBe('INT. A - DÍA\n%%{extra:|Extras|6}%%\n\nAna con {ut:taza}.\n\nINT. B - NOCHE\n%%escena: id=b%%\n\nBeto.\n');
    expect(construir(t2).breakdown[0].elementos.extra).toEqual([{ nombre: 'Extras', cantidad: 6 }]);
  });

  it('no repite lo que la escena ya tiene, ni escribe un nombre vacío o una escena que no existe', () => {
    expect(agregarOculto(F, 0, 'ut', 'Taza', 1)).toEqual([]);
    expect(agregarOculto(F, 0, 'ut', 'Tazá', 1)).toEqual([]);
    expect(agregarOculto(F, 0, 'ut', 'TAZA', 1)).toEqual([]);
    expect(agregarOculto(F, 0, 'ut', '  ', 1)).toEqual([]);
    expect(agregarOculto(F, 5, 'ut', 'Llaves', 1)).toEqual([]);
    const t = aplicar(F, agregarOculto(F, 0, 'ut', 'Llave {rara}', 1));
    expect(construir(t).breakdown[0].elementos.ut).toEqual([
      { nombre: 'Taza', cantidad: 1 },
      { nombre: 'Llave rara', cantidad: 1 },
    ]);
  });

  it('no agrega reparto a una escena que fija su reparto con «reparto=»', () => {
    const f = 'INT. A - DÍA\n%%escena: reparto=Ana%%\n\nAna llega.\n';
    expect(agregarOculto(f, 0, 'rep', 'Carla', 1)).toEqual([]);
    expect(agregarOculto(f, 0, 'ut', 'Taza', 1)).not.toEqual([]);
  });

  it('cuenta las marcas de un elemento en la escena: las ocultas y las que están en la acción', () => {
    const f = 'INT. A - DÍA\n%%{ut:|Pistola}%%\n\nAna saca la {ut:pistola|Pistola}. La {ut:pistola|Pistola} cae.\n\nINT. B - DÍA\n\nLa {ut:pistola|Pistola}.\n';
    expect(marcasDeElemento(f, 0, 'ut', 'pistola')).toEqual({ ocultas: 1, visibles: 2 });
    expect(marcasDeElemento(f, 1, 'ut', 'Pistola')).toEqual({ ocultas: 0, visibles: 1 });
    expect(marcasDeElemento(f, 1, 'ut', 'Taza')).toEqual({ ocultas: 0, visibles: 0 });
  });

  it('quitar una etiqueta de una línea de marcas ocultas deja las demás; si era la única, la línea se va', () => {
    expect(quitarDeLineaOculta('%%{ut:|Llaves} {equipo:|Dron}%%', 0)).toBe('%%{equipo:|Dron}%%');
    expect(quitarDeLineaOculta('%%{ut:|Llaves} {equipo:|Dron}%%', 1)).toBe('%%{ut:|Llaves}%%');
    expect(quitarDeLineaOculta('%%{equipo:|Dron}%%', 0)).toBeNull();
    expect(quitarDeLineaOculta('%%{equipo:|Dron}%%', 3)).toBe('%%{equipo:|Dron}%%');
  });

  it('encuentra la escena por número y encabezado aunque el guion haya cambiado; si no es seguro, ninguna', () => {
    expect(escenaPorFirma(F, { numero: '2', encabezado: 'INT. B - NOCHE' })).toBe(1);
    // Se agregó una escena antes: B ahora es la 3, pero su encabezado es único.
    expect(escenaPorFirma('INT. Z - DÍA\n\nZ.\n\n' + F, { numero: '2', encabezado: 'INT. B - NOCHE' })).toBe(2);
    // Dos escenas con el mismo encabezado y ninguna con ese número: no se adivina.
    const dobles = 'INT. A - DÍA\n\nUno.\n\nINT. A - DÍA\n\nDos.\n';
    expect(escenaPorFirma(dobles, { numero: '2', encabezado: 'INT. A - DÍA' })).toBe(1);
    expect(escenaPorFirma(dobles, { numero: '7', encabezado: 'INT. A - DÍA' })).toBeNull();
    expect(escenaPorFirma(F, { numero: '2', encabezado: 'EXT. OTRA - DÍA' })).toBeNull();
  });

  it('sugiere lo que ya se usó en otras escenas (lo más usado primero), sin lo que la escena ya tiene', () => {
    const g = construir('INT. A - DÍA\n\n{ut:taza} y {ut:llaves|Llaves}.\n\nINT. B - DÍA\n\n{ut:taza|Taza}.\n\nINT. C - DÍA\n\nNada.\n');
    expect(sugerenciasDeElemento(g, 'ut', 2)).toEqual(['Taza', 'Llaves']);
    expect(sugerenciasDeElemento(g, 'ut', 0)).toEqual([]);
  });

  it('en equipo especial suma la lista de fábrica; en reparto, los personajes que no están en la escena', () => {
    const g = construir('INT. A - DÍA\n\nAna {equipo:corre|Steadicam}.\n\nANA\nHola.\n\nINT. B - DÍA\n\nBETO\nAdiós.\n');
    const eq = sugerenciasDeElemento(g, 'equipo', 1);
    expect(eq[0]).toBe('Steadicam');
    expect(eq).toEqual(['Steadicam', ...EQUIPO_ESPECIAL.filter((x) => x !== 'Steadicam')]);
    expect(sugerenciasDeElemento(g, 'equipo', 0)).not.toContain('Steadicam');
    expect(sugerenciasDeElemento(g, 'rep', 1)).toEqual(['Ana']);
  });
});

describe('equipo especial en la hoja de llamado', () => {
  it('el equipo de las escenas del día, en el orden del día, con sus escenas', () => {
    const g = construir('INT. A - DÍA\n\nAna {equipo:corre|Steadicam}.\n\nINT. B - NOCHE\n\nBeto en la {equipo:grua|Grua}.\n');
    sumarEquipoTecnico(g, [
      { escena: '2', equipo: 'Dron' },
      { escena: '1', equipo: 'Dron' },
      { escena: '1', equipo: 'Grúa' },
    ]);
    const plan = armarPlan(g, { dia: 1, escenas: ['2', '1'] }, { primeraToma: 480 }, [], { minutosPorPlano: 30, minutosPorOctavo: 10, minutosComida: 60, comidaTras: 360 });
    expect(armarLlamado(g, plan).equipo).toEqual([
      { equipo: 'Grua', escenas: ['2', '1'] },
      { equipo: 'Dron', escenas: ['2', '1'] },
      { equipo: 'Steadicam', escenas: ['1'] },
    ]);
  });
});
