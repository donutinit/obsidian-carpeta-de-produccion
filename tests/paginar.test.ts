import { describe, expect, it } from 'vitest';
import { resolverConfig, type Config } from '../src/motor/config';
import { textoPlano } from '../src/motor/enlinea';
import { analizar } from '../src/motor/fountain';
import { maquetar } from '../src/motor/maquetar';
import { paginar } from '../src/motor/paginar';
import type { Linea, Pagina } from '../src/motor/tipos';

function paginas(fuente: string, parcial: Partial<Config> = {}): Pagina[] {
  const cfg = resolverConfig({ renglonesPorPagina: 12, ...parcial });
  return paginar(maquetar(analizar(fuente), cfg), cfg);
}
const txt = (l: Linea) => textoPlano(l.segs);
const vista = (pg: Pagina) => pg.lineas.map((l) => (l.tipo === 'blanco' ? '' : `${l.tipo}:${txt(l)}`));
const accion = (n: number, prefijo = 'Línea') => Array.from({ length: n }, (_, k) => `${prefijo} ${k + 1}.`).join('\n');
const DIALOGO_LARGO =
  'Uno dos tres. Cuatro cinco seis siete. Ocho nueve diez. Once doce trece catorce. Quince dieciséis. Diecisiete dieciocho diecinueve. Veinte veintiuno. Veintidós veintitrés veinticuatro.';

describe('paginar', () => {
  it('sin blanco arriba', () => {
    const fuente = Array.from({ length: 10 }, (_, k) => `INT. CUARTO ${k + 1} - DÍA\n\n${accion(3)}`).join('\n\n');
    const pgs = paginas(fuente);
    expect(pgs.length).toBeGreaterThan(3);
    for (const pg of pgs) {
      expect(pg.lineas[0].tipo).not.toBe('blanco');
      expect(pg.lineas.length).toBeLessThanOrEqual(12);
    }
  });

  it('encabezado no cierra página (renglón 11)', () => {
    const pgs = paginas(`INT. A - DÍA\n\n${accion(7)}\n\nINT. B - DÍA\n\n${accion(3, 'Otra')}`);
    expect(vista(pgs[0]).at(-1)).toBe('accion:Línea 7.');
    expect(vista(pgs[1]).slice(0, 3)).toEqual(['encabezado:INT. B - DÍA', '', 'accion:Otra 1.']);
  });

  it('encabezado no cierra página (renglón 12)', () => {
    const pgs = paginas(`INT. A - DÍA\n\n${accion(8)}\n\nINT. B - DÍA\n\n${accion(3, 'Otra')}`);
    expect(vista(pgs[0]).at(-1)).toBe('accion:Línea 8.');
    expect(vista(pgs[1])[0]).toBe('encabezado:INT. B - DÍA');
  });

  it('personaje no cierra página', () => {
    const pgs = paginas(`INT. A - DÍA\n\n${accion(8)}\n\nFRANCISCO\nHola.\n`);
    expect(vista(pgs[0]).at(-1)).toBe('accion:Línea 8.');
    expect(vista(pgs[1])).toEqual(['personaje:FRANCISCO', 'dialogo:Hola.']);
  });

  it('diálogo se parte en fin de frase', () => {
    const pgs = paginas(`INT. A - DÍA\n\n${accion(3)}\n\nFRANCISCO\n${DIALOGO_LARGO}\n`);
    expect(pgs.length).toBe(2);
    const arriba = pgs[0].lineas;
    const mas = arriba.at(-1)!;
    expect([mas.tipo, txt(mas), mas.columna]).toEqual(['mas', '(MORE)', 20]);
    expect(arriba.filter((l) => l.tipo === 'dialogo').length).toBeGreaterThanOrEqual(2);
    expect(txt(arriba.at(-2)!)).toMatch(/[.!?:;…]$/);
    const abajo = pgs[1].lineas;
    expect([abajo[0].tipo, txt(abajo[0]), abajo[0].columna]).toEqual(['continua', "FRANCISCO (CONT'D)", 20]);
    expect(abajo.filter((l) => l.tipo === 'dialogo').length).toBeGreaterThanOrEqual(2);
    const todo = pgs.flatMap((p) => p.lineas).filter((l) => l.tipo === 'dialogo').map(txt).join(' ');
    expect(todo).toBe(DIALOGO_LARGO);
    for (const l of [...arriba, ...abajo]) expect(txt(l).length).toBeLessThanOrEqual(40);
  });

  it('conserva la extensión', () => {
    const fuente = (p: string) => `INT. A - DÍA\n\n${accion(3)}\n\n${p}\n${DIALOGO_LARGO}\n`;
    expect(vista(paginas(fuente('ANA (V.O.)'))[1])[0]).toBe("continua:ANA (V.O.) (CONT'D)");
    expect(vista(paginas(fuente('ANA (V.O.)'), { conservarExtension: false })[1])[0]).toBe("continua:ANA (CONT'D)");
    expect(vista(paginas(fuente("FRANCISCO (CONT'D)"))[1])[0]).toBe("continua:FRANCISCO (CONT'D)");
  });

  it('textos configurables', () => {
    const pgs = paginas(`INT. A - DÍA\n\n${accion(3)}\n\nFRANCISCO\n${DIALOGO_LARGO}\n`, { textoMas: '(MÁS)', textoContinua: '(CONT.)' });
    expect(vista(pgs[0]).at(-1)).toBe('mas:(MÁS)');
    expect(vista(pgs[1])[0]).toBe('continua:FRANCISCO (CONT.)');
  });

  it('fin de frase pegado a comilla no sirve', () => {
    const parrafo = (cita: string) => ['sin punto uno', 'sin punto dos', `dijo ${cita} y siguió`, 'sin punto cuatro', 'sin punto cinco'].join('\n');
    const conComilla = paginas(`INT. A - DÍA\n\n${accion(5)}\n\n${parrafo('«ya.»')}`);
    expect(vista(conComilla[0]).at(-1)).toBe('accion:Línea 5.');
    expect(vista(conComilla[1])).toEqual(['accion:sin punto uno', 'accion:sin punto dos', 'accion:dijo «ya.» y siguió', 'accion:sin punto cuatro', 'accion:sin punto cinco']);
    const sinComilla = paginas(`INT. A - DÍA\n\n${accion(5)}\n\n${parrafo('ya.')}`);
    expect(vista(sinComilla[0]).at(-1)).toBe('accion:dijo ya.');
    expect(vista(sinComilla[1])[0]).toBe('accion:y siguió');
  });

  it('sin fin de frase, se mueve completo con su cadena', () => {
    const sinPunto = Array.from({ length: 8 }, (_, k) => `palabra ${k + 1}`).join('\n');
    const pgs = paginas(`INT. A - DÍA\n\n${accion(3)}\n\nINT. B - DÍA\n\nFRANCISCO\n${sinPunto}\n`);
    expect(vista(pgs[0]).at(-1)).toBe('accion:Línea 3.');
    expect(vista(pgs[1]).slice(0, 4)).toEqual(['encabezado:INT. B - DÍA', '', 'personaje:FRANCISCO', 'dialogo:palabra 1']);
  });

  it('acción se parte en fin de frase, mínimo 2 y 2', () => {
    const partida = paginas(`INT. A - DÍA\n\n${accion(6)}\n\n${accion(6, 'Otra')}`);
    expect(vista(partida[0]).at(-1)).toBe('accion:Otra 3.');
    expect(vista(partida[1])[0]).toBe('accion:Otra 4.');
    expect(partida.flatMap((p) => p.lineas).some((l) => l.tipo === 'mas' || l.tipo === 'continua')).toBe(false);

    const dosYDos = paginas(`INT. A - DÍA\n\n${accion(6)}\n\n${accion(4, 'Otra')}`);
    expect(vista(dosYDos[0]).at(-1)).toBe('accion:Otra 2.');

    const unaArriba = paginas(`INT. A - DÍA\n\n${accion(8)}\n\n${accion(6, 'Otra')}`);
    expect(vista(unaArriba[0]).at(-1)).toBe('accion:Línea 8.');
    expect(vista(unaArriba[1])[0]).toBe('accion:Otra 1.');

    const unaAbajo = paginas(`INT. A - DÍA\n\n${accion(7)}\n\n${accion(3, 'Otra')}`);
    expect(vista(unaAbajo[0]).at(-1)).toBe('accion:Línea 7.');
    expect(vista(unaAbajo[1])[0]).toBe('accion:Otra 1.');
  });

  it('salto forzado', () => {
    const pgs = paginas('INT. A - DÍA\n\nUno.\n\n===\n\nDos.\n');
    expect(pgs.map(vista)).toEqual([['encabezado:INT. A - DÍA', '', 'accion:Uno.'], ['accion:Dos.']]);
  });

  it('diálogo más largo que una página', () => {
    const frases = Array.from({ length: 30 }, (_, k) => `Frase ${k + 1}.`).join('\n');
    const pgs = paginas(`INT. A - DÍA\n\nFRANCISCO\n${frases}\n`);
    expect(pgs.length).toBeGreaterThanOrEqual(3);
    pgs.forEach((pg, k) => {
      expect(pg.lineas.length).toBeLessThanOrEqual(12);
      if (k < pgs.length - 1) expect(pg.lineas.at(-1)!.tipo).toBe('mas');
      if (k > 0) expect(vista(pg)[0]).toBe("continua:FRANCISCO (CONT'D)");
    });
    expect(pgs.flatMap((p) => p.lineas).filter((l) => l.tipo === 'dialogo').length).toBe(30);
  });

  it('las líneas de continuación llevan la escena del bloque', () => {
    const pgs = paginas(`INT. A - DÍA\n\n${accion(3)}\n\nFRANCISCO\n${DIALOGO_LARGO}\n`);
    expect(pgs[0].lineas.at(-1)!.escena).toBe(0);
    expect(pgs[1].lineas[0].escena).toBe(0);
  });

  it('un encabezado solo arriba de la página no se queda huérfano', () => {
    const sinPunto = Array.from({ length: 12 }, (_, k) => `palabra ${k + 1}`).join('\n');
    const pgs = paginas(`INT. A - DÍA\n\nUno.\n\n===\n\nINT. B - DÍA\n\nFRANCISCO\n${sinPunto}\n`);
    const conB = pgs.find((p) => vista(p)[0] === 'encabezado:INT. B - DÍA')!;
    expect(conB.lineas.length).toBeGreaterThan(3);
    expect(conB.lineas.at(-1)!.tipo).toBe('mas');
    for (const p of pgs) expect(p.lineas.length).toBeLessThanOrEqual(12);
    expect(pgs.flatMap((p) => p.lineas).filter((l) => l.tipo === 'dialogo').length).toBe(12);
  });
});

describe('cadenas de encabezado y plano', () => {
  it('un encabezado seguido de plano no se queda al pie', () => {
    const pgs = paginas(`INT. A - DÍA\n\n${accion(5)}\n\nINT. B - NOCHE\n\n!!PLANO GENERAL DE LA CASA\n\n${accion(3, 'Otra')}`);
    expect(vista(pgs[0]).at(-1)).toBe('accion:Línea 5.');
    expect(vista(pgs[1]).slice(0, 3)).toEqual(['encabezado:INT. B - NOCHE', '', 'plano:PLANO GENERAL DE LA CASA']);
  });

  it('un plano seguido de otro plano no se queda al pie', () => {
    const pgs = paginas(`INT. A - DÍA\n\n${accion(5)}\n\n!!PLANO UNO\n\n!!PLANO DOS\n\n${accion(3, 'Otra')}`);
    expect(vista(pgs[0]).at(-1)).toBe('accion:Línea 5.');
    expect(vista(pgs[1])[0]).toBe('plano:PLANO UNO');
  });

  it('propiedades con guiones al azar', () => {
    // Generador determinista: mismas entradas en cada corrida.
    let semilla = 7;
    const azar = () => ((semilla = (semilla * 1103515245 + 12345) % 2147483648) / 2147483648);
    const elegir = <T,>(xs: T[]) => xs[Math.floor(azar() * xs.length)];
    const palabras = ['casa', 'luz', 'Ana', 'corre', 'mira', 'puerta', 'noche', 'silencio', 'ventana', 'auto'];
    const frase = () => Array.from({ length: 2 + Math.floor(azar() * 9) }, () => elegir(palabras)).join(' ') + elegir(['.', '.', '?', '', ',']);
    const parrafo = () => Array.from({ length: 1 + Math.floor(azar() * 6) }, frase).join(' ');
    const ATADOS = new Set(['encabezado', 'plano', 'personaje', 'acotacion']);
    for (let n = 0; n < 150; n++) {
      const partes: string[] = [];
      for (let k = 0; k < 4 + Math.floor(azar() * 14); k++) {
        const r = azar();
        if (r < 0.2) partes.push(`INT. LUGAR ${k} - DÍA`);
        else if (r < 0.3) partes.push(`!!PLANO ${k}`);
        else if (r < 0.65) partes.push(`${elegir(['ANA', 'BETO', 'CARLA (V.O.)'])}\n${azar() < 0.3 ? '(bajo)\n' : ''}${parrafo()}`);
        else partes.push(parrafo());
      }
      const fuente = partes.join('\n\n');
      const R = elegir([8, 12, 20, 54]);
      const cfg = resolverConfig({ renglonesPorPagina: R });
      const bloques = maquetar(analizar(fuente), cfg);
      const pgs = paginar(bloques, cfg);
      const textoDe = (ls: Linea[]) => ls.filter((l) => ['accion', 'dialogo'].includes(l.tipo)).map(txt).join(' ').replace(/\s+/g, ' ');
      expect(textoDe(pgs.flatMap((p) => p.lineas)), fuente).toBe(textoDe(bloques.flatMap((b) => b.lineas)));
      pgs.forEach((p, i) => {
        expect(p.lineas.length, fuente).toBeLessThanOrEqual(R);
        expect(p.lineas[0].tipo, fuente).not.toBe('blanco');
        if (i < pgs.length - 1) expect(ATADOS.has(p.lineas.at(-1)!.tipo), `R=${R} pág ${i + 1}\n${fuente}`).toBe(false);
      });
    }
  });
});
