import { describe, expect, it } from 'vitest';
import { agregarComentario, alternarResuelto, borrarComentario, construir, listarComentarios, responderComentario, textoPlano, type Cambio } from '../src/motor';

const aplicar = (t: string, c: Cambio) => t.slice(0, c.desde) + c.texto + t.slice(c.hasta);
const F =
  '---\ncarpeta: guion\n---\nINT. A - DÍA\n%%escena: id=a1%%\n%%{vest:|Traje}%%\n\n' +
  'Ana entra.%%>Profe: muy largo >>Diego: ya lo corté%% Se sienta junto a la ventana y mira la calle por un rato largo.\n%%>✓Profe: falta el momento%%\n%%guía: esto no es comentario%%\n\nANA\nHola.\n';
const huella = (t: string) => {
  const g = construir(t);
  return { octavos: g.octavos.porEscena, paginas: g.paginas.map((p) => p.lineas.map((l) => textoPlano(l.segs))) };
};

describe('comentarios del profesor', () => {
  it('lista solo los %%>…%%, con respuestas y resuelto', () => {
    const cs = listarComentarios(F);
    expect(cs.map(({ autor, texto, respuestas, resuelto, escena, fragmento }) => ({ autor, texto, respuestas, resuelto, escena, fragmento }))).toEqual([
      { autor: 'Profe', texto: 'muy largo', respuestas: [{ autor: 'Diego', texto: 'ya lo corté' }], resuelto: false, escena: 0, fragmento: 'Ana entra.' },
      { autor: 'Profe', texto: 'falta el momento', respuestas: [], resuelto: true, escena: 0, fragmento: 'Ana entra. Se sienta junto a la ventana y mira la calle por un rato largo.' },
    ]);
    expect(F.slice(cs[0].desde, cs[0].hasta)).toBe('%%>Profe: muy largo >>Diego: ya lo corté%%');
  });

  it('agregar a media línea y responder no cambian los octavos ni la paginación', () => {
    const t = 'INT. A - DÍA\n\nAna entra. Se sienta junto a la ventana y mira la calle por un rato largo, sin decir nada a nadie.\n';
    const con = aplicar(t, agregarComentario(t, t.indexOf(' Se sienta'), 'Profe', 'muy largo')!);
    expect(con).toContain('Ana entra.%%>Profe: muy largo%% Se sienta');
    const [c] = listarComentarios(con);
    const resp = aplicar(con, responderComentario(c, 'Diego', 'ok'));
    expect(resp).toContain('%%>Profe: muy largo >>Diego: ok%%');
    expect(huella(resp)).toEqual(huella(t));
  });

  it('resolver y reabrir', () => {
    const [c] = listarComentarios(F);
    const r = aplicar(F, alternarResuelto(F, c));
    expect(r).toContain('%%>✓Profe: muy largo');
    const [c2] = listarComentarios(r);
    expect(c2.resuelto).toBe(true);
    expect(aplicar(r, alternarResuelto(r, c2))).toBe(F);
  });

  it('borrar quita la línea si iba sola y solo el comentario si iba a media línea', () => {
    const cs = listarComentarios(F);
    expect(aplicar(F, borrarComentario(F, cs[1]))).not.toContain('falta el momento');
    expect(aplicar(F, borrarComentario(F, cs[1]))).toContain('largo.\n%%guía');
    expect(aplicar(F, borrarComentario(F, cs[0]))).toContain('Ana entra. Se sienta');
  });

  it('el texto no puede romper el comentario', () => {
    const t = 'INT. A - DÍA\n\nAlgo.\n';
    const c = agregarComentario(t, t.indexOf('Algo.') + 5, 'Pro%%fe: x>', 'uno %% dos\ntres >> cuatro')!;
    expect(c.texto).toBe('%%>Profe x: uno ％ dos tres » cuatro%%');
    expect(listarComentarios(aplicar(t, c))[0]).toMatchObject({ autor: 'Profe x', texto: 'uno ％ dos tres » cuatro' });
  });
});

describe('revisión fase 4', () => {
  it('C1: comentar en cualquier línea en blanco del guion de oro no cambia la paginación', async () => {
    const { readFileSync } = await import('node:fs');
    const oro = readFileSync('tests/fixtures/papa.md', 'utf8');
    const base = huella(oro);
    const lineas = oro.split('\n');
    let pos = 0;
    let probadas = 0;
    lineas.forEach((l) => {
      if (!l.trim()) {
        const c = agregarComentario(oro, pos, 'Profe', 'x');
        if (c) {
          expect(huella(aplicar(oro, c)), `línea en ${pos}`).toEqual(base);
          probadas++;
        }
      }
      pos += l.length + 1;
    });
    expect(probadas).toBeGreaterThan(50);
  });

  it('C1: en una línea en blanco el comentario va al final de la línea anterior con texto', () => {
    const t = 'INT. A - DÍA\n\nAna entra.\n\nANA\nHola.\n';
    const c = agregarComentario(t, t.indexOf('\n\nANA') + 1, 'Profe', 'x')!;
    expect(aplicar(t, c)).toBe('INT. A - DÍA\n\nAna entra.%%>Profe: x%%\n\nANA\nHola.\n');
  });

  it('C1: dentro de un comentario va después de él; en el frontmatter no se puede', () => {
    const t = '---\ncarpeta: guion\n---\n%%\nguía\n%%\nINT. A - DÍA\n\nAlgo.\n';
    const dentro = agregarComentario(t, t.indexOf('guía') + 2, 'Profe', 'x')!;
    expect(aplicar(t, dentro)).toContain('guía\n%% %%>Profe: x%%\nINT. A');
    expect(huella(aplicar(t, dentro))).toEqual(huella(t));
    expect(agregarComentario(t, t.indexOf('guion'), 'Profe', 'x')).toBeNull();
  });

  it('I2: el texto con % no cierra el comentario ni deja nada visible', () => {
    const t = 'INT. A - DÍA\n\nAlgo pasa.\n';
    for (const texto of ['sube al 10%', 'a %%% b', '%']) {
      const r = aplicar(t, agregarComentario(t, t.indexOf('pasa.') + 5, 'Profe', texto)!);
      expect(listarComentarios(r)).toHaveLength(1);
      expect(huella(r)).toEqual(huella(t));
    }
  });
});
