import { describe, expect, it } from 'vitest';
import { analizarEnLinea, textoPlano } from '../src/motor/enlinea';

describe('analizarEnLinea', () => {
  it('marca simple', () => {
    expect(analizarEnLinea('toma una {ut:manzana}')).toEqual([
      { t: 'toma una ' },
      { t: 'manzana', cat: 'ut', item: 'manzana', cantidad: 1 },
    ]);
  });

  it('marca con nombre y cantidad', () => {
    expect(analizarEnLinea('{extra:La ciudad|Extras de atmósfera|2}')).toEqual([
      { t: 'La ciudad', cat: 'extra', item: 'Extras de atmósfera', cantidad: 2 },
    ]);
  });

  it('código desconocido se imprime sin llaves (nunca salen marcas de trabajo)', () => {
    const segs = analizarEnLinea('a {xyz:b} c');
    expect(textoPlano(segs)).toBe('a b c');
    expect(segs.find((s) => s.cat)).toMatchObject({ t: 'b', cat: 'xyz' });
  });

  it('marca con texto vacío no imprime nada', () => {
    expect(textoPlano(analizarEnLinea('a {vest:|Traje}b'))).toBe('a b');
  });

  it('énfasis', () => {
    const segs = analizarEnLinea('**fuerte** y *suave* y _sub_');
    expect(segs.find((s) => s.t === 'fuerte')?.b).toBe(true);
    expect(segs.find((s) => s.t === 'suave')?.i).toBe(true);
    expect(segs.find((s) => s.t === 'sub')?.u).toBe(true);
    expect(textoPlano(segs)).toBe('fuerte y suave y sub');
  });

  it('enlace de Obsidian', () => {
    expect(textoPlano(analizarEnLinea('[[Francisco]] y [[Personajes/Ana|Ana]]'))).toBe('Francisco y Ana');
    expect(textoPlano(analizarEnLinea('ve a [[Personajes/Ana]]'))).toBe('ve a Ana');
  });

  it('enlace dentro de una marca imprime su texto', () => {
    expect(analizarEnLinea('{rep:[[Personajes/Ana|Ana]]}')).toEqual([{ t: 'Ana', cat: 'rep', item: 'Ana', cantidad: 1 }]);
  });
});

describe('revisión fase 2: énfasis y marcas', () => {
  it('C1: una marca dentro de *…*, **…** o _…_ conserva el énfasis y no deja asteriscos', () => {
    const s = analizarEnLinea('Ve la *{ut:pistola}* y **{ut:bala}** y _{ut:x}_.');
    expect(textoPlano(s)).toBe('Ve la pistola y bala y x.');
    expect(s.find((x) => x.t === 'pistola')).toMatchObject({ cat: 'ut', i: true });
    expect(s.find((x) => x.t === 'bala')).toMatchObject({ cat: 'ut', b: true });
    expect(s.find((x) => x.t === 'x')).toMatchObject({ cat: 'ut', u: true });
  });
  it('C1: un énfasis que envuelve texto y una marca', () => {
    const s = analizarEnLinea('*la {ut:taza} roja*');
    expect(textoPlano(s)).toBe('la taza roja');
    expect(s.every((x) => x.i)).toBe(true);
    expect(s.find((x) => x.cat)).toMatchObject({ t: 'taza', cat: 'ut' });
  });
});
