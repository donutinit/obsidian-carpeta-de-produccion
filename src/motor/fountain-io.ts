import { resolverConfig, type Config } from './config';
import { escribirMarca } from './ediciones';
import { analizarEnLinea, MARCA, textoPlano } from './enlinea';
import { analizar, CLAVES_PORTADA } from './fountain';

/** Notas de Fountain `[[…]]` sin `]]` ni saltos dentro: se escapan `\`, salto, `[` y `]`. */
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\[/g, '\\[').replace(/\]/g, '\\]');
const desesc = (s: string) => s.replace(/\\(.)/g, (_m, c: string) => (c === 'n' ? '\n' : c));

const normalizar = (s: string) => String(s).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
const NUMERO = /\s*#([^#\s][^#]*)#\s*$/;
const FRONTMATTER = /^---\n([\s\S]*?)\n---(?:\n|$)/;

const TITULOS: [string, string][] = [
  ['title', 'Title'],
  ['credit', 'Credit'],
  ['author', 'Author'],
  ['source', 'Source'],
  ['date', 'Draft date'],
  ['contact', 'Contact'],
  ['notes', 'Notes'],
  ['copyright', 'Copyright'],
];

const visibleEnlace = (interior: string) => {
  const [ruta, alias] = interior.split(/\|(.*)/s);
  if (alias) return alias;
  return ruta.split('#')[0].split('/').pop() || ruta;
};

/** Líneas que solo tienen comentarios cerrados (`%%…%%`, `/*…*\/`): el motor las salta, aquí también. */
function transparentes(lineas: string[]): boolean[] {
  const texto = lineas.join('\n').replace(/%%[\s\S]*?%%|\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''));
  return texto.split('\n').map((l, k) => lineas[k].trim() !== '' && l.trim() === '');
}

/** El bloque Title: del cuerpo, [inicio, fin): como el motor, salta líneas vacías o de solo comentario. */
function bloquePortada(lineas: string[]): [number, number] | null {
  const tr = transparentes(lineas);
  const vacia = (k: number) => !lineas[k].trim() || tr[k];
  let i = 0;
  while (i < lineas.length && vacia(i)) i++;
  const m = lineas[i]?.match(/^([^:]{2,20}):/);
  if (!m || !CLAVES_PORTADA[m[1].trim().toLowerCase()]) return null;
  let j = i;
  while (j < lineas.length && (lineas[j].trim() || tr[j])) j++;
  while (j < lineas.length && !lineas[j].trim()) j++;
  return [i, j];
}

/** Escapa un campo de nota `cp:` (también el «|» que separa campos). */
const escCampo = (s: string) => esc(s).replace(/\|/g, '\\|');
/** Parte los campos de una nota `cp:` respetando los escapes, y los des-escapa. */
function campos(s: string): string[] {
  const out: string[] = [];
  let actual = '';
  for (let k = 0; k < s.length; k++) {
    const c = s[k];
    if (c === '\\' && k + 1 < s.length) {
      actual += c + s[++k];
    } else if (c === '|') {
      out.push(actual);
      actual = '';
    } else actual += c;
  }
  out.push(actual);
  return out.map(desesc);
}

/**
 * Exporta el guion a Fountain. Limpio: sin marcas, comentarios, enlaces ni planos, para otras apps.
 * Completo: todo viaja en notas `[[cp…]]` que otras apps no imprimen e `importarFountain` vuelve a convertir.
 * El orden es el del motor: comentarios (cerrados), luego enlaces, luego marcas.
 */
export function exportarFountain(fuente: string, modo: 'limpio' | 'completo', parcial: Partial<Config> = {}): string {
  const src = normalizar(fuente);
  const cfg = resolverConfig(parcial);
  const doc = analizar(src, { transiciones: cfg.diccionarios.transiciones, momentos: cfg.diccionarios.momentos });
  const lineas = src.split('\n');
  // Números de escena: con un marcador que el resto del proceso no toca. En completo, los automáticos se señalan.
  for (const e of doc.escenas) {
    const base = lineas[e.linea].replace(NUMERO, '');
    const auto = modo === 'completo' && !e.numeroFijo ? '\u0004' : '';
    lineas[e.linea] = `${base}${auto}\u0001${e.numero}\u0001`;
  }
  const fm = src.match(FRONTMATTER);
  const cuerpoLineas = lineas.slice(fm ? fm[0].split('\n').length - 1 : 0);
  const portadaVieja = bloquePortada(cuerpoLineas);
  let portadaCruda = '';
  if (portadaVieja) portadaCruda = cuerpoLineas.splice(portadaVieja[0], portadaVieja[1] - portadaVieja[0]).join('\n').trimEnd();

  // Comentarios, boneyard y enlaces se vuelven marcadores de uso privado; las marcas se leen después.
  const fichas: { tipo: 'com' | 'hueso' | 'enl'; crudo: string }[] = [];
  const ficha = (tipo: 'com' | 'hueso' | 'enl') => (crudo: string) => {
    fichas.push({ tipo, crudo });
    return String.fromCharCode(0xe000 + fichas.length - 1);
  };
  const MARCADOR = /[\uE000-\uF8FF]/g;
  const crudo = (t: string): string => t.replace(MARCADOR, (c) => crudo(fichas[c.charCodeAt(0) - 0xe000].crudo));
  const expandir = (t: string): string =>
    t.replace(MARCADOR, (c) => {
      const f = fichas[c.charCodeAt(0) - 0xe000];
      if (f.tipo === 'enl') {
        const interior = f.crudo.slice(2, -2);
        return modo === 'limpio' ? visibleEnlace(interior) : `${visibleEnlace(interior)}[[cp-enlace:${esc(interior)}]]`;
      }
      if (modo === 'limpio') return '\u0000';
      return f.tipo === 'com' ? `[[cp${esc(f.crudo)}]]` : crudo(f.crudo);
    });
  let cuerpo = cuerpoLineas
    .join('\n')
    .replace(/%%[\s\S]*?%%/g, ficha('com'))
    .replace(/\/\*[\s\S]*?\*\//g, ficha('hueso'))
    .replace(/\[\[[^\]\n]*\]\]/g, ficha('enl'));
  cuerpo = cuerpo.replace(new RegExp(MARCA.source, 'g'), (_m, cat: string, texto: string, nombre?: string, cantidad?: string) => {
    if (modo === 'limpio') return expandir(texto);
    const tx = crudo(texto);
    return `${expandir(texto)}[[cp:${cat}|${escCampo(tx)}|${escCampo((nombre ?? tx).trim())}|${cantidad ?? 1}]]`;
  });
  cuerpo = expandir(cuerpo);

  let salida = cuerpo.split('\n').flatMap((l) => {
    // Una línea que solo tenía comentarios desaparece (igual que en la página).
    // eslint-disable-next-line no-control-regex -- marcador interno que no puede aparecer en un guion
    if (l.includes('\u0000') && !l.replace(/\u0000/g, '').trim()) return [];
    // eslint-disable-next-line no-control-regex -- marcador interno que no puede aparecer en un guion
    let x = l.includes('\u0000') ? l.replace(/[ \t]*\u0000/g, '').trimEnd() : l;
    const plano = x.match(/^(\s*)!!(.*)$/);
    if (plano) x = modo === 'limpio' ? `${plano[1]}!${plano[2].toUpperCase()}` : `${plano[1]}!${plano[2]}[[cp:plano]]`;
    // eslint-disable-next-line no-control-regex -- marcador interno que no puede aparecer en un guion
    return [x.replace(/\s*\u0001([^\u0001]*)\u0001/, (_m, n: string) => ` #${n}#`).replace('\u0004', '[[cp-auto]]')];
  });
  while (salida.length && !salida[0].trim()) salida.shift();

  const portada: string[] = [];
  for (const [clave, titulo] of TITULOS) {
    const valores = (doc.portada[clave] ?? []).map((v) => textoPlano(analizarEnLinea(v)).trim()).filter(Boolean);
    if (valores.length === 1) portada.push(`${titulo}: ${valores[0]}`);
    else if (valores.length > 1) portada.push(`${titulo}:`, ...valores.map((v) => `    ${v}`));
  }
  if (modo === 'completo') {
    // La portada del cuerpo y las propiedades viajan tal cual; la portada Fountain de arriba es para otras apps.
    const notas = [...(fm ? [`[[cp-propiedades:${esc(fm[1])}]]`] : []), ...(portadaCruda ? [`[[cp-portada:${esc(portadaCruda)}]]`] : [])];
    if (notas.length) salida = [...notas, '', ...salida];
  }
  const texto = (portada.length ? portada.join('\n') + '\n\n' : '') + salida.join('\n');
  return texto.endsWith('\n') ? texto : texto + '\n';
}

const PROPIEDAD_PORTADA: Record<string, string> = {
  title: 'titulo',
  credit: 'credito',
  author: 'autor',
  authors: 'autor',
  source: 'basado_en',
  'draft date': 'borrador',
  contact: 'contacto',
};

function yamlPortada(props: Record<string, string[]>): string {
  return Object.entries(props)
    .map(([k, v]) => (v.length === 1 ? `${k}: ${JSON.stringify(v[0])}` : `${k}:\n${v.map((x) => `  - ${JSON.stringify(x)}`).join('\n')}`))
    .join('\n');
}

/** Claves de portada que el motor lee en el cuerpo además de las seis que van a propiedades. */
const OTRAS_PORTADA = new Set(['notes', 'notas', 'copyright']);

/** Convierte un `.fountain` en una nota de guion. Las notas `[[cp…]]` vuelven a su forma; las ajenas, a `%%…%%`. */
export function importarFountain(texto: string): string {
  let lineas = normalizar(texto).split('\n');
  // Lo que viene de una exportación completa: propiedades y portada del cuerpo tal cual.
  const nota = (prefijo: string) => {
    const k = lineas.findIndex((l) => l.startsWith(`[[${prefijo}:`));
    if (k < 0) return null;
    const v = desesc(lineas[k].slice(prefijo.length + 3).replace(/\]\]\s*$/, ''));
    lineas.splice(k, lineas[k + 1]?.trim() === '' ? 2 : 1);
    return v;
  };
  const yaml = nota('cp-propiedades');
  const portadaCruda = nota('cp-portada');
  const propia = yaml !== null || portadaCruda !== null;

  // Portada Fountain: las seis claves conocidas van a propiedades; Notes y Copyright se quedan en el cuerpo
  // (el motor las lee) y las demás (Revision, Episode…) en un comentario, para que no se impriman como acción.
  const props: Record<string, string[]> = {};
  const otras: string[] = [];
  const ocultas: string[] = [];
  const bloque = bloquePortada(lineas);
  if (bloque) {
    let actual: string | null = null;
    let destino: string[] | null = null;
    for (const l of lineas.slice(bloque[0], bloque[1])) {
      if (!l.trim()) continue;
      const m = l.match(/^([^:\s][^:]{1,19}):\s*(.*)$/);
      if (m && !/^\s/.test(l)) {
        const clave = m[1].trim().toLowerCase();
        const p = PROPIEDAD_PORTADA[clave];
        actual = p ?? null;
        destino = null;
        if (p) props[p] = m[2].trim() ? [m[2].trim()] : [];
        else (destino = OTRAS_PORTADA.has(clave) ? otras : ocultas).push(l);
      } else if (actual) props[actual].push(l.trim());
      else (destino ?? ocultas).push(l);
    }
    lineas = lineas.slice(bloque[1]);
  }
  let cuerpo = lineas.join('\n');
  if (propia) cuerpo = (portadaCruda ? portadaCruda + '\n\n' : '') + cuerpo;
  else {
    const extra = [...otras, ...ocultas.map((l) => `%%${l.replace(/%%/g, '%')}%%`)];
    if (extra.length) cuerpo = extra.join('\n') + '\n\n' + cuerpo;
  }

  const NOTA = /\[\[((?:\\.|[^\]\\])*)\]\]/g;
  let out = '';
  let fin = 0;
  for (const m of cuerpo.matchAll(NOTA)) {
    out += cuerpo.slice(fin, m.index);
    fin = (m.index ?? 0) + m[0].length;
    const n = m[1];
    if (n.startsWith('cp%%')) out += desesc(n.slice(2));
    else if (n === 'cp:plano') out += '\u0003';
    else if (n === 'cp-auto') out += '\u0002';
    else if (n.startsWith('cp-enlace:')) {
      const interior = desesc(n.slice('cp-enlace:'.length));
      const visible = visibleEnlace(interior);
      if (out.endsWith(visible)) out = out.slice(0, out.length - visible.length);
      out += `[[${interior}]]`;
    } else if (n.startsWith('cp:')) {
      const [cat, tx, nombre, cantidad] = campos(n.slice(3));
      if (out.endsWith(tx)) out = out.slice(0, out.length - tx.length);
      out += escribirMarca(cat, tx, nombre, Number(cantidad) || 1);
    } else out += `%%${n}%%`;
  }
  out += cuerpo.slice(fin);
  let ls = out.split('\n').map((l) => {
    let x = l;
    // eslint-disable-next-line no-control-regex -- marcador interno que no puede aparecer en un guion
    if (x.includes('\u0002')) x = x.replace(/\u0002/g, '').replace(NUMERO, '');
    // eslint-disable-next-line no-control-regex -- marcador interno que no puede aparecer en un guion
    if (x.includes('\u0003')) x = x.replace(/\u0003/g, '').replace(/^(\s*)!/, '$1!!');
    return x;
  });
  // Números fijos pegados al encabezado: con espacio, Obsidian los tomaría como etiquetas.
  for (const e of analizar(ls.join('\n')).escenas) ls[e.linea] = ls[e.linea].replace(/\s+(#[^#\s][^#]*#)\s*$/, '$1');
  while (ls.length && !ls[0].trim()) ls.shift();
  ls = ls.length && ls[ls.length - 1] === '' ? ls : [...ls, ''];
  let fmTexto = yaml ?? ['carpeta: guion', propia ? '' : yamlPortada(props)].filter(Boolean).join('\n');
  if (!/^carpeta:\s*["']?guion/m.test(fmTexto)) fmTexto = 'carpeta: guion\n' + fmTexto;
  return `---\n${fmTexto}\n---\n${ls.join('\n')}`;
}
