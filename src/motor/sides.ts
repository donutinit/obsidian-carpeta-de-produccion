import { resolverConfig, type Config } from './config';
import { construir } from './index';

const NUMERO = /\s*#([^#\s][^#]*)#\s*$/;
const TITULOS: Record<string, string> = { title: 'Title', credit: 'Credit', author: 'Author', source: 'Source', date: 'Draft date', contact: 'Contact' };

/**
 * Sides de un actor: solo las escenas donde está en el reparto, con su número del guion completo fijo (`#n#`),
 * y las mismas propiedades (portada y configuración).
 */
export function fuenteSides(fuente: string, personaje: string, parcial: Partial<Config> = {}): string {
  const g = construir(fuente, resolverConfig(parcial));
  const p = personaje.trim().toLocaleLowerCase('es');
  const lineas = fuente.replace(/\r\n?/g, '\n').split('\n');
  const fm = fuente.match(/^\uFEFF?---\n[\s\S]*?\n---(?:\n|$)/);
  const partes: string[] = [];
  g.doc.escenas.forEach((e, k) => {
    if (!g.breakdown[k].reparto.some((n) => n.toLocaleLowerCase('es') === p)) return;
    const fin = k + 1 < g.doc.escenas.length ? g.doc.escenas[k + 1].linea : lineas.length;
    const tramo = lineas.slice(e.linea, fin);
    tramo[0] = tramo[0].replace(NUMERO, '') + `#${e.numero}#`;
    while (tramo.length && !tramo[tramo.length - 1].trim()) tramo.pop();
    partes.push(tramo.join('\n'));
  });
  // La portada escrita en el cuerpo (Title:…) va como bloque Fountain; la de las propiedades viaja en el frontmatter.
  const portada = Object.entries(TITULOS)
    .flatMap(([clave, titulo]) => {
      const v = (g.doc.portada[clave] ?? []).filter(Boolean);
      return v.length === 1 ? [`${titulo}: ${v[0]}`] : v.length ? [`${titulo}:`, ...v.map((x) => `    ${x}`)] : [];
    })
    .join('\n');
  return (fm ? fm[0].replace(/^\uFEFF/, '') : '') + (portada ? portada + '\n\n' : '') + partes.join('\n\n') + '\n';
}
