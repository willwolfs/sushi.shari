import { v4 as uuidv4 } from 'uuid';

/**
 * Módulo de Gestión de Clientes y Datos
 * Validación y almacenamiento de DNI/RUC
 */

// Validar DNI peruano (8 dígitos)
export const validateDNI = (dni) => {
  const clean = dni.replace(/\D/g, '');
  
  if (clean.length !== 8) {
    return { valid: false, message: 'DNI debe tener 8 dígitos' };
  }
  
  if (!/^\d{8}$/.test(clean)) {
    return { valid: false, message: 'DNI debe contener solo números' };
  }

  // Validación de dígito verificador (simplificada)
  const dniPattern = /^[0-9]{8}$/;
  if (!dniPattern.test(clean)) {
    return { valid: false, message: 'Formato de DNI inválido' };
  }

  return { valid: true, message: 'DNI válido', formatted: clean };
};

// Validar RUC peruano (11 dígitos)
export const validateRUC = (ruc) => {
  const clean = ruc.replace(/\D/g, '');
  
  if (clean.length !== 11) {
    return { valid: false, message: 'RUC debe tener 11 dígitos' };
  }
  
  if (!/^\d{11}$/.test(clean)) {
    return { valid: false, message: 'RUC debe contener solo números' };
  }

  return { valid: true, message: 'RUC válido', formatted: clean };
};

// Detectar tipo de documento
export const getDocumentType = (document) => {
  const clean = document.replace(/\D/g, '');
  
  if (clean.length === 8) return 'DNI';
  if (clean.length === 11) return 'RUC';
  return 'DOCUMENTO';
};

// Validar documento (DNI o RUC)
export const validateDocument = (document) => {
  const clean = document.replace(/\D/g, '');
  
  if (clean.length === 8) {
    return validateDNI(clean);
  } else if (clean.length === 11) {
    return validateRUC(clean);
  }
  
  return { valid: false, message: 'Documento debe ser DNI (8 dígitos) o RUC (11 dígitos)' };
};

// Crear cliente
export const createClient = (clientData) => {
  const validation = validateDocument(clientData.document);
  
  if (!validation.valid) {
    return { success: false, error: validation.message };
  }

  if (!clientData.name || clientData.name.trim().length < 3) {
    return { success: false, error: 'Nombre debe tener al menos 3 caracteres' };
  }

  return {
    success: true,
    client: {
      id: uuidv4(),
      document: validation.formatted,
      documentType: getDocumentType(validation.formatted),
      name: clientData.name.trim(),
      email: clientData.email || '',
      phone: clientData.phone || '',
      address: clientData.address || '',
      businessName: clientData.businessName || '',
      createdAt: new Date().toISOString(),
      lastPurchase: null,
      totalPurchases: 0,
      totalAmount: 0,
    },
  };
};

// Buscar cliente por documento
export const findClientByDocument = (clients, document) => {
  const clean = document.replace(/\D/g, '');
  return clients.find((c) => c.document === clean);
};

// Actualizar datos de cliente
export const updateClient = (client, updates) => {
  const validation = validateDocument(updates.document);
  
  if (!validation.valid && updates.document !== client.document) {
    return { success: false, error: validation.message };
  }

  return {
    success: true,
    client: {
      ...client,
      ...updates,
      ...(updates.document && { document: validation.formatted }),
    },
  };
};

// Registrar compra de cliente
export const recordClientPurchase = (client, amount) => {
  return {
    ...client,
    lastPurchase: new Date().toISOString(),
    totalPurchases: (client.totalPurchases || 0) + 1,
    totalAmount: (client.totalAmount || 0) + amount,
  };
};

// Formatear documento para visualización
export const formatDocument = (document) => {
  const clean = document.replace(/\D/g, '');
  
  if (clean.length === 8) {
    // DNI: XXXXXXXX
    return clean.replace(/(\d{0,8})/, '$1');
  } else if (clean.length === 11) {
    // RUC: XX-XXXXXXX-X
    return clean.replace(/(\d{2})(\d{7})(\d{2})/, '$1-$2-$3');
  }
  
  return clean;
};
