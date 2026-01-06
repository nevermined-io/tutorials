# 🔗 Configurar payments-py Local

## Cambios Realizados

El `pyproject.toml` ahora apunta a la instalación **local** de `payments-py`:

```toml
[tool.poetry.dependencies]
payments-py = { path = "../../../payments-py", develop = true }
```

Esto es el equivalente a `npm link` en Node.js.

---

## 📋 Pasos para Aplicar los Cambios

### 1. Reinstalar Dependencias

```bash
cd /Users/charly/Sites/nevermined/tutorials/mcp-examples/weather-mcp-py

# Opción A: Actualizar dependencias
poetry update payments-py

# Opción B: Reinstalar todas las dependencias
poetry install
```

### 2. Verificar que Usa la Versión Local

```bash
poetry show payments-py
```

**Salida esperada:**

```
name         : payments-py
version      : <tu versión local>
description  : ...
dependencies : ...
location     : /Users/charly/Sites/nevermined/payments-py
```

### 3. Ejecutar Servidor

```bash
# Con Poetry
poetry run python src/server.py

# O activando el virtual environment
poetry shell
python src/server.py

# O con el script helper
./run_simplified.sh
```

---

## ✅ Ventajas de Editable Install

Con `develop = true`:

- ✅ **Cambios en tiempo real**: Los cambios en `payments-py` se reflejan inmediatamente en `weather-mcp-py`
- ✅ **No necesitas reinstalar**: No necesitas `poetry update` después de cada cambio en `payments-py`
- ✅ **Debugging fácil**: Puedes debuggear directamente en el código de `payments-py`
- ✅ **Desarrollo paralelo**: Puedes desarrollar ambos proyectos simultáneamente

---

## 🔄 Volver a Usar la Versión de PyPI

Si más tarde quieres volver a usar la versión publicada:

```bash
# Opción 1: Comando Poetry
poetry remove payments-py
poetry add payments-py

# Opción 2: Editar pyproject.toml manualmente
# Cambiar:
#   payments-py = { path = "../../../payments-py", develop = true }
# Por:
#   payments-py = "^1.0.0"  # o la versión que quieras
# Luego ejecutar:
poetry install
```

---

## 🧪 Verificar que Funciona

### 1. Verificar Importación

```bash
cd /Users/charly/Sites/nevermined/tutorials/mcp-examples/weather-mcp-py
poetry run python -c "from payments_py import Payments; print(Payments.__module__)"
```

**Debe mostrar:** `payments_py.payments`

### 2. Verificar Simplified API

```bash
poetry run python -c "
from payments_py import Payments
import inspect
p = Payments(nvm_api_key='test', environment='staging_sandbox')
print('registerTool:', hasattr(p.mcp, 'registerTool'))
print('start:', hasattr(p.mcp, 'start'))
print('stop:', hasattr(p.mcp, 'stop'))
"
```

**Debe mostrar:**

```
registerTool: True
start: True
stop: True
```

### 3. Verificar Path

```bash
poetry run python -c "
import payments_py
print('Location:', payments_py.__file__)
"
```

**Debe mostrar:** `/Users/charly/Sites/nevermined/payments-py/...`

---

## 🐛 Troubleshooting

### Error: "No module named 'payments_py.mcp.core.server_manager'"

**Causa:** La versión local no está instalada correctamente.

**Solución:**

```bash
# 1. Limpiar cache de Poetry
poetry env remove --all

# 2. Reinstalar dependencias
poetry install

# 3. Verificar instalación
poetry show payments-py
```

### Error: "AttributeError: 'MCPIntegration' object has no attribute 'registerTool'"

**Causa:** Estás usando la versión antigua de PyPI (0.7.6) en lugar de la local.

**Solución:**

```bash
# 1. Verificar qué versión está usando
poetry show payments-py

# 2. Si no muestra location local, reinstalar
poetry update payments-py --lock
```

### Error: Path relativo no funciona

**Causa:** El path `../../../payments-py` es relativo a la ubicación del `pyproject.toml`.

**Solución:** Usa path absoluto:

```toml
payments-py = { path = "/Users/charly/Sites/nevermined/payments-py", develop = true }
```

---

## 📊 Estructura de Directorios Esperada

```
/Users/charly/Sites/nevermined/
├── payments-py/                          # ← payments-py local
│   ├── payments_py/
│   │   ├── mcp/
│   │   │   ├── core/
│   │   │   │   └── server_manager.py   # ← Simplified API
│   │   │   ├── http/
│   │   │   ├── types/
│   │   │   └── index.py
│   │   └── payments.py
│   └── pyproject.toml
│
└── tutorials/
    └── mcp-examples/
        └── weather-mcp-py/              # ← Este proyecto
            ├── src/
            │   └── server.py            # ← Usa payments-py local
            └── pyproject.toml           # ← Apunta a ../../../payments-py
```

El path relativo `../../../payments-py` desde `weather-mcp-py/pyproject.toml` apunta a `payments-py/`.

---

## 🎯 Resumen

**Antes (PyPI):**

```toml
payments-py = "0.7.6"  # ← Versión antigua de PyPI
```

**Ahora (Local):**

```toml
payments-py = { path = "../../../payments-py", develop = true }  # ← Tu código local
```

**Ejecutar:**

```bash
poetry install          # ← Reinstalar con versión local
poetry run python src/server.py  # ← Usar Simplified API
```

---

## ✨ Resultado

Ahora `weather-mcp-py` usará tu implementación **local** de `payments-py`, incluyendo toda la **Simplified API** que acabamos de crear:

- ✅ `payments.mcp.registerTool()`
- ✅ `payments.mcp.registerResource()`
- ✅ `payments.mcp.registerPrompt()`
- ✅ `payments.mcp.start()`
- ✅ `payments.mcp.stop()`

Cualquier cambio que hagas en `payments-py` se reflejará automáticamente en `weather-mcp-py` sin necesidad de reinstalar. 🎉



