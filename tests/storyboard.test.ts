import { describe, expect, it } from 'vitest';
import { armarStoryboard, cambiarVineta, estadoStoryboard, insertarDibujo, LISTAS_TECNICAS, leerId, vinetasDeTecnico, type Cambio } from '../src/motor';

const aplicar = (t: string, cs: Cambio[]) => [...cs].sort((a, b) => b.desde - a.desde).reduce((s, c) => s.slice(0, c.desde) + c.texto + s.slice(c.hasta), t);

const TECNICO = [
  '## Resumen',
  '',
  '| Esc. | Set | Planos | Duración |',
  '|---:|---|---:|---:|',
  '| 1 | — | — | — |',
  '',
  '## Abreviaturas',
  '',
  '| Abreviatura | Plano |',
  '|---|---|',
  '| P.G. | Plano general |',
  '',
  '## Escena 1',
  '',
  '| Escena | N. de plano | Plano | Descripción técnica | Acciones | Diálogos | Sonido | Duración | Tiempo total |',
  '|---:|---:|---|---|---|---|---|---:|---:|',
  '| 1 | 1 | P.G. Restaurante | 24 mm · steadicam · normal | Aurelio entra | — | Ambiente | 0:06 | — |',
  '| 1 | 2 | P.M.C. | 50 mm · picada | Aurelio sonríe | AURELIO: Hola. | — | 0:04 | — |',
  '',
  '## Escena 2',
  '',
  '| Escena | N. de plano | Plano | Lente | Movimiento | Acciones |',
  '|---|---|---|---|---|---|',
  '| 2 | 1 | P.P. | 85 mm | fija | María llora |',
  '| — | — | — | — | — | — |',
  '',
].join('\n');

const V = vinetasDeTecnico(TECNICO, LISTAS_TECNICAS);

describe('viñetas del guion técnico', () => {
  it('lee el número de viñeta en sus formas', () => {
    expect(leerId('E1 · P1')).toEqual({ escena: '1', numero: '1' });
    expect(leerId('E12A·P3')).toEqual({ escena: '12A', numero: '3' });
    expect(leerId('e1 p2')).toEqual({ escena: '1', numero: '2' });
    expect(leerId('Escena 1')).toBeNull();
    // Palabras que empiezan con E y tienen una P no son viñetas.
    for (const palabra of ['Equipo', 'Ejemplo', 'Espacio', 'El plano', 'Entrada principal', 'Escenas pendientes']) expect(leerId(palabra)).toBeNull();
    expect(leerId('E1 · P1.1')).toEqual({ escena: '1', numero: '1.1' });
    expect(leerId('E2BIS · P1')).toEqual({ escena: '2BIS', numero: '1' });
  });

  it('una viñeta por plano, con lente, movimiento y ángulo de la descripción técnica o de sus columnas', () => {
    expect(V).toEqual([
      { id: 'E1 · P1', escena: '1', numero: '1', plano: 'P.G. Restaurante', lente: '24 mm', angulo: 'normal', movimiento: 'steadicam', accion: 'Aurelio entra', dialogo: '', sonido: 'Ambiente' },
      { id: 'E1 · P2', escena: '1', numero: '2', plano: 'P.M.C.', lente: '50 mm', angulo: 'picada', movimiento: '', accion: 'Aurelio sonríe', dialogo: 'AURELIO: Hola.', sonido: '' },
      { id: 'E2 · P1', escena: '2', numero: '1', plano: 'P.P.', lente: '85 mm', angulo: '', movimiento: 'fija', accion: 'María llora', dialogo: '', sonido: '' },
    ]);
  });

  it('lo que se cambia en la viñeta se escribe en su fila del guion técnico', () => {
    const lineas = (t: string) => t.split('\n');
    expect(lineas(aplicar(TECNICO, cambiarVineta(TECNICO, 'E1 · P2', 'movimiento', 'paneo', LISTAS_TECNICAS)))[17]).toBe(
      '| 1 | 2 | P.M.C. | 50 mm · paneo · picada | Aurelio sonríe | AURELIO: Hola. | — | 0:04 | — |',
    );
    expect(lineas(aplicar(TECNICO, cambiarVineta(TECNICO, 'E2 · P1', 'lente', '35 mm', LISTAS_TECNICAS)))[23]).toBe('| 2 | 1 | P.P. | 35 mm | fija | María llora |');
    expect(lineas(aplicar(TECNICO, cambiarVineta(TECNICO, 'E1 · P1', 'accion', 'Entra | sale', LISTAS_TECNICAS)))[16]).toBe(
      '| 1 | 1 | P.G. Restaurante | 24 mm · steadicam · normal | Entra \\| sale | — | Ambiente | 0:06 | — |',
    );
    expect(lineas(aplicar(TECNICO, cambiarVineta(TECNICO, 'E1 · P2', 'dialogo', '', LISTAS_TECNICAS)))[17]).toBe('| 1 | 2 | P.M.C. | 50 mm · picada | Aurelio sonríe | — | — | 0:04 | — |');
    // La barra va escapada en la tabla, pero la viñeta la lee limpia.
    const conBarra = aplicar(TECNICO, cambiarVineta(TECNICO, 'E1 · P1', 'accion', 'Entra | sale', LISTAS_TECNICAS));
    expect(vinetasDeTecnico(conBarra, LISTAS_TECNICAS)[0].accion).toBe('Entra | sale');
    // Una viñeta que no existe, o un dato sin columna donde escribirlo, no cambia nada.
    expect(cambiarVineta(TECNICO, 'E9 · P1', 'plano', 'P.G.', LISTAS_TECNICAS)).toEqual([]);
    // En su propia columna se cambia el valor conocido y se conserva lo demás.
    const largo = TECNICO.replace('| 2 | 1 | P.P. | 85 mm | fija | María llora |', '| 2 | 1 | P.P. | 85 mm | paneo lento siguiendo a Ana | María llora |');
    expect(lineas(aplicar(largo, cambiarVineta(largo, 'E2 · P1', 'movimiento', 'tilt', LISTAS_TECNICAS)))[23]).toBe('| 2 | 1 | P.P. | 85 mm | tilt lento siguiendo a Ana | María llora |');
    expect(cambiarVineta(TECNICO, 'E2 · P1', 'angulo', 'picada', LISTAS_TECNICAS)).toEqual([]);
  });
});

const PLANTILLA = [
  '---',
  'carpeta: storyboard',
  '---',
  '',
  '# Storyboard',
  '',
  '%%',
  'GUÍA',
  '%%',
  '',
  '## Escena 1',
  '',
  '### E1 · P1',
  '',
  '%% Viñeta: `![[Mi corto - E1 P1.excalidraw]]` %%',
  '',
  '| Plano | Lente | Ángulo | Movimiento | Acción | Sonido y diálogo |',
  '|---|---|---|---|---|---|',
  '| — | — | — | — | — | — |',
  '',
  '### E1 · P2',
  '',
  '%% Viñeta: `![[Mi corto - E1 P2.excalidraw]]` %%',
  '',
  '| Plano | Lente | Ángulo | Movimiento | Acción | Sonido y diálogo |',
  '|---|---|---|---|---|---|',
  '| — | — | — | — | — | — |',
  '',
].join('\n');

describe('armar el storyboard', () => {
  it('desde la plantilla: una sección por plano con su bloque, sin las tablas vacías ni las pistas, y el botón arriba', () => {
    const r = armarStoryboard(PLANTILLA, V);
    expect(r.texto).toBe(
      [
        '---',
        'carpeta: storyboard',
        '---',
        '',
        '# Storyboard',
        '',
        '%%',
        'GUÍA',
        '%%',
        '',
        '```carpeta-storyboard',
        '```',
        '',
        '## Escena 1',
        '',
        '### E1 · P1',
        '',
        '```carpeta-vineta',
        'E1 · P1',
        '```',
        '',
        '### E1 · P2',
        '',
        '```carpeta-vineta',
        'E1 · P2',
        '```',
        '',
        '## Escena 2',
        '',
        '### E2 · P1',
        '',
        '```carpeta-vineta',
        'E2 · P1',
        '```',
        '',
      ].join('\n'),
    );
    expect(r.nuevas).toBe(3);
    // Armarlo otra vez no cambia nada.
    expect(armarStoryboard(r.texto, V).texto).toBe(r.texto);
  });

  it('conserva los dibujos, lo escrito a mano y lo que no es del storyboard; los planos que ya no están van aparte', () => {
    const nota = [
      '# Storyboard',
      '',
      '```carpeta-storyboard',
      '```',
      '',
      '## Escena 1',
      '',
      'Notas de la escena: luz cálida.',
      '',
      '### E1 · P1',
      '',
      '![[PAPA - E1 P1.excalidraw]]',
      '',
      '```carpeta-vineta',
      'E1 · P1',
      '```',
      '',
      '### E1 · P2',
      '',
      '| Plano | Lente | Ángulo | Movimiento | Acción | Sonido y diálogo |',
      '|---|---|---|---|---|---|',
      '| P.M.C. | 50 mm | picada | — | Sonríe | — |',
      '',
      '## Escena 3',
      '',
      '### E3 · P1',
      '',
      '![[viejo.excalidraw]]',
      '',
      '## Notas',
      '',
      'Pendiente: escanear.',
      '',
    ].join('\n');
    const r = armarStoryboard(nota, V);
    const t = r.texto;
    expect(t).toContain('Notas de la escena: luz cálida.\n\n### E1 · P1\n\n![[PAPA - E1 P1.excalidraw]]\n\n```carpeta-vineta\nE1 · P1\n```');
    expect(t.match(/```carpeta-vineta\nE1 · P1/g)).toHaveLength(1);
    // La tabla escrita a mano se queda y no se le agrega el bloque.
    expect(t).toContain('### E1 · P2\n\n| Plano | Lente | Ángulo | Movimiento | Acción | Sonido y diálogo |\n|---|---|---|---|---|---|\n| P.M.C. | 50 mm | picada | — | Sonríe | — |');
    expect(t).not.toContain('```carpeta-vineta\nE1 · P2');
    expect(t).toContain('## Escena 2\n\n### E2 · P1\n\n```carpeta-vineta\nE2 · P1\n```');
    expect(t).toContain('## Planos que ya no están en el guion técnico\n\n### E3 · P1\n\n![[viejo.excalidraw]]');
    expect(t).not.toContain('## Escena 3');
    expect(t.endsWith('## Notas\n\nPendiente: escanear.\n')).toBe(true);
    expect(t.match(/```carpeta-storyboard/g)).toHaveLength(1);
    expect(r).toMatchObject({ nuevas: 1, aMano: 1, huerfanas: 1 });
    expect(armarStoryboard(t, V).texto).toBe(t);
    expect(estadoStoryboard(t, V)).toEqual({ planos: 3, armadas: 3, conDibujo: 1, faltan: 0, huerfanas: 1 });
    expect(estadoStoryboard(PLANTILLA, V)).toEqual({ planos: 3, armadas: 0, conDibujo: 0, faltan: 1, huerfanas: 0 });
  });

  it('un plano que ya no está y no tiene nada tuyo (solo la plantilla o su bloque) se quita, no va a «ya no están»', () => {
    const r = armarStoryboard(armarStoryboard(PLANTILLA, V).texto, V.filter((v) => v.id === 'E1 · P2'));
    expect(r.texto).not.toContain('E1 · P1');
    expect(r.texto).not.toContain('Planos que ya no están');
    expect(r.texto).not.toContain('E2 · P1');
    expect(r.huerfanas).toBe(0);
  });

  it('el dibujo nuevo va justo arriba del bloque de su viñeta', () => {
    const t = armarStoryboard(PLANTILLA, V).texto;
    const con = aplicar(t, insertarDibujo(t, 'E1 · P2', 'PAPA - E1 P2.excalidraw'));
    expect(con).toContain('### E1 · P2\n\n![[PAPA - E1 P2.excalidraw]]\n\n```carpeta-vineta\nE1 · P2\n```');
    expect(insertarDibujo(t, 'E9 · P1', 'x.excalidraw')).toEqual([]);
  });

  it('nunca pierde lo escrito bajo una escena que ya no está, ni lo suelto entre los planos que ya no están', () => {
    const nota = [
      '## Escena 01',
      '',
      'Luz de tarde.',
      '',
      '## Escena 3',
      '',
      'Notas de la escena 3.',
      '![[moodboard.png]]',
      '',
      '## Planos que ya no están en el guion técnico',
      '',
      'Recordar: revisar con el profe.',
      '',
    ].join('\n');
    const t = armarStoryboard(nota, V).texto;
    expect(t).toContain('## Escena 1\n\nLuz de tarde.\n\n### E1 · P1');
    expect(t).toContain('Notas de la escena 3.\n![[moodboard.png]]');
    expect(t).toContain('Recordar: revisar con el profe.');
    expect(armarStoryboard(t, V).texto).toBe(t);
  });

  it('un encabezado de escena con texto se conserva, y un apartado entre escenas no parte el storyboard', () => {
    const nota = [
      '## Escena 2: Casa de María',
      '',
      '### E2 · P1',
      '',
      '![[dibujo21.excalidraw]]',
      '',
      '## Notas',
      '',
      'Algo.',
      '',
      '## Escena 1',
      '',
      '### E1 · P1',
      '',
      '![[dibujo11.excalidraw]]',
      '',
    ].join('\n');
    const t = armarStoryboard(nota, V).texto;
    expect(t).toContain('## Escena 2: Casa de María\n\n### E2 · P1\n\n![[dibujo21.excalidraw]]');
    expect(t).toContain('### E1 · P1\n\n![[dibujo11.excalidraw]]');
    expect(t.match(/### E2 · P1/g)).toHaveLength(1);
    expect(t.match(/### E1 · P1/g)).toHaveLength(1);
    expect(t).toContain('## Notas\n\nAlgo.');
    expect(armarStoryboard(t, V).texto).toBe(t);
  });

  it('planos con números como «1.1», «**3**» o escenas «2 bis» no se duplican al volver a armar', () => {
    const tec = '| Escena | N. de plano | Plano |\n|---|---|---|\n| 1 | 1.1 | P.G. |\n| 1 | **3** | P.M. |\n| 2 bis | 1 | P.P. |\n';
    const vs = vinetasDeTecnico(tec, LISTAS_TECNICAS);
    expect(vs.map((v) => v.id)).toEqual(['E1 · P1.1', 'E1 · P3', 'E2BIS · P1']);
    const una = armarStoryboard('# Storyboard\n', vs).texto;
    expect(armarStoryboard(una, vs).texto).toBe(una);
    expect(una.match(/### /g)).toHaveLength(3);
  });
});
