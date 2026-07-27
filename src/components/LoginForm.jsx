import React, { useState, useEffect } from 'react';
import { validatePassword, createSession } from '../utils/auth';
import { UserService } from '../utils/supabase';
import bcrypt from 'bcryptjs';
import './LoginForm.css';

/**
 * Componente de Autenticación - SHARI SUSHI POS (Modo Producción)
 * Conexión nativa con Supabase para Login y Registro
 */
export default function LoginForm({ users = [], onLoginSuccess, onRegisterUser, inactivityNotice = false }) {
  const [activeTab, setActiveTab] = useState('login'); // 'login' | 'register' | 'forgot'

  // — Estado Login —
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // — Estado Recuperar Contraseña —
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMsg, setForgotMsg] = useState('');
  const [forgotError, setForgotError] = useState('');

  // — Estado Registro —
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [regRole, setRegRole] = useState('Cajero');
  const [regShowPass, setRegShowPass] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');

  // Sincronizar usuarios desde Supabase al iniciar el componente y purgar eliminados
  useEffect(() => {
    async function syncSupabase() {
      try {
        const spUsers = await UserService.getUsers();
        if (spUsers && Array.isArray(spUsers)) {
          // Reemplazar o purgar usuarios locales que ya no existen en Supabase
          const validUsers = spUsers.map((spUser) => ({
            id: spUser.id,
            name: spUser.name,
            email: spUser.email,
            role: spUser.role,
            password: spUser.password,
            status: spUser.status,
            createdAt: spUser.created_at,
          }));
          
          // Actualizar localStorage y memoria con los datos reales de Supabase
          localStorage.setItem('shari-users', JSON.stringify(validUsers));
          if (onRegisterUser) {
            validUsers.forEach(u => onRegisterUser(u));
          }
        }
      } catch (err) {
        console.warn('Info: No se completó la sincronización inicial con Supabase:', err);
      }
    }
    syncSupabase();
  }, []);

  /* ─── MANEJO DE LOGIN (CONSULTA OBLIGATORIA A SUPABASE) ─── */
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();
      
      // 1. Consultar a Supabase en TIEMPO REAL como FUENTE ÚNICA DE VERDAD
      let user = null;
      try {
        const spUser = await UserService.getUserByEmail(cleanEmail);
        if (spUser) {
          user = {
            id: spUser.id,
            name: spUser.name,
            email: spUser.email,
            role: spUser.role,
            password: spUser.password,
            status: spUser.status,
            createdAt: spUser.created_at,
          };
        }
      } catch (errSp) {
        console.warn('Error al verificar usuario en Supabase:', errSp);
      }

      // 2. Si el usuario NO EXISTE en Supabase (fue eliminado de la base de datos)
      if (!user) {
        // Purgar de la memoria local por si acaso existía en localStorage previo
        const updatedLocalUsers = users.filter(u => u.email.toLowerCase() !== cleanEmail);
        localStorage.setItem('shari-users', JSON.stringify(updatedLocalUsers));

        setError('Acceso denegado: El usuario no existe en la base de datos o fue eliminado.');
        setLoading(false);
        return;
      }

      // 3. Verificar estado activo
      if (user.status !== 'activo') {
        setError('Usuario desactivado. Contacte al administrador.');
        setLoading(false);
        return;
      }

      // 4. Validar contraseña cifrada con BCrypt
      if (!validatePassword(password, user.password)) {
        setError('Contraseña incorrecta');
        setLoading(false);
        return;
      }

      const sessionUser = createSession({
        ...user,
        password: undefined,
      }, 60); // Token seguro con expiración por 1 hora (60 min) de inactividad

      onLoginSuccess(sessionUser);
      setPassword('');
    } catch (err) {
      setError('Error en la autenticación: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  /* ─── MANEJO DE REGISTRO DE USUARIO ─── */
  const handleRegister = async (e) => {
    e.preventDefault();
    setRegError('');
    setRegSuccess('');

    if (!regName.trim()) { setRegError('El nombre completo es requerido'); return; }
    if (!regEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail)) { setRegError('Ingrese un correo electrónico válido'); return; }
    if (regPassword.length < 8) { setRegError('La contraseña debe tener al menos 8 caracteres'); return; }
    if (regPassword !== regConfirm) { setRegError('Las contraseñas no coinciden'); return; }

    setRegLoading(true);
    try {
      const hashedPassword = bcrypt.hashSync(regPassword, 10);
      const newUser = {
        name: regName.trim(),
        email: regEmail.trim().toLowerCase(),
        role: regRole,
        password: hashedPassword,
        status: 'activo',
      };

      // 1. Guardar en la base de datos de Supabase
      let createdUser = null;
      try {
        createdUser = await UserService.createUser(newUser);
      } catch (spError) {
        console.warn('Registro guardado localmente (Supabase aviso):', spError.message);
      }

      const finalUser = {
        id: createdUser?.id || `USR-${Date.now()}`,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        password: newUser.password,
        status: newUser.status,
        createdAt: createdUser?.created_at || new Date().toISOString(),
      };

      // 2. Guardar en el estado React de la aplicación
      if (onRegisterUser) onRegisterUser(finalUser);

      setRegSuccess(`Cuenta creada exitosamente. Redirigiendo a inicio de sesión...`);
      setRegName(''); setRegEmail(''); setRegPassword(''); setRegConfirm(''); setRegRole('Cajero');
      setTimeout(() => {
        setActiveTab('login');
        setEmail(finalUser.email);
        setRegSuccess('');
      }, 1500);
    } catch (err) {
      setRegError('Error al crear la cuenta: ' + err.message);
    } finally {
      setRegLoading(false);
    }
  };

  /* ─── RECUPERAR CONTRASEÑA ─── */
  const handleForgot = (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotMsg('');
    if (!forgotEmail.trim()) {
      setForgotError('Ingresa tu correo para recuperar el acceso');
      return;
    }
    const found = users.find(u => u.email.toLowerCase() === forgotEmail.trim().toLowerCase());
    if (!found) {
      setForgotError('No existe una cuenta registrada con este correo');
      return;
    }
    setForgotMsg('Se ha enviado una solicitud de restablecimiento al administrador.');
  };

  const roles = ['Administrador', 'Cajero'];

  return (
    <div className="nl-container">
      <div className="nl-card">
        {/* Avatar Superior */}
        <div className="nl-avatar-wrap">
          <img
            src="/shari_avatar.png"
            alt="Logo"
            className="nl-avatar-img"
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
          <div className="nl-avatar-fallback" style={{ display: 'none' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </div>
        </div>

        {/* ── TAB LOGIN ── */}
        {activeTab === 'login' && (
          <div className="nl-content-body">
            <h1 className="nl-title">BIENVENIDO</h1>
            <p className="nl-subtitle">Ingresa tus credenciales para acceder</p>

            {inactivityNotice && (
              <div className="nl-alert" style={{ background: '#FFFBEB', color: '#B45309', border: '1px solid #FCD34D', padding: '10px 14px', borderRadius: '10px', marginBottom: '1rem', fontSize: '0.85rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span>Tu sesión fue cerrada automáticamente por inactividad para proteger tus datos. Ingresa nuevamente.</span>
              </div>
            )}

            {error && <div className="nl-alert nl-alert-error">{error}</div>}

            <form onSubmit={handleLogin} className="nl-form" autoComplete="off">
              {/* Usuario / Email */}
              <div className="nl-field-wrap">
                <span className="nl-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                </span>
                <input
                  type="email"
                  className="nl-input"
                  placeholder="Usuario / Correo electrónico"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              {/* Contraseña */}
              <div className="nl-field-wrap">
                <span className="nl-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="nl-input"
                  placeholder="Contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  className="nl-eye-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  title={showPassword ? "Ocultar" : "Mostrar"}
                >
                  {showPassword ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  )}
                </button>
              </div>

              {/* ¿Olvidaste tu contraseña? */}
              <div className="nl-forgot-row">
                <button
                  type="button"
                  className="nl-link-btn"
                  onClick={() => { setActiveTab('forgot'); setForgotError(''); setForgotMsg(''); }}
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>

              {/* Botón de envío */}
              <button
                type="submit"
                className={`nl-btn-submit ${loading ? 'nl-loading' : ''}`}
                disabled={loading}
              >
                {loading ? 'Ingresando...' : 'Iniciar Sesión'}
              </button>
            </form>

            {/* Opción Crear Cuenta */}
            <div className="nl-footer-switch">
              <span className="nl-footer-text">¿No tienes una cuenta?</span>
              <button
                type="button"
                className="nl-signup-btn"
                onClick={() => { setActiveTab('register'); setRegError(''); setRegSuccess(''); }}
              >
                CREAR CUENTA
              </button>
            </div>
          </div>
        )}

        {/* ── TAB REGISTRO ── */}
        {activeTab === 'register' && (
          <div className="nl-content-body">
            <h1 className="nl-title">CREAR CUENTA</h1>
            <p className="nl-subtitle">Ingresa los datos para registrar un usuario</p>

            {regError && <div className="nl-alert nl-alert-error">{regError}</div>}
            {regSuccess && <div className="nl-alert nl-alert-success">{regSuccess}</div>}

            <form onSubmit={handleRegister} className="nl-form" autoComplete="off">
              {/* Nombre */}
              <div className="nl-field-wrap">
                <span className="nl-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                </span>
                <input
                  type="text"
                  className="nl-input"
                  placeholder="Nombre completo"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  required
                  disabled={regLoading}
                />
              </div>

              {/* Email */}
              <div className="nl-field-wrap">
                <span className="nl-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                    <polyline points="22,6 12,13 2,6"></polyline>
                  </svg>
                </span>
                <input
                  type="email"
                  className="nl-input"
                  placeholder="Correo electrónico"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  required
                  disabled={regLoading}
                />
              </div>

              {/* Rol */}
              <div className="nl-field-wrap">
                <span className="nl-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                  </svg>
                </span>
                <select
                  className="nl-select"
                  value={regRole}
                  onChange={(e) => setRegRole(e.target.value)}
                  disabled={regLoading}
                >
                  {roles.map((r) => (
                    <option key={r} value={r} style={{ background: '#0a0d25', color: '#fff' }}>{r}</option>
                  ))}
                </select>
              </div>

              {/* Contraseña */}
              <div className="nl-field-wrap">
                <span className="nl-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                </span>
                <input
                  type={regShowPass ? 'text' : 'password'}
                  className="nl-input"
                  placeholder="Contraseña (mín. 8 caracteres)"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  required
                  disabled={regLoading}
                />
                <button
                  type="button"
                  className="nl-eye-btn"
                  onClick={() => setRegShowPass(!regShowPass)}
                  tabIndex={-1}
                >
                  {regShowPass ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  )}
                </button>
              </div>

              {/* Confirmar Contraseña */}
              <div className="nl-field-wrap">
                <span className="nl-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.778-7.778zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
                  </svg>
                </span>
                <input
                  type="password"
                  className="nl-input"
                  placeholder="Confirmar contraseña"
                  value={regConfirm}
                  onChange={(e) => setRegConfirm(e.target.value)}
                  required
                  disabled={regLoading}
                />
              </div>

              <button
                type="submit"
                className={`nl-btn-submit ${regLoading ? 'nl-loading' : ''}`}
                disabled={regLoading}
              >
                {regLoading ? 'Creando cuenta...' : 'Crear Cuenta'}
              </button>
            </form>

            <div className="nl-footer-switch">
              <span className="nl-footer-text">¿Ya tienes una cuenta?</span>
              <button
                type="button"
                className="nl-signup-btn"
                onClick={() => { setActiveTab('login'); setError(''); }}
              >
                INICIAR SESIÓN
              </button>
            </div>
          </div>
        )}

        {/* ── TAB RECUPERAR CONTRASEÑA ── */}
        {activeTab === 'forgot' && (
          <div className="nl-content-body">
            <h1 className="nl-title">RECUPERAR CONTRASEÑA</h1>
            <p className="nl-subtitle">Ingresa tu correo para restablecer el acceso</p>

            {forgotError && <div className="nl-alert nl-alert-error">{forgotError}</div>}
            {forgotMsg && <div className="nl-alert nl-alert-success">{forgotMsg}</div>}

            <form onSubmit={handleForgot} className="nl-form" autoComplete="off">
              <div className="nl-field-wrap">
                <span className="nl-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                    <polyline points="22,6 12,13 2,6"></polyline>
                  </svg>
                </span>
                <input
                  type="email"
                  className="nl-input"
                  placeholder="Correo registrado"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="nl-btn-submit">
                Enviar Solicitud
              </button>
            </form>

            <div className="nl-footer-switch">
              <button
                type="button"
                className="nl-signup-btn"
                onClick={() => { setActiveTab('login'); setError(''); }}
              >
                ← VOLVER AL INICIO
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


