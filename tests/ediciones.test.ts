import { describe, expect, it } from 'vitest';
import { analizar, asegurarIds, construir, copiarElementos, marcarMenciones, quitarElemento, renombrarElemento, type Cambio } from '../src/motor';

const aplicar = (t: string, cs: Cambio[]) => [...cs].sort((a, b) => b.desde - a.desde).reduce((s, c) => s.slice(0, c.desde) + c.texto + s.slice(c.hasta), t);

describe('ediciones del breakdown', () => {
  it('marcarMenciones marca palabras completas en acción, diálogo y encabezado', () => {
    const f = '---\ncarpeta: guion\ntaza: no\n---\nINT. CUARTO DE LA TAZA - DÍA\n\nAna toma la taza. La {ut:taza} cae.\n%%la taza del profe%%\n\nANA\nMi taza.\n\nVe [[taza]] y tazas.\n';
    expect(aplicar(f, marcarMenciones(f, 'ut', 'taza', 'Taza roja'))).toBe(
      '---\ncarpeta: guion\ntaza: no\n---\nINT. CUARTO DE LA {ut:TAZA|Taza roja} - DÍA\n\nAna toma la {ut:taza|Taza roja}. La {ut:taza} cae.\n%%la taza del profe%%\n\nANA\nMi {ut:taza|Taza roja}.\n\nVe [[taza]] y tazas.\n',
    );
    expect(aplicar(f, marcarMenciones(f, 'ut', 'taza'))).toContain('Ana toma la {ut:taza}.');
  });

  it('quitarElemento deja el texto visible y borra las ocultas, solo en esa escena', () => {
    const f = 'INT. A - DÍA\n%%{vest:|Traje azul}%%\n\nAna con {vest:traje|Traje azul} y {ut:taza}.\n\nINT. B - DÍA\n\nOtra vez {vest:traje|Traje azul}.\n';
    expect(aplicar(f, quitarElemento(f, 0, 'vest', 'traje azul'))).toBe('INT. A - DÍA\n\nAna con traje y {ut:taza}.\n\nINT. B - DÍA\n\nOtra vez {vest:traje|Traje azul}.\n');
  });

  it('copiarElementos escribe marcas ocultas en la escena destino', () => {
    const f = 'INT. A - DÍA\n%%escena: id=a%%\n\nAna con {vest:traje|Traje azul} y {ut:taza|Taza|2}.\n\nINT. B - DÍA\n\nAna con {ut:taza}.\n';
    const t = aplicar(f, copiarElementos(f, 0, 1));
    expect(t).toBe('INT. A - DÍA\n%%escena: id=a%%\n\nAna con {vest:traje|Traje azul} y {ut:taza|Taza|2}.\n\nINT. B - DÍA\n%%{vest:|Traje azul}%%\n\nAna con {ut:taza}.\n');
    expect(construir(t).breakdown[1].elementos.vest).toEqual([{ nombre: 'Traje azul', cantidad: 1 }]);
    expect(copiarElementos(t, 0, 1)).toEqual([]);
  });

  it('renombrar no toca otra categoría ni otro nombre; fusionar es renombrar', () => {
    const f = 'INT. A - DÍA\n%%{vest:|Traje azul}%%\n\n{vest:traje|Traje azul} y {ut:traje|Traje azul} y {vest:saco} y {vest:Traje azul|Traje azul|2}.\n';
    expect(aplicar(f, renombrarElemento(f, 'vest', 'traje azul', 'Vestido azul'))).toBe(
      'INT. A - DÍA\n%%{vest:|Vestido azul}%%\n\n{vest:traje|Vestido azul} y {ut:traje|Traje azul} y {vest:saco} y {vest:Traje azul|Vestido azul|2}.\n',
    );
    expect(aplicar(f, renombrarElemento(f, 'vest', 'saco', 'Traje azul'))).toContain('{vest:saco|Traje azul}');
  });

  it('asegurarIds respeta los que ya existen', () => {
    const f = 'INT. A - DÍA\n%%escena: color=azul%%\n\nUno.\n\nINT. B - DÍA\n%%escena: id=x9%%\n\nDos.\n\nINT. C - DÍA\n\nTres.\n';
    let n = 0;
    const t = aplicar(f, asegurarIds(f, () => `n${++n}`));
    expect(t).toBe('INT. A - DÍA\n%%escena: id=n1; color=azul%%\n\nUno.\n\nINT. B - DÍA\n%%escena: id=x9%%\n\nDos.\n\nINT. C - DÍA\n%%escena: id=n2%%\n\nTres.\n');
    expect(analizar(t).escenas.map((e) => e.id)).toEqual(['n1', 'x9', 'n2']);
    expect(construir(t).octavos.porEscena).toEqual(construir(f).octavos.porEscena);
    expect(asegurarIds(t, () => 'z')).toEqual([]);
  });
});

describe('revisión fase 2', () => {
  it('C1: marcar menciones dentro de énfasis no cambia lo impreso', () => {
    const f = 'INT. A - DÍA\n\nAna ve la *pistola*. La **pistola** brilla.\n';
    const t = aplicar(f, marcarMenciones(f, 'ut', 'pistola'));
    expect(t).toContain('*{ut:pistola}*');
    const impreso = (x: string) => construir(x).paginas[0].lineas.map((l) => l.segs.map((s) => s.t).join('')).join('\n');
    expect(impreso(t)).toBe(impreso(f));
  });
  it('C2: asegurarIds usa los metadatos escritos con espacio («%% escena:»)', () => {
    const f = 'INT. CASA - DÍA\n%% escena: color=azul; reparto=Ana, Beto%%\n\nBeto entra.\n';
    const t = aplicar(f, asegurarIds(f, () => 'n1'));
    expect(t).toBe('INT. CASA - DÍA\n%% escena: id=n1; color=azul; reparto=Ana, Beto%%\n\nBeto entra.\n');
    expect(construir(t).breakdown[0].reparto).toEqual(['Ana', 'Beto']);
  });
  it('renombrar limpia {, } y | del nombre nuevo', () => {
    const f = 'INT. A - DÍA\n\nUna {ut:taza}.\n';
    expect(aplicar(f, renombrarElemento(f, 'ut', 'taza', 'Taza | {roja}'))).toBe('INT. A - DÍA\n\nUna {ut:taza|Taza roja}.\n');
  });
});
