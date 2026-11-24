import { describe, expect, it } from 'vitest';
import { celdaDeTabla, construir, llenarTablaDePersonajes, opcionesDePersonaje, presentaciones, rangosDeEscenas, rellenoDePersonaje, tipoDeCelda, type Cambio } from '../src/motor';

const aplicar = (t: string, cs: Cambio[]) => [...cs].sort((a, b) => b.desde - a.desde).reduce((s, c) => s.slice(0, c.desde) + c.texto + s.slice(c.hasta), t);

const GUION = [
  'INT. RESTAURANTE - NOCHE',
  '',
  'En la cabecera, AURELIO (78), de bigote. A su derecha, su esposa MARÍA (65 años). Un POLICÍA ( 35 ) vigila.',
  'Afuera de MONTERREY (2026) llueve.',
  '',
  'AURELIO',
  'Tengo (30) problemas.',
  '',
  'INT. NOTARÍA - DÍA',
  '',
  'Entra EL NOTARIO (34). LA ESPOSA DE JOSÉ (30-35) espera.',
  '',
  'INT. CALLE - DÍA',
  '',
  'El Policía se va. Aurelio camina.',
  '',
  'ANA',
  'Adiós.',
  '',
].join('\n');

describe('presentaciones con edad', () => {
  it('lee el nombre en mayúsculas y la edad entre paréntesis de la acción, sin artículos ni años de calendario', () => {
    expect(presentaciones(construir(GUION).doc)).toEqual([
      { nombre: 'Aurelio', edad: '78' },
      { nombre: 'María', edad: '65' },
      { nombre: 'Policía', edad: '35' },
      { nombre: 'Notario', edad: '34' },
      { nombre: 'Esposa De José', edad: '30-35' },
    ]);
  });

  it('no junta lo que va antes de un punto o de una raya, ni cuenta cantidades: solo edades hasta 120', () => {
    const g = construir('INT. A - DÍA\n\nSe oye un PORTAZO. MARÍA (65) entra. FLASHBACK. AURELIO (40) ríe. INSERT - BETO (30) mira. Un BILLETE (500) cae. DR. RAMÍREZ (50) revisa.\n');
    expect(presentaciones(g.doc)).toEqual([
      { nombre: 'María', edad: '65' },
      { nombre: 'Aurelio', edad: '40' },
      { nombre: 'Beto', edad: '30' },
      { nombre: 'Dr. Ramírez', edad: '50' },
    ]);
  });

  it('acepta «(8 AÑOS)», «(30, cansada)», «(40s)» y nombres con «de la»', () => {
    const g = construir('INT. A - DÍA\n\nUna NIÑA (8 AÑOS) juega. ROSA (30, cansada) lava. TOÑO (40s) fuma. MARÍA de la LUZ (40) canta.\n');
    expect(presentaciones(g.doc)).toEqual([
      { nombre: 'Niña', edad: '8' },
      { nombre: 'Rosa', edad: '30' },
      { nombre: 'Toño', edad: '40s' },
      { nombre: 'María De La Luz', edad: '40' },
    ]);
  });

  it('si el personaje habla con un nombre más corto («AURELIO MÉNDEZ (78)» y luego AURELIO), es el mismo', () => {
    const g = construir('INT. A - DÍA\n\nAURELIO MÉNDEZ (78) entra. DON BETO (60) lo sigue.\n\nAURELIO\nHola.\n\nBETO\nQué tal.\n');
    expect(presentaciones(g.doc)).toEqual([
      { nombre: 'Aurelio', edad: '78' },
      { nombre: 'Beto', edad: '60' },
    ]);
    expect(g.breakdown[0].reparto).toEqual(['Aurelio', 'Beto']);
  });

  it('lo que el proyecto marca como «no es personaje» no cuenta, aunque se presente con edad', () => {
    const g = construir(GUION, { noSonPersonajes: ['policia'] });
    expect(g.breakdown[0].reparto).not.toContain('Policía');
    expect(g.breakdown[2].reparto).not.toContain('Policía');
  });

  it('quien se presenta con edad cuenta como reparto aunque no hable, donde se presenta y donde se le nombra', () => {
    const g = construir(GUION);
    expect(g.breakdown[0].reparto).toContain('Policía');
    expect(g.breakdown[1].reparto).toEqual(expect.arrayContaining(['Notario', 'Esposa De José']));
    expect(g.breakdown[2].reparto).toEqual(expect.arrayContaining(['Policía', 'Aurelio', 'Ana']));
    expect(g.breakdown[1].reparto).not.toContain('Policía');
  });
});

describe('propuesta de talento', () => {
  it('las escenas seguidas se juntan en rangos; dos seguidas no', () => {
    expect(rangosDeEscenas(['1', '3', '4', '5', '6', '9', '10', '12A'])).toBe('1, 3–6, 9, 10, 12A');
    expect(rangosDeEscenas([])).toBe('');
  });

  it('cada personaje con su edad (del guion; si no, de su ficha) y sus escenas, en el orden del reparto', () => {
    const g = construir(GUION);
    const o = opcionesDePersonaje(g, { edades: { ana: '30', aurelio: '80' }, orden: ['Ana'] });
    expect(o[0]).toEqual({ nombre: 'Ana', edad: '30', escenas: '3' });
    expect(o.find((x) => x.nombre === 'Aurelio')).toEqual({ nombre: 'Aurelio', edad: '78', escenas: '1, 3' });
    expect(o.find((x) => x.nombre === 'Policía')).toEqual({ nombre: 'Policía', edad: '35', escenas: '1, 3' });
  });

  const NOTA = [
    '## Reparto propuesto',
    '',
    '| Personaje | Edad del personaje | Actor o actriz | Escenas |',
    '|---|---|---|---|',
    '| — | — | — | — |',
    '| María | 60 | Rosa Gil | 1 |',
    '| Extra raro | — | Juan | — |',
    '| — | — | — | — |',
    '',
    '## Personaje 1',
    '',
    '| Dato | Valor |',
    '|---|---|',
    '| Personaje | — |',
    '| Edad del personaje | — |',
    '| Actor o actriz | — |',
    '| Edad | — |',
    '',
    '| Personaje | Actor |',
    '|---|---|',
    '| — | — |',
  ].join('\n');
  const T1 = 2;
  const T2 = 11;
  const T3 = 18;

  it('abre la lista de personajes en la tabla de talento y en el «Dato | Valor» del personaje, no en cualquier tabla', () => {
    expect(tipoDeCelda(celdaDeTabla(NOTA, T1, 0, 0)!, NOTA, T1)).toBe('personaje');
    expect(tipoDeCelda(celdaDeTabla(NOTA, T1, 0, 2)!, NOTA, T1)).toBeNull();
    expect(tipoDeCelda(celdaDeTabla(NOTA, T2, 0, 1)!, NOTA, T2)).toBe('personaje');
    expect(tipoDeCelda(celdaDeTabla(NOTA, T2, 0, 0)!, NOTA, T2)).toBeNull();
    expect(tipoDeCelda(celdaDeTabla(NOTA, T2, 2, 1)!, NOTA, T2)).toBeNull();
    expect(tipoDeCelda(celdaDeTabla(NOTA, T3, 0, 0)!, NOTA, T3)).toBeNull();
  });

  const aurelio = { nombre: 'Aurelio', edad: '78', escenas: '1, 3' };

  it('al elegir un personaje se llenan su edad y sus escenas en la fila; el actor no se toca', () => {
    const t = aplicar(NOTA, rellenoDePersonaje(NOTA, T1, 1, 0, aurelio));
    expect(t.split('\n')[5]).toBe('| Aurelio | 78 | Rosa Gil | 1, 3 |');
    const t2 = aplicar(NOTA, rellenoDePersonaje(NOTA, T2, 0, 1, aurelio));
    expect(t2.split('\n').slice(13, 16)).toEqual(['| Personaje | Aurelio |', '| Edad del personaje | 78 |', '| Actor o actriz | — |']);
    // Otro personaje sin edad conocida no se queda con la del anterior.
    const t3 = aplicar(NOTA, rellenoDePersonaje(NOTA, T1, 1, 0, { nombre: 'Beto', edad: '', escenas: '2' }));
    expect(t3.split('\n')[5]).toBe('| Beto | — | Rosa Gil | 2 |');
    // El mismo personaje sin edad conocida conserva la que ya tenía.
    const t4 = aplicar(NOTA, rellenoDePersonaje(NOTA, T1, 1, 0, { nombre: 'María', edad: '', escenas: '1' }));
    expect(t4.split('\n')[5]).toBe('| María | 60 | Rosa Gil | 1 |');
  });

  it('«Llenar toda la tabla»: una fila por personaje, conserva el actor ya escrito y lo que no es del guion, y quita las filas vacías', () => {
    const opciones = [aurelio, { nombre: 'María', edad: '65', escenas: '1' }, { nombre: 'Ana', edad: '', escenas: '3' }];
    const t = aplicar(NOTA, llenarTablaDePersonajes(NOTA, T1, opciones));
    expect(t.split('\n').slice(2, 9)).toEqual([
      '| Personaje | Edad del personaje | Actor o actriz | Escenas |',
      '|---|---|---|---|',
      '| Aurelio | 78 | — | 1, 3 |',
      '| María | 65 | Rosa Gil | 1 |',
      '| Ana | — | — | 3 |',
      '| Extra raro | — | Juan | — |',
      '',
    ]);
    // Lo demás de la nota no se mueve.
    expect(t.split('\n').slice(9)).toEqual(NOTA.split('\n').slice(9));
  });

  it('«Llenar toda la tabla» reconoce [[enlaces]] y negritas, y deja juntas las filas repetidas de un personaje', () => {
    const nota = [
      '| Personaje | Edad del personaje | Actor o actriz | Escenas |',
      '|---|---|---|---|',
      '| Aurelio | 78 | Candidato A | 1 |',
      '| [[María]] | — | Rosa Gil | — |',
      '| **Aurelio** | — | Candidato B | — |',
    ].join('\n');
    const t = aplicar(nota, llenarTablaDePersonajes(nota, 0, [aurelio, { nombre: 'María', edad: '65', escenas: '1' }]));
    expect(t.split('\n').slice(2)).toEqual(['| Aurelio | 78 | Candidato A | 1, 3 |', '| **Aurelio** | 78 | Candidato B | 1, 3 |', '| [[María]] | 65 | Rosa Gil | 1 |']);
  });
});
