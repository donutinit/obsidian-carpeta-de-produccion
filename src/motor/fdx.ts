import { resolverConfig, type Config } from './config';
import { analizarEnLinea } from './enlinea';
import { analizar, PREFIJO_ESCENA } from './fountain';
import { normalizarParrafo } from './teclado';
import type { Elemento, TipoElemento } from './tipos';

/** Escapa para XML y quita lo que XML no admite (un salto de página pegado de un PDF hace que Final Draft rechace el archivo). */
// eslint-disable-next-line no-control-regex -- quita los caracteres de control que XML no admite
const esc = (s: string) => s.replace(/[\f\v]/g, ' ').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const desesc = (s: string) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_m, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

/** Los tramos del texto como `<Text>` con su estilo (negritas, cursivas, subrayado); las marcas dejan su texto. */
function textos(texto: string): string {
  // Tramos seguidos con el mismo estilo van en un solo <Text> (una marca no parte el texto).
  const runs: { estilo: string; t: string }[] = [];
  for (const s of analizarEnLinea(texto)) {
    if (!s.t) continue;
    const estilo = [s.b && 'Bold', s.i && 'Italic', s.u && 'Underline'].filter(Boolean).join('+');
    const ultimo = runs[runs.length - 1];
    if (ultimo && ultimo.estilo === estilo) ultimo.t += s.t;
    else runs.push({ estilo, t: s.t });
  }
  return runs.map((r) => (r.estilo ? `<Text Style="${r.estilo}">${esc(r.t)}</Text>` : `<Text>${esc(r.t)}</Text>`)).join('') || '<Text></Text>';
}

const TIPO_FDX: Partial<Record<TipoElemento, string>> = {
  encabezado: 'Scene Heading',
  accion: 'Action',
  personaje: 'Character',
  acotacion: 'Parenthetical',
  dialogo: 'Dialogue',
  letra: 'Lyrics',
  transicion: 'Transition',
  plano: 'Shot',
  centrado: 'General',
};
const DENTRO = new Set<TipoElemento>(['acotacion', 'dialogo', 'letra']);

/** Exporta a Final Draft (FDX), siempre limpio. */
export function exportarFDX(fuente: string, parcial: Partial<Config> = {}): string {
  const cfg = resolverConfig(parcial);
  const doc = analizar(fuente, { transiciones: cfg.diccionarios.transiciones, momentos: cfg.diccionarios.momentos });
  const bloques: { xml: string[]; dialogo: boolean; dual: boolean }[] = [];
  let nuevaPagina = false;
  let escena = 0;
  for (let i = 0; i < doc.elementos.length; i++) {
    const e: Elemento = doc.elementos[i];
    if (e.tipo === 'salto') {
      nuevaPagina = true;
      continue;
    }
    const tipo = TIPO_FDX[e.tipo];
    if (!tipo) continue;
    const attrs: string[] = [];
    if (nuevaPagina) attrs.push('StartsNewPage="Yes"');
    nuevaPagina = false;
    if (e.tipo === 'centrado') attrs.push('Alignment="Center"');
    attrs.push(`Type="${tipo}"`);
    if (e.tipo === 'encabezado') {
      const s = doc.escenas[escena++];
      attrs.push(`Number="${esc(s.numero)}"`);
      // Así, al volver a importar, solo los fijos quedan fijos (un FDX de otro programa no trae esta marca).
      attrs.push(`CarpetaFijo="${s.numeroFijo ? 'Yes' : 'No'}"`);
    }
    const xml = `<Paragraph ${attrs.join(' ')}>${textos(e.texto)}</Paragraph>`;
    const anterior = bloques[bloques.length - 1];
    if (DENTRO.has(e.tipo) && anterior?.dialogo) anterior.xml.push(xml);
    else bloques.push({ xml: [xml], dialogo: e.tipo === 'personaje', dual: !!e.dual });
  }
  // Diálogo dual: el bloque con «^» y el anterior van juntos en <DualDialogue>.
  const cuerpo: string[] = [];
  bloques.forEach((b, k) => {
    const previo = bloques[k - 1];
    if (b.dual && previo?.dialogo && !previo.dual) {
      cuerpo.pop();
      cuerpo.push(`<Paragraph><DualDialogue>${[...previo.xml, ...b.xml].join('')}</DualDialogue></Paragraph>`);
    } else cuerpo.push(b.xml.join('\n'));
  });
  const portada = ['title', 'credit', 'author', 'source', 'date', 'contact'].flatMap((k) =>
    (doc.portada[k] ?? []).map((v) => `<Paragraph Alignment="Center" Type="Title Page">${textos(v)}</Paragraph>`),
  );
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="no" ?>',
    '<FinalDraft DocumentType="Script" Template="No" Version="5">',
    '<Content>',
    ...cuerpo,
    '</Content>',
    ...(portada.length ? ['<TitlePage>', '<Content>', ...portada, '</Content>', '</TitlePage>'] : []),
    '</FinalDraft>',
    '',
  ].join('\n');
}

interface ParrafoFDX {
  tipo: string;
  texto: string;
  numero?: string;
  fijo: boolean;
  nueva: boolean;
  centrado: boolean;
  dual: boolean;
}

const atributos = (s: string) => Object.fromEntries([...s.matchAll(/([A-Za-z]+)="([^"]*)"/g)].map((m) => [m[1], desesc(m[2])]));

function conEstilo(t: string, estilo = ''): string {
  if (!t.trim()) return t;
  const [ini, medio, fin] = [t.match(/^\s*/)![0], t.trim(), t.match(/\s*$/)![0]];
  let x = medio;
  if (/Bold/.test(estilo) && /Italic/.test(estilo)) x = `***${x}***`;
  else if (/Bold/.test(estilo)) x = `**${x}**`;
  else if (/Italic/.test(estilo)) x = `*${x}*`;
  if (/Underline/.test(estilo)) x = `_${x}_`;
  return ini + x + fin;
}

const MAPA: Record<string, TipoElemento> = {
  'Scene Heading': 'encabezado',
  Action: 'accion',
  Character: 'personaje',
  Parenthetical: 'acotacion',
  Dialogue: 'dialogo',
  Lyrics: 'letra',
  Transition: 'transicion',
  Shot: 'plano',
};
const CREDITO = /^(guion|guión|escrito|written|screenplay|by|por|de)\b/i;

/** Importa un FDX de Final Draft como nota de guion. Lector propio: el motor no usa el DOM. */
export function importarFDX(xml: string): string {
  const parrafos: ParrafoFDX[] = [];
  const portada: string[] = [];
  const pila: { attrs: Record<string, string>; partes: string[]; notas: string[] }[] = [];
  let enPortada = false;
  let enContenido = false;
  let enDual = false;
  let notas: string[] | null = null;
  let marcaPropia = false;
  let personajesDual = 0;
  let estilo: string | null = null;
  for (const m of xml.matchAll(/<(\/?)([A-Za-z]+)\b([^>]*?)(\/?)>|([^<]+)/g)) {
    const [, cierre, nombre, attrs, solo, texto] = m;
    if (texto !== undefined) {
      if (estilo !== null && pila.length) pila[pila.length - 1].partes.push(conEstilo(desesc(texto), estilo));
      continue;
    }
    if (nombre === 'TitlePage') enPortada = !cierre;
    else if (nombre === 'Content') enContenido = !cierre;
    else if (nombre === 'ScriptNote') {
      // Las notas de Final Draft (comentarios del profe) se conservan como %%…%% en su párrafo.
      if (!cierre) notas = [];
      else {
        const texto = (notas ?? []).join(' ').replace(/%%/g, '%').trim();
        notas = null;
        if (texto && pila.length) pila[pila.length - 1].notas.push(`%%${texto}%%`);
      }
    } else if (nombre === 'DualDialogue') {
      enDual = !cierre;
      personajesDual = 0;
    } else if (nombre === 'Text') estilo = cierre || solo ? null : (atributos(attrs).Style ?? '');
    else if (nombre === 'Paragraph') {
      if (!cierre && !solo) pila.push({ attrs: atributos(attrs), partes: [], notas: [] });
      else if (cierre) {
        const p = pila.pop();
        if (!p) continue;
        const t = p.partes.join('') + p.notas.join('');
        if (notas) {
          if (t.trim()) notas.push(t.trim());
          continue;
        }
        if (enPortada) {
          // En Final Draft los párrafos de la portada no llevan Type; el encabezado y pie (HeaderAndFooter) no cuentan.
          if (enContenido && t.trim()) portada.push(t.trim());
          continue;
        }
        if (!p.attrs.Type) continue;
        if (p.attrs.CarpetaFijo) marcaPropia = true;
        const dual = enDual && p.attrs.Type === 'Character' && ++personajesDual === 2;
        parrafos.push({
          tipo: p.attrs.Type,
          texto: t,
          ...(p.attrs.Number ? { numero: p.attrs.Number } : {}),
          fijo: p.attrs.CarpetaFijo === 'Yes',
          nueva: p.attrs.StartsNewPage === 'Yes',
          centrado: p.attrs.Alignment === 'Center',
          dual,
        });
      }
    }
  }
  // Un FDX del plugin dice cuáles números eran fijos; en uno de otro programa, todos lo son.
  const hayFijos = marcaPropia;
  const lineas: string[] = [];
  let anterior: TipoElemento | null = null;
  for (const p of parrafos) {
    const tipo: TipoElemento = p.tipo === 'General' ? (p.centrado ? 'centrado' : 'accion') : (MAPA[p.tipo] ?? 'accion');
    const texto = p.texto.trim();
    if (p.nueva) lineas.push(...(lineas.length ? [''] : []), '===');
    const dentro = DENTRO.has(tipo) && anterior !== null && ['personaje', 'acotacion', 'dialogo', 'letra'].includes(anterior);
    if (!dentro && lineas.length) lineas.push('');
    let l: string;
    switch (tipo) {
      case 'encabezado': {
        const base = PREFIJO_ESCENA.test(texto) ? texto : '.' + texto;
        // Los números del plugin solo vuelven fijos si lo eran; los de otro programa, siempre.
        l = p.numero && (!hayFijos || p.fijo) ? `${base}#${p.numero}#` : base;
        break;
      }
      case 'personaje':
        l = (texto !== texto.toUpperCase() ? '@' : '') + texto + (p.dual ? ' ^' : '');
        break;
      case 'plano':
        l = '!!' + texto;
        break;
      case 'centrado':
        l = `>${texto}<`;
        break;
      case 'transicion':
      case 'acotacion':
      case 'letra':
      case 'accion':
        l = normalizarParrafo(texto, tipo);
        break;
      default:
        l = texto;
    }
    lineas.push(l);
    anterior = tipo;
  }
  const props = ['carpeta: guion'];
  if (portada.length) {
    props.push(`titulo: ${JSON.stringify(portada[0])}`);
    let resto = portada.slice(1);
    if (resto.length && CREDITO.test(resto[0])) {
      props.push(`credito: ${JSON.stringify(resto[0])}`);
      resto = resto.slice(1);
    }
    if (resto.length === 1) props.push(`autor: ${JSON.stringify(resto[0])}`);
    else if (resto.length > 1) props.push(`autor:\n${resto.map((r) => `  - ${JSON.stringify(r)}`).join('\n')}`);
  }
  return `---\n${props.join('\n')}\n---\n${lineas.join('\n')}\n`;
}
