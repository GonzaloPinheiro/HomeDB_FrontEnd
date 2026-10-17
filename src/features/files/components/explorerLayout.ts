// CLAUDE.md §6.3b: rejilla de la vista de miniaturas, compartida por la lista real
// y su skeleton para que no salte al cargar. Tarjetas de ≥8,5rem que se reparten
// el ancho: dos columnas a ~375px (§10), más a medida que crece la ventana.
export const GRID_CLASSES = 'grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-2 py-2'

// CLAUDE.md §6.3: la barra de selección sustituye a las cabeceras en la MISMA fila y
// altura para que la lista no salte al empezar a seleccionar. Los dos la comparten:
// 41px = botón `sm` (h-8, 32px) + pb-2 (8px) + borde inferior (1px), la altura de la
// barra de selección, que es la más alta de las dos. Si cambia el botón, cambia esto.
export const HEADER_ROW_CLASSES = 'flex min-h-[41px] items-center gap-3 border-b border-border-light px-3 pb-2'
