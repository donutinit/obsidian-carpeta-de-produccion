import { Modal, Notice, Setting, type App, type TFile } from 'obsidian';
import { agregarOculto, escenaPorFirma, leerCantidad, marcasDeElemento, quitarElemento, sugerenciasDeElemento, type Cambio, type Guion } from '../motor';
import { aplicarCambios, textoDe } from './cambios';
import { buscarProyecto } from './proyecto';
import { correr } from './correr';
import { PanelLista } from './paneles-ui';
import type { AccionesBreakdown } from './render/breakdown';

/**
 * Cambia la escena `k` de `g` en el guion. La busca por número y encabezado en el texto de ese momento: si el guion
 * cambió desde que se dibujó la hoja, el cambio no cae en otra escena. `null` si ya no se sabe cuál es.
 */
async function cambiarEscena(app: App, guion: TFile, g: Guion, k: number, calcular: (texto: string, escena: number) => Cambio[]): Promise<number | null> {
  const firma = {
    numero: g.doc.escenas[k].numero,
    encabezado: g.doc.escenas[k].encabezado,
  };
  let perdida = false;
  // Desde el breakdown no se abre el guion: quien agrega sigue en su hoja, y la × deshace.
  const n = await aplicarCambios(
    app,
    guion,
    (t) => {
      const j = escenaPorFirma(t, firma);
      if (j === null) perdida = true;
      return j === null ? [] : calcular(t, j);
    },
    { abrir: false },
  );
  if (perdida) {
    new Notice(`No encontré la escena ${firma.numero} en el guion. Vuelve a intentarlo.`);
    return null;
  }
  return n;
}

/** Una pregunta de sí o no, con el botón que hace el cambio a la derecha. */
function confirmar(app: App, titulo: string, texto: string, boton: string): Promise<boolean> {
  return new Promise((listo) => {
    let si = false;
    const m = new Modal(app);
    m.titleEl.setText(titulo);
    m.contentEl.createEl('p', { text: texto });
    new Setting(m.contentEl)
      .addButton((b) => b.setButtonText('Cancelar').onClick(() => m.close()))
      .addButton((b) =>
        b
          .setButtonText(boton)
          .onClick(() => {
            si = true;
            m.close();
          })
          .buttonEl.addClass('mod-warning'),
      );
    m.onClose = () => listo(si);
    m.open();
  });
}

/** `alTerminar` redibuja quien pidió el cambio con el texto nuevo (la hoja no espera a que se guarde el guion). */
export type AlTerminar = (k: number, cat: string) => void;

/** La lista para agregar a la categoría `cat` de la escena `k`: lo que ya se usa en el proyecto, o lo que se escriba. */
export function abrirAgregar(app: App, guion: TFile, g: Guion, k: number, cat: string, ancla: HTMLElement, alTerminar?: AlTerminar): void {
  const categoria = g.config.categorias.find((c) => c.codigo === cat)?.nombre ?? cat;
  const numero = g.doc.escenas[k]?.numero ?? '';
  if (cat === 'rep' && g.doc.escenas[k]?.meta.reparto !== undefined) {
    new Notice(`La escena ${numero} fija su reparto en sus metadatos («reparto=…»). Cámbialo ahí.`);
    return;
  }
  const agregar = (texto: string) => {
    const { nombre, cantidad } = leerCantidad(texto);
    if (!nombre) return;
    correr(
      cambiarEscena(app, guion, g, k, (t, j) => agregarOculto(t, j, cat, nombre, cantidad)).then((n) => {
        if (n === 0) new Notice(`«${nombre}» ya está en la escena ${numero}.`);
        else if (n) alTerminar?.(k, cat);
      }),
    );
  };
  new PanelLista(ancla, {
    titulo: `${categoria} · escena ${numero}`,
    opciones: sugerenciasDeElemento(g, cat, k).map((valor) => ({ valor })),
    actual: null,
    alElegir: (op) => agregar(op.valor),
    escribir: agregar,
  });
}

/**
 * Quita el elemento de la escena: las marcas ocultas se borran y las de la acción dejan su texto. Si está subrayado
 * en la acción, pregunta antes, porque desde aquí no hay Ctrl+Z.
 */
export function quitarDeEscena(app: App, guion: TFile, g: Guion, k: number, cat: string, nombre: string, alTerminar?: AlTerminar): void {
  const numero = g.doc.escenas[k]?.numero ?? '';
  correr(
    (async () => {
      const t = await textoDe(app, guion);
      const j = escenaPorFirma(t, {
        numero,
        encabezado: g.doc.escenas[k]?.encabezado ?? '',
      });
      const visibles = j === null ? 0 : marcasDeElemento(t, j, cat, nombre).visibles;
      if (visibles) {
        const veces = visibles === 1 ? 'una vez' : `${visibles} veces`;
        const ok = await confirmar(app, `Quitar «${nombre}» de la escena ${numero}`, `Está subrayado ${veces} en el guion. Se quita el subrayado y el texto se queda.`, 'Quitar');
        if (!ok) return;
      }
      const n = await cambiarEscena(app, guion, g, k, (texto, e) => quitarElemento(texto, e, cat, nombre));
      if (n === 0) new Notice(`No encontré las marcas de «${nombre}».`);
      else if (n) alTerminar?.(k, cat);
    })(),
  );
}

/**
 * «No es personaje»: quien cuenta en el reparto solo porque la acción lo presentó con edad («Tele (32)») deja de contar en
 * todo el proyecto. Se guarda en `no_son_personajes` de la ficha del proyecto, donde se puede quitar.
 */
export function marcarNoPersonaje(app: App, guion: TFile, nombre: string): void {
  correr(
    (async () => {
      const proyecto = buscarProyecto(app, guion);
      if (!proyecto) return void new Notice('Este proyecto no tiene ficha («carpeta: proyecto») donde guardarlo.');
      const ok = await confirmar(
        app,
        `«${nombre}» no es personaje`,
        'Deja de contar en el reparto, la propuesta de talento y las hojas de llamado. Se guarda en «no_son_personajes» de la ficha del proyecto; bórralo de ahí si te equivocaste.',
        'No es personaje',
      );
      if (!ok) return;
      await app.fileManager.processFrontMatter(proyecto, (fm: Record<string, unknown>) => {
        const previa = Array.isArray(fm.no_son_personajes) ? fm.no_son_personajes.map(String) : [];
        if (!previa.some((x) => x.toLowerCase() === nombre.toLowerCase())) fm.no_son_personajes = [...previa, nombre];
      });
    })(),
  );
}

export const accionesBreakdown = (app: App, guion: TFile, g: Guion, alTerminar?: AlTerminar): AccionesBreakdown => ({
  agregar: (k, cat, ancla) => abrirAgregar(app, guion, g, k, cat, ancla, alTerminar),
  quitar: (k, cat, nombre) => quitarDeEscena(app, guion, g, k, cat, nombre, alTerminar),
  noEsPersonaje: (nombre) => marcarNoPersonaje(app, guion, nombre),
});
