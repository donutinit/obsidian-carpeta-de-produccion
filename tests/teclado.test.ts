import { describe, expect, it } from 'vitest';
import {
  clasificarEditor,
  conversionAlTeclear,
  convertirParrafo,
  DICCIONARIOS_MX,
  inicioDeParrafo,
  normalizarAlSalir,
  tipoEnCursor,
  mayusculasSeguras,
  normalizarParrafo,
  pulsarTecla,
  teclearParentesis,
  type Edicion,
  type TipoParrafo,
} from '../src/motor';

type T = 'Enter' | 'Tab' | 'Shift-Tab' | 'Shift-Enter';
const C = '¦';

function aplicar(texto: string, e: Edicion | null) {
  if (!e) return null;
  const nuevo = texto.slice(0, e.desde) + e.insertar + texto.slice(e.hasta);
  return { texto: nuevo.slice(0, e.cursor) + C + nuevo.slice(e.cursor), deseado: e.deseado, sugerir: e.sugerir };
}

function preparar(conCursor: string) {
  const a = conCursor.indexOf(C);
  const b = conCursor.indexOf(C, a + 1);
  const texto = conCursor.split(C).join('');
  return { texto, desde: a, hasta: b < 0 ? a : b - 1 };
}

function tecla(conCursor: string, t: T, deseado?: TipoParrafo) {
  const { texto, desde, hasta } = preparar(conCursor);
  const linea = texto.slice(0, desde).split('\n').length - 1;
  return aplicar(texto, pulsarTecla(texto, desde, hasta, t, deseado ? { linea, tipo: deseado } : undefined));
}

function paren(conCursor: string, c: '(' | ')', deseado?: TipoParrafo) {
  const { texto, desde } = preparar(conCursor);
  const linea = texto.slice(0, desde).split('\n').length - 1;
  return aplicar(texto, teclearParentesis(texto, desde, c, deseado ? { linea, tipo: deseado } : undefined));
}

// [descripción, texto con cursor, tecla, deseado de la línea en curso, texto esperado, deseado esperado]
const CASOS: [string, string, T, TipoParrafo | undefined, string, TipoParrafo | undefined][] = [
  // Al final de un párrafo con texto («saltar»).
  ['Enter al final del encabezado abre acción', 'INT. CASA - DÍA¦', 'Enter', undefined, 'INT. CASA - DÍA\n\n¦', 'accion'],
  ['Enter al final de la acción abre acción', 'INT. A - DÍA\n\nAna entra.¦', 'Enter', undefined, 'INT. A - DÍA\n\nAna entra.\n\n¦', 'accion'],
  ['Tab al final de la acción abre personaje', 'INT. A - DÍA\n\nAna entra.¦', 'Tab', undefined, 'INT. A - DÍA\n\nAna entra.\n\n¦', 'personaje'],
  ['Enter al final del personaje abre diálogo sin línea en blanco', 'ANA¦\nHola.', 'Enter', undefined, 'ANA\n¦\nHola.', 'dialogo'],
  ['Enter al final de «ana» con deseado personaje la deja en mayúsculas', 'INT. A - DÍA\n\nana¦', 'Enter', 'personaje', 'INT. A - DÍA\n\nANA\n¦', 'dialogo'],
  ['Tab al final del personaje abre acotación con paréntesis', 'INT. A - DÍA\n\nANA¦', 'Tab', 'personaje', 'INT. A - DÍA\n\nANA\n(¦)', 'acotacion'],
  ['Enter al final de la acotación abre diálogo', 'ANA\n(bajito)¦\nHola.', 'Enter', undefined, 'ANA\n(bajito)\n¦\nHola.', 'dialogo'],
  ['Enter antes del cierre de la acotación abre diálogo', 'ANA\n(bajito¦)\nHola.', 'Enter', undefined, 'ANA\n(bajito)\n¦\nHola.', 'dialogo'],
  ['Tab al final de la acotación abre diálogo', 'ANA\n(bajito)¦\nHola.', 'Tab', undefined, 'ANA\n(bajito)\n¦\nHola.', 'dialogo'],
  ['Enter al final del diálogo abre acción con una línea en blanco', 'ANA\nHola.¦', 'Enter', undefined, 'ANA\nHola.\n\n¦', 'accion'],
  ['Tab al final del diálogo abre acotación', 'ANA\nHola.¦', 'Tab', undefined, 'ANA\nHola.\n(¦)', 'acotacion'],
  ['Enter al final de la letra abre acción', 'ANA\n~La la.¦', 'Enter', undefined, 'ANA\n~La la.\n\n¦', 'accion'],
  ['Tab al final de la letra abre acotación', 'ANA\n~La la.¦', 'Tab', undefined, 'ANA\n~La la.\n(¦)', 'acotacion'],
  ['Enter al final de la transición abre encabezado', 'Algo.\n\n> CORTE A:¦', 'Enter', undefined, 'Algo.\n\n> CORTE A:\n\n¦', 'encabezado'],
  ['Tab al final de la transición abre encabezado', 'Algo.\n\n> CORTE A:¦', 'Tab', undefined, 'Algo.\n\n> CORTE A:\n\n¦', 'encabezado'],
  ['Enter al final del plano abre acción', 'Algo.\n\n!!PRIMER PLANO DE ANA¦', 'Enter', undefined, 'Algo.\n\n!!PRIMER PLANO DE ANA\n\n¦', 'accion'],
  ['Tab al final del plano abre acción', 'Algo.\n\n!!PRIMER PLANO DE ANA¦', 'Tab', undefined, 'Algo.\n\n!!PRIMER PLANO DE ANA\n\n¦', 'accion'],
  ['Enter al final de un plano deseado le pone !!', 'Algo.\n\nprimer plano¦', 'Enter', 'plano', 'Algo.\n\n!!PRIMER PLANO\n\n¦', 'accion'],

  // En un párrafo vacío («cambiar»).
  ['Enter en encabezado vacío no hace nada', 'Algo.\n\n¦', 'Enter', 'encabezado', 'Algo.\n\n¦', 'encabezado'],
  ['Tab en encabezado vacío cambia a acción', 'Algo.\n\n¦', 'Tab', 'encabezado', 'Algo.\n\n¦', 'accion'],
  ['Shift+Tab en encabezado vacío cambia a transición', 'Algo.\n\n¦', 'Shift-Tab', 'encabezado', 'Algo.\n\n¦', 'transicion'],
  ['Enter en acción vacía cambia a encabezado', 'Algo.\n\n¦', 'Enter', undefined, 'Algo.\n\n¦', 'encabezado'],
  ['Tab en acción vacía cambia a personaje sin escribir nada', 'Algo.\n\n¦', 'Tab', undefined, 'Algo.\n\n¦', 'personaje'],
  ['Shift+Tab en acción vacía cambia a encabezado', 'Algo.\n\n¦', 'Shift-Tab', undefined, 'Algo.\n\n¦', 'encabezado'],
  ['Enter en personaje vacío cambia a acción', 'Algo.\n\n¦', 'Enter', 'personaje', 'Algo.\n\n¦', 'accion'],
  ['Tab en personaje vacío cambia a acción', 'Algo.\n\n¦', 'Tab', 'personaje', 'Algo.\n\n¦', 'accion'],
  ['Enter en acotación vacía no hace nada', 'ANA\n(¦)', 'Enter', 'acotacion', 'ANA\n(¦)', 'acotacion'],
  ['Tab en acotación vacía cambia a diálogo y quita los paréntesis', 'ANA\n(¦)', 'Tab', 'acotacion', 'ANA\n¦', 'dialogo'],
  ['Shift+Tab en acotación vacía cambia a personaje con línea en blanco', 'ANA\n(¦)', 'Shift-Tab', 'acotacion', 'ANA\n\n¦', 'personaje'],
  ['Enter en diálogo vacío pasa a acción y agrega la línea en blanco', 'ANA\n¦', 'Enter', undefined, 'ANA\n\n¦', 'accion'],
  ['Tab en diálogo vacío cambia a acotación', 'ANA\n¦', 'Tab', undefined, 'ANA\n(¦)', 'acotacion'],
  ['Shift+Tab en diálogo vacío cambia a acotación', 'ANA\n¦', 'Shift-Tab', undefined, 'ANA\n(¦)', 'acotacion'],
  ['Enter en letra vacía pasa a acción', 'ANA\n¦', 'Enter', 'letra', 'ANA\n\n¦', 'accion'],
  ['Tab en letra vacía cambia a acotación', 'ANA\n¦', 'Tab', 'letra', 'ANA\n(¦)', 'acotacion'],
  ['Enter en transición vacía no hace nada', 'Algo.\n\n¦', 'Enter', 'transicion', 'Algo.\n\n¦', 'transicion'],
  ['Tab en transición vacía cambia a acción', 'Algo.\n\n¦', 'Tab', 'transicion', 'Algo.\n\n¦', 'accion'],
  ['Shift+Tab en transición vacía cambia a plano', 'Algo.\n\n¦', 'Shift-Tab', 'transicion', 'Algo.\n\n¦', 'plano'],
  ['Enter en plano vacío no hace nada', 'Algo.\n\n¦', 'Enter', 'plano', 'Algo.\n\n¦', 'plano'],
  ['Tab en plano vacío cambia a acción', 'Algo.\n\n¦', 'Tab', 'plano', 'Algo.\n\n¦', 'accion'],

  // A mitad del párrafo («partir»).
  ['Enter a mitad de la acción la parte en dos acciones', 'Ana entra.¦ Se sienta.', 'Enter', undefined, 'Ana entra.\n\n¦Se sienta.', 'accion'],
  ['Enter a mitad del encabezado parte → acción', 'INT. CASA¦ - DÍA', 'Enter', undefined, 'INT. CASA\n\n¦- DÍA', 'accion'],
  ['Enter a mitad de la acotación parte → diálogo', 'ANA\n(en voz¦ baja)\nHola.', 'Enter', undefined, 'ANA\n(en voz)\n¦baja\nHola.', 'dialogo'],
  ['Enter a mitad del diálogo mete el nombre de quien hablaba', 'ANA\nHola.¦ ¿Quién?', 'Enter', undefined, 'ANA\nHola.\n\nANA\n¦¿Quién?', 'dialogo'],
  ['Tab a mitad del diálogo mete una acotación', 'ANA\nHola.¦ ¿Quién?', 'Tab', undefined, 'ANA\nHola.\n(¦)\n¿Quién?', 'acotacion'],
  ['Tab a mitad de la acción no hace nada', 'Ana entra.¦ Se sienta.', 'Tab', undefined, 'Ana entra.¦ Se sienta.', undefined],

  // Al inicio.
  ['Enter al inicio del encabezado lo empuja y deja uno vacío', 'Algo.\n\n¦INT. A - DÍA', 'Enter', undefined, 'Algo.\n\n¦\n\nINT. A - DÍA', 'encabezado'],
  ['Enter al inicio del diálogo no hace nada', 'ANA\n¦Hola.', 'Enter', undefined, 'ANA\n¦Hola.', undefined],
  ['Tab al inicio de la acción la vuelve personaje', 'INT. A - DÍA\n\n¦ana', 'Tab', undefined, 'INT. A - DÍA\n\n¦ANA', 'personaje'],

  // Casos especiales.
  ['Tab al final del encabezado agrega « - »', 'INT. CASA¦', 'Tab', undefined, 'INT. CASA - ¦', 'encabezado'],
  ['Tab tras « -» solo agrega el espacio', 'INT. CASA -¦', 'Tab', 'encabezado', 'INT. CASA - ¦', 'encabezado'],
  ['Tab con el momento ya escrito salta a acción', 'INT. CASA - DÍA¦', 'Tab', undefined, 'INT. CASA - DÍA\n\n¦', 'accion'],
  ['Enter en una acción que es el nombre de alguien que ya habló la vuelve personaje', 'INT. A - DÍA\n\nANA\nHola.\n\nana¦', 'Enter', undefined, 'INT. A - DÍA\n\nANA\nHola.\n\nANA\n¦', 'dialogo'],
  ['Shift+Enter mete un salto sin líneas en blanco', 'Ana entra.¦', 'Shift-Enter', undefined, 'Ana entra.\n¦', 'accion'],
  ['Shift+Tab en diálogo con texto lo vuelve acotación', 'ANA\nHola.¦', 'Shift-Tab', undefined, 'ANA\n(Hola.)¦', 'acotacion'],
  ['Shift+Tab en acotación con texto la vuelve personaje', 'ANA\n(bajito)¦', 'Shift-Tab', undefined, 'ANA\n\nBAJITO¦', 'personaje'],
  ['Shift+Tab en personaje con texto lo vuelve acción', 'INT. A - DÍA\n\nANA¦\nHola.', 'Shift-Tab', undefined, 'INT. A - DÍA\n\n!ANA¦\nHola.', 'accion'],
  ['Enter con selección la borra y actúa ahí', 'Ana ¦entra¦.', 'Enter', undefined, 'Ana\n\n¦.', 'accion'],
  ['Tab con selección no hace nada', 'Ana ¦entra¦.', 'Tab', undefined, 'Ana entra.', undefined],
];

describe('teclado', () => {
  for (const [nombre, entrada, t, deseado, esperado, deseadoEsperado] of CASOS) {
    it(nombre, () => {
      const r = tecla(entrada, t, deseado);
      expect(r).not.toBeNull();
      if (esperado.includes(C)) expect(r!.texto).toBe(esperado);
      else expect(r!.texto.replace(C, '')).toBe(esperado);
      expect(r!.deseado).toBe(deseadoEsperado);
    });
  }

  it('Tab al final del encabezado pide sugerencias del momento', () => {
    expect(tecla('INT. CASA¦', 'Tab')!.sugerir).toBe(true);
    expect(tecla('INT. CASA ¦', 'Tab', 'encabezado')!.texto).toBe('INT. CASA - ¦');
  });

  it('Tab en un encabezado sin locación no hace nada', () => {
    expect(tecla('Algo.\n\nINT. ¦', 'Tab', 'encabezado')!.texto).toBe('Algo.\n\nINT. ¦');
  });

  it('Enter en el frontmatter, en un comentario o en la portada devuelve null', () => {
    expect(tecla('---\ncarpeta: guion¦\n---\nINT. A - DÍA\n', 'Enter')).toBeNull();
    expect(tecla('INT. A - DÍA\n\nAlgo.\n%%nota¦ larga%%\n', 'Enter')).toBeNull();
    expect(tecla('Title: X¦\n\nINT. A - DÍA\n', 'Tab')).toBeNull();
    expect(tecla('---\ncarpeta: guion\n---\n¦', 'Enter')).not.toBeNull();
  });
});

describe('paréntesis', () => {
  it('«(» en diálogo vacío abre acotación', () => {
    expect(paren('ANA\n¦', '(')).toMatchObject({ texto: 'ANA\n(¦)', deseado: 'acotacion' });
  });
  it('«(» al final del diálogo abre la acotación abajo y a mitad la mete en medio', () => {
    expect(paren('ANA\nHola.¦', '(')!.texto).toBe('ANA\nHola.\n(¦)');
    expect(paren('ANA\nHola.¦ Adiós.', '(')!.texto).toBe('ANA\nHola.\n(¦)\nAdiós.');
  });
  it('«)» sobre el cierre salta a diálogo', () => {
    expect(paren('ANA\n(bajito¦)', ')')).toMatchObject({ texto: 'ANA\n(bajito)\n¦', deseado: 'dialogo' });
    expect(paren('ANA\n(¦)', ')', 'acotacion')!.texto).toBe('ANA\n()¦');
  });
  it('fuera del diálogo los paréntesis se escriben normal', () => {
    expect(paren('INT. A - DÍA\n\nAna ¦', '(')).toBeNull();
  });
});

describe('normalizar y mayúsculas', () => {
  it('mayúsculas seguras no tocan {ut:…} ni [[…]]', () => {
    expect(mayusculasSeguras('int. casa de {ut:ana}')).toBe('INT. CASA DE {ut:ANA}');
    expect(mayusculasSeguras('casa de [[Ana|ana]] y {ut:taza|Taza roja|2}')).toBe('CASA DE [[Ana|ana]] Y {ut:TAZA|Taza roja|2}');
    expect(mayusculasSeguras('ana %%nota del profe%%')).toBe('ANA %%nota del profe%%');
  });

  it('normalizar: plano sin !! lo recibe; transición fuera del diccionario recibe >', () => {
    expect(normalizarParrafo('primer plano', 'plano')).toBe('!!PRIMER PLANO');
    expect(normalizarParrafo('salto a:', 'transicion')).toBe('> SALTO A:');
    expect(normalizarParrafo('corte a:', 'transicion')).toBe('CORTE A:');
    expect(normalizarParrafo('casa de ana', 'encabezado')).toBe('.CASA DE ANA');
    expect(normalizarParrafo('int. casa', 'encabezado')).toBe('INT. CASA');
    expect(normalizarParrafo('ana', 'personaje')).toBe('ANA');
    expect(normalizarParrafo('bajito', 'acotacion')).toBe('(bajito)');
    expect(normalizarParrafo('la la', 'letra')).toBe('~la la');
    expect(normalizarParrafo('SILENCIO', 'accion')).toBe('!SILENCIO');
    expect(normalizarParrafo('Ana entra.', 'accion')).toBe('Ana entra.');
  });

  it('clasificarEditor sostiene al personaje cuando el diálogo deseado está vacío', () => {
    const tipos = clasificarEditor('INT. A - DÍA\n\nANA\n', { linea: 3, tipo: 'dialogo' });
    expect(tipos.slice(0, 4)).toEqual(['encabezado', null, 'personaje', 'dialogo']);
  });
});

describe('apoyo del editor', () => {
  it('convertirParrafo cambia el tipo del párrafo del cursor', () => {
    const conv = (s: string, tipo: TipoParrafo) => {
      const { texto, desde } = preparar(s);
      return aplicar(texto, convertirParrafo(texto, desde, tipo));
    };
    expect(conv('INT. A - DÍA\n\nana¦', 'personaje')).toMatchObject({ texto: 'INT. A - DÍA\n\nANA¦', deseado: 'personaje' });
    expect(conv('INT. A - DÍA\n\nsalto a:¦', 'transicion')!.texto).toBe('INT. A - DÍA\n\n> SALTO A:¦');
    expect(conv('ANA\n\nbajito¦', 'acotacion')!.texto).toBe('ANA\n(bajito)¦');
    expect(conv('Algo.\n\n¦', 'plano')).toMatchObject({ texto: 'Algo.\n\n¦', deseado: 'plano' });
    expect(conv('---\ncarpeta: guion¦\n---\n', 'accion')).toBeNull();
  });

  it('conversionAlTeclear pone en mayúsculas un encabezado o una transición recién reconocidos', () => {
    expect(conversionAlTeclear('Algo.\n\nint. casa', 2)).toBe('INT. CASA');
    expect(conversionAlTeclear('Algo.\n\ncorte a:', 2)).toBe('CORTE A:');
    expect(conversionAlTeclear('Algo.\n\nAna entra.', 2)).toBeNull();
    expect(conversionAlTeclear('Algo.\nint. casa', 1)).toBeNull();
    expect(conversionAlTeclear('Algo.\n\nINT. CASA', 2)).toBeNull();
  });

  it('inicioDeParrafo: tras línea en blanco, personaje o acotación', () => {
    const t = 'INT. A - DÍA\n\nAna entra.\nSe sienta.\n\nANA\n(bajito)\nHola.\nAdiós.';
    expect([2, 3, 6, 7, 8].map((l) => inicioDeParrafo(t, l))).toEqual([true, false, true, true, false]);
  });

  it('las transiciones del proyecto cuentan en el editor', () => {
    const dic = { ...DICCIONARIOS_MX, transiciones: ['SALTO A:'] };
    expect(clasificarEditor('Algo.\n\nSALTO A:\n\nOtro.', null, dic)[2]).toBe('transicion');
    expect(tipoEnCursor('Algo.\n\nSALTO A:\n\nOtro.', 9, null, dic)).toBe('transicion');
  });
});

describe('normalizar al salir de la línea', () => {
  it('nunca toca el frontmatter ni un comentario', () => {
    expect(normalizarAlSalir('---\ncarpeta: guion\n---\nINT. A - DÍA', 0, 'encabezado')).toBeNull();
    expect(normalizarAlSalir('---\ncarpeta: guion\n---\nINT. A - DÍA', 1, 'personaje')).toBeNull();
    expect(normalizarAlSalir('INT. A - DÍA\n\n%%nota del profe%%', 2, 'personaje')).toBeNull();
  });
  it('escribe como Fountain el párrafo cuyo tipo venía del deseado', () => {
    expect(normalizarAlSalir('---\ncarpeta: guion\n---\nINT. A - DÍA\n\nana', 5, 'personaje')).toBe('ANA');
    expect(normalizarAlSalir('INT. A - DÍA\n\nprimer plano', 2, 'plano')).toBe('!!PRIMER PLANO');
  });
  it('no cambia lo que ya se lee así ni las líneas vacías', () => {
    expect(normalizarAlSalir('INT. A - DÍA\n\nANA\nHola.', 2, 'personaje')).toBeNull();
    expect(normalizarAlSalir('INT. A - DÍA\n\n', 2, 'personaje')).toBeNull();
  });
});

describe('revisión fase 1', () => {
  it('C1: una acción deseada nunca se normaliza', () => {
    for (const l of ['int. casa - noche', 'INT. B - NOCHE', 'CORTE A:', '===', '# Acto 2', '!!PLANO', 'SILENCIO']) {
      expect(normalizarAlSalir('Ana entra.\n\n' + l, 2, 'accion'), l).toBeNull();
    }
  });

  it('C1: lo que el parser lee como otro tipo explícito gana al deseado', () => {
    expect(tipoEnCursor('Ana entra.\n\nINT. CASA - NOCHE', 20, { linea: 2, tipo: 'accion' })).toBe('encabezado');
    expect(clasificarEditor('Ana entra.\n\nINT. CASA', { linea: 2, tipo: 'accion' })[2]).toBe('encabezado');
    expect(normalizarAlSalir('Ana entra.\n\n> CORTE A:', 2, 'personaje')).toBeNull();
    expect(normalizarAlSalir('Ana entra.\n\n===', 2, 'encabezado')).toBeNull();
  });

  it('C1: el deseado sigue mandando sobre texto que el parser lee como acción', () => {
    expect(normalizarAlSalir('INT. A - DÍA\n\nana', 2, 'personaje')).toBe('ANA');
    expect(tipoEnCursor('INT. A - DÍA\n\nana', 16, { linea: 2, tipo: 'personaje' })).toBe('personaje');
  });

  it('I1: las mayúsculas no tocan un enlace dentro de una marca', () => {
    expect(mayusculasSeguras('int. {deco:[[Casa de Ana]]} - día')).toBe('INT. {deco:[[Casa de Ana]]} - DÍA');
    expect(mayusculasSeguras('int. {deco:[[Casa de Ana|casa]]} - día')).toBe('INT. {deco:[[Casa de Ana|casa]]} - DÍA');
  });

  it('I2: «(» dentro de un enlace o una marca se escribe normal', () => {
    expect(paren('ANA\nVe a [[Casa ¦]] ya.', '(')).toBeNull();
    expect(paren('ANA\nVe a [[Casa ¦', '(')).toBeNull();
    expect(paren('ANA\nToma {ut:taza ¦} ya.', '(')).toBeNull();
  });

  it('I4: Enter y Tab al final del encabezado dejan sus metadatos pegados a él', () => {
    expect(tecla('INT. A - DÍA¦\n%%escena: color=azul; id=x1%%\n\nAlgo.', 'Enter')!.texto).toBe('INT. A - DÍA\n%%escena: color=azul; id=x1%%\n\n¦\n\nAlgo.');
    expect(tecla('INT. A - DÍA - NOCHE¦\n%%escena: id=x1%%', 'Tab')!.texto).toBe('INT. A - DÍA - NOCHE\n%%escena: id=x1%%\n\n¦');
  });
});

describe('revisión fase 1: rendimiento', () => {
  it('I6: las consultas de una tecla sobre el mismo texto no vuelven a analizar el guion', async () => {
    const { readFileSync } = await import('node:fs');
    const { analizar } = await import('../src/motor');
    const oro = readFileSync('tests/fixtures/papa.md', 'utf8');
    const largo = oro + '\n' + oro.split('\n---\n').slice(1).join('\n---\n').repeat(6);
    const t0 = performance.now();
    analizar(largo + ' ');
    const una = performance.now() - t0;
    const pos = largo.length - 5;
    const t1 = performance.now();
    for (let k = 0; k < 3; k++) {
      tipoEnCursor(largo, pos);
      inicioDeParrafo(largo, largo.split('\n').length - 2);
      clasificarEditor(largo, null);
    }
    expect(performance.now() - t1).toBeLessThan(una * 3);
  });
});
