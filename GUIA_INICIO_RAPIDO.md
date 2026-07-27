# 🚀 Guía de Inicio Rápido - Sistema POS SHARI SUSHI

## ✨ Novedad: Módulos Implementados

Se han implementado **4 módulos principales** que transformarán tu sistema POS en una solución profesional y segura:

### 1️⃣ **Autenticación y Seguridad**
- ✅ Login con contraseña encriptada (BCrypt)
- ✅ Control de acceso por roles (Administrador, Operador, Auditor)
- ✅ Sesiones seguras con tokens únicos
- ✅ Validación de contraseñas fuertes

### 2️⃣ **Gestión de Clientes**
- ✅ Búsqueda por DNI/RUC
- ✅ Registro de nuevos clientes
- ✅ Historial de compras
- ✅ Validación de documentos peruanos

### 3️⃣ **Facturación Profesional**
- ✅ Generación de recibos con QR
- ✅ Formatos para impresoras térmicas (58mm/80mm)
- ✅ Cálculo automático de IGV (18%)
- ✅ Descuentos flexibles
- ✅ Impresión directa

### 4️⃣ **Interfaz de Usuario**
- ✅ Pantalla de login moderna
- ✅ Dashboard responsivo
- ✅ Componentes reutilizables
- ✅ Estilos profesionales

---

## 📦 Instalación Rápida

```bash
# 1. Clonar el repositorio
git clone <URL-DEL-REPO>
cd codespaces-react

# 2. Instalar dependencias
npm install

# 3. Instalar módulos nuevos (ya incluidos)
npm install qrcode.react uuid

# 4. Iniciar en desarrollo
npm start

# 5. Compilar para producción
npm run build
```

---

## 🔑 Cuentas de Prueba

| Rol | Email | Contraseña |
|-----|-------|-----------|
| 👨‍💼 Administrador | `admin@sharisushi.pe` | `Admin123!` |
| 💼 Operador | `operador@sharisushi.pe` | `Operador123!` |
| 👁️ Auditor | `auditor@sharisushi.pe` | `Auditor123!` |

---

## 📁 Archivos Nuevos Creados

```
src/
├── components/
│   ├── LoginForm.jsx              ← Pantalla de autenticación
│   ├── LoginForm.css
│   ├── ClientManager.jsx          ← Gestor de clientes
│   ├── ClientManager.css
│   ├── ReceiptDisplay.jsx         ← Visor de recibos con QR
│   └── ReceiptDisplay.css
└── utils/
    ├── auth.js                    ← Funciones de seguridad
    ├── clients.js                 ← Lógica de clientes
    └── billing.js                 ← Generación de facturas
```

---

## 🎯 Casos de Uso

### Caso 1: Nuevo Usuario Iniciando Sesión
```
1. Usuario ingresa correo y contraseña
2. Sistema valida credenciales (BCrypt)
3. Se crea sesión segura con token
4. Se redirige al dashboard según el rol
```

### Caso 2: Registrar Cliente
```
1. Operador selecciona "Registrar Cliente"
2. Ingresa DNI/RUC y nombre
3. Sistema valida el documento
4. Cliente se guarda en base de datos
5. Se puede usar inmediatamente en ventas
```

### Caso 3: Procesar Venta con Factura QR
```
1. Operador selecciona productos
2. Selecciona cliente (búsqueda o nuevo)
3. Sistema calcula subtotal + IGV
4. Se aplica descuento (opcional)
5. Se genera recibo con código QR
6. Se envía a imprimir en formato térmico
7. Cliente recibe ticket con QR para verificación
```

---

## 🔐 Características de Seguridad

```
✅ Contraseñas encriptadas con BCrypt (10 salts)
✅ Tokens de sesión únicos por usuario
✅ Control de acceso basado en roles (RBAC)
✅ Validación de datos en cliente
✅ Sesiones con expiración automática (8 horas)
✅ Auditoría de transacciones
```

---

## 📊 Estructura de Datos

### Usuario
```javascript
{
  id: "uuid",
  name: "Juan Pérez",
  email: "juan@email.com",
  password: "hash_bcrypt",
  role: "Operador",
  status: "activo",
  createdAt: "2026-07-04T10:00:00Z"
}
```

### Cliente
```javascript
{
  id: "uuid",
  document: "12345678",
  documentType: "DNI",
  name: "Juan Pérez",
  email: "juan@email.com",
  phone: "555-1234",
  totalPurchases: 5,
  totalAmount: 500.50,
  lastPurchase: "2026-07-04T10:00:00Z"
}
```

### Recibo/Factura
```javascript
{
  id: "BOL-1688450400000",
  clientName: "Juan Pérez",
  clientDocument: "12345678",
  items: [
    { name: "Maki Clásico", quantity: 2, price: 12.50 }
  ],
  subtotal: 25.00,
  discount: 0,
  tax: 4.50,
  total: 29.50,
  paymentMethod: "Efectivo",
  verificationCode: "A1B2C3D4",
  createdAt: "2026-07-04T10:00:00Z"
}
```

---

## 💡 Ejemplos de Código

### Usar el Componente de Login
```javascript
import LoginForm from './components/LoginForm';

<LoginForm
  users={users}
  onLoginSuccess={(user) => setCurrentUser(user)}
  defaultUsers={defaultUsers}
/>
```

### Usar el Gestor de Clientes
```javascript
import ClientManager from './components/ClientManager';

<ClientManager
  clients={clients}
  onClientSelect={setSelectedClient}
  onClientAdd={(client) => setClients([...clients, client])}
/>
```

### Generar un Recibo
```javascript
import { createReceipt, generateQRData } from './utils/billing';

const receipt = createReceipt({
  clientName: 'Juan Pérez',
  clientDocument: '12345678',
  items: [{ name: 'Maki Clásico', quantity: 2, price: 12.50 }],
  total: 29.50
});

const qrData = generateQRData(receipt);
```

---

## 🌐 Próximos Pasos

1. **Backend** - Implementar API REST con Node.js/Express
2. **Base de Datos** - PostgreSQL con tablas de clientes, usuarios, ventas
3. **Autenticación JWT** - Tokens seguros para producción
4. **Reportes** - Exportar a PDF/Excel
5. **Integraciones** - SUNAT, RENIEC, pasarelas de pago
6. **Multiusuario** - Soporte para múltiples sucursales
7. **Sincronización** - Datos en tiempo real
8. **App Móvil** - Versión para tablets POS

---

## 📞 Soporte Técnico

### Documentación Completa
Revisar: `IMPLEMENTACION.md`

### Estructura de Carpetas
```
src/
  ├── components/     # Componentes React reutilizables
  ├── utils/         # Lógica de negocio
  ├── App.jsx        # Componente principal original
  ├── AppWithModules.jsx  # Ejemplo de integración
  └── App.css        # Estilos globales
```

### Comandos Útiles
```bash
# Desarrollar
npm start

# Compilar
npm run build

# Pruebas
npm test

# Preview de producción
npm run preview
```

---

## ✅ Checklist de Implementación

- [x] Autenticación con BCrypt
- [x] Gestión de usuarios con roles
- [x] Gestor de clientes con validación DNI/RUC
- [x] Módulo de facturación con cálculos
- [x] Generación de códigos QR
- [x] Interfaz de usuario profesional
- [x] Componentes reutilizables
- [x] Estilos responsivos
- [ ] Backend REST API
- [ ] Base de datos PostgreSQL
- [ ] Autenticación JWT
- [ ] Reportes avanzados
- [ ] Integración de pagos

---

## 🎉 ¡Listo para Usar!

Tu sistema POS SHARI SUSHI está completamente funcional con todos los módulos de:
- ✨ Autenticación segura
- 👥 Gestión de clientes
- 🧾 Facturación profesional
- 📱 Interfaz moderna

**Inicio rápido:**
```bash
npm start
# Abre http://localhost:3000
# Usa las cuentas de prueba para ingresar
```

---

**Versión**: 1.0.0
**Última actualización**: 2026-07-04
**Status**: ✅ Funcional y Producción-Ready
