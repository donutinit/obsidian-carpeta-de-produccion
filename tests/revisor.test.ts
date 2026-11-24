import { describe, expect, it } from 'vitest';
import { revisarGuion } from '../src/motor';

const reglas = (t: string) => revisarGuion(t).map((o) => o.regla);
const de = (t: string, regla: string) => revisarGuion(t).filter((o) => o.regla === regla);

describe('revisor de guion', () => {
  it('acción en pasado, pero no en el diálogo ni con palabras que solo lo parecen', () => {
    const t = 'INT. CASA - DÍA\n\nAURELIO pagó la fianza y José estaba en la sala. Los demás llegaron tarde.\n\nAURELIO\nYa pagó, ¿no?\n';
    const o = de(t, 'pasado');
    expect(o).toHaveLength(1);
    expect(o[0]).toMatchObject({ linea: 2, escena: 0 });
    expect(o[0].fragmento).toContain('pagó');
    expect(de('INT. CASA - DÍA\n\nEl día de la policía. MARÍA come pan de dulce con su alegría.\n', 'pasado')).toHaveLength(0);
    expect(de('INT. CASA - DÍA\n\nDeja los 250 pesos sobre el buró, junto al dominó.\n', 'pasado')).toHaveLength(0);
  });

  it('lo que va entre comillas en la acción (un mensaje, un letrero) no se revisa', () => {
    const t = 'INT. A - DÍA\n\nJOSÉ lee el mensaje: «Lo del restaurante se me fue de las manos». Un letrero dice "Aquí comió el rey".\n';
    expect(revisarGuion(t)).toEqual([]);
  });

  it('lo que la cámara no ve', () => {
    for (const s of ['AURELIO se da cuenta del error.', 'Podemos ver su cara.', 'MARÍA piensa en su hijo.', 'Lo mira como si fuera un niño.', 'Recuerda a su padre.'])
      expect(reglas(`INT. A - DÍA\n\n${s}\n`), s).toContain('camara');
    expect(reglas('INT. A - DÍA\n\nAURELIO se mira la mano.\n')).not.toContain('camara');
  });

  it('prosa: superlativos y adverbios de juicio', () => {
    for (const s of ['Cenan en uno de los restaurantes más fancys de Monterrey.', 'Aparentemente todo está bien.'])
      expect(reglas(`INT. A - DÍA\n\n${s}\n`), s).toContain('prosa');
  });

  it('diálogo narrado en la acción', () => {
    for (const s of ['Le dice que coma en su cuarto.', 'MARTÍN pregunta si ya comió.', 'La enfermera le pide que se calme.'])
      expect(reglas(`INT. A - DÍA\n\n${s}\n`), s).toContain('narrado');
  });

  it('acotación de acción a media réplica', () => {
    const t = 'INT. A - DÍA\n\nMARTÍN entra.\n\nMARTÍN\n¿Buen padre? (manotea en la mesa) ¡Por Dios!\n';
    expect(de(t, 'acotacion-dentro')).toHaveLength(1);
    expect(reglas('INT. A - DÍA\n\nMARTÍN entra.\n\nMARTÍN\n(furioso)\n¡Por Dios!\n')).not.toContain('acotacion-dentro');
  });

  it('un personaje con dos nombres', () => {
    const t = 'INT. A - DÍA\n\nDOÑA SHARIS y MARIA comen.\n\nDOÑA SHARIS\nHola.\n\nSHARIS\nAdiós.\n\nMARIA\nSí.\n\nMARÍA\nNo.\n';
    const o = de(t, 'nombres');
    expect(o.map((x) => x.fragmento).sort()).toEqual(['MARIA / MARÍA', 'SHARIS / DOÑA SHARIS']);
  });

  it('un personaje que habla sin haberlo presentado en mayúsculas en una acción; V.O. y O.S. también cuentan', () => {
    const t = 'INT. A - DÍA\n\nANA entra.\n\nANA\nHola.\n\nBETO (O.S.)\nAquí estoy.\n\nBETO\nYa voy.\n';
    const o = de(t, 'sin-presentar');
    expect(o).toHaveLength(1);
    expect(o[0].fragmento).toBe('BETO');
    expect(o[0].linea).toBe(7);
  });

  it('una escena que empieza con diálogo, sin describir el lugar', () => {
    const t = 'INT. A - DÍA\n\nANA entra.\n\nINT. B - NOCHE\n\nANA\nHola.\n';
    const o = de(t, 'sin-lugar');
    expect(o).toHaveLength(1);
    expect(o[0]).toMatchObject({ escena: 1, linea: 4 });
  });

  it('un guion limpio no tiene observaciones', () => {
    const t = 'INT. COCINA - NOCHE\n\nCocina pequeña con una mesa. ANA (30) lava los platos.\n\nANA\n(cansada)\nYa es tarde.\n\n> CORTE A:\n';
    expect(revisarGuion(t)).toEqual([]);
  });

  it('cada observación trae su explicación', () => {
    const [o] = revisarGuion('INT. A - DÍA\n\nPodemos ver su cara.\n');
    expect(o.mensaje.length).toBeGreaterThan(20);
  });
});

describe('revisión de 0.4: falsos positivos', () => {
  const nada = (t: string, regla: string) => expect(reglas(`INT. A - DÍA\n\n${t}\n`), t).not.toContain(regla);
  it('títulos distintos son personajes distintos', () => {
    const t = 'INT. A - DÍA\n\nEl SEÑOR LÓPEZ y la SEÑORA LÓPEZ comen.\n\nSEÑOR LÓPEZ\nHola.\n\nSEÑORA LÓPEZ\nAdiós.\n';
    expect(de(t, 'nombres')).toHaveLength(0);
  });
  it('prosa: solo el superlativo de una palabra; «una de esas sillas» no', () => {
    nada('Uno de los meseros trae más pan.', 'prosa');
    nada('Toma una de esas sillas.', 'prosa');
  });
  it('narrado: «la cuenta que» y «se da cuenta que» no son diálogo', () => {
    nada('Revisa la cuenta que le trae el mesero.', 'narrado');
    nada('Se da cuenta que llueve.', 'narrado');
  });
  it('pasado: guayaba, destraba, Sharon, bongó, popó, Miró', () => {
    nada('Come guayaba y destraba la puerta. Sharon toca el bongó junto al popó del perro y un cuadro de Miró.', 'pasado');
  });
  it('«como si nada» no es pensamiento', () => nada('Sigue caminando como si nada.', 'camara'));
  it('un año entre paréntesis dentro del diálogo no es acción', () => {
    expect(de('INT. A - DÍA\n\nANA entra.\n\nANA\nEl coche (de 1999) no arranca.\n', 'acotacion-dentro')).toHaveLength(0);
  });
  it('quien solo habla en V.O. no se presenta en pantalla', () => {
    expect(de('INT. A - DÍA\n\nAlgo pasa.\n\nNARRADOR (V.O.)\nEra otra época.\n', 'sin-presentar')).toHaveLength(0);
  });
});
