# Reporte Comparativo: Nevermined Payments vs SDK Original de MCP

Este documento compara la implementación del servidor MCP usando la librería **Nevermined Payments** (`main.ts`) versus el **SDK original de MCP** (`main_original_mcp.ts`).

---

## 📋 Resumen Ejecutivo

La librería **Nevermined Payments** proporciona una capa de abstracción sobre el SDK original de MCP que simplifica significativamente la configuración del servidor, añade integración de pagos/autenticación, y maneja automáticamente aspectos como OAuth, sesiones y transporte HTTP.

---

## 🔄 Similitudes

### 1. **Estructura de Handlers**
Ambos enfoques mantienen la misma estructura para los handlers de tools, resources y prompts:
- Los handlers reciben los mismos parámetros básicos (`args`, `uri`, `variables`)
- Retornan el mismo formato de respuesta (`content`, `contents`, `messages`)
- La lógica de negocio es idéntica (obtener datos del clima, generar forecast con LLM)

### 2. **Esquemas de Validación**
Ambos usan **Zod** para definir los esquemas de entrada:
```typescript
const weatherToolSchema = z.object({
  city: z.string().min(2).max(80).describe("City name"),
});
```

### 3. **Servicios Externos**
Ambos utilizan los mismos servicios:
- `weather.service.ts` para obtener datos del clima
- OpenAI para generar el forecast mejorado
- Express para el servidor HTTP (aunque Nevermined lo abstrae)

### 4. **Protocolo MCP**
Ambos implementan el mismo protocolo MCP (`2024-11-05`) y exponen las mismas capacidades:
- Tool: `weather.today`
- Resource: `weather://today/{city}`
- Prompt: `weather.ensureCity`

---

## 🔀 Diferencias Principales

### 1. **Inicialización y Configuración**

#### Nevermined Payments (`main.ts`)
```typescript
// Inicialización simple con singleton
const payments = Payments.getInstance({
  nvmApiKey: NVM_API_KEY,
  environment: NVM_ENVIRONMENT,
});
```
- **Ventaja**: Configuración mínima, singleton pattern
- **Requisito**: Necesita `NVM_API_KEY` y `NVM_AGENT_ID`

#### SDK Original (`main_original_mcp.ts`)
```typescript
// Creación directa del servidor MCP
const server = new McpServer({
  name: "weather-mcp",
  version: "0.1.0",
  protocolVersion: "2024-11-05",
});
```
- **Ventaja**: No requiere configuración externa
- **Desventaja**: No tiene integración de pagos/autenticación

---

### 2. **Registro de Tools, Resources y Prompts**

#### Nevermined Payments
```typescript
payments.mcp.registerTool(
  "weather.today",
  { title: "...", description: "...", inputSchema: ... },
  handleWeatherTodayTool,
  { credits: weatherToolCreditsCalculator } // ← Opción de créditos
);

payments.mcp.registerResource(
  "weather://today/{city}",
  { name: "...", description: "...", mimeType: ... },
  handleWeatherTodayResource,
  { credits: 5n } // ← Créditos fijos
);

payments.mcp.registerPrompt(
  "weather.ensureCity",
  { name: "...", description: "...", inputSchema: ... },
  handleWeatherEnsureCityPrompt,
  { credits: 1n } // ← Créditos fijos
);
```
- **Ventaja**: API unificada, soporte para créditos dinámicos/fijos
- **Característica**: Automáticamente envuelve los handlers con el paywall

#### SDK Original
```typescript
server.registerTool(
  "weather.today",
  { title: "...", description: "...", inputSchema: ... },
  handleWeatherTodayTool
);

server.registerResource(
  "weather://today/{city}",
  { name: "...", description: "...", mimeType: ... },
  handleWeatherTodayResource
);

server.registerPrompt(
  "weather.ensureCity",
  { name: "...", description: "...", arguments: ... },
  handleWeatherEnsureCityPrompt
);
```
- **Ventaja**: API directa del SDK, sin dependencias adicionales
- **Desventaja**: No hay protección de pagos ni cálculo de créditos

---

### 3. **Gestión de Sesiones y Transporte HTTP**

#### Nevermined Payments
```typescript
const { info, stop } = await payments.mcp.start({
  port: PORT,
  agentId: NVM_AGENT_ID!,
  serverName: "weather-mcp",
  version: "0.1.0",
  description: "...",
});
```
- **Ventaja**: Todo está automatizado:
  - Crea Express app internamente
  - Configura rutas MCP (`/mcp`)
  - Gestiona sesiones automáticamente
  - Configura OAuth endpoints (`.well-known/oauth-authorization-server`, etc.)
  - Maneja `StreamableHTTPServerTransport` internamente
- **Resultado**: ~10 líneas de código

#### SDK Original
```typescript
const app = express();
app.use(express.json());

const transports = new Map<string, StreamableHTTPServerTransport>();

async function getOrCreateTransport(sessionId: string) {
  // Lógica manual de gestión de sesiones
  if (transports.has(sessionId)) {
    return transports.get(sessionId)!;
  }
  const transport = new StreamableHTTPServerTransport({...});
  transport.sessionId = sessionId;
  transport.onclose = () => { transports.delete(sessionId); };
  await server.connect(transport);
  transports.set(sessionId, transport);
  return transport;
}

app.post("/mcp", async (req, res) => {
  // Lógica manual de manejo de requests
  const sessionId = req.headers["mcp-session-id"] || randomUUID();
  res.setHeader("Mcp-Session-Id", sessionId);
  // Configurar headers Accept, etc.
  const transport = await getOrCreateTransport(sessionId);
  await transport.handleRequest(req, res, req.body);
});

app.listen(PORT, () => { ... });
```
- **Desventaja**: ~100+ líneas de código manual
- **Ventaja**: Control total sobre la implementación

---

### 4. **Contexto de Autenticación y Observabilidad**

#### Nevermined Payments
```typescript
async function handleWeatherTodayTool(args: any, authContext?: any) {
  // authContext contiene información de Nevermined:
  // - authContext.extra.agentRequest.agentRequestId
  // - authContext.extra.agentRequest.agentId
  // - etc.
  
  // Integración con observabilidad
  const openai = new OpenAI(
    context?.extra?.agentRequest
      ? payments.observability.withOpenAI(
          process.env.OPENAI_API_KEY!,
          context.extra.agentRequest,
          customProperties
        )
      : { apiKey: process.env.OPENAI_API_KEY! }
  );
}
```
- **Ventaja**: Contexto rico para logging, observabilidad y tracking
- **Característica**: Integración automática con Helicone/observabilidad

#### SDK Original
```typescript
async function handleWeatherTodayTool(args: any, extra?: any) {
  // extra puede contener headers, pero no está estructurado
  // No hay integración automática de observabilidad
  
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
  });
}
```
- **Desventaja**: Sin contexto estructurado de autenticación
- **Desventaja**: Sin integración automática de observabilidad

---

### 5. **Cálculo de Créditos**

#### Nevermined Payments
```typescript
const weatherToolCreditsCalculator = (ctx: CreditsContext): bigint => {
  const result = ctx.result as { structuredContent?: { forecast?: string } };
  const forecast = result?.structuredContent?.forecast || "";
  const forecastLength = forecast.length;
  return forecastLength <= 100 ? 1n : BigInt(Math.floor(Math.random() * 18) + 2);
};

// Uso en registro
payments.mcp.registerTool(..., { credits: weatherToolCreditsCalculator });
```
- **Ventaja**: Soporte para créditos dinámicos basados en el resultado
- **Característica**: El contexto incluye `args` y `result` para cálculos complejos

#### SDK Original
```typescript
// No hay cálculo de créditos - el servidor es gratuito
```
- **Desventaja**: No hay sistema de créditos integrado

---

### 6. **Endpoints OAuth y Metadata**

#### Nevermined Payments
```typescript
// Automáticamente expone:
// - /.well-known/oauth-authorization-server
// - /.well-known/oauth-protected-resource
// - /.well-known/openid-configuration
// - /register
```
- **Ventaja**: OAuth configurado automáticamente para integración con clientes MCP

#### SDK Original
```typescript
// Solo expone:
// - /mcp (endpoint principal)
// - /health (si se añade manualmente)
// - / (info del servidor, si se añade manualmente)
```
- **Desventaja**: No hay endpoints OAuth - requiere implementación manual

---

### 7. **Manejo de Errores y Autenticación**

#### Nevermined Payments
```typescript
// Automáticamente maneja:
// - Validación de tokens OAuth
// - Verificación de créditos suficientes
// - Errores de autenticación con códigos JSON-RPC apropiados
// - Headers WWW-Authenticate para OAuth
```
- **Ventaja**: Protección automática de endpoints
- **Característica**: Errores estructurados según estándares MCP/OAuth

#### SDK Original
```typescript
// Manejo manual de errores
try {
  await transport.handleRequest(req, res, req.body);
} catch (error: any) {
  res.status(500).json({
    jsonrpc: "2.0",
    error: { code: error.code || -32000, message: error.message },
  });
}
```
- **Desventaja**: No hay validación de autenticación automática
- **Desventaja**: Requiere implementar lógica de autenticación manualmente

---

## 📊 Tabla Comparativa

| Característica | Nevermined Payments | SDK Original |
|---------------|---------------------|--------------|
| **Líneas de código** | ~424 (incluyendo lógica de negocio) | ~446 (con gestión manual de sesiones) |
| **Configuración inicial** | 3 líneas | 5 líneas |
| **Registro de tools/resources/prompts** | 3 llamadas simples | 3 llamadas simples |
| **Gestión de sesiones** | Automática | Manual (~50 líneas) |
| **Transporte HTTP** | Automático | Manual (~30 líneas) |
| **OAuth endpoints** | Automático | No incluido |
| **Cálculo de créditos** | Integrado (dinámico/fijo) | No disponible |
| **Autenticación** | Automática | Manual |
| **Observabilidad** | Integrada (Helicone) | No incluida |
| **Dependencias** | `@nevermined-io/payments` | Solo `@modelcontextprotocol/sdk` |
| **Requisitos** | API key y Agent ID | Ninguno |

---

## 🎯 Cuándo Usar Cada Enfoque

### Usa **Nevermined Payments** cuando:
- ✅ Necesitas monetizar tu servidor MCP
- ✅ Quieres protección automática de endpoints
- ✅ Necesitas integración OAuth lista para usar
- ✅ Quieres observabilidad integrada (tracking de LLM calls)
- ✅ Prefieres menos código boilerplate
- ✅ Necesitas cálculo dinámico de créditos

### Usa **SDK Original** cuando:
- ✅ El servidor es gratuito/público
- ✅ Necesitas control total sobre la implementación
- ✅ No quieres dependencias adicionales
- ✅ Quieres implementar tu propio sistema de autenticación
- ✅ Estás aprendiendo cómo funciona MCP internamente
- ✅ Tienes requisitos muy específicos de infraestructura

---

## 🔍 Análisis de Código

### Complejidad

**Nevermined Payments**: 
- **Complejidad de configuración**: ⭐⭐ (Baja)
- **Complejidad de mantenimiento**: ⭐⭐ (Baja)
- **Flexibilidad**: ⭐⭐⭐ (Media)

**SDK Original**:
- **Complejidad de configuración**: ⭐⭐⭐⭐ (Alta)
- **Complejidad de mantenimiento**: ⭐⭐⭐⭐ (Alta)
- **Flexibilidad**: ⭐⭐⭐⭐⭐ (Muy Alta)

### Mantenibilidad

**Nevermined Payments**:
- ✅ Cambios en el protocolo MCP son manejados por la librería
- ✅ Actualizaciones de seguridad en OAuth son automáticas
- ⚠️ Dependes de actualizaciones de la librería

**SDK Original**:
- ⚠️ Debes mantenerte al día con cambios en el SDK de MCP
- ⚠️ Debes implementar y mantener lógica de autenticación
- ✅ Control total sobre actualizaciones

---

## 📝 Conclusiones

1. **Nevermined Payments** proporciona una **abstracción poderosa** que reduce significativamente el código boilerplate necesario para crear un servidor MCP protegido y monetizable.

2. El **SDK Original** ofrece **máxima flexibilidad** pero requiere implementar manualmente funcionalidades que Nevermined proporciona automáticamente.

3. La **lógica de negocio** (handlers) es **idéntica** en ambos enfoques, lo que facilita la migración entre uno y otro.

4. **Nevermined Payments** añade valor principalmente en:
   - Gestión automática de infraestructura (Express, sesiones, transporte)
   - Integración de pagos y autenticación
   - Observabilidad y tracking
   - Endpoints OAuth listos para usar

5. El **SDK Original** es mejor para:
   - Aprendizaje y comprensión profunda de MCP
   - Servidores públicos/gratuitos
   - Casos de uso con requisitos muy específicos

---

## 🔗 Referencias

- [Documentación Nevermined Payments MCP](./docs/protecting-mcp-with-nevermined-payments.md)
- [SDK Original de MCP](https://github.com/modelcontextprotocol/typescript-sdk)
- [Protocolo MCP](https://modelcontextprotocol.io/)







