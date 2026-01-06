# Breakdown de Iconos para el Video Tutorial

## Categorización de Iconos

Los iconos están organizados por:
1. **INDEPENDIENTES** (fondo transparente, PNG/SVG) - Para animar por separado
2. **INTEGRADOS** (parte de composiciones) - Pueden estar en la misma imagen
3. **ESPECIALES** (con variaciones/estados) - Necesitan múltiples versiones

---

## 🎬 SECCIÓN 1: INTRO (0:00 - 0:45)

### Iconos Independientes (Fondo Transparente)

#### 1.1 🔒 **Icono de Candado (Paywall)**
- **Uso**: Aparece con fade-in (0:15-0:20), pulsa cuando se menciona "paywall" (0:20-0:30)
- **Especificaciones**:
  - Estilo: Lineal, minimalista
  - Tamaño: ~120x120px (para animación)
  - Color: Azul profundo (#2B6DFF) o púrpura (#7A4DFF)
  - Formato: PNG con transparencia
  - Variaciones necesarias:
    - Estado normal
    - Estado "pulsando" (escala 110%)
- **Archivo sugerido**: `icon_001_lock.png` (normal), `icon_001_lock_pulse.png` (pulsando)

#### 1.2 💰 **Icono de Créditos (Monetización)**
- **Uso**: Aparece con fade-in (0:15-0:20), muestra números animados cuando se menciona "credits dynamically" (0:20-0:30)
- **Especificaciones**:
  - Estilo: Moneda/token, lineal
  - Tamaño: ~120x120px
  - Color: Dorado/amarillo (#FFD700) o púrpura (#7A4DFF)
  - Formato: PNG con transparencia
  - Variaciones necesarias:
    - Estado normal
    - Estado con números animados (puede ser overlay separado)
- **Archivo sugerido**: `icon_002_credits.png`, `icon_002_credits_animated.png`

#### 1.3 🔐 **Icono OAuth (Autenticación)**
- **Uso**: Aparece con fade-in (0:15-0:20), muestra checkmark cuando se menciona "OAuth 2.1 endpoints" (0:20-0:30)
- **Especificaciones**:
  - Estilo: Candado con llave, o símbolo de seguridad
  - Tamaño: ~120x120px
  - Color: Azul (#2B6DFF)
  - Formato: PNG con transparencia
  - Variaciones necesarias:
    - Estado normal
    - Estado con checkmark (overlay)
- **Archivo sugerido**: `icon_003_oauth.png`, `icon_003_oauth_check.png`

#### 1.4 🖥️ **Iconos de Clientes (Cursor/Claude)**
- **Uso**: Aparecen con fade-in (0:15-0:20), se deslizan cuando se menciona "Cursor or Claude Desktop" (0:20-0:30)
- **Especificaciones**:
  - Estilo: Iconos genéricos de aplicación/cliente (NO usar logos reales)
  - Tamaño: ~100x100px cada uno
  - Color: Gris neutro (#6B7280) o azul suave
  - Formato: PNG con transparencia
  - Cantidad: 2 iconos (cliente 1 y cliente 2, genéricos)
- **Archivo sugerido**: `icon_004_client_1.png`, `icon_004_client_2.png`

---

## 📁 SECCIÓN 2: DEPENDENCIES (0:45 - 1:30)

### Iconos Independientes

#### 2.1 📦 **Icono de Paquete**
- **Uso**: Aparece en panel lateral (0:50-1:15) con texto "Solo se necesitan 3 dependencias"
- **Especificaciones**:
  - Estilo: Caja/paquete, lineal
  - Tamaño: ~80x80px
  - Color: Azul (#2B6DFF)
  - Formato: PNG con transparencia
- **Archivo sugerido**: `icon_005_package.png`

#### 2.2 ✅ **Marca de Verificación (Checkmark)**
- **Uso**: Aparece junto a cada dependencia cuando se menciona (0:50-1:15)
- **Especificaciones**:
  - Estilo: Check simple, lineal
  - Tamaño: ~40x40px (pequeño, para acompañar texto)
  - Color: Verde (#2ECC71)
  - Formato: PNG con transparencia
  - Variaciones necesarias:
    - Estado normal
    - Estado "apareciendo" (fade-in animado)
- **Archivo sugerido**: `icon_006_checkmark.png`, `icon_006_checkmark_fade.png`

### Iconos Integrados (en .env file)

#### 2.3 🔑 **Icono de Llave (API Key)**
- **Uso**: Aparece junto a `NVM_API_KEY` (1:30-1:40)
- **Especificaciones**:
  - Estilo: Llave, pequeño
  - Tamaño: ~32x32px
  - Color: Dorado (#FFD700)
  - Formato: Puede estar integrado en la imagen del .env o ser independiente
- **Archivo sugerido**: `icon_007_key.png` (si es independiente)

#### 2.4 🆔 **Icono de ID (Agent ID)**
- **Uso**: Aparece junto a `NVM_AGENT_ID` (1:30-1:40)
- **Especificaciones**:
  - Estilo: Badge/ID card, pequeño
  - Tamaño: ~32x32px
  - Color: Azul (#2B6DFF)
  - Formato: Puede estar integrado o ser independiente
- **Archivo sugerido**: `icon_008_id.png`

#### 2.5 🌍 **Icono de Mundo (Environment)**
- **Uso**: Aparece junto a `NVM_ENVIRONMENT` (1:30-1:40)
- **Especificaciones**:
  - Estilo: Globo/mundo, pequeño
  - Tamaño: ~32x32px
  - Color: Verde (#2ECC71)
  - Formato: Puede estar integrado o ser independiente
- **Archivo sugerido**: `icon_009_world.png`

#### 2.6 🔌 **Icono de Puerto (Port)**
- **Uso**: Aparece junto a `PORT` (1:30-1:40)
- **Especificaciones**:
  - Estilo: Conector/puerto, pequeño
  - Tamaño: ~32x32px
  - Color: Gris (#6B7280)
  - Formato: Puede estar integrado o ser independiente
- **Archivo sugerido**: `icon_010_port.png`

---

## 🔧 SECCIÓN 3: INITIALIZE PAYMENTS (1:30 - 2:15)

### Iconos Independientes

#### 3.1 💡 **Icono de Bombilla (Anotación)**
- **Uso**: Aparece en anotación lateral (2:05-2:10) con texto "Mismos imports que el SDK oficial de MCP"
- **Especificaciones**:
  - Estilo: Bombilla, lineal
  - Tamaño: ~60x60px
  - Color: Amarillo (#FFC107)
  - Formato: PNG con transparencia
- **Archivo sugerido**: `icon_011_lightbulb.png`

#### 3.2 ⚡ **Icono de Rayo (Momento Clave)**
- **Uso**: Aparece en panel lateral (2:10-2:15) junto a "Patrón singleton"
- **Especificaciones**:
  - Estilo: Rayo/energía, lineal
  - Tamaño: ~80x80px
  - Color: Amarillo brillante (#FFD700) o púrpura (#7A4DFF)
  - Formato: PNG con transparencia
  - Variaciones necesarias:
    - Estado normal
    - Estado "brillando" (glow effect)
- **Archivo sugerido**: `icon_012_lightning.png`, `icon_012_lightning_glow.png`

---

## 🛠️ SECCIÓN 4: REGISTER TOOL (2:15 - 5:00)

### Iconos Independientes

#### 4.1 📊 **Icono de Analytics (Observabilidad)**
- **Uso**: Aparece cuando se menciona "observability" (2:40-2:50)
- **Especificaciones**:
  - Estilo: Gráfico/analytics, lineal
  - Tamaño: ~80x80px
  - Color: Azul (#2B6DFF)
  - Formato: PNG con transparencia
- **Archivo sugerido**: `icon_013_analytics.png`

#### 4.2 🔍 **Icono de Lupa (Búsqueda/Tracking)**
- **Uso**: Aparece en panel lateral (2:40-2:50) con texto "¿Quién está llamando?"
- **Especificaciones**:
  - Estilo: Lupa, lineal
  - Tamaño: ~60x60px
  - Color: Azul (#2B6DFF)
  - Formato: PNG con transparencia
- **Archivo sugerido**: `icon_014_search.png`

#### 4.3 📈 **Icono de Gráfico Ascendente (Observabilidad)**
- **Uso**: Aparece en panel lateral (2:40-2:50) con texto "Observabilidad lista"
- **Especificaciones**:
  - Estilo: Gráfico de línea ascendente, lineal
  - Tamaño: ~60x60px
  - Color: Verde (#2ECC71)
  - Formato: PNG con transparencia
- **Archivo sugerido**: `icon_015_chart.png`

#### 4.4 💰 **Icono de Créditos (Variación para parámetro)**
- **Uso**: Aparece junto al parámetro de créditos en `registerTool` (4:00-4:10)
- **Especificaciones**:
  - Estilo: Moneda/token (mismo que 1.2 pero más pequeño)
  - Tamaño: ~40x40px
  - Color: Dorado (#FFD700)
  - Formato: PNG con transparencia
- **Archivo sugerido**: `icon_016_credits_small.png`

---

## 📦 SECCIÓN 5: RESOURCES AND PROMPTS (5:00 - 6:15)

### Iconos Independientes

#### 5.1 ✅ **Marcas de Verificación (Pattern Consistency)**
- **Uso**: Aparecen en panel lateral (5:15-5:30) junto a "Tools, Resources, Prompts"
- **Especificaciones**:
  - Estilo: Checkmarks (mismo que 2.2)
  - Tamaño: ~40x40px cada una
  - Color: Verde (#2ECC71)
  - Formato: PNG con transparencia
  - Cantidad: 3 checkmarks (pueden ser el mismo icono repetido)
- **Archivo sugerido**: Reutilizar `icon_006_checkmark.png`

---

## 🚀 SECCIÓN 6: START SERVER (6:15 - 7:30)

### Iconos Independientes

#### 6.1 ⚡ **Icono de Rayo (Magic Moment)**
- **Uso**: Aparece sobre `payments.mcp.start` (6:15-6:25) con overlay "AQUÍ OCURRE LA MAGIA"
- **Especificaciones**:
  - Estilo: Rayo grande, impactante
  - Tamaño: ~200x200px (más grande que 3.2)
  - Color: Amarillo brillante (#FFD700) con glow
  - Formato: PNG con transparencia
  - Variaciones necesarias:
    - Estado normal
    - Estado "pulsando" (3 pulsos)
- **Archivo sugerido**: `icon_017_lightning_large.png`, `icon_017_lightning_pulse.png`

#### 6.2 🔐 **Icono OAuth (Variación para endpoints)**
- **Uso**: Aparece junto a cada endpoint OAuth en la lista (6:25-6:40, 6:50-7:00)
- **Especificaciones**:
  - Estilo: Candado/seguridad (mismo que 1.3 pero más pequeño)
  - Tamaño: ~32x32px
  - Color: Azul (#2B6DFF)
  - Formato: PNG con transparencia
- **Archivo sugerido**: `icon_018_oauth_small.png`

#### 6.3 ✅ **Marcas de Verificación (Endpoints List)**
- **Uso**: Aparecen junto a cada endpoint en la lista animada (6:25-6:40)
- **Especificaciones**:
  - Estilo: Checkmarks (mismo que 2.2)
  - Tamaño: ~32x32px
  - Color: Verde (#2ECC71)
  - Formato: PNG con transparencia
  - Cantidad: 9 checkmarks (uno por cada endpoint)
- **Archivo sugerido**: Reutilizar `icon_006_checkmark.png` (versión pequeña)

---

## 🎮 SECCIÓN 7: DEMO WITH CURSOR (7:30 - 9:15)

### Iconos Independientes

#### 7.1 🔐 **Icono OAuth (Variación para terminal)**
- **Uso**: Aparece junto a endpoints OAuth en la salida del terminal (7:40-7:50, 6:50-7:00)
- **Especificaciones**:
  - Estilo: Candado (mismo que 6.2)
  - Tamaño: ~24x24px (muy pequeño, para terminal)
  - Color: Amarillo (#FFC107) para resaltar en terminal
  - Formato: PNG con transparencia
- **Archivo sugerido**: `icon_019_oauth_terminal.png`

#### 7.2 ✅ **Marcas de Verificación (Config Panel)**
- **Uso**: Aparecen en panel lateral (7:50-8:00) con mensajes de confirmación
- **Especificaciones**:
  - Estilo: Checkmarks (mismo que 2.2)
  - Tamaño: ~40x40px
  - Color: Verde (#2ECC71)
  - Formato: PNG con transparencia
  - Cantidad: 3 checkmarks
- **Archivo sugerido**: Reutilizar `icon_006_checkmark.png`

#### 7.3 ✅ **Marcas de Verificación (Background Process)**
- **Uso**: Aparecen en panel lateral (8:35-8:50) para cada paso del proceso
- **Especificaciones**:
  - Estilo: Checkmarks (mismo que 2.2)
  - Tamaño: ~40x40px
  - Color: Verde (#2ECC71)
  - Formato: PNG con transparencia
  - Variaciones necesarias:
    - Estado "apareciendo" (fade-in)
    - Estado "completado" (normal)
- **Archivo sugerido**: `icon_006_checkmark.png`, `icon_006_checkmark_fade.png`

#### 7.4 💰 **Icono de Créditos (Burn Credits)**
- **Uso**: Aparece en panel lateral (8:35-8:50) con "Quemar créditos" y cuenta regresiva
- **Especificaciones**:
  - Estilo: Moneda/token (mismo que 1.2)
  - Tamaño: ~60x60px
  - Color: Dorado (#FFD700)
  - Formato: PNG con transparencia
  - Variaciones necesarias:
    - Estado normal
    - Estado "quemando" (animación de reducción/escala)
- **Archivo sugerido**: `icon_020_credits_burn.png`, `icon_020_credits_burn_anim.png`

---

## 🎯 SECCIÓN 8: CLOSING (9:15 - 10:00)

### Iconos Independientes

#### 8.1 🔐 **Icono OAuth (Summary)**
- **Uso**: Aparece en animación de resumen (9:25-9:40) con texto "OAuth 2.1 automático"
- **Especificaciones**:
  - Estilo: Candado/seguridad (mismo que 1.3)
  - Tamaño: ~100x100px
  - Color: Azul (#2B6DFF)
  - Formato: PNG con transparencia
  - Variaciones necesarias:
    - Estado normal
    - Estado "pulsando" (cuando aparece)
- **Archivo sugerido**: `icon_021_oauth_summary.png`, `icon_021_oauth_summary_pulse.png`

#### 8.2 💰 **Icono de Créditos (Summary)**
- **Uso**: Aparece en animación de resumen (9:25-9:40) con texto "Monetización integrada"
- **Especificaciones**:
  - Estilo: Moneda/token (mismo que 1.2)
  - Tamaño: ~100x100px
  - Color: Dorado (#FFD700)
  - Formato: PNG con transparencia
  - Variaciones necesarias:
    - Estado normal
    - Estado "pulsando" (cuando aparece)
- **Archivo sugerido**: `icon_022_credits_summary.png`, `icon_022_credits_summary_pulse.png`

#### 8.3 📊 **Icono de Analytics (Summary)**
- **Uso**: Aparece en animación de resumen (9:25-9:40) con texto "Contexto de autorización"
- **Especificaciones**:
  - Estilo: Gráfico/analytics (mismo que 4.1)
  - Tamaño: ~100x100px
  - Color: Azul (#2B6DFF)
  - Formato: PNG con transparencia
  - Variaciones necesarias:
    - Estado normal
    - Estado "pulsando" (cuando aparece)
- **Archivo sugerido**: `icon_023_analytics_summary.png`, `icon_023_analytics_summary_pulse.png`

#### 8.4 🚀 **Icono de Cohete (Infraestructura)**
- **Uso**: Aparece en animación de resumen (9:25-9:40) con texto "Infraestructura HTTP completa"
- **Especificaciones**:
  - Estilo: Cohete/nave, lineal
  - Tamaño: ~100x100px
  - Color: Púrpura (#7A4DFF)
  - Formato: PNG con transparencia
  - Variaciones necesarias:
    - Estado normal
    - Estado "pulsando" (cuando aparece)
- **Archivo sugerido**: `icon_024_rocket.png`, `icon_024_rocket_pulse.png`

#### 8.5 📚 **Icono de Libro (Documentación)**
- **Uso**: Aparece en pantalla de cierre (9:50-10:00) con texto "Ejemplo de código completo"
- **Especificaciones**:
  - Estilo: Libro/documento, lineal
  - Tamaño: ~60x60px
  - Color: Azul (#2B6DFF)
  - Formato: PNG con transparencia
- **Archivo sugerido**: `icon_025_book.png`

#### 8.6 📖 **Icono de Documento (Documentación)**
- **Uso**: Aparece en pantalla de cierre (9:50-10:00) con texto "Documentación"
- **Especificaciones**:
  - Estilo: Documento/página, lineal
  - Tamaño: ~60x60px
  - Color: Azul (#2B6DFF)
  - Formato: PNG con transparencia
- **Archivo sugerido**: `icon_026_document.png`

#### 8.7 🎓 **Icono de Graduación (Tutoriales)**
- **Uso**: Aparece en pantalla de cierre (9:50-10:00) con texto "Más tutoriales"
- **Especificaciones**:
  - Estilo: Birrete/graduación, lineal
  - Tamaño: ~60x60px
  - Color: Púrpura (#7A4DFF)
  - Formato: PNG con transparencia
- **Archivo sugerido**: `icon_027_graduation.png`

---

## 📊 DIAGRAMAS Y ELEMENTOS ESPECIALES

### Diagrama de Flujo (3:10-3:25)

#### 8.8 **Cajas del Diagrama de Flujo**
- **Uso**: Aparecen en animación sobre el código (3:10-3:25)
- **Especificaciones**:
  - Estilo: Cajas con bordes redondeados, fondo blanco con sombra
  - Tamaño: Variable (según contenido)
  - Color: Fondo blanco, borde azul (#2B6DFF)
  - Formato: SVG o PNG con transparencia
  - Elementos necesarios:
    - Caja "Tool Call"
    - Caja "Handler"
    - Caja "Credits Function"
    - Caja "Burn Credits"
    - Flechas conectando las cajas
- **Archivo sugerido**: `diagram_001_flow_boxes.svg` (mejor SVG para escalar)

#### 8.9 **Flechas del Diagrama**
- **Uso**: Conectan las cajas del diagrama de flujo
- **Especificaciones**:
  - Estilo: Flechas simples, línea azul
  - Tamaño: Variable
  - Color: Azul (#2B6DFF)
  - Formato: SVG (mejor para animar)
- **Archivo sugerido**: `diagram_002_arrows.svg`

---

## 🎨 RESUMEN POR PRIORIDAD

### **ALTA PRIORIDAD** (Iconos que se animan mucho o son clave)

1. 🔒 **Candado (Paywall)** - `icon_001_lock.png` + variación pulse
2. 💰 **Créditos** - `icon_002_credits.png` + variación animated
3. 🔐 **OAuth** - `icon_003_oauth.png` + variación check
4. ⚡ **Rayo (Magic Moment)** - `icon_017_lightning_large.png` + variación pulse
5. ✅ **Checkmark** - `icon_006_checkmark.png` + variación fade
6. 🚀 **Cohete** - `icon_024_rocket.png` + variación pulse

### **MEDIA PRIORIDAD** (Iconos que aparecen varias veces)

7. 📦 **Paquete** - `icon_005_package.png`
8. 💡 **Bombilla** - `icon_011_lightbulb.png`
9. 📊 **Analytics** - `icon_013_analytics.png` + variación summary
10. 🔍 **Lupa** - `icon_014_search.png`
11. 📈 **Gráfico** - `icon_015_chart.png`

### **BAJA PRIORIDAD** (Iconos pequeños o integrados)

12. 🔑 **Llave** - `icon_007_key.png`
13. 🆔 **ID** - `icon_008_id.png`
14. 🌍 **Mundo** - `icon_009_world.png`
15. 🔌 **Puerto** - `icon_010_port.png`
16. 🖥️ **Clientes** - `icon_004_client_1.png`, `icon_004_client_2.png`
17. 📚 **Libro** - `icon_025_book.png`
18. 📖 **Documento** - `icon_026_document.png`
19. 🎓 **Graduación** - `icon_027_graduation.png`

---

## 📋 ESPECIFICACIONES TÉCNICAS GENERALES

### Formato
- **Independientes**: PNG con transparencia (alpha channel)
- **Diagramas**: SVG (preferible para escalar y animar)
- **Resolución**: Mínimo 2x para pantallas Retina (si es PNG, 240x240px para icono de 120px)

### Estilo Visual
- **Línea**: 2-3px de grosor
- **Esquinas**: Redondeadas (border-radius ~4px en iconos)
- **Colores**: Paleta Nevermined (azul #2B6DFF, púrpura #7A4DFF, verde #2ECC71, amarillo #FFD700)
- **Sombra**: Sutil (opcional, solo en iconos grandes)

### Naming Convention
- `icon_XXX_description.png` - Iconos independientes
- `icon_XXX_description_variation.png` - Variaciones (pulse, fade, glow, etc.)
- `diagram_XXX_description.svg` - Diagramas y elementos complejos

---

## ✅ CHECKLIST DE GENERACIÓN

### Iconos Base (Sin variaciones)
- [ ] icon_001_lock.png
- [ ] icon_002_credits.png
- [ ] icon_003_oauth.png
- [ ] icon_004_client_1.png
- [ ] icon_004_client_2.png
- [ ] icon_005_package.png
- [ ] icon_006_checkmark.png
- [ ] icon_007_key.png
- [ ] icon_008_id.png
- [ ] icon_009_world.png
- [ ] icon_010_port.png
- [ ] icon_011_lightbulb.png
- [ ] icon_012_lightning.png
- [ ] icon_013_analytics.png
- [ ] icon_014_search.png
- [ ] icon_015_chart.png
- [ ] icon_016_credits_small.png
- [ ] icon_017_lightning_large.png
- [ ] icon_018_oauth_small.png
- [ ] icon_019_oauth_terminal.png
- [ ] icon_020_credits_burn.png
- [ ] icon_021_oauth_summary.png
- [ ] icon_022_credits_summary.png
- [ ] icon_023_analytics_summary.png
- [ ] icon_024_rocket.png
- [ ] icon_025_book.png
- [ ] icon_026_document.png
- [ ] icon_027_graduation.png

### Variaciones Animadas
- [ ] icon_001_lock_pulse.png
- [ ] icon_002_credits_animated.png
- [ ] icon_003_oauth_check.png
- [ ] icon_006_checkmark_fade.png
- [ ] icon_012_lightning_glow.png
- [ ] icon_017_lightning_pulse.png
- [ ] icon_020_credits_burn_anim.png
- [ ] icon_021_oauth_summary_pulse.png
- [ ] icon_022_credits_summary_pulse.png
- [ ] icon_023_analytics_summary_pulse.png
- [ ] icon_024_rocket_pulse.png

### Diagramas
- [ ] diagram_001_flow_boxes.svg
- [ ] diagram_002_arrows.svg

**TOTAL: ~39 archivos de iconos**

