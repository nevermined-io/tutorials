# Video Script: Building a Monetizable MCP Server with Nevermined

**Estimated Duration**: 8-10 minutes  
**Format**: Code walkthrough with visual enhancements  
**Audience**: Developers familiar with MCP  
**Prerequisites**: Nevermined account with API Key, Agent ID, and Plan ID configured

---

## 🎬 INTRO (0:00 - 0:45)

### [GUION VISUAL]

**0:00-0:05** - **Animación de Apertura**
- Fade in: Logo de Nevermined (centro de pantalla, efecto de brillo animado)
- Desliza desde abajo: Título "Building a Monetizable MCP Server" (fade suave)
- Fondo: Gradiente animado sutil (azul a púrpura)
- Música: Intro tecnológica animada (fade in, luego baja a segundo plano)

**0:05-0:15** - **Transición a Presentador/Código**
- Logo se reduce y se mueve a la esquina superior izquierda (animación suave)
- Área de contenido principal aparece con fade in (editor de código o vista de presentador)
- El título permanece visible arriba

**0:15-0:45** - **Contenido de Introducción**

### [SCREEN: Split view - Logo Nevermined (top-left) + Main content area]

**NARRATION (EN):**

> Hi, welcome to this Nevermined tutorial.
>
> If you already know how to create MCP servers with the official Model Context Protocol SDK, you are going to love this video. We will see how easy it is to turn your MCP server into a monetizable service using the Nevermined Payments library.
>
> In the next few minutes, we will analyze step by step a weather MCP server that protects its tools, resources and prompts with a paywall, calculates credits dynamically based on the response, automatically exposes all the necessary OAuth 2.1 endpoints, and works directly with clients like Cursor or Claude Desktop.
>
> The best part is that if you already know how to use the MCP SDK, the learning curve is practically zero.
>
> Let's get started.

### [MEJORAS VISUALES DURANTE LA NARRACIÓN]

**0:15-0:20** - Los iconos aparecen uno por uno con animación fade-in:
- 🔒 Icono de candado (Paywall)
- 💰 Icono de créditos (Créditos dinámicos)
- 🔐 Icono OAuth (Autenticación)
- 🖥️ Iconos de Cursor/Claude (Clientes)

**0:20-0:30** - Resaltados de texto aparecen cuando el narrador menciona características:
- "paywall" → El icono de candado pulsa
- "credits dynamically" → Icono de créditos con números animados
- "OAuth 2.1 endpoints" → Icono OAuth con marca de verificación
- "Cursor or Claude Desktop" → Los iconos de clientes se deslizan

**0:30-0:45** - Transición suave a la siguiente sección:
- Los iconos desaparecen con fade out
- El editor de código aparece con fade in
- El archivo package.json aparece

---

## 📁 DEPENDENCIES AND CONFIGURATION (0:45 - 1:30)

### [SCREEN: package.json file open in code editor]

```json
{
  "dependencies": {
    "@nevermined-io/payments": "^1.0.0",
    "dotenv": "^17.0.0",
    "zod": "^4.0.0"
  }
}
```

### [GUION VISUAL]

**0:45-0:50** - El archivo aparece con efecto máquina de escribir (las líneas de código aparecen una por una)

**0:50-1:00** - Animaciones de resaltado:
- Cuando el narrador dice "Nevermined payments library" → Resaltar `@nevermined-io/payments` con brillo amarillo
- Cuando el narrador dice "Zod" → Resaltar `zod` con brillo azul
- Cuando el narrador dice "dotenv" → Resaltar `dotenv` con brillo verde

**0:50-1:15** - Animación del panel lateral:
- Aparece icono: 📦 Icono de paquete
- Texto: "Solo se necesitan 3 dependencias"
- Aparecen marcas de verificación junto a cada dependencia cuando se menciona

**1:15-1:30** - Transición al archivo .env:
- package.json desaparece con fade out (desliza a la izquierda)
- El archivo .env se desliza desde la derecha

**NARRATION (EN):**

> Let's start by looking at the dependencies.
>
> The Nevermined payments library. It includes everything you need to create monetizable MCP servers.
>
> The official MCP SDK from Model Context Protocol.
>
> Zod for validating input schemas.
>
> And dotenv for managing environment variables.
>
> Regarding configuration, we need our Nevermined API Key, the Agent ID that represents this server, and the environment we are going to work with.
>
> If you do not have this data yet, we have other videos that explain how to create your account and configure your agent in Nevermined.

### [SCREEN: .env file]

```env
NVM_API_KEY=tu_api_key_aquí
NVM_AGENT_ID=did:nv:tu_agent_id
NVM_ENVIRONMENT=staging
PORT=3000
```

### [GUION VISUAL]

**1:30-1:40** - Las variables de entorno aparecen con efecto máquina de escribir
- Cada línea se resalta cuando el narrador la menciona
- Aparecen iconos clave junto a cada variable:
  - 🔑 para NVM_API_KEY
  - 🆔 para NVM_AGENT_ID
  - 🌍 para NVM_ENVIRONMENT
  - 🔌 para PORT

**1:40-1:45** - Transición suave a la sección de código:
- .env desaparece con fade out
- Aparece el editor de código con main.ts
- Animación de zoom suave

---

## 🔧 INITIALIZE PAYMENTS (1:30 - 2:15)

### [SCREEN: Code editor - imports and configuration]

```typescript
import "dotenv/config";
import { Payments, EnvironmentName } from "@nevermined-io/payments";
import type { CreditsContext } from "@nevermined-io/payments";
import { z } from "zod";

const PORT = parseInt(process.env.PORT || "3000", 10);
const NVM_API_KEY = process.env.NVM_API_KEY!;
const NVM_AGENT_ID = process.env.NVM_AGENT_ID!;
const NVM_ENVIRONMENT = (process.env.NVM_ENVIRONMENT as EnvironmentName) || "staging";
```

### [GUION VISUAL]

**1:45-2:00** - El código aparece con resaltado de sintaxis
- Sección de imports: Resaltado azul para imports
- Sección de variables: Resaltado verde para constantes
- Los números de línea aparecen con fade in

**2:00-2:05** - Animación de resaltado en imports clave:
- Clase `Payments` → Brillo amarillo + tooltip: "Clase principal"
- `CreditsContext` → Brillo azul + tooltip: "Para créditos dinámicos"
- `z` (Zod) → Brillo verde + tooltip: "Validación de esquemas"

**2:05-2:10** - Aparece anotación lateral:
- 💡 Icono de bombilla
- Texto: "Mismos imports que el SDK oficial de MCP"

**NARRATION (EN):**

> Let's look at the code. 
>
> From the Payments library we import the main class: "Payments". EnvironmentName to type the environment, and CreditsContext, a type we will use later to dynamically calculate credits.
>
> We also import Zod, exactly as we would with the official MCP SDK.
>
> Below we read the environment variables: the port, the API key, the Agent ID and the environment.

### [SCREEN: Code - Payments initialization] ⭐ HIGHLIGHT

```typescript
const payments = Payments.getInstance({
  nvmApiKey: NVM_API_KEY,
  environment: NVM_ENVIRONMENT,
});
```

### [GUION VISUAL]

**2:10-2:15** - **Animación de Momento Clave**
- El bloque de código se desliza desde abajo con efecto rebote
- Aparece resaltado rectangular amarillo alrededor de `Payments.getInstance`
- Animación de pulso en la llamada al método
- Aparece panel lateral con:
  - ⚡ Icono de rayo
  - Texto: "Patrón singleton - disponible en toda la app"
  - Flecha apuntando al código

**2:15-2:20** - **Mejora Visual**
- El bloque de código se escala ligeramente (110%)
- Efecto de brillo alrededor de todo el bloque
- Aparece animación de marca de verificación: ✅ "Módulo MCP listo"

**NARRATION (EN):**

> Take a look at Payments.getInstance
>
> We initialize Payments by passing our API key and the environment. We use the singleton pattern, so this instance will be available throughout the application.
>
> With these three lines we already have access to the entire MCP module of Nevermined. Let's see how to register our first tool.

---

## 🛠️ REGISTER A TOOL (2:15 - 5:00)

### [SCREEN: Code - validation schema]

```typescript
const weatherToolSchema = z.object({
  city: z.string().min(2).max(80).describe("City name"),
});
```

### [GUION VISUAL]

**2:20-2:30** - Aparece el código del schema
- Efecto máquina de escribir para el código
- Schema de Zod resaltado en verde
- Aparece tooltip: "Igual que el SDK oficial de MCP"

**NARRATION (EN):**

> First we define the input schema with Zod. This is exactly the same as in the official MCP SDK. As this MCP server will retrieve weather data from an external API, we define an object with a city field of type string.
>
> Nothing new here. If you already use MCP, this will be familiar.

### [SCREEN: Code - tool handler] ⭐ HIGHLIGHT authContext parameter

```typescript
async function handleWeatherTodayTool(args: any, authContext?: any) {
  // Acceso al contexto de autorización de Nevermined
  if (authContext) {
    console.log(`Request ID: ${authContext.extra.agentRequest.agentRequestId}`);
  }

  const { city } = args as { city: string };
  
  // Tu lógica de negocio aquí...
  const weather = await getTodayWeather(city);
  const forecast = await generateWeatherForecast(weather, authContext);

  return {
    content: [
      { type: "text", text: forecast },
      {
        type: "resource_link",
        uri: `weather://today/${encodeURIComponent(weather.city)}`,
        name: `weather today ${weather.city}`,
        mimeType: "application/json",
      },
    ],
    structuredContent: {
      city: weather.city,
      temperatureMax: weather.tmaxC,
      temperatureMin: weather.tminC,
      forecast: forecast,
    },
  };
}
```

### [GUION VISUAL]

**2:30-2:40** - Aparece el código del handler
- Firma de la función resaltada
- **Momento clave**: El parámetro `authContext` recibe tratamiento especial:
  - Resaltado circular rojo alrededor de `authContext`
  - Anotación de flecha apuntando a él
  - Tooltip: "NUEVO: Contexto de autorización de Nevermined"
  - Animación de pulso

**2:40-2:50** - Animaciones de explicación del código:
- Cuando el narrador menciona "agentRequestId" → Resaltar esa línea en amarillo
- Cuando el narrador menciona "observability" → Aparece icono: 📊 Icono de Analytics
- Panel lateral muestra:
  - 🔍 "¿Quién está llamando?"
  - 🆔 "Seguimiento de peticiones"
  - 📈 "Observabilidad lista"

**2:50-3:00** - Visual de comparación:
- Animación de pantalla dividida:
  - Izquierda: "SDK Original MCP" (gris, sin authContext)
  - Derecha: "Nevermined" (colorido, con authContext)
- Animación de flecha: "Añadido automáticamente"

**NARRATION (EN):**

> Now let's look at the handler. And here comes the first important difference from the original SDK.
>
> Look at the function signature: it receives "args", which are the input arguments, and an optional second parameter: authContext.
>
> This authContext is the authorization context that Nevermined automatically injects into each call. What is it for?
>
> First, you have access to the agentRequestId. This unique identifier for each request is very useful for logging, debugging, and tracking issues in production.
>
> Second, you can pass this context to other functions in your handler. For example, here we pass it to generateWeatherForecast. This allows you to use another very powerful Nevermined tool: observability, which lets you track LLM calls within your handler. But we will leave that for another tutorial.
>
> The important thing is to understand that Nevermined gives you information about who is calling and with what credentials, something that the original MCP SDK does not provide.
>
> The rest of the handler is your normal business logic: get data, process it, and return a standard MCP content object.

### [SCREEN: Code - credits calculator] ⭐ HIGHLIGHT ctx.result

```typescript
const weatherToolCreditsCalculator = (ctx: CreditsContext): bigint => {
  // ctx.args contiene los argumentos de entrada
  // ctx.result contiene el resultado que devolvió el handler
  
  const result = ctx.result as { structuredContent?: { forecast?: string } };
  const forecast = result?.structuredContent?.forecast || "";
  const forecastLength = forecast.length;
  
  // Cobramos 1 crédito para respuestas cortas, más para respuestas largas
  return forecastLength <= 100 ? 1n : BigInt(Math.floor(Math.random() * 18) + 2);
};
```

### [GUION VISUAL]

**3:00-3:10** - Aparece el código del calculador de créditos
- La función se desliza desde la derecha
- **Resaltado clave**: `ctx.result` recibe tratamiento especial:
  - Brillo verde alrededor de `ctx.result`
  - Flecha animada apuntando a él
  - Tooltip: "Resultado del handler - calculado DESPUÉS de la ejecución"

**3:10-3:25** - **Animación de Diagrama de Flujo**
- Aparece flujo animado sobre el código:
  ```
  ┌─────────────┐    ┌─────────────┐    ┌──────────────────┐    ┌─────────────┐
  │  Tool Call  │ →  │   Handler   │ →  │ Credits Function │ →  │ Burn Credits│
  │  (args)     │    │  ejecuta    │    │ (ctx.args +      │    │             │
  └─────────────┘    │  devuelve   │    │  ctx.result)     │    └─────────────┘
                     │  result     │    └──────────────────┘
                     └─────────────┘
  ```
- Cada caja se anima cuando el narrador explica:
  - Tool Call: Pulsando
  - Handler: Animación de ejecución (spinner de carga)
  - Credits Function: Resaltado cuando se menciona
  - Burn Credits: Aparece marca de verificación

**3:25-3:40** - Resaltado interactivo:
- `ctx.args` → Resaltado azul + tooltip: "Argumentos de entrada"
- `ctx.result` → Resaltado verde + tooltip: "Resultado del handler (calculado DESPUÉS)"
- Lógica condicional → Resaltado amarillo en la declaración return

**3:40-3:50** - Visualización de ejemplo:
- Panel lateral muestra ejemplo:
  - "Pronóstico corto (50 chars)" → 💰 1 crédito
  - "Pronóstico largo (200 chars)" → 💰💰 2-19 créditos
- Los números se animan como ejemplos

**NARRATION (EN):**

> Here comes another very powerful feature: dynamic credit calculation.
>
> Instead of always charging the same amount, we can define a function that calculates credits based on the call context.
>
> Look at the ctx parameter of type CreditsContext. This object has two key properties.
>
> ctx.args contains the arguments that the user sent to the tool. For example, the city they requested.
>
> ctx.result, and this is the important part, contains the result that your handler returned.
>
> Why is this so useful? Because the credit calculation runs after your handler finishes. First your logic runs, then Nevermined calls this function with the result.
>
> In this example, we charge more credits if the forecast is long. But you could charge more for premium cities, for specific response types, for whatever your business model needs.

### [SCREEN: Code - tool registration] ⭐ HIGHLIGHT payments.mcp.registerTool

```typescript
payments.mcp.registerTool(
  "weather.today",
  {
    title: "Today's Weather",
    description: "Get today's weather summary for a city",
    inputSchema: weatherToolSchema,
  },
  handleWeatherTodayTool,
  { credits: weatherToolCreditsCalculator }
);
```

### [GUION VISUAL]

**3:50-4:00** - Aparece el código de registro
- **Resaltado clave**: `payments.mcp.registerTool` recibe rectángulo amarillo
- Animación de pulso
- Tooltip: "Misma API que SDK oficial + parámetro de créditos"

**4:00-4:10** - Animación de desglose de parámetros:
- Cada parámetro se resalta cuando el narrador lo menciona:
  1. Nombre del tool → Resaltado azul
  2. Configuración → Resaltado verde
  3. Handler → Resaltado amarillo
  4. Créditos → **Resaltado rojo con énfasis especial** + icono 💰

**4:10-4:20** - Comparación lado a lado:
- Izquierda: SDK Oficial (3 parámetros, gris)
- Derecha: Nevermined (4 parámetros, colorido)
- Animación de flecha: "¡Solo añade créditos!"

**4:20-4:30** - Aparece opción alternativa:
- Fragmento de código se desliza:
  ```typescript
  { credits: 5n }  // Créditos fijos
  ```
- Tooltip: "O usa créditos fijos"

**NARRATION (EN):**

> And here we register the tool. Look how simple the API is.
>
> payments.mcp.registerTool. We use the MCP module from the Payments object.
>
> First parameter: the tool name, weather.today.
>
> Second parameter: the configuration with title, description and the Zod schema. This is identical to the official SDK.
>
> Third parameter: the handler we just saw.
>
> And fourth parameter: the credit options. Here we pass our calculator function. If you do not need dynamic calculation, you can simply put credits: 5n to always charge 5 credits.
>
> In essence, the API is almost identical to the official SDK, we just add the fourth parameter for monetization.

---

## 📦 REGISTER RESOURCES AND PROMPTS (5:00 - 6:15)

### [SCREEN: Code - resource registration]

```typescript
payments.mcp.registerResource(
  "weather://today/{city}",
  {
    name: "Today's Weather Resource",
    description: "JSON for today's weather by city",
    mimeType: "application/json",
  },
  async (uri, variables, context) => {
    const city = variables?.city as string;
    const weather = await getTodayWeather(city);
    
    return {
      contents: [{
        uri: uri.href,
        text: JSON.stringify(weather),
        mimeType: "application/json",
      }]
    };
  },
  { credits: 5n }
);
```

### [GUION VISUAL]

**5:00-5:15** - Aparece el código del resource
- Animación similar al registro de tools
- `registerResource` resaltado
- Parámetro de créditos: `5n` resaltado con icono 💰
- Tooltip: "Créditos fijos para resources"

**5:15-5:30** - Visual de consistencia del patrón:
- Panel lateral muestra el patrón:
  ```
  payments.mcp.register[TYPE](
    name/uri,
    config,
    handler,
    { credits }  ← ¡Siempre el mismo patrón!
  )
  ```
- Aparecen marcas de verificación: ✅ Tools, ✅ Resources, ✅ Prompts

**NARRATION (EN):**

> Resources and prompts follow the exact same pattern. We use payments.mcp.registerResource and payments.mcp.registerPrompt respectively.
>
> In both cases: name, configuration, handler, and credits. The handler also receives context, so you have access to the same authorization context as in tools.
>
> The pattern is always consistent, which makes the learning curve minimal if you already know MCP.

### [SCREEN: Code - prompt registration]

```typescript
payments.mcp.registerPrompt(
  "weather.ensureCity",
  {
    name: "Ensure city provided",
    description: "Guide to call weather.today with a city",
    inputSchema: weatherToolSchema,
  },
  (args) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Please call the tool weather.today with { "city": "${args.city}" }`
      }
    }]
  }),
  { credits: 1n }
);
```

### [GUION VISUAL]

**5:30-5:45** - Aparece el código del prompt
- Animación rápida (patrón similar)
- Créditos: `1n` resaltado
- Tooltip: "Operación ligera = 1 crédito"

**5:45-6:00** - Animación de resumen del patrón:
- Tres bloques de código aparecen lado a lado:
  - registerTool
  - registerResource
  - registerPrompt
- Todos resaltan el parámetro de créditos simultáneamente
- Aparece texto: "Patrón consistente = Fácil de aprender"

---

## 🚀 START THE SERVER (6:15 - 7:30)

### [SCREEN: Code - main function] ⭐ HIGHLIGHT payments.mcp.start

```typescript
async function main() {
  const { info, stop } = await payments.mcp.start({
    port: PORT,
    agentId: NVM_AGENT_ID,
    serverName: "weather-mcp",
    version: "0.1.0",
    description: "Weather MCP server with Nevermined OAuth integration",
  });

  console.log(`
🚀 Weather MCP Server Started!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📡 MCP Endpoint:     ${info.baseUrl}/mcp
🏥 Health Check:     ${info.baseUrl}/health

🔐 OAuth Endpoints (auto-generated):
   ├─ Discovery:     ${info.baseUrl}/.well-known/oauth-authorization-server
   ├─ Protected:     ${info.baseUrl}/.well-known/oauth-protected-resource
   ├─ OIDC Config:   ${info.baseUrl}/.well-known/openid-configuration
   └─ Registration:  ${info.baseUrl}/register

🛠️  Tools: ${info.tools.join(", ")}
📦 Resources: ${info.resources.join(", ")}
💬 Prompts: ${info.prompts.join(", ")}
  `);

  process.on("SIGINT", async () => {
    console.log("Shutting down...");
    await stop();
    process.exit(0);
  });
}

main();
```

### [GUION VISUAL]

**6:15-6:25** - **Animación de MOMENTO MÁGICO**
- `payments.mcp.start` recibe resaltado masivo:
  - Rectángulo amarillo con efecto de brillo
  - Animación de pulso (3 pulsos)
  - Aparece icono de rayo ⚡
  - Overlay de texto: "AQUÍ OCURRE LA MAGIA"

**6:25-6:40** - **Animación de Generación de Endpoints**
- El código hace zoom out ligeramente
- Aparece panel lateral con lista animada:
  - ✅ Express Server (aparece con marca de verificación)
  - ✅ Configuración CORS (se desliza)
  - ✅ Parsing JSON (se desliza)
  - ✅ Gestión de Sesiones (se desliza)
  - ✅ OAuth Discovery (se desliza con icono 🔐)
  - ✅ OAuth Protected Resource (se desliza)
  - ✅ OpenID Connect (se desliza)
  - ✅ Registro de Clientes (se desliza)
  - ✅ Health Check (se desliza)
- Cada elemento aparece con animación suave

**6:40-6:50** - **Visual de Comparación**
- Pantalla dividida:
  - Izquierda: "Implementación Manual" 
    - Muestra: ~200 líneas de código (gris, desplazándose)
    - Texto: "Semanas de trabajo"
  - Derecha: "Nevermined"
    - Muestra: 10 líneas (colorido, resaltado)
    - Texto: "10 líneas, 0 código OAuth"
- Animación de flecha: "95% menos código"

**6:50-7:00** - Vista previa de salida de consola:
- Ventana de terminal aparece con fade in
- Muestra la salida real de console.log
- Cada endpoint se resalta cuando aparece
- Los endpoints OAuth reciben animación especial con icono 🔐

**7:00-7:15** - **Animación de Mensaje Clave**
- Aparece overlay de texto:
  - "OAuth: Automático ✅"
  - "Infraestructura: Hecha ✅"
  - "Tú te enfocas en: Lógica de Negocio ✅"
- Cada línea aparece con animación de marca de verificación

**NARRATION (EN):**

> And now comes the magic. A single call: payments.mcp.start.
>
> We pass the port, the Nevermined Agent ID, the server name, the version and a description.
> 
> This function returns two things: info with server information, and stop to shut it down cleanly.
>
> But look at everything start does for us. In the log you can see all the endpoints it automatically generates.
>
> The MCP endpoint at slash mcp where clients connect.
>
> And here is the important part: all the OAuth 2.1 endpoints.
>
> The discovery at well-known oauth-authorization-server, the protected resource at well-known oauth-protected-resource, the OpenID Connect configuration, and the dynamic client registration endpoint.
>
> It also generates the health check, configures CORS, JSON parsing, session management for streaming.
>
> If you did this manually with the original MCP SDK, you would need hundreds of lines of code just for the infrastructure. Here it is 10 lines.
> 
> And best of all: as a developer, you do not have to understand OAuth or implement any authentication. Nevermined does everything.

---

## 🎮 DEMO WITH CURSOR (7:30 - 9:15)

### [SCREEN: Terminal - running server]

### [GUION VISUAL]

**7:30-7:40** - Aparece la terminal
- Línea de comando: `npx tsx src/server/main.ts`
- Animación de escritura (efecto máquina de escribir)
- Animación de pulsación de Enter
- El servidor inicia con animación de carga

**7:40-7:50** - Aparece la salida del servidor
- La salida de console.log se desplaza
- Cada endpoint se resalta cuando aparece:
  - MCP Endpoint → Resaltado verde
  - Health Check → Resaltado azul
  - Endpoints OAuth → Resaltado amarillo con iconos 🔐
- La lista de Tools/Resources/Prompts aparece con marcas de verificación

**NARRATION (EN):**

> Let's see it working. We run the server with npx.
>
> Perfect. The server starts and shows us all the available endpoints.
>
> The MCP endpoint at slash mcp, the health check, and all the OAuth endpoints that Nevermined has automatically generated.
>
> It also lists the tools, resources and prompts we have registered.

### [SCREEN: Cursor mcp.json configuration]

```json
{
  "mcpServers": {
    "weather": {
      "url": "http://localhost:3000/mcp",
      "type": "http"
    }
  }
}
```

### [GUION VISUAL]

**7:50-8:00** - Aparece el archivo de configuración de Cursor
- El archivo se abre con animación suave
- El código se resalta cuando el narrador explica
- Panel lateral muestra:
  - ✅ "¡Eso es todo!"
  - ✅ "No se necesita código OAuth"
  - ✅ "Cursor lo maneja automáticamente"

**8:00-8:15** - **Animación del Flujo OAuth**
- Aparece diagrama de flujo:
  ```
  Cursor → Discovery → Register → Get Token → Use Token
  ```
- Cada paso se anima con marcas de verificación
- Texto: "Flujo OAuth automático - Cero código de tu parte"

**NARRATION (EN):**

> Now let's connect Cursor as a client.
>
> The Cursor configuration is very simple. In the mcp.json file, we add our server with the MCP endpoint URL.
>
> That is all. Cursor, as a standard MCP Client, will automatically take care of discovering the OAuth endpoints by reading the discovery, registering as a client, obtaining an access token, and using it in all subsequent calls.
>
> We did not have to implement any of this OAuth flow. Nevermined configures everything.
>
> When clicking the 'Connect' button next to the new MCP server, the browser opens the authorization URL. The user logs in, and if the plan associated with the agent has not been purchased or the credits have been exhausted, the payment process is triggered. After this, Nevermined redirects the user back to Cursor, attaching the agent's access token. At this stage, we are ready to interact with the MCP server.

### [SCREEN: Cursor chat interface]

### [GUION VISUAL]

**8:15-8:25** - Aparece la interfaz de Cursor
- La ventana de chat aparece con fade in
- El usuario escribe: "What's the weather in Madrid?"
- Animación de escritura (efecto máquina de escribir)
- El mensaje aparece con deslizamiento suave

**8:25-8:35** - Animación de llamada al tool:
- Cursor detecta el tool (animación de resaltado)
- Aparece la llamada al tool:
  ```
  weather.today({ city: "Madrid" })
  ```
- Aparece spinner de carga
- El resultado aparece con fade in con datos del tiempo

**8:35-8:50** - **Visualización del Proceso en Segundo Plano**
- Panel lateral muestra lo que Nevermined hace:
  - ✅ Validar token (animación de marca de verificación)
  - ✅ Verificar créditos (animación de marca de verificación)
  - ✅ Ejecutar handler (carga → marca de verificación)
  - ✅ Quemar créditos (icono 💰 con cuenta regresiva)
- Cada paso aparece secuencialmente

**NARRATION (EN):**

> Let's ask about the weather.
>
> What is the weather in Madrid?
>
> Cursor detects that we have a weather.today tool available, calls it with the argument city Madrid, and shows us the result.
>
> Everything works. And most importantly: in the background, Nevermined has validated the user token, verified they have enough credits, executed our handler, and deducted the credits automatically.
>
> Without us writing a single line of authentication or billing code.

---

## 🎯 CLOSING (9:15 - 10:00)

### [SCREEN: Side-by-side comparison]

### [GUION VISUAL]

**9:15-9:25** - Aparece tabla de comparación
- Animación de deslizamiento suave
- Dos columnas: "SDK Original MCP" (izquierda, gris) vs "Nevermined Payments" (derecha, colorido)
- Cada fila aparece con animación:
  - `server.tool(...)` → `payments.mcp.registerTool(..., {credits})`
  - `server.resource(...)` → `payments.mcp.registerResource(..., {credits})`
  - `server.prompt(...)` → `payments.mcp.registerPrompt(..., {credits})`
  - "OAuth: Manual (~200 líneas)" → "OAuth: Automático (0 líneas)"
  - "Monetización: No existe" → "Monetización: Créditos dinámicos"
  - "Contexto auth: No existe" → "Contexto auth: authContext en cada handler"

**9:25-9:40** - **Animación de Iconos de Resumen**
- Los iconos aparecen uno por uno con texto:
  - 🔐 "OAuth 2.1 automático"
  - 💰 "Monetización integrada"
  - 📊 "Contexto de autorización"
  - 🚀 "Infraestructura HTTP completa"
- Cada icono pulsa cuando aparece

**9:40-9:50** - **Mensaje de Migración**
- Aparece texto grande:
  - "Migra en minutos, no en días"
  - "Misma API + Monetización"
- Animación de flecha apuntando al lado de Nevermined

**NARRATION (EN):**

> Resumamos lo que hemos visto.
>
> La API de Nevermined es prácticamente idéntica al SDK original de MCP:
> - `registerTool` en lugar de `tool`
> - `registerResource` en lugar de `resource`
> - `registerPrompt` en lugar de `prompt`
>
> La diferencia es que añadimos un cuarto parámetro para los créditos, que puede ser un valor fijo o una función calculadora.
>
> Pero con Nevermined obtienes mucho más:
> - **OAuth 2.1 automático** sin escribir código
> - **Monetización integrada** con créditos dinámicos basados en el resultado
> - **Contexto de autorización** inyectado en cada llamada
> - Y toda la infraestructura HTTP resuelta
>
> Si ya tienes un servidor MCP funcionando, migrarlo a Nevermined es cuestión de minutos.

### [SCREEN: Links and resources]

### [GUION VISUAL]

**9:50-10:00** - Pantalla de cierre
- El código desaparece con fade out
- Aparece logo de Nevermined (centro, animado)
- Aparecen enlaces debajo:
  - 📚 "Ejemplo de código completo"
  - 📖 "Documentación"
  - 🎓 "Más tutoriales"
- Cada enlace tiene animación hover
- Fondo: Animación de gradiente sutil

**NARRATION (EN):**

> In the video description you have the link to the complete code of this example and to the documentation.
>
> If you want to learn more about Nevermined observability, how to track LLM calls, or how to create your account and configure your agents, we have other tutorials for you.
>
> Thanks for watching, and see you in the next video.

---

## 📝 PRODUCTION NOTES

### Visual Style Guide

**Colors:**
- Primary: Nevermined brand colors (blue/purple gradient)
- Highlights: Yellow for key moments, Green for success, Red for important notes
- Code: Standard syntax highlighting (VS Code theme)

**Animations:**
- Smooth transitions (0.3s ease-in-out)
- Pulse effects for key moments (2-3 pulses)
- Typewriter effect for code (when appropriate)
- Slide-in from relevant directions (left/right/top/bottom)

**Icons:**
- Use consistent icon set (Font Awesome or similar)
- Animate icons on appearance (fade + scale)
- Use icons to reinforce key concepts

**Typography:**
- Code: Monospace font (Fira Code or similar)
- Headers: Bold, larger size
- Annotations: Smaller, italic

### Key Visual Moments to Emphasize

1. **Payments.getInstance** (2:10) - ⚡ Lightning effect
2. **authContext parameter** (2:30) - 🔴 Red highlight + pulse
3. **ctx.result** (3:10) - 🟢 Green highlight + flow diagram
4. **registerTool** (3:50) - 💰 Credit icon animation
5. **payments.mcp.start** (6:15) - ⚡ Massive highlight + magic effect

### Timing Adjustments

| Section | Start | End | Duration | Visual Focus |
|---------|-------|-----|----------|--------------|
| Intro | 0:00 | 0:45 | 45s | Logo, icons, smooth intro |
| Dependencies | 0:45 | 1:30 | 45s | Package.json, .env highlights |
| Init Payments | 1:30 | 2:15 | 45s | Code imports, Payments.getInstance |
| Tool Registration | 2:15 | 5:00 | 2:45 | Handler, credits, flow diagram |
| Resources/Prompts | 5:00 | 6:15 | 1:15 | Pattern consistency |
| Start Server | 6:15 | 7:30 | 1:15 | Magic moment, endpoints list |
| Demo Cursor | 7:30 | 9:15 | 1:45 | Terminal, Cursor UI, OAuth flow |
| Closing | 9:15 | 10:00 | 45s | Comparison, summary, links |
| **TOTAL** | | | **~10 min** | |

### Post-Production Checklist

- [ ] Add smooth transitions between sections
- [ ] Ensure code highlighting is consistent
- [ ] Verify all animations are smooth (no jank)
- [ ] Check that key moments have proper emphasis
- [ ] Add subtle background music (optional)
- [ ] Include captions/subtitles
- [ ] Add chapter markers for easy navigation





