

## Plan: Auditoría de cálculos en la hoja experimental

### Resumen
Agregar secciones de auditoría/debug dentro de `src/pages/Experimental.tsx` para hacer trazable cada paso del cálculo CER proyectado. No se modifica ninguna otra vista ni funcionalidad existente.

---

### Cambios (solo en `src/pages/Experimental.tsx`)

#### 1. Ampliar tabla C (CER Oficial + Proyectado) con columnas de auditoría

Agregar columnas adicionales a la tabla de proyección diaria:
- **Tipo** (ya existe)
- **Tramo inflación** (ya existe)
- **Inflación mensual aplicada** (valor %)
- **Días del tramo**
- **Daily pace aplicado** (valor %)
- **CER día anterior**

Esto requiere enriquecer la data de `projectCER()` para que cada row devuelva también: `inflationRate`, `tramoDays`, `dailyPace`, `prevCER`. Se modifica la interfaz `CERProjectionRow` y la función `projectCER` internamente.

#### 2. Ampliar tabla de resultados con columnas intermedias de auditoría

La tabla "Resultado · Tasas CER Proyectadas" actualmente muestra: Ticker, Precio, Vto, Fecha CER (T-10), CER Proyectado, TNA 180 Proy., Duration.

Agregar columnas:
- **CER Inicial** (del bono)
- **Factor CER** = CER proyectado / CER inicial
- **Precio relativo** = Precio / 100
- **Adjusted Face** = 100 × Factor CER
- **Ratio** = Adjusted Face / Precio
- **Días 360** (d360 usado)
- **Retorno acumulado** = ratio - 1

Esto se calcula en `projectedRows` memo, extendiendo los campos devueltos.

#### 3. Panel de auditoría por ticker (expandible)

Debajo de la tabla de resultados, agregar una sección interactiva:
- Un `<select>` para elegir un ticker de la lista de bonos CER.
- Al seleccionar, mostrar una "ficha de auditoría" con:
  - Ticker, Precio, Vencimiento
  - Fecha CER relevante (T-10)
  - CER Inicial, CER Proyectado usado
  - Tramo de inflación que aplica a esa fecha CER
  - Inflación mensual del tramo, daily pace
  - Factor CER, Adjusted Face, Ratio
  - Fórmula reconstruida: `TNA180 = (ratio^(180/d360) - 1) × 2 × 100`
  - Resultado final

Se implementa con un estado `selectedAuditTicker` y un bloque condicional que renderiza la ficha.

#### 4. Mostrar tabla C completa (sin sampling) en modo auditoría

Agregar un toggle/checkbox "Ver todos los días" en la tabla C para mostrar `cerProjection` completa en vez de `projectionSample`. Esto permite auditar día por día.

---

### Archivos modificados
- `src/pages/Experimental.tsx` — único archivo modificado

### No se toca
- Ninguna otra página, componente, hook, o lógica existente.

