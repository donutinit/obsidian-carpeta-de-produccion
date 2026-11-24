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
- **Ancho de página:** en el editor, el guion mide lo que la página (60 columnas de Courier), con o sin «Readable line length». Así el personaje, la acotación y el diálogo quedan en su sangría.
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
  - cuenta a quien la acción presenta en mayúsculas con su edad, aunque no hable («Un POLICÍA (35) vigila»). Si algo así no es personaje, su × en el breakdown lo guarda en `no_son_personajes` de la ficha del proyecto;
  - cuenta a los personajes conocidos que se nombran con mayúscula en la acción;
  - cuenta a los marcados con `{rep:…}`;
  - `%%escena: reparto=…%%` reemplaza la lista de una escena.
- **Comandos del breakdown:**
  - marcar todas las menciones;
  - copiar los elementos de una escena a otra;
  - renombrar o fusionar un elemento;
  - asignar identificadores a las escenas.
- **Breakdown a mano, sin marcas:**
  - en la hoja del bloque `carpeta-breakdown` y en el panel «Breakdown de la escena», cada categoría tiene «+ Agregar»;
  - la lista sugiere lo que ya usaste en otras escenas y, en equipo especial, Steadicam, grúa, dron, dolly y otros. También puedes escribir algo nuevo; «Extras ×6» lleva cantidad;
  - la × lo quita. Si está subrayado en el guion, pregunta antes y deja el texto;
  - en el reparto se agrega a quien no habla, y solo eso se quita;
  - se guarda en el guion como nota oculta bajo el encabezado de la escena, `%%{equipo:|Steadicam}%%`. No se imprime ni cambia los octavos. En la vista en vivo se ve como una etiqueta con su ×; en modo fuente, como texto.
- **Equipo especial del guion técnico:** el equipo de cada plano entra solo al breakdown de su escena, desde las columnas «Movimiento» o «Descripción técnica».
  - Se reconocen Steadicam, gimbal, grúa (o jib), dron, dolly, slider, Easyrig, rig de auto y cámara de alta velocidad;
  - dolly in, dolly out y travelling cuentan como «Dolly»;
  - lo demás (fija, paneo, tilt, en mano) no pide equipo.
  Lo que viene de ahí lleva ⚙ y se cambia en el guion técnico.
- **Panel «Breakdown de la escena»:** los elementos de la escena donde está el cursor.
- **Bloques para cualquier nota del proyecto:**
  - `carpeta-guion` y `carpeta-octavos`;
  - `carpeta-breakdown`, `carpeta-reparto`, `carpeta-locaciones` y `carpeta-elementos`;
  - `carpeta-requisitos`;
  - `carpeta-plan` (en la shooting list) y `carpeta-llamado` (en las hojas de llamado), con `día 2` adentro para un solo día. Ver «Plan de rodaje y hojas de llamado».
  - `carpeta-beats` (con `escena 3` adentro para una sola): la hoja de beats de dirección de actores, con cada acción y cada parlamento numerado y quién habla; Tema se llena a mano;
  - `carpeta-vestuario`: vestuario y maquillaje por personaje con códigos de cambio (A1, A2, J1). La marca dice de quién es: `{vest:traje|Antonio: Traje gris}`;
  - `carpeta-cues`: el mapa de cues musicales (M1, M2…) con las marcas de música y sonido;
  - `carpeta-creditos`: los créditos, con el equipo por puesto (propiedad `equipo` de la ficha: «Nombre · Matrícula · Puesto») y el reparto con su actor (propiedad `actor` de cada ficha de personaje);
  - `carpeta-timing`: el timing de la plantilla (escena, set, acciones, páginas, octavos, planos, tiempo y acumulado). Los planos y su duración salen del guion técnico del proyecto; sin él, el tiempo se estima con el texto. Tiene un botón para copiarlo como tabla Markdown.
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
| Personaje (en la propuesta de talento) | Los personajes con su edad y sus escenas. Al elegir uno, llena «Edad del personaje» y «Escenas» de la fila, o de su tabla «Dato \| Valor». «Llenar toda la tabla» pone una fila por personaje y conserva el actor que ya escribiste. La edad sale del guion («AURELIO (78)») o, si no está, de la propiedad `edad` de su ficha. |

- **Teclado:** flechas, Enter y Esc; en las listas largas, escribir filtra.
- **Escribir a mano:** el botón «Escribir a mano» del panel, Esc, o Alt+clic en la celda para que no se abra el panel.
- **Lo que ya escribiste se respeta:** en Movimiento, Ángulo y Lente solo se cambia el valor reconocido («paneo lento siguiendo a Ana» → «tilt lento siguiendo a Ana»), y la descripción técnica no se reescribe si no cambias nada.
- **Modos:** funciona en la vista en vivo y en la vista de lectura.
- **Seguridad:** nunca escribe si la nota cambió mientras elegías.
- **Apagarlo:** en los ajustes, «Paneles en las tablas».

**Storyboard desde el guion técnico**

Los datos de cada viñeta viven en el guion técnico; el storyboard los muestra y los cambia ahí. Así no se pueden descuadrar.

- **Armar:** «Armar storyboard desde el guion técnico» (en la paleta, o el botón arriba de la nota del storyboard) pone una sección «### E1 · P1» por plano, bajo su escena y en su orden. Si la nota no existe, la crea junto al guion.
- **Volver a armar:** agrega los planos nuevos y nunca borra un dibujo. Un plano que ya no está en el guion técnico pasa al final con sus dibujos.
- **Cada viñeta muestra:** plano, lente, ángulo, movimiento, acción, y sonido y diálogo. Al pulsar una celda se abre su panel, y lo que eliges se escribe en la fila del guion técnico.
- **Dibujar** (con el plugin Excalidraw): crea el dibujo con un cuadro 16:9 y un nombre que no se repite («Mi corto - E1 P1»), lo guarda en `Storyboard/`, lo pega arriba de la viñeta y lo abre.

**Entregar**

- **PDF:** guion, guion subrayado, hoja de octavos y breakdown. Salen del mismo HTML que la vista previa.
- **Fountain:**
  - *limpio*, para otros programas o para el profesor;
  - *completo*, para volver a importarlo sin perder nada.
- **Final Draft (FDX):** exportar e importar.

**Personajes y dirección de actores**

- **«Crear fichas de personaje»:** una nota por personaje del reparto en `Personajes/`. Cada ficha trae:
  - la vida interior y exterior del diseño de personaje;
  - la biografía, los hechos, preguntas e imágenes por sentido, y las 11 preguntas del análisis de escena;
  - una tabla de casting (naturalidad, credibilidad, dicción, maleabilidad y presencia);
  - el bloque `carpeta-personaje`, con sus escenas y cuántos parlamentos tiene en cada una.
  Las fichas existentes no se tocan. Los nombres de `Personajes/` cuentan como personajes conocidos del reparto.
- **Números de parlamento:** contados por escena, junto al nombre de quien habla. Se prenden en los ajustes o con «Alternar números de parlamento».
- **Sides por actor (PDF):** sirven también como diálogos de audición.

**Series**

- **«Nueva serie»:** crea `Proyectos/<título>/` con la propuesta y el primer episodio. La propuesta trae datos, argumento, arco de la temporada, personajes, episodios por apertura en frío, actos y remate, esencia e intro.
- **«Nuevo episodio de la serie»:** agrega `Episodio N/` con su guion. Cada episodio es un guion con su propia carpeta.

**Revisar**

- **Comentarios:** «Comentar selección» escribe `%%>Autor: texto%%`. El panel de comentarios sirve para responder, resolver y borrar, y los comentarios nunca se imprimen.
- **Revisar el guion:** un panel señala, escena por escena, lo que la clase de guionismo corrige:
  - acción en pasado;
  - lo que la cámara no ve («se da cuenta», «piensa», «podemos ver»);
  - prosa («uno de los … más …», «aparentemente»);
  - diálogo narrado («le dice que…»);
  - acciones a media réplica;
  - un personaje con dos nombres;
  - personajes que hablan sin haberlos presentado en mayúsculas;
  - escenas que empiezan con diálogo.
  Lo que va entre comillas en la acción, como un mensaje o un letrero, no se revisa. Un clic lleva a la línea.
- **Búsqueda** por tipo de párrafo.
- **Concentración:** modo máquina de escribir y modo enfoque.
- **Escritura:** sprints con temporizador y registro de sesiones con palabras netas.
- **Verificador de requisitos:** reglas como `max_paginas`, `max_locaciones` o `max_personajes_escena` en la ficha del proyecto.
- **Tarjetas de escenas** y **sides por actor** en PDF.

## Plan de rodaje y hojas de llamado

1. En la shooting list (`carpeta: shooting-list`), escribe en la tabla «Orden de rodaje» qué escenas se filman cada día y en qué orden. Usa las columnas «Día» y «Esc.»: una fila por escena, o varias escenas separadas por comas («3, 1»).
2. En las tablas «Dato | Valor» bajo cada «## Día N» pon:
   - la fecha;
   - la primera toma (`9:00`, `9 am`, `9h`, `21:30 hrs`; 8:00 si falta);
   - si quieres, el «Llamado de crew». Si no, se calcula dos horas antes de la primera toma.
   Una escena repetida en el mismo día se programa una sola vez, con aviso. `minutos_comida: 0` quita la comida.
3. El bloque `carpeta-plan` arma los planos de cada día en orden de rodaje. Los toma del guion técnico del proyecto y les pone:
   - la hora de cada plano;
   - la comida después de seis horas;
   - el set, el día o la noche y el talento.
   Una escena sin planos en el guion técnico va completa, con su tiempo calculado por octavos.
4. En las hojas de llamado, el bloque `carpeta-llamado` arma por día:
   - las escenas, con set, personajes, planos, octavos y horario;
   - el reparto con su llamado, una hora antes de su primer plano;
   - el equipo especial del día, con las escenas que lo usan.
   El llamado de crew es dos horas antes de la primera toma.

Cada plano dura lo que diga la columna «Tiempo de grabación» del guion técnico: `45`, `45 min`, `1:15` o `1h30`. La plantilla no la trae, así que agrégala si quieres horarios reales.

Si un plano no la tiene, se usan las propiedades de la ficha del proyecto, y el plan lo marca con «≈»:

- `minutos_por_plano`: 30 por defecto;
- `minutos_por_octavo`: 10, para las escenas sin planos;
- `minutos_comida`: 60;
- `comida_tras_horas`: 6.

Todas las tablas generadas tienen un botón «Copiar como tabla» para pegarlas fijas en la nota.

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
- `minutos_por_plano`, `minutos_por_octavo`, `minutos_comida` y `comida_tras_horas`;
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
