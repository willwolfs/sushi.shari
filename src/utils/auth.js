import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

/**
 * Módulo de Autenticación y Seguridad
 * Gestiona encriptación, validación y tokens de sesión
 */

// Hash de contraseña
export const hashPassword = (password) => {
  return bcrypt.hashSync(password, 10);
};

// Validación de contraseña
export const validatePassword = (password, hash) => {
  return bcrypt.compareSync(password, hash);
};

// Tiempo de inactividad por defecto en milisegundos (1 hora = 60 minutos)
export const DEFAULT_INACTIVITY_TIMEOUT = 60 * 60 * 1000;

// Generar token de sesión
export const generateSessionToken = () => {
  return {
    token: `SHARI-SESSION-${uuidv4()}`,
    expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000), // 8 horas
  };
};

/**
 * Genera una sesión segura con token único y marcas de tiempo para control de inactividad
 */
export const createSession = (user, inactivityMinutes = 60) => {
  const now = Date.now();
  const inactivityTimeoutMs = inactivityMinutes * 60 * 1000;
  const token = `SHARI-TOKEN-${uuidv4().substring(0, 8).toUpperCase()}`;

  return {
    ...user,
    token,
    sessionId: token,
    loginTime: new Date(now).toISOString(),
    lastActivity: now,
    expiresAt: now + 8 * 60 * 60 * 1000, // 8 horas máximo
    inactivityTimeoutMs,
  };
};

/**
 * Valida la vigencia de la sesión según expiración absoluta e inactividad
 */
export const validateSession = (session) => {
  if (!session || (!session.token && !session.sessionId)) {
    return { valid: false, reason: 'invalid' };
  }

  const now = Date.now();

  // 1. Expiración de 8 horas absolutas
  if (session.expiresAt && now > session.expiresAt) {
    return { valid: false, reason: 'expired' };
  }

  // 2. Expiración por inactividad
  const timeout = session.inactivityTimeoutMs || DEFAULT_INACTIVITY_TIMEOUT;
  const lastAct = session.lastActivity ? (typeof session.lastActivity === 'number' ? session.lastActivity : new Date(session.lastActivity).getTime()) : 0;

  if (lastAct > 0 && (now - lastAct) >= timeout) {
    return { valid: false, reason: 'inactivity' };
  }

  return { valid: true };
};

// Validar contraseña fuerte
export const isStrongPassword = (password) => {
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return regex.test(password);
};

// Permisos por rol
export const rolePermissions = {
  Administrador: [
    'ver_pos',
    'ver_reportes',
    'ver_caja',
    'ver_historial',
    'gestionar_usuarios',
    'editar_precios',
    'cerrar_caja',
    'exportar_datos',
    'configurar_sistema',
  ],
  Operador: [
    'ver_pos',
    'ver_caja',
    'ver_historial',
    'procesar_ventas',
  ],
  Auditor: [
    'ver_reportes',
    'ver_historial',
    'ver_caja',
    'exportar_datos',
  ],
};

// Verificar permiso
export const hasPermission = (role, permission) => {
  return (rolePermissions[role] || []).includes(permission);
};

// Crear usuario
export const createUser = (userData) => {
  return {
    id: uuidv4(),
    ...userData,
    password: hashPassword(userData.password),
    createdAt: new Date().toISOString(),
    status: 'activo',
    lastLogin: null,
  };
};

// Validar datos de usuario
export const validateUserData = (userData) => {
  const errors = [];

  if (!userData.name || userData.name.trim().length < 3) {
    errors.push('El nombre debe tener al menos 3 caracteres');
  }

  if (!userData.email || !userData.email.includes('@')) {
    errors.push('Email inválido');
  }

  if (!userData.password || !isStrongPassword(userData.password)) {
    errors.push('Contraseña débil (8+ caracteres, mayúscula, minúscula, número, símbolo)');
  }

  if (!['Administrador', 'Operador', 'Auditor'].includes(userData.role)) {
    errors.push('Rol inválido');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};
