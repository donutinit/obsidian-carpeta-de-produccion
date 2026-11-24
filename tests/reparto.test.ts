import { describe, expect, it } from 'vitest';
import { categoriasDe, CATEGORIAS, construir, textoPlano } from '../src/motor';

const reparto = (f: string, extra = {}) => construir(f, extra).breakdown.map((b) => b.reparto);
const impreso = (f: string) =>
  construir(f)
    .paginas.flatMap((p) => p.lineas)
    .map((l) => textoPlano(l.segs))
    .join('\n');

describe('reparto automático', () => {
  it('quien solo habla en V.O. no cuenta, salvo marcado', () => {
    expect(reparto('INT. A - DÍA\n\nANA (V.O.)\nHola.\n\nBETO\nQué.\n')).toEqual([['Beto']]);
    expect(reparto('INT. A - DÍA\n\n{rep:Ana} duerme.\n\nANA (V.O.)\nHola.\n')).toEqual([['Ana']]);
  });

  it('un personaje conocido mencionado en la acción cuenta, en orden de aparición', () => {
    expect(reparto('INT. A - DÍA\n\nANA\nHola.\n\nINT. B - DÍA\n\nBeto mira a Ana.\n\nBETO\nYa.\n')).toEqual([['Ana'], ['Beto', 'Ana']]);
  });

  it('«Ana» no cuenta dentro de «Anabel»', () => {
    expect(reparto('INT. A - DÍA\n\nANA\nHola.\n\nINT. B - DÍA\n\nAnabel entra.\n')).toEqual([['Ana'], []]);
  });

  it('los personajes de la carpeta Personajes/ también son conocidos', () => {
    expect(reparto('INT. A - DÍA\n\nLa doctora Ruiz entra.\n', { personajesConocidos: ['Ruiz'] })).toEqual([['Ruiz']]);
    expect(reparto('INT. A - DÍA\n\nLa doctora Ruiz entra.\n')).toEqual([[]]);
  });

  it('reparto= en los metadatos reemplaza la lista', () => {
    expect(reparto('INT. A - DÍA\n%%escena: reparto=Ana, Don Pedro%%\n\nBETO\nHola.\n')).toEqual([['Ana', 'Don Pedro']]);
  });

  it('marca oculta con texto vacío cuenta y no se imprime', () => {
    const f = 'INT. A - DÍA\n%%{vest:|Traje azul de Ana}%%\n%%{rep:|Policía}%%\n\nAna entra.\n';
    const g = construir(f);
    expect(g.breakdown[0].elementos.vest).toEqual([{ nombre: 'Traje azul de Ana', cantidad: 1 }]);
    expect(g.breakdown[0].reparto).toEqual(['Policía']);
    expect(g.doc.ocultas.map((o) => [o.escena, o.cat, o.item])).toEqual([
      [0, 'vest', 'Traje azul de Ana'],
      [0, 'rep', 'Policía'],
    ]);
    expect(impreso(f)).not.toMatch(/Traje|Policía|\{/);
  });

  it('código desconocido se imprime sin llaves y va a su código en el breakdown', () => {
    const f = 'INT. A - DÍA\n\nToma la {foo:taza}.\n';
    expect(impreso(f)).toContain('Toma la taza.');
    expect(construir(f).breakdown[0].elementos.foo).toEqual([{ nombre: 'Taza', cantidad: 1 }]);
  });
});

describe('categorías del proyecto', () => {
  it('las extra van después de las de fábrica con teclas ⇧4… y estilos x1…', () => {
    const c = categoriasDe(['vfx: Efectos visuales', 'seg: Seguridad', 'rep: Repetida', 'Mal código: x', 'otra']);
    expect(c.slice(0, CATEGORIAS.length)).toEqual(CATEGORIAS);
    expect(c.slice(CATEGORIAS.length)).toEqual([
      { codigo: 'vfx', nombre: 'Efectos visuales', marca: 'color extra 1', tecla: 'Shift-4', estilo: 'x1' },
      { codigo: 'seg', nombre: 'Seguridad', marca: 'color extra 2', tecla: 'Shift-5', estilo: 'x2' },
    ]);
    expect(categoriasDe(new Array(9).fill(0).map((_, k) => `c${'abcdefghi'[k]}: C`)).length).toBe(CATEGORIAS.length + 6);
  });

  it('construir usa las categorías de la configuración', () => {
    expect(construir('', {}).config.categorias).toEqual(CATEGORIAS);
  });
});

describe('revisión fase 2: menciones en español', () => {
  it('I6: solo cuenta la mención escrita con mayúscula y nunca TODOS, AMBOS o VOZ', () => {
    const f = 'INT. A - DÍA\n\nTODOS\n¡Sí!\n\nROSA\nHola.\n\nINT. B - DÍA\n\nTodos los días la luz entra. Riega una rosa.\n\nLUZ (V.O.)\nHola.\n\nINT. C - DÍA\n\nRosa sale.\n';
    expect(reparto(f)).toEqual([['Todos', 'Rosa'], [], ['Rosa']]);
  });
});
