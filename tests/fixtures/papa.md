---
carpeta: guion
proyecto: "PAPA (papá)"
---
%%
GUÍA · GUION

Qué es: el guion literario del corto. Esta nota no se escribe en Markdown sino en Fountain (fountain.io), un formato de texto plano para guiones. El plugin lo pagina como guion profesional: Courier de 12 puntos, tamaño carta y los márgenes de la industria. Una página equivale más o menos a un minuto en pantalla.

Para verlo paginado: Ctrl+P (Cmd+P en Mac) y el comando «Carpeta: Abrir vista previa del guion».

PORTADA
Las líneas que empiezan con Title, Credit, Author, Draft date y Contact son la portada. En Author van los nombres de quienes escribieron el guion; en Contact, un correo o un teléfono. Deja una línea en blanco entre la portada y la primera escena.

SINTAXIS BÁSICA
- Encabezado de escena: una línea que empieza con INT. o EXT. (o INT./EXT.), con una línea en blanco antes y otra después. Ejemplo: INT. COCINA - DÍA. Si necesitas un encabezado que no empiece así, ponle un punto adelante: .FLASHBACK
- Acción: cualquier párrafo normal. En presente, y solo lo que se ve y se oye.
- Personaje: el nombre en MAYÚSCULAS en su propia línea, con una línea en blanco antes. El diálogo va en la línea siguiente, sin línea en blanco de por medio. Para voz en off: ANA (V.O.)
- Acotación: entre paréntesis, en su propia línea, entre el nombre y el diálogo. Ejemplo: (en voz baja)
- Transición: en español siempre empieza con el signo >. Ejemplo: > CORTE A:
- Texto centrado: entre > y <. Ejemplo: >FIN<
- Salto de página: una línea que solo tiene tres signos de igual (===).
- Énfasis: **negritas** y *cursivas*.

SUBRAYADO PARA EL BREAKDOWN
Los elementos de producción se marcan aquí mismo, en el guion. Selecciona el texto y pulsa el número de su categoría:

Tecla · categoría · marca · código
- 1 · Reparto · rojo · rep
- 2 · Stunts y acción · naranja · stunt
- 3 · Extras de atmósfera · verde · extra
- 4 · Efectos especiales · azul · efx
- 5 · Utilería · morado · ut
- 6 · Vehículos y animales · rosa · veh
- 7 · Música y sonido · café · mus
- 8 · Decoración de set · gris · deco
- 9 · Vestuario · círculo · vest
- 0 · Maquillaje y peinado · asterisco · maq
- Shift+1 · Extras con acción · amarillo · silent
- Shift+2 · Equipo especial · recuadro · equipo
- Shift+3 · Notas de producción · al margen · nota

Los números solo subrayan cuando hay texto seleccionado; sin selección se escriben normal. Para cambiar la categoría, selecciona el texto ya subrayado y pulsa otro número; si pulsas el mismo, se quita el subrayado. Otra forma: con el texto seleccionado, usa el comando «Carpeta: Subrayar selección».

En el archivo, cada subrayado se guarda como un código entre llaves, que también puedes escribir a mano:
- `{código:texto}` subraya ese texto con la categoría del código.
- `{código:texto|nombre en el breakdown}` subraya el texto y en el breakdown lo anota con el nombre que va después de la barra. Sirve para precisar: `{vest:el uniforme|Ana: uniforme de enfermera azul}`.

No hace falta marcar a los personajes que hablan: el plugin los toma solo de los nombres que van antes de cada diálogo. Sí marca como reparto (tecla 1) a quien aparece sin hablar, como alguien que duerme o un personaje que solo se ve.

Las marcas no ensucian el guion de la carpeta: el subrayado con colores se ve en «03 - Guion subrayado y octavos», y el desglose, en «05 - Breakdown».

Marca cada elemento en cada escena donde se necesite, no solo la primera vez que aparece: cada hoja del breakdown sale de las marcas de su escena. Si el guion no menciona algo que la escena necesita (la ropa, el maquillaje, el sonido ambiente), marca las palabras más cercanas y escribe después de la barra lo que hace falta: `{maq:se talla la cara|Cara lavada, ojeras leves}`.

QUÉ TIENE QUE CUADRAR
Este guion es la fuente de todo. El número de escenas, los sets y los personajes de aquí son los del timing, el breakdown, el guion técnico, el storyboard y el shooting list. Si cambias una escena después de hacer esos documentos, revísalos todos.

ERRORES COMUNES
- Un encabezado sin INT. ni EXT. no cuenta como escena y se pega a la anterior.
- El mismo personaje escrito de dos formas (ANA y ANITA) sale como dos personajes en el breakdown.
- Una línea en blanco entre el nombre y el diálogo convierte el diálogo en acción.
- Los planos y los movimientos de cámara van en el guion técnico, no aquí.
- Lo que no se ve ni se oye (pensamientos, recuerdos que nadie cuenta) no se puede filmar.

Lo que sigue es una escena de ejemplo: bórrala y escribe tu guion.
%%
Title: PAPA (papá)
Credit: Guion de
Author:
Draft date: 24 de noviembre de 2026
Contact:

INT. RESTAURANTE TRES TIERRAS - NOCHE

Monterrey, abril.

Restaurante de manteles blancos y copas de cristal, con luz cálida y tenue. Todas las mesas están ocupadas.

En una mesa larga cena una familia. En la cabecera, AURELIO (78), de bigote recortado, traje gris y corbata. A su derecha, su esposa MARÍA (65), de vestido negro y collar de perlas; junto a ella, su hijo MARTÍN (45), de saco oscuro sin corbata, y ESPOSA MARTÍN (43), de vestido verde. A la izquierda de AURELIO, su otro hijo, JOSÉ (32), de camisa blanca, y ESPOSA JOSÉ (30), de vestido rojo.

AURELIO conversa con sus hijos. Los mira y sonríe.

AURELIO
(contento)
Estoy orgulloso de ustedes, se nota que los crié bien, fui un gran padre.

MARTÍN frunce el ceño.

MARTÍN
(frustrado)
¿Buen padre? ¿Estás jugando, cierto? ¿Después de la infancia de mierda que nos diste a mí y a mi hermano? ¿Después de las putizas que nos arrimabas solamente por «existir»?
(manotea en la mesa)
¡Por Dios!
(voz alzada)
Le rompiste un brazo y la tibia a José por estar viendo caricaturas y no estar trabajando. ¡A sus putos ocho años!

El restaurante queda en silencio. AURELIO aprieta la mandíbula.

AURELIO
(muy enojado)
Cállate a la verga, puñetas, no me estés hablando así, que yo soy tu papá y me respetas.
(golpea la mesa al ritmo de las sílabas «me res-pe-tas»)
O te voy a poner una desconocida, por mí comiste y por mí creciste, de estos huevos saliste.

JOSÉ
(conciliador)
A ver, papá, pudimos haber salido de tus huevos, pero eso no significa que mereciéramos maltr...

AURELIO le pone una CACHETADA y lo tumba al piso. Los comensales de todas las mesas los miran. En la mesa de al lado, un comensal llama por celular.

Entra la POLICÍA (35) y camina hacia AURELIO. AURELIO le entrega un {ut:SOBRE CON DINERO|Sobre con dinero} y señala a JOSÉ. La POLICÍA guarda el sobre, levanta a JOSÉ del piso y se lo lleva.

AURELIO se queda de pie, inmóvil. Se mira la mano.

> DISOLVENCIA:

INT. CASA DE MARTÍN - SALA - NOCHE

Sala con un sillón largo, dos sillones individuales y una mesa de centro. Al fondo, la puerta de la cocina.

%%{maq:|Golpe de la cachetada en la cara de José}%%
%%>Profe: ¿quién pagó la fianza y cuándo?%%

MARÍA, de suéter gris, solloza en el sillón largo. JOSÉ, de sudadera, está sentado en un sillón individual, con la cara todavía ardida y marcada por la cachetada. MARTÍN, de playera y jeans, está de pie, recargado en la pared.

JOSÉ mira su celular. En la pantalla, un mensaje de «Papá»: «Ya quedaste libre. Lo del restaurante se me fue de las manos». JOSÉ apaga la pantalla sin contestar y deja el celular bocabajo en la mesa de centro.

Desde la cocina se oyen las voces de ESPOSA JOSÉ y ESPOSA MARTÍN.

ESPOSA JOSÉ (O.S.)
(en voz baja)
Ya nadie lo aguanta.

ESPOSA MARTÍN (O.S.)
Cada visita termina igual.

ESPOSA JOSÉ (O.S.)
(en voz alta)
La próxima, el sobre con dinero va a terminar en muerte.

ESPOSA JOSÉ y ESPOSA MARTÍN salen de la cocina y se quedan de pie junto a la puerta.

MARTÍN
(decepcionado)
¿Y si mandamos al decrépito este a un asilo?

JOSÉ
(resignado)
Honestamente, no me parece una mala idea.

Ambas esposas callan, pero asienten con la mirada.

INT. CASA DE AURELIO - DÍA

Viernes.

Muebles de madera oscura, todo en orden. Suena el teléfono. AURELIO contesta.

MARTÍN (O.S.)
La familia quiere verte. Es importante.

AURELIO cuelga. Sonríe y camina hacia el baño, silbando.

MONTAJE: AURELIO SE ARREGLA

INT. CASA DE AURELIO - BAÑO - DÍA

AURELIO sale de la regadera con la toalla acomodada en la cintura. Frente al espejo se afeita, se peina y se refina el bigote.

INT. CASA DE AURELIO - RECÁMARA - DÍA

AURELIO recorre los trajes del clóset y descuelga el {vest:TRAJE AZUL MARINO|Traje azul marino}, guardado en su funda. Se lo pone y se hace un nudo Windsor muy cuidadosamente.

INT. CASA DE AURELIO - VESTIDOR - DÍA

AURELIO se sienta en el banquito y se pone calceta y tenis derecho, y después calceta y tenis izquierdo. Lustra un poco los zapatos y se pone el {vest:CINTO FERRAGAMO|Cinto Ferragamo}.

INT. LICORERÍA - DÍA

Estantes llenos de botellas. En el mostrador, AURELIO, de TRAJE AZUL MARINO, paga una botella de {ut:BLUE LABEL|Botella de Blue Label}, de Johnnie Walker. La caja registradora se abre y suena el «Kaching». AURELIO sale de la licorería con la botella.

EXT. CASA DE JOSÉ - DÍA

AURELIO llega a la puerta con la botella de BLUE LABEL en la mano. Mira su reloj: las cinco en punto. TOCA DOS VECES, con ánimo.

INT. CASA DE JOSÉ - SALA - DÍA

Sala con sillones alrededor de una mesa de centro vacía: no hay copas.

MARÍA, de blusa blanca, está sentada en un sillón; JOSÉ, de playera polo, en otro. MARTÍN, de camisa arremangada, está de pie frente a la puerta.

AURELIO entra, de TRAJE AZUL MARINO, con la botella de BLUE LABEL en la mano. MARÍA no lo mira.

MARTÍN
(voz medio temblorosa, como con miedo)
Ya nadie te aguanta, viejo decrépito, grosero y malparido. Te vamos a meter a una casa de retiro.

AURELIO
(molesto)
¿Una casa de ancianos? ¿Yo? ¿Dime quién chingados te pagó la carrera, José? ¿Quién les compró su puto carro del año a los dos? ¿Quién?

MARTÍN
(firme)
Papá, ya nadie necesita tu dinero.

AURELIO se va encima de MARTÍN con el brazo completo. MARTÍN apenas da un paso al lado y le suelta una CACHETADA seca. AURELIO cae de costado en el piso. Se le cae el BLUE LABEL y la botella se rompe.

EXT. CASA DE RETIRO SAN PEDRO - DÍA

Al día siguiente.

Jardín con fuentes, una alberca de terapia y una pista de tartán. Enfermeras de uniforme blanco cruzan el jardín.

AURELIO y ESPOSA JOSÉ caminan hacia la entrada.

INT. CASA DE RETIRO SAN PEDRO - RECEPCIÓN - DÍA

Recepción amplia, con piso de mármol y sillones de piel. En la pared, los títulos enmarcados de las enfermeras.

Detrás del mostrador, la RECEPCIONISTA (32) le explica los paquetes a ESPOSA JOSÉ con un folleto abierto. AURELIO está de pie junto a ellas, con los brazos cruzados y el ceño fruncido.

AURELIO
(incómodo)
Yo no quiero estar aquí, no sé a qué chingados me traen.

La RECEPCIONISTA y ESPOSA JOSÉ lo ignoran.

La RECEPCIONISTA le da la cotización impresa a ESPOSA JOSÉ. ESPOSA JOSÉ la lee y abre mucho los ojos.

ESPOSA JOSÉ
¿Cuánto? No voy a pagar una mensualidad de auto alemán por un viejo hijo de puta que lo único que hizo fue traumatizar a mi marido.

EXT. CASA DE RETIRO APODACA - DÍA

Calle llena de baches. La casa de retiro está pegada a una gasolinera. Fachada de pintura descarapelada; junto a la entrada, una fila de garrafones de cloro.

AURELIO y ESPOSA JOSÉ entran.

INT. CASA DE RETIRO APODACA - OFICINA - DÍA

Oficina chica, con un escritorio de lámina y sillas de plástico. El ENCARGADO (50) está sentado detrás del escritorio; enfrente, AURELIO y ESPOSA JOSÉ.

El ENCARGADO escribe a mano en el contrato: «Año adelantado, con descuento». Se lo acerca a AURELIO con una pluma. AURELIO firma; la letra le sale temblorosa.

ENCARGADO
Por cierto, siento decírselos, pero no tenemos agua caliente este mes. Tuvimos un tema con el recibo del gas.

ESPOSA JOSÉ
No importa, la verdad hasta se me hace justo.

ENCARGADO
(alegre)
Pues ya quedamos, ya fue todo. Cuando vengan a visitarlo se traen un pancito dulce, ¿sí o qué?

El ENCARGADO se ríe incómodamente.

ESPOSA JOSÉ
(sarcástica)
El día que vengamos te traemos todo el pan dulce del mundo.

> FADE OUT.

> FADE IN:

INT. CASA DE RETIRO APODACA - CUARTO AURELIO - DÍA

Cuarto angosto de paredes desgastadas, con una cama individual, una mesa de noche y un clóset. Junto a la puerta, una maleta cerrada.

AURELIO, sentado en la orilla de la cama, marca en su celular. En la pantalla: «José». El teléfono TIMBRA hasta que entra una grabación: «Buzón de voz, la llamada se cobrará al terminar los tonos siguientes...», y luego BUP BUP BUP.

AURELIO cuelga y marca otra vez. En la pantalla: «Martín». Contestan.

MARTÍN (O.S.)
Ya hablamos de esto, papá, no te queda de otra, adiós.

> FADE OUT.

> FADE IN:

INT. CASA DE RETIRO APODACA - CUARTO AURELIO - NOCHE

AURELIO está sentado en su cama, perfectamente tendida, con el celular en la mano. Marca un número y cuelga antes de que timbre.

AURELIO (V.O.)
Dios, ¿qué hice para merecer esto? Te imploro clemencia. Lo único que quiero es un abrazo de mis hijos, un beso de mi esposa. El aliento de alguien familiar.

INT. CASA DE RETIRO APODACA - CUARTO AURELIO - DÍA

El mismo cuarto angosto. AURELIO, despeinado y sin afeitar, de camisa arrugada, está sentado en la orilla de la cama. De pie frente a él, MARÍA, de vestido oscuro y bolsa al hombro, y un NOTARIO (34), de traje, con un portafolio.

MARÍA
Aurelio, ¿por qué apestas tan horrible?

AURELIO
Tengo dos semanas sin bañarme, no me dan ganas de bañarme con la pinche agua fría de aquí.

MARÍA
(fría)
Ok. Bueno, la casa. Firma para evitar problemas después, es por el bien de todos.

El NOTARIO saca unos papeles del portafolio y se los acerca a AURELIO con una pluma. AURELIO firma.

MARÍA y el NOTARIO caminan hacia la puerta.

AURELIO
(zozobra máxima)
¿Y cuándo vienes por mí?

MARÍA le AZOTA la puerta y se retira sin contestar.

> DISOLVENCIA:

INT. CASA DE RETIRO APODACA - COMEDOR - DÍA

Comedor de mesas largas con ocho sillas cada una y manteles de plástico. Varios RESIDENTES (70 a 90) comen.

DOÑA SHARIS (88), de lentes gruesos de fondo de botella y suéter tejido, está sentada a una mesa. Pone un juego de cubiertos en el lugar de junto y le hace señas a AURELIO, que llega de camisa y pantalón de vestir. AURELIO se sienta. DOÑA SHARIS le comparte de su pan dulce.

AURELIO come sin voltear a verla. Pronuncia mal el nombre de DOÑA SHARIS, a propósito.

AURELIO
(enojado)
Shamis, ya vete a comer a tu cuarto, siempre que te veo aquí apesta a manteca de puerco.

DOÑA SHARIS no reacciona. Recoge los cubiertos del lugar de AURELIO y sigue comiendo.

> DISOLVENCIA:

INT. CASA DE RETIRO APODACA - COMEDOR - NOCHE

El comedor está vacío y en silencio. AURELIO está sentado solo en una mesa de ocho, sin cubiertos enfrente.

Se oye su propia voz, sin que mueva los labios.

AURELIO (V.O.)
En esta mesa no comes.

AURELIO se queda inmóvil, con la mirada en las sillas vacías.

> DISOLVENCIA:

INT. CASA DE RETIRO APODACA - COMEDOR - DÍA

Los RESIDENTES comen. DOÑA SHARIS está sentada a su mesa. AURELIO camina hasta la mesa y se queda de pie frente a ella.

AURELIO
(en voz alta)
Perdóname.

Los RESIDENTES voltean a verlo. DOÑA SHARIS le sonríe.

AURELIO se sienta, saca una hoja y una pluma y empieza a escribir una CARTA. Arriba se lee: «Martín:».

AURELIO (V.O.)
Perdóname, mijo. Tú y José merecían otro padre. Yo solamente supe repetir al mío.

AURELIO sigue escribiendo; la hoja se llena de párrafos que no alcanzan a leerse. Dobla la CARTA y se la guarda en el bolsillo de la camisa.

> DISOLVENCIA:

EXT. CASA DE RETIRO APODACA - PATIO - DÍA

Patio de cemento cerrado por un muro alto. Sillas de plástico a la sombra.

AURELIO juega solo una suerte de pádel: golpea una pelota contra el muro con una raqueta, una y otra vez. Los RESIDENTES lo miran desde sus sillas. Ninguno se acerca.

INT. CASA DE RETIRO APODACA - ATARDECER

AURELIO, de pie, hace malabares con cuatro {ut:NARANJAS|Naranjas|4}. Llega una ENFERMERA (28) y se las quita.

ENFERMERA
Con la comida no se juega.

AURELIO baja la mirada y guarda silencio. No reclama.

> DISOLVENCIA:

INT. CASA DE RETIRO APODACA - CUARTO AURELIO - NOCHE

AURELIO está sentado en una silla de madera maltratada y rayada. Tiene la cara larga y la mirada en el piso.

AURELIO (V.O.)
(susurra, con máxima zozobra)
Yo di todo. En mi casa a nadie le faltó nada. Eso nadie lo ve. Yo no pedí nacer con ese padre. Yo no pedí... En esta mesa no comes. Cállate. Ya hablamos de esto, papá.

> FADE OUT.

> FADE IN:

INT. CASA DE RETIRO APODACA - COMEDOR - DÍA

Julio.

Los RESIDENTES desayunan. La silla junto a DOÑA SHARIS está vacía. Ella mira la silla y luego hacia las escaleras; los demás siguen comiendo. DOÑA SHARIS detiene a la ENFERMERA, que pasa junto a su mesa.

DOÑA SHARIS
(medianamente preocupada)
Oye, corazona, no veo a Aurelio por ninguna parte. ¿Estará bien?

ENFERMERA
Mmmmmm… No lo sé, déjame ir a revisar a su cuarto. No vaya a ser el Diablo.

La ENFERMERA camina hacia las escaleras del comedor y sube rumbo a los dormitorios.

MONTAJE: AURELIO SE ARREGLA

INT. CASA DE RETIRO APODACA - CUARTO AURELIO - NOCHE

Poca luz. Paredes desgastadas, telarañas, madera mohosa.

AURELIO sale del baño con la toalla en la cintura. Va al clóset, elige el traje y se lo pone. Vuelve a hacerse el nudo Windsor, muy cuidadosamente.

Se sienta y se pone calceta y tenis derecho, y después calceta y tenis izquierdo.

Toma el CINTO FERRAGAMO. No se lo pone: lo cuelga en el nervio de la puerta deslizante de la regadera.

INT. CASA DE RETIRO APODACA - BAÑO AURELIO - DÍA

La ENFERMERA abre la puerta del baño y se queda inmóvil. AURELIO cuelga de la puerta deslizante de la regadera, ahorcado con el CINTO FERRAGAMO del pantalón de gala. Está peinado, lustrado y de traje, con el nudo Windsor en su lugar.

INT. CASA DE RETIRO APODACA - CUARTO AURELIO - DÍA

En la mesa de noche hay una CARTA, doblada con cuidado.

> FADE OUT.

PANTALLA NEGRA

Aparece con letras rojas: «Fin.»
