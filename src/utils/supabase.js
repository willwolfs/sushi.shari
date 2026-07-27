import { createClient } from '@supabase/supabase-js';

// Configuración de Supabase utilizando tus credenciales activas
const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL || 'https://kjamauejsjsoywkrcbqz.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY || 'sb_publishable_eO0jOymKMqHwqbbFjReWlA_jSW7C_eG';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const restHeaders = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

/**
 * Servicio para verificar el estado de conexión con Supabase
 */
export const HealthService = {
  async checkConnection() {
    try {
      const { data, error } = await supabase.from('usuarios').select('id').limit(1);
      return !error;
    } catch {
      return false;
    }
  }
};

/**
 * 1. SERVICIO DE USUARIOS (CRUD COMPLETO)
 */
export const UserService = {
  async getUsers() {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) return data;

      const res = await fetch(`${SUPABASE_URL}/rest/v1/usuarios?select=*&order=created_at.desc`, { headers: restHeaders });
      if (res.ok) return await res.json();
      return null;
    } catch (err) {
      console.error('Error consultando usuarios:', err);
      return null;
    }
  },

  async createUser(newUser) {
    const payload = {
      name: newUser.name,
      email: newUser.email.toLowerCase().trim(),
      role: newUser.role,
      password: newUser.password,
      status: newUser.status || 'activo'
    };

    try {
      const { data, error } = await supabase.from('usuarios').insert([payload]).select();
      if (!error && data?.[0]) return data[0];
      if (error && error.code === '23505') {
        throw new Error('Este correo ya está registrado');
      }
    } catch (sdkErr) {
      if (sdkErr.message.includes('registrado')) throw sdkErr;
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/usuarios`, {
      method: 'POST',
      headers: restHeaders,
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(errJson.message || 'Error al guardar usuario en BD');
    }

    const data = await res.json();
    return Array.isArray(data) ? data[0] : data;
  },

  async updateUser(id, updates) {
    const payload = {
      ...(updates.name && { name: updates.name }),
      ...(updates.email && { email: updates.email.toLowerCase().trim() }),
      ...(updates.role && { role: updates.role }),
      ...(updates.password && { password: updates.password }),
      ...(updates.status && { status: updates.status })
    };

    try {
      const { data, error } = await supabase
        .from('usuarios')
        .update(payload)
        .eq('id', id)
        .select();

      if (!error && data?.[0]) return data[0];
    } catch (err) {
      console.warn('Fallback actualizando usuario REST:', err);
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/usuarios?id=eq.${id}`, {
      method: 'PATCH',
      headers: restHeaders,
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data) ? data[0] : data;
    }
    return null;
  },

  async deleteUser(id) {
    try {
      const { error } = await supabase.from('usuarios').delete().eq('id', id);
      if (!error) return true;
    } catch (err) {
      console.warn('Fallback eliminando usuario REST:', err);
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/usuarios?id=eq.${id}`, {
      method: 'DELETE',
      headers: restHeaders
    });
    return res.ok;
  },

  async getUserByEmail(email) {
    const cleanEmail = email.toLowerCase().trim();
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (!error && data) return data;

      const res = await fetch(`${SUPABASE_URL}/rest/v1/usuarios?email=eq.${encodeURIComponent(cleanEmail)}`, { headers: restHeaders });
      if (res.ok) {
        const rows = await res.json();
        return rows[0] || null;
      }
      return null;
    } catch (err) {
      console.error('Error al obtener usuario por correo:', err);
      return null;
    }
  }
};

/**
 * 2. SERVICIO DE CLIENTES (CRUD COMPLETO)
 */
export const ClientService = {
  async getClients() {
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        return data.map(c => ({
          id: c.id,
          document: c.document_number,
          documentType: c.document_type || 'DNI',
          name: c.name,
          email: c.email || '',
          phone: c.phone || '',
          address: c.address || '',
          totalAmount: parseFloat(c.total_spent || 0),
          totalPurchases: parseInt(c.total_orders || 0),
          status: c.status || 'activo',
          createdAt: c.created_at
        }));
      }

      const res = await fetch(`${SUPABASE_URL}/rest/v1/clientes?select=*&order=created_at.desc`, { headers: restHeaders });
      if (res.ok) {
        const raw = await res.json();
        return raw.map(c => ({
          id: c.id,
          document: c.document_number,
          documentType: c.document_type || 'DNI',
          name: c.name,
          email: c.email || '',
          phone: c.phone || '',
          address: c.address || '',
          totalAmount: parseFloat(c.total_spent || 0),
          totalPurchases: parseInt(c.total_orders || 0),
          status: c.status || 'activo',
          createdAt: c.created_at
        }));
      }
      return null;
    } catch (err) {
      console.error('Error consultando clientes:', err);
      return null;
    }
  },

  async createClient(client) {
    const payload = {
      document_type: client.documentType || (client.document?.length === 11 ? 'RUC' : 'DNI'),
      document_number: client.document,
      name: client.name,
      email: client.email || '',
      phone: client.phone || '',
      address: client.address || '',
      total_spent: client.totalAmount || 0,
      total_orders: client.totalPurchases || 0,
      status: client.status || 'activo'
    };

    try {
      const { data, error } = await supabase.from('clientes').insert([payload]).select();
      if (!error && data?.[0]) return data[0];
    } catch (err) {
      console.warn('Fallback creando cliente REST:', err);
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/clientes`, {
      method: 'POST',
      headers: restHeaders,
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data) ? data[0] : data;
    }
    return null;
  },

  async updateClient(documentNumber, updates) {
    const payload = {
      ...(updates.name && { name: updates.name }),
      ...(updates.email !== undefined && { email: updates.email }),
      ...(updates.phone !== undefined && { phone: updates.phone }),
      ...(updates.address !== undefined && { address: updates.address }),
      ...(updates.totalAmount !== undefined && { total_spent: updates.totalAmount }),
      ...(updates.totalPurchases !== undefined && { total_orders: updates.totalPurchases }),
      ...(updates.status && { status: updates.status })
    };

    try {
      const { data, error } = await supabase
        .from('clientes')
        .update(payload)
        .eq('document_number', documentNumber)
        .select();

      if (!error && data?.[0]) return data[0];
    } catch (err) {
      console.warn('Fallback actualizando cliente REST:', err);
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/clientes?document_number=eq.${documentNumber}`, {
      method: 'PATCH',
      headers: restHeaders,
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data) ? data[0] : data;
    }
    return null;
  },

  async deleteClient(documentNumber) {
    try {
      const { error } = await supabase.from('clientes').delete().eq('document_number', documentNumber);
      if (!error) return true;
    } catch (err) {
      console.warn('Fallback eliminando cliente REST:', err);
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/clientes?document_number=eq.${documentNumber}`, {
      method: 'DELETE',
      headers: restHeaders
    });
    return res.ok;
  }
};

/**
 * 3. SERVICIO DE CATEGORÍAS (CRUD COMPLETO)
 */
export const CategoryService = {
  async getCategories() {
    try {
      const { data, error } = await supabase
        .from('categorias')
        .select('*')
        .order('display_order', { ascending: true });

      if (!error && data) {
        return data.map(c => c.name);
      }

      const res = await fetch(`${SUPABASE_URL}/rest/v1/categorias?select=*&order=display_order.asc`, { headers: restHeaders });
      if (res.ok) {
        const raw = await res.json();
        return raw.map(c => c.name);
      }
      return null;
    } catch (err) {
      console.error('Error consultando categorías:', err);
      return null;
    }
  },

  async createCategory(categoryName, description = '') {
    const payload = {
      name: categoryName.trim(),
      description: description || `Categoría ${categoryName}`,
      display_order: Date.now() % 1000
    };

    try {
      const { data, error } = await supabase.from('categorias').insert([payload]).select();
      if (!error && data?.[0]) return data[0];
    } catch (err) {
      console.warn('Fallback creando categoría REST:', err);
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/categorias`, {
      method: 'POST',
      headers: restHeaders,
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data) ? data[0] : data;
    }
    return null;
  },

  async updateCategory(oldName, newName) {
    try {
      const { data, error } = await supabase
        .from('categorias')
        .update({ name: newName.trim() })
        .eq('name', oldName)
        .select();

      if (!error && data?.[0]) return data[0];
    } catch (err) {
      console.warn('Fallback actualizando categoría REST:', err);
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/categorias?name=eq.${encodeURIComponent(oldName)}`, {
      method: 'PATCH',
      headers: restHeaders,
      body: JSON.stringify({ name: newName.trim() })
    });
    return res.ok;
  },

  async deleteCategory(categoryName) {
    try {
      const { error } = await supabase.from('categorias').delete().eq('name', categoryName);
      if (!error) return true;
    } catch (err) {
      console.warn('Fallback eliminando categoría REST:', err);
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/categorias?name=eq.${encodeURIComponent(categoryName)}`, {
      method: 'DELETE',
      headers: restHeaders
    });
    return res.ok;
  }
};

/**
 * 4. SERVICIO DE PRODUCTOS (CRUD COMPLETO)
 */
export const ProductService = {
  async getProducts() {
    try {
      const { data, error } = await supabase
        .from('productos')
        .select('*, categorias(name)')
        .order('created_at', { ascending: false });

      if (!error && data) {
        return data.map(p => ({
          id: p.id,
          code: p.code || `MK${p.id.slice(0, 4)}`,
          name: p.name,
          price: parseFloat(p.price),
          stock: parseInt(p.stock || 0),
          category: p.categorias?.name || 'Makis',
          image: p.image_url || '',
          description: p.description || '',
          status: p.status || 'activo'
        }));
      }

      const res = await fetch(`${SUPABASE_URL}/rest/v1/productos?select=*&order=created_at.desc`, { headers: restHeaders });
      if (res.ok) {
        const raw = await res.json();
        return raw.map(p => ({
          id: p.id,
          code: p.code || `MK${p.id.slice(0, 4)}`,
          name: p.name,
          price: parseFloat(p.price),
          stock: parseInt(p.stock || 0),
          category: 'Makis',
          image: p.image_url || '',
          description: p.description || '',
          status: p.status || 'activo'
        }));
      }
      return null;
    } catch (err) {
      console.error('Error consultando productos:', err);
      return null;
    }
  },

  async createProduct(product) {
    const payload = {
      code: product.code,
      name: product.name,
      price: product.price,
      stock: product.stock,
      image_url: product.image || '',
      description: product.description || '',
      status: product.status || 'activo'
    };

    try {
      const { data, error } = await supabase.from('productos').insert([payload]).select();
      if (!error && data?.[0]) return data[0];
    } catch (err) {
      console.warn('Fallback creando producto REST:', err);
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/productos`, {
      method: 'POST',
      headers: restHeaders,
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data) ? data[0] : data;
    }
    return null;
  },

  async updateProduct(id, updates) {
    const payload = {
      ...(updates.name && { name: updates.name }),
      ...(updates.code && { code: updates.code }),
      ...(updates.price !== undefined && { price: updates.price }),
      ...(updates.stock !== undefined && { stock: updates.stock }),
      ...(updates.image !== undefined && { image_url: updates.image }),
      ...(updates.description !== undefined && { description: updates.description }),
      ...(updates.status && { status: updates.status })
    };

    try {
      const { data, error } = await supabase
        .from('productos')
        .update(payload)
        .eq('id', id)
        .select();

      if (!error && data?.[0]) return data[0];
    } catch (err) {
      console.warn('Fallback actualizando producto REST:', err);
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/productos?id=eq.${id}`, {
      method: 'PATCH',
      headers: restHeaders,
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data) ? data[0] : data;
    }
    return null;
  },

  async deleteProduct(id) {
    try {
      const { error } = await supabase.from('productos').delete().eq('id', id);
      if (!error) return true;
    } catch (err) {
      console.warn('Fallback eliminando producto REST:', err);
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/productos?id=eq.${id}`, {
      method: 'DELETE',
      headers: restHeaders
    });
    return res.ok;
  }
};

/**
 * 5. SERVICIO DE INVENTARIO E INSUMOS (CRUD COMPLETO)
 */
export const InventoryService = {
  async getInventory() {
    try {
      const { data, error } = await supabase
        .from('inventario_insumos')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        return data.map(item => ({
          id: item.id,
          code: item.code || `INV-${item.id.slice(0, 4)}`,
          name: item.name,
          type: 'INSUMO',
          category: item.supplier || 'General',
          stock: parseFloat(item.current_stock || 0),
          minStock: parseFloat(item.min_stock || 0),
          unit: item.unit || 'uds',
          cost: parseFloat(item.unit_cost || 0),
          supplier: item.supplier || '',
          status: item.status || 'activo'
        }));
      }

      const res = await fetch(`${SUPABASE_URL}/rest/v1/inventario_insumos?select=*&order=created_at.desc`, { headers: restHeaders });
      if (res.ok) {
        const raw = await res.json();
        return raw.map(item => ({
          id: item.id,
          code: item.code || `INV-${item.id.slice(0, 4)}`,
          name: item.name,
          type: 'INSUMO',
          category: item.supplier || 'General',
          stock: parseFloat(item.current_stock || 0),
          minStock: parseFloat(item.min_stock || 0),
          unit: item.unit || 'uds',
          cost: parseFloat(item.unit_cost || 0),
          supplier: item.supplier || '',
          status: item.status || 'activo'
        }));
      }
      return null;
    } catch (err) {
      console.error('Error consultando inventario:', err);
      return null;
    }
  },

  async createInventoryItem(item) {
    const payload = {
      code: item.code || `INV-${Date.now().toString().slice(-6)}`,
      name: item.name,
      unit: item.unit || 'uds',
      current_stock: item.stock || 0,
      min_stock: item.minStock || 5,
      unit_cost: item.cost || 0,
      supplier: item.category || item.supplier || 'General',
      status: item.status || 'activo'
    };

    try {
      const { data, error } = await supabase.from('inventario_insumos').insert([payload]).select();
      if (!error && data?.[0]) return data[0];
    } catch (err) {
      console.warn('Fallback creando insumo REST:', err);
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/inventario_insumos`, {
      method: 'POST',
      headers: restHeaders,
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data) ? data[0] : data;
    }
    return null;
  },

  async updateInventoryItem(id, updates) {
    const payload = {
      ...(updates.name && { name: updates.name }),
      ...(updates.unit && { unit: updates.unit }),
      ...(updates.stock !== undefined && { current_stock: updates.stock }),
      ...(updates.minStock !== undefined && { min_stock: updates.minStock }),
      ...(updates.cost !== undefined && { unit_cost: updates.cost }),
      ...(updates.category && { supplier: updates.category }),
      ...(updates.status && { status: updates.status })
    };

    try {
      const { data, error } = await supabase
        .from('inventario_insumos')
        .update(payload)
        .eq('id', id)
        .select();

      if (!error && data?.[0]) return data[0];
    } catch (err) {
      console.warn('Fallback actualizando insumo REST:', err);
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/inventario_insumos?id=eq.${id}`, {
      method: 'PATCH',
      headers: restHeaders,
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data) ? data[0] : data;
    }
    return null;
  },

  async deleteInventoryItem(id) {
    try {
      const { error } = await supabase.from('inventario_insumos').delete().eq('id', id);
      if (!error) return true;
    } catch (err) {
      console.warn('Fallback eliminando insumo REST:', err);
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/inventario_insumos?id=eq.${id}`, {
      method: 'DELETE',
      headers: restHeaders
    });
    return res.ok;
  }
};

/**
 * 6. SERVICIO DE VENTAS Y COMPROBANTES (CRUD COMPLETO)
 */
export const SalesService = {
  async getSales() {
    try {
      const { data, error } = await supabase
        .from('ventas')
        .select('*, detalle_ventas(*)')
        .order('created_at', { ascending: false });

      if (!error && data) {
        return data.map(s => ({
          id: s.order_number || s.id,
          dbId: s.id,
          receiptType: s.receipt_type?.toUpperCase() || 'BOLETA',
          clientName: s.notes?.includes('Cliente:') ? s.notes.split('Cliente:')[1].trim() : 'Cliente General',
          clientDocument: s.notes?.includes('Doc:') ? s.notes.split('Doc:')[1].trim() : '00000000',
          items: (s.detalle_ventas || []).map(d => ({
            name: d.product_name,
            quantity: d.quantity,
            price: parseFloat(d.unit_price)
          })),
          subtotal: parseFloat(s.subtotal),
          discount: parseFloat(s.discount || 0),
          netAmount: parseFloat(s.subtotal) - parseFloat(s.discount || 0),
          tax: parseFloat(s.tax_igv),
          total: parseFloat(s.total),
          paymentMethod: s.payment_method || 'Efectivo',
          tableNumber: s.table_number || '1',
          notes: s.notes || '',
          timestamp: s.created_at,
          verified: s.status === 'completada'
        }));
      }

      const res = await fetch(`${SUPABASE_URL}/rest/v1/ventas?select=*,detalle_ventas(*)&order=created_at.desc`, { headers: restHeaders });
      if (res.ok) {
        const raw = await res.json();
        return raw.map(s => ({
          id: s.order_number || s.id,
          dbId: s.id,
          receiptType: s.receipt_type?.toUpperCase() || 'BOLETA',
          clientName: 'Cliente General',
          clientDocument: '00000000',
          items: (s.detalle_ventas || []).map(d => ({
            name: d.product_name,
            quantity: d.quantity,
            price: parseFloat(d.unit_price)
          })),
          subtotal: parseFloat(s.subtotal),
          discount: parseFloat(s.discount || 0),
          netAmount: parseFloat(s.subtotal) - parseFloat(s.discount || 0),
          tax: parseFloat(s.tax_igv),
          total: parseFloat(s.total),
          paymentMethod: s.payment_method || 'Efectivo',
          tableNumber: s.table_number || '1',
          notes: s.notes || '',
          timestamp: s.created_at,
          verified: s.status === 'completada'
        }));
      }
      return null;
    } catch (err) {
      console.error('Error consultando ventas:', err);
      return null;
    }
  },

  async createSale(sale) {
    const payload = {
      order_number: sale.id,
      receipt_type: (sale.receiptType || 'boleta').toLowerCase(),
      table_number: sale.tableNumber || sale.table || '1',
      payment_method: sale.paymentMethod || 'efectivo',
      subtotal: sale.subtotal || 0,
      tax_igv: sale.tax || 0,
      discount: sale.discountValue || sale.discount || 0,
      total: sale.total || 0,
      notes: `Cliente: ${sale.clientName || ''} | Doc: ${sale.clientDocument || ''} | ${sale.notes || ''}`
    };

    try {
      const { data, error } = await supabase.from('ventas').insert([payload]).select();
      if (!error && data?.[0]) {
        const saleRecord = data[0];

        // Insertar items en detalle_ventas
        if (sale.items && sale.items.length > 0) {
          const detailsPayload = sale.items.map(item => ({
            sale_id: saleRecord.id,
            product_name: item.name,
            unit_price: item.price,
            quantity: item.quantity,
            subtotal: item.price * item.quantity
          }));
          await supabase.from('detalle_ventas').insert(detailsPayload);
        }
        return saleRecord;
      }
    } catch (err) {
      console.warn('Fallback creando venta REST:', err);
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/ventas`, {
      method: 'POST',
      headers: restHeaders,
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data) ? data[0] : data;
    }
    return null;
  },

  async updateSale(id, updates) {
    const payload = {
      ...(updates.total !== undefined && { total: updates.total }),
      ...(updates.paymentMethod && { payment_method: updates.paymentMethod }),
      ...(updates.verified !== undefined && { status: updates.verified ? 'completada' : 'en_proceso' }),
      ...(updates.clientName && { notes: `Cliente: ${updates.clientName}` })
    };

    try {
      const { data, error } = await supabase
        .from('ventas')
        .update(payload)
        .or(`order_number.eq.${id},id.eq.${id}`)
        .select();

      if (!error && data?.[0]) return data[0];
    } catch (err) {
      console.warn('Fallback actualizando venta REST:', err);
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/ventas?order_number=eq.${id}`, {
      method: 'PATCH',
      headers: restHeaders,
      body: JSON.stringify(payload)
    });
    return res.ok;
  },

  async deleteSale(id) {
    try {
      const { error } = await supabase.from('ventas').delete().or(`order_number.eq.${id},id.eq.${id}`);
      if (!error) return true;
    } catch (err) {
      console.warn('Fallback eliminando venta REST:', err);
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/ventas?order_number=eq.${id}`, {
      method: 'DELETE',
      headers: restHeaders
    });
    return res.ok;
  }
};

/**
 * 7. SERVICIO DE CAJA Y MOVIMIENTOS (CRUD COMPLETO)
 */
export const CashService = {
  async getCashMovements() {
    try {
      const { data, error } = await supabase
        .from('movimientos_caja')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        return data.map(m => ({
          id: m.id,
          type: m.type,
          description: m.reason,
          amount: parseFloat(m.amount),
          paymentMethod: m.payment_method || 'Efectivo',
          date: m.created_at
        }));
      }

      const res = await fetch(`${SUPABASE_URL}/rest/v1/movimientos_caja?select=*&order=created_at.desc`, { headers: restHeaders });
      if (res.ok) {
        const raw = await res.json();
        return raw.map(m => ({
          id: m.id,
          type: m.type,
          description: m.reason,
          amount: parseFloat(m.amount),
          paymentMethod: m.payment_method || 'Efectivo',
          date: m.created_at
        }));
      }
      return null;
    } catch (err) {
      console.error('Error consultando movimientos de caja:', err);
      return null;
    }
  },

  async createCashMovement(movement) {
    const payload = {
      type: movement.type || 'ingreso',
      amount: movement.amount,
      reason: movement.description || movement.reason || 'Movimiento de Caja',
      payment_method: movement.paymentMethod || 'efectivo'
    };

    try {
      const { data, error } = await supabase.from('movimientos_caja').insert([payload]).select();
      if (!error && data?.[0]) return data[0];
    } catch (err) {
      console.warn('Fallback creando movimiento REST:', err);
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/movimientos_caja`, {
      method: 'POST',
      headers: restHeaders,
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data) ? data[0] : data;
    }
    return null;
  },

  async deleteCashMovement(id) {
    try {
      const { error } = await supabase.from('movimientos_caja').delete().eq('id', id);
      if (!error) return true;
    } catch (err) {
      console.warn('Fallback eliminando movimiento REST:', err);
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/movimientos_caja?id=eq.${id}`, {
      method: 'DELETE',
      headers: restHeaders
    });
    return res.ok;
  }
};
