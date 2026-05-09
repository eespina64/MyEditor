#!/bin/bash
#
# Script de Configuración de Supabase
# Sistema Editorial EDITIA
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Configuración de Supabase - EDITIA   ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check for required environment variables
check_env() {
    if [ -z "$SUPABASE_DB_URL" ]; then
        echo -e "${YELLOW}Variable SUPABASE_DB_URL no configurada${NC}"
        echo ""
        echo "Por favor, proporcione la URL de conexión a la base de datos:"
        echo "(Formato: postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres)"
        read -p "SUPABASE_DB_URL: " SUPABASE_DB_URL
    fi
}

# Apply migrations
apply_migrations() {
    echo -e "${BLUE}Aplicando migraciones...${NC}"

    MIGRATIONS_DIR="supabase/migrations"

    if [ ! -d "$MIGRATIONS_DIR" ]; then
        echo -e "${RED}Error: Directorio de migraciones no encontrado${NC}"
        exit 1
    fi

    for migration in "$MIGRATIONS_DIR"/*.sql; do
        if [ -f "$migration" ]; then
            echo -e "${BLUE}Aplicando: $(basename $migration)${NC}"

            if command -v psql &> /dev/null; then
                psql "$SUPABASE_DB_URL" -f "$migration"
            else
                echo -e "${YELLOW}psql no está instalado. Usando método alternativo...${NC}"
                # Alternative: use Supabase CLI or curl
                echo -e "${YELLOW}Por favor, ejecute manualmente el siguiente SQL en Supabase Dashboard:${NC}"
                echo -e "${BLUE}$migration${NC}"
                cat "$migration"
            fi
        fi
    done

    echo -e "${GREEN}Migraciones aplicadas correctamente${NC}"
}

# Show configuration guide
show_guide() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  Guía de Configuración de Supabase     ${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
    echo -e "1. Crear proyecto en Supabase:"
    echo -e "   - Ir a ${GREEN}https://supabase.com${NC}"
    echo -e "   - Crear nuevo proyecto"
    echo -e "   - Esperar a que se inicialice"
    echo ""
    echo -e "2. Obtener credenciales:"
    echo -e "   - Ir a Settings > API"
    echo -e "   - Copiar ${GREEN}Project URL${NC} → NEXT_PUBLIC_SUPABASE_URL"
    echo -e "   - Copiar ${GREEN}anon public${NC} → NEXT_PUBLIC_SUPABASE_ANON_KEY"
    echo ""
    echo -e "3. Obtener URL de base de datos:"
    echo -e "   - Ir a Settings > Database"
    echo -e "   - Copiar ${GREEN}Connection string${NC} (URI)"
    echo ""
    echo -e "4. Aplicar migración:"
    echo -e "   - Ir a SQL Editor en Supabase Dashboard"
    echo -e "   - Copiar contenido de: ${GREEN}supabase/migrations/001_initial_schema.sql${NC}"
    echo -e "   - Ejecutar el SQL"
    echo ""
    echo -e "5. Configurar variables en .env:"
    cat << 'EOF'
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
EOF
    echo ""
}

# Main menu
show_menu() {
    echo "Opciones disponibles:"
    echo ""
    echo "  1. Ver guía de configuración"
    echo "  2. Aplicar migraciones (requiere psql)"
    echo "  3. Mostrar SQL de migración"
    echo "  4. Verificar conexión"
    echo "  5. Salir"
    echo ""
    read -p "Seleccione una opción [1-5]: " choice

    case $choice in
        1)
            show_guide
            ;;
        2)
            check_env
            apply_migrations
            ;;
        3)
            echo -e "${BLUE}SQL de migración:${NC}"
            echo ""
            cat supabase/migrations/001_initial_schema.sql
            echo ""
            ;;
        4)
            check_env
            echo -e "${BLUE}Verificando conexión...${NC}"
            if command -v psql &> /dev/null; then
                psql "$SUPABASE_DB_URL" -c "SELECT version();"
                echo -e "${GREEN}Conexión exitosa!${NC}"
            else
                echo -e "${RED}psql no instalado. Instale con: apt install postgresql-client${NC}"
            fi
            ;;
        5)
            exit 0
            ;;
        *)
            echo -e "${RED}Opción inválida${NC}"
            ;;
    esac
}

# Main
if [ "$1" == "--guide" ]; then
    show_guide
elif [ "$1" == "--apply" ]; then
    check_env
    apply_migrations
elif [ "$1" == "--show-sql" ]; then
    cat supabase/migrations/001_initial_schema.sql
else
    show_menu
fi
