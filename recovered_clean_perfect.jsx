import { useEffect, useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Title,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

import LoginForm from './components/LoginForm';
import ClientManager from './components/ClientManager';
import ReceiptDisplay from './components/ReceiptDisplay';

import { validatePassword, hasPermission, rolePermissions } from './utils/auth';
import {
  createClient,
  findClientByDocument,
  recordClientPurchase,
  validateDocument,
  getDocumentType,
} from './utils/clients';
import { createReceipt } from './utils/billing';

import './App.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Title
);

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
  { id: 'cash', label: 'Efectivo', icon: '💵' },
  { id: 'debit', label: 'Tarjeta Débito', icon: '🏧' },
  { id: 'credit', label: 'Tarjeta Crédito', icon: '💳' },
  { id: 'yape', label: 'Yape', icon: '📱' },
  { id: 'plin', label: 'Plin', icon: '📲' },
];

const fallbackImage = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=500&q=80';
const roleTabs = {
  Administrador: ['Inicio', 'POS', 'Historial', 'Gráficos', 'Clientes', 'Productos', 'Categorías', 'Usuarios'],
  Cajero: ['Inicio', 'POS', 'Historial', 'Clientes'],
  Cocina: ['POS', 'Historial'],
};

// Se remueve bcrypt del frontend para evitar fallos de ejecución en navegador
const defaultUsers = [
  {
    id: 'USR-1',
    name: 'Administrador Shari',
    email: 'admin@sharisushi.pe',
    role: 'Administrador',
    demoPassword: 'Admin123!',
    status: 'activo',
  },
  {
    id: 'USR-2',
    name: 'Cajero Shari',
    email: 'cajero@sharisushi.pe',
    role: 'Cajero',
    demoPassword: 'Cajero123!',
    status: 'activo',
  },
  {
    id: 'USR-3',
    name: 'Cocina Shari',
    email: 'cocina@sharisushi.pe',
    role: 'Cocina',
    demoPassword: 'Cocina123!',
    status: 'activo',
  },
];

function App() {
  const [activeTab, setActiveTab] = useState('Inicio');
  const [products, setProducts] = useState(() => {
    const saved = localStorage.getItem('shari-products');
    return saved ? JSON.parse(saved) : mockProducts;
  });
  const [categoriesList, setCategoriesList] = useState(() => {
    const saved = localStorage.getItem('shari-categories');
    return saved ? JSON.parse(saved) : categories;
  });
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [cart, setCart] = useState([]);
  const [cashInput, setCashInput] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState('percentage');
  const [notes, setNotes] = useState('');
  const [tableNumber, setTableNumber] = useState('1');
  const [isCashOpen, setIsCashOpen] = useState(true);
  const [initialCash, setInitialCash] = useState(500);
  const [clientDNI, setClientDNI] = useState('');
  const [clientName, setClientName] = useState('');
  const [showClientModal, setShowClientModal] = useState(false);

  const [cashRegister, setCashRegister] = useState(() => {
    const saved = localStorage.getItem('shari-cash');
    return saved ? parseFloat(saved) : 500;
  });
  const [salesHistory, setSalesHistory] = useState(() => {
    const saved = localStorage.getItem('shari-sales');
    return saved ? JSON.parse(saved) : [];
  });
  const [cashMovements, setCashMovements] = useState(() => {
    const saved = localStorage.getItem('shari-movements');
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedSale, setSelectedSale] = useState(null);
  const [selectedCashSale, setSelectedCashSale] = useState(null);
  const [users, setUsers] = useState(() => {
    const saved = localStorage.getItem('shari-users');
    return saved ? JSON.parse(saved) : defaultUsers;
  });
  const [clients, setClients] = useState(() => {
    const saved = localStorage.getItem('shari-clients');
    return saved ? JSON.parse(saved) : [];
  });
  const [viewingReceipt, setViewingReceipt] = useState(null);

  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('shari-user');
    if (saved) {
      try {
        const user = JSON.parse(saved);
        if (user.loginTime && Date.now() - new Date(user.loginTime).getTime() < 28800000) {
          return user;
        }
      } catch (e) {
        console.error(e);
      }
    }
    return null;
  });

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('shari-user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('shari-user');
    }
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('shari-users', JSON.stringify(users));
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
    localStorage.setItem('shari-products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('shari-categories', JSON.stringify(categoriesList));
  }, [categoriesList]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesCategory = activeCategory === 'Todos' || product.category === activeCategory;
      const matchesSearch =
        product.name.toLowerCase().includes(search.toLowerCase()) ||
        product.code.toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [products, activeCategory, search]);

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
      current.map((item) => (item.id === productId ? { ...item, quantity: qty } : item))
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

  const discountValue =
    discountType === 'percentage'
      ? Math.min((subtotal * validDiscount) / 100, subtotal)
      : Math.min(validDiscount, subtotal);

  const netAmount = Math.max(0, subtotal - discountValue);
  const tax = Number((netAmount * 0.18).toFixed(2));
  const total = Math.max(0, Number((netAmount + tax).toFixed(2)));
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

    if (!clientDNI.trim() || !clientName.trim()) {
      alert('Por favor ingrese datos del cliente');
      setShowClientModal(true);
      return;
    }

    const docValidation = validateDocument ? validateDocument(clientDNI) : { valid: clientDNI.length >= 8, formatted: clientDNI };
    if (!docValidation.valid) {
      alert(`Documento inválido: ${docValidation.message || 'Verifique DNI o RUC'}`);
      setShowClientModal(true);
      return;
    }

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
    const docType = getDocumentType ? getDocumentType(clientDNI) : 'DOC';
    const receiptType = docType === 'RUC' ? 'FACTURA' : 'BOLETA';

    const receiptData = {
      receiptType,
      clientName,
      clientDocument: docValidation.formatted || clientDNI,
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

    const newReceipt = createReceipt ? createReceipt(receiptData) : { ...receiptData, id: `ORD-${Date.now()}`, createdAt: new Date().toISOString() };
    newReceipt.timestamp = newReceipt.createdAt || new Date().toISOString();

    const movement = {
      id: `MOV-${Date.now()}`,
      type: 'venta',
      description: `Venta ${newReceipt.id} - ${paymentLabel}`,
      amount: total,
      paymentMethod: paymentLabel,
      date: new Date().toISOString(),
      saleId: newReceipt.id,
    };

    if (paymentMethod === 'cash') {
      setCashRegister((prev) => prev + total);
      setCashMovements((prev) => [movement, ...prev]);
    }

    setProducts((prevProducts) => {
      return prevProducts.map((p) => {
        const cartItem = cart.find((item) => item.id === p.id);
        if (cartItem) {
          const newStock = Math.max(0, p.stock - cartItem.quantity);
          return { ...p, stock: newStock };
        }
        return p;
      });
    });

    setClients((prevClients) => {
      return prevClients.map((c) => {
        if (c.document === newReceipt.clientDocument) {
          return recordClientPurchase ? recordClientPurchase(c, newReceipt.total) : c;
        }
        return c;
      });
    });

    setSalesHistory((prev) => [newReceipt, ...prev]);
    setViewingReceipt(newReceipt);
    clearCart();
    setClientDNI('');
    setClientName('');
  };

  const saveOrder = () => {
    if (cart.length === 0) {
      alert('❌ El carrito está vacío');
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
    if (isNaN(amt) || amt < 0 || amt > 999999) {
      alert('Ingrese un monto válido');
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

    const todaySalesList = salesHistory.filter((s) => new Date(s.timestamp).toDateString() === new Date().toDateString());
    const cashSales = todaySalesList.filter((s) => s.paymentMethod === 'Efectivo').reduce((sum, s) => sum + s.total, 0);
    const expected = initialCash + cashSales;
    const diff = Math.round((cashRegister - expected) * 100) / 100;

    const msg = `╔════════════════════════════════╗
║       CIERRE DE CAJA           ║
╚════════════════════════════════╝

Monto Inicial: S/ ${initialCash.toFixed(2)}
Ventas en Efectivo: S/ ${cashSales.toFixed(2)}
───────────────────────────────
Esperado: S/ ${expected.toFixed(2)}
Actual: S/ ${cashRegister.toFixed(2)}
───────────────────────────────
Diferencia: S/ ${diff.toFixed(2)}

${Math.abs(diff) < 0.01 ? 'CAJA BALANCEADA CORRECTAMENTE' : diff > 0 ? 'SOBRANTE EN CAJA' : 'FALTANTE EN CAJA'}`;

    alert(msg);
    setIsCashOpen(false);
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

    setCashRegister((prev) => prev + (type === 'ingreso' ? amount : -amount));
    setCashMovements((prev) => [movement, ...prev]);
    alert(`Movimiento registrado: ${type === 'ingreso' ? 'Ingreso' : 'Egreso'} de S/ ${amount.toFixed(2)}`);
  };

  const todaySales = salesHistory.filter((s) => new Date(s.timestamp).toDateString() === new Date().toDateString());
  const todayPaidSales = todaySales.filter((s) => !s.saved && !s.kitchen);
  const salaVentaHoy = todayPaidSales.reduce((sum, s) => sum + s.total, 0);
  const totalPedidos = todaySales.length;

  const todayMovements = cashMovements.filter(
    (m) => new Date(m.date).toDateString() === new Date().toDateString()
  );
  const totalIngresos = todayMovements.filter((m) => m.type === 'ingreso').reduce((sum, m) => sum + m.amount, 0);
  const totalEgresos = todayMovements.filter((m) => m.type === 'egreso').reduce((sum, m) => sum + m.amount, 0);

  const cashSales = todayPaidSales.filter((s) => s.paymentMethod === 'Efectivo').reduce((sum, s) => sum + s.total, 0);
  const dineroEsperadoCaja = initialCash + cashSales + totalIngresos - totalEgresos;

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

  if (!currentUser) {
    return (
      <LoginForm
        users={users}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          if (user.role === 'Cocina') {
            setActiveTab('Historial');
          } else {
            setActiveTab('POS');
          }
        }}
        onRegisterUser={(newUser) => {
          setUsers((prev) => [...prev, newUser]);
        }}
      />
    );
  }

  const availableTabs = roleTabs[currentUser.role] || ['POS'];

  const tabIcons = {
    Inicio: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
    POS: (
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
    Gráficos: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
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
    Categorías: (
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

  return (
    <div className="app-container" style={{ display: 'grid', gridTemplateColumns: '90px 1fr', minHeight: '100vh', background: '#F5F7FA' }}>
      <aside className="sidebar-nav" style={{
        background: '#FFFFFF',
        borderRight: '1px solid #E2E8F0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '2rem 0',
        justify: 'space-between',
        height: '100vh',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{ fontSize: '2rem', cursor: 'pointer' }} onClick={() => setActiveTab('Inicio')}>
          🍣
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', alignItems: 'center' }}>
          {availableTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              title={tab}
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                border: 'none',
                background: activeTab === tab ? '#E6F6F4' : 'transparent',
                color: activeTab === tab ? '#00B090' : '#718096',
                fontSize: '1.6rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: activeTab === tab ? '0 4px 10px rgba(0, 176, 144, 0.1)' : 'none'
              }}
            >
              {tabIcons[tab] || '⭐'}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.8rem' }}>
          <img
            src={currentUser.avatar || fallbackImage}
            alt={currentUser.name}
            onError={handleImageError}
            style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #E2E8F0', cursor: 'pointer' }}
            title={`${currentUser.name} (${currentUser.role}) • Click para cerrar sesión`}
            onClick={() => {
              if (confirm('¿Desea cerrar sesión?')) {
                setCurrentUser(null);
              }
            }}
          />
        </div>
      </aside>

      <div className="content-container" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflowY: 'auto' }}>
        <header style={{
          background: '#FFFFFF',
          borderBottom: '1px solid #E2E8F0',
          padding: '1rem 2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 90
        }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.25rem', color: '#1A202C', fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: '800', letterSpacing: '0.5px' }}>SHARI SUSHI</h1>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#718096' }}>Auténtico Sabor Japonés</p>
          </div>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            <div style={{ background: '#F7FAFC', border: '1px solid #E2E8F0', padding: '6px 12px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: isCashOpen ? '#48BB78' : '#F56565'
              }}></span>
              <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#4A5568' }}>
                CAJA: S/ {cashRegister.toFixed(2)}
              </span>
            </div>
            <div style={{ fontSize: '0.85rem', color: '#718096', display: 'flex', gap: '12px' }}>
              <span>{todayStats.totalSales} Ventas</span>
              <span>{pendingOrders} Pendientes</span>
            </div>
          </div>
        </header>

        <div className="main-layout" style={{ display: 'flex', padding: '2rem', gap: '2rem', flex: 1, minHeight: 0, background: '#FAF8F7' }}>
          {activeTab === 'Inicio' && (
            <div className="full-section inicio-view" style={{ fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.8rem', fontWeight: '800', color: '#1D2433', margin: 0, fontFamily: "'Inter', sans-serif" }}>Panel de Control</h2>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#718096' }}>
                    Usuario activo: <strong>{currentUser.name} ({currentUser.role})</strong>
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                  <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', padding: '6px 14px', borderRadius: '10px', fontSize: '0.85rem', color: '#4A5568', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#718096' }}><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                    <span>{new Date().toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })}</span>
                  </div>
                  <button
                    onClick={openCashRegister}
                    disabled={isCashOpen}
                    style={{
                      padding: '8px 16px',
                      background: isCashOpen ? '#F1F5F9' : '#00B090',
                      color: isCashOpen ? '#94A3B8' : '#FFFFFF',
                      border: isCashOpen ? '1px solid #E2E8F0' : 'none',
                      borderRadius: '10px',
                      fontWeight: 'bold',
                      fontSize: '0.82rem',
                      cursor: isCashOpen ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: isCashOpen ? 'none' : '0 4px 10px rgba(0, 176, 144, 0.15)'
                    }}
                  >
                    📂 Abrir Caja
                  </button>
                  <button
                    onClick={closeCashRegister}
                    disabled={!isCashOpen}
                    style={{
                      padding: '8px 16px',
                      background: !isCashOpen ? '#F1F5F9' : '#EF4444',
                      color: !isCashOpen ? '#94A3B8' : '#FFFFFF',
                      border: !isCashOpen ? '1px solid #E2E8F0' : 'none',
                      borderRadius: '10px',
                      fontWeight: 'bold',
                      fontSize: '0.82rem',
                      cursor: !isCashOpen ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: !isCashOpen ? 'none' : '0 4px 10px rgba(239, 68, 68, 0.15)'
                    }}
                  >
                    🔒 Cerrar Caja
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
                <div className="kpi-card" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#718096' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '1.25rem' }}>🏪</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>Sala Venta de Hoy</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '1.8rem', fontWeight: '800', color: '#1D2433' }}>S/ {salaVentaHoy.toFixed(2)}</span>
                    <span style={{ color: '#718096', fontSize: '0.78rem', fontWeight: '500' }}>
                      {todayPaidSales.length} ventas cobradas
                    </span>
                  </div>
                </div>

                <div className="kpi-card" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#718096' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '1.25rem' }}>📋</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>Pedidos</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '1.8rem', fontWeight: '800', color: '#1D2433' }}>{totalPedidos}</span>
                    <span style={{ color: '#718096', fontSize: '0.78rem', fontWeight: '500' }}>
                      {todayStats.verified} verif. • {todayStats.pending} pend.
                    </span>
                  </div>
                </div>

                <div className="kpi-card" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#718096' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '1.25rem' }}>💸</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#EF4444' }}>Egresos (Caja)</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '1.8rem', fontWeight: '800', color: '#EF4444' }}>S/ {totalEgresos.toFixed(2)}</span>
                    <span style={{ color: '#718096', fontSize: '0.78rem', fontWeight: '500' }}>Salidas manuales de caja</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'POS' && (
            <>
              <main className="content-area" style={{ flexGrow: 1, paddingRight: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <div>
                    <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", margin: 0, fontSize: '1.8rem', color: '#1A202C', fontWeight: '800' }}>Time to Sushi!</h2>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#718096' }}>Selecciona los mejores platillos para la orden</p>
                  </div>
                  <div className="search-box">
                    <input
                      type="text"
                      placeholder="🔍 Buscar sushi..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="search-input"
                    />
                  </div>
                </div>

                <div className="filter-bar">
                  {categoriesList.map((cat) => (
                    <button
                      key={cat}
                      className={activeCategory === cat ? 'pill-btn active' : 'pill-btn'}
                      onClick={() => setActiveCategory(cat)}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <div className="products-grid">
                  {filteredProducts.length === 0 ? (
                    <div className="no-results">No se encontraron productos</div>
                  ) : (
                    filteredProducts.map((product) => (
                      <div
                        key={product.id}
                        className={`product-card ${product.stock === 0 ? 'disabled' : ''}`}
                      >
                        <div className="product-image">
                          <img src={product.image || fallbackImage} alt={product.name} onError={handleImageError} />
                        </div>
                        <div className="product-copy">
                          <span className="code">{product.code}</span>
                          <h4>{product.name}</h4>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                            <span className="price">S/ {product.price.toFixed(2)}</span>
                            <span style={{ fontSize: '0.8rem', color: product.stock <= 5 ? '#E53E3E' : '#718096', fontWeight: 'bold' }}>
                              {product.stock === 0 ? 'Agotado' : `${product.stock} un`}
                            </span>
                          </div>
                          <button
                            onClick={() => product.stock > 0 && addToCart(product)}
                            disabled={product.stock === 0}
                            className="btn-add-cart"
                          >
                            {product.stock === 0 ? 'Agotado' : '+ Agregar'}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </main>

              <aside className="cart-panel" style={{ width: '380px', flexShrink: 0, background: '#FFF', borderRadius: '24px', padding: '1.5rem', border: '1px solid #E2E8F0' }}>
                <div className="cart-top" style={{ borderBottom: '1px solid #E2E8F0', paddingBottom: '1rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '700' }}>Detalle de Pedido</h2>
                    <span className="subtitle" style={{ color: '#718096', fontSize: '0.85rem' }}>{cart.length} artículos agregados</span>
                  </div>
                  <button onClick={clearCart} style={{ background: 'none', border: 'none', color: '#E53E3E', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer' }}>
                    🧹 Limpiar
                  </button>
                </div>

                <div className="cart-items" style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem', minHeight: '150px' }}>
                  {cart.length === 0 ? (
                    <div className="empty-msg" style={{ padding: '2rem 0', color: '#A0AEC0', textAlign: 'center' }}>El carrito está vacío</div>
                  ) : (
                    cart.map((item) => (
                      <div key={`cart-item-${item.id}`} className="cart-item" style={{ display: 'flex', gap: '0.8rem', padding: '0.8rem 0', borderBottom: '1px solid #F0F4F8' }}>
                        <div className="item-details" style={{ flex: 1 }}>
                          <div className="item-name" style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#2D3748' }}>{item.name}</div>
                          <div className="item-meta" style={{ fontSize: '0.78rem', color: '#718096' }}>S/ {item.price.toFixed(2)} c/u</div>
                          <div className="qty-controls" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                            <button onClick={() => updateQuantity(item.id, item.quantity - 1)}>-</button>
                            <span>{item.quantity}</span>
                            <button onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</button>
                          </div>
                        </div>
                        <div className="item-right">
                          <div className="item-price" style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>S/ {(item.quantity * item.price).toFixed(2)}</div>
                          <button onClick={() => removeFromCart(item.id)} className="delete-btn">✕</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="summary" style={{ background: '#F8FAFC', padding: '1rem', borderRadius: '16px', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span>Subtotal</span>
                    <strong>S/ {subtotal.toFixed(2)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', marginTop: '0.5rem' }}>
                    <span style={{ fontWeight: 'bold' }}>Total</span>
                    <strong style={{ color: '#00B090' }}>S/ {total.toFixed(2)}</strong>
                  </div>
                </div>

                <button onClick={processPayment} disabled={cart.length === 0} className="btn-pay" style={{ width: '100%', padding: '12px', background: cart.length === 0 ? '#CBD5E0' : '#00B090', color: '#FFF', border: 'none', borderRadius: '12px', fontWeight: 'bold' }}>
                  📥 COBRAR PEDIDO
                </button>
              </aside>
            </>
          )}

          {activeTab === 'Clientes' && (
            <div className="full-section clients-view" style={{ background: '#FFF', borderRadius: '24px', padding: '2rem', width: '100%' }}>
              <ClientManager
                clients={clients}
                onClientSelect={(client) => {
                  setClientDNI(client.document);
                  setClientName(client.name);
                  setActiveTab('POS');
                }}
                onClientAdd={(client) => {
                  setClients((prev) => [...prev, client]);
                  setClientDNI(client.document);
                  setClientName(client.name);
                  setActiveTab('POS');
                }}
              />
            </div>
          )}

          {activeTab === 'Historial' && (
            <div className="full-section">
              <h2>HISTORIAL DE VENTAS ({salesHistory.length})</h2>
              <div className="history-list">
                {salesHistory.length === 0 ? (
                  <div className="empty-msg">Sin registros</div>
                ) : (
                  salesHistory.map((sale) => (
                    <div key={sale.id} className={`history-item ${sale.verified ? 'verified' : 'pending'}`}>
                      <div className="item-header">
                        <strong>{sale.id}</strong>
                        <span>{new Date(sale.timestamp).toLocaleTimeString('es-PE')}</span>
                        <span className="amount">S/ {sale.total.toFixed(2)}</span>
                      </div>
                      <div className="item-actions">
                        {!sale.verified && (
                          <button onClick={() => verifySale(sale.id)} className="mini-btn verify">Verificar</button>
                        )}
                        <button onClick={() => setViewingReceipt(sale)} className="mini-btn">Detalles</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {showClientModal && (
        <div className="modal" onClick={() => setShowClientModal(false)}>
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