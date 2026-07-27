import { useState, useEffect } from 'react';
import LoginForm from './components/LoginForm';
import ClientManager from './components/ClientManager';
import ReceiptDisplay from './components/ReceiptDisplay';
import { createUser, hashPassword, validatePassword, rolePermissions } from './utils/auth';
import { createClient, findClientByDocument } from './utils/clients';
import { createReceipt, generateReceiptText, calculateTotal } from './utils/billing';
import './App.css';

/**
 * EJEMPLO DE INTEGRACIÓN
 * Este archivo muestra cómo integrar todos los módulos nuevos en tu App.jsx
 */

function AppWithModules() {
  // Estado de autenticación
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  
  // Estado de clientes
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  
  // Estado de ventas
  const [receipts, setReceipts] = useState([]);
  const [viewingReceipt, setViewingReceipt] = useState(null);

  // Inicializar usuarios por defecto
  useEffect(() => {
    const defaultUsers = [
      {
        id: '1',
        name: 'Administrador Shari',
        email: 'admin@sharisushi.pe',
        password: hashPassword('Admin123!'),
        role: 'Administrador',
        status: 'activo',
        demoPassword: 'Admin123!',
      },
      {
        id: '2',
        name: 'Operador Shari',
        email: 'operador@sharisushi.pe',
        password: hashPassword('Operador123!'),
        role: 'Operador',
        status: 'activo',
        demoPassword: 'Operador123!',
      },
      {
        id: '3',
        name: 'Auditor Shari',
        email: 'auditor@sharisushi.pe',
        password: hashPassword('Auditor123!'),
        role: 'Auditor',
        status: 'activo',
        demoPassword: 'Auditor123!',
      },
    ];
    setUsers(defaultUsers);

    // Cargar datos del localStorage
    const savedClients = localStorage.getItem('shari-clients');
    const savedReceipts = localStorage.getItem('shari-receipts');
    
    if (savedClients) setClients(JSON.parse(savedClients));
    if (savedReceipts) setReceipts(JSON.parse(savedReceipts));
  }, []);

  // Guardar clientes en localStorage
  useEffect(() => {
    localStorage.setItem('shari-clients', JSON.stringify(clients));
  }, [clients]);

  // Guardar recibos en localStorage
  useEffect(() => {
    localStorage.setItem('shari-receipts', JSON.stringify(receipts));
  }, [receipts]);

  // Manejo de login
  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
  };

  // Manejo de logout
  const handleLogout = () => {
    setCurrentUser(null);
    setSelectedClient(null);
  };

  // Agregar cliente
  const handleAddClient = (client) => {
    setClients([...clients, client]);
    setSelectedClient(client);
  };

  // Crear y guardar recibo
  const handleCreateReceipt = (receiptData) => {
    const receipt = createReceipt(receiptData);
    setReceipts([...receipts, receipt]);
    setViewingReceipt(receipt);
    return receipt;
  };

  // Si no hay usuario logueado, mostrar login
  if (!currentUser) {
    return (
      <LoginForm
        users={users}
        onLoginSuccess={handleLoginSuccess}
        defaultUsers={users.filter(u => u.demoPassword)}
      />
    );
  }

  // Verificar permisos
  const canAccess = (permission) => {
    return rolePermissions[currentUser.role]?.includes(permission) || false;
  };

  // Interface principal
  return (
    <div className="app-with-modules">
      <header className="app-header-main">
        <div className="app-title">
          <h1>SHARI SUSHI - Sistema POS</h1>
        </div>
        
        <div className="app-user-info">
          <div className="user-details">
            <p className="user-name">{currentUser.name}</p>
            <p className="user-role">{currentUser.role}</p>
          </div>
          <button className="btn-logout" onClick={handleLogout}>
            Salir
          </button>
        </div>
      </header>

      <div className="app-main-content">
        {/* SIDEBAR */}
        <aside className="app-sidebar">
          <nav className="app-nav">
            <h3>Menú</h3>
            
            {canAccess('ver_pos') && (
              <button className="nav-item">
                Punto de Venta
              </button>
            )}
            
            {canAccess('ver_caja') && (
              <button className="nav-item">
                Caja
              </button>
            )}
            
            {canAccess('ver_reportes') && (
              <button className="nav-item">
                Reportes
              </button>
            )}
            
            {canAccess('ver_historial') && (
              <button className="nav-item">
                Historial
              </button>
            )}
            
            {canAccess('gestionar_usuarios') && (
              <button className="nav-item">
                Usuarios
              </button>
            )}
          </nav>

          <div className="session-info">
            <p><strong>Sesión:</strong></p>
            <p className="session-id">{currentUser.sessionId?.slice(0, 12)}...</p>
            <p className="session-time">
              {new Date(currentUser.loginTime).toLocaleTimeString('es-PE')}
            </p>
          </div>
        </aside>

        {/* CONTENIDO PRINCIPAL */}
        <main className="app-content">
          <div className="content-section">
            <h2>Gestión de Sistema POS</h2>
            
            {/* Gestor de Clientes */}
            {canAccess('procesar_ventas') && (
              <section className="module-section">
                <ClientManager
                  clients={clients}
                  onClientSelect={setSelectedClient}
                  onClientAdd={handleAddClient}
                />
                
                {selectedClient && (
                  <div className="client-selected-badge">
                    ✓ Cliente seleccionado: <strong>{selectedClient.name}</strong>
                  </div>
                )}
              </section>
            )}

            {/* Información del Usuario */}
            <section className="module-section">
              <h3>Información de Usuario</h3>
              <div className="info-card">
                <div className="info-row">
                  <span>Email:</span>
                  <strong>{currentUser.email}</strong>
                </div>
                <div className="info-row">
                  <span>Rol:</span>
                  <strong>{currentUser.role}</strong>
                </div>
                <div className="info-row">
                  <span>ID de Sesión:</span>
                  <strong className="mono">{currentUser.sessionId}</strong>
                </div>
                <div className="info-row">
                  <span>Permisos:</span>
                  <div className="permissions-list">
                    {rolePermissions[currentUser.role]?.map((perm) => (
                      <span key={perm} className="permission-badge">
                        {perm}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* Recibos Guardados */}
            {receipts.length > 0 && (
              <section className="module-section">
                <h3>📋 Recibos ({receipts.length})</h3>
                <div className="receipts-list">
                  {receipts.slice(0, 5).map((receipt) => (
                    <div key={receipt.id} className="receipt-item">
                      <div className="receipt-item-info">
                        <strong>{receipt.id}</strong>
                        <span className="receipt-amount">
                          S/ {receipt.total.toFixed(2)}
                        </span>
                      </div>
                      <button
                        className="btn-view-receipt"
                        onClick={() => setViewingReceipt(receipt)}
                      >
                        👁️ Ver
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </main>
      </div>

      {/* Modal de Recibo */}
      {viewingReceipt && (
        <ReceiptDisplay
          receipt={viewingReceipt}
          onClose={() => setViewingReceipt(null)}
        />
      )}
    </div>
  );
}

export default AppWithModules;
