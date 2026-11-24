export type Propiedades = Record<string, string | string[]>;

function sinComillas(v: string): string {
  const t = v.trim();
  if (t.length >= 2 && t[0] === '"' && t[t.length - 1] === '"') return t.slice(1, -1).replace(/\\"/g, '"');
  if (t.length >= 2 && t[0] === "'" && t[t.length - 1] === "'") return t.slice(1, -1).replace(/''/g, "'");
  return t;
}

/** YAML mínimo del frontmatter: `clave: valor`, `clave: [a, b]` y `clave:` seguida de `  - x`. Lo anidado se ignora. */
export function leerFrontmatter(fuente: string): Propiedades {
  const src = String(fuente).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const m = src.match(/^---\n([\s\S]*?)\n---(?=\n|$)/);
  if (!m) return {};
  const props: Propiedades = {};
  let ultima: string | null = null;
  for (const linea of m[1].split('\n')) {
    const item = linea.match(/^\s*-\s+(.*)$/) ?? linea.match(/^\s*-$/);
    if (item && ultima) {
      const actual = props[ultima];
      const lista = Array.isArray(actual) ? actual : actual ? [actual] : [];
      const v = sinComillas(item[1] ?? '');
      if (v) lista.push(v);
      props[ultima] = lista;
      continue;
    }
    const kv = linea.match(/^([^\s#:-][^:]*):(?:\s+(.*))?$/);
    if (!kv) {
      if (/^\S/.test(linea)) ultima = null;
      continue;
    }
    ultima = kv[1].trim();
    const valor = (kv[2] ?? '').trim();
    if (/^\[.*\]$/.test(valor)) {
      props[ultima] = valor.slice(1, -1).split(',').map(sinComillas).filter(Boolean);
    } else props[ultima] = sinComillas(valor);
  }
  return props;
}

const PORTADA: Record<string, string> = {
  titulo: 'title',
  credito: 'credit',
  autor: 'author',
  basado_en: 'source',
  borrador: 'date',
  contacto: 'contact',
};

/** La portada desde las propiedades de la nota. Listas y saltos de línea dan varias líneas. */
export function portadaDePropiedades(p: Record<string, unknown>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [prop, clave] of Object.entries(PORTADA)) {
    const v = p[prop];
    const lineas = (Array.isArray(v) ? v : typeof v === 'string' || typeof v === 'number' ? [v] : [])
      .flatMap((x) => String(x ?? '').split('\n'))
      .map((x) => x.trim())
      .filter(Boolean);
    if (lineas.length) out[clave] = lineas;
  }
  return out;
}

/** Los archivos de un proyecto nuevo cuando la vault no tiene la carpeta de plantillas: la ficha y el guion. */
export function proyectoMinimo(titulo: string, fecha: string): Record<string, string> {
  const t = JSON.stringify(titulo);
  return {
    '00 - Proyecto.md': `---\ncarpeta: proyecto\ntitulo: ${t}\n---\n\n# ${titulo}\n\nFicha del proyecto. Lo que se escribe en sus propiedades (renglones por página, diccionarios, categorías extra, requisitos) vale para todo el proyecto.\n`,
    '02 - Guion.md': `---\ncarpeta: guion\nproyecto: ${t}\n---\nTitle: ${titulo}\nCredit: Guion de\nAuthor:\nDraft date: ${fecha}\n\nINT. LUGAR - DÍA\n\nEscribe aquí la primera acción.\n`,
  };
}
