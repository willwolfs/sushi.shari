import { useEffect, useMemo, useState, useRef } from 'react';
import bcrypt from 'bcryptjs';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Tooltip, Legend, Title, Filler } from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import LoginForm from './components/LoginForm';
import ClientManager from './components/ClientManager';
import ReceiptDisplay from './components/ReceiptDisplay';
import { validatePassword, hasPermission, rolePermissions, validateSession, createSession, DEFAULT_INACTIVITY_TIMEOUT } from './utils/auth';
import { createClient, findClientByDocument, recordClientPurchase, validateDocument, getDocumentType } from './utils/clients';
import { createReceipt, generateKitchenTicketHTML, generateReceiptHTML, sendToPrinter } from './utils/billing';
import { HealthService, UserService, ClientService, CategoryService, ProductService, InventoryService, SalesService, CashService } from './utils/supabase';
import './App.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Tooltip, Legend, Title, Filler);

const mockProducts = [
  {
    id: 1,
    name: 'Maki Clásico',
    category: 'Makis',
    price: 12.5,
    stock: 25,
    code: 'MK001',
    image: 'https://images.unsplash.com/photo-1553621042-f6e147245754?auto=format&fit=crop&w=500&q=80',
  },
  {
    id: 2,
    name: 'Maki Premium',
    category: 'Makis',
    price: 18.9,
    stock: 15,
    code: 'MK002',
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=500&q=80',
  },
  {
    id: 3,
    name: 'Ebi Roll',
    category: 'Makis',
    price: 15.0,
    stock: 0,
    code: 'MK003',
    image: 'https://images.unsplash.com/photo-1466637574441-749b8f19452f?auto=format&fit=crop&w=500&q=80',
  },
  {
    id: 4,
    name: 'California Roll',
    category: 'Makis',
    price: 14.5,
    stock: 12,
    code: 'MK004',
    image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=500&q=80',
  },
  {
    id: 5,
    name: 'Salmón Fresco',
    category: 'Makis',
    price: 16.0,
    stock: 18,
    code: 'MK005',
    image: 'https://images.unsplash.com/photo-1498654896293-37aacf113fd9?auto=format&fit=crop&w=500&q=80',
  },
  {
    id: 6,
    name: 'Agua Mineral',
    category: 'Bebidas',
    price: 3.5,
    stock: 50,
    code: 'BEB001',
    image: 'https://images.unsplash.com/photo-1505577058444-a3dabf4c3744?auto=format&fit=crop&w=500&q=80',
  },
  {
    id: 7,
    name: 'Limonada',
    category: 'Bebidas',
    price: 7.5,
    stock: 30,
    code: 'BEB002',
    image: 'https://images.unsplash.com/photo-1497534446932-c925b458314e?auto=format&fit=crop&w=500&q=80',
  },
  {
    id: 8,
    name: 'Té Frío',
    category: 'Bebidas',
    price: 5.0,
    stock: 25,
    code: 'BEB003',
    image: 'https://images.unsplash.com/photo-1547592180-0ad2b0c87ac4?auto=format&fit=crop&w=500&q=80',
  },
  {
    id: 9,
    name: 'Gyozas',
    category: 'Entradas',
    price: 10.0,
    stock: 20,
    code: 'ENT001',
    image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=500&q=80',
  },
  {
    id: 10,
    name: 'Edamame',
    category: 'Entradas',
    price: 8.5,
    stock: 15,
    code: 'ENT002',
    image: 'https://images.unsplash.com/photo-1553621042-f6e147245754?auto=format&fit=crop&w=500&q=80',
  },
  {
    id: 11,
    name: 'Tempura',
    category: 'Entradas',
    price: 12.0,
    stock: 10,
    code: 'ENT003',
    image: 'https://images.unsplash.com/photo-1562967916-eb82221dfb37?auto=format&fit=crop&w=500&q=80',
  },
  {
    id: 12,
    name: 'Wasabi Extra',
    category: 'Entradas',
    price: 2.5,
    stock: 40,
    code: 'ENT004',
    image: 'https://images.unsplash.com/photo-1528715471579-df0d3f0b72c3?auto=format&fit=crop&w=500&q=80',
  },
];

const categories = ['Todos', 'Makis', 'Bebidas', 'Entradas'];
const paymentMethods = [
  { id: 'cash', label: 'Efectivo', icon: '' },
  { id: 'debit', label: 'Tarjeta Débito', icon: '' },
  { id: 'credit', label: 'Tarjeta Crédito', icon: '' },
  { id: 'yape', label: 'Yape', icon: '' },
  { id: 'plin', label: 'Plin', icon: '' },
];

const fallbackImage = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=500&q=80';
const roleTabs = {
  Administrador: ['Dashboard', 'Caja', 'POS Venta', 'Historial', 'Clientes', 'Productos', 'Inventario', 'Usuarios'],
  Cajero: ['Dashboard', 'Caja', 'POS Venta', 'Historial', 'Clientes'],
  Cocina: ['POS Venta', 'Historial'],
};

const defaultUsers = [
  {
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    name: 'Administrador Shari',
    email: 'admin@sharisushi.pe',
    role: 'Administrador',
    password: bcrypt.hashSync('Admin123!', 10),
    demoPassword: 'Admin123!',
    status: 'activo',
    isDefaultAdmin: true,
  },
];

function useWindowWidth() {
  const [width, setWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return width;
}

function App() {
  const windowWidth = useWindowWidth();
  const isMobile = windowWidth <= 768;
  const isTablet = windowWidth > 768 && windowWidth <= 1024;
  const isDesktop = windowWidth > 1024;
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [products, setProducts] = useState([]);
  const [categoriesList, setCategoriesList] = useState(['Todos']);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [cart, setCart] = useState([]);
  const [cashInput, setCashInput] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState('percentage');
  const [notes, setNotes] = useState('');
  const [tableNumber, setTableNumber] = useState('1');
  const [consumptionMode, setConsumptionMode] = useState('Mesa');
  const [docType, setDocType] = useState('Boleta');
  const [isCashOpen, setIsCashOpen] = useState(false);
  const [initialCash, setInitialCash] = useState(0);
  const [clientDNI, setClientDNI] = useState('');
  const [clientName, setClientName] = useState('');
  const [showClientModal, setShowClientModal] = useState(false);
  const [showMovementsModal, setShowMovementsModal] = useState(false);
  const [showCloseCashModal, setShowCloseCashModal] = useState(false);
  const [showOpenCashModal, setShowOpenCashModal] = useState(false);
  const [openCashAmountInput, setOpenCashAmountInput] = useState('500');
  const [closeCashRealAmount, setCloseCashRealAmount] = useState('');
  const [cashMovFilter, setCashMovFilter] = useState('Todos');
  const [movSortOrder, setMovSortOrder] = useState('desc');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [cashRegister, setCashRegister] = useState(0);
  const [salesHistory, setSalesHistory] = useState([]);
  const [historySubTab, setHistorySubTab] = useState('ventas');
  const [historySearch, setHistorySearch] = useState('');
  const [historyMethodFilter, setHistoryMethodFilter] = useState('Todos');
  const [cashClosureHistory, setCashClosureHistory] = useState([]);
  const [cashMovements, setCashMovements] = useState([]);
  const [selectedSale, setSelectedSale] = useState(null);
  const [selectedCashSale, setSelectedCashSale] = useState(null);
  const [selectedProdCategory, setSelectedProdCategory] = useState('Todos');
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [newProductImageFile, setNewProductImageFile] = useState('');
  const [newUserAvatarFile, setNewUserAvatarFile] = useState('');
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [inventoryFilterTab, setInventoryFilterTab] = useState('Todos');
  const [inventorySearch, setInventorySearch] = useState('');
  const [showAddInventoryModal, setShowAddInventoryModal] = useState(false);
  const [editingInventoryItem, setEditingInventoryItem] = useState(null);
  const [editingSale, setEditingSale] = useState(null);
  const [editingClosure, setEditingClosure] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editingClient, setEditingClient] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [dbStatus, setDbStatus] = useState('connecting'); // 'connecting' | 'online' | 'offline'
  const [isSyncingDB, setIsSyncingDB] = useState(false);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [clients, setClients] = useState([]);
  const [viewingReceipt, setViewingReceipt] = useState(null);
  const [inactivityNotice, setInactivityNotice] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('shari-user');
    if (saved) {
      try {
        const user = JSON.parse(saved);
        const { valid } = validateSession(user);
        if (valid) {
          return user;
        }
      } catch (e) {
        console.error(e);
      }
    }
    return null;
  });
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  // 🗄️ EFECTO DE SINCRONIZACIÓN NATIVA CON BASE DE DATOS (SUPABASE)
  const syncDataFromDatabase = async (showNotification = false) => {
    setIsSyncingDB(true);
    try {
      const isConnected = await HealthService.checkConnection();
      if (!isConnected) {
        setDbStatus('offline');
        if (showNotification) alert('No se pudo conectar a la base de datos Supabase. Operando en modo local.');
        return;
      }

      setDbStatus('online');

      const [spUsers, spClients, spCategories, spProducts, spInventory, spSales, spMovements] = await Promise.all([
        UserService.getUsers(),
        ClientService.getClients(),
        CategoryService.getCategories(),
        ProductService.getProducts(),
        InventoryService.getInventory(),
        SalesService.getSales(),
        CashService.getCashMovements()
      ]);

      setUsers(spUsers || []);
      setClients(spClients || []);
      setCategoriesList(['Todos', ...(spCategories || []).filter(c => c !== 'Todos')]);
      setProducts(spProducts || []);
      setInventoryItems(spInventory || []);
      setSalesHistory(spSales || []);
      setCashMovements(spMovements || []);

      if (showNotification) alert('✓ Base de datos sincronizada con éxito.');
    } catch (err) {
      console.warn('Error durante sincronización con BD:', err);
      setDbStatus('offline');
    } finally {
      setIsSyncingDB(false);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('shari-user');
    setIsProfileMenuOpen(false);
    setIsMobileMenuOpen(false);
  };

  useEffect(() => {
    // Purgar claves locales obsoletas para operar 100% con la base de datos Supabase
    ['shari-products', 'shari-categories', 'shari-inventory', 'shari-sales', 'shari-clients', 'shari-movements', 'shari-closures', 'shari-users', 'shari-cash', 'shari-cash-open', 'shari-initial-cash'].forEach(k => localStorage.removeItem(k));

    syncDataFromDatabase(false);

    const handleOnline = () => syncDataFromDatabase(false);
    const handleOffline = () => setDbStatus('offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('shari-user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('shari-user');
    }
  }, [currentUser]);

  // ⏱️ EFECTO GLOBAL DE CONTROL DE INACTIVIDAD Y EXPIRACIÓN DE TOKEN DE SESIÓN
  useEffect(() => {
    if (!currentUser) return;

    const INACTIVITY_LIMIT = currentUser.inactivityTimeoutMs || DEFAULT_INACTIVITY_TIMEOUT;
    let lastUpdate = Date.now();

    // Listener de interacciones para renovar la marca de última actividad
    const updateActivity = () => {
      const now = Date.now();
      if (now - lastUpdate > 3000) { // Throttling de 3 segundos
        lastUpdate = now;
        setCurrentUser((prev) => {
          if (!prev) return null;
          const updated = { ...prev, lastActivity: now };
          localStorage.setItem('shari-user', JSON.stringify(updated));
          return updated;
        });
      }
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach((evt) => window.addEventListener(evt, updateActivity, { passive: true }));

    // Verificación periódica cada 4 segundos
    const checkInterval = setInterval(() => {
      const savedStr = localStorage.getItem('shari-user');
      if (!savedStr) return;
      try {
        const session = JSON.parse(savedStr);
        const { valid, reason } = validateSession(session);

        if (!valid) {
          if (reason === 'inactivity') {
            console.warn('⏱️ Sesión cerrada por inactividad.');
            setInactivityNotice(true);
          } else {
            console.warn('⏱️ Token de sesión expirado.');
          }
          setCurrentUser(null);
          localStorage.removeItem('shari-user');
        }
      } catch (err) {
        console.error('Error al validar token de inactividad:', err);
      }
    }, 4000);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, updateActivity));
      clearInterval(checkInterval);
    };
  }, [currentUser]);

  useEffect(() => {
    try {
      localStorage.setItem('shari-users', JSON.stringify(users));
    } catch (err) {
      // Si la imagen base64 excede el límite de localStorage, guardamos sin avatares pesados
      console.warn('localStorage lleno, guardando usuarios sin avatares pesados:', err.message);
      try {
        const usersLight = users.map(u => ({
          ...u,
          avatar: u.avatar?.startsWith('data:') ? '' : u.avatar
        }));
        localStorage.setItem('shari-users', JSON.stringify(usersLight));
      } catch (e2) {
        console.error('No se pudo guardar usuarios:', e2);
      }
    }
  }, [users]);

  useEffect(() => {
    localStorage.setItem('shari-clients', JSON.stringify(clients));
  }, [clients]);

  useEffect(() => {
    localStorage.setItem('shari-cash', cashRegister.toString());
  }, [cashRegister]);

  useEffect(() => {
    localStorage.setItem('shari-sales', JSON.stringify(salesHistory));
  }, [salesHistory]);

  useEffect(() => {
    localStorage.setItem('shari-movements', JSON.stringify(cashMovements));
  }, [cashMovements]);

  useEffect(() => {
    localStorage.setItem('shari-closures', JSON.stringify(cashClosureHistory));
  }, [cashClosureHistory]);

  useEffect(() => {
    localStorage.setItem('shari-inventory', JSON.stringify(inventoryItems));
  }, [inventoryItems]);

  useEffect(() => {
    localStorage.setItem('shari-products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('shari-categories', JSON.stringify(categoriesList));
  }, [categoriesList]);

  // 📊 ESTADOS Y CÁLCULOS DINÁMICOS DEL DASHBOARD
  const [dashboardPeriod, setDashboardPeriod] = useState('month'); // 'today' | 'week' | 'month' | 'year' | 'all'
  const [dashboardResourceTab, setDashboardResourceTab] = useState('ventas'); // 'ventas' | 'platillos'

  const dashboardFilteredSales = useMemo(() => {
    const now = new Date();
    return salesHistory.filter((s) => {
      if (!s.timestamp && !s.date && !s.createdAt) return true;
      const saleDate = new Date(s.timestamp || s.date || s.createdAt);
      if (isNaN(saleDate.getTime())) return true;

      if (dashboardPeriod === 'today') {
        return saleDate.toDateString() === now.toDateString();
      }
      if (dashboardPeriod === 'week') {
        const diffMs = now.getTime() - saleDate.getTime();
        return diffMs >= 0 && diffMs <= 7 * 24 * 60 * 60 * 1000;
      }
      if (dashboardPeriod === 'month') {
        return saleDate.getMonth() === now.getMonth() && saleDate.getFullYear() === now.getFullYear();
      }
      if (dashboardPeriod === 'year') {
        return saleDate.getFullYear() === now.getFullYear();
      }
      return true;
    });
  }, [salesHistory, dashboardPeriod]);

  const dashboardTotalSalesAmount = useMemo(() => {
    return dashboardFilteredSales.reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);
  }, [dashboardFilteredSales]);

  const lowStockItemsCount = useMemo(() => {
    return inventoryItems.filter(i => (i.stock !== undefined ? i.stock : (i.current_stock || 0)) <= (i.minStock || i.min_stock || 5)).length;
  }, [inventoryItems]);

  const pendingDeliveryCount = useMemo(() => {
    return salesHistory.filter(s => (s.orderType === 'delivery' || s.order_type === 'delivery') && s.status !== 'completada').length;
  }, [salesHistory]);

  const activeTablesCount = useMemo(() => {
    return salesHistory.filter(s => (s.orderType === 'mesa' || s.order_type === 'mesa') && s.status !== 'completada').length;
  }, [salesHistory]);

  const dashboardScore = useMemo(() => {
    let score = 50;
    if (products.length > 0) score += 15;
    if (salesHistory.length > 0) score += 15;
    if (isCashOpen) score += 10;
    if (lowStockItemsCount === 0) score += 10;
    return Math.min(100, score);
  }, [products, salesHistory, isCashOpen, lowStockItemsCount]);

  const dashboardChartBars = useMemo(() => {
    const now = new Date();
    const bars = [];
    for (let i = 7; i >= 0; i--) {
      const d = new Date();
      if (dashboardPeriod === 'today') {
        d.setHours(now.getHours() - (i * 2));
        const hourLabel = `${d.getHours()}:00`;
        const salesInHour = salesHistory.filter(s => new Date(s.timestamp || s.date || s.createdAt).getHours() === d.getHours());
        const val = salesInHour.reduce((acc, curr) => acc + (dashboardResourceTab === 'ventas' ? (curr.total || 0) : (curr.items?.length || 1)), 0);
        bars.push({ label: hourLabel, val });
      } else if (dashboardPeriod === 'week' || dashboardPeriod === 'month') {
        d.setDate(now.getDate() - i);
        const dayLabel = d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });
        const salesOnDay = salesHistory.filter(s => new Date(s.timestamp || s.date || s.createdAt).toDateString() === d.toDateString());
        const val = salesOnDay.reduce((acc, curr) => acc + (dashboardResourceTab === 'ventas' ? (curr.total || 0) : (curr.items?.length || 1)), 0);
        bars.push({ label: dayLabel, val });
      } else {
        d.setMonth(now.getMonth() - i);
        const monthLabel = d.toLocaleDateString('es-PE', { month: 'short' });
        const salesOnMonth = salesHistory.filter(s => {
          const sd = new Date(s.timestamp || s.date || s.createdAt);
          return sd.getMonth() === d.getMonth() && sd.getFullYear() === d.getFullYear();
        });
        const val = salesOnMonth.reduce((acc, curr) => acc + (dashboardResourceTab === 'ventas' ? (curr.total || 0) : (curr.items?.length || 1)), 0);
        bars.push({ label: monthLabel, val });
      }
    }
    const maxVal = Math.max(...bars.map(b => b.val), 1);
    return bars.map(b => ({
      ...b,
      heightPx: Math.max(12, Math.round((b.val / maxVal) * 110))
    }));
  }, [salesHistory, dashboardPeriod, dashboardResourceTab]);

  // 🔍 ESTADOS Y LÓGICA DE ATAJOS RÁPIDOS Y BUSCADOR GLOBAL (⌘ F / Ctrl+F / Ctrl+K)
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const globalSearchRef = useRef(null);

  // Escuchador global de atajos de teclado
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === 'f' || e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        setIsSearchOpen(true);
        setTimeout(() => globalSearchRef.current?.focus(), 50);
      }
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
        setIsNotificationsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 🔔 ALERTAS REALES DE STOCK (AGOTADOS Y POR TERMINAR)
  const stockNotifications = useMemo(() => {
    const alerts = [];

    // Platillos del menú
    products.forEach((p) => {
      if (p.stock <= 0) {
        alerts.push({
          id: `prod-out-${p.id}`,
          title: p.name,
          message: 'PLATILLO AGOTADO (0 unidades en stock)',
          type: 'danger',
          targetTab: 'POS Venta',
          badgeText: 'AGOTADO'
        });
      } else if (p.stock <= 5) {
        alerts.push({
          id: `prod-low-${p.id}`,
          title: p.name,
          message: `Por terminar (${p.stock} un. disponibles)`,
          type: 'warning',
          targetTab: 'POS Venta',
          badgeText: 'STOCK BAJO'
        });
      }
    });

    // Insumos de materia prima
    inventoryItems.forEach((inv) => {
      const current = inv.stock ?? inv.current_stock ?? 0;
      const min = inv.minStock ?? inv.min_stock ?? 5;
      if (current <= min) {
        alerts.push({
          id: `inv-low-${inv.id}`,
          title: inv.name,
          message: current <= 0 ? `Insumo AGOTADO (0 ${inv.unit || ''})` : `Insumo por terminar (${current} ${inv.unit || ''} - Mín: ${min})`,
          type: current <= 0 ? 'danger' : 'warning',
          targetTab: 'Inventario',
          badgeText: current <= 0 ? 'INSUMO AGOTADO' : 'INSUMO BAJO'
        });
      }
    });

    return alerts;
  }, [products, inventoryItems]);

  // ⚡ RESULTADOS DE LA PALETA DE COMANDOS Y ATAJOS RÁPIDOS
  const commandPaletteResults = useMemo(() => {
    const q = globalSearchQuery.toLowerCase().trim();

    const navigationCommands = [
      { name: 'POS Venta', description: 'Abrir punto de venta y armar pedidos', tab: 'POS Venta', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg> },
      { name: 'Dashboard', description: 'Ver panel principal e indicadores de negocio', tab: 'Dashboard', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg> },
      { name: 'Caja Registradora', description: 'Apertura, cierre y movimientos de efectivo', tab: 'Caja', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 12h.01M18 12h.01"/></svg> },
      { name: 'Historial de Ventas', description: 'Consultar boletas, facturas y reemitir', tab: 'Historial', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> },
      { name: 'Gestión de Clientes', description: 'Buscar o registrar clientes DNI / RUC', tab: 'Clientes', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg> },
      { name: 'Gestión de Inventario', description: 'Control de insumos y materia prima', tab: 'Inventario', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg> },
      { name: 'Usuarios del Sistema', description: 'Administrar credenciales y roles', tab: 'Usuarios', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
    ];

    const matchedNav = navigationCommands.filter(c => !q || c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q));
    const matchedProducts = products.filter(p => q && (p.name.toLowerCase().includes(q) || (p.code && p.code.toLowerCase().includes(q))));
    const matchedClients = clients.filter(c => q && (c.name.toLowerCase().includes(q) || (c.documentNumber && c.documentNumber.includes(q)) || (c.document_number && c.document_number.includes(q))));

    return {
      navigation: matchedNav,
      products: matchedProducts,
      clients: matchedClients,
    };
  }, [globalSearchQuery, products, clients]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesCategory = activeCategory === 'Todos' || product.category === activeCategory;
      const matchesSearch = product.name.toLowerCase().includes(search.toLowerCase()) ||
        product.code.toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, search]);

  const addToCart = (product) => {
    if (product.stock <= 0) return;
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id);
      if (existing) {
        if (existing.quantity < product.stock) {
          return current.map((item) =>
            item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
          );
        }
        return current;
      }
      return [...current, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId, newQuantity) => {
    const qty = parseInt(newQuantity) || 1;
    if (qty <= 0) {
      removeFromCart(productId);
      return;
    }
    const product = products.find((p) => p.id === productId);
    if (!product) {
      console.error('Product not found:', productId);
      return;
    }
    if (qty > product.stock) {
      alert(`Stock disponible: ${product.stock}`);
      return;
    }
    if (qty > 999) {
      alert('Cantidad máxima: 999');
      return;
    }
    setCart((current) =>
      current.map((item) =>
        item.id === productId ? { ...item, quantity: qty } : item
      )
    );
  };

  const removeFromCart = (productId) => {
    setCart((current) => current.filter((item) => item.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setCashInput('');
    setDiscount(0);
    setNotes('');
    setDiscountType('percentage');
  };

  const subtotal = Math.max(0, cart.reduce((total, item) => total + item.quantity * item.price, 0));

  let validDiscount = parseFloat(discount) || 0;
  validDiscount = Math.max(0, validDiscount);

  const discountValue = discountType === 'percentage'
    ? Math.min((subtotal * validDiscount) / 100, subtotal)
    : Math.min(validDiscount, subtotal);

  // Precios de carta incluyen IGV: El Total coincide con la suma de precios de los productos seleccionados
  const total = Math.max(0, Number((subtotal - discountValue).toFixed(2)));
  const netAmount = Number((total / 1.18).toFixed(2));
  const tax = Number((total - netAmount).toFixed(2));
  const cashValue = Math.max(0, parseFloat(cashInput) || 0);
  const change = Math.max(0, cashValue - total);

  const handleImageError = (event) => {
    event.target.onerror = null;
    event.target.src = fallbackImage;
  };



  const processPayment = () => {
    if (cart.length === 0) {
      alert('El carrito está vacío');
      return;
    }

    const finalClientName = clientName.trim() || 'Clientes Varios';
    const finalClientDNI = clientDNI.trim() || '00000000';
    const docValidation = validateDocument(finalClientDNI);

    if (!isCashOpen) {
      alert('Debe abrir la caja primero');
      return;
    }

    if (paymentMethod === 'cash' && cashValue < total) {
      alert(`Dinero insuficiente\nFalta: S/ ${(total - cashValue).toFixed(2)}`);
      return;
    }

    if (isNaN(total) || total < 0) {
      alert('Error en el cálculo del total');
      return;
    }

    const paymentLabel = paymentMethods.find((m) => m.id === paymentMethod)?.label || 'Desconocido';
    const docType = getDocumentType(finalClientDNI);
    const receiptType = docType === 'RUC' ? 'FACTURA' : 'BOLETA';

    const receiptData = {
      receiptType,
      clientName: finalClientName,
      clientDocument: docValidation.formatted || finalClientDNI,
      clientDocumentType: docType,
      items: [...cart],
      subtotal,
      discount,
      discountType,
      discountValue,
      netAmount,
      tax,
      total,
      paymentMethod: paymentLabel,
      paymentDetails: {
        cashReceived: paymentMethod === 'cash' ? cashValue : total,
        change: paymentMethod === 'cash' ? change : 0,
      },
      tableNumber,
      notes,
    };

    const newReceipt = createReceipt(receiptData);
    newReceipt.timestamp = newReceipt.createdAt;

    const movement = {
      id: `MOV-${Date.now()}`,
      type: 'venta',
      description: `Venta ${newReceipt.id} - ${paymentLabel}`,
      amount: total,
      paymentMethod: paymentLabel,
      date: new Date().toISOString(),
      saleId: newReceipt.id,
      items: cart.map(i => ({ name: i.name, quantity: i.quantity, price: i.price }))
    };

    if (paymentMethod === 'cash') {
      setCashRegister((prev) => prev + total);
      setCashMovements((prev) => [movement, ...prev]);
      CashService.createCashMovement(movement).catch(err => console.warn('BD movement error:', err));
    }

    // Decrementar stock de los productos comprados
    setProducts((prevProducts) => {
      return prevProducts.map((p) => {
        const cartItem = cart.find((item) => item.id === p.id);
        if (cartItem) {
          const newStock = Math.max(0, p.stock - cartItem.quantity);
          ProductService.updateProduct(p.id, { stock: newStock }).catch(e => console.warn('BD stock error:', e));
          return { ...p, stock: newStock };
        }
        return p;
      });
    });

    // Actualizar historial del cliente si existe en la lista de clientes registrados
    setClients((prevClients) => {
      return prevClients.map((c) => {
        if (c.document === newReceipt.clientDocument) {
          const updatedC = recordClientPurchase(c, newReceipt.total);
          ClientService.updateClient(c.document, { totalAmount: updatedC.totalAmount, totalPurchases: updatedC.totalPurchases }).catch(e => console.warn('BD client error:', e));
          return updatedC;
        }
        return c;
      });
    });

    setSalesHistory((prev) => [newReceipt, ...prev]);
    SalesService.createSale(newReceipt).catch(err => console.warn('BD sale error:', err));
    setViewingReceipt(newReceipt);

    // SECUENCIA DE IMPRESIÓN: 1. BOLETA -> 2. COMANDA COCINA
    try {
      // 1. Imprimir Boleta / Factura
      const receiptHTML = generateReceiptHTML(newReceipt);
      sendToPrinter(receiptHTML);

      // 2. Imprimir Comanda para Cocina (después de 600ms)
      setTimeout(() => {
        const kitchenHTML = generateKitchenTicketHTML(newReceipt);
        sendToPrinter(kitchenHTML);
      }, 600);
    } catch (e) {
      console.warn('Impresión automática:', e);
    }

    clearCart();
    setClientDNI('');
    setClientName('');
  };

  const printKitchenComandaOnly = () => {
    if (cart.length === 0) {
      alert('El carrito está vacío para imprimir comanda');
      return;
    }
    const orderData = {
      id: `ORD-${Date.now().toString().slice(-6)}`,
      tableNumber,
      consumptionMode,
      clientName: clientName || 'Cliente POS',
      items: [...cart],
      notes,
      createdAt: new Date().toISOString()
    };
    try {
      const kitchenHTML = generateKitchenTicketHTML(orderData);
      sendToPrinter(kitchenHTML);
      alert('Comanda enviada a la impresora de cocina.');
    } catch (e) {
      alert('Error al imprimir comanda: ' + e.message);
    }
  };

  const saveOrder = () => {
    if (cart.length === 0) {
      alert('El carrito está vacío');
      return;
    }
    const order = {
      id: `ORD-${Date.now()}`,
      table: tableNumber,
      clientDNI: clientDNI.replace(/\D/g, ''),
      clientName,
      items: [...cart],
      subtotal,
      discount,
      discountType,
      discountValue,
      netAmount,
      tax,
      total,
      paymentMethod: 'Orden Guardada',
      cashReceived: 0,
      change: 0,
      notes,
      timestamp: new Date().toISOString(),
      verified: false,
      saved: true,
    };
    setSalesHistory((prev) => [order, ...prev]);
    alert(`Orden guardada: ${order.id}`);
    clearCart();
  };

  const sendToKitchen = () => {
    if (cart.length === 0) {
      alert('El carrito está vacío');
      return;
    }
    const order = {
      id: `ORD-${Date.now()}`,
      table: tableNumber,
      clientDNI: clientDNI.replace(/\D/g, ''),
      clientName,
      items: [...cart],
      subtotal,
      discount,
      discountType,
      discountValue,
      netAmount,
      tax,
      total,
      paymentMethod: 'Enviado a Cocina',
      cashReceived: 0,
      change: 0,
      notes,
      timestamp: new Date().toISOString(),
      verified: false,
      kitchen: true,
    };
    setSalesHistory((prev) => [order, ...prev]);
    alert(`Orden enviada a cocina: ${order.id}`);
    clearCart();
  };

  const verifySale = (saleId) => {
    setSalesHistory((prev) =>
      prev.map((sale) => (sale.id === saleId ? { ...sale, verified: true } : sale))
    );
    alert(`Venta ${saleId} verificada correctamente`);
  };

  const openCashRegister = () => {
    if (isCashOpen) {
      alert('La caja ya está abierta');
      return;
    }
    const input = prompt('Ingrese monto inicial:', '500');
    if (input === null) return;
    const amt = parseFloat(input);
    if (isNaN(amt)) {
      alert('Ingrese un monto válido');
      return;
    }
    if (amt < 0) {
      alert('El monto debe ser mayor o igual a 0');
      return;
    }
    if (amt > 999999) {
      alert('Monto demasiado alto');
      return;
    }
    setInitialCash(amt);
    setCashRegister(amt);
    setIsCashOpen(true);
    setCashMovements([
      {
        id: `MOV-${Date.now()}`,
        type: 'apertura',
        description: 'Apertura de caja',
        amount: amt,
        paymentMethod: 'N/A',
        date: new Date().toISOString(),
      },
    ]);
    alert(`Caja abierta correctamente\nMonto inicial: S/ ${amt.toFixed(2)}`);
  };

  const closeCashRegister = () => {
    if (!isCashOpen) {
      alert('La caja ya está cerrada');
      return;
    }

    const countedReal = parseFloat(closeCashRealAmount) || dineroEsperadoCaja;
    const diff = Math.round((countedReal - dineroEsperadoCaja) * 100) / 100;
    const closureRecord = {
      id: `CC-${Date.now().toString().slice(-6)}`,
      date: new Date().toISOString(),
      cashier: currentUser ? currentUser.name : 'Cajero Principal',
      initialCash: initialCash,
      totalSales: salaVentaHoy,
      cashSales: cashSales,
      totalIngresos: totalIngresos,
      totalEgresos: totalEgresos,
      expectedCash: dineroEsperadoCaja,
      realCash: countedReal,
      difference: diff,
      status: Math.abs(diff) < 0.01 ? 'Cuadre Perfecto' : diff > 0.01 ? 'Sobrante' : 'Faltante'
    };

    setCashClosureHistory(prev => [closureRecord, ...prev]);
    setIsCashOpen(false);
    setInitialCash(0);
    setCashRegister(0);
    localStorage.setItem('shari-cash', '0');
    localStorage.setItem('shari-cash-open', 'false');
    alert('Caja cerrada con éxito. Registro de auditoría guardado en el historial de cierres.');
  };

  const handleAddMovement = (type, description, amount) => {
    if (!isCashOpen) {
      alert('Debe abrir la caja primero');
      return;
    }
    if (amount <= 0) {
      alert('El monto debe ser mayor a 0');
      return;
    }
    const movement = {
      id: `MOV-${Date.now()}`,
      type: type,
      description: description.trim(),
      amount: amount,
      paymentMethod: 'Efectivo',
      date: new Date().toISOString(),
    };
    
    setCashRegister(prev => prev + (type === 'ingreso' ? amount : -amount));
    setCashMovements(prev => [movement, ...prev]);
    alert(`Movimiento registrado: ${type === 'ingreso' ? 'Ingreso' : 'Egreso'} de S/ ${amount.toFixed(2)}`);
  };

  const todaySales = salesHistory.filter((s) => new Date(s.timestamp).toDateString() === new Date().toDateString());

  // Cálculos para las nuevas tarjetas de control
  const todayPaidSales = todaySales.filter(s => !s.saved && !s.kitchen);
  const salaVentaHoy = todayPaidSales.reduce((sum, s) => sum + s.total, 0);
  const totalPedidos = todaySales.length;

  const todayMovements = cashMovements.filter(
    (m) => new Date(m.date).toDateString() === new Date().toDateString()
  );
  const totalIngresos = todayMovements.filter((m) => m.type === 'ingreso').reduce((sum, m) => sum + m.amount, 0);
  const totalEgresos = todayMovements.filter((m) => m.type === 'egreso').reduce((sum, m) => sum + m.amount, 0);

  const cashSales = todayPaidSales.filter((s) => s.paymentMethod === 'Efectivo').reduce((sum, s) => sum + s.total, 0);
  const dineroEsperadoCaja = isCashOpen ? (initialCash + cashSales + totalIngresos - totalEgresos) : 0;

  const todayStats = {
    totalSales: todaySales.length,
    totalAmount: todaySales.reduce((sum, s) => sum + s.total, 0),
    totalItems: todaySales.reduce((sum, s) => sum + s.items.reduce((t, i) => t + i.quantity, 0), 0),
    verified: todaySales.filter((s) => s.verified).length,
    pending: todaySales.filter((s) => !s.verified).length,
    averageTicket: todaySales.length > 0 ? todaySales.reduce((sum, s) => sum + s.total, 0) / todaySales.length : 0,
  };

  const pendingOrders = salesHistory.filter((s) => !s.verified).length;

  const paymentBreakdown = {
    cash: todaySales.filter((s) => s.paymentMethod === 'Efectivo').reduce((sum, s) => sum + s.total, 0),
    debit: todaySales.filter((s) => s.paymentMethod === 'Tarjeta Débito').reduce((sum, s) => sum + s.total, 0),
    credit: todaySales.filter((s) => s.paymentMethod === 'Tarjeta Crédito').reduce((sum, s) => sum + s.total, 0),
    yape: todaySales.filter((s) => s.paymentMethod === 'Yape').reduce((sum, s) => sum + s.total, 0),
    plin: todaySales.filter((s) => s.paymentMethod === 'Plin').reduce((sum, s) => sum + s.total, 0),
  };

  const paymentBreakdownTotal = Object.values(paymentBreakdown).reduce((sum, value) => sum + value, 0);

  const hours = Array.from({ length: 12 }, (_, index) => 9 + index);
  const salesByHour = hours.map((hour) => {
    const relevant = todaySales.filter((sale) => new Date(sale.timestamp).getHours() === hour);
    return {
      hour,
      label: `${hour}:00`,
      total: relevant.reduce((sum, sale) => sum + sale.total, 0),
    };
  });

  const peakHour = salesByHour.reduce((best, current) => (current.total > best.total ? current : best), salesByHour[0] || { label: '0:00', total: 0 });
  const netMargin = todayStats.totalAmount * 0.28;

  const productTotals = salesHistory.reduce((acc, sale) => {
    sale.items.forEach((item) => {
      acc[item.name] = (acc[item.name] || 0) + item.quantity;
    });
    return acc;
  }, {});
  const topProducts = Object.entries(productTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, quantity]) => ({ name, quantity }));

  const maxHourly = Math.max(...salesByHour.map((hour) => hour.total), 1);

  const salesByHourData = {
    labels: salesByHour.map((hour) => hour.label),
    datasets: [
      {
        label: 'Ventas S/',
        data: salesByHour.map((hour) => hour.total),
        backgroundColor: '#C1546D',
        borderRadius: 18,
        maxBarThickness: 28,
      },
    ],
  };

  const salesByHourOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display: false },
      tooltip: { callbacks: { label: (context) => `S/ ${context.formattedValue}` } },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#5a4a4f', font: { weight: 600 } },
      },
      y: {
        grid: { color: 'rgba(79, 23, 37, 0.08)' },
        ticks: { color: '#5a4a4f' },
      },
    },
  };

  const paymentMethodData = {
    labels: ['Efectivo', 'Débito', 'Crédito', 'Yape', 'Plin'],
    datasets: [
      {
        data: [
          paymentBreakdown.cash,
          paymentBreakdown.debit,
          paymentBreakdown.credit,
          paymentBreakdown.yape,
          paymentBreakdown.plin,
        ],
        backgroundColor: ['#8B2D3F', '#C1546D', '#F7A072', '#4771B2', '#7A4C69'],
        borderWidth: 0,
      },
    ],
  };

  const paymentMethodOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'bottom', labels: { color: '#5a4a4f', usePointStyle: true, pointStyle: 'circle' } },
      tooltip: { callbacks: { label: (context) => `${context.label}: S/ ${context.formattedValue}` } },
    },
  };

  if (!currentUser) {
    return (
      <LoginForm
        users={users}
        defaultUsers={defaultUsers}
        inactivityNotice={inactivityNotice}
        onLoginSuccess={(user) => {
          setInactivityNotice(false);
          setCurrentUser(user);
          if (user.role === 'Cocina') {
            setActiveTab('Historial');
          } else {
            setActiveTab('Dashboard');
          }
        }}
        onRegisterUser={(newUser) => {
          setUsers((prev) => [...prev, newUser]);
        }}
      />
    );
  }

  const availableTabs = roleTabs[currentUser.role] || ['POS Venta'];

  const topProductsData = {
    labels: topProducts.map((item) => item.name),
    datasets: [
      {
        label: 'Unidades vendidas',
        data: topProducts.map((item) => item.quantity),
        backgroundColor: '#4771B2',
        borderRadius: 18,
        maxBarThickness: 22,
      },
    ],
  };

  const topProductsOptions = {
    indexAxis: 'y',
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (context) => `${context.formattedValue} unidades` } },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#5a4a4f' } },
      y: { ticks: { color: '#5a4a4f' }, grid: { display: false } },
    },
  };

  const tabIcons = {
    Dashboard: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="9" rx="1" />
        <rect x="14" y="3" width="7" height="5" rx="1" />
        <rect x="14" y="12" width="7" height="9" rx="1" />
        <rect x="3" y="16" width="7" height="5" rx="1" />
      </svg>
    ),
    Caja: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <circle cx="12" cy="12" r="3" />
        <path d="M6 12h.01M18 12h.01" />
      </svg>
    ),
    'POS Venta': (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
    ),
    Historial: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    Clientes: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    Productos: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
        <polygon points="12 22.08 12 12 3 6.92 3 17.08 12 22.08" />
        <polygon points="12 22.08 12 12 21 6.92 21 17.08 12 22.08" />
        <polygon points="12 12 3 6.92 12 1.84 21 6.92 12 12" />
      </svg>
    ),
    Inventario: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
    ),
    Usuarios: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  };

  const renderSidebarNav = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
      <div>
        {/* Logo Top */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 0.5rem 1.25rem 0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => { setActiveTab('Dashboard'); setIsMobileMenuOpen(false); }}>
            <div style={{ background: '#B84A62', color: '#FFF', borderRadius: '10px', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(184,74,98,0.3)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9"/>
                <circle cx="12" cy="12" r="4"/>
              </svg>
            </div>
            <span style={{ fontSize: '1.25rem', fontWeight: '800', color: '#FFFFFF', fontFamily: "'Playfair Display', Georgia, serif", letterSpacing: '0.3px' }}>
              Shari Sushi
            </span>
          </div>

          {!isDesktop && (
            <button 
              onClick={() => setIsMobileMenuOpen(false)} 
              style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#FFF', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Botón Vino Rose + Nuevo Pedido */}
        <button
          onClick={() => { setActiveTab('POS Venta'); setIsMobileMenuOpen(false); }}
          style={{
            width: '100%',
            background: '#B84A62',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '12px',
            padding: '0.8rem 1rem',
            fontWeight: '800',
            fontSize: '0.92rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(184, 74, 98, 0.35)',
            marginBottom: '1.5rem',
            transition: 'all 0.2s ease'
          }}
        >
          <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>+</span>
          <span>Nuevo Pedido</span>
        </button>

        {/* SECCIONES Y BOTONES DE NAVEGACIÓN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          
          {/* Sección GENERAL */}
          <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#B89EA8', letterSpacing: '0.8px', padding: '0.5rem 0.6rem 0.3rem 0.6rem', textTransform: 'uppercase' }}>
            GENERAL
          </span>

          {['Dashboard', 'Caja', 'POS Venta', 'Historial', 'Clientes'].filter(tab => availableTabs.includes(tab)).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setIsMobileMenuOpen(false); }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '0.7rem 0.9rem',
                  borderRadius: '10px',
                  background: isActive ? '#4F2A3B' : 'transparent',
                  color: isActive ? '#FFFFFF' : '#EBDDE2',
                  fontWeight: isActive ? '700' : '600',
                  fontSize: '0.9rem',
                  border: 'none',
                  borderLeft: isActive ? '3px solid #B84A62' : '3px solid transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease'
                }}
              >
                <span style={{ color: isActive ? '#FFFFFF' : '#B89EA8', display: 'flex', alignItems: 'center' }}>
                  {tabIcons[tab]}
                </span>
                <span style={{ color: isActive ? '#FFFFFF' : '#EBDDE2', display: 'inline-block' }}>{tab}</span>
              </button>
            );
          })}

          {/* Sección GESTIÓN */}
          <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#B89EA8', letterSpacing: '0.8px', padding: '1.2rem 0.6rem 0.3rem 0.6rem', textTransform: 'uppercase' }}>
            GESTIÓN
          </span>

          {['Productos', 'Inventario', 'Usuarios'].filter(tab => availableTabs.includes(tab)).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setIsMobileMenuOpen(false); }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '0.7rem 0.9rem',
                  borderRadius: '10px',
                  background: isActive ? '#4F2A3B' : 'transparent',
                  color: isActive ? '#FFFFFF' : '#EBDDE2',
                  fontWeight: isActive ? '700' : '600',
                  fontSize: '0.9rem',
                  border: 'none',
                  borderLeft: isActive ? '3px solid #B84A62' : '3px solid transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease'
                }}
              >
                <span style={{ color: isActive ? '#FFFFFF' : '#B89EA8', display: 'flex', alignItems: 'center' }}>
                  {tabIcons[tab]}
                </span>
                <span style={{ color: isActive ? '#FFFFFF' : '#EBDDE2', display: 'inline-block' }}>{tab}</span>
              </button>
            );
          })}

        </div>
      </div>

      {/* Footer del Menú Lateral */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem', marginTop: '1rem' }}>
        <button
          onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '0.65rem 0.8rem',
            borderRadius: '10px',
            background: 'transparent',
            color: '#F87171',
            fontWeight: '700',
            fontSize: '0.88rem',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="app-container" style={{ display: 'flex', flexDirection: isDesktop ? 'row' : 'column', minHeight: '100vh', width: '100%', overflowX: 'hidden' }}>
      
      {/* Sidebar estilo Shari Sushi Vino Tinto / Dark Plum (Solo visible en Escritorio) */}
      {isDesktop && (
        <aside className="sidebar-nav desktop-sidebar" style={{ width: '240px', background: '#3B1E2B', borderRight: '1px solid rgba(255, 255, 255, 0.08)', padding: '1.25rem 1rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100vh', position: 'sticky', top: 0, zIndex: 100, flexShrink: 0 }}>
          {renderSidebarNav()}
        </aside>
      )}

      {/* 📱 MENÚ LATERAL IZQUIERDO DESPLEGABLE MÓVIL (OFF-CANVAS DRAWER) */}
      {!isDesktop && isMobileMenuOpen && (
        <div 
          onClick={() => setIsMobileMenuOpen(false)}
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            background: 'rgba(0, 0, 0, 0.55)', 
            backdropFilter: 'blur(4px)', 
            zIndex: 99999, 
            display: 'flex' 
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{ 
              width: '270px', 
              height: '100%', 
              background: '#3B1E2B', 
              padding: '1.25rem 1rem', 
              boxShadow: '6px 0 30px rgba(0,0,0,0.3)', 
              overflowY: 'auto' 
            }}
          >
            {renderSidebarNav()}
          </div>
        </div>
      )}

      {/* Content Container */}
      <div className="content-container" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: isDesktop ? '100vh' : 'auto', overflowY: isDesktop ? 'auto' : 'visible', width: '100%' }}>
        
        {/* Top Header Bar */}
        <header className="desktop-header" style={{ 
          background: '#FFFFFF', 
          borderBottom: '1px solid #E5E7EB', 
          padding: isMobile ? '0.75rem 1rem' : '0.75rem 2rem', 
          display: 'flex', 
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'space-between', 
          alignItems: isMobile ? 'stretch' : 'center',
          gap: isMobile ? '0.75rem' : '0',
          position: 'sticky',
          top: 0,
          zIndex: 90
        }}>
          
          {/* Fila Móvil Superior con Hamburguesa, Logo y Perfil */}
          {!isDesktop && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '0.4rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => setIsMobileMenuOpen(true)}
                  style={{
                    background: '#3B1E2B',
                    border: 'none',
                    color: '#FFFFFF',
                    borderRadius: '10px',
                    width: '36px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }} onClick={() => setActiveTab('Dashboard')}>
                  <div style={{ background: '#B84A62', color: '#FFF', borderRadius: '8px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/></svg>
                  </div>
                  <span style={{ fontSize: '1.05rem', fontWeight: '800', color: '#101828', fontFamily: "'Playfair Display', Georgia, serif" }}>Shari Sushi</span>
                </div>
              </div>

              {/* Controles de la Derecha (Notificaciones y Perfil) en Móvil */}
              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                <div style={{ position: 'relative' }}>
                  <button 
                    title="Notificaciones de Stock" 
                    onClick={() => {
                      setIsNotificationsOpen(!isNotificationsOpen);
                      setIsSearchOpen(false);
                    }}
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: stockNotifications.length > 0 ? '#B84A62' : '#6B7280', position: 'relative', display: 'flex', alignItems: 'center', padding: '4px' }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                    </svg>
                    {stockNotifications.length > 0 && (
                      <span style={{ position: 'absolute', top: '-2px', right: '-4px', background: '#EF4444', color: '#FFFFFF', fontSize: '0.65rem', fontWeight: '900', padding: '1px 5px', borderRadius: '10px', minWidth: '14px', textAlign: 'center' }}>
                        {stockNotifications.length}
                      </span>
                    )}
                  </button>

                  {/* Panel Desplegable de Notificaciones Móvil */}
                  {isNotificationsOpen && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 10px)',
                        right: '-40px',
                        width: '290px',
                        background: '#FFFFFF',
                        borderRadius: '16px',
                        padding: '12px',
                        boxShadow: '0 12px 32px rgba(15, 23, 42, 0.2)',
                        border: '1px solid #E2E8F0',
                        zIndex: 300,
                        maxHeight: '340px',
                        overflowY: 'auto'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: '6px', marginBottom: '8px' }}>
                        <strong style={{ fontSize: '0.82rem', color: '#0F172A', fontWeight: '800' }}>Alertas de Stock ({stockNotifications.length})</strong>
                        <button onClick={() => setIsNotificationsOpen(false)} style={{ border: 'none', background: 'transparent', color: '#94A3B8', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
                      </div>

                      {stockNotifications.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '1rem 0', color: '#64748B', fontSize: '0.8rem' }}>
                          <p style={{ margin: 0, fontWeight: '700', color: '#10B981' }}>✓ Todo en orden</p>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {stockNotifications.map((notif) => (
                            <div
                              key={notif.id}
                              onClick={() => {
                                setActiveTab(notif.targetTab);
                                setIsNotificationsOpen(false);
                              }}
                              style={{
                                padding: '8px',
                                borderRadius: '8px',
                                background: notif.type === 'danger' ? '#FEF2F2' : '#FFFBEB',
                                border: `1px solid ${notif.type === 'danger' ? '#FECACA' : '#FDE68A'}`,
                                cursor: 'pointer',
                                fontSize: '0.78rem'
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <strong style={{ color: notif.type === 'danger' ? '#991B1B' : '#92400E' }}>{notif.title}</strong>
                                <span style={{ fontSize: '0.65rem', background: notif.type === 'danger' ? '#EF4444' : '#F59E0B', color: '#FFF', padding: '1px 5px', borderRadius: '4px' }}>{notif.badgeText}</span>
                              </div>
                              <span style={{ color: notif.type === 'danger' ? '#7F1D1D' : '#78350F', display: 'block', marginTop: '2px' }}>{notif.message}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Perfil Usuario Badge */}
                {currentUser && (
                  <div style={{ position: 'relative' }}>
                    <button
                      type="button"
                      onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: '#FDF4F5',
                        border: '1px solid #F1D8DD',
                        padding: '3px 8px 3px 3px',
                        borderRadius: '20px',
                        cursor: 'pointer'
                      }}
                    >
                      <img 
                        src={currentUser.avatar || fallbackImage} 
                        alt={currentUser.name} 
                        onError={handleImageError} 
                        style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }} 
                      />
                      <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#2E1622' }}>{currentUser.name.split(' ')[0]}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          {/* Search Bar con insignia ⌘ F / Ctrl+F e Interactivad Completa */}
          <div style={{ position: 'relative', width: isMobile ? '100%' : 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', background: '#F9FAFB', border: isSearchOpen ? '1px solid #B84A62' : '1px solid #E5E7EB', borderRadius: '12px', padding: '6px 14px', width: isMobile ? '100%' : '360px', gap: '10px', transition: 'all 0.2s ease', boxShadow: isSearchOpen ? '0 0 0 3px rgba(184, 74, 98, 0.1)' : 'none' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input 
                ref={globalSearchRef}
                type="text" 
                placeholder="Buscar platillo, cliente o comando..." 
                value={globalSearchQuery}
                onChange={(e) => {
                  setGlobalSearchQuery(e.target.value);
                  setIsSearchOpen(true);
                }}
                onFocus={() => setIsSearchOpen(true)}
                style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.88rem', color: '#111827', width: '100%', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              />
            </div>

            {/* Dropdown de la Paleta de Comandos y Atajos Rápidos */}
            {isSearchOpen && (
              <div 
                style={{ 
                  position: 'absolute', 
                  top: 'calc(100% + 8px)', 
                  left: 0, 
                  width: isMobile ? 'calc(100vw - 32px)' : '420px', 
                  maxWidth: '90vw',
                  background: '#FFFFFF', 
                  borderRadius: '16px', 
                  border: '1px solid #E2E8F0', 
                  boxShadow: '0 12px 32px rgba(15, 23, 42, 0.15)', 
                  zIndex: 200, 
                  padding: '12px',
                  maxHeight: '400px',
                  overflowY: 'auto'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                    Atajos Rápidos y Navegación
                  </span>
                  <button 
                    onClick={() => setIsSearchOpen(false)}
                    style={{ border: 'none', background: 'transparent', color: '#94A3B8', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem' }}
                  >
                    ✕
                  </button>
                </div>

                {/* Sección 1: Navegación de Comandos */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '10px' }}>
                  {commandPaletteResults.navigation.map((cmd) => (
                    <div
                      key={cmd.name}
                      onClick={() => {
                        setActiveTab(cmd.tab);
                        setIsSearchOpen(false);
                        setGlobalSearchQuery('');
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '10px', cursor: 'pointer', transition: 'background 0.15s ease' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', color: '#B84A62' }}>{cmd.icon}</span>
                      <div>
                        <div style={{ fontSize: '0.86rem', fontWeight: '700', color: '#0F172A' }}>{cmd.name}</div>
                        <div style={{ fontSize: '0.74rem', color: '#64748B' }}>{cmd.description}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Sección 2: Platillos Coincidentes */}
                {commandPaletteResults.products.length > 0 && (
                  <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '8px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v12"/></svg>
                      Platillos en Carta ({commandPaletteResults.products.length})
                    </span>
                    {commandPaletteResults.products.slice(0, 5).map((p) => (
                      <div
                        key={p.id}
                        onClick={() => {
                          setActiveTab('POS Venta');
                          addToCart(p);
                          setIsSearchOpen(false);
                          setGlobalSearchQuery('');
                        }}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#FDF4F5'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <span style={{ fontSize: '0.84rem', fontWeight: '700', color: '#2E1622' }}>{p.name} ({p.code || 'SKU'})</span>
                        <span style={{ fontSize: '0.84rem', fontWeight: '800', color: '#B84A62' }}>S/ {(p.price || 0).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Sección 3: Clientes */}
                {commandPaletteResults.clients.length > 0 && (
                  <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '8px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      Clientes Encontrados ({commandPaletteResults.clients.length})
                    </span>
                    {commandPaletteResults.clients.slice(0, 4).map((c) => (
                      <div
                        key={c.id || c.documentNumber}
                        onClick={() => {
                          setActiveTab('Clientes');
                          setIsSearchOpen(false);
                          setGlobalSearchQuery('');
                        }}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <span style={{ fontSize: '0.84rem', fontWeight: '700', color: '#0F172A' }}>{c.name}</span>
                        <span style={{ fontSize: '0.78rem', color: '#64748B' }}>Doc: {c.documentNumber || c.document_number}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Controls (Escritorio) */}
          <div style={{ display: isDesktop ? 'flex' : 'none', gap: '1rem', alignItems: 'center' }}>
            
            {/* 🟢 SLEEK COMPACT SUPABASE DB PILL STATUS */}
            <div 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                background: dbStatus === 'online' ? '#ECFDF5' : dbStatus === 'connecting' ? '#FEF3C7' : '#FEF2F2', 
                border: `1px solid ${dbStatus === 'online' ? '#A7F3D0' : dbStatus === 'connecting' ? '#FDE68A' : '#FCA5A5'}`, 
                padding: '4px 12px', 
                borderRadius: '20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
              }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: dbStatus === 'online' ? '#10B981' : dbStatus === 'connecting' ? '#F59E0B' : '#EF4444' }}></span>
              <span style={{ fontSize: '0.78rem', fontWeight: '800', color: dbStatus === 'online' ? '#065F46' : dbStatus === 'connecting' ? '#92400E' : '#991B1B', whiteSpace: 'nowrap' }}>
                {dbStatus === 'online' ? 'Conectado' : dbStatus === 'connecting' ? 'Conectando...' : 'Desconectado'}
              </span>
              <button
                onClick={() => syncDataFromDatabase(true)}
                disabled={isSyncingDB}
                title="Recopilar y sincronizar con la base de datos Supabase"
                style={{ 
                  background: 'transparent', 
                  border: 'none', 
                  color: dbStatus === 'online' ? '#059669' : '#475569', 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justify: 'center',
                  padding: '2px',
                  borderRadius: '50%'
                }}
              >
                <svg className={isSyncingDB ? 'spin-anim' : ''} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21.5 2v6h-6M2.5 22v-6h6"/><path d="M2 11.5a10 10 0 0 1 18.8-4.3L21.5 8M22 12.5a10 10 0 0 1-18.8 4.3L2.5 16"/></svg>
              </button>
            </div>

            {/* Campana de Notificaciones con Alertas de Stock Reales */}
            <div style={{ position: 'relative' }}>
              <button 
                title="Notificaciones de Stock" 
                onClick={() => {
                  setIsNotificationsOpen(!isNotificationsOpen);
                  setIsSearchOpen(false);
                }}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: stockNotifications.length > 0 ? '#B84A62' : '#6B7280', position: 'relative', display: 'flex', alignItems: 'center', padding: '6px' }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                {stockNotifications.length > 0 && (
                  <span style={{ position: 'absolute', top: '0px', right: '-2px', background: '#EF4444', color: '#FFFFFF', fontSize: '0.68rem', fontWeight: '900', padding: '1px 5px', borderRadius: '10px', minWidth: '16px', textAlign: 'center', boxShadow: '0 2px 4px rgba(239, 68, 68, 0.4)' }}>
                    {stockNotifications.length}
                  </span>
                )}
              </button>

              {/* Panel Desplegable de Notificaciones de Stock */}
              {isNotificationsOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 10px)',
                    right: 0,
                    width: '340px',
                    background: '#FFFFFF',
                    borderRadius: '16px',
                    padding: '12px',
                    boxShadow: '0 12px 32px rgba(15, 23, 42, 0.15)',
                    border: '1px solid #E2E8F0',
                    zIndex: 200,
                    maxHeight: '380px',
                    overflowY: 'auto'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0F172A" strokeWidth="2.2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                      <strong style={{ fontSize: '0.88rem', color: '#0F172A', fontWeight: '800' }}>Alertas de Stock ({stockNotifications.length})</strong>
                    </div>
                    <button 
                      onClick={() => setIsNotificationsOpen(false)}
                      style={{ border: 'none', background: 'transparent', color: '#94A3B8', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      ✕
                    </button>
                  </div>

                  {stockNotifications.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '1.5rem 0', color: '#64748B', fontSize: '0.85rem' }}>
                      <p style={{ margin: 0, fontWeight: '700', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                        Todo en orden
                      </p>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem' }}>No hay platillos ni insumos en nivel crítico de stock.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {stockNotifications.map((notif) => (
                        <div
                          key={notif.id}
                          onClick={() => {
                            setActiveTab(notif.targetTab);
                            setIsNotificationsOpen(false);
                          }}
                          style={{
                            padding: '10px',
                            borderRadius: '10px',
                            background: notif.type === 'danger' ? '#FEF2F2' : '#FFFBEB',
                            border: `1px solid ${notif.type === 'danger' ? '#FECACA' : '#FDE68A'}`,
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: '800', color: notif.type === 'danger' ? '#991B1B' : '#92400E' }}>
                              {notif.title}
                            </span>
                            <span style={{ fontSize: '0.68rem', fontWeight: '800', background: notif.type === 'danger' ? '#EF4444' : '#F59E0B', color: '#FFF', padding: '2px 6px', borderRadius: '6px' }}>
                              {notif.badgeText}
                            </span>
                          </div>
                          <span style={{ fontSize: '0.78rem', color: notif.type === 'danger' ? '#7F1D1D' : '#78350F' }}>
                            {notif.message}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Perfil de Usuario con Menú Desplegable (Dropdown) */}
            {currentUser && (
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    background: '#FDF4F5',
                    border: '1px solid #F1D8DD',
                    padding: '5px 14px 5px 6px',
                    borderRadius: '24px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <img 
                    src={currentUser.avatar || fallbackImage} 
                    alt={currentUser.name} 
                    onError={handleImageError} 
                    style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} 
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', lineHeight: '1.2' }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: '800', color: '#2E1622' }}>
                      {currentUser.name}
                    </span>
                    <span style={{ fontSize: '0.74rem', color: '#7D636E', fontWeight: '600' }}>
                      {currentUser.role}
                    </span>
                  </div>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#B84A62"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      transform: isProfileMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease',
                      marginLeft: '4px'
                    }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {/* Dropdown Menu Desplegable */}
                {isProfileMenuOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 8px)',
                      right: 0,
                      width: '230px',
                      background: '#FFFFFF',
                      borderRadius: '16px',
                      padding: '0.75rem',
                      boxShadow: '0 10px 30px rgba(59, 30, 43, 0.12)',
                      border: '1px solid #E8DCD8',
                      zIndex: 1000,
                      fontFamily: "'Plus Jakarta Sans', sans-serif"
                    }}
                  >
                    <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #F8EEF0', marginBottom: '0.5rem' }}>
                      <strong style={{ fontSize: '0.88rem', color: '#2E1622', display: 'block', fontWeight: '800' }}>{currentUser.name}</strong>
                      <span style={{ fontSize: '0.75rem', color: '#7D636E', fontWeight: '600' }}>{currentUser.email || currentUser.role}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        if (window.confirm('¿Desea cerrar la sesión?')) {
                          setCurrentUser(null);
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        background: '#FDF4F5',
                        border: '1px solid #F1D8DD',
                        color: '#B84A62',
                        fontWeight: '800',
                        fontSize: '0.84rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                      </svg>
                      <span>Cerrar Sesión</span>
                    </button>
                  </div>
                )}
              </div>
            )}

          </div>
        </header>

        <div className="main-layout" style={{ display: 'flex', padding: '1.5rem 2rem 2rem 2rem', gap: '2rem', flex: 1, minHeight: 0, background: 'var(--bg-app)' }}>
        {(activeTab === 'Dashboard' || activeTab === 'Inicio') && (
          <div className="full-section dashboard-oppo-view" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', paddingBottom: '2rem' }}>
            
            {/* Greeting Banner & Interactive Period Selector */}
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? '0.75rem' : '0' }}>
              <div>
                <h2 style={{ fontSize: isMobile ? '1.5rem' : '2rem', fontWeight: '800', color: '#111827', margin: 0 }}>
                  Bienvenido, {currentUser.name}
                </h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.88rem', color: '#6B7280', fontWeight: '500' }}>
                  Estadísticas del Restaurante — {new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>

              {/* Filtro Desplegable Interactivo de Rango de Períodos / Meses */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#4B5563' }}>Filtro de Tiempo:</span>
                <select
                  value={dashboardPeriod}
                  onChange={(e) => setDashboardPeriod(e.target.value)}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    padding: '8px 16px',
                    borderRadius: '12px',
                    fontSize: '0.88rem',
                    color: '#0F172A',
                    fontWeight: '700',
                    outline: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
                    flex: isMobile ? 1 : 'none'
                  }}
                >
                  <option value="today">Hoy</option>
                  <option value="week">Esta Semana</option>
                  <option value="month">Este Mes</option>
                  <option value="year">Este Año</option>
                  <option value="all">Todo el Histórico</option>
                </select>
              </div>
            </div>

            {/* Main Dashboard Grid Layout en Español */}
            <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? '320px 1fr 1fr' : '1fr', gap: '1.5rem', width: '100%' }}>
              
              {/* Card 1: Tacómetro "Promedio de Puntos" + Áreas de Atención */}
              <div style={{ background: '#FFFFFF', borderRadius: '20px', border: '1px solid #E5E7EB', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', gridRow: 'span 2' }}>
                
                {/* Top Title */}
                <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#111827', margin: 0 }}>
                  Promedio de Rendimiento
                </h3>

                {/* Tacómetro Arc Gauge Dinámico */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', margin: '0.5rem 0' }}>
                  <svg width="220" height="120" viewBox="0 0 220 120">
                    {Array.from({ length: 28 }).map((_, i) => {
                      const angle = -180 + (i * (180 / 27));
                      const rad = (angle * Math.PI) / 180;
                      const x1 = 110 + Math.cos(rad) * 75;
                      const y1 = 100 + Math.sin(rad) * 75;
                      const x2 = 110 + Math.cos(rad) * 90;
                      const y2 = 100 + Math.sin(rad) * 90;
                      const activePercentage = (i / 27) * 100 <= dashboardScore;
                      return (
                        <line
                          key={i}
                          x1={x1}
                          y1={y1}
                          x2={x2}
                          y2={y2}
                          stroke={activePercentage ? '#B84A62' : '#E5E7EB'}
                          strokeWidth="4"
                          strokeLinecap="round"
                        />
                      );
                    })}
                  </svg>
                  <div style={{ position: 'absolute', bottom: '15px', textAlign: 'center' }}>
                    <span style={{ fontSize: '2.6rem', fontWeight: '900', color: '#111827', lineHeight: 1 }}>{dashboardScore}</span>
                    <span style={{ fontSize: '1.2rem', fontWeight: '700', color: '#B84A62', marginLeft: '2px' }}>%</span>
                  </div>
                  <p style={{ margin: '8px 0 0 0', fontSize: '0.82rem', color: '#6B7280', fontWeight: '700' }}>
                    Puntuación del Restaurante <span style={{ color: '#B84A62', fontWeight: '800' }}>{dashboardScore}</span> / 100
                  </p>
                </div>

                {/* Sección Áreas de Atención Interactivas */}
                <div style={{ background: '#FAF9F6', borderRadius: '16px', padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <h4 style={{ fontSize: '0.92rem', fontWeight: '800', color: '#111827', margin: 0 }}>
                    Áreas de Atención
                  </h4>

                  {/* Delivery */}
                  <div 
                    onClick={() => setActiveTab('Historial')} 
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '6px', borderRadius: '10px', transition: 'background 0.2s ease' }}
                    title="Ver Historial de Pedidos"
                  >
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.04)', color: pendingDeliveryCount > 0 ? '#EF4444' : '#10B981' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="1" y="3" width="15" height="13" rx="2"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: '0.78rem', color: '#6B7280' }}>{pendingDeliveryCount} pedidos pendientes</p>
                      <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: '700', color: '#111827' }}>Delivery & Apps</p>
                    </div>
                  </div>

                  {/* Caja */}
                  <div 
                    onClick={() => setActiveTab('Caja')} 
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '6px', borderRadius: '10px', transition: 'background 0.2s ease' }}
                    title="Ir a Módulo de Caja"
                  >
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.04)', color: isCashOpen ? '#10B981' : '#F59E0B' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 12h.01M18 12h.01"/></svg>
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: '0.78rem', color: '#6B7280' }}>{isCashOpen ? `Abierta con S/ ${cashRegister.toFixed(2)}` : 'Caja cerrada'}</p>
                      <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: '700', color: '#111827' }}>Caja Registradora</p>
                    </div>
                  </div>

                  {/* Insumos */}
                  <div 
                    onClick={() => setActiveTab('Inventario')} 
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '6px', borderRadius: '10px', transition: 'background 0.2s ease' }}
                    title="Ir a Gestión de Inventario"
                  >
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.04)', color: lowStockItemsCount > 0 ? '#EF4444' : '#10B981' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: '0.78rem', color: '#6B7280' }}>{lowStockItemsCount} insumos con stock bajo</p>
                      <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: '700', color: '#111827' }}>Insumos de Sushi</p>
                    </div>
                  </div>

                  {/* Mesas */}
                  <div 
                    onClick={() => setActiveTab('POS Venta')} 
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '6px', borderRadius: '10px', transition: 'background 0.2s ease' }}
                    title="Ir a POS Venta"
                  >
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.04)', color: '#3B82F6' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="2" x2="6" y2="8"/></svg>
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: '0.78rem', color: '#6B7280' }}>{activeTablesCount} órdenes activas en salón</p>
                      <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: '700', color: '#111827' }}>Atención en Mesas</p>
                    </div>
                  </div>

                </div>

              </div>

              {/* Card 2: Perfiles de Usuario Dinámico */}
              <div 
                onClick={() => setActiveTab(availableTabs.includes('Usuarios') ? 'Usuarios' : 'Clientes')}
                style={{ background: '#FFFFFF', borderRadius: '20px', border: '1px solid #E5E7EB', padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', cursor: 'pointer' }}
                title="Ver lista de usuarios"
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4B5563', fontSize: '0.88rem', fontWeight: '600' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                    <span>Perfiles de Usuario</span>
                  </div>
                  <span style={{ color: '#B84A62', fontSize: '1.1rem', fontWeight: 'bold' }}>&gt;</span>
                </div>
                <div style={{ margin: '0.8rem 0 0 0' }}>
                  <h3 style={{ fontSize: '2.2rem', fontWeight: '900', color: '#111827', margin: 0 }}>{users.length}</h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#6B7280' }}>{users.filter(u => u.status === 'activo').length} usuarios activos en la plataforma</p>
                </div>
              </div>

              {/* Card 3: Ventas Filtradas Dinámicas */}
              <div 
                onClick={() => setActiveTab('Historial')}
                style={{ background: '#FFFFFF', borderRadius: '20px', border: '1px solid #E5E7EB', padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', cursor: 'pointer' }}
                title="Ver Historial Completo"
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4B5563', fontSize: '0.88rem', fontWeight: '600' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M15 9.5A2.5 2.5 0 0 0 12.5 7H11a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4h-2A2.5 2.5 0 0 1 8.5 14.5"/></svg>
                    <span>Ventas del Período</span>
                  </div>
                  <span style={{ color: '#B84A62', fontSize: '1.1rem', fontWeight: 'bold' }}>&gt;</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '0.5rem 0' }}>
                  <h3 style={{ fontSize: '2rem', fontWeight: '900', color: '#111827', margin: 0 }}>S/ {dashboardTotalSalesAmount.toFixed(2)}</h3>
                  <span style={{ background: '#ECFDF5', color: '#047857', fontSize: '0.78rem', fontWeight: '700', padding: '3px 8px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    {dashboardFilteredSales.length} trans.
                  </span>
                </div>

                {/* Gráfico Onda Representativo */}
                <div style={{ position: 'relative', width: '100%', height: '55px', marginTop: '4px' }}>
                  <svg width="100%" height="55" viewBox="0 0 300 55" fill="none">
                    <line x1="0" y1="40" x2="300" y2="40" stroke="#E5E7EB" strokeWidth="2" strokeDasharray="4 4" />
                    <path d="M0 35 Q 75 10, 150 25 T 300 15" stroke="#B84A62" strokeWidth="3" fill="none" />
                    <circle cx="220" cy="20" r="5" fill="#B84A62" stroke="#FFF" strokeWidth="2" />
                  </svg>
                  <div style={{ position: 'absolute', top: '2px', left: '165px', background: '#374151', color: '#FFF', fontSize: '0.68rem', padding: '2px 8px', borderRadius: '10px', fontWeight: '600' }}>
                    S/ {dashboardTotalSalesAmount.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Card 4: Pedidos & Platillos Dinámicos */}
              <div style={{ gridColumn: 'span 2', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                
                <div 
                  onClick={() => setActiveTab('Historial')}
                  style={{ background: '#FFFFFF', borderRadius: '20px', border: '1px solid #E5E7EB', padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4B5563', fontSize: '0.88rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                    <span>Pedidos Totales</span>
                  </div>
                  <h3 style={{ fontSize: '2rem', fontWeight: '900', color: '#111827', margin: 0 }}>{dashboardFilteredSales.length}</h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#6B7280' }}>{dashboardFilteredSales.filter(s => s.paymentMethod === 'Efectivo').length} pedidos pagados en efectivo</p>
                </div>

                <div 
                  onClick={() => setActiveTab('POS Venta')}
                  style={{ background: '#FFFFFF', borderRadius: '20px', border: '1px solid #E5E7EB', padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4B5563', fontSize: '0.88rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                    <span>Platillos Activos</span>
                  </div>
                  <h3 style={{ fontSize: '2rem', fontWeight: '900', color: '#111827', margin: 0 }}>{products.filter(p => p.status !== 'inactivo').length}</h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#6B7280' }}>{products.filter(p => p.stock > 0).length} platillos con stock disponible</p>
                </div>

              </div>

              {/* Card 5: Rendimiento de Recursos Dinámico */}
              <div style={{ gridColumn: 'span 2', background: '#FFFFFF', borderRadius: '20px', border: '1px solid #E5E7EB', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: '#111827', margin: 0 }}>
                    Rendimiento de Recursos
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ background: '#F3F4F6', padding: '3px', borderRadius: '20px', display: 'flex', gap: '2px' }}>
                      <button 
                        onClick={() => setDashboardResourceTab('ventas')}
                        style={{ 
                          background: dashboardResourceTab === 'ventas' ? '#111827' : 'transparent', 
                          color: dashboardResourceTab === 'ventas' ? '#FFF' : '#4B5563', 
                          border: 'none', 
                          padding: '5px 14px', 
                          borderRadius: '16px', 
                          fontSize: '0.78rem', 
                          fontWeight: '700', 
                          cursor: 'pointer' 
                        }}
                      >
                        Ventas (S/)
                      </button>
                      <button 
                        onClick={() => setDashboardResourceTab('platillos')}
                        style={{ 
                          background: dashboardResourceTab === 'platillos' ? '#111827' : 'transparent', 
                          color: dashboardResourceTab === 'platillos' ? '#FFF' : '#4B5563', 
                          border: 'none', 
                          padding: '5px 14px', 
                          borderRadius: '16px', 
                          fontSize: '0.78rem', 
                          fontWeight: '700', 
                          cursor: 'pointer' 
                        }}
                      >
                        Platillos (Cant)
                      </button>
                    </div>

                    <select
                      value={dashboardPeriod}
                      onChange={(e) => setDashboardPeriod(e.target.value)}
                      style={{
                        background: '#FFFFFF',
                        border: '1px solid #E5E7EB',
                        padding: '5px 12px',
                        borderRadius: '10px',
                        fontSize: '0.78rem',
                        color: '#111827',
                        fontWeight: '600',
                        cursor: 'pointer',
                        outline: 'none'
                      }}
                    >
                      <option value="today">Hoy</option>
                      <option value="week">Esta Semana</option>
                      <option value="month">Este Mes</option>
                      <option value="year">Este Año</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#6B7280' }}>
                    {dashboardResourceTab === 'ventas' ? 'Total acumulado en el período' : 'Total unidades vendidas'}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '-6px' }}>
                  <h3 style={{ fontSize: '2.2rem', fontWeight: '900', color: '#111827', margin: 0 }}>
                    {dashboardResourceTab === 'ventas' ? `S/ ${dashboardTotalSalesAmount.toFixed(2)}` : `${dashboardFilteredSales.reduce((sum, s) => sum + (s.items?.length || 1), 0)} un.`}
                  </h3>
                  <span style={{ background: '#ECFDF5', color: '#047857', fontSize: '0.78rem', fontWeight: '700', padding: '3px 8px', borderRadius: '20px' }}>
                    {dashboardFilteredSales.length} registros
                  </span>
                </div>

                {/* Dynamic Bar Chart */}
                <div style={{ position: 'relative', marginTop: '1rem', width: '100%', height: '160px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '0 1rem' }}>
                  
                  {/* Dashed Line */}
                  <div style={{ position: 'absolute', top: '135px', left: 0, right: 0, borderTop: '1.5px dashed #E5E7EB', zIndex: 1, display: 'flex', alignItems: 'center' }}>
                    <span style={{ background: '#6B7280', color: '#FFF', fontSize: '0.72rem', fontWeight: '700', padding: '2px 8px', borderRadius: '10px', marginTop: '-12px' }}>
                      Base
                    </span>
                  </div>

                  {dashboardChartBars.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', zIndex: 2 }} title={`${item.label}: ${dashboardResourceTab === 'ventas' ? 'S/' + item.val.toFixed(2) : item.val + ' unidades'}`}>
                      <div 
                        style={{ 
                          width: '32px', 
                          height: `${item.heightPx}px`, 
                          background: item.val > 0 ? '#B84A62' : '#E5E7EB', 
                          borderRadius: '8px 8px 4px 4px',
                          transition: 'all 0.3s ease',
                          boxShadow: item.val > 0 ? '0 4px 10px rgba(184, 74, 98, 0.25)' : 'none'
                        }} 
                      />
                      <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#4B5563' }}>
                        {item.label}
                      </span>
                    </div>
                  ))}

                </div>

              </div>

            </div>

          </div>
        )}

        {(activeTab === 'POS Venta' || activeTab === 'POS') && (
          <div style={{ display: 'flex', flexDirection: isDesktop ? 'row' : 'column', gap: isDesktop ? '1.25rem' : '1rem', width: '100%', alignItems: 'flex-start', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            
            {/* 🍱 Columna Izquierda: Catálogo y Buscador de Platillos */}
            <main className="content-area" style={{ flex: 1, minWidth: 0, width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              {/* Encabezado del POS con Buscador Integrado */}
              <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #EAECF0', padding: isMobile ? '1rem' : '1.2rem 1.4rem', display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? '0.75rem' : '0', boxShadow: '0 1px 3px rgba(16,24,40,0.03)' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#101828', fontWeight: '800', letterSpacing: '-0.3px' }}>
                      POS Punto de Venta
                    </h2>
                    <span style={{ 
                      background: isCashOpen ? '#ECFDF5' : '#FEF2F2', 
                      color: isCashOpen ? '#027A48' : '#B42318', 
                      border: `1px solid ${isCashOpen ? '#ABEFC6' : '#FECDCA'}`,
                      padding: '4px 12px', 
                      borderRadius: '20px', 
                      fontSize: '0.75rem', 
                      fontWeight: '700',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isCashOpen ? '#12B76A' : '#F04438' }}></span>
                      {isCashOpen ? 'CAJA ABIERTA' : 'CAJA CERRADA'}
                    </span>
                  </div>
                  <p style={{ margin: '3px 0 0 0', fontSize: '0.82rem', color: '#475467' }}>
                    Seleccione los platillos para armar la orden y proceder al cobro
                  </p>
                </div>
                
                {/* Buscador minimalista de platillos */}
                <div style={{ position: 'relative', width: isMobile ? '100%' : '320px' }}>
                  <input
                    type="text"
                    placeholder="Buscar por platillo o código..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ 
                      width: '100%', 
                      padding: '0.6rem 1rem 0.6rem 2.5rem', 
                      borderRadius: '12px', 
                      border: '1px solid #D0D5DD', 
                      background: '#F9FAFB', 
                      fontSize: '0.86rem', 
                      outline: 'none', 
                      color: '#101828', 
                      boxShadow: '0 1px 2px rgba(16,24,40,0.04)',
                      transition: 'all 0.15s ease'
                    }}
                  />
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#667085" strokeWidth="2.2" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}>
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                </div>
              </div>

              {/* Categorías en formato de Píldoras Limpias */}
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }}>
                {categoriesList.map((cat) => {
                  const isActive = activeCategory === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      style={{
                        padding: '8px 18px',
                        borderRadius: '12px',
                        background: isActive ? '#101828' : '#FFFFFF',
                        color: isActive ? '#FFFFFF' : '#344054',
                        border: isActive ? '1px solid #101828' : '1px solid #D0D5DD',
                        fontSize: '0.84rem',
                        fontWeight: isActive ? '700' : '600',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        boxShadow: isActive ? '0 2px 4px rgba(16,24,40,0.1)' : '0 1px 2px rgba(16,24,40,0.03)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>

              {/* Grilla Ordenada de Productos */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(210px, 1fr))', gap: isMobile ? '0.75rem' : '1.1rem' }}>
                {filteredProducts.length === 0 ? (
                  <div style={{ gridColumn: '1 / -1', padding: '3rem', background: '#FFF', borderRadius: '16px', border: '1px solid #EAECF0', textAlign: 'center', color: '#667085', fontWeight: '600' }}>
                    No se encontraron productos en esta categoría
                  </div>
                ) : (
                  filteredProducts.map((product) => (
                    <div
                      key={product.id}
                      onClick={() => product.stock > 0 && addToCart(product)}
                      style={{
                        background: '#FFFFFF',
                        borderRadius: '16px',
                        border: '1px solid #EAECF0',
                        padding: '0.9rem',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '0.7rem',
                        boxShadow: '0 1px 3px rgba(16, 24, 40, 0.04)',
                        opacity: product.stock === 0 ? 0.65 : 1,
                        cursor: product.stock === 0 ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {/* Imagen con Insignias */}
                      <div style={{ width: '100%', height: '130px', borderRadius: '12px', overflow: 'hidden', position: 'relative', background: '#F9FAFB' }}>
                        <img src={product.image || fallbackImage} alt={product.name} onError={handleImageError} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <span style={{ 
                          position: 'absolute', 
                          top: '8px', 
                          right: '8px', 
                          background: product.stock === 0 ? '#FEF2F2' : (product.stock <= 5 ? '#FEF3C7' : '#FFFFFF'), 
                          color: product.stock === 0 ? '#B42318' : (product.stock <= 5 ? '#D97706' : '#344054'), 
                          padding: '3px 8px', 
                          borderRadius: '8px', 
                          fontSize: '0.72rem', 
                          fontWeight: '700', 
                          border: `1px solid ${product.stock === 0 ? '#FECDCA' : (product.stock <= 5 ? '#FDE68A' : '#E4E7EC')}`,
                          boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                        }}>
                          {product.stock === 0 ? 'Agotado' : `${product.stock} uds`}
                        </span>
                      </div>

                      {/* Info de Producto */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.7rem', color: '#B84A62', fontWeight: '800', background: '#FDF4F5', padding: '2px 6px', borderRadius: '4px' }}>{product.code}</span>
                          <span style={{ fontSize: '0.71rem', color: '#667085', fontWeight: '600' }}>{product.category}</span>
                        </div>
                        <h4 style={{ margin: '4px 0 2px 0', fontSize: '0.95rem', color: '#101828', fontWeight: '700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {product.name}
                        </h4>
                        <strong style={{ fontSize: '1.1rem', color: '#B84A62', fontWeight: '800' }}>
                          S/ {product.price.toFixed(2)}
                        </strong>
                      </div>

                      {/* Botón de Selección */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (product.stock > 0) addToCart(product);
                        }}
                        disabled={product.stock === 0}
                        style={{
                          width: '100%',
                          padding: '9px',
                          borderRadius: '10px',
                          border: 'none',
                          background: product.stock === 0 ? '#F2F4F7' : '#B84A62',
                          color: product.stock === 0 ? '#98A2B3' : '#FFFFFF',
                          fontWeight: '800',
                          fontSize: '0.84rem',
                          cursor: product.stock === 0 ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          boxShadow: product.stock === 0 ? 'none' : '0 2px 6px rgba(184, 74, 98, 0.25)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {product.stock === 0 ? 'Agotado' : '+ Agregar a Orden'}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </main>

            {/* 🛒 Columna Derecha: Panel de Carrito Calcado de la Imagen Conceptual (450px en escritorio / 100% en celular) */}
            <aside style={{ width: isDesktop ? '450px' : '100%', flexShrink: 0, background: '#F8F9FA', borderRadius: '22px', padding: isMobile ? '1rem' : '1.4rem', display: 'flex', flexDirection: 'column', gap: '1.1rem', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)', border: '1px solid #E5E7EB', position: isDesktop ? 'sticky' : 'static', top: '0.8rem' }}>
              
              {/* Header del Carrito (Calcado a la imagen) */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E5E7EB', paddingBottom: '0.75rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: '#111827', letterSpacing: '-0.3px' }}>
                  Confirmación de Pedido
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ background: '#E5E7EB', color: '#374151', borderRadius: '12px', padding: '3px 10px', fontSize: '0.78rem', fontWeight: '700' }}>
                    {cart.length} ítems
                  </span>
                  {cart.length > 0 && (
                    <button
                      onClick={clearCart}
                      style={{ background: '#FEF2F2', border: '1px solid #FECDCA', color: '#B42318', fontSize: '0.75rem', fontWeight: '700', padding: '4px 10px', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.15s ease' }}
                    >
                      Limpiar
                    </button>
                  )}
                </div>
              </div>

              {/* 1. Modalidad de Consumo */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  MODALIDAD DE CONSUMO
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', background: '#E5E7EB', padding: '3px', borderRadius: '12px' }}>
                  {[
                    { id: 'Mesa', label: 'Mesa' },
                    { id: 'Llevar', label: 'Para Llevar' },
                    { id: 'Delivery', label: 'Delivery' }
                  ].map((mode) => {
                    const isActive = consumptionMode === mode.id;
                    return (
                      <button
                        key={mode.id}
                        onClick={() => setConsumptionMode(mode.id)}
                        style={{
                          padding: '8px 6px',
                          borderRadius: '9px',
                          background: isActive ? '#FFFFFF' : 'transparent',
                          border: 'none',
                          color: isActive ? '#111827' : '#6B7280',
                          fontSize: '0.84rem',
                          fontWeight: isActive ? '800' : '600',
                          cursor: 'pointer',
                          boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {mode.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Cards Blancas Flotantes de Productos (Exactas a la Imagen) */}
              <div style={{ minHeight: '140px', maxHeight: '230px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.65rem', paddingRight: '2px' }}>
                {cart.length === 0 ? (
                  <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: '#9CA3AF', background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E5E7EB', fontSize: '0.86rem', fontWeight: '600' }}>
                    Agregue platillos del catálogo para armar la orden
                  </div>
                ) : (
                  cart.map((item) => (
                    <div key={`cart-item-${item.id}`} style={{ display: 'flex', gap: '0.75rem', padding: '0.75rem 0.9rem', background: '#FFFFFF', borderRadius: '14px', border: '1px solid #E5E7EB', alignItems: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
                      <img src={item.image || fallbackImage} alt={item.name} onError={handleImageError} style={{ width: '50px', height: '50px', borderRadius: '10px', objectFit: 'cover' }} />
                      
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <strong style={{ fontSize: '0.9rem', color: '#111827', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: '700' }}>
                            {item.name}
                          </strong>
                          <button onClick={() => removeFromCart(item.id)} style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: '0.85rem', padding: '0 0 0 6px' }}>✕</button>
                        </div>
                        
                        <span style={{ fontSize: '0.74rem', color: '#6B7280', display: 'block', margin: '1px 0 6px 0' }}>
                          S/ {item.price.toFixed(2)} c/u
                        </span>

                        {/* Steppers Vino Táctiles (Calcados a la imagen) */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button 
                              onClick={() => updateQuantity(item.id, item.quantity - 1)} 
                              style={{ width: '22px', height: '22px', borderRadius: '6px', border: 'none', background: '#7E1D33', color: '#FFFFFF', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              -
                            </button>
                            <span style={{ fontSize: '0.88rem', fontWeight: '800', minWidth: '18px', textAlign: 'center', color: '#111827' }}>
                              {item.quantity}
                            </span>
                            <button 
                              onClick={() => updateQuantity(item.id, item.quantity + 1)} 
                              style={{ width: '22px', height: '22px', borderRadius: '6px', border: 'none', background: '#7E1D33', color: '#FFFFFF', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              +
                            </button>
                          </div>
                          
                          <strong style={{ fontSize: '0.95rem', color: '#111827', fontWeight: '800' }}>
                            S/ {(item.quantity * item.price).toFixed(2)}
                          </strong>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* 3. Datos del Cliente & Comprobante SUNAT */}
              <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '14px', padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#6B7280', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                    COMPROBANTE Y CLIENTE
                  </span>
                  <div style={{ display: 'flex', gap: '4px', background: '#F3F4F6', padding: '2px', borderRadius: '8px' }}>
                    {['Boleta', 'Factura'].map((doc) => (
                      <button
                        key={doc}
                        onClick={() => setDocType(doc)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          background: docType === doc ? '#FFFFFF' : 'transparent',
                          color: docType === doc ? '#111827' : '#6B7280',
                          border: docType === doc ? '1px solid #D1D5DB' : 'none',
                          fontSize: '0.76rem',
                          fontWeight: '800',
                          cursor: 'pointer',
                          boxShadow: docType === doc ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                        }}
                      >
                        {doc}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="text"
                      maxLength={docType === 'Boleta' ? 8 : 11}
                      placeholder={docType === 'Boleta' ? "DNI (8 dígitos)" : "RUC (11 dígitos)"}
                      value={clientDNI}
                      onChange={(e) => setClientDNI(e.target.value.replace(/\D/g, ''))}
                      style={{ flex: 1, padding: '0.5rem 0.7rem', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '0.84rem', background: '#F9FAFB', outline: 'none', color: '#111827' }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!clientDNI) return;
                        const found = findClientByDocument(clients, clientDNI);
                        if (found) {
                          setClientName(found.name);
                          alert(`Cliente encontrado: ${found.name}`);
                        } else {
                          alert('Cliente no registrado en la base de datos.');
                        }
                      }}
                      style={{ padding: '0 12px', borderRadius: '8px', border: 'none', background: '#7E1D33', color: '#FFF', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '700', flexShrink: 0 }}
                    >
                      Buscar
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder={docType === 'Boleta' ? "Nombre del Cliente" : "Razón Social"}
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem 0.7rem', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '0.84rem', background: '#F9FAFB', outline: 'none', color: '#111827' }}
                  />
                </div>
              </div>

              {/* 4. Métodos de Pago Rápidos con Iconos (Calcados a la Imagen) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  MÉTODO DE PAGO
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  {[
                    { id: 'debit', label: 'Tarjeta', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> },
                    { id: 'cash', label: 'Efectivo', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><line x1="6" y1="12" x2="6.01" y2="12"/><line x1="18" y1="12" x2="18.01" y2="12"/></svg> },
                    { id: 'yape', label: 'Yape / QR', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg> }
                  ].map((m) => {
                    const isActive = paymentMethod === m.id;
                    return (
                      <button
                        key={m.id}
                        onClick={() => setPaymentMethod(m.id)}
                        style={{
                          padding: '10px 4px',
                          borderRadius: '10px',
                          background: isActive ? '#FFFFFF' : '#F3F4F6',
                          border: isActive ? '2px solid #7E1D33' : '1px solid #E5E7EB',
                          color: isActive ? '#7E1D33' : '#4B5563',
                          fontSize: '0.78rem',
                          fontWeight: isActive ? '800' : '600',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '4px',
                          boxShadow: isActive ? '0 2px 6px rgba(126,29,51,0.12)' : 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {m.icon}
                        <span>{m.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Vuelto y atajos de efectivo */}
                {paymentMethod === 'cash' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: '#FFFFFF', padding: '0.75rem', borderRadius: '10px', border: '1px solid #E5E7EB', marginTop: '4px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>
                        <label style={{ fontSize: '0.71rem', color: '#6B7280', fontWeight: '700', display: 'block', marginBottom: '3px' }}>Paga con S/</label>
                        <input
                          type="number"
                          step="0.10"
                          value={cashInput}
                          onChange={(e) => setCashInput(e.target.value)}
                          placeholder="0.00"
                          style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #D1D5DB', background: '#FFF', fontSize: '0.88rem', fontWeight: '800', color: '#111827', outline: 'none' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.71rem', color: '#6B7280', fontWeight: '700', display: 'block', marginBottom: '3px' }}>Vuelto S/</label>
                        <div style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #ABEFC6', background: '#ECFDF5', fontSize: '0.88rem', fontWeight: '800', color: '#027A48' }}>
                          S/ {change.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                      {[20, 50, 100].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setCashInput(val.toString())}
                          style={{
                            flex: 1,
                            padding: '4px 0',
                            borderRadius: '6px',
                            border: '1px solid #D1D5DB',
                            background: '#F9FAFB',
                            fontSize: '0.72rem',
                            fontWeight: '700',
                            color: '#374151',
                            cursor: 'pointer'
                          }}
                        >
                          S/ {val}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setCashInput(total.toFixed(2))}
                        style={{
                          flex: 1.2,
                          padding: '4px 0',
                          borderRadius: '6px',
                          border: '1px solid #7E1D33',
                          background: '#FDF4F5',
                          fontSize: '0.72rem',
                          fontWeight: '800',
                          color: '#7E1D33',
                          cursor: 'pointer'
                        }}
                      >
                        Exacto
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 5. Desglose de Totales (Subtotal, IGV, Total exacto a la imagen) */}
              <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', color: '#4B5563' }}>
                  <span>Subtotal</span>
                  <strong>S/ {netAmount.toFixed(2)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', color: '#4B5563' }}>
                  <span>IGV (18%)</span>
                  <strong>S/ {tax.toFixed(2)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', paddingTop: '4px', borderTop: '1px stroke #E5E7EB' }}>
                  <span style={{ fontSize: '1.05rem', fontWeight: '800', color: '#111827' }}>Total</span>
                  <strong style={{ fontSize: '1.5rem', fontWeight: '900', color: '#111827' }}>
                    S/ {total.toFixed(2)}
                  </strong>
                </div>
              </div>

              {/* 6. Botón Principal Gigante Calcado a la Imagen */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  onClick={processPayment}
                  disabled={cart.length === 0}
                  style={{
                    width: '100%',
                    height: '52px',
                    borderRadius: '14px',
                    border: 'none',
                    background: cart.length === 0 ? '#E5E7EB' : '#7E1D33',
                    color: cart.length === 0 ? '#9CA3AF' : '#FFFFFF',
                    fontWeight: '800',
                    fontSize: '1rem',
                    cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: cart.length === 0 ? 'none' : '0 4px 16px rgba(126, 29, 51, 0.35)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Confirmar y Cobrar (S/ {total.toFixed(2)})
                </button>
              </div>

            </aside>
          </div>
        )}

        {activeTab === 'Caja' && (
          <div className="full-section caja-ref-view" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%', padding: '0.25rem 0 2rem 0' }}>
            
            {/* ⚪ HEADER DE CAJA (Botones Más Grandes & Bordes Minimalistas) */}
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? '0.85rem' : '0', padding: '0.6rem 0 0.5rem 0', borderBottom: '1px solid #EAECF0' }}>
              {/* Izquierda: Título y Subtítulo */}
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#101828', margin: 0, letterSpacing: '-0.3px' }}>
                  Control de Caja
                </h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.84rem', color: '#475467', fontWeight: '500' }}>
                  {isCashOpen 
                    ? `Base de apertura: S/ ${initialCash.toFixed(2)} • Control y arqueo en tiempo real`
                    : 'Caja actualmente cerrada. Inicie turno para registrar operaciones.'}
                </p>
              </div>

              {/* Derecha: Badge y Botones Más Grandes con Bordes Minimalistas */}
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.85rem', width: isMobile ? '100%' : 'auto' }}>
                <span style={{ 
                  background: isCashOpen ? '#ECFDF5' : '#FEF2F2', 
                  color: isCashOpen ? '#027A48' : '#B42318', 
                  border: `1px solid ${isCashOpen ? '#ABEFC6' : '#FECDCA'}`,
                  padding: '7px 15px', 
                  borderRadius: '20px', 
                  fontSize: '0.84rem', 
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '7px'
                }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: isCashOpen ? '#12B76A' : '#F04438' }}></span>
                  {isCashOpen ? 'Caja Abierta' : 'Caja Cerrada'}
                </span>

                {!isCashOpen ? (
                  <button 
                    onClick={() => setShowOpenCashModal(true)} 
                    style={{ 
                      background: '#101828', 
                      color: '#FFFFFF', 
                      border: 'none', 
                      padding: '10px 20px', 
                      borderRadius: '12px', 
                      fontSize: '0.88rem', 
                      fontWeight: '800', 
                      cursor: 'pointer', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px',
                      boxShadow: '0 2px 6px rgba(16, 24, 40, 0.12)',
                      transition: 'all 0.15s ease',
                      flex: isMobile ? 1 : 'none',
                      justifyContent: 'center'
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
                    <span>Abrir Caja</span>
                  </button>
                ) : (
                  <>
                    <button 
                      onClick={() => setShowMovementsModal(true)} 
                      style={{ 
                        background: '#FFFFFF', 
                        color: '#344054', 
                        border: '1px solid #D0D5DD', 
                        padding: '10px 18px', 
                        borderRadius: '12px', 
                        fontSize: '0.88rem', 
                        fontWeight: '700', 
                        cursor: 'pointer', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px',
                        boxShadow: '0 1px 3px rgba(16, 24, 40, 0.05)',
                        transition: 'all 0.15s ease',
                        flex: isMobile ? 1 : 'none',
                        justifyContent: 'center'
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      <span>Movimientos</span>
                    </button>

                    <button 
                      onClick={() => setShowCloseCashModal(true)} 
                      style={{ 
                        background: '#D92D20', 
                        color: '#FFFFFF', 
                        border: 'none', 
                        padding: '10px 20px', 
                        borderRadius: '12px', 
                        fontSize: '0.88rem', 
                        fontWeight: '800', 
                        cursor: 'pointer', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px',
                        boxShadow: '0 2px 6px rgba(217, 45, 32, 0.2)',
                        transition: 'all 0.15s ease',
                        flex: isMobile ? 1 : 'none',
                        justifyContent: 'center'
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      <span>Cerrar Caja</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* ⚪ TOP GRID 4 CARDS (Identico a la imagen de referencia) */}
            <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? 'repeat(4, 1fr)' : (isTablet ? 'repeat(2, 1fr)' : '1fr'), gap: '1.1rem' }}>
              
              {/* Card 1: Dinero en Caja / Earning Today */}
              <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #EAECF0', padding: '1.2rem 1.4rem', display: 'flex', flexDirection: 'column', gap: '0.9rem', boxShadow: '0 1px 3px rgba(16, 24, 40, 0.03)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4B5563' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                    </div>
                    <span style={{ fontSize: '0.88rem', fontWeight: '600', color: '#374151' }}>Dinero en Caja</span>
                  </div>
                  <span style={{ color: '#9CA3AF', cursor: 'pointer', fontWeight: 'bold' }}>⋮</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#111827', letterSpacing: '-0.5px' }}>
                    S/ {dineroEsperadoCaja.toFixed(2)}
                  </div>
                  <span style={{ background: '#DCFCE7', color: '#15803D', fontSize: '0.74rem', fontWeight: '700', padding: '3px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    ↗ En vivo
                  </span>
                </div>
              </div>

              {/* Card 2: Caja Inicial / Total Purchase */}
              <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #EAECF0', padding: '1.2rem 1.4rem', display: 'flex', flexDirection: 'column', gap: '0.9rem', boxShadow: '0 1px 3px rgba(16, 24, 40, 0.03)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4B5563' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    </div>
                    <span style={{ fontSize: '0.88rem', fontWeight: '600', color: '#374151' }}>Caja Inicial</span>
                  </div>
                  <span style={{ color: '#9CA3AF', cursor: 'pointer', fontWeight: 'bold' }}>⋮</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#111827', letterSpacing: '-0.5px' }}>
                    S/ {initialCash.toFixed(2)}
                  </div>
                  <span style={{ background: '#DCFCE7', color: '#15803D', fontSize: '0.74rem', fontWeight: '700', padding: '3px 8px', borderRadius: '6px' }}>
                    Base apertura
                  </span>
                </div>
              </div>

              {/* Card 3: Ventas de Hoy / Total Sales */}
              <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #EAECF0', padding: '1.2rem 1.4rem', display: 'flex', flexDirection: 'column', gap: '0.9rem', boxShadow: '0 1px 3px rgba(16, 24, 40, 0.03)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4B5563' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M23 6l-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/></svg>
                    </div>
                    <span style={{ fontSize: '0.88rem', fontWeight: '600', color: '#374151' }}>Ventas del Día</span>
                  </div>
                  <span style={{ color: '#9CA3AF', cursor: 'pointer', fontWeight: 'bold' }}>⋮</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#111827', letterSpacing: '-0.5px' }}>
                    S/ {salaVentaHoy.toFixed(2)}
                  </div>
                  <span style={{ background: '#DCFCE7', color: '#15803D', fontSize: '0.74rem', fontWeight: '700', padding: '3px 8px', borderRadius: '6px' }}>
                    ↗ Total cobrado
                  </span>
                </div>
              </div>

              {/* Card 4: Pedidos de Hoy / Total Discount */}
              <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #EAECF0', padding: '1.2rem 1.4rem', display: 'flex', flexDirection: 'column', gap: '0.9rem', boxShadow: '0 1px 3px rgba(16, 24, 40, 0.03)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4B5563' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
                    </div>
                    <span style={{ fontSize: '0.88rem', fontWeight: '600', color: '#374151' }}>Pedidos de Hoy</span>
                  </div>
                  <span style={{ color: '#9CA3AF', cursor: 'pointer', fontWeight: 'bold' }}>⋮</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#111827', letterSpacing: '-0.5px' }}>
                    {todayPaidSales.length} <span style={{ fontSize: '0.9rem', color: '#6B7280', fontWeight: '500' }}>órdenes</span>
                  </div>
                  <span style={{ background: '#DCFCE7', color: '#15803D', fontSize: '0.74rem', fontWeight: '700', padding: '3px 8px', borderRadius: '6px' }}>
                    ↗ En turno
                  </span>
                </div>
              </div>

            </div>

            {/* ⚪ MAIN SECTION (65% Transaction Overview / 35% Top Purchase Categories) */}
            <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? '1.8fr 1fr' : '1fr', gap: '1.25rem' }}>
              
              {/* Left Column (65%): Transaction Overview Line Chart & Movimientos */}
              <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #EAECF0', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem', boxShadow: '0 1px 3px rgba(16, 24, 40, 0.03)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4B5563' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                    </div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#111827', margin: 0 }}>
                      Resumen de Transacciones
                    </h3>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      onClick={() => setMovSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                      title="Cambiar orden cronológico"
                      style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '5px 12px', fontSize: '0.78rem', fontWeight: '700', color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}
                    >
                      <span>Ordenar {movSortOrder === 'desc' ? '↓' : '↑'}</span>
                    </button>
                    <button 
                      onClick={() => setShowMovementsModal(true)}
                      title="Registrar o filtrar movimientos"
                      style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '5px 12px', fontSize: '0.78rem', fontWeight: '700', color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}
                    >
                      <span>Filtrar ⇆</span>
                    </button>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                    <span style={{ fontSize: '1.85rem', fontWeight: '800', color: '#111827', letterSpacing: '-0.5px' }}>
                      S/ {salaVentaHoy.toFixed(2)}
                    </span>
                    <span style={{ 
                      background: salaVentaHoy > 0 ? '#DCFCE7' : '#F3F4F6', 
                      color: salaVentaHoy > 0 ? '#15803D' : '#6B7280', 
                      fontSize: '0.76rem', 
                      fontWeight: '700', 
                      padding: '3px 8px', 
                      borderRadius: '6px' 
                    }}>
                      {salaVentaHoy > 0 ? '↗ En crecimiento' : 'Sin ventas registradas'}
                    </span>
                  </div>
                </div>

                {/* Line Chart con Datos Reales Dinámicos */}
                <div style={{ height: '200px', position: 'relative' }}>
                  {(() => {
                    const hours = [
                      { label: 'Apertura', hour: 8 },
                      { label: '10 AM', hour: 10 },
                      { label: '12 PM', hour: 12 },
                      { label: '02 PM', hour: 14 },
                      { label: '04 PM', hour: 16 },
                      { label: '06 PM', hour: 18 },
                      { label: '08 PM', hour: 20 },
                      { label: 'Cierre', hour: 23 }
                    ];

                    const salesPoints = hours.map(h => {
                      return todayPaidSales.reduce((acc, sale) => {
                        const saleDate = new Date(sale.timestamp || sale.date || sale.createdAt || Date.now());
                        if (saleDate.getHours() <= h.hour) {
                          return acc + (parseFloat(sale.total) || 0);
                        }
                        return acc;
                      }, 0);
                    });

                    const cashPoints = hours.map(h => {
                      let cash = initialCash;
                      todayPaidSales.forEach(s => {
                        if (s.paymentMethod === 'Efectivo' || s.paymentMethod === 'cash') {
                          const d = new Date(s.timestamp || s.date || s.createdAt || Date.now());
                          if (d.getHours() <= h.hour) {
                            cash += (parseFloat(s.total) || 0);
                          }
                        }
                      });
                      cashMovements.forEach(m => {
                        const d = new Date(m.date || Date.now());
                        if (d.getHours() <= h.hour) {
                          if (m.type === 'ingreso') cash += (parseFloat(m.amount) || 0);
                          if (m.type === 'egreso') cash -= (parseFloat(m.amount) || 0);
                        }
                      });
                      return cash;
                    });

                    return (
                      <Line 
                        data={{
                          labels: hours.map(h => h.label),
                          datasets: [
                            {
                              label: 'Ventas Totales (S/)',
                              data: salesPoints,
                              borderColor: '#2563EB',
                              backgroundColor: 'rgba(37, 99, 235, 0.08)',
                              fill: true,
                              tension: 0.3,
                              pointRadius: 4,
                              pointBackgroundColor: '#2563EB'
                            },
                            {
                              label: 'Efectivo en Caja (S/)',
                              data: cashPoints,
                              borderColor: '#06B6D4',
                              backgroundColor: 'rgba(6, 182, 212, 0.05)',
                              fill: true,
                              tension: 0.3,
                              pointRadius: 3,
                              pointBackgroundColor: '#06B6D4'
                            }
                          ]
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: { 
                            legend: { display: false },
                            tooltip: {
                              callbacks: {
                                label: (ctx) => `${ctx.dataset.label}: S/ ${ctx.parsed.y.toFixed(2)}`
                              }
                            }
                          },
                          scales: {
                            x: { grid: { display: false }, ticks: { font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 } } },
                            y: { 
                              beginAtZero: true, 
                              grid: { color: '#F3F4F6' }, 
                              ticks: { 
                                font: { family: "'Plus Jakarta Sans', sans-serif", size: 10 },
                                callback: (v) => `S/ ${v}`
                              } 
                            }
                          }
                        }}
                      />
                    );
                  })()}
                </div>

                {/* Lista de Movimientos en Turno */}
                <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#111827' }}>Historial de Movimientos</span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {['Todos', 'Ingresos', 'Egresos', 'Ventas'].map(f => (
                        <button
                          key={f}
                          onClick={() => setCashMovFilter(f)}
                          style={{
                            background: cashMovFilter === f ? '#111827' : 'transparent',
                            color: cashMovFilter === f ? '#FFFFFF' : '#6B7280',
                            border: 'none',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '0.72rem',
                            fontWeight: '700',
                            cursor: 'pointer'
                          }}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', maxHeight: '240px', overflowY: 'auto' }}>
                    {(() => {
                      // Consolidar movimientos manuales y ventas cobradas para mostrar platillos en detalle
                      const salesAsMovs = todayPaidSales.map(s => ({
                        id: `SALE-${s.id}`,
                        type: 'venta',
                        description: `Venta ${s.id} — Mesa ${s.table || 'General'}`,
                        amount: s.total,
                        paymentMethod: s.paymentMethod,
                        date: s.timestamp || s.date || new Date().toISOString(),
                        items: s.items || []
                      }));

                      const combinedList = [...cashMovements, ...salesAsMovs.filter(s => !cashMovements.some(m => m.saleId === s.id.replace('SALE-', '')))]
                        .sort((a, b) => {
                          const tA = new Date(a.date || 0).getTime();
                          const tB = new Date(b.date || 0).getTime();
                          return movSortOrder === 'asc' ? tA - tB : tB - tA;
                        });

                      const filteredList = combinedList.filter(m => {
                        if (cashMovFilter === 'Ingresos') return m.type === 'ingreso';
                        if (cashMovFilter === 'Egresos') return m.type === 'egreso';
                        if (cashMovFilter === 'Ventas') return m.type === 'venta';
                        return true;
                      });

                      if (filteredList.length === 0) {
                        return (
                          <div style={{ fontSize: '0.78rem', color: '#9CA3AF', padding: '1rem 0', textAlign: 'center' }}>
                            Sin movimientos ni ventas registradas.
                          </div>
                        );
                      }

                      return filteredList.map((mov) => {
                        const isEgreso = mov.type === 'egreso';
                        const itemsSummary = mov.items && mov.items.length > 0
                          ? mov.items.map(i => `${i.quantity}x ${i.name}`).join(', ')
                          : null;

                        return (
                          <div 
                            key={mov.id} 
                            style={{ 
                              display: 'flex', 
                              justify: 'space-between', 
                              alignItems: 'center', 
                              padding: '0.65rem 0.85rem', 
                              background: '#F9FAFB', 
                              borderRadius: '8px', 
                              border: '1px solid #EAECF0', 
                              fontSize: '0.8rem' 
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, paddingRight: '10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <strong style={{ color: '#111827', fontWeight: '700', fontSize: '0.82rem' }}>
                                  {mov.description}
                                </strong>
                                {mov.paymentMethod && (
                                  <span style={{ fontSize: '0.7rem', color: '#374151', background: '#E5E7EB', padding: '1px 6px', borderRadius: '4px', fontWeight: '600' }}>
                                    {mov.paymentMethod}
                                  </span>
                                )}
                              </div>
                              
                              {/* 🍱 Detalle explícito de los productos que se están vendiendo */}
                              {itemsSummary ? (
                                <div style={{ fontSize: '0.76rem', color: '#0F172A', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <span style={{ color: '#B84A62', fontWeight: '800' }}>Vendido:</span> {itemsSummary}
                                </div>
                              ) : null}

                              <span style={{ fontSize: '0.71rem', color: '#6B7280' }}>
                                {new Date(mov.date).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>

                            <strong style={{ color: isEgreso ? '#DC2626' : '#16A34A', fontSize: '0.9rem', fontWeight: '800', whiteSpace: 'nowrap' }}>
                              {isEgreso ? '-' : '+'} S/ {mov.amount.toFixed(2)}
                            </strong>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

              </div>

              {/* Right Column (35%): Top Purchase Categories / Cobros por Método de Pago */}
              <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #EAECF0', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem', boxShadow: '0 1px 3px rgba(16, 24, 40, 0.03)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4B5563' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                    </div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: '#111827', margin: 0 }}>
                      Métodos de Pago
                    </h3>
                  </div>
                  <button 
                    onClick={() => setCashMovFilter(prev => prev === 'Ventas' ? 'Todos' : 'Ventas')}
                    style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '5px 12px', fontSize: '0.78rem', fontWeight: '700', color: '#374151', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}
                  >
                    Filtrar ⇆
                  </button>
                </div>

                {/* Doughnut Chart con Total en el Centro (Exacto a la imagen) */}
                <div style={{ position: 'relative', height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Doughnut 
                    data={{
                      labels: ['Efectivo', 'Yape', 'Plin', 'Tarjeta'],
                      datasets: [
                        {
                          data: [paymentBreakdown.cash || 1, paymentBreakdown.yape, paymentBreakdown.plin, paymentBreakdown.debit + paymentBreakdown.credit],
                          backgroundColor: ['#06B6D4', '#F59E0B', '#8B5CF6', '#4F46E5'],
                          borderWidth: 3,
                          borderColor: '#FFFFFF'
                        }
                      ]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      cutout: '72%',
                      plugins: { legend: { display: false } }
                    }}
                  />
                  <div style={{ position: 'absolute', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#111827' }}>
                      S/ {salaVentaHoy.toFixed(2)}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#6B7280', fontWeight: '600' }}>
                      Total del día
                    </div>
                  </div>
                </div>

                {/* Grid 2x2 de Estadísticas por Método de Pago */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', paddingTop: '0.5rem', borderTop: '1px dashed #E5E7EB' }}>
                  
                  {/* Efectivo */}
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#06B6D4', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#06B6D4' }}></span>
                      Efectivo
                    </div>
                    <div style={{ fontSize: '0.98rem', fontWeight: '800', color: '#111827', marginTop: '2px' }}>
                      S/ {paymentBreakdown.cash.toFixed(2)}
                    </div>
                  </div>

                  {/* Yape */}
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#F59E0B', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#F59E0B' }}></span>
                      Yape
                    </div>
                    <div style={{ fontSize: '0.98rem', fontWeight: '800', color: '#111827', marginTop: '2px' }}>
                      S/ {paymentBreakdown.yape.toFixed(2)}
                    </div>
                  </div>

                  {/* Plin */}
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#8B5CF6', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#8B5CF6' }}></span>
                      Plin
                    </div>
                    <div style={{ fontSize: '0.98rem', fontWeight: '800', color: '#111827', marginTop: '2px' }}>
                      S/ {paymentBreakdown.plin.toFixed(2)}
                    </div>
                  </div>

                  {/* Tarjeta */}
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#4F46E5', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4F46E5' }}></span>
                      Tarjeta
                    </div>
                    <div style={{ fontSize: '0.98rem', fontWeight: '800', color: '#111827', marginTop: '2px' }}>
                      S/ {(paymentBreakdown.debit + paymentBreakdown.credit).toFixed(2)}
                    </div>
                  </div>

                </div>

              </div>

            </div>

          </div>
        )}

        {activeTab === 'Gráficos' && (
          <div className="full-section reportes-view" style={{ fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
            
            {/* Cabecera del Dashboard */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div>
                <h2 style={{ fontSize: '1.8rem', fontWeight: '800', color: '#1D2433', margin: 0, fontFamily: "'Inter', sans-serif" }}>Dashboard</h2>
              </div>
              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', padding: '6px 14px', borderRadius: '10px', fontSize: '0.85rem', color: '#4A5568', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#718096' }}><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                  <span>Oct 18 - Nov 18</span>
                </div>
                <select style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', padding: '6px 14px', borderRadius: '10px', fontSize: '0.85rem', color: '#4A5568', fontWeight: '500', cursor: 'pointer' }}>
                  <option>Monthly</option>
                  <option>Weekly</option>
                  <option>Daily</option>
                </select>
                <button style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', padding: '6px 14px', borderRadius: '10px', fontSize: '0.85rem', color: '#4A5568', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
                  Filter
                </button>
                <button style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', padding: '6px 14px', borderRadius: '10px', fontSize: '0.85rem', color: '#4A5568', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                  Export
                </button>
              </div>
            </div>

            {/* Fila de KPIs (Page Views, Total Revenue, Bounce Rate) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
              
              {/* Page Views */}
              <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.8rem', boxShadow: '0 4px 10px rgba(0,0,0,0.01)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#718096' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                    <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>Page Views</span>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ cursor: 'pointer' }}><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '2rem', fontWeight: '800', color: '#1D2433' }}>12,450</span>
                  <span style={{ background: '#DEF7EC', color: '#03543F', padding: '4px 8px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '2px' }}>
                    15.8% ↗
                  </span>
                </div>
              </div>

              {/* Total Revenue */}
              <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.8rem', boxShadow: '0 4px 10px rgba(0,0,0,0.01)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#718096' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></svg>
                    <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>Total Revenue</span>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ cursor: 'pointer' }}><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '2rem', fontWeight: '800', color: '#1D2433' }}>S/ {todayStats.totalAmount.toFixed(2)}</span>
                  <span style={{ background: '#FDE8E8', color: '#9B1C1C', padding: '4px 8px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '2px' }}>
                    3.4% ↘
                  </span>
                </div>
              </div>

              {/* Bounce Rate */}
              <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.8rem', boxShadow: '0 4px 10px rgba(0,0,0,0.01)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#718096' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
                    <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>Ticket Promedio</span>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ cursor: 'pointer' }}><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '2rem', fontWeight: '800', color: '#1D2433' }}>S/ {todayStats.averageTicket.toFixed(2)}</span>
                  <span style={{ background: '#DEF7EC', color: '#03543F', padding: '4px 8px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '2px' }}>
                    24.2% ↗
                  </span>
                </div>
              </div>

            </div>

            {/* Fila del Medio: Sales Overview & Total Subscriber */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1.5rem' }}>
              
              {/* Sales Overview */}
              <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '24px', padding: '1.8rem', display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: '0 8px 24px rgba(0,0,0,0.01)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ color: '#718096', fontSize: '0.85rem', fontWeight: '600' }}>Ventas Totales</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                      <strong style={{ fontSize: '1.8rem', color: '#1D2433' }}>S/ {(todayStats.totalAmount * 1.5).toFixed(2)}</strong>
                      <span style={{ color: '#10B981', fontSize: '0.8rem', fontWeight: 'bold' }}>15.8% ↗</span>
                      <span style={{ color: '#718096', fontSize: '0.8rem' }}>+ S/ {todayStats.totalAmount.toFixed(2)} increased</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer', color: '#4A5568', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
                      Filter
                    </button>
                    <button style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer', color: '#4A5568' }}>⇅ Sort</button>
                  </div>
                </div>

                <div style={{ height: '240px', position: 'relative' }}>
                  <Bar 
                    data={{
                      labels: ['Oct', 'Nov', 'Dec'],
                      datasets: [
                        { label: 'Efectivo', data: [2988.20, 1765.09, 4005.65], backgroundColor: '#4F46E5', borderRadius: 4, barThickness: 28 },
                        { label: 'Tarjeta', data: [1988.20, 1165.09, 2805.65], backgroundColor: '#818CF8', borderRadius: 4, barThickness: 28 },
                        { label: 'Yape', data: [1288.20, 965.09, 1905.65], backgroundColor: '#3B82F6', borderRadius: 4, barThickness: 28 },
                        { label: 'Plin', data: [988.20, 665.09, 1205.65], backgroundColor: '#06B6D4', borderRadius: 4, barThickness: 28 },
                        { label: 'Otros', data: [588.20, 365.09, 805.65], backgroundColor: '#22D3EE', borderRadius: 4, barThickness: 28 },
                      ]
                    }} 
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                      scales: {
                        x: { stacked: true, grid: { display: false } },
                        y: { stacked: true, grid: { color: '#F1F5F9' } }
                      }
                    }} 
                  />
                </div>

                {/* Leyenda personalizada */}
                <div style={{ display: 'flex', gap: '1.2rem', justifyContent: 'center', fontSize: '0.8rem', color: '#718096', marginTop: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4F46E5' }}></span>Efectivo</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#818CF8' }}></span>Tarjeta</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3B82F6' }}></span>Yape</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#06B6D4' }}></span>Plin</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22D3EE' }}></span>Otros</div>
                </div>
              </div>

              {/* Total Subscriber */}
              <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '24px', padding: '1.8rem', display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: '0 8px 24px rgba(0,0,0,0.01)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ color: '#718096', fontSize: '0.85rem', fontWeight: '600' }}>Total Clientes</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                      <strong style={{ fontSize: '1.8rem', color: '#1D2433' }}>24,473</strong>
                      <span style={{ color: '#10B981', fontSize: '0.8rem', fontWeight: 'bold' }}>8.3% ↗</span>
                    </div>
                  </div>
                  <select style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', padding: '4px 10px', borderRadius: '8px', fontSize: '0.8rem', color: '#4A5568', cursor: 'pointer' }}>
                    <option>Weekly</option>
                    <option>Monthly</option>
                  </select>
                </div>

                <div style={{ height: '240px', position: 'relative' }}>
                  <Bar 
                    data={{
                      labels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
                      datasets: [
                        {
                          data: [1200, 2400, 3874, 1800, 2900, 2100, 3100],
                          backgroundColor: ['#E2E8F0', '#E2E8F0', '#4F46E5', '#E2E8F0', '#E2E8F0', '#E2E8F0', '#E2E8F0'],
                          borderRadius: 8,
                          barThickness: 22
                        }
                      ]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                      scales: {
                        x: { grid: { display: false } },
                        y: { grid: { display: false }, ticks: { display: false } }
                      }
                    }}
                  />
                </div>
              </div>

            </div>

            {/* Fila Inferior: Sales Distribution & List of Integration */}
            <div style={{ display: 'grid', gridTemplateColumns: '0.8fr 1.2fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
              
              {/* Sales Distribution */}
              <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '24px', padding: '1.8rem', display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: '0 8px 24px rgba(0,0,0,0.01)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#718096', fontSize: '0.85rem', fontWeight: '600' }}>Distribución de Ventas</span>
                  <select style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', padding: '4px 10px', borderRadius: '8px', fontSize: '0.8rem', color: '#4A5568', cursor: 'pointer' }}>
                    <option>Monthly</option>
                  </select>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: '0.8rem', color: '#718096', margin: '0.5rem 0' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4F46E5' }}></span>Website</div>
                    <strong style={{ fontSize: '1rem', color: '#1D2433', display: 'block', marginTop: '2px' }}>S/ 374.82</strong>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#06B6D4' }}></span>Mobile App</div>
                    <strong style={{ fontSize: '1rem', color: '#1D2433', display: 'block', marginTop: '2px' }}>S/ 241.60</strong>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#E2E8F0' }}></span>Other</div>
                    <strong style={{ fontSize: '1rem', color: '#1D2433', display: 'block', marginTop: '2px' }}>S/ 213.42</strong>
                  </div>
                </div>

                <div style={{ height: '170px', position: 'relative', display: 'flex', justifyContent: 'center' }}>
                  <div style={{ width: '170px', height: '170px' }}>
                    <Doughnut 
                      data={{
                        labels: ['Website', 'Mobile App', 'Other'],
                        datasets: [
                          {
                            data: [374.82, 241.60, 213.42],
                            backgroundColor: ['#4F46E5', '#06B6D4', '#E2E8F0'],
                            borderWidth: 0
                          }
                        ]
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: '70%',
                        plugins: { legend: { display: false } }
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* List of Integration */}
              <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '24px', padding: '1.8rem', display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: '0 8px 24px rgba(0,0,0,0.01)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: '0.8rem' }}>
                  <span style={{ color: '#718096', fontSize: '0.85rem', fontWeight: '600' }}>Canales & Métodos</span>
                  <span style={{ color: '#4F46E5', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer' }}>See All</span>
                </div>
                
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ color: '#718096', borderBottom: '1px solid #F1F5F9', textAlign: 'left' }}>
                      <th style={{ padding: '8px 0', fontWeight: '600' }}>APPLICATION</th>
                      <th style={{ padding: '8px 0', fontWeight: '600' }}>TYPE</th>
                      <th style={{ padding: '8px 0', fontWeight: '600' }}>RATE</th>
                      <th style={{ padding: '8px 0', fontWeight: '600', textAlign: 'right' }}>PROFIT</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '12px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input type="checkbox" defaultChecked style={{ accentColor: '#4F46E5' }} />
                        <span style={{ background: '#EEF2FF', padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>
                        </span>
                        <strong style={{ color: '#1D2433' }}>Stripe</strong>
                      </td>
                      <td style={{ padding: '12px 0', color: '#718096' }}>Finance</td>
                      <td style={{ padding: '12px 0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '80px', height: '6px', background: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: '40%', height: '100%', background: '#4F46E5', borderRadius: '3px' }}></div>
                          </div>
                          <span style={{ fontSize: '0.78rem', color: '#718096' }}>40%</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: '700', color: '#1D2433' }}>S/ 650.00</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '12px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input type="checkbox" defaultChecked style={{ accentColor: '#4F46E5' }} />
                        <span style={{ background: '#FFF7ED', padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EA580C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                        </span>
                        <strong style={{ color: '#1D2433' }}>Zapier</strong>
                      </td>
                      <td style={{ padding: '12px 0', color: '#718096' }}>CRM</td>
                      <td style={{ padding: '12px 0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '80px', height: '6px', background: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: '80%', height: '100%', background: '#4F46E5', borderRadius: '3px' }}></div>
                          </div>
                          <span style={{ fontSize: '0.78rem', color: '#718096' }}>80%</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: '700', color: '#1D2433' }}>S/ 720.50</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '12px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input type="checkbox" defaultChecked style={{ accentColor: '#4F46E5' }} />
                        <span style={{ background: '#ECFDF5', padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
                        </span>
                        <strong style={{ color: '#1D2433' }}>Shopify</strong>
                      </td>
                      <td style={{ padding: '12px 0', color: '#718096' }}>Marketplace</td>
                      <td style={{ padding: '12px 0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '80px', height: '6px', background: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: '20%', height: '100%', background: '#4F46E5', borderRadius: '3px' }}></div>
                          </div>
                          <span style={{ fontSize: '0.78rem', color: '#718096' }}>20%</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: '700', color: '#1D2433' }}>S/ 432.25</td>
                    </tr>
                  </tbody>
                </table>
              </div>

            </div>

          </div>
        )}

        {activeTab === 'Historial' && (
          <div className="full-section history-view" style={{ background: '#F8FAFC', borderRadius: '24px', padding: '2rem', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            
            {/* Cabecera */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ color: '#0F172A', margin: 0, fontSize: '1.8rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF5500" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                  Historial
                </h2>
                <p style={{ color: '#64748B', margin: '4px 0 0 0', fontSize: '0.88rem' }}>Registro de transacciones, ventas y auditorías de cierre de caja</p>
              </div>
            </div>

            {/* Pestañas de Navegación del Historial */}
            <div style={{ display: 'flex', gap: '2rem', borderBottom: '1px solid #E2E8F0', marginBottom: '1.5rem', paddingBottom: '0.5rem' }}>
              <span 
                onClick={() => setHistorySubTab('ventas')}
                style={{ 
                  fontSize: '0.95rem', 
                  fontWeight: '700', 
                  color: historySubTab === 'ventas' ? '#FF5500' : '#94A3B8', 
                  borderBottom: historySubTab === 'ventas' ? '3px solid #FF5500' : 'none', 
                  paddingBottom: '0.5rem', 
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                Historial de Ventas ({salesHistory.length})
              </span>

              <span 
                onClick={() => setHistorySubTab('cierres')}
                style={{ 
                  fontSize: '0.95rem', 
                  fontWeight: '700', 
                  color: historySubTab === 'cierres' ? '#FF5500' : '#94A3B8', 
                  borderBottom: historySubTab === 'cierres' ? '3px solid #FF5500' : 'none', 
                  paddingBottom: '0.5rem', 
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                Historial de Cierres de Caja ({cashClosureHistory.length})
              </span>
            </div>

            {/* Barra de Filtros Minimalista */}
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div style={{ position: 'relative', width: '320px' }}>
                <input
                  type="text"
                  placeholder={historySubTab === 'ventas' ? "Buscar por N° Pedido, cliente o mesa..." : "Buscar por cajero o código de cierre..."}
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem 1rem 0.65rem 2.4rem', borderRadius: '30px', border: '1px solid #E2E8F0', background: '#FFFFFF', fontSize: '0.88rem', outline: 'none', color: '#1E293B' }}
                />
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.5" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </div>

              {historySubTab === 'ventas' && (
                <select 
                  value={historyMethodFilter} 
                  onChange={(e) => setHistoryMethodFilter(e.target.value)}
                  style={{ padding: '0.65rem 1.2rem', borderRadius: '30px', border: '1px solid #E2E8F0', background: '#FFFFFF', fontSize: '0.88rem', color: '#475569', cursor: 'pointer', outline: 'none' }}
                >
                  <option value="Todos">Todos los Métodos</option>
                  <option value="Efectivo">Efectivo</option>
                  <option value="Tarjeta Débito">Tarjeta Débito</option>
                  <option value="Tarjeta Crédito">Tarjeta Crédito</option>
                  <option value="Yape">Yape</option>
                  <option value="Plin">Plin</option>
                </select>
              )}

              <button 
                onClick={() => { setHistorySearch(''); setHistoryMethodFilter('Todos'); }}
                style={{ padding: '0.65rem 1.2rem', borderRadius: '30px', border: 'none', background: '#64748B', color: '#FFFFFF', fontSize: '0.85rem', fontWeight: '700', cursor: 'pointer' }}
              >
                Restablecer
              </button>
            </div>

            {/* TAB 1: HISTORIAL DE VENTAS */}
            {historySubTab === 'ventas' && (
              <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '0.5rem' }}>
                <div style={{ minWidth: '950px' }}>
                  {/* Header Labels */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1.2fr 1.8fr 1fr 1fr 1fr 140px', gap: '1rem', padding: '0 1.25rem 0.6rem 1.25rem', fontSize: '0.78rem', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    <span>N° Pedido</span>
                    <span>Fecha / Hora</span>
                    <span>Mesa / Tipo</span>
                    <span>Detalle Productos</span>
                    <span>Método</span>
                    <span>Monto Total</span>
                    <span>Estado</span>
                    <span style={{ textAlign: 'right' }}>Acciones</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {salesHistory.filter(s => {
                      const matchSearch = s.id.toLowerCase().includes(historySearch.toLowerCase()) || 
                        (s.clientName || '').toLowerCase().includes(historySearch.toLowerCase()) || 
                        (s.table || '').toString().includes(historySearch);
                      const matchMethod = historyMethodFilter === 'Todos' || s.paymentMethod === historyMethodFilter;
                      return matchSearch && matchMethod;
                    }).length === 0 ? (
                      <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '3rem', textAlign: 'center', color: '#94A3B8', border: '1px solid #E2E8F0' }}>
                        No hay registros de ventas que coincidan con la búsqueda.
                      </div>
                    ) : (
                      salesHistory.filter(s => {
                        const matchSearch = s.id.toLowerCase().includes(historySearch.toLowerCase()) || 
                          (s.clientName || '').toLowerCase().includes(historySearch.toLowerCase()) || 
                          (s.table || '').toString().includes(historySearch);
                        const matchMethod = historyMethodFilter === 'Todos' || s.paymentMethod === historyMethodFilter;
                        return matchSearch && matchMethod;
                      }).map((sale) => {
                        const displaySale = {
                          ...sale,
                          createdAt: sale.createdAt || sale.timestamp,
                          receiptType: sale.receiptType || (sale.saved ? 'ORDEN GUARDADA' : sale.kitchen ? 'ORDEN COCINA' : 'BOLETA'),
                          clientDocumentType: sale.clientDocumentType || 'DNI',
                          businessName: sale.businessName || 'SHARI SUSHI',
                          businessRUC: sale.businessRUC || '20-123456789',
                          businessPhone: sale.businessPhone || '555-1234',
                          verificationCode: sale.verificationCode || 'N/A',
                        };
                        const itemsSummary = sale.items.map(i => `${i.quantity}x ${i.name}`).join(', ');

                        return (
                          <div 
                            key={sale.id}
                            style={{ 
                              background: '#FFFFFF', 
                              borderRadius: '16px', 
                              padding: '1rem 1.25rem', 
                              display: 'grid', 
                              gridTemplateColumns: '1.2fr 1.2fr 1.2fr 1.8fr 1fr 1fr 1fr 140px', 
                              gap: '1rem', 
                              alignItems: 'center',
                              border: '1px solid #F1F5F9',
                              boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                            }}
                          >
                            {/* N° Pedido */}
                            <strong style={{ fontSize: '0.9rem', color: '#0F172A' }}>{sale.id}</strong>

                            {/* Fecha / Hora */}
                            <span style={{ fontSize: '0.82rem', color: '#64748B' }}>
                              {new Date(sale.timestamp).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}
                            </span>

                            {/* Mesa / Cliente */}
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '0.88rem', fontWeight: '700', color: '#1E293B' }}>Mesa {sale.table}</span>
                              <span style={{ fontSize: '0.78rem', color: '#94A3B8' }}>{sale.clientName || 'Cliente General'}</span>
                            </div>

                            {/* Detalle */}
                            <span style={{ fontSize: '0.82rem', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={itemsSummary}>
                              {itemsSummary}
                            </span>

                            {/* Método de Pago */}
                            <div>
                              <span style={{ background: '#F1F5F9', color: '#334155', fontSize: '0.78rem', fontWeight: '700', padding: '4px 10px', borderRadius: '20px' }}>
                                {sale.paymentMethod}
                              </span>
                            </div>

                            {/* Monto Total */}
                            <strong style={{ fontSize: '0.95rem', color: '#10B981', fontWeight: '800' }}>
                              S/ {sale.total.toFixed(2)}
                            </strong>

                            {/* Estado */}
                            <div>
                              <span style={{ 
                                background: sale.verified ? '#ECFDF5' : '#FEF3C7', 
                                color: sale.verified ? '#059669' : '#D97706', 
                                fontSize: '0.75rem', 
                                fontWeight: '800', 
                                padding: '3px 8px', 
                                borderRadius: '12px' 
                              }}>
                                {sale.verified ? 'VERIFICADO' : 'PENDIENTE'}
                              </span>
                            </div>

                            {/* Acciones */}
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                              {!sale.verified && (
                                <button 
                                  onClick={() => verifySale(sale.id)} 
                                  style={{ background: '#059669', color: '#FFF', border: 'none', padding: '5px 8px', borderRadius: '8px', fontSize: '0.74rem', fontWeight: '700', cursor: 'pointer' }}
                                >
                                  Verificar
                                </button>
                              )}
                              <button 
                                title="Ver Recibo"
                                onClick={() => setViewingReceipt(displaySale)} 
                                style={{ background: '#F1F5F9', color: '#475569', border: '1px solid #CBD5E0', padding: '5px 8px', borderRadius: '8px', fontSize: '0.74rem', fontWeight: '700', cursor: 'pointer' }}
                              >
                                Recibo
                              </button>
                              <button
                                title="Editar Venta"
                                onClick={() => setEditingSale(sale)}
                                style={{ width: '28px', height: '28px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#FFFFFF', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                              </button>
                              <button
                                title="Eliminar Venta"
                                onClick={() => {
                                  if (confirm(`¿Eliminar la venta ${sale.id}?`)) {
                                    setSalesHistory(prev => prev.filter(s => s.id !== sale.id));
                                    SalesService.deleteSale(sale.id).catch(e => console.warn('BD delete sale err:', e));
                                  }
                                }}
                                style={{ width: '28px', height: '28px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#FFFFFF', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: HISTORIAL DE CIERRES DE CAJA */}
            {historySubTab === 'cierres' && (
              <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '0.5rem' }}>
                <div style={{ minWidth: '980px' }}>
                  {/* Header Labels */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.3fr 1.3fr 1fr 1fr 1.2fr 1.2fr 1fr 110px', gap: '1rem', padding: '0 1.25rem 0.6rem 1.25rem', fontSize: '0.78rem', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    <span>N° Cierre</span>
                    <span>Fecha Cierre</span>
                    <span>Cajero Responsable</span>
                    <span>Apertura</span>
                    <span>Ventas Hoy</span>
                    <span>Esperado</span>
                    <span>Real Contado</span>
                    <span>Auditoría</span>
                    <span style={{ textAlign: 'right' }}>Acciones</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {cashClosureHistory.filter(c => 
                      c.id.toLowerCase().includes(historySearch.toLowerCase()) || 
                      c.cashier.toLowerCase().includes(historySearch.toLowerCase())
                    ).length === 0 ? (
                      <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '3rem', textAlign: 'center', color: '#94A3B8', border: '1px solid #E2E8F0' }}>
                        No se registraron cierres de caja aún.
                      </div>
                    ) : (
                      cashClosureHistory.filter(c => 
                        c.id.toLowerCase().includes(historySearch.toLowerCase()) || 
                        c.cashier.toLowerCase().includes(historySearch.toLowerCase())
                      ).map((closure) => {
                        const isExact = Math.abs(closure.difference) < 0.01;
                        const isSurplus = closure.difference > 0.01;

                        return (
                          <div 
                            key={closure.id}
                            style={{ 
                              background: '#FFFFFF', 
                              borderRadius: '16px', 
                              padding: '1rem 1.25rem', 
                              display: 'grid', 
                              gridTemplateColumns: '1.2fr 1.3fr 1.3fr 1fr 1fr 1.2fr 1.2fr 1fr 110px', 
                              gap: '1rem', 
                              alignItems: 'center',
                              border: '1px solid #F1F5F9',
                              boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                            }}
                          >
                            {/* N° Cierre */}
                            <strong style={{ fontSize: '0.9rem', color: '#0F172A' }}>{closure.id}</strong>

                            {/* Fecha */}
                            <span style={{ fontSize: '0.82rem', color: '#64748B' }}>
                              {new Date(closure.date).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}
                            </span>

                            {/* Cajero */}
                            <span style={{ fontSize: '0.88rem', fontWeight: '700', color: '#1E293B' }}>
                              {closure.cashier}
                            </span>

                            {/* Apertura */}
                            <span style={{ fontSize: '0.88rem', color: '#475569' }}>
                              S/ {closure.initialCash.toFixed(2)}
                            </span>

                            {/* Ventas Hoy */}
                            <span style={{ fontSize: '0.88rem', color: '#10B981', fontWeight: '700' }}>
                              S/ {closure.totalSales.toFixed(2)}
                            </span>

                            {/* Esperado */}
                            <span style={{ fontSize: '0.88rem', color: '#1E293B', fontWeight: '700' }}>
                              S/ {closure.expectedCash.toFixed(2)}
                            </span>

                            {/* Real Contado */}
                            <strong style={{ fontSize: '0.92rem', color: '#0F172A', fontWeight: '800' }}>
                              S/ {closure.realCash.toFixed(2)}
                            </strong>

                            {/* Estado / Cuadre */}
                            <div>
                              <span style={{ 
                                background: isExact ? '#ECFDF5' : isSurplus ? '#EFF6FF' : '#FEF2F2', 
                                color: isExact ? '#065F46' : isSurplus ? '#1E40AF' : '#991B1B', 
                                fontSize: '0.75rem', 
                                fontWeight: '800', 
                                padding: '4px 10px', 
                                borderRadius: '14px',
                                display: 'inline-block'
                              }}>
                                {isExact ? 'Cuadre Perfecto' : isSurplus ? `+ S/ ${closure.difference.toFixed(2)}` : `- S/ ${Math.abs(closure.difference).toFixed(2)}`}
                              </span>
                            </div>

                            {/* Acciones Cierre */}
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                              <button
                                title="Editar Cierre de Caja"
                                onClick={() => setEditingClosure(closure)}
                                style={{ width: '28px', height: '28px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#FFFFFF', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                              </button>
                              <button
                                title="Eliminar Cierre de Caja"
                                onClick={() => {
                                  if (confirm(`¿Eliminar el registro de cierre ${closure.id}?`)) {
                                    setCashClosureHistory(prev => prev.filter(c => c.id !== closure.id));
                                  }
                                }}
                                style={{ width: '28px', height: '28px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#FFFFFF', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Modal para Editar Registro de Venta */}
            {editingSale && (
              <div className="modal-overlay" onClick={() => setEditingSale(null)}>
                <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ background: '#FFF', borderRadius: '24px', padding: '2rem', maxWidth: '440px', width: '90%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800' }}>Editar Venta {editingSale.id}</h3>
                    <button onClick={() => setEditingSale(null)} style={{ background: '#F1F5F9', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer' }}>✕</button>
                  </div>

                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.target;
                    const name = form.saleClientName.value.trim();
                    const totalVal = parseFloat(form.saleTotal.value);
                    const method = form.saleMethod.value;

                    if (!name || isNaN(totalVal)) {
                      alert('Ingrese datos válidos');
                      return;
                    }

                    setSalesHistory(prev => prev.map(s => s.id === editingSale.id ? {
                      ...s,
                      clientName: name,
                      total: totalVal,
                      paymentMethod: method
                    } : s));
                    SalesService.updateSale(editingSale.id, { clientName: name, total: totalVal, paymentMethod: method }).catch(e => console.warn('BD update sale err:', e));

                    setEditingSale(null);
                    alert('Venta actualizada con éxito.');
                  }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#374151' }}>Cliente / Razón Social</label>
                      <input name="saleClientName" type="text" defaultValue={editingSale.clientName || 'Clientes Varios'} required style={{ padding: '0.7rem 1rem', borderRadius: '12px', border: '1px solid #CBD5E0' }} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#374151' }}>Monto Total (S/)</label>
                      <input name="saleTotal" type="number" step="0.10" min="0.10" defaultValue={editingSale.total} required style={{ padding: '0.7rem 1rem', borderRadius: '12px', border: '1px solid #CBD5E0' }} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#374151' }}>Método de Pago</label>
                      <select name="saleMethod" defaultValue={editingSale.paymentMethod || 'Efectivo'} style={{ padding: '0.7rem 1rem', borderRadius: '12px', border: '1px solid #CBD5E0', background: '#FFF' }}>
                        <option value="Efectivo">Efectivo</option>
                        <option value="Tarjeta Débito">Tarjeta Débito</option>
                        <option value="Tarjeta Crédito">Tarjeta Crédito</option>
                        <option value="Yape">Yape</option>
                        <option value="Plin">Plin</option>
                      </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
                      <button type="button" onClick={() => setEditingSale(null)} style={{ padding: '12px', borderRadius: '12px', border: '1px solid #CBD5E0', background: '#FFF', color: '#475569', fontWeight: '700' }}>Cancelar</button>
                      <button type="submit" style={{ padding: '12px', borderRadius: '12px', border: 'none', background: '#7E1D33', color: '#FFF', fontWeight: '800' }}>Guardar Cambios</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Modal para Editar Cierre de Caja */}
            {editingClosure && (
              <div className="modal-overlay" onClick={() => setEditingClosure(null)}>
                <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ background: '#FFF', borderRadius: '24px', padding: '2rem', maxWidth: '440px', width: '90%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800' }}>Editar Cierre {editingClosure.id}</h3>
                    <button onClick={() => setEditingClosure(null)} style={{ background: '#F1F5F9', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer' }}>✕</button>
                  </div>

                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.target;
                    const cashierName = form.closureCashier.value.trim();
                    const realAmount = parseFloat(form.closureRealCash.value);

                    if (!cashierName || isNaN(realAmount)) {
                      alert('Ingrese datos válidos');
                      return;
                    }

                    const diff = realAmount - editingClosure.expectedCash;

                    setCashClosureHistory(prev => prev.map(c => c.id === editingClosure.id ? {
                      ...c,
                      cashier: cashierName,
                      realCash: realAmount,
                      difference: diff,
                      status: Math.abs(diff) < 0.01 ? 'Cuadre Perfecto' : diff > 0 ? `+ S/ ${diff.toFixed(2)}` : `- S/ ${Math.abs(diff).toFixed(2)}`
                    } : c));

                    setEditingClosure(null);
                    alert('Cierre de caja actualizado con éxito.');
                  }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#374151' }}>Cajero Responsable</label>
                      <input name="closureCashier" type="text" defaultValue={editingClosure.cashier} required style={{ padding: '0.7rem 1rem', borderRadius: '12px', border: '1px solid #CBD5E0' }} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#374151' }}>Monto Esperado en Caja (S/)</label>
                      <input type="text" value={`S/ ${editingClosure.expectedCash.toFixed(2)}`} disabled style={{ padding: '0.7rem 1rem', borderRadius: '12px', border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#64748B', fontWeight: '700' }} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#374151' }}>Real Contado en Caja (S/)</label>
                      <input name="closureRealCash" type="number" step="0.10" min="0" defaultValue={editingClosure.realCash} required style={{ padding: '0.7rem 1rem', borderRadius: '12px', border: '1px solid #CBD5E0' }} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
                      <button type="button" onClick={() => setEditingClosure(null)} style={{ padding: '12px', borderRadius: '12px', border: '1px solid #CBD5E0', background: '#FFF', color: '#475569', fontWeight: '700' }}>Cancelar</button>
                      <button type="submit" style={{ padding: '12px', borderRadius: '12px', border: 'none', background: '#7E1D33', color: '#FFF', fontWeight: '800' }}>Guardar Cambios</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

          </div>
        )}
        {activeTab === 'Usuarios' && (
          <div className="full-section users-view" style={{ background: '#F8FAFC', borderRadius: '24px', padding: '2rem', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            
            {/* Header Bar */}
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? '0.85rem' : '0', marginBottom: '1.5rem' }}>
              <h2 style={{ color: '#0F172A', margin: 0, fontSize: isMobile ? '1.4rem' : '1.8rem', fontWeight: '800' }}>
                Gestión de Usuarios
              </h2>

              <button 
                onClick={() => { setEditingUser(null); setShowAddUserModal(true); }}
                style={{ background: '#7E1D33', color: '#FFF', border: 'none', padding: '10px 20px', borderRadius: '12px', fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 14px rgba(126, 29, 51, 0.3)', width: isMobile ? '100%' : 'auto' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></svg>
                <span>Nuevo Usuario</span>
              </button>
            </div>

            {/* Main Table Container Card */}
            <div style={{ background: '#FFFFFF', borderRadius: '20px', border: '1px solid #E2E8F0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <div style={{ minWidth: '680px' }}>
              
              {/* Header Column Labels */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 2.5fr 1.2fr 1fr 140px', gap: '1rem', padding: '1.2rem 1.5rem', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', fontSize: '0.78rem', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                <span>NOMBRE COMPLETO</span>
                <span>CORREO ELECTRÓNICO</span>
                <span>ROL</span>
                <span>ESTADO</span>
                <span style={{ textAlign: 'right' }}>ACCIONES</span>
              </div>

              {/* User List Rows */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {users.map((user, idx) => {
                  const isActive = user.status === 'activo';
                  const initials = user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                  
                  // Role Badge Styling
                  let roleBg = '#EFF6FF';
                  let roleColor = '#2563EB';
                  if (user.role === 'Administrador') {
                    roleBg = '#F3E8FF';
                    roleColor = '#9333EA';
                  } else if (user.role === 'Cocina') {
                    roleBg = '#FEF3C7';
                    roleColor = '#D97706';
                  }

                  // Gradient Avatars
                  const gradients = [
                    'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
                    'linear-gradient(135deg, #3b82f6 0%, #22c55e 100%)',
                    'linear-gradient(135deg, #f97316 0%, #eab308 100%)',
                    'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)'
                  ];
                  const avatarBg = gradients[idx % gradients.length];

                  return (
                    <div 
                      key={user.id}
                      style={{ 
                        display: 'grid', 
                        gridTemplateColumns: '2fr 2.5fr 1.2fr 1fr 140px', 
                        gap: '1rem', 
                        padding: '1.1rem 1.5rem', 
                        alignItems: 'center', 
                        borderBottom: '1px solid #F1F5F9',
                        transition: 'background 0.2s'
                      }}
                    >
                      {/* Avatar + Nombre Completo */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {user.avatar && typeof user.avatar === 'string' && user.avatar.length > 5 ? (
                          <img 
                            key={`avatar-${user.id}-${user.avatar.slice(-10)}`}
                            src={user.avatar} 
                            alt={user.name} 
                            onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling && (e.target.nextSibling.style.display = 'flex'); }}
                            style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', boxShadow: '0 2px 6px rgba(0,0,0,0.12)', border: '2px solid #FFF' }} 
                          />
                        ) : null}
                        {(!user.avatar || typeof user.avatar !== 'string' || user.avatar.length <= 5) && (
                          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: avatarBg, color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '0.9rem', boxShadow: '0 2px 6px rgba(0,0,0,0.1)' }}>
                            {initials}
                          </div>
                        )}
                        <strong style={{ fontSize: '0.95rem', color: '#0F172A', fontWeight: '700' }}>
                          {user.name}
                        </strong>
                      </div>

                      {/* Correo Electrónico */}
                      <span style={{ fontSize: '0.88rem', color: '#64748B' }}>
                        {user.email}
                      </span>

                      {/* Rol Badge */}
                      <div>
                        <span style={{ background: roleBg, color: roleColor, fontSize: '0.78rem', fontWeight: '800', padding: '4px 12px', borderRadius: '16px', display: 'inline-block' }}>
                          {user.role}
                        </span>
                      </div>

                      {/* Estado Badge */}
                      <div>
                        <span style={{ background: isActive ? '#DCFCE7' : '#FEE2E2', color: isActive ? '#16A34A' : '#DC2626', fontSize: '0.78rem', fontWeight: '800', padding: '4px 12px', borderRadius: '16px', display: 'inline-block' }}>
                          {isActive ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>

                      {/* Acciones */}
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                        {/* Toggle Switch */}
                        <div 
                          onClick={() => {
                            setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: u.status === 'activo' ? 'desactivado' : 'activo' } : u));
                          }}
                          style={{ 
                            width: '42px', 
                            height: '24px', 
                            borderRadius: '12px', 
                            background: isActive ? '#EC4899' : '#CBD5E1', 
                            cursor: 'pointer', 
                            position: 'relative',
                            transition: 'all 0.2s ease',
                            padding: '2px'
                          }}
                        >
                          <div style={{ 
                            width: '20px', 
                            height: '20px', 
                            borderRadius: '50%', 
                            background: '#FFF', 
                            transform: isActive ? 'translateX(18px)' : 'translateX(0)',
                            transition: 'all 0.2s ease',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                          }} />
                        </div>

                        {/* Edit Button */}
                        <button
                          title="Editar Usuario"
                          onClick={() => {
                            setEditingUser(user);
                            setShowAddUserModal(true);
                          }}
                          style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#FFFFFF', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>

                        {/* Delete Button */}
                        {user.id !== currentUser?.id && (
                          <button
                            title="Eliminar Usuario"
                            onClick={() => {
                              if (confirm(`¿Eliminar al usuario ${user.name}?`)) {
                                setUsers(prev => prev.filter(u => u.id !== user.id));
                                UserService.deleteUser(user.id).catch(e => console.warn('BD delete user err:', e));
                              }
                            }}
                            style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#FFFFFF', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

            {/* Modal para Crear/Editar Usuario */}
            {showAddUserModal && (
              <div className="modal-overlay" onClick={() => { setShowAddUserModal(false); setNewUserAvatarFile(''); setEditingUser(null); }}>
                <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ background: '#FFF', borderRadius: '24px', padding: '2rem', maxWidth: '440px', width: '90%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800' }}>
                      {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
                    </h3>
                    <button onClick={() => { setShowAddUserModal(false); setNewUserAvatarFile(''); setEditingUser(null); }} style={{ background: '#F1F5F9', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer' }}>✕</button>
                  </div>

                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.target;
                    const name = form.userName.value.trim();
                    const email = form.userEmail.value.trim();
                    const password = form.userPassword.value.trim();
                    const role = form.userRole.value;
                    const avatar = newUserAvatarFile || form.userAvatarUrl?.value?.trim() || '';

                    if (!name || !email) {
                      alert('Complete el nombre y correo');
                      return;
                    }

                    if (editingUser) {
                      const finalAvatar = avatar || editingUser.avatar;
                      const userPayload = {
                        name,
                        email,
                        role,
                        avatar: finalAvatar,
                        ...(password ? { password: bcrypt.hashSync(password, 10), demoPassword: password } : {})
                      };
                      setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, ...userPayload } : u));
                      UserService.updateUser(editingUser.id, userPayload).catch(err => console.warn('BD update user err:', err));

                      if (currentUser && (editingUser.id === currentUser.id || editingUser.email?.toLowerCase() === currentUser.email?.toLowerCase())) {
                        const updatedCurrentUser = {
                          ...currentUser,
                          name,
                          email,
                          role,
                          avatar: finalAvatar
                        };
                        setCurrentUser(updatedCurrentUser);
                        localStorage.setItem('shari-user', JSON.stringify(updatedCurrentUser));
                      }
                    } else {
                      if (!password) {
                        alert('Ingrese una contraseña para el usuario');
                        return;
                      }
                      if (users.some(u => u.email === email)) {
                        alert('Este correo ya se encuentra registrado');
                        return;
                      }
                      const newUserObj = {
                        id: `USR-${Date.now()}`,
                        name,
                        email,
                        role,
                        avatar,
                        password: bcrypt.hashSync(password, 10),
                        demoPassword: password,
                        status: 'activo'
                      };
                      setUsers(prev => [...prev, newUserObj]);
                      UserService.createUser(newUserObj).catch(err => console.warn('BD create user err:', err));
                    }

                    setShowAddUserModal(false);
                    setEditingUser(null);
                    setNewUserAvatarFile('');
                  }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#374151' }}>Nombre Completo *</label>
                      <input name="userName" type="text" defaultValue={editingUser ? editingUser.name : ''} placeholder="Ej. Gina Ramírez" required style={{ padding: '0.7rem 1rem', borderRadius: '12px', border: '1px solid #CBD5E0' }} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#374151' }}>Correo Electrónico *</label>
                      <input name="userEmail" type="email" defaultValue={editingUser ? editingUser.email : ''} placeholder="gina@sharisushi.pe" required style={{ padding: '0.7rem 1rem', borderRadius: '12px', border: '1px solid #CBD5E0' }} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#374151' }}>
                        {editingUser ? 'Nueva Contraseña (Opcional)' : 'Contraseña *'}
                      </label>
                      <input name="userPassword" type="password" placeholder="••••••••" required={!editingUser} style={{ padding: '0.7rem 1rem', borderRadius: '12px', border: '1px solid #CBD5E0' }} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#374151' }}>Rol de Usuario *</label>
                      <select name="userRole" defaultValue={editingUser ? editingUser.role : 'Cajero'} style={{ padding: '0.7rem 1rem', borderRadius: '12px', border: '1px solid #CBD5E0', background: '#FFF' }}>
                        <option value="Cajero">Cajero</option>
                        <option value="Cocina">Cocina</option>
                        <option value="Administrador">Administrador</option>
                      </select>
                    </div>

                    {/* 📱 CARGADOR DE FOTO DE PERFIL / AVATAR DESDE EL DISPOSITIVO */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#374151' }}>
                        Foto de Perfil / Avatar (Cargar desde el dispositivo)
                      </label>

                      <div 
                        style={{ 
                          border: '2px dashed #CBD5E1', 
                          borderRadius: '16px', 
                          padding: '1.1rem 1rem', 
                          textAlign: 'center', 
                          background: '#F8FAFC',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                        onClick={() => document.getElementById('user-device-avatar-input').click()}
                      >
                        {(newUserAvatarFile || (editingUser && editingUser.avatar)) ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', justifyContent: 'center' }}>
                            <img 
                              src={newUserAvatarFile || editingUser.avatar} 
                              alt="Avatar Preview" 
                              style={{ width: '54px', height: '54px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #7E1D33', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} 
                            />
                            <div style={{ textAlign: 'left' }}>
                              <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#0F172A', display: 'block' }}>✓ Foto seleccionada</span>
                              <span style={{ fontSize: '0.75rem', color: '#7E1D33', fontWeight: '700' }}>Toca para cambiar foto</span>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', color: '#64748B' }}>
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7E1D33" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                              <circle cx="12" cy="7" r="4"/>
                            </svg>
                            <span style={{ fontSize: '0.86rem', fontWeight: '800', color: '#0F172A' }}>Seleccionar foto de este dispositivo</span>
                            <span style={{ fontSize: '0.74rem', color: '#94A3B8' }}>Selecciona JPG o PNG de tu galería de fotos</span>
                          </div>
                        )}

                        <input 
                          id="user-device-avatar-input"
                          type="file" 
                          accept="image/*" 
                          style={{ display: 'none' }} 
                          onChange={(e) => {
                            const file = e.target.files && e.target.files[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setNewUserAvatarFile(reader.result);
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </div>

                      {/* Avatares Rápidos Predeterminados */}
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px' }}>
                        <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: '600' }}>Predeterminados:</span>
                        {[
                          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
                          'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
                          'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80',
                          'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80'
                        ].map((imgUrl, i) => (
                          <img
                            key={i}
                            src={imgUrl}
                            alt="Avatar preset"
                            onClick={() => setNewUserAvatarFile(imgUrl)}
                            style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', cursor: 'pointer', border: newUserAvatarFile === imgUrl ? '2px solid #7E1D33' : '2px solid #CBD5E0' }}
                            title="Haz clic para seleccionar este avatar"
                          />
                        ))}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
                      <button type="button" onClick={() => { setShowAddUserModal(false); setNewUserAvatarFile(''); setEditingUser(null); }} style={{ padding: '12px', borderRadius: '12px', border: '1px solid #CBD5E0', background: '#FFF', color: '#475569', fontWeight: '700' }}>Cancelar</button>
                      <button type="submit" style={{ padding: '12px', borderRadius: '12px', border: 'none', background: '#7E1D33', color: '#FFF', fontWeight: '800' }}>
                        {editingUser ? 'Guardar Cambios' : 'Crear Usuario'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

          </div>
        )}

        {activeTab === 'Clientes' && (
          <div className="full-section clients-view" style={{ background: '#F8FAFC', borderRadius: '24px', padding: '2rem', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            
            {/* Header con Título y Botones */}
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? '0.85rem' : '0', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ color: '#0F172A', margin: 0, fontSize: isMobile ? '1.4rem' : '1.8rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                  Clientes
                </h2>
                <p style={{ color: '#64748B', margin: '4px 0 0 0', fontSize: '0.88rem' }}>Lista de clientes registrados y su historial</p>
              </div>

              <div style={{ display: 'flex', gap: '10px', width: isMobile ? '100%' : 'auto' }}>
                <button 
                  onClick={() => setShowClientModal(true)} 
                  style={{ background: '#10B981', color: '#FFF', border: 'none', padding: '10px 16px', borderRadius: '12px', fontWeight: '700', fontSize: '0.88rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)', flex: isMobile ? 1 : 'none' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  <span>Agregar Cliente</span>
                </button>
                <button 
                  onClick={() => setShowClientModal(true)} 
                  style={{ background: '#059669', color: '#FFF', border: 'none', padding: '10px 16px', borderRadius: '12px', fontWeight: '700', fontSize: '0.88rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(5, 150, 105, 0.2)', flex: isMobile ? 1 : 'none' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  <span>Agregar Empresa</span>
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div style={{ display: 'flex', gap: '2rem', borderBottom: '1px solid #E2E8F0', marginBottom: '1.5rem', paddingBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.95rem', fontWeight: '700', color: '#10B981', borderBottom: '3px solid #10B981', paddingBottom: '0.5rem', cursor: 'pointer' }}>
                Clientes
              </span>
              <span style={{ fontSize: '0.95rem', fontWeight: '600', color: '#94A3B8', paddingBottom: '0.5rem', cursor: 'pointer' }}>
                Empresas / RUC
              </span>
            </div>

            {/* Filter and Search Bar */}
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div style={{ position: 'relative', width: '280px' }}>
                <input
                  type="text"
                  placeholder="Buscar cliente..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem 1rem 0.65rem 2.4rem', borderRadius: '30px', border: '1px solid #E2E8F0', background: '#FFFFFF', fontSize: '0.88rem', outline: 'none', color: '#1E293B' }}
                />
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.5" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </div>

              <select style={{ padding: '0.65rem 1.2rem', borderRadius: '30px', border: '1px solid #E2E8F0', background: '#FFFFFF', fontSize: '0.88rem', color: '#475569', cursor: 'pointer', outline: 'none' }}>
                <option>Todos los Documentos</option>
                <option>DNI</option>
                <option>RUC</option>
              </select>

              <button 
                onClick={() => setSearch('')}
                style={{ padding: '0.65rem 1.2rem', borderRadius: '30px', border: 'none', background: '#64748B', color: '#FFFFFF', fontSize: '0.85rem', fontWeight: '700', cursor: 'pointer' }}
              >
                Restablecer
              </button>
            </div>

            {/* Table Header Labels */}
            <div style={{ display: 'grid', gridTemplateColumns: '90px 1.8fr 1.2fr 1fr 1fr 1.8fr 1fr 140px', gap: '1rem', padding: '0 1.25rem 0.6rem 1.25rem', fontSize: '0.78rem', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <span>ID / DNI</span>
              <span>Nombre</span>
              <span>Documento</span>
              <span>Dirección</span>
              <span>Compras</span>
              <span>Contacto</span>
              <span>Registrado</span>
              <span style={{ textAlign: 'right' }}>Acciones</span>
            </div>

            {/* List of Client Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {clients.filter(c => 
                c.name.toLowerCase().includes(search.toLowerCase()) || 
                c.document.includes(search)
              ).length === 0 ? (
                <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '3rem', textAlign: 'center', color: '#94A3B8', border: '1px solid #E2E8F0' }}>
                  No se encontraron clientes registrados.
                </div>
              ) : (
                clients.filter(c => 
                  c.name.toLowerCase().includes(search.toLowerCase()) || 
                  c.document.includes(search)
                ).map((client, idx) => {
                  const isRUC = client.document.length === 11;
                  const initials = client.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

                  return (
                    <div 
                      key={client.document || idx} 
                      style={{ 
                        background: '#FFFFFF', 
                        borderRadius: '16px', 
                        padding: '1rem 1.25rem', 
                        display: 'grid', 
                        gridTemplateColumns: '90px 1.8fr 1.2fr 1fr 1fr 1.8fr 1fr 140px', 
                        gap: '1rem', 
                        alignItems: 'center',
                        border: '1px solid #F1F5F9',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {/* ID / Code */}
                      <span style={{ fontSize: '0.88rem', fontWeight: '700', color: '#475569' }}>
                        {client.document.slice(-5) || `C-${idx + 100}`}
                      </span>

                      {/* Avatar + Nombre */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#F1F5F9', color: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '0.9rem', border: '1px solid #E2E8F0' }}>
                          {initials}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <strong style={{ fontSize: '0.92rem', color: '#0F172A', fontWeight: '700' }}>{client.name}</strong>
                          <span style={{ fontSize: '0.78rem', color: '#94A3B8' }}>{isRUC ? 'Empresa' : 'Persona Natural'}</span>
                        </div>
                      </div>

                      {/* Documento */}
                      <span style={{ fontSize: '0.85rem', color: '#475569', fontWeight: '600' }}>
                        {isRUC ? 'RUC' : 'DNI'}: {client.document}
                      </span>

                      {/* Dirección / Ciudad */}
                      <span style={{ fontSize: '0.85rem', color: '#64748B' }}>
                        {client.address || 'Lima, PE'}
                      </span>

                      {/* Compras Pill */}
                      <div>
                        <span style={{ background: '#E0F2FE', color: '#0284C7', fontSize: '0.78rem', fontWeight: '800', padding: '4px 10px', borderRadius: '20px', display: 'inline-block' }}>
                          {client.totalPurchases || 0} {client.totalPurchases === 1 ? 'Compra' : 'Compras'}
                        </span>
                      </div>

                      {/* Contacto Info */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.78rem', color: '#64748B' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                          <span>{client.email || `${client.document}@cliente.pe`}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                          <span>{client.phone || '(01) 987-6543'}</span>
                        </div>
                      </div>

                      {/* Registrado */}
                      <span style={{ fontSize: '0.82rem', color: '#94A3B8' }}>
                        {client.createdAt ? new Date(client.createdAt).toLocaleDateString('es-PE') : '10/09/2026'}
                      </span>

                      {/* Acciones Buttons */}
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <button 
                          title="Ver Compras"
                          onClick={() => alert(`Cliente: ${client.name}\nTotal gastado: S/ ${(client.totalAmount || 0).toFixed(2)}`)}
                          style={{ background: '#ECFDF5', border: 'none', color: '#059669', padding: '6px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer' }}
                        >
                          Ordenes
                        </button>
                        <button
                          title="Editar Cliente"
                          onClick={() => setEditingClient(client)}
                          style={{ width: '28px', height: '28px', borderRadius: '50%', border: 'none', background: '#F1F5F9', color: '#475569', fontSize: '0.8rem', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button 
                          title="Eliminar Cliente"
                          onClick={() => {
                            if (confirm(`¿Eliminar al cliente ${client.name}?`)) {
                              setClients(prev => prev.filter(c => c.document !== client.document));
                              ClientService.deleteClient(client.document).catch(e => console.warn('BD delete client err:', e));
                            }
                          }}
                          style={{ width: '28px', height: '28px', borderRadius: '50%', border: 'none', background: '#FEE2E2', color: '#DC2626', fontSize: '0.8rem', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal para Editar Cliente Existente */}
            {editingClient && (
              <div className="modal-overlay" onClick={() => setEditingClient(null)}>
                <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ background: '#FFF', borderRadius: '24px', padding: '2rem', maxWidth: '440px', width: '90%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800' }}>Editar Cliente ({editingClient.name})</h3>
                    <button onClick={() => setEditingClient(null)} style={{ background: '#F1F5F9', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer' }}>✕</button>
                  </div>

                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.target;
                    const name = form.cliName.value.trim();
                    const email = form.cliEmail.value.trim();
                    const phone = form.cliPhone.value.trim();
                    const address = form.cliAddress.value.trim();

                    if (!name) {
                      alert('Ingrese el nombre del cliente');
                      return;
                    }

                    const updatedClient = {
                      ...editingClient,
                      name,
                      email,
                      phone,
                      address
                    };

                    setClients(prev => prev.map(c => c.document === editingClient.document ? updatedClient : c));
                    ClientService.updateClient(editingClient.document, updatedClient).catch(err => console.warn('BD update client err:', err));
                    setEditingClient(null);
                    alert('Cliente actualizado con éxito.');
                  }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155' }}>Nombre / Razón Social</label>
                      <input name="cliName" type="text" defaultValue={editingClient.name} required style={{ padding: '0.7rem 1rem', borderRadius: '12px', border: '1px solid #CBD5E0' }} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155' }}>Documento ({editingClient.documentType || 'DNI'})</label>
                      <input type="text" defaultValue={editingClient.document} disabled style={{ padding: '0.7rem 1rem', borderRadius: '12px', border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#64748B' }} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155' }}>Email</label>
                        <input name="cliEmail" type="email" defaultValue={editingClient.email || ''} style={{ padding: '0.7rem 1rem', borderRadius: '12px', border: '1px solid #CBD5E0' }} />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155' }}>Teléfono</label>
                        <input name="cliPhone" type="tel" defaultValue={editingClient.phone || ''} style={{ padding: '0.7rem 1rem', borderRadius: '12px', border: '1px solid #CBD5E0' }} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155' }}>Dirección</label>
                      <input name="cliAddress" type="text" defaultValue={editingClient.address || ''} style={{ padding: '0.7rem 1rem', borderRadius: '12px', border: '1px solid #CBD5E0' }} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
                      <button type="button" onClick={() => setEditingClient(null)} style={{ padding: '12px', borderRadius: '12px', border: '1px solid #CBD5E0', background: '#FFF', color: '#475569', fontWeight: '700' }}>Cancelar</button>
                      <button type="submit" style={{ padding: '12px', borderRadius: '12px', border: 'none', background: '#10B981', color: '#FFF', fontWeight: '800' }}>Guardar Cambios</button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'Productos' && (
          <div className="full-section products-view" style={{ background: '#F8FAFC', borderRadius: '24px', padding: '2rem', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            
            {/* Top Bar Header */}
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? '1rem' : '0', marginBottom: '1.5rem' }}>
              <h2 style={{ color: '#0F172A', margin: 0, fontSize: isMobile ? '1.4rem' : '1.8rem', fontWeight: '800' }}>
                Listado de Productos
              </h2>

              <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '0.75rem', alignItems: isMobile ? 'stretch' : 'center', width: isMobile ? '100%' : 'auto' }}>
                {/* Search Bar */}
                <div style={{ position: 'relative', width: isMobile ? '100%' : '280px' }}>
                  <input
                    type="text"
                    placeholder="Buscar producto..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem 1rem 0.65rem 2.4rem', borderRadius: '30px', border: '1px solid #E2E8F0', background: '#FFFFFF', fontSize: '0.88rem', outline: 'none', color: '#1E293B' }}
                  />
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.5" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                </div>

                {/* Top Action Buttons */}
                <div style={{ display: 'flex', gap: '0.75rem', width: isMobile ? '100%' : 'auto' }}>
                  <button 
                    onClick={() => setShowAddCategoryModal(true)}
                    style={{ background: '#B84A62', color: '#FFF', border: 'none', padding: '10px 16px', borderRadius: '12px', fontWeight: '700', fontSize: '0.88rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxShadow: '0 4px 12px rgba(184, 74, 98, 0.25)', flex: isMobile ? 1 : 'none' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    <span>Nueva Categoría</span>
                  </button>

                  <button 
                    onClick={() => setShowAddProductModal(true)}
                    style={{ background: '#7E1D33', color: '#FFF', border: 'none', padding: '10px 16px', borderRadius: '12px', fontWeight: '700', fontSize: '0.88rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxShadow: '0 4px 12px rgba(126, 29, 51, 0.25)', flex: isMobile ? 1 : 'none' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    <span>Nuevo Producto</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Horizontal Category Cards Carousel */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
              <button style={{ width: '36px', height: '36px', borderRadius: '50%', border: '1px solid #E2E8F0', background: '#FFF', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                ‹
              </button>

              <div style={{ display: 'flex', gap: '1rem', flexGrow: 1 }}>
                {categoriesList.map((cat) => {
                  const isActive = selectedProdCategory === cat;
                  return (
                    <div
                      key={cat}
                      onClick={() => setSelectedProdCategory(cat)}
                      style={{
                        padding: '0.8rem 1.4rem',
                        borderRadius: '16px',
                        background: isActive ? '#7E1D33' : '#FFFFFF',
                        color: isActive ? '#FFFFFF' : '#475569',
                        border: isActive ? 'none' : '1px solid #E2E8F0',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justify: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        minWidth: '85px',
                        boxShadow: isActive ? '0 4px 14px rgba(126, 29, 51, 0.3)' : '0 2px 4px rgba(0,0,0,0.02)',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: isActive ? 'rgba(255,255,255,0.2)' : '#FDF4F5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isActive ? '#FFF' : '#B84A62' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/></svg>
                      </div>
                      <span style={{ fontSize: '0.82rem', fontWeight: '700' }}>{cat}</span>
                    </div>
                  );
                })}
              </div>

              <button style={{ width: '36px', height: '36px', borderRadius: '50%', border: '1px solid #E2E8F0', background: '#FFF', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                ›
              </button>
            </div>

            {/* Grid de Tarjetas de Producto */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '1.25rem' }}>
              {products.filter(p => {
                const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase());
                const matchCategory = selectedProdCategory === 'Todos' || p.category === selectedProdCategory;
                return matchSearch && matchCategory;
              }).length === 0 ? (
                <div style={{ gridColumn: '1 / -1', background: '#FFFFFF', borderRadius: '16px', padding: '3rem', textAlign: 'center', color: '#94A3B8', border: '1px solid #E2E8F0' }}>
                  No se encontraron productos registrados en esta categoría.
                </div>
              ) : (
                products.filter(p => {
                  const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase());
                  const matchCategory = selectedProdCategory === 'Todos' || p.category === selectedProdCategory;
                  return matchSearch && matchCategory;
                }).map((prod) => {
                  const isLowStock = prod.stock <= 5;

                  return (
                    <div 
                      key={prod.id} 
                      style={{ 
                        background: '#FFFFFF', 
                        borderRadius: '20px', 
                        border: '1px solid #E2E8F0', 
                        overflow: 'hidden', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                        transition: 'all 0.2s ease',
                        position: 'relative'
                      }}
                    >
                      {/* Imagen de Producto con Badges encima */}
                      <div style={{ position: 'relative', width: '100%', height: '150px', background: '#F8FAFC' }}>
                        <img 
                          src={prod.image || fallbackImage} 
                          alt={prod.name} 
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                          onError={handleImageError} 
                        />

                        {/* Stock Pill Badge Top Left */}
                        <div style={{ position: 'absolute', top: '10px', left: '10px', background: isLowStock ? '#FEF3C7' : '#ECFDF5', color: isLowStock ? '#D97706' : '#059669', fontSize: '0.72rem', fontWeight: '800', padding: '4px 10px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 2px 6px rgba(0,0,0,0.1)' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isLowStock ? '#D97706' : '#059669' }}></span>
                          {prod.stock} uds.
                        </div>

                        {/* Floating Edit and Delete Buttons Top Right */}
                        <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '6px' }}>
                          <button
                            title="Editar Producto"
                            onClick={() => setEditingProduct(prod)}
                            style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#FFFFFF', border: 'none', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>

                          <button
                            title="Eliminar Producto"
                            onClick={() => {
                              if (confirm(`¿Eliminar ${prod.name} de la carta?`)) {
                                setProducts(prev => prev.filter(p => p.id !== prod.id));
                                ProductService.deleteProduct(prod.id).catch(e => console.warn('BD delete prod err:', e));
                              }
                            }}
                            style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#FFFFFF', border: 'none', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                          </button>
                        </div>
                      </div>

                      {/* Contenido de la Tarjeta */}
                      <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', flexGrow: 1, justifyContent: 'space-between' }}>
                        <div>
                          <strong style={{ fontSize: '0.98rem', color: '#0F172A', fontWeight: '800', display: 'block', marginBottom: '4px' }}>
                            {prod.name}
                          </strong>
                          
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                            <span style={{ background: '#FDF4F5', color: '#B84A62', fontSize: '0.68rem', fontWeight: '800', padding: '2px 8px', borderRadius: '6px', textTransform: 'uppercase' }}>
                              {prod.category}
                            </span>
                            <span style={{ background: '#F1F5F9', color: '#64748B', fontSize: '0.68rem', fontWeight: '700', padding: '2px 8px', borderRadius: '6px' }}>
                              CÓD: {prod.code}
                            </span>
                          </div>
                        </div>

                        <div>
                          <strong style={{ fontSize: '1.2rem', color: '#7E1D33', fontWeight: '900', display: 'block' }}>
                            S/ {prod.price.toFixed(2)}
                          </strong>
                          <span style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '2px', display: 'block' }}>
                            Stock del Producto: {prod.stock} uds.
                          </span>
                        </div>
                      </div>

                    </div>
                  );
                })
              )}
            </div>

            {/* Modal para Agregar Nueva Categoría */}
            {showAddCategoryModal && (
              <div className="modal-overlay" onClick={() => setShowAddCategoryModal(false)}>
                <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ background: '#FFF', borderRadius: '24px', padding: '2rem', maxWidth: '400px', width: '90%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800' }}>Nueva Categoría</h3>
                    <button onClick={() => setShowAddCategoryModal(false)} style={{ background: '#F1F5F9', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer' }}>✕</button>
                  </div>

                  <form onSubmit={(e) => {
                    e.preventDefault();
                    if (!newCategoryInput.trim()) return;
                    const catName = newCategoryInput.trim();
                    if (!categoriesList.includes(catName)) {
                      setCategoriesList(prev => [...prev, catName]);
                      CategoryService.createCategory(catName).catch(err => console.warn('BD create cat err:', err));
                    }
                    setNewCategoryInput('');
                    setShowAddCategoryModal(false);
                  }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <input 
                      type="text" 
                      placeholder="Nombre de la categoría (ej. Promos, Frappés)" 
                      value={newCategoryInput} 
                      onChange={(e) => setNewCategoryInput(e.target.value)} 
                      required 
                      style={{ padding: '0.8rem', borderRadius: '12px', border: '1px solid #CBD5E0', fontSize: '0.95rem' }} 
                    />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <button type="button" onClick={() => setShowAddCategoryModal(false)} style={{ padding: '10px', borderRadius: '12px', border: '1px solid #CBD5E0', background: '#FFF', color: '#475569', fontWeight: '700' }}>Cancelar</button>
                      <button type="submit" style={{ padding: '10px', borderRadius: '12px', border: 'none', background: '#7E1D33', color: '#FFF', fontWeight: '800' }}>Guardar</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Modal para Agregar Nuevo Producto */}
            {showAddProductModal && (
              <div className="modal-overlay" onClick={() => { setShowAddProductModal(false); setNewProductImageFile(''); }}>
                <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ background: '#FFF', borderRadius: '24px', padding: '2rem', maxWidth: '460px', width: '90%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800' }}>Agregar Nuevo Producto</h3>
                    <button onClick={() => { setShowAddProductModal(false); setNewProductImageFile(''); }} style={{ background: '#F1F5F9', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer' }}>✕</button>
                  </div>

                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.target;
                    const name = form.prodName.value.trim();
                    const code = form.prodCode.value.trim();
                    const price = parseFloat(form.prodPrice.value);
                    const stock = parseInt(form.prodStock.value);
                    const category = form.prodCategory.value;

                    if (!name || !code || Number.isNaN(price) || Number.isNaN(stock)) {
                      alert('Complete todos los campos requeridos.');
                      return;
                    }

                    if (products.some(p => p.code.toUpperCase() === code.toUpperCase())) {
                      alert('Este código de producto ya está en uso.');
                      return;
                    }

                    const newProd = {
                      id: Date.now(),
                      name,
                      code: code.toUpperCase(),
                      price,
                      stock,
                      category,
                      image: newProductImageFile || fallbackImage
                    };

                    setProducts(prev => [...prev, newProd]);
                    ProductService.createProduct(newProd).catch(e => console.warn('BD create prod err:', e));
                    setNewProductImageFile('');
                    setShowAddProductModal(false);
                    alert('Producto agregado con éxito.');
                  }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <input name="prodName" type="text" placeholder="Nombre del Producto (ej. Acevichado Roll)" required style={{ padding: '0.7rem 1rem', borderRadius: '12px', border: '1px solid #CBD5E0' }} />
                    <input name="prodCode" type="text" placeholder="Código (ej. MK015)" required style={{ padding: '0.7rem 1rem', borderRadius: '12px', border: '1px solid #CBD5E0' }} />
                    <select name="prodCategory" style={{ padding: '0.7rem 1rem', borderRadius: '12px', border: '1px solid #CBD5E0', background: '#FFF' }}>
                      {categoriesList.filter(c => c !== 'Todos').map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <input name="prodPrice" type="number" step="0.10" min="0.10" placeholder="Precio (S/)" required style={{ padding: '0.7rem 1rem', borderRadius: '12px', border: '1px solid #CBD5E0' }} />
                      <input name="prodStock" type="number" min="0" placeholder="Stock Inicial" required style={{ padding: '0.7rem 1rem', borderRadius: '12px', border: '1px solid #CBD5E0' }} />
                    </div>

                    {/* 📱 CARGADOR DE IMAGEN DESDE EL DISPOSITIVO LOCAL */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155' }}>
                        Imagen del Producto (Cargar desde el dispositivo)
                      </label>

                      <div 
                        style={{ 
                          border: '2px dashed #CBD5E1', 
                          borderRadius: '16px', 
                          padding: '1.1rem 1rem', 
                          textAlign: 'center', 
                          background: '#F8FAFC',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                        onClick={() => document.getElementById('device-image-input').click()}
                      >
                        {newProductImageFile ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', justifyContent: 'center' }}>
                            <img 
                              src={newProductImageFile} 
                              alt="Preview" 
                              style={{ width: '56px', height: '56px', borderRadius: '12px', objectFit: 'cover', border: '2px solid #7E1D33', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} 
                            />
                            <div style={{ textAlign: 'left' }}>
                              <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#0F172A', display: 'block' }}>✓ Foto seleccionada</span>
                              <span style={{ fontSize: '0.75rem', color: '#7E1D33', fontWeight: '700' }}>Toca para cambiar imagen</span>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', color: '#64748B' }}>
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7E1D33" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                              <circle cx="8.5" cy="8.5" r="1.5"/>
                              <polyline points="21 15 16 10 5 21"/>
                            </svg>
                            <span style={{ fontSize: '0.86rem', fontWeight: '800', color: '#0F172A' }}>Seleccionar imagen de este dispositivo</span>
                            <span style={{ fontSize: '0.74rem', color: '#94A3B8' }}>Selecciona JPG, PNG o WEBP de tu galería o almacenamiento</span>
                          </div>
                        )}

                        <input 
                          id="device-image-input"
                          type="file" 
                          accept="image/*" 
                          style={{ display: 'none' }} 
                          onChange={(e) => {
                            const file = e.target.files && e.target.files[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setNewProductImageFile(reader.result);
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
                      <button type="button" onClick={() => { setShowAddProductModal(false); setNewProductImageFile(''); }} style={{ padding: '12px', borderRadius: '12px', border: '1px solid #CBD5E0', background: '#FFF', color: '#475569', fontWeight: '700' }}>Cancelar</button>
                      <button type="submit" style={{ padding: '12px', borderRadius: '12px', border: 'none', background: '#7E1D33', color: '#FFF', fontWeight: '800' }}>Agregar Producto</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Modal para Editar Producto Existente */}
            {editingProduct && (
              <div className="modal-overlay" onClick={() => setEditingProduct(null)}>
                <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ background: '#FFF', borderRadius: '24px', padding: '2rem', maxWidth: '460px', width: '90%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800' }}>Editar Producto ({editingProduct.name})</h3>
                    <button onClick={() => setEditingProduct(null)} style={{ background: '#F1F5F9', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer' }}>✕</button>
                  </div>

                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.target;
                    const name = form.prodName.value.trim();
                    const code = form.prodCode.value.trim();
                    const price = parseFloat(form.prodPrice.value);
                    const stock = parseInt(form.prodStock.value);
                    const category = form.prodCategory.value;

                    if (!name || !code || Number.isNaN(price) || Number.isNaN(stock)) {
                      alert('Complete todos los campos requeridos.');
                      return;
                    }

                    const updatedProd = {
                      ...editingProduct,
                      name,
                      code: code.toUpperCase(),
                      price,
                      stock,
                      category,
                      image: newProductImageFile || editingProduct.image
                    };

                    setProducts(prev => prev.map(p => p.id === editingProduct.id ? updatedProd : p));
                    ProductService.updateProduct(editingProduct.id, updatedProd).catch(err => console.warn('BD update prod err:', err));
                    setNewProductImageFile('');
                    setEditingProduct(null);
                    alert('Producto actualizado con éxito.');
                  }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155' }}>Nombre del Producto</label>
                      <input name="prodName" type="text" defaultValue={editingProduct.name} required style={{ padding: '0.7rem 1rem', borderRadius: '12px', border: '1px solid #CBD5E0' }} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155' }}>Código</label>
                      <input name="prodCode" type="text" defaultValue={editingProduct.code} required style={{ padding: '0.7rem 1rem', borderRadius: '12px', border: '1px solid #CBD5E0' }} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155' }}>Categoría</label>
                      <select name="prodCategory" defaultValue={editingProduct.category} style={{ padding: '0.7rem 1rem', borderRadius: '12px', border: '1px solid #CBD5E0', background: '#FFF' }}>
                        {categoriesList.filter(c => c !== 'Todos').map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155' }}>Precio (S/)</label>
                        <input name="prodPrice" type="number" step="0.10" min="0.10" defaultValue={editingProduct.price} required style={{ padding: '0.7rem 1rem', borderRadius: '12px', border: '1px solid #CBD5E0' }} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155' }}>Stock</label>
                        <input name="prodStock" type="number" min="0" defaultValue={editingProduct.stock} required style={{ padding: '0.7rem 1rem', borderRadius: '12px', border: '1px solid #CBD5E0' }} />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
                      <button type="button" onClick={() => setEditingProduct(null)} style={{ padding: '12px', borderRadius: '12px', border: '1px solid #CBD5E0', background: '#FFF', color: '#475569', fontWeight: '700' }}>Cancelar</button>
                      <button type="submit" style={{ padding: '12px', borderRadius: '12px', border: 'none', background: '#7E1D33', color: '#FFF', fontWeight: '800' }}>Guardar Cambios</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

          </div>
        )}

        {(activeTab === 'Inventario' || activeTab === 'Categorías') && (
          <div className="full-section inventory-view" style={{ background: '#F8FAFC', borderRadius: '24px', padding: '2rem', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            
            {/* Header Title & Description */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ color: '#0F172A', margin: 0, fontSize: '1.8rem', fontWeight: '800' }}>
                Gestión de Inventario
              </h2>
              <p style={{ color: '#64748B', margin: '6px 0 0 0', fontSize: '0.9rem', lineHeight: '1.5' }}>
                Administra tu stock, crea categorías (Productos, Insumos e Ingredientes), edita, elimina y controla el inventario en tiempo real.
              </p>
            </div>

            {/* Full Width Search Bar */}
            <div style={{ position: 'relative', width: '100%', marginBottom: '1.25rem' }}>
              <input
                type="text"
                placeholder="Buscar ítem o categoría..."
                value={inventorySearch}
                onChange={(e) => setInventorySearch(e.target.value)}
                style={{ width: '100%', padding: '0.8rem 1.2rem 0.8rem 2.6rem', borderRadius: '30px', border: '1px solid #E2E8F0', background: '#FFFFFF', fontSize: '0.92rem', outline: 'none', color: '#1E293B', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
              />
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.5" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </div>

            {/* Action Buttons Row */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', width: isMobile ? '100%' : 'auto' }}>
              <button 
                onClick={() => setShowAddCategoryModal(true)}
                style={{ background: '#FFFFFF', color: '#1E293B', border: '1px solid #CBD5E1', padding: '10px 18px', borderRadius: '12px', fontWeight: '700', fontSize: '0.88rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)', flex: isMobile ? 1 : 'none' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
                <span>+ Crear Categoría</span>
              </button>

              <button 
                onClick={() => { setEditingInventoryItem(null); setShowAddInventoryModal(true); }}
                style={{ background: '#7E1D33', color: '#FFFFFF', border: 'none', padding: '10px 20px', borderRadius: '12px', fontWeight: '800', fontSize: '0.88rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 14px rgba(126, 29, 51, 0.25)', flex: isMobile ? 1 : 'none' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                <span>+ Crear Ítem</span>
              </button>
            </div>

            {/* Category / Type Filter Pills Row */}
            <div style={{ display: 'flex', gap: '0.65rem', marginBottom: '1.5rem', overflowX: 'auto', flexWrap: 'wrap', paddingBottom: '0.4rem' }}>
              {['Todos', 'Productos', 'Insumos', 'Ingredientes'].map((type) => {
                const isActive = inventoryFilterTab === type;
                return (
                  <button
                    key={type}
                    onClick={() => setInventoryFilterTab(type)}
                    style={{
                      padding: '0.55rem 1.3rem',
                      borderRadius: '30px',
                      background: isActive ? '#1E293B' : '#FFFFFF',
                      color: isActive ? '#FFFFFF' : '#0F172A',
                      border: isActive ? '2px solid #1E293B' : '1px solid #CBD5E1',
                      fontWeight: isActive ? '800' : '600',
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {type}
                  </button>
                );
              })}
            </div>

            {/* Main Table Card Container */}
            <div style={{ background: '#FFFFFF', borderRadius: '20px', border: '1px solid #E2E8F0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <div style={{ minWidth: '780px' }}>
              
              {/* Header Column Labels */}
              <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 1.3fr 1.5fr 1.2fr 1.2fr 1fr 100px', gap: '1rem', padding: '1.2rem 1.5rem', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', fontSize: '0.78rem', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                <span>NOMBRE DEL ÍTEM</span>
                <span>TIPO PRINCIPAL</span>
                <span>CATEGORÍA</span>
                <span>STOCK ACTUAL</span>
                <span>COSTO UNIT.</span>
                <span>ESTADO</span>
                <span style={{ textAlign: 'right' }}>ACCIONES</span>
              </div>

              {/* Inventory List Rows */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {(() => {
                  const filtered = inventoryItems.filter(item => {
                    const matchSearch = item.name.toLowerCase().includes(inventorySearch.toLowerCase()) || 
                      item.category.toLowerCase().includes(inventorySearch.toLowerCase());
                    const matchType = inventoryFilterTab === 'Todos' || 
                      (inventoryFilterTab === 'Productos' && item.type === 'PRODUCTO') ||
                      (inventoryFilterTab === 'Insumos' && item.type === 'INSUMO') ||
                      (inventoryFilterTab === 'Ingredientes' && item.type === 'INGREDIENTE');
                    return matchSearch && matchType;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div style={{ padding: '3rem', textAlign: 'center', color: '#94A3B8' }}>
                        No se encontraron ítems en el inventario.
                      </div>
                    );
                  }

                  return filtered.map(item => {
                    const isLowStock = item.stock <= 5;

                    // Type Badge Colors
                    let typeBg = '#F3E8FF';
                    let typeColor = '#9333EA';
                    if (item.type === 'INSUMO') {
                      typeBg = '#E0F2FE';
                      typeColor = '#0284C7';
                    } else if (item.type === 'PRODUCTO') {
                      typeBg = '#DCFCE7';
                      typeColor = '#16A34A';
                    }

                    return (
                      <div 
                        key={item.id}
                        style={{ 
                          display: 'grid', 
                          gridTemplateColumns: '2.2fr 1.3fr 1.5fr 1.2fr 1.2fr 1fr 100px', 
                          gap: '1rem', 
                          padding: '1.1rem 1.5rem', 
                          alignItems: 'center', 
                          borderBottom: '1px solid #F1F5F9',
                          transition: 'background 0.2s'
                        }}
                      >
                        {/* Nombre del Ítem */}
                        <strong style={{ fontSize: '0.95rem', color: '#0F172A', fontWeight: '700' }}>
                          {item.name}
                        </strong>

                        {/* Tipo Principal Badge */}
                        <div>
                          <span style={{ background: typeBg, color: typeColor, fontSize: '0.75rem', fontWeight: '800', padding: '4px 10px', borderRadius: '14px', display: 'inline-block' }}>
                            {item.type}
                          </span>
                        </div>

                        {/* Categoría */}
                        <span style={{ fontSize: '0.88rem', color: '#475569' }}>
                          {item.category}
                        </span>

                        {/* Stock Actual */}
                        <strong style={{ fontSize: '0.95rem', color: '#0F172A', fontWeight: '800' }}>
                          {item.stock} {item.unit}
                        </strong>

                        {/* Costo Unit. */}
                        <span style={{ fontSize: '0.88rem', color: '#475569', fontWeight: '600' }}>
                          S/ {item.cost.toFixed(2)}
                        </span>

                        {/* Estado */}
                        <div>
                          <span style={{ background: isLowStock ? '#FEF3C7' : '#ECFDF5', color: isLowStock ? '#D97706' : '#059669', fontSize: '0.78rem', fontWeight: '800', padding: '4px 12px', borderRadius: '16px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isLowStock ? '#D97706' : '#059669' }}></span>
                            {isLowStock ? 'Bajo Stock' : 'Normal'}
                          </span>
                        </div>

                        {/* Acciones */}
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                          <button
                            title="Editar Ítem"
                            onClick={() => {
                              setEditingInventoryItem(item);
                              setShowAddInventoryModal(true);
                            }}
                            style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#FFFFFF', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>

                          <button
                            title="Eliminar Ítem"
                            onClick={() => {
                              if (confirm(`¿Eliminar ${item.name} del inventario?`)) {
                                setInventoryItems(prev => prev.filter(i => i.id !== item.id));
                                InventoryService.deleteInventoryItem(item.id).catch(e => console.warn('BD delete inv err:', e));
                              }
                            }}
                            style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#FFFFFF', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                          </button>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
            </div>

            {/* Modal para Crear/Editar Ítem de Inventario */}
            {showAddInventoryModal && (
              <div className="modal-overlay" onClick={() => setShowAddInventoryModal(false)}>
                <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ background: '#FFF', borderRadius: '24px', padding: '2rem', maxWidth: '460px', width: '90%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800' }}>
                      {editingInventoryItem ? 'Editar Ítem de Inventario' : 'Crear Nuevo Ítem'}
                    </h3>
                    <button onClick={() => setShowAddInventoryModal(false)} style={{ background: '#F1F5F9', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer' }}>✕</button>
                  </div>

                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.target;
                    const name = form.itemName.value.trim();
                    const type = form.itemType.value;
                    const category = form.itemCategory.value.trim();
                    const stock = parseFloat(form.itemStock.value);
                    const unit = form.itemUnit.value.trim();
                    const cost = parseFloat(form.itemCost.value);

                    if (!name || Number.isNaN(stock) || Number.isNaN(cost)) {
                      alert('Complete todos los campos obligatorios');
                      return;
                    }

                    const invPayload = { name, type, category: category || 'General', stock, unit: unit || 'uds', cost };

                    if (editingInventoryItem) {
                      setInventoryItems(prev => prev.map(i => i.id === editingInventoryItem.id ? { ...i, ...invPayload } : i));
                      InventoryService.updateInventoryItem(editingInventoryItem.id, invPayload).catch(err => console.warn('BD update inv err:', err));
                    } else {
                      const newItem = {
                        id: `INV-${Date.now()}`,
                        ...invPayload,
                        status: 'Normal'
                      };
                      setInventoryItems(prev => [...prev, newItem]);
                      InventoryService.createInventoryItem(newItem).catch(err => console.warn('BD create inv err:', err));
                    }

                    setShowAddInventoryModal(false);
                    setEditingInventoryItem(null);
                  }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#374151' }}>Nombre del Ítem *</label>
                      <input name="itemName" type="text" defaultValue={editingInventoryItem ? editingInventoryItem.name : ''} placeholder="Ej. Queso Mozzarella Rallado" required style={{ padding: '0.7rem 1rem', borderRadius: '12px', border: '1px solid #CBD5E0' }} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#374151' }}>Tipo Principal *</label>
                        <select name="itemType" defaultValue={editingInventoryItem ? editingInventoryItem.type : 'INGREDIENTE'} style={{ padding: '0.7rem 1rem', borderRadius: '12px', border: '1px solid #CBD5E0', background: '#FFF' }}>
                          <option value="INGREDIENTE">INGREDIENTE</option>
                          <option value="INSUMO">INSUMO</option>
                          <option value="PRODUCTO">PRODUCTO</option>
                        </select>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#374151' }}>Categoría *</label>
                        <input name="itemCategory" type="text" defaultValue={editingInventoryItem ? editingInventoryItem.category : 'General'} placeholder="Ej. Lácteos y Quesos" required style={{ padding: '0.7rem 1rem', borderRadius: '12px', border: '1px solid #CBD5E0' }} />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#374151' }}>Stock *</label>
                        <input name="itemStock" type="number" step="0.1" defaultValue={editingInventoryItem ? editingInventoryItem.stock : 10} required style={{ padding: '0.7rem 1rem', borderRadius: '12px', border: '1px solid #CBD5E0' }} />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#374151' }}>Unidad *</label>
                        <input name="itemUnit" type="text" defaultValue={editingInventoryItem ? editingInventoryItem.unit : 'kg'} placeholder="kg, lt, uds" required style={{ padding: '0.7rem 1rem', borderRadius: '12px', border: '1px solid #CBD5E0' }} />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#374151' }}>Costo Unit. (S/) *</label>
                        <input name="itemCost" type="number" step="0.10" defaultValue={editingInventoryItem ? editingInventoryItem.cost : 12.50} required style={{ padding: '0.7rem 1rem', borderRadius: '12px', border: '1px solid #CBD5E0' }} />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
                      <button type="button" onClick={() => setShowAddInventoryModal(false)} style={{ padding: '12px', borderRadius: '12px', border: '1px solid #CBD5E0', background: '#FFF', color: '#475569', fontWeight: '700' }}>Cancelar</button>
                      <button type="submit" style={{ padding: '12px', borderRadius: '12px', border: 'none', background: '#2563EB', color: '#FFF', fontWeight: '800' }}>
                        {editingInventoryItem ? 'Guardar Cambios' : 'Crear Ítem'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

          </div>
        )}
      </div>
      </div>

      {showClientModal && (
        <div className="modal-overlay" onClick={() => setShowClientModal(false)}>
          <div className="modal-box client-modal" onClick={(e) => e.stopPropagation()} style={{ padding: '0', background: 'transparent', maxWidth: '600px', width: '90%' }}>
            <ClientManager
              clients={clients}
              onClientSelect={(client) => {
                setClientDNI(client.document);
                setClientName(client.name);
                setShowClientModal(false);
              }}
              onClientAdd={(client) => {
                setClients((prev) => [...prev, client]);
                setClientDNI(client.document);
                setClientName(client.name);
                setShowClientModal(false);
              }}
            />
          </div>
        </div>
      )}

      {showMovementsModal && (
        <div className="modal-overlay" onClick={() => setShowMovementsModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{
            background: '#FFFFFF',
            borderRadius: '24px',
            padding: '2rem',
            width: '90%',
            maxWidth: '750px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 50px rgba(0,0,0,0.15)',
            border: '1px solid #E2E8F0',
            fontFamily: "'Inter', sans-serif"
          }}>
            {/* Cabecera de la Modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E2E8F0', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '800', color: '#1D2433' }}>Gestión de Movimientos de Caja</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#718096' }}>Registra ingresos/egresos manuales y visualiza el historial de hoy</p>
              </div>
              <button 
                onClick={() => setShowMovementsModal(false)}
                style={{ background: '#F1F5F9', border: 'none', width: '32px', height: '32px', borderRadius: '50%', fontSize: '1.1rem', fontWeight: 'bold', color: '#718096', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ✕
              </button>
            </div>

            {/* Dos columnas: Izquierda Formulario, Derecha Historial de Hoy */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '1.5rem' }}>
              
              {/* Registrar Movimiento */}
              <div style={{ background: '#FEFBF6', border: '1px solid #EADDC9', borderRadius: '20px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', height: 'fit-content' }}>
                <span style={{ color: '#5C4033', fontSize: '0.9rem', fontWeight: '700' }}>Registrar Movimiento Manual</span>
                
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.target;
                  const type = form.movTypeModal.value;
                  const desc = form.movDescModal.value.trim();
                  const amt = parseFloat(form.movAmtModal.value);

                  if (!desc) {
                    alert('Ingrese una descripción');
                    return;
                  }
                  if (isNaN(amt) || amt <= 0) {
                    alert('Ingrese un monto mayor a 0');
                    return;
                  }

                  handleAddMovement(type, desc, amt);
                  form.reset();
                }} style={{ display: 'grid', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 'bold', color: '#718096' }}>TIPO DE MOVIMIENTO</label>
                    <select name="movTypeModal" style={{ padding: '10px', borderRadius: '8px', border: '1px solid #CBD5E0', background: '#FFFFFF', color: '#2D3748', fontSize: '0.85rem', fontWeight: '600' }}>
                      <option value="ingreso">Ingreso (+)</option>
                      <option value="egreso">Egreso (-)</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 'bold', color: '#718096' }}>MONTO (S/)</label>
                    <input name="movAmtModal" type="number" step="0.01" min="0.01" placeholder="Monto S/" required style={{ padding: '10px', borderRadius: '8px', border: '1px solid #CBD5E0', background: '#FFFFFF', fontSize: '0.85rem' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 'bold', color: '#718096' }}>CONCEPTO / DESCRIPCIÓN</label>
                    <input name="movDescModal" type="text" placeholder="Ej: Pago de delivery, compra de limones..." required style={{ padding: '10px', borderRadius: '8px', border: '1px solid #CBD5E0', background: '#FFFFFF', fontSize: '0.85rem' }} />
                  </div>
                  
                  <button type="submit" disabled={!isCashOpen} style={{ padding: '12px', background: isCashOpen ? 'var(--primary)' : '#CBD5E0', color: '#FFFFFF', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '0.9rem', cursor: isCashOpen ? 'pointer' : 'not-allowed', transition: 'background 0.2s', marginTop: '0.5rem', boxShadow: isCashOpen ? '0 4px 10px rgba(162, 66, 85, 0.2)' : 'none' }}>
                    Registrar en Caja
                  </button>
                </form>
              </div>

              {/* Historial de hoy */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <span style={{ color: '#1D2433', fontSize: '0.9rem', fontWeight: '700' }}>Movimientos de Hoy</span>
                
                <div style={{ overflowY: 'auto', maxHeight: '320px', display: 'flex', flexDirection: 'column', gap: '0.6rem', paddingRight: '4px' }}>
                  {cashMovements.length === 0 ? (
                    <div style={{ color: '#A0AEC0', fontSize: '0.85rem', textAlign: 'center', padding: '2rem 0' }}>No hay movimientos registrados hoy</div>
                  ) : (
                    cashMovements.map((mov) => {
                      const isVenta = mov.type === 'venta';
                      const isApertura = mov.type === 'apertura';
                      const isIngreso = mov.type === 'ingreso';
                      const isEgreso = mov.type === 'egreso';
                      
                      let typeLabel = 'Movimiento';
                      let amountSign = '';
                      let amountColor = '#1D2433';
                      let bgColor = '#F1F5F9';
                      let dotColor = '#94A3B8';

                      if (isApertura) {
                        typeLabel = 'Apertura';
                        amountColor = '#4F46E5';
                        bgColor = '#EEF2FF';
                        dotColor = '#4F46E5';
                      } else if (isVenta) {
                        typeLabel = 'Venta';
                        amountSign = '+';
                        amountColor = '#10B981';
                        bgColor = 'var(--primary-light)';
                        dotColor = '#10B981';
                      } else if (isIngreso) {
                        typeLabel = 'Ingreso Manual';
                        amountSign = '+';
                        amountColor = '#10B981';
                        bgColor = '#ECFDF5';
                        dotColor = '#10B981';
                      } else if (isEgreso) {
                        typeLabel = 'Egreso Manual';
                        amountSign = '-';
                        amountColor = '#EF4444';
                        bgColor = '#FEF2F2';
                        dotColor = '#EF4444';
                      }

                      return (
                        <div key={mov.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.8rem', background: bgColor, borderRadius: '12px', border: '1px solid rgba(0,0,0,0.02)', fontSize: '0.82rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxWidth: '65%' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: dotColor }}></span>
                              <strong style={{ color: '#1D2433' }}>{typeLabel}</strong>
                            </div>
                            <span style={{ color: '#718096', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={mov.description}>
                              {mov.description}
                            </span>
                            <small style={{ color: '#A0AEC0' }}>
                              {new Date(mov.date).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                            </small>
                          </div>
                          <strong style={{ color: amountColor, fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                            {amountSign} S/ {mov.amount.toFixed(2)}
                          </strong>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Modal para Abrir Caja */}
      {showOpenCashModal && (
        <div className="modal-overlay" onClick={() => setShowOpenCashModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{
            background: '#FFFFFF',
            borderRadius: '24px',
            padding: '2rem',
            width: '90%',
            maxWidth: '440px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.15)',
            border: '1px solid #E5E7EB',
            fontFamily: "'Plus Jakarta Sans', sans-serif"
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E5E7EB', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '800', color: '#111827', display: 'flex', alignItems: 'center', gap: '8px' }}>
                Apertura de Caja
              </h3>
              <button onClick={() => setShowOpenCashModal(false)} style={{ background: '#F3F4F6', border: 'none', width: '32px', height: '32px', borderRadius: '50%', fontSize: '1.1rem', cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              const amt = parseFloat(openCashAmountInput);
              if (isNaN(amt) || amt < 0) {
                alert('Por favor ingrese un monto válido');
                return;
              }
              setInitialCash(amt);
              setCashRegister(amt);
              setIsCashOpen(true);
              localStorage.setItem('shari-initial-cash', amt.toString());
              localStorage.setItem('shari-cash', amt.toString());
              localStorage.setItem('shari-cash-open', 'true');
              setCashMovements([
                {
                  id: `MOV-${Date.now()}`,
                  type: 'apertura',
                  description: 'Apertura de caja inicial',
                  amount: amt,
                  paymentMethod: 'Efectivo',
                  date: new Date().toISOString(),
                },
              ]);
              setShowOpenCashModal(false);
            }} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#374151' }}>Monto Inicial de Efectivo en Caja (S/)</label>
                <input
                  type="number"
                  step="0.10"
                  min="0"
                  value={openCashAmountInput}
                  onChange={(e) => setOpenCashAmountInput(e.target.value)}
                  placeholder="500.00"
                  required
                  style={{ padding: '0.8rem 1rem', borderRadius: '12px', border: '1px solid #D1D5DB', fontSize: '1.2rem', fontWeight: '800', color: '#111827', outline: 'none' }}
                />
                <span style={{ fontSize: '0.78rem', color: '#6B7280' }}>Ingrese el dinero en efectivo con el que inicia el turno en la gaveta.</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowOpenCashModal(false)} style={{ padding: '12px', borderRadius: '12px', border: '1px solid #D1D5DB', background: '#FFF', color: '#4B5563', fontWeight: '700', cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" style={{ padding: '12px', borderRadius: '12px', border: 'none', background: '#FF5500', color: '#FFF', fontWeight: '800', cursor: 'pointer', boxShadow: '0 4px 12px rgba(255,85,0,0.25)' }}>Abrir Caja</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para Cerrar Caja (Arqueo) */}
      {showCloseCashModal && (
        <div className="modal-overlay" onClick={() => setShowCloseCashModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{
            background: '#FFFFFF',
            borderRadius: '24px',
            padding: '2rem',
            width: '90%',
            maxWidth: '480px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.15)',
            border: '1px solid #E2E8F0',
            fontFamily: "'Plus Jakarta Sans', sans-serif"
          }}>
            {/* Cabecera */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E2E8F0', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '800', color: '#1D2433', display: 'flex', alignItems: 'center', gap: '8px' }}>
                Arqueo & Cierre de Caja
              </h3>
              <button 
                onClick={() => setShowCloseCashModal(false)}
                style={{ background: '#F1F5F9', border: 'none', width: '32px', height: '32px', borderRadius: '50%', fontSize: '1.1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ✕
              </button>
            </div>

            {/* Arqueo Detallado */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ background: '#FAF9F6', padding: '1.2rem', borderRadius: '16px', border: '1px solid #E5E7EB', display: 'grid', gap: '0.6rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem' }}>
                  <span style={{ color: '#6B7280', fontWeight: '500' }}>(+) Monto Inicial Apertura:</span>
                  <strong style={{ color: '#111827', fontWeight: '700' }}>S/ {initialCash.toFixed(2)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem' }}>
                  <span style={{ color: '#6B7280', fontWeight: '500' }}>(+) Ventas Efectivo Hoy:</span>
                  <strong style={{ color: '#10B981', fontWeight: '700' }}>+ S/ {cashSales.toFixed(2)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem' }}>
                  <span style={{ color: '#6B7280', fontWeight: '500' }}>(+) Ingresos Manuales:</span>
                  <strong style={{ color: '#10B981', fontWeight: '700' }}>+ S/ {totalIngresos.toFixed(2)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem' }}>
                  <span style={{ color: '#6B7280', fontWeight: '500' }}>(-) Egresos Manuales:</span>
                  <strong style={{ color: '#EF4444', fontWeight: '700' }}>- S/ {totalEgresos.toFixed(2)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', borderTop: '1px dashed #D1D5DB', paddingTop: '0.6rem', marginTop: '0.2rem' }}>
                  <span style={{ fontWeight: '800', color: '#111827' }}>Efectivo Esperado en Caja:</span>
                  <strong style={{ fontWeight: '900', color: '#FF5500' }}>S/ {dineroEsperadoCaja.toFixed(2)}</strong>
                </div>
              </div>

              {/* Input Efectivo Real en Caja */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#374151' }}>Efectivo Real Contado en Caja (S/)</label>
                <input
                  type="number"
                  step="0.10"
                  value={closeCashRealAmount}
                  onChange={(e) => setCloseCashRealAmount(e.target.value)}
                  placeholder={dineroEsperadoCaja.toFixed(2)}
                  style={{ padding: '0.8rem 1rem', borderRadius: '12px', border: '1px solid #D1D5DB', fontSize: '1.1rem', fontWeight: '800', color: '#111827' }}
                />
              </div>

              {/* Cálculo de Cuadre / Diferencia */}
              {closeCashRealAmount !== '' && (() => {
                const counted = parseFloat(closeCashRealAmount) || 0;
                const diff = counted - dineroEsperadoCaja;
                const isExact = Math.abs(diff) < 0.01;
                const isSurplus = diff > 0.01;
                return (
                  <div style={{ 
                    padding: '0.8rem 1rem', 
                    borderRadius: '12px', 
                    background: isExact ? '#ECFDF5' : isSurplus ? '#EFF6FF' : '#FEF2F2',
                    border: `1px solid ${isExact ? '#A7F3D0' : isSurplus ? '#BFDBFE' : '#FECACA'}`,
                    display: 'flex',
                    justify: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.85rem'
                  }}>
                    <span style={{ fontWeight: '700', color: isExact ? '#065F46' : isSurplus ? '#1E40AF' : '#991B1B' }}>
                      {isExact ? 'Cuadre Perfecto' : isSurplus ? 'Sobrante en Caja' : 'Faltante en Caja'}
                    </span>
                    <strong style={{ fontSize: '1rem', color: isExact ? '#065F46' : isSurplus ? '#1E40AF' : '#991B1B' }}>
                      {isExact ? 'S/ 0.00' : `${diff > 0 ? '+' : ''} S/ ${diff.toFixed(2)}`}
                    </strong>
                  </div>
                );
              })()}
            </div>

            {/* Acciones */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '1rem' }}>
              <button 
                onClick={() => setShowCloseCashModal(false)}
                style={{ padding: '12px', border: '1px solid #CBD5E0', background: '#FFFFFF', color: '#4A5568', borderRadius: '12px', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button 
                onClick={() => {
                  setShowCloseCashModal(false);
                  closeCashRegister();
                  setCloseCashRealAmount('');
                }}
                style={{ padding: '12px', border: 'none', background: '#EF4444', color: '#FFFFFF', borderRadius: '12px', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer', boxShadow: '0 4px 10px rgba(239, 68, 68, 0.2)' }}
              >
                Confirmar y Cerrar Caja
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingReceipt && (
        <ReceiptDisplay
          receipt={viewingReceipt}
          onClose={() => setViewingReceipt(null)}
        />
      )}
    </div>
  );
}

export default App;
