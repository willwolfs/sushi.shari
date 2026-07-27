-- ============================================================
-- SCRIPT DE CREACIÓN DE TABLA DE USUARIOS PARA SUPABASE (POSTGRESQL)
-- Proyecto: SHARI SUSHI POS
-- ============================================================

-- 1. Habilitar extensión para generación de UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Crear la tabla de usuarios en el esquema público de Supabase
CREATE TABLE IF NOT EXISTS public.usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('Administrador', 'Operador', 'Cajero', 'Cocina', 'Supervisor', 'Auditor')),
    password TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'activo' CHECK (status IN ('activo', 'inactivo')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Crear índices para búsquedas rápidas por correo y rol
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON public.usuarios (email);
CREATE INDEX IF NOT EXISTS idx_usuarios_role ON public.usuarios (role);

-- 4. Función y Trigger para actualizar la fecha de modificación automática
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

DROP TRIGGER IF EXISTS set_usuarios_updated_at ON public.usuarios;
CREATE TRIGGER set_usuarios_updated_at
BEFORE UPDATE ON public.usuarios
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 5. Habilitar Row Level Security (RLS) en Supabase
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

-- 6. Políticas de acceso RLS para el frontend del POS
DROP POLICY IF EXISTS "Permitir lectura publica de usuarios" ON public.usuarios;
CREATE POLICY "Permitir lectura publica de usuarios" 
ON public.usuarios 
FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Permitir insercion publica de usuarios" ON public.usuarios;
CREATE POLICY "Permitir insercion publica de usuarios" 
ON public.usuarios 
FOR INSERT 
WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir actualizacion publica de usuarios" ON public.usuarios;
CREATE POLICY "Permitir actualizacion publica de usuarios" 
ON public.usuarios 
FOR UPDATE 
USING (true);
