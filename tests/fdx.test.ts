import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { analizar, analizarEnLinea, exportarFDX, importarFDX, textoPlano } from '../src/motor';

const ORO = readFileSync('tests/fixtures/papa.md', 'utf8');
const F =
  '---\ncarpeta: guion\ntitulo: Prueba\nautor: Ana Pérez\n---\nINT. CASA - DÍA\n\nAna toma la {ut:taza}.\n\nANA (V.O.)\n(bajito)\nHola.\n\nBETO ^\nQué.\n\n' +
  '!!PRIMER PLANO DE LA TAZA\n\n~La la la\n\n>FIN<\n\n> CORTE A:\n\n===\n\nEXT. CALLE - NOCHE#5A#\n\nTom & Jerry <3 "hola" \'y\'.\n';

const plano = (fuente: string) =>
  analizar(fuente)
    .elementos.filter((e) => e.tipo !== 'seccion' && e.tipo !== 'sinopsis')
    .map((e) => [e.tipo, textoPlano(analizarEnLinea(e.texto.replace(/\n/g, ' '))), !!e.dual]);

describe('FDX', () => {
  it('exporta cada tipo con su Type', () => {
    const x = exportarFDX(F);
    expect(x).toMatch(/^<\?xml version="1.0" encoding="UTF-8" standalone="no" \?>\n<FinalDraft DocumentType="Script" Template="No" Version="5">/);
    for (const t of ['<Paragraph Type="Scene Heading" Number="A5A" CarpetaFijo="No"><Text>INT. CASA - DÍA</Text>', '<Paragraph Type="Action"><Text>Ana toma la taza.</Text>', '<Paragraph Type="Character"><Text>ANA (V.O.)</Text>', '<Paragraph Type="Parenthetical"><Text>(bajito)</Text>', '<Paragraph Type="Dialogue"><Text>Hola.</Text>', '<Paragraph Type="Shot"><Text>PRIMER PLANO DE LA TAZA</Text>', '<Paragraph Type="Lyrics"><Text>La la la</Text>', '<Paragraph Alignment="Center" Type="General"><Text>FIN</Text>', '<Paragraph Type="Transition"><Text>CORTE A:</Text>'])
      expect(x).toContain(t);
    expect(x).toContain('<Paragraph StartsNewPage="Yes" Type="Scene Heading" Number="5A" CarpetaFijo="Yes"><Text>EXT. CALLE - NOCHE</Text>');
    expect(x).toContain('<TitlePage>');
    expect(x).toContain('<Text>Prueba</Text>');
  });

  it('dual va en DualDialogue', () => {
    expect(exportarFDX(F)).toMatch(/<Paragraph><DualDialogue><Paragraph Type="Character"><Text>ANA \(V\.O\.\)<\/Text>[\s\S]*<Paragraph Type="Character"><Text>BETO<\/Text>[\s\S]*<\/DualDialogue><\/Paragraph>/);
  });

  it('escapa & < > y comillas', () => {
    expect(exportarFDX(F)).toContain('<Text>Tom &amp; Jerry &lt;3 &quot;hola&quot; &apos;y&apos;.</Text>');
  });

  it('ida y vuelta: exportar → importar da los mismos elementos', () => {
    const vuelta = importarFDX(exportarFDX(F));
    expect(plano(vuelta)).toEqual(plano(F));
    expect(analizar(vuelta).escenas.map((e) => [e.numero, e.numeroFijo ?? null])).toEqual([
      ['A5A', null],
      ['5A', '5A'],
    ]);
    expect(analizar(vuelta).portada).toMatchObject({ title: ['Prueba'], author: ['Ana Pérez'] });
    expect(plano(importarFDX(exportarFDX(ORO)))).toEqual(plano(ORO));
  });

  it('importa un FDX de Final Draft con Text partido en varios estilos y entidades', () => {
    const fdx = '<?xml version="1.0"?><FinalDraft><Content><Paragraph Type="Scene Heading" Number="3"><Text>INT. A - DÍA</Text></Paragraph><Paragraph Type="Action"><Text>Ana </Text><Text Style="Bold">corre</Text><Text> &amp; </Text><Text Style="Italic">salta</Text><Text>.</Text></Paragraph></Content></FinalDraft>';
    expect(importarFDX(fdx)).toBe('---\ncarpeta: guion\n---\nINT. A - DÍA#3#\n\nAna **corre** & *salta*.\n');
  });
});

describe('revisión fase 3: FDX', () => {
  it('I2: lee la portada de un FDX de Final Draft (párrafos sin Type) e ignora encabezado y pie', () => {
    const fdx = '<?xml version="1.0"?><FinalDraft DocumentType="Script"><Content><Paragraph Type="Scene Heading"><Text>INT. A - DÍA</Text></Paragraph></Content><TitlePage><HeaderAndFooter><Header><Paragraph><Text>.</Text></Paragraph></Header></HeaderAndFooter><Content><Paragraph Alignment="Center"><Text>La tragedia</Text></Paragraph><Paragraph Alignment="Center"><Text>by</Text></Paragraph><Paragraph Alignment="Center"><Text>William Shakespeare</Text></Paragraph></Content></TitlePage></FinalDraft>';
    expect(analizar(importarFDX(fdx)).portada).toMatchObject({ title: ['La tragedia'], credit: ['by'], author: ['William Shakespeare'] });
  });

  it('I3: la ida y vuelta de un guion sin números fijos no los fija', () => {
    expect(analizar(importarFDX(exportarFDX(ORO))).escenas.every((e) => !e.numeroFijo)).toBe(true);
  });

  it('I6: las notas <ScriptNote> de Final Draft se conservan como comentarios', () => {
    const fdx = '<FinalDraft><Content><Paragraph Type="Action"><ScriptNote><Paragraph><Text>Nota del profe</Text></Paragraph></ScriptNote><Text>Ana corre.</Text></Paragraph></Content></FinalDraft>';
    expect(importarFDX(fdx)).toContain('Ana corre.%%Nota del profe%%');
  });

  it('caracteres que XML no permite (salto de página pegado de un PDF) no rompen el archivo', () => {
    expect(exportarFDX('INT. A - DÍA\n\nAna\fcorre.\u0007\n')).toContain('<Text>Ana corre.</Text>');
  });
});
