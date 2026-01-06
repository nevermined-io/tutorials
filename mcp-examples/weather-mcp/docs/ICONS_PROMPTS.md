# Prompts para Generación de Iconos con IA

## ⚠️ IMPORTANTE: ¿Cuándo Generar Variaciones?

### Opción A: Solo Icono Base (Recomendado para After Effects/Premiere)
Si vas a animar en **After Effects, Premiere, Final Cut, o similar**:
- **Solo necesitas el icono base (versión "normal")**
- Aplica los efectos de animación (pulse, fade, glow) directamente en el editor de video usando:
  - Keyframes de escala (para pulse: 100% → 110% → 100%)
  - Keyframes de opacidad (para fade: 0% → 100%)
  - Efectos de glow/brillo (para glow: aplicar efecto de brillo con keyframes)
- **Ventaja**: Más flexible, puedes ajustar la animación sin regenerar iconos

### Opción B: Icono Base + Variación (Para Animaciones Pre-renderizadas)
Si vas a usar **animaciones pre-renderizadas (GIF, sprite sheets, o animaciones frame-by-frame)**:
- **Necesitas ambos archivos**: versión normal + versión con efecto
- Útil si:
  - Exportas GIFs animados
  - Usas herramientas que requieren frames específicos
  - Quieres tener la animación "baked in" al icono

### Recomendación
**Genera solo la versión "normal"** de cada icono. Las variaciones (pulse, fade, glow) se pueden crear en post-producción con más control y flexibilidad.

**Excepción**: Si una variación cambia el **contenido visual** (no solo el efecto), entonces sí necesitas ambos:
- ✅ **Necesitas ambos**: Icono con checkmark overlay (cambia el contenido)
- ✅ **Necesitas ambos**: Icono con números animados (cambia el contenido)
- ❌ **Solo necesitas base**: Pulse, fade, glow (solo efectos que puedes aplicar en post)

---

## Contexto General para Todos los Prompts

**Estilo base**: Iconos lineales minimalistas estilo SaaS moderno (2025), limpios y profesionales. Sin relleno sólido, solo líneas y formas simples. Bordes redondeados sutiles. Sin emojis, sin texto, sin gradientes complejos.

**Paleta de colores Nevermined**:
- Azul principal: #2B6DFF
- Púrpura: #7A4DFF
- Verde éxito: #2ECC71
- Amarillo/dorado: #FFD700 o #FFC107
- Gris neutro: #6B7280

**Formato**: PNG con fondo transparente, alta resolución (mínimo 2x para Retina), líneas de 2-3px de grosor.

---

## 🔒 ICONO 1: CANDADO (PAYWALL)

### Versión Normal ⭐ (OBLIGATORIO)
**Prompt:**
```
Create a minimalist linear lock icon in SaaS style. Simple padlock shape with a keyhole, clean lines, no fill, only outline. Rounded corners. Color: deep blue (#2B6DFF). Line thickness: 2-3px. Size: 120x120px. Transparent background. Modern, professional, tech product aesthetic. No shadows, no gradients, no text, no emojis.
```

### Versión Pulse (Opcional - Solo si necesitas pre-renderizado)
**Nota**: Este efecto se puede crear en After Effects con keyframes de escala + glow. Solo genera si necesitas animación pre-renderizada.
**Prompt:**
```
Same as above but with a subtle glow effect around the lock, slightly larger scale (110%), suggesting it's pulsing or active. The glow should be soft, same blue color but with transparency gradient outward.
```

---

## 💰 ICONO 2: CRÉDITOS (MONETIZACIÓN)

### Versión Normal ⭐ (OBLIGATORIO)
**Prompt:**
```
Create a minimalist linear coin/token icon in SaaS style. Simple circular coin with a dollar sign or currency symbol in the center, clean lines, no fill, only outline. Rounded edges. Color: gold/yellow (#FFD700). Line thickness: 2-3px. Size: 120x120px. Transparent background. Modern, professional, financial tech aesthetic. No shadows, no gradients, no text labels, no emojis.
```

### Versión Animated (con números) ⭐ (OBLIGATORIO - Cambia contenido visual)
**Nota**: Esta versión SÍ cambia el contenido (añade números), por lo que necesitas generarla.
**Prompt:**
```
Same coin icon as above, but with small animated number indicators (like "1", "5", "10") floating around it or overlaid. The numbers should be small, clean, sans-serif font, same gold color. Suggesting dynamic credit calculation.
```

---

## 🔐 ICONO 3: OAUTH (AUTENTICACIÓN)

### Versión Normal ⭐ (OBLIGATORIO)
**Prompt:**
```
Create a minimalist linear security/authentication icon in SaaS style. A lock with a key, or a shield with a checkmark, or a combination of lock and keyhole. Clean lines, no fill, only outline. Rounded corners. Color: deep blue (#2B6DFF). Line thickness: 2-3px. Size: 120x120px. Transparent background. Modern, professional, security tech aesthetic. No shadows, no gradients, no text, no emojis.
```

### Versión con Checkmark ⭐ (OBLIGATORIO - Cambia contenido visual)
**Nota**: Esta versión SÍ cambia el contenido (añade checkmark), por lo que necesitas generarla.
**Prompt:**
```
Same security icon as above, but with a small checkmark overlay in the bottom right corner. The checkmark should be green (#2ECC71), clean, simple, suggesting verified or authenticated state.
```

---

## 🖥️ ICONO 4: CLIENTES (CURSOR/CLAUDE - GENÉRICO)

### Cliente 1
**Prompt:**
```
Create a minimalist linear application/client icon in SaaS style. Simple window/app interface icon - a rectangle with a small icon inside (like a code symbol or app symbol). Clean lines, no fill, only outline. Rounded corners. Color: neutral gray (#6B7280) or soft blue. Line thickness: 2-3px. Size: 100x100px. Transparent background. Modern, professional, generic client application aesthetic. No brand logos, no text, no emojis.
```

### Cliente 2
**Prompt:**
```
Same style as Client 1, but with a slightly different internal symbol (maybe a different shape or icon inside the window) to differentiate it as a second client. Same size, same style, same color scheme.
```

---

## 📦 ICONO 5: PAQUETE

**Prompt:**
```
Create a minimalist linear package/box icon in SaaS style. Simple 3D box or package shape with a ribbon or label, clean lines, no fill, only outline. Rounded corners. Color: deep blue (#2B6DFF). Line thickness: 2-3px. Size: 80x80px. Transparent background. Modern, professional, delivery/package aesthetic. No shadows, no gradients, no text, no emojis.
```

---

## ✅ ICONO 6: CHECKMARK (MARCA DE VERIFICACIÓN)

### Versión Normal
**Prompt:**
```
Create a minimalist linear checkmark icon in SaaS style. Simple checkmark/tick mark, clean curved line, no fill, only outline. Rounded line ends. Color: green (#2ECC71). Line thickness: 2-3px. Size: 40x40px (small version) and 80x80px (large version). Transparent background. Modern, professional, success/verified aesthetic. No shadows, no gradients, no text, no emojis.
```

### Versión Fade (Animada)
**Prompt:**
```
Same checkmark as above, but with a fade effect - the icon should appear semi-transparent or with a soft glow, suggesting it's fading in or appearing. The opacity should be around 60-70% to suggest animation state.
```

---

## 🔑 ICONO 7: LLAVE (API KEY)

**Prompt:**
```
Create a minimalist linear key icon in SaaS style. Simple key shape with a keyhole or key head, clean lines, no fill, only outline. Rounded edges. Color: gold (#FFD700). Line thickness: 2px. Size: 32x32px. Transparent background. Modern, professional, security/access aesthetic. No shadows, no gradients, no text, no emojis.
```

---

## 🆔 ICONO 8: ID (AGENT ID)

**Prompt:**
```
Create a minimalist linear ID badge/card icon in SaaS style. Simple rectangular badge or ID card shape, clean lines, no fill, only outline. Rounded corners. Color: deep blue (#2B6DFF). Line thickness: 2px. Size: 32x32px. Transparent background. Modern, professional, identification/credential aesthetic. No shadows, no gradients, no text, no emojis.
```

---

## 🌍 ICONO 9: MUNDO (ENVIRONMENT)

**Prompt:**
```
Create a minimalist linear globe/world icon in SaaS style. Simple globe or planet shape with latitude/longitude lines, clean lines, no fill, only outline. Rounded shape. Color: green (#2ECC71). Line thickness: 2px. Size: 32x32px. Transparent background. Modern, professional, global/environment aesthetic. No shadows, no gradients, no text, no emojis.
```

---

## 🔌 ICONO 10: PUERTO (PORT)

**Prompt:**
```
Create a minimalist linear port/connector icon in SaaS style. Simple plug or connector shape, clean lines, no fill, only outline. Rounded edges. Color: neutral gray (#6B7280). Line thickness: 2px. Size: 32x32px. White background. Modern, professional, connection/port aesthetic. No shadows, no gradients, no text, no emojis.
```

---

## 💡 ICONO 11: BOMBILLA (ANOTACIÓN)

**Prompt:**
```
Create a minimalist linear lightbulb icon in SaaS style. Simple lightbulb shape, clean lines, no fill, only outline. Rounded base. Color: yellow (#FFC107). Line thickness: 2-3px. Size: 60x60px. White background. Modern, professional, idea/insight aesthetic. No shadows, no gradients, no text, no emojis.
```

---

## ⚡ ICONO 12: RAYO (MOMENTO CLAVE - PEQUEÑO)

### Versión Normal
**Prompt:**
```
Create a minimalist linear lightning bolt icon in SaaS style. Simple zigzag lightning bolt shape, clean lines, no fill, only outline. Sharp angles. Color: bright yellow (#FFD700) or purple (#7A4DFF). Line thickness: 3px. Size: 80x80px. White background. Modern, professional, energy/power aesthetic. No shadows, no gradients, no text, no emojis.
```

### Versión Glow
**Prompt:**
```
Same lightning bolt as above, but with a subtle glow effect around it, suggesting energy or importance. The glow should be soft, same color but with transparency gradient outward.
```

---

## 📊 ICONO 13: ANALYTICS

### Versión Normal
**Prompt:**
```
Create a minimalist linear analytics/chart icon in SaaS style. Simple bar chart or line chart with 3-4 bars/lines, clean lines, no fill, only outline. Rounded bar tops. Color: deep blue (#2B6DFF). Line thickness: 2-3px. Size: 80x80px. White background. Modern, professional, data/analytics aesthetic. No shadows, no gradients, no text, no emojis.
```

### Versión Summary (Grande)
**Prompt:**
```
Same analytics icon as above, but larger size: 100x100px. Same style, same colors, same specifications.
```

### Versión Summary Pulse
**Prompt:**
```
Same as summary version, but with a subtle pulse effect - slightly larger scale (110%), suggesting it's animating or appearing.
```

---

## 🔍 ICONO 14: LUPA (BÚSQUEDA/TRACKING)

**Prompt:**
```
Create a minimalist linear magnifying glass/search icon in SaaS style. Simple magnifying glass with handle, clean lines, no fill, only outline. Rounded glass shape. Color: deep blue (#2B6DFF). Line thickness: 2-3px. Size: 60x60px. White background. Modern, professional, search/tracking aesthetic. No shadows, no gradients, no text, no emojis.
```

---

## 📈 ICONO 15: GRÁFICO ASCENDENTE

**Prompt:**
```
Create a minimalist linear ascending chart/trend icon in SaaS style. Simple line chart going upward (diagonal line with small data points), clean lines, no fill, only outline. Rounded line ends. Color: green (#2ECC71). Line thickness: 2-3px. Size: 60x60px. White background. Modern, professional, growth/trend aesthetic. No shadows, no gradients, no text, no emojis.
```

---

## 💰 ICONO 16: CRÉDITOS (PEQUEÑO - PARA PARÁMETROS)

**Prompt:**
```
Create a minimalist linear coin/token icon in SaaS style. Same as icon_002_credits but smaller. Simple circular coin with currency symbol, clean lines, no fill, only outline. Rounded edges. Color: gold (#FFD700). Line thickness: 2px. Size: 40x40px. White background. Modern, professional, financial tech aesthetic. No shadows, no gradients, no text, no emojis.
```

---

## ⚡ ICONO 17: RAYO (MAGIC MOMENT - GRANDE)

### Versión Normal
**Prompt:**
```
Create a minimalist linear lightning bolt icon in SaaS style. Large, impactful lightning bolt shape, clean lines, no fill, only outline. Sharp angles. Color: bright yellow (#FFD700) with purple accent (#7A4DFF). Line thickness: 4px. Size: 200x200px. White background. Modern, professional, powerful energy/power aesthetic. No shadows, no gradients, no text, no emojis.
```

### Versión Pulse (3 pulsos)
**Prompt:**
```
Same lightning bolt as above, but with a strong glow effect and slightly larger scale (110-115%), suggesting it's pulsing three times. The glow should be prominent, same colors but with transparency gradient outward. Multiple glow rings to suggest pulsing animation.
```

---

## 🔐 ICONO 18: OAUTH (PEQUEÑO - PARA ENDPOINTS)

**Prompt:**
```
Create a minimalist linear security/authentication icon in SaaS style. Same as icon_003_oauth but smaller. Lock with key or shield, clean lines, no fill, only outline. Rounded corners. Color: deep blue (#2B6DFF). Line thickness: 2px. Size: 32x32px. White background. Modern, professional, security tech aesthetic. No shadows, no gradients, no text, no emojis.
```

---

## 🔐 ICONO 19: OAUTH (TERMINAL - MUY PEQUEÑO)

**Prompt:**
```
Create a minimalist linear security/authentication icon in SaaS style. Same as icon_003_oauth but very small. Lock or shield, clean lines, no fill, only outline. Rounded corners. Color: yellow (#FFC107) for terminal visibility. Line thickness: 1.5px. Size: 24x24px. White background. Modern, professional, security tech aesthetic. No shadows, no gradients, no text, no emojis.
```

---

## 💰 ICONO 20: CRÉDITOS (BURN - QUEMAR)

### Versión Normal
**Prompt:**
```
Create a minimalist linear coin/token icon in SaaS style. Same as icon_002_credits but for burn animation. Simple circular coin, clean lines, no fill, only outline. Rounded edges. Color: gold (#FFD700). Line thickness: 2-3px. Size: 60x60px. White background. Modern, professional, financial tech aesthetic. No shadows, no gradients, no text, no emojis.
```

### Versión Burn Animation
**Prompt:**
```
Same coin icon as above, but with a countdown or reduction effect - the coin should appear slightly smaller (90% scale) or with a "minus" indicator, suggesting credits are being deducted. Could include small "-1" or "-3" text overlay in clean sans-serif font, same gold color.
```

---

## 🔐 ICONO 21: OAUTH (SUMMARY)

### Versión Normal
**Prompt:**
```
Create a minimalist linear security/authentication icon in SaaS style. Same as icon_003_oauth but summary size. Lock with key or shield, clean lines, no fill, only outline. Rounded corners. Color: deep blue (#2B6DFF). Line thickness: 3px. Size: 100x100px. White background. Modern, professional, security tech aesthetic. No shadows, no gradients, no text, no emojis.
```

### Versión Pulse
**Prompt:**
```
Same security icon as above, but with a subtle pulse effect - slightly larger scale (110%), suggesting it's animating or appearing. Soft glow around the icon.
```

---

## 💰 ICONO 22: CRÉDITOS (SUMMARY)

### Versión Normal
**Prompt:**
```
Create a minimalist linear coin/token icon in SaaS style. Same as icon_002_credits but summary size. Simple circular coin with currency symbol, clean lines, no fill, only outline. Rounded edges. Color: gold (#FFD700). Line thickness: 3px. Size: 100x100px. White background. Modern, professional, financial tech aesthetic. No shadows, no gradients, no text, no emojis.
```

### Versión Pulse
**Prompt:**
```
Same coin icon as above, but with a subtle pulse effect - slightly larger scale (110%), suggesting it's animating or appearing. Soft glow around the icon.
```

---

## 📊 ICONO 23: ANALYTICS (SUMMARY)

### Versión Normal
**Prompt:**
```
Create a minimalist linear analytics/chart icon in SaaS style. Same as icon_013_analytics but summary size. Simple bar chart or line chart, clean lines, no fill, only outline. Rounded bar tops. Color: deep blue (#2B6DFF). Line thickness: 3px. Size: 100x100px. White background. Modern, professional, data/analytics aesthetic. No shadows, no gradients, no text, no emojis.
```

### Versión Pulse
**Prompt:**
```
Same analytics icon as above, but with a subtle pulse effect - slightly larger scale (110%), suggesting it's animating or appearing. Soft glow around the icon.
```

---

## 🚀 ICONO 24: COHETE (INFRAESTRUCTURA)

### Versión Normal
**Prompt:**
```
Create a minimalist linear rocket/spaceship icon in SaaS style. Simple rocket shape pointing upward, clean lines, no fill, only outline. Rounded nose. Color: purple (#7A4DFF). Line thickness: 3px. Size: 100x100px. White background. Modern, professional, launch/infrastructure aesthetic. No shadows, no gradients, no text, no emojis.
```

### Versión Pulse
**Prompt:**
```
Same rocket icon as above, but with a subtle pulse effect - slightly larger scale (110%), suggesting it's animating or appearing. Soft glow around the icon, maybe with small motion lines suggesting upward movement.
```

---

## 📚 ICONO 25: LIBRO (DOCUMENTACIÓN)

**Prompt:**
```
Create a minimalist linear book icon in SaaS style. Simple open book or closed book shape, clean lines, no fill, only outline. Rounded corners. Color: deep blue (#2B6DFF). Line thickness: 2-3px. Size: 60x60px. White background. Modern, professional, documentation/knowledge aesthetic. No shadows, no gradients, no text, no emojis.
```

---

## 📖 ICONO 26: DOCUMENTO (DOCUMENTACIÓN)

**Prompt:**
```
Create a minimalist linear document/page icon in SaaS style. Simple document or page shape with a corner fold, clean lines, no fill, only outline. Rounded corners. Color: deep blue (#2B6DFF). Line thickness: 2-3px. Size: 60x60px. White background. Modern, professional, documentation/file aesthetic. No shadows, no gradients, no text, no emojis.
```

---

## 🎓 ICONO 27: GRADUACIÓN (TUTORIALES)

**Prompt:**
```
Create a minimalist linear graduation cap icon in SaaS style. Simple mortarboard/graduation cap shape, clean lines, no fill, only outline. Rounded edges. Color: purple (#7A4DFF). Line thickness: 2-3px. Size: 60x60px. White background. Modern, professional, education/tutorial aesthetic. No shadows, no gradients, no text, no emojis.
```

---

## 📡 ICONO 28: ANTENA/SATÉLITE (MCP ENDPOINT - CONSOLA)

**Prompt:**
```
Create a minimalist linear satellite/antenna icon in SaaS style. Simple satellite dish or antenna shape, clean lines, no fill, only outline. Rounded edges. Color: deep blue (#2B6DFF) or green (#2ECC71). Line thickness: 2px. Size: 32x32px or 40x40px. White background. Modern, professional, communication/endpoint aesthetic. No shadows, no gradients, no text, no emojis.
```

---

## 🏥 ICONO 29: HOSPITAL/HEALTH (HEALTH CHECK - CONSOLA)

**Prompt:**
```
Create a minimalist linear health/medical cross icon in SaaS style. Simple cross or medical symbol shape, clean lines, no fill, only outline. Rounded edges. Color: green (#2ECC71) or deep blue (#2B6DFF). Line thickness: 2px. Size: 32x32px or 40x40px. White background. Modern, professional, health/status check aesthetic. No shadows, no gradients, no text, no emojis.
```

---

## 🛠️ ICONO 30: HERRAMIENTAS (TOOLS - CONSOLA)

**Prompt:**
```
Create a minimalist linear tools/wrench icon in SaaS style. Simple wrench or tool shape, clean lines, no fill, only outline. Rounded edges. Color: deep blue (#2B6DFF) or purple (#7A4DFF). Line thickness: 2px. Size: 32x32px or 40x40px. White background. Modern, professional, tools/utilities aesthetic. No shadows, no gradients, no text, no emojis.
```

---

## 💬 ICONO 31: MENSAJE/CHAT (PROMPTS - CONSOLA)

**Prompt:**
```
Create a minimalist linear chat/message bubble icon in SaaS style. Simple speech bubble or chat bubble shape, clean lines, no fill, only outline. Rounded corners. Color: deep blue (#2B6DFF) or purple (#7A4DFF). Line thickness: 2px. Size: 32x32px or 40x40px. White background. Modern, professional, communication/chat aesthetic. No shadows, no gradients, no text, no emojis.
```

---

## 📊 DIAGRAMA 1: CAJAS DE FLUJO

**Prompt:**
```
Create a minimalist flow diagram with 4 rectangular boxes connected by arrows. Each box should have:
- Rounded corners (8px radius)
- White background with subtle shadow
- Blue border (#2B6DFF, 2px)
- Clean sans-serif text inside (if text is needed, use: "Tool Call", "Handler", "Credits Function", "Burn Credits")
- Box size: approximately 150x80px each
- Arrows between boxes: simple blue arrows (#2B6DFF, 2px line)
- Overall layout: horizontal flow from left to right
- Transparent background for the diagram
- Modern, professional SaaS aesthetic
- No gradients, no complex shadows, clean and minimal
```

**Formato**: SVG (mejor para escalar y animar)

---

## 📊 DIAGRAMA 2: FLECHAS

**Prompt:**
```
Create simple minimalist arrows for connecting flow diagram boxes. Clean arrow shape pointing right, single line with arrowhead, no fill, only outline. Color: deep blue (#2B6DFF). Line thickness: 2px. Arrowhead should be simple triangle. Size: variable (to fit between boxes). Transparent background. Modern, professional, clean aesthetic. No shadows, no gradients.
```

**Formato**: SVG (mejor para escalar y animar)

---

## 🎨 PROMPT BASE PARA TODOS LOS ICONOS

Si necesitas un prompt genérico que funcione para cualquier icono, usa este template:

```
Create a minimalist linear [ICON_NAME] icon in modern SaaS style (2025). 
[DESCRIPTION OF ICON SHAPE]. 
Clean lines, no fill, only outline. 
Rounded corners/edges. 
Color: [COLOR_CODE]. 
Line thickness: [2-3]px. 
Size: [SIZE]x[SIZE]px. 
Transparent background (PNG with alpha channel). 
Modern, professional, [CONTEXT] aesthetic. 
No shadows, no gradients, no text, no emojis, no brand logos.
Style: Similar to Font Awesome or Feather Icons but more minimal.
High resolution (2x for Retina displays).
```

---

## 📋 NOTAS ADICIONALES PARA GENERACIÓN

### Para Variaciones de Animación (Pulse, Fade, Glow)

**Pulse:**
```
Add a subtle glow effect around the icon, scale it to 110% of original size, and apply a soft transparency gradient outward. The glow should use the same color as the icon but with reduced opacity (30-50%).
```

**Fade:**
```
Make the icon semi-transparent (60-70% opacity) with a soft appearance, suggesting it's fading in or appearing gradually.
```

**Glow:**
```
Add a soft glow effect around the icon using the same color but with transparency gradient. The glow should extend 10-15px beyond the icon edges.
```

### Para Iconos con Overlays (Checkmarks, Numbers)

**Checkmark Overlay:**
```
Add a small checkmark icon in the bottom right corner of the main icon. The checkmark should be green (#2ECC71), clean, simple, approximately 30% of the main icon size.
```

**Number Overlay:**
```
Add small number indicators (like "1", "5", "10") floating around or overlaid on the icon. Use clean sans-serif font, same color as icon, size approximately 20-25% of icon size.
```

---

## ✅ CHECKLIST DE PROMPTS

### Iconos Base (OBLIGATORIOS - Genera todos estos)

- [ ] icon_001_lock.png ⭐
- [ ] icon_002_credits.png ⭐
- [ ] icon_002_credits_animated.png ⭐ (cambia contenido: números)
- [ ] icon_003_oauth.png ⭐
- [ ] icon_003_oauth_check.png ⭐ (cambia contenido: checkmark)
- [ ] icon_004_client_1.png ⭐
- [ ] icon_004_client_2.png ⭐
- [ ] icon_005_package.png ⭐
- [ ] icon_006_checkmark.png ⭐
- [ ] icon_007_key.png ⭐
- [ ] icon_008_id.png ⭐
- [ ] icon_009_world.png ⭐
- [ ] icon_010_port.png ⭐
- [ ] icon_011_lightbulb.png ⭐
- [ ] icon_012_lightning.png ⭐
- [ ] icon_013_analytics.png ⭐
- [ ] icon_014_search.png ⭐
- [ ] icon_015_chart.png ⭐
- [ ] icon_016_credits_small.png ⭐
- [ ] icon_017_lightning_large.png ⭐
- [ ] icon_018_oauth_small.png ⭐
- [ ] icon_019_oauth_terminal.png ⭐
- [ ] icon_020_credits_burn.png ⭐
- [ ] icon_021_oauth_summary.png ⭐
- [ ] icon_022_credits_summary.png ⭐
- [ ] icon_023_analytics_summary.png ⭐
- [ ] icon_024_rocket.png ⭐
- [ ] icon_025_book.png ⭐
- [ ] icon_026_document.png ⭐
- [ ] icon_027_graduation.png ⭐
- [ ] icon_028_satellite.png ⭐ (MCP Endpoint - consola)
- [ ] icon_029_health.png ⭐ (Health Check - consola)
- [ ] icon_030_tools.png ⭐ (Tools - consola)
- [ ] icon_031_chat.png ⭐ (Prompts - consola)
- [ ] diagram_001_flow_boxes.svg ⭐
- [ ] diagram_002_arrows.svg ⭐

### Variaciones con Efectos (OPCIONALES - Solo si necesitas pre-renderizado)

**Nota**: Estos efectos (pulse, fade, glow) se pueden crear en After Effects. Solo genera si necesitas animaciones pre-renderizadas.

- [ ] icon_001_lock_pulse.png (opcional - efecto pulse)
- [ ] icon_006_checkmark_fade.png (opcional - efecto fade)
- [ ] icon_012_lightning_glow.png (opcional - efecto glow)
- [ ] icon_013_analytics_summary.png (ya incluido arriba)
- [ ] icon_013_analytics_pulse.png (opcional - efecto pulse)
- [ ] icon_017_lightning_large_pulse.png (opcional - efecto pulse)
- [ ] icon_020_credits_burn_anim.png (opcional - si cambia contenido visual)
- [ ] icon_021_oauth_summary_pulse.png (opcional - efecto pulse)
- [ ] icon_022_credits_summary_pulse.png (opcional - efecto pulse)
- [ ] icon_023_analytics_summary_pulse.png (opcional - efecto pulse)
- [ ] icon_024_rocket_pulse.png (opcional - efecto pulse)

---

### Resumen

**OBLIGATORIOS**: ~36 iconos base + 2 variaciones que cambian contenido visual = **38 iconos**
**OPCIONALES**: ~11 variaciones de efectos (pulse, fade, glow)

**Recomendación**: Genera solo los **34 iconos obligatorios**. Los efectos de animación se pueden aplicar en post-producción con más control.

