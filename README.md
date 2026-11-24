# Carpeta de producción

Un plugin de Obsidian para estudiantes y equipos de cine en español. El guion se escribe en Fountain dentro de una nota, y de él sale la carpeta de producción sin copiar datos a mano:

- paginación y octavos;
- subrayado y breakdown;
- listas de reparto, locaciones y elementos;
- PDF, Fountain y Final Draft.

Las tablas del proyecto (ruta crítica, guion técnico, shooting list, hojas de llamado) se llenan con paneles al pulsar sus celdas.

> **In English:** an Obsidian plugin for Spanish-speaking film students. Write your screenplay in Fountain inside a note and get a paginated preview, eighths of a page, script breakdown with color tagging, cast/location/element lists, PDF/Fountain/FDX export, and pick-lists for date, scene, shot type and camera movement cells in production tables. The interface is in Spanish.

## Instalación

- **Desde Obsidian:** Configuración → Plugins de la comunidad → Explorar → «Carpeta de producción» (cuando esté aprobado en la lista oficial).
- **A mano:**
  1. Descarga `main.js`, `manifest.json` y `styles.css` de la [última versión](../../releases/latest).
  2. Ponlos en `<tu vault>/.obsidian/plugins/carpeta-de-produccion/`.
  3. Activa el plugin.
- **Con BRAT:** agrega este repositorio como plugin beta.

## Para empezar

1. Abre la paleta de comandos (Ctrl+P) y elige «Carpeta de producción: Nuevo proyecto».
   - Si tu vault tiene una carpeta `Plantillas/Proyecto nuevo`, el proyecto se copia de ahí.
   - Si no, se crea uno mínimo con la ficha (`00 - Proyecto`) y el guion (`02 - Guion`).
2. Escribe en el guion. Cualquier nota con `carpeta: guion` en sus propiedades es un guion, y las notas de su carpeta son su proyecto.
3. «Abrir vista previa del guion» lo muestra paginado, en Courier 12 y tamaño carta.

## Qué hace

**Escribir**

- **Cambiar de tipo de párrafo:** Enter, Tab y Shift+Tab pasan entre acción, personaje, diálogo, acotación, transición, encabezado y plano. Una línea vacía muestra en gris el tipo que va a tener.
- **Autocompletado:**
  - el encabezado por partes: `INT.`, la locación y el momento;
  - el personaje, con quien responde primero;
  - las extensiones y las transiciones.
- **Correcciones al escribir:**
  - mayúscula inicial;
  - `...` → `…`;
  - comillas «»;
  - sin dobles espacios;
  - mayúsculas en encabezados y personajes.
- **Diccionarios del proyecto:** se editan con «Editar diccionarios del proyecto».
- **Marcas en el editor:** el corte de página «── 2 ──» y, si quieres, los números de escena.
- **Navegador de escenas:** octavos, duración y palabras. Arrastrar una escena la reordena, y Ctrl+Z lo deshace.
- **Comandos «Párrafo: …»:** sirven para forzar el tipo de párrafo. No traen atajo de teclado; te sugerimos asignarles Ctrl+Alt+1…8 en Configuración → Atajos de teclado.

**Producir**

- **Numeración bloqueada:** «Bloquear numeración» fija el número de cada escena. Las escenas nuevas toman letra (5A, 5B) y las anteriores a la primera, A1.
- **Diálogo dual:** el comando pone `^`, y la vista previa y el PDF lo dibujan en dos columnas.
- **Subrayado por teclas:** selecciona el texto y pulsa el número de su categoría, del 1 al 0, o Shift+1 a Shift+3.
  - Hay 13 categorías de breakdown.
  - Puedes agregar las tuyas en la ficha: `categorias_extra: ["vfx: Efectos visuales"]`.
- **Reparto automático:**
  - cuenta a quien habla, salvo si solo habla en V.O.;
  - cuenta a los personajes conocidos que se nombran con mayúscula en la acción;
  - cuenta a los marcados con `{rep:…}`;
  - `%%escena: reparto=…%%` reemplaza la lista de una escena.
- **Comandos del breakdown:**
  - marcar todas las menciones;
  - copiar los elementos de una escena a otra;
  - renombrar o fusionar un elemento;
  - asignar identificadores a las escenas.
- **Panel «Breakdown de la escena»:** los elementos de la escena donde está el cursor.
- **Bloques para cualquier nota del proyecto:**
  - `carpeta-guion` y `carpeta-octavos`;
  - `carpeta-breakdown`, `carpeta-reparto`, `carpeta-locaciones` y `carpeta-elementos`;
  - `carpeta-requisitos`.
- **Notas por escena para Bases** y **breakdown en CSV**.

**Llenar las tablas del proyecto**

Al pulsar una celda de una tabla en un documento del proyecto se abre un panel. Lo que eliges queda escrito en la celda.

| Columna | Panel |
|---|---|
| Inicio, Fin, Fecha… | Calendario en español. En la columna Fin marca el Inicio de la misma fila. |
| Escena, Esc., SC | Las escenas del guion con sus octavos. Al elegir una, llena solo las celdas vacías de la fila que salen del guion: set, INT/EXT, día o noche y talentos. |
| Plano | Las abreviaturas de la tabla «Abreviatura \| Plano» de la nota, o las de fábrica (G.P.G., P.G., P.M.C., P.P.…). Conserva la descripción que ya escribiste. |
| Movimiento, Ángulo, Lente | Listas que se cambian en la ficha del proyecto: `movimientos`, `angulos` y `lentes`. |
| Descripción técnica | Lente, movimiento y ángulo juntos: «35 mm · paneo · picada». |

- **Teclado:** flechas, Enter y Esc; en las listas largas, escribir filtra.
- **Escribir a mano:** el botón «Escribir a mano» del panel, Esc, o Alt+clic en la celda para que no se abra el panel.
- **Lo que ya escribiste se respeta:** en Movimiento, Ángulo y Lente solo se cambia el valor reconocido («paneo lento siguiendo a Ana» → «tilt lento siguiendo a Ana»), y la descripción técnica no se reescribe si no cambias nada.
- **Modos:** funciona en la vista en vivo y en la vista de lectura.
- **Seguridad:** nunca escribe si la nota cambió mientras elegías.
- **Apagarlo:** en los ajustes, «Paneles en las tablas».

**Entregar**

- **PDF:** guion, guion subrayado, hoja de octavos y breakdown. Salen del mismo HTML que la vista previa.
- **Fountain:**
  - *limpio*, para otros programas o para el profesor;
  - *completo*, para volver a importarlo sin perder nada.
- **Final Draft (FDX):** exportar e importar.

**Revisar**

- **Comentarios:** «Comentar selección» escribe `%%>Autor: texto%%`. El panel de comentarios sirve para responder, resolver y borrar, y los comentarios nunca se imprimen.
- **Búsqueda** por tipo de párrafo.
- **Concentración:** modo máquina de escribir y modo enfoque.
- **Escritura:** sprints con temporizador y registro de sesiones con palabras netas.
- **Verificador de requisitos:** reglas como `max_paginas`, `max_locaciones` o `max_personajes_escena` en la ficha del proyecto.
- **Tarjetas de escenas** y **sides por actor** en PDF.

## Requisitos y privacidad

- **Solo escritorio:** el plugin funciona en Obsidian de escritorio (Windows, macOS y Linux), desde la versión 1.8. El PDF usa el motor de impresión de Obsidian de escritorio.
- **Sin red:** no se conecta a internet ni envía datos a ningún lado.
- **Archivos fuera de la vault:**
  - para imprimir un PDF escribe una página HTML en la carpeta temporal del sistema y la borra al terminar;
  - «Importar guion» lee solo el archivo `.fountain` o `.fdx` que tú eliges.

## Lo que cambia los resultados vive en el proyecto

Las propiedades de la ficha del proyecto (`carpeta: proyecto`) viajan con la carpeta. Así todo el equipo y el profesor obtienen los mismos octavos y las mismas listas:

- `renglones_por_pagina` (54 a 56) y `espacio_antes_encabezado`;
- `texto_mas`, `texto_continua` y `conservar_extension`;
- `ultima_pagina_completa` y `cronometraje` (`pagina`, `caracteres` o `tipo`);
- `dic_*`, `categorias_extra` y `orden_reparto`;
- `movimientos`, `angulos` y `lentes`;
- las reglas del verificador.

## Desarrollo

```bash
npm install
npm test        # pruebas del motor (vitest)
npm run check   # tipos
npm run build   # main.js
npm run deploy  # revisa tipos, compila, copia a la vault de prueba y recarga el plugin
```

`npm run deploy` necesita la ruta de una vault de prueba, en la variable `CARPETA_VAULT` o en un archivo `.vault`, que git ignora.

- `src/motor/`: TypeScript puro, sin Obsidian ni DOM, con sus pruebas en `tests/`.
- `src/plugin/`: la integración con Obsidian y CodeMirror.
- `tests/fixtures/`: el guion de prueba, «PAPA (papá)» de Diego Ayala.

Licencia MIT.
