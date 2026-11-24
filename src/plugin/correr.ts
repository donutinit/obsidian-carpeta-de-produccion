import { Notice } from 'obsidian';

/** Lo que devuelve un callback que puede ser asíncrono. */
export type Quizas = void | Promise<void>;

/** Corre el resultado de un callback; si es una promesa que falla, lo avisa en vez de perderlo. */
export function correr(r: unknown): void {
  if (r instanceof Promise)
    r.catch((e: unknown) => {
      console.error('Carpeta de producción:', e);
      new Notice('Algo salió mal: ' + (e instanceof Error ? e.message : String(e)));
    });
}
