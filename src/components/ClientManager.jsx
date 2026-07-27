import { useState } from 'react';
import { validateDocument, createClient, findClientByDocument } from '../utils/clients';
import './ClientManager.css';

/**
 * Componente para gestionar clientes
 * Registro, búsqueda y actualización de datos de clientes
 */

export default function ClientManager({ clients, onClientSelect, onClientAdd }) {
  const [activeTab, setActiveTab] = useState('search');
  const [searchDocument, setSearchDocument] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [newClient, setNewClient] = useState({
    document: '',
    name: '',
    email: '',
    phone: '',
    address: '',
    businessName: '',
  });
  const [errors, setErrors] = useState([]);
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    setErrors([]);
    setSuccess('');
    setLoading(true);

    try {
      const validation = validateDocument(searchDocument);

      if (!validation.valid) {
        setErrors([validation.message]);
        setSearchResult(null);
        return;
      }

      // Simular búsqueda en base de datos
      await new Promise(resolve => setTimeout(resolve, 300));

      const found = findClientByDocument(clients, validation.formatted);

      if (found) {
        setSearchResult(found);
        setSuccess(`Cliente encontrado: ${found.name}`);
        onClientSelect(found);
      } else {
        setSearchResult(null);
        setErrors(['Cliente no encontrado. ¿Desea registrar uno nuevo?']);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterClient = async () => {
    setErrors([]);
    setSuccess('');
    setLoading(true);

    try {
      const result = createClient(newClient);

      if (!result.success) {
        setErrors([result.error]);
        return;
      }

      // Simular guardado en base de datos
      await new Promise(resolve => setTimeout(resolve, 500));

      const client = result.client;
      setSuccess(`Cliente registrado: ${client.name}`);
      onClientAdd(client);

      // Limpiar formulario
      setNewClient({
        document: '',
        name: '',
        email: '',
        phone: '',
        address: '',
        businessName: '',
      });

      // Cambiar a tab de búsqueda
      setTimeout(() => {
        setActiveTab('search');
        setSearchDocument(client.document);
      }, 500);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setNewClient(prev => ({
      ...prev,
      [field]: value
    }));
    setErrors([]);
  };

  return (
    <div className="client-manager">
      <div className="client-manager-header">
        <h3> Gestión de Clientes</h3>
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'search' ? 'active' : ''}`}
            onClick={() => setActiveTab('search')}
          >
            Buscar
          </button>
          <button
            className={`tab ${activeTab === 'register' ? 'active' : ''}`}
            onClick={() => setActiveTab('register')}
          >
            Registrar
          </button>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="client-alert error">
          {errors.map((err, i) => <div key={i}>{err}</div>)}
        </div>
      )}

      {success && (
        <div className="client-alert success">
          {success}
        </div>
      )}

      {/* Tab de Búsqueda */}
      {activeTab === 'search' && (
        <div className="client-tab-content">
          <div className="client-form-group">
            <label>Buscar por DNI o RUC</label>
            <div className="search-input-group">
              <input
                type="text"
                value={searchDocument}
                onChange={(e) => {
                  setSearchDocument(e.target.value);
                  setSearchResult(null);
                }}
                placeholder="Ej: 12345678 o 20123456789"
                disabled={loading}
              />
              <button
                onClick={handleSearch}
                disabled={loading || !searchDocument.trim()}
                className="search-btn"
              >
                {loading ? '' : ''}
              </button>
            </div>
            <small className="help-text">DNI: 8 dígitos | RUC: 11 dígitos</small>
          </div>

          {searchResult && (
            <div className="client-details-card">
              <h4>Información del Cliente</h4>
              <div className="detail-row">
                <span>Nombre:</span>
                <strong>{searchResult.name}</strong>
              </div>
              <div className="detail-row">
                <span>Documento:</span>
                <strong>{searchResult.documentType}: {searchResult.document}</strong>
              </div>
              {searchResult.email && (
                <div className="detail-row">
                  <span>Email:</span>
                  <strong>{searchResult.email}</strong>
                </div>
              )}
              {searchResult.phone && (
                <div className="detail-row">
                  <span>Teléfono:</span>
                  <strong>{searchResult.phone}</strong>
                </div>
              )}
              {searchResult.businessName && (
                <div className="detail-row">
                  <span>Razón Social:</span>
                  <strong>{searchResult.businessName}</strong>
                </div>
              )}
              <div className="detail-row">
                <span>Compras:</span>
                <strong>{searchResult.totalPurchases}</strong>
              </div>
              <div className="detail-row">
                <span>Total Gastado:</span>
                <strong>S/ {searchResult.totalAmount.toFixed(2)}</strong>
              </div>
              {searchResult.lastPurchase && (
                <div className="detail-row">
                  <span>Última Compra:</span>
                  <strong>{new Date(searchResult.lastPurchase).toLocaleDateString('es-PE')}</strong>
                </div>
              )}
              <button className="btn primary" onClick={() => onClientSelect(searchResult)}>
                Seleccionar
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab de Registro */}
      {activeTab === 'register' && (
        <div className="client-tab-content">
          <div className="client-form-group">
            <label>Documento *</label>
            <input
              type="text"
              value={newClient.document}
              onChange={(e) => handleInputChange('document', e.target.value)}
              placeholder="DNI o RUC"
              disabled={loading}
            />
            <small className="help-text">DNI: 8 dígitos | RUC: 11 dígitos</small>
          </div>

          <div className="client-form-group">
            <label> Nombre Completo/Razón Social *</label>
            <input
              type="text"
              value={newClient.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="Ej: Juan Pérez"
              disabled={loading}
            />
          </div>

          <div className="form-row">
            <div className="client-form-group">
              <label>Email</label>
              <input
                type="email"
                value={newClient.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="tu@email.com"
                disabled={loading}
              />
            </div>

            <div className="client-form-group">
              <label> Teléfono</label>
              <input
                type="tel"
                value={newClient.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                placeholder="555-1234"
                disabled={loading}
              />
            </div>
          </div>

          <div className="client-form-group">
            <label> Dirección</label>
            <input
              type="text"
              value={newClient.address}
              onChange={(e) => handleInputChange('address', e.target.value)}
              placeholder="Calle, número, distrito"
              disabled={loading}
            />
          </div>

          <div className="client-form-group">
            <label> Razón Social (Para RUC)</label>
            <input
              type="text"
              value={newClient.businessName}
              onChange={(e) => handleInputChange('businessName', e.target.value)}
              placeholder="Ej: EMPRESA S.A.C."
              disabled={loading}
            />
          </div>

          <button
            className="btn primary register-btn"
            onClick={handleRegisterClient}
            disabled={loading || !newClient.document.trim() || !newClient.name.trim()}
          >
            {loading ? ' Registrando...' : ' Registrar Cliente'}
          </button>

          <p className="form-note">* Campo requerido</p>
        </div>
      )}
    </div>
  );
}
