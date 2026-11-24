import { describe, expect, it } from 'vitest';
import { construir } from '../src/motor';
import { textoPlano } from '../src/motor/enlinea';
import { analizar, clasificarLineas } from '../src/motor/fountain';

const tipos = (fuente: string) => analizar(fuente).elementos.map((e) => e.tipo);

describe('una línea que solo tiene un comentario es transparente', () => {
  it('no rompe el diálogo entre el personaje y su réplica', () => {
    expect(tipos('INT. A - DÍA\n\nFRANCISCO\n%%nota del profe%%\nHola.\n')).toEqual(['encabezado', 'personaje', 'dialogo']);
  });

  it('no convierte la réplica siguiente en acción', () => {
    expect(tipos('INT. A - DÍA\n\nFRANCISCO\nHola.\n%%nota%%\nAdiós.\n')).toEqual(['encabezado', 'personaje', 'dialogo', 'dialogo']);
  });

  it('no parte un párrafo de acción ni agrega un renglón en blanco', () => {
    const doc = analizar('INT. A - DÍA\n\nFrancisco entra.\n%%guía%%\nSe sienta.\n');
    expect(doc.elementos[1]).toMatchObject({ tipo: 'accion', texto: 'Francisco entra.\nSe sienta.', linea: 2, lineasFuente: [2, 4] });
    const g = construir('INT. A - DÍA\n\nFrancisco entra.\n%%guía%%\nSe sienta.\n');
    expect(g.paginas[0].lineas.map((l) => [l.tipo, textoPlano(l.segs), l.fuente])).toEqual([
      ['encabezado', 'INT. A - DÍA', 0],
      ['blanco', '', undefined],
      ['accion', 'Francisco entra.', 2],
      ['accion', 'Se sienta.', 4],
    ]);
  });

  it('un comentario de varias líneas con un renglón vacío adentro tampoco cuenta', () => {
    expect(tipos('INT. A - DÍA\n\nUno.\n%%\nguía\n\nmás guía\n%%\nDos.\n')).toEqual(['encabezado', 'accion']);
  });

  it('el editor marca las líneas del párrafo y deja el comentario en null', () => {
    expect(clasificarLineas('INT. A - DÍA\n\nFrancisco entra.\n%%guía%%\nSe sienta.')).toEqual(['encabezado', null, 'accion', null, 'accion']);
  });

  it('los metadatos de escena siguen leyéndose', () => {
    const doc = analizar('INT. CASA - DÍA\n%%escena: id=a1%%\nAna entra.\n');
    expect(doc.escenas[0].meta).toEqual({ id: 'a1' });
    expect(tipos('INT. CASA - DÍA\n%%escena: id=a1%%\nAna entra.\n')).toEqual(['encabezado', 'accion']);
  });
});
