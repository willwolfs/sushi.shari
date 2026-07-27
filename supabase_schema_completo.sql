-- ============================================================
-- SCRIPT DE BASE DE DATOS COMPLETA PARA SUPABASE (POSTGRESQL)
-- Proyecto: SHARI SUSHI POS
-- Versión: 1.0.0
-- ============================================================

-- 1. HABILITAR EXTENSIONES NECESARIAS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. FUNCIÓN REUTILIZABLE PARA TRIGGERS DE UPDATED_AT
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- ============================================================
-- TABLA 1: USUARIOS
-- ============================================================
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

CREATE INDEX IF NOT EXISTS idx_usuarios_email ON public.usuarios (email);
CREATE INDEX IF NOT EXISTS idx_usuarios_role ON public.usuarios (role);

DROP TRIGGER IF EXISTS set_usuarios_updated_at ON public.usuarios;
CREATE TRIGGER set_usuarios_updated_at
BEFORE UPDATE ON public.usuarios
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- TABLA 2: CLIENTES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.clientes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_type VARCHAR(20) DEFAULT 'DNI' CHECK (document_type IN ('DNI', 'RUC', 'CE', 'PASAPORTE')),
    document_number VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(30),
    address TEXT,
    total_spent NUMERIC(12,2) DEFAULT 0.00 CHECK (total_spent >= 0),
    total_orders INT DEFAULT 0 CHECK (total_orders >= 0),
    status VARCHAR(20) DEFAULT 'activo' CHECK (status IN ('activo', 'inactivo')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clientes_document ON public.clientes (document_number);
CREATE INDEX IF NOT EXISTS idx_clientes_name ON public.clientes (name);

DROP TRIGGER IF EXISTS set_clientes_updated_at ON public.clientes;
CREATE TRIGGER set_clientes_updated_at
BEFORE UPDATE ON public.clientes
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- TABLA 3: CATEGORIAS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.categorias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    icon VARCHAR(50) DEFAULT 'Utensils',
    color VARCHAR(30) DEFAULT '#E53E3E',
    display_order INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'activo' CHECK (status IN ('activo', 'inactivo')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categorias_display_order ON public.categorias (display_order);

DROP TRIGGER IF EXISTS set_categorias_updated_at ON public.categorias;
CREATE TRIGGER set_categorias_updated_at
BEFORE UPDATE ON public.categorias
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- TABLA 4: PRODUCTOS (CARTA / MENÚ)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.productos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID REFERENCES public.categorias(id) ON DELETE SET NULL,
    code VARCHAR(50) UNIQUE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    cost_price NUMERIC(10,2) DEFAULT 0.00 CHECK (cost_price >= 0),
    stock INT DEFAULT 0,
    track_stock BOOLEAN DEFAULT true,
    image_url TEXT,
    status VARCHAR(20) DEFAULT 'activo' CHECK (status IN ('activo', 'inactivo')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_productos_category ON public.productos (category_id);
CREATE INDEX IF NOT EXISTS idx_productos_code ON public.productos (code);
CREATE INDEX IF NOT EXISTS idx_productos_status ON public.productos (status);

DROP TRIGGER IF EXISTS set_productos_updated_at ON public.productos;
CREATE TRIGGER set_productos_updated_at
BEFORE UPDATE ON public.productos
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- TABLA 5: INVENTARIO INSUMOS (MATERIA PRIMA)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.inventario_insumos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE,
    name VARCHAR(200) NOT NULL,
    unit VARCHAR(20) NOT NULL, -- kg, g, l, ml, unidades, piezas
    current_stock NUMERIC(12,3) DEFAULT 0.000 CHECK (current_stock >= 0),
    min_stock NUMERIC(12,3) DEFAULT 0.000 CHECK (min_stock >= 0),
    unit_cost NUMERIC(10,2) DEFAULT 0.00 CHECK (unit_cost >= 0),
    supplier VARCHAR(200),
    status VARCHAR(20) DEFAULT 'activo' CHECK (status IN ('activo', 'inactivo')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insumos_code ON public.inventario_insumos (code);
CREATE INDEX IF NOT EXISTS idx_insumos_name ON public.inventario_insumos (name);

DROP TRIGGER IF EXISTS set_insumos_updated_at ON public.inventario_insumos;
CREATE TRIGGER set_insumos_updated_at
BEFORE UPDATE ON public.inventario_insumos
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- TABLA 6: RECETAS DETALLES (PRODUCTO VS INSUMOS)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.recetas_detalles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES public.inventario_insumos(id) ON DELETE CASCADE,
    quantity_required NUMERIC(10,3) NOT NULL CHECK (quantity_required > 0),
    unit_measure VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recetas_product ON public.recetas_detalles (product_id);
CREATE INDEX IF NOT EXISTS idx_recetas_ingredient ON public.recetas_detalles (ingredient_id);


-- ============================================================
-- TABLA 7: SESIONES DE CAJA (ARQUEO Y APERTURA/CIERRE)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sesiones_caja (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.usuarios(id),
    opening_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (opening_amount >= 0),
    closing_amount NUMERIC(10,2),
    expected_amount NUMERIC(10,2),
    difference NUMERIC(10,2),
    total_sales_cash NUMERIC(10,2) DEFAULT 0.00,
    total_sales_card NUMERIC(10,2) DEFAULT 0.00,
    total_sales_yape_plin NUMERIC(10,2) DEFAULT 0.00,
    total_incomes NUMERIC(10,2) DEFAULT 0.00,
    total_expenses NUMERIC(10,2) DEFAULT 0.00,
    status VARCHAR(20) DEFAULT 'abierta' CHECK (status IN ('abierta', 'cerrada')),
    notes TEXT,
    opened_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    closed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_sesiones_caja_user ON public.sesiones_caja (user_id);
CREATE INDEX IF NOT EXISTS idx_sesiones_caja_status ON public.sesiones_caja (status);


-- ============================================================
-- TABLA 8: MOVIMIENTOS DE CAJA (INGRESOS Y EGRESOS MANUALES)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.movimientos_caja (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cash_session_id UUID REFERENCES public.sesiones_caja(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.usuarios(id),
    type VARCHAR(20) NOT NULL CHECK (type IN ('ingreso', 'egreso')),
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    reason TEXT NOT NULL,
    payment_method VARCHAR(30) DEFAULT 'efectivo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movimientos_caja_session ON public.movimientos_caja (cash_session_id);


-- ============================================================
-- TABLA 9: VENTAS (PEDIDOS Y COMPROBANTES)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ventas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    receipt_type VARCHAR(20) NOT NULL CHECK (receipt_type IN ('boleta', 'factura', 'ticket')),
    receipt_number VARCHAR(50),
    client_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
    user_id UUID REFERENCES public.usuarios(id),
    cash_session_id UUID REFERENCES public.sesiones_caja(id),
    order_type VARCHAR(30) DEFAULT 'mesa' CHECK (order_type IN ('mesa', 'para_llevar', 'delivery')),
    table_number VARCHAR(20),
    payment_method VARCHAR(30) NOT NULL CHECK (payment_method IN ('efectivo', 'tarjeta', 'yape', 'plin', 'mixto')),
    payment_status VARCHAR(20) DEFAULT 'pagado' CHECK (payment_status IN ('pagado', 'pendiente', 'cancelado')),
    subtotal NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0),
    tax_igv NUMERIC(10,2) NOT NULL CHECK (tax_igv >= 0),
    discount NUMERIC(10,2) DEFAULT 0.00 CHECK (discount >= 0),
    total NUMERIC(10,2) NOT NULL CHECK (total >= 0),
    amount_paid NUMERIC(10,2),
    change_given NUMERIC(10,2),
    status VARCHAR(20) DEFAULT 'completada' CHECK (status IN ('completada', 'anulada', 'en_proceso')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ventas_order_number ON public.ventas (order_number);
CREATE INDEX IF NOT EXISTS idx_ventas_receipt_type ON public.ventas (receipt_type);
CREATE INDEX IF NOT EXISTS idx_ventas_client ON public.ventas (client_id);
CREATE INDEX IF NOT EXISTS idx_ventas_created_at ON public.ventas (created_at);

DROP TRIGGER IF EXISTS set_ventas_updated_at ON public.ventas;
CREATE TRIGGER set_ventas_updated_at
BEFORE UPDATE ON public.ventas
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- TABLA 10: DETALLE DE VENTAS (ITEMS VENDIDOS)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.detalle_ventas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID NOT NULL REFERENCES public.ventas(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.productos(id) ON DELETE SET NULL,
    product_name VARCHAR(200) NOT NULL,
    unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
    quantity INT NOT NULL CHECK (quantity > 0),
    subtotal NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_detalle_ventas_sale ON public.detalle_ventas (sale_id);
CREATE INDEX IF NOT EXISTS idx_detalle_ventas_product ON public.detalle_ventas (product_id);


-- ============================================================
-- TABLA 11: MOVIMIENTOS DE INVENTARIO (KARDEX HISTÓRICO)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.movimientos_inventario (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ingredient_id UUID REFERENCES public.inventario_insumos(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.productos(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.usuarios(id),
    movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('entrada', 'salida', 'ajuste', 'venta')),
    quantity NUMERIC(12,3) NOT NULL,
    previous_stock NUMERIC(12,3),
    new_stock NUMERIC(12,3),
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mov_inv_ingredient ON public.movimientos_inventario (ingredient_id);
CREATE INDEX IF NOT EXISTS idx_mov_inv_product ON public.movimientos_inventario (product_id);


-- ============================================================
-- TABLA 12: AUDITORIA Y LOGS DEL SISTEMA
-- ============================================================
CREATE TABLE IF NOT EXISTS public.auditoria_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    module VARCHAR(50) NOT NULL,
    details JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_user ON public.auditoria_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_module ON public.auditoria_logs (module);


-- ============================================================
-- CONFIGURACIÓN DE SEGURIDAD (ROW LEVEL SECURITY - RLS)
-- ============================================================

ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventario_insumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recetas_detalles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sesiones_caja ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos_caja ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detalle_ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos_inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria_logs ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para lectura, inserción, modificación y eliminación pública
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_type = 'BASE TABLE'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Permitir select total %I" ON public.%I', t, t);
        EXECUTE format('CREATE POLICY "Permitir select total %I" ON public.%I FOR SELECT USING (true)', t, t);

        EXECUTE format('DROP POLICY IF EXISTS "Permitir insert total %I" ON public.%I', t, t);
        EXECUTE format('CREATE POLICY "Permitir insert total %I" ON public.%I FOR INSERT WITH CHECK (true)', t, t);

        EXECUTE format('DROP POLICY IF EXISTS "Permitir update total %I" ON public.%I', t, t);
        EXECUTE format('CREATE POLICY "Permitir update total %I" ON public.%I FOR UPDATE USING (true)', t, t);

        EXECUTE format('DROP POLICY IF EXISTS "Permitir delete total %I" ON public.%I', t, t);
        EXECUTE format('CREATE POLICY "Permitir delete total %I" ON public.%I FOR DELETE USING (true)', t, t);
    END LOOP;
END $$;


-- ============================================================
-- DATOS SEMILLA (SEED DATA INICIAL)
-- ============================================================

-- Usuario Administrador Inicial
INSERT INTO public.usuarios (name, email, role, password, status)
VALUES ('Administrador Principal', 'admin@sharisushi.pe', 'Administrador', '$2a$10$7Z8.05v75H7hD/u0q3N1cO/2E5d6.8u0a9B.4v3B1C5D6E7F8G9H0', 'activo')
ON CONFLICT (email) DO NOTHING;

-- Categorías por Defecto
INSERT INTO public.categorias (name, description, icon, color, display_order)
VALUES 
('Makis', 'Rolls de sushi tradicionales y acevichados', 'Utensils', '#E53E3E', 1),
('Nigiris', 'Porciones de arroz cubiertas con corte de pescado', 'Fish', '#DD6B20', 2),
('Sashimi', 'Cortes puros de salmón, atún y pesca del día', 'Flame', '#D69E2E', 3),
('Combos', 'Combinaciones familiares y promociones especiales', 'Package', '#319795', 4),
('Bebidas', 'Refrescos, cervezas artesanales y sake', 'Coffee', '#3182CE', 5),
('Postres', 'Dulces tradicionales orientales', 'Smile', '#805AD5', 6)
ON CONFLICT (name) DO NOTHING;

-- Cliente General por Defecto
INSERT INTO public.clientes (document_type, document_number, name, email, phone)
VALUES ('DNI', '00000000', 'Cliente Varios / General', 'cliente.varios@sharisushi.pe', '000000000')
ON CONFLICT (document_number) DO NOTHING;
