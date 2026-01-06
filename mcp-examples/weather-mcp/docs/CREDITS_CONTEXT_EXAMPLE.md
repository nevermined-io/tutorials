# Ejemplo: CreditsContext en un MCP de Código con APIs Externas

## Escenario: MCP de Análisis de Código

Imagina un MCP que:
- Busca código en GitHub
- Consulta documentación de librerías
- Analiza dependencias
- Genera reportes de seguridad
- Hace múltiples llamadas a APIs externas (GitHub API, npm registry, Snyk, etc.)

---

## Estructura de CreditsContext

### Input (ctx.args)

```typescript
ctx.args = {
  query: "find all React hooks in facebook/react",
  repository: "facebook/react",
  includeDependencies: true,
  securityScan: true,
  depth: "deep"  // "shallow" | "deep"
}
```

### Output (ctx.result) - Después de ejecutar el handler

```typescript
ctx.result = {
  content: [
    { type: "text", text: "Found 45 React hooks..." },
    { type: "resource_link", uri: "code://analysis/12345" }
  ],
  metadata: {
    // Información sobre lo que realmente se ejecutó
    apiCalls: {
      github: 12,           // 12 llamadas a GitHub API
      npm: 3,              // 3 llamadas a npm registry
      snyk: 1,             // 1 llamada a Snyk (API premium)
      documentation: 8     // 8 consultas a documentación
    },
    resultsCount: 45,      // 45 hooks encontrados
    filesAnalyzed: 234,    // 234 archivos analizados
    responseSize: 125000,  // 125KB de respuesta
    processingTime: 3.2,   // 3.2 segundos de procesamiento
    apisUsed: ["github", "npm", "snyk", "docs"],
    premiumApis: ["snyk"], // APIs premium utilizadas
    complexity: "high"     // "low" | "medium" | "high"
  },
  structuredContent: {
    hooks: [...],          // Array de hooks encontrados
    dependencies: [...],   // Dependencias analizadas
    securityIssues: [...] // Issues de seguridad
  }
}
```

---

## Estrategias de Cálculo de Créditos

### 1. **Basado en Número de Llamadas a APIs**

```typescript
const codeAnalysisCreditsCalculator = (ctx: CreditsContext): bigint => {
  const result = ctx.result as {
    metadata?: {
      apiCalls?: {
        github?: number;
        npm?: number;
        snyk?: number;
        documentation?: number;
      };
    };
  };
  
  const apiCalls = result?.metadata?.apiCalls || {};
  
  // Costo base por tipo de API
  let totalCredits = 0n;
  
  // APIs gratuitas: 1 crédito por llamada
  totalCredits += BigInt(apiCalls.github || 0) * 1n;
  totalCredits += BigInt(apiCalls.npm || 0) * 1n;
  totalCredits += BigInt(apiCalls.documentation || 0) * 1n;
  
  // API premium (Snyk): 5 créditos por llamada
  totalCredits += BigInt(apiCalls.snyk || 0) * 5n;
  
  // Mínimo: 1 crédito
  return totalCredits > 0n ? totalCredits : 1n;
};
```

**Ejemplo:**
- 12 llamadas GitHub + 3 npm + 8 docs + 1 Snyk
- = (12 + 3 + 8) × 1 + 1 × 5 = 28 créditos

---

### 2. **Basado en Complejidad y Resultados**

```typescript
const codeAnalysisCreditsCalculator = (ctx: CreditsContext): bigint => {
  const args = ctx.args as { depth?: string; securityScan?: boolean };
  const result = ctx.result as {
    metadata?: {
      resultsCount?: number;
      filesAnalyzed?: number;
      complexity?: string;
    };
  };
  
  let baseCredits = 1n;
  
  // Complejidad de la consulta
  if (args.depth === "deep") {
    baseCredits = 5n;
  } else if (args.depth === "shallow") {
    baseCredits = 2n;
  }
  
  // Escaneo de seguridad añade costo
  if (args.securityScan) {
    baseCredits += 3n;
  }
  
  // Costo adicional por volumen de resultados
  const resultsCount = result?.metadata?.resultsCount || 0;
  const filesAnalyzed = result?.metadata?.filesAnalyzed || 0;
  
  // 1 crédito por cada 10 resultados
  const resultsCost = BigInt(Math.floor(resultsCount / 10));
  
  // 1 crédito por cada 50 archivos analizados
  const filesCost = BigInt(Math.floor(filesAnalyzed / 50));
  
  // Complejidad del resultado
  let complexityMultiplier = 1n;
  if (result?.metadata?.complexity === "high") {
    complexityMultiplier = 2n;
  } else if (result?.metadata?.complexity === "medium") {
    complexityMultiplier = 1.5n;
  }
  
  return (baseCredits + resultsCost + filesCost) * complexityMultiplier;
};
```

**Ejemplo:**
- depth: "deep" (5) + securityScan (3) = 8 base
- 45 resultados / 10 = 4 créditos
- 234 archivos / 50 = 4 créditos
- complexity: "high" (×2)
- = (8 + 4 + 4) × 2 = 32 créditos

---

### 3. **Basado en Tamaño de Respuesta y APIs Premium**

```typescript
const codeAnalysisCreditsCalculator = (ctx: CreditsContext): bigint => {
  const result = ctx.result as {
    metadata?: {
      responseSize?: number;      // bytes
      premiumApis?: string[];
      apiCalls?: Record<string, number>;
    };
  };
  
  const metadata = result?.metadata || {};
  const responseSize = metadata.responseSize || 0;
  const premiumApis = metadata.premiumApis || [];
  
  // Costo base
  let credits = 2n;
  
  // Costo por tamaño de respuesta
  // 1 crédito por cada 10KB
  const sizeCost = BigInt(Math.floor(responseSize / 10240));
  credits += sizeCost;
  
  // Costo adicional por APIs premium
  // Cada API premium añade 10 créditos base
  credits += BigInt(premiumApis.length) * 10n;
  
  // Costo por número de llamadas a APIs premium
  const premiumCalls = premiumApis.reduce((total, api) => {
    return total + (metadata.apiCalls?.[api] || 0);
  }, 0);
  credits += BigInt(premiumCalls) * 5n;
  
  return credits;
};
```

**Ejemplo:**
- Base: 2 créditos
- 125KB / 10KB = 12 créditos
- 1 API premium (Snyk) = 10 créditos
- 1 llamada a Snyk = 5 créditos
- = 2 + 12 + 10 + 5 = 29 créditos

---

### 4. **Modelo Híbrido: Combinando Múltiples Factores**

```typescript
const codeAnalysisCreditsCalculator = (ctx: CreditsContext): bigint => {
  const args = ctx.args as {
    query?: string;
    depth?: string;
    securityScan?: boolean;
  };
  const result = ctx.result as {
    metadata?: {
      apiCalls?: Record<string, number>;
      resultsCount?: number;
      responseSize?: number;
      premiumApis?: string[];
      processingTime?: number;
    };
  };
  
  const metadata = result?.metadata || {};
  
  // 1. Costo base según complejidad de la query
  let credits = 1n;
  const queryLength = (args.query || "").length;
  if (queryLength > 100) credits += 2n; // Queries largas son más complejas
  
  // 2. Costo por tipo de operación
  if (args.depth === "deep") credits += 5n;
  if (args.securityScan) credits += 8n; // Security scan es costoso
  
  // 3. Costo por llamadas a APIs
  const apiCalls = metadata.apiCalls || {};
  const totalApiCalls = Object.values(apiCalls).reduce((a, b) => a + b, 0);
  credits += BigInt(totalApiCalls) * 1n; // 1 crédito por llamada base
  
  // 4. Costo adicional por APIs premium
  const premiumApis = metadata.premiumApis || [];
  premiumApis.forEach(api => {
    const calls = apiCalls[api] || 0;
    credits += BigInt(calls) * 4n; // +4 créditos por cada llamada premium
  });
  
  // 5. Costo por volumen de datos procesados
  const resultsCount = metadata.resultsCount || 0;
  if (resultsCount > 100) {
    credits += BigInt(Math.floor((resultsCount - 100) / 50)) * 2n;
  }
  
  // 6. Costo por tamaño de respuesta (si es muy grande)
  const responseSize = metadata.responseSize || 0;
  if (responseSize > 50000) { // > 50KB
    credits += BigInt(Math.floor((responseSize - 50000) / 25000)) * 1n;
  }
  
  // 7. Bonificación/Descuento por eficiencia
  const processingTime = metadata.processingTime || 0;
  if (processingTime < 1.0 && totalApiCalls > 5) {
    // Si fue rápido a pesar de muchas llamadas, es eficiente
    credits = BigInt(Math.floor(Number(credits) * 0.9)); // 10% descuento
  }
  
  return credits;
};
```

**Ejemplo Completo:**
```
Input:
- query: "find all React hooks in facebook/react" (45 chars)
- depth: "deep"
- securityScan: true

Output metadata:
- apiCalls: { github: 12, npm: 3, snyk: 1, docs: 8 }
- resultsCount: 45
- responseSize: 125000
- premiumApis: ["snyk"]
- processingTime: 3.2

Cálculo:
1. Base: 1 crédito
2. Query corta: +0
3. depth="deep": +5
4. securityScan: +8
5. Total API calls (24): +24
6. Premium API calls (1 Snyk): +4
7. resultsCount (45): +0 (< 100)
8. responseSize (125KB): +3 (125KB - 50KB = 75KB / 25KB = 3)
9. processingTime (3.2s): sin descuento

Total: 1 + 5 + 8 + 24 + 4 + 3 = 45 créditos
```

---

## Ventajas de este Enfoque

### 1. **Pricing Justo**
- Los usuarios pagan según el valor real recibido
- Consultas simples = menos créditos
- Consultas complejas con APIs premium = más créditos

### 2. **Transparencia**
- El desarrollador puede ver exactamente qué se cobró y por qué
- El `metadata` en el resultado explica el costo

### 3. **Flexibilidad**
- Puedes ajustar los precios sin cambiar el código del handler
- Solo modificas la función calculadora

### 4. **Optimización**
- Los desarrolladores pueden optimizar sus handlers para reducir costos
- Ejemplo: cachear resultados, reducir llamadas a APIs premium

---

## Ejemplo de Handler Completo

```typescript
async function analyzeCodeHandler(
  args: any,
  authContext?: any
): Promise<any> {
  const { query, repository, depth, securityScan } = args;
  
  // Tracking de lo que vamos a hacer
  const metadata = {
    apiCalls: {} as Record<string, number>,
    premiumApis: [] as string[],
    startTime: Date.now(),
  };
  
  // 1. Buscar en GitHub
  const githubResults = await searchGitHub(query, repository);
  metadata.apiCalls.github = githubResults.apiCalls;
  
  // 2. Si es deep, analizar dependencias
  let dependencies = [];
  if (depth === "deep") {
    dependencies = await analyzeDependencies(repository);
    metadata.apiCalls.npm = dependencies.apiCalls;
  }
  
  // 3. Si se solicita, escanear seguridad (API premium)
  let securityIssues = [];
  if (securityScan) {
    securityIssues = await scanSecurity(repository);
    metadata.apiCalls.snyk = securityIssues.apiCalls;
    metadata.premiumApis.push("snyk");
  }
  
  // 4. Consultar documentación
  const docs = await searchDocumentation(query);
  metadata.apiCalls.documentation = docs.apiCalls;
  
  // Calcular métricas finales
  const endTime = Date.now();
  const finalMetadata = {
    ...metadata,
    resultsCount: githubResults.items.length,
    filesAnalyzed: githubResults.totalFiles,
    responseSize: JSON.stringify({
      results: githubResults.items,
      dependencies,
      securityIssues,
      docs,
    }).length,
    processingTime: (endTime - metadata.startTime) / 1000,
    complexity: depth === "deep" ? "high" : "medium",
  };
  
  return {
    content: [
      { type: "text", text: `Found ${githubResults.items.length} results...` },
    ],
    metadata: finalMetadata, // ← Esto estará disponible en ctx.result
    structuredContent: {
      results: githubResults.items,
      dependencies,
      securityIssues,
    },
  };
}

// Calculadora de créditos
const creditsCalculator = (ctx: CreditsContext): bigint => {
  // Usa ctx.result.metadata para calcular créditos
  // basándose en lo que realmente se ejecutó
  return calculateCreditsFromMetadata(ctx.result.metadata);
};
```

---

## Resumen

**CreditsContext te da acceso a:**
- ✅ **ctx.args**: Lo que el usuario pidió
- ✅ **ctx.result**: Lo que realmente se entregó (incluyendo metadata)

**Para un MCP de código con APIs externas, puedes calcular créditos basándote en:**
1. Número y tipo de llamadas a APIs
2. Uso de APIs premium
3. Volumen de resultados procesados
4. Tamaño de la respuesta
5. Complejidad de la operación
6. Tiempo de procesamiento

**La clave:** El cálculo se hace DESPUÉS de ejecutar el handler, así que puedes cobrar según el valor real entregado, no solo según lo que el usuario pidió.

