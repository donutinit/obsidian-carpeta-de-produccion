import { describe, expect, it } from 'vitest';
import { construir, leerFrontmatter, proyectoMinimo } from '../src/motor';

describe('proyecto mínimo, cuando la vault no tiene plantillas', () => {
  const archivos = proyectoMinimo('El viaje', '24 de noviembre de 2026');

  it('trae la ficha del proyecto y el guion', () => {
    expect(Object.keys(archivos)).toEqual(['00 - Proyecto.md', '02 - Guion.md']);
    expect(leerFrontmatter(archivos['00 - Proyecto.md'])).toMatchObject({ carpeta: 'proyecto', titulo: 'El viaje' });
    expect(leerFrontmatter(archivos['02 - Guion.md'])).toMatchObject({ carpeta: 'guion', proyecto: 'El viaje' });
  });

  it('el guion ya tiene portada y una escena que el plugin lee', () => {
    const g = construir(archivos['02 - Guion.md']);
    expect(g.doc.portada?.title).toEqual(['El viaje']);
    expect(g.doc.escenas).toHaveLength(1);
  });

  it('un título con comillas no rompe las propiedades', () => {
    const a = proyectoMinimo('El "otro" viaje: parte 1', 'hoy');
    expect(leerFrontmatter(a['00 - Proyecto.md'])).toMatchObject({ titulo: 'El "otro" viaje: parte 1' });
  });
});
