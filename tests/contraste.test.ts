import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CATEGORIAS } from '../src/motor/categorias';

const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

function tokens(selector: string): Record<string, string> {
  const inicio = css.indexOf(selector + ' {');
  if (inicio < 0) throw new Error(`No está el bloque ${selector}`);
  const cuerpo = css.slice(css.indexOf('{', inicio) + 1, css.indexOf('}', inicio));
  const out: Record<string, string> = {};
  for (const m of cuerpo.matchAll(/--cp-([a-z]+)\s*:\s*(#[0-9a-fA-F]{6})/g)) out[m[1]] = m[2].toLowerCase();
  return out;
}

function luminancia(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const claro = tokens('body.theme-light, .cp-page');
const oscuro = tokens('body.theme-dark');
// xa…xf: los colores de las categorías extra del proyecto (cp-t-x1…x6).
const CON_COLOR = ['rep', 'stunt', 'silent', 'extra', 'efx', 'ut', 'veh', 'mus', 'deco', 'xa', 'xb', 'xc', 'xd', 'xe', 'xf'];

describe('paleta', () => {
  it('cada categoría con color pasa 7:1 en claro y oscuro', () => {
    for (const [nombre, tema] of [['claro', claro], ['oscuro', oscuro]] as const) {
      for (const codigo of CON_COLOR) {
        expect(tema[codigo], `${nombre}: falta --cp-${codigo}`).toBeDefined();
        const r = contraste(tema.fg, tema[codigo]);
        expect(r, `${nombre} ${codigo}: ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(7);
      }
    }
  });

  it('el resaltado de los sides (siempre en papel claro) pasa 7:1', () => {
    expect(claro.side, 'falta --cp-side').toBeDefined();
    expect(contraste(claro.fg, claro.side)).toBeGreaterThanOrEqual(7);
  });

  it('el calendario de fechas pasa 7:1: día elegido, día de la pareja y su leyenda', () => {
    const pares: [string, string, string][] = [
      ['claro elegido', claro.sobreazul, claro.blue],
      ['oscuro elegido', oscuro.sobreazul, oscuro.blue],
      ['claro pareja', claro.fg, claro.neutral],
      ['oscuro pareja', oscuro.fg, oscuro.neutral],
    ];
    for (const [nombre, a, b] of pares) {
      expect(a, `${nombre}: falta un color`).toBeDefined();
      expect(b, `${nombre}: falta un color`).toBeDefined();
      const r = contraste(a, b);
      expect(r, `${nombre}: ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(7);
    }
  });

  it('acentos pasan 7:1', () => {
    const pares: [string, string, string][] = [
      ['claro rojo/blanco', claro.red, '#ffffff'],
      ['claro azul/blanco', claro.blue, '#ffffff'],
      ['oscuro rojo/#1e1e1e', oscuro.red, '#1e1e1e'],
      ['oscuro azul/#1e1e1e', oscuro.blue, '#1e1e1e'],
      ['blanco sobre rojo claro (recuadros de octavos)', '#ffffff', claro.red],
    ];
    for (const [nombre, a, b] of pares) {
      const r = contraste(a, b);
      expect(r, `${nombre}: ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(7);
    }
  });

  it('texto tenue de la hoja de octavos pasa 7:1 sobre el papel y sobre la regla', () => {
    const regla = css.match(/\.cp-ruler \{[^}]*background: (#[0-9a-fA-F]{6})/)?.[1];
    expect(regla, 'fondo de .cp-ruler').toBeDefined();
    const pares: [string, string, string][] = [
      ['claro tenue/blanco', claro.muted, '#ffffff'],
      ['claro tenue/regla', claro.muted, regla!],
      ['oscuro tenue/#1e1e1e', oscuro.muted, '#1e1e1e'],
    ];
    for (const [nombre, a, b] of pares) {
      const r = contraste(a, b);
      expect(r, `${nombre}: ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(7);
    }
  });

  it('colores fijos de texto en el papel pasan 7:1', () => {
    // Todo color de texto escrito directo en el CSS del papel, contra blanco.
    const fijos = [...css.matchAll(/(?:^|[;{\s])color:\s*(#[0-9a-fA-F]{3,6})/g)].map((m) => m[1]).filter((c) => c.toLowerCase() !== '#fff' && c.toLowerCase() !== '#ffffff');
    expect(fijos.length).toBeGreaterThan(0);
    for (const c of fijos) {
      const hex = c.length === 4 ? '#' + [...c.slice(1)].map((x) => x + x).join('') : c;
      const r = contraste(hex, '#ffffff');
      expect(r, `${c} sobre blanco: ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(7);
    }
  });

  it('hay 13 categorías con teclas únicas', () => {
    expect(CATEGORIAS.length).toBe(13);
    const teclas = CATEGORIAS.map((c) => c.tecla);
    expect(new Set(teclas).size).toBe(13);
    expect([...teclas].sort()).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'Shift-1', 'Shift-2', 'Shift-3'].sort());
    expect(CATEGORIAS.map((c) => c.codigo)).toEqual(['rep', 'stunt', 'silent', 'extra', 'efx', 'ut', 'veh', 'mus', 'deco', 'vest', 'maq', 'equipo', 'nota']);
  });
});
