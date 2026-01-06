# Puntos Clave de Implementación: Integración MCP con Nevermined

## Resumen Ejecutivo

Nevermined ha desarrollado una integración completa del Model Context Protocol (MCP) que permite monetizar servidores MCP de forma transparente, con autenticación OAuth 2.1 automática y gestión de créditos. Esta implementación reduce la complejidad de cientos de líneas de código a una API simple y declarativa.

---

## 1. MÓDULO MCP EN LA LIBRERÍA PAYMENTS

### 1.1 API Unificada
Nevermined ha creado métodos específicos que extienden la funcionalidad del SDK oficial:

- **`payments.mcp.registerTool()`**: Registra y protege herramientas MCP con un solo método (equivalente a `server.tool()` del SDK oficial + paywall)
- **`payments.mcp.registerResource()`**: Registra y protege recursos MCP (equivalente a `server.resource()` + paywall)
- **`payments.mcp.registerPrompt()`**: Registra y protege prompts MCP (equivalente a `server.prompt()` + paywall)
- **`payments.mcp.start()`**: Inicia el servidor completo con toda la infraestructura (OAuth, Express, sesiones, etc.)

### 1.2 Configuración Centralizada
- **`payments.mcp.configure()`**: Configuración única del módulo MCP con:
  - Agent ID de Nevermined
  - Nombre del servidor
  - Configuración global de créditos (opcional)

---

## 2. AUTENTICACIÓN OAUTH 2.1 AUTOMÁTICA

### 2.1 Endpoints Generados Automáticamente
Nevermined genera automáticamente todos los endpoints OAuth 2.1 necesarios:

- **Discovery Endpoint**: `/.well-known/oauth-authorization-server`
  - Permite a los clientes descubrir la configuración OAuth del servidor
  
- **Protected Resource Endpoint**: `/.well-known/oauth-protected-resource`
  - Define los recursos protegidos disponibles
  
- **OpenID Connect Configuration**: `/.well-known/openid-configuration`
  - Configuración estándar OpenID Connect para compatibilidad
  
- **Dynamic Client Registration**: `/register`
  - Permite que clientes MCP (como Cursor, Claude Desktop) se registren automáticamente

### 2.2 Flujo OAuth Completo
- **Sin código del desarrollador**: El desarrollador no necesita implementar nada de OAuth
- **Compatibilidad con clientes estándar**: Funciona directamente con Cursor, Claude Desktop y cualquier cliente MCP compatible
- **Gestión de sesiones**: Manejo automático de sesiones para streaming y comunicación bidireccional

### 2.3 Integración Transparente
- Los clientes MCP descubren automáticamente los endpoints OAuth
- Registro automático de clientes
- Obtención y renovación automática de tokens
- Validación automática de tokens en cada petición

---

## 3. SISTEMA DE MONETIZACIÓN INTEGRADO

### 3.1 Paywall Automático
- **`withPaywall()`**: Decorador que envuelve handlers MCP para:
  - Validar tokens de autorización
  - Verificar créditos disponibles
  - Ejecutar el handler del desarrollador
  - Quemar créditos automáticamente después de la ejecución exitosa

### 3.2 Cálculo de Créditos Flexible

#### Créditos Fijos
```typescript
{ credits: 5n }  // Siempre cobra 5 créditos
```

#### Créditos Dinámicos
- **Función calculadora**: Recibe un contexto con:
  - `ctx.args`: Argumentos de entrada de la llamada
  - `ctx.result`: Resultado devuelto por el handler (ejecutado DESPUÉS)
  
- **Ventaja clave**: El cálculo se ejecuta después de que el handler termine, permitiendo cobrar basándose en:
  - Tamaño de la respuesta
  - Complejidad del procesamiento
  - Tipo de datos devueltos
  - Cualquier métrica del resultado

### 3.3 Gestión de Créditos
- Validación previa: Verifica créditos suficientes antes de ejecutar
- Quema automático: Deduce créditos solo si la ejecución es exitosa
- Manejo de errores: No cobra si el handler falla

---

## 4. CONTEXTO DE AUTORIZACIÓN

### 4.1 Inyección Automática de Contexto
Cada handler protegido recibe automáticamente un `authContext` que contiene:

- **`agentRequest.agentId`**: ID del agente que realiza la petición
- **`agentRequest.agentRequestId`**: ID único de cada petición (útil para logging y debugging)
- **`extra.requestInfo`**: Información adicional de la petición HTTP

### 4.2 Casos de Uso
- **Logging y debugging**: Rastrear peticiones específicas en producción
- **Observabilidad**: Integración con sistemas de monitoreo
- **Analytics**: Análisis de uso por agente o sesión
- **Auditoría**: Trazabilidad completa de operaciones

---

## 5. OBSERVABILIDAD INTEGRADA

### 5.1 Integración con LLMs
- **`payments.observability.withOpenAI()`**: Configura automáticamente clientes OpenAI con:
  - Headers de observabilidad
  - Metadata de contexto (agentId, sessionId)
  - Tracking completo de llamadas LLM

### 5.2 Beneficios
- Tracking de costos de LLM por agente/sesión
- Monitoreo de uso y patrones
- Debugging de problemas en producción
- Dashboards de analytics

---

## 6. INFRAESTRUCTURA HTTP COMPLETA

### 6.1 Servidor Express Automático
`payments.mcp.start()` configura automáticamente:

- **Servidor Express**: Con todas las configuraciones necesarias
- **CORS**: Configurado para permitir peticiones desde clientes MCP
- **JSON Parsing**: Middleware para parsear peticiones JSON-RPC
- **Session Management**: Gestión de sesiones para streaming
- **Error Handling**: Manejo estándar de errores MCP

### 6.2 Endpoints HTTP
- **`/mcp`**: Endpoint principal MCP (POST para llamadas, GET/DELETE para sesiones)
- **`/health`**: Health check endpoint
- **`/`**: Información del servidor

### 6.3 Transport Streamable HTTP
- Implementación completa del protocolo Streamable HTTP de MCP
- Soporte para streaming bidireccional
- Gestión automática de sesiones

---

## 7. COMPATIBILIDAD CON SDK OFICIAL MCP

### 7.1 Métodos de Registro Implementados por Nevermined
Nevermined ha implementado métodos específicos que extienden la funcionalidad del SDK oficial, manteniendo la misma estructura de parámetros pero añadiendo capacidades de monetización:

| SDK Oficial MCP | Nevermined Payments |
|----------------|---------------------|
| `server.registerTool(name, config, handler)` | `payments.mcp.registerTool(name, config, handler, {credits})` |
| `server.registerResource(uri, config, handler)` | `payments.mcp.registerResource(uri, config, handler, {credits})` |
| `server.registerPrompt(name, config, handler)` | `payments.mcp.registerPrompt(name, config, handler, {credits})` |

**Características de los métodos `registerTool`, `registerResource`, `registerPrompt`:**

- **Mismo patrón de parámetros**: Mantienen la estructura del SDK oficial (nombre/URI, configuración, handler)
- **Parámetro adicional de créditos**: Añaden un cuarto parámetro opcional `{credits}` que puede ser:
  - Un valor fijo: `{ credits: 5n }`
  - Una función calculadora: `{ credits: (ctx) => ctx.result.length > 100 ? 2n : 1n }`
- **Protección automática**: Cada método envuelve automáticamente el handler con el paywall de Nevermined
- **Contexto de autorización**: Los handlers reciben automáticamente el contexto de autenticación como segundo parámetro

### 7.2 Migración Simple
- Los desarrolladores que ya usan MCP pueden migrar en minutos
- Solo necesitan cambiar el nombre del método y añadir el parámetro de créditos
- La estructura de parámetros y handlers permanece igual

---

## 8. CARACTERÍSTICAS ADICIONALES

### 8.1 Método `attach()` Alternativo
- Proporciona una forma más declarativa de registrar herramientas
- Combina registro y protección en un solo paso
- Reduce boilerplate cuando hay muchas herramientas

### 8.2 Soporte Low-Level
- Permite implementaciones personalizadas de routers JSON-RPC
- Mantiene la flexibilidad para casos de uso avanzados
- El paywall sigue funcionando con implementaciones custom

### 8.3 Manejo de Errores Estándar
- Códigos de error MCP estándar:
  - `-32003`: "Authorization required" / "Payment required"
  - `-32002`: Otros errores del servidor
- Mensajes de error claros y descriptivos

---

## 9. REDUCCIÓN DE COMPLEJIDAD

### 9.1 Antes (SDK Oficial)
- ~200 líneas de código para OAuth 2.1
- Implementación manual de endpoints OAuth
- Gestión manual de sesiones y transporte HTTP
- Configuración manual de Express y middleware
- Sin monetización integrada
- Sin contexto de autorización
- Métodos: `server.tool()`, `server.resource()`, `server.prompt()`

### 9.2 Después (Nevermined)
- **10 líneas de código** para toda la infraestructura
- OAuth automático (0 líneas)
- Monetización integrada (1 parámetro adicional en los métodos de registro)
- Contexto de autorización automático
- Observabilidad integrada
- Métodos mejorados: `payments.mcp.registerTool()`, `payments.mcp.registerResource()`, `payments.mcp.registerPrompt()`

---

## 10. VALOR AGREGADO

### 10.1 Para Desarrolladores
- **Tiempo de desarrollo**: Reducción de días/semanas a horas
- **Mantenimiento**: Sin necesidad de mantener código OAuth
- **Seguridad**: Implementación probada y auditada
- **Monetización**: Sistema completo listo para usar

### 10.2 Para Usuarios Finales
- **Experiencia fluida**: OAuth transparente
- **Pagos integrados**: Sin fricción en el proceso de pago
- **Compatibilidad**: Funciona con cualquier cliente MCP estándar

### 10.3 Para el Negocio
- **Monetización inmediata**: Sistema de créditos listo
- **Flexibilidad de precios**: Créditos fijos o dinámicos
- **Trazabilidad**: Auditoría completa de transacciones
- **Analytics**: Datos de uso y patrones

---

## Conclusión

Nevermined ha implementado una solución completa que transforma servidores MCP abiertos en servicios monetizables y seguros, reduciendo la complejidad técnica de manera significativa mientras añade capacidades de monetización, autenticación y observabilidad que no existen en el SDK oficial de MCP.

