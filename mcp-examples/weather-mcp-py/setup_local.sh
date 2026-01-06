#!/bin/bash
# Script para configurar payments-py local en weather-mcp-py

set -e  # Exit on error

echo "🔗 Configurando payments-py local en weather-mcp-py"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if payments-py exists
PAYMENTS_PATH="../../../payments-py"
if [ ! -d "$PAYMENTS_PATH" ]; then
    echo "❌ Error: No se encuentra payments-py en $PAYMENTS_PATH"
    echo ""
    echo "📂 Estructura esperada:"
    echo "   /Users/charly/Sites/nevermined/"
    echo "   ├── payments-py/                    ← Debe existir"
    echo "   └── tutorials/mcp-examples/weather-mcp-py/"
    echo ""
    exit 1
fi

echo "✅ Encontrado: $PAYMENTS_PATH"
echo ""

# Check if pyproject.toml already has local path
if grep -q 'path = "../../../payments-py"' pyproject.toml; then
    echo "✅ pyproject.toml ya está configurado para usar payments-py local"
else
    echo "⚠️  pyproject.toml no está configurado para usar payments-py local"
    echo "   Por favor, ejecuta primero:"
    echo "   poetry remove payments-py"
    echo "   poetry add --editable ../../../payments-py"
    echo ""
fi

# Remove old poetry.lock if exists
if [ -f "poetry.lock" ]; then
    echo "🔄 Eliminando poetry.lock antiguo..."
    rm poetry.lock
    echo "✅ poetry.lock eliminado"
    echo ""
fi

# Install dependencies
echo "📦 Instalando dependencias con payments-py local..."
echo ""
poetry install

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Configuración completada"
echo ""

# Verify installation
echo "🔍 Verificando instalación..."
echo ""

LOCATION=$(poetry run python -c "import payments_py; import os; print(os.path.dirname(payments_py.__file__))" 2>&1)

if [[ "$LOCATION" == *"payments-py/payments_py"* ]]; then
    echo "✅ payments-py instalado correctamente desde:"
    echo "   $LOCATION"
    echo ""
    
    # Check Simplified API
    echo "🔍 Verificando Simplified API..."
    HAS_REGISTER=$(poetry run python -c "from payments_py import Payments; p = Payments(nvm_api_key='test', environment='staging_sandbox'); print(hasattr(p.mcp, 'registerTool'))" 2>&1)
    HAS_START=$(poetry run python -c "from payments_py import Payments; p = Payments(nvm_api_key='test', environment='staging_sandbox'); print(hasattr(p.mcp, 'start'))" 2>&1)
    
    if [[ "$HAS_REGISTER" == "True" ]] && [[ "$HAS_START" == "True" ]]; then
        echo "✅ Simplified API disponible:"
        echo "   - payments.mcp.registerTool() ✓"
        echo "   - payments.mcp.registerResource() ✓"
        echo "   - payments.mcp.registerPrompt() ✓"
        echo "   - payments.mcp.start() ✓"
        echo "   - payments.mcp.stop() ✓"
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "🎉 ¡Todo listo! Ahora puedes ejecutar:"
        echo ""
        echo "   poetry run python src/server.py"
        echo ""
        echo "   o bien:"
        echo ""
        echo "   ./run_simplified.sh"
        echo ""
    else
        echo "⚠️  Simplified API no está disponible"
        echo "   registerTool: $HAS_REGISTER"
        echo "   start: $HAS_START"
        echo ""
        echo "   Puede que necesites actualizar payments-py local."
    fi
else
    echo "⚠️  payments-py no está instalado desde local:"
    echo "   $LOCATION"
    echo ""
    echo "   Ejecuta manualmente:"
    echo "   poetry remove payments-py"
    echo "   poetry add --editable ../../../payments-py"
fi



