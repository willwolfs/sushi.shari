import React, { useEffect, useMemo, useState } from 'react';
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

// Componentes
import LoginForm from './components/LoginForm';
import ClientManager from './components/ClientManager';
import ReceiptDisplay from './components/ReceiptDisplay';

// Utilidades
import { validatePassword, hasPermission, rolePermissions } from './utils/auth';
import {
  createClient,
  findClientByDocument,
  recordClientPurchase,
  validateDocument,
  getDocumentType,
} from './utils/clients';
import { createReceipt } from './utils/billing';

// Estilos
import './App.css';

// Registro de ChartJS
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
  Administrador: ['POS', 'Caja', 'Reportes', 'Historial', 'Clientes'],
  Cajero: ['POS', 'Caja', 'Historial', 'Clientes'],
  Cocina: ['Historial'],
};

function App() {
  const [activeTab, setActiveTab] = useState('POS');
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

  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('shari-user');
    if (saved) return JSON.parse(saved);
    return {
      id: 'USR-1',
      name: 'Administrador Shari',
      email: 'admin@sharisushi.pe',
      role: 'Administrador',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80',
      sessionId: `SES-${Date.now()}`,
    };
  });

  useEffect(() => {
    localStorage.setItem('shari-user', JSON.stringify(currentUser));
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('shari-cash', cashRegister.toString());
  }, [cashRegister]);

  useEffect(() => {
    localStorage.setItem('shari-sales', JSON.stringify(salesHistory));
  }, [salesHistory]);

  useEffect(() => {
    localStorage.setItem('shari-movements', JSON.stringify(cashMovements));
  }, [cashMovements]);

  const filteredProducts = useMemo(() => {
    return mockProducts.filter((product) => {
      const matchesCategory = activeCategory === 'Todos' || product.category === activeCategory;
      const matchesSearch =
        product.name.toLowerCase().includes(search.toLowerCase()) ||
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
    const product = mockProducts.find((p) => p.id === productId);
    if (!product) return;

    if (qty > product.stock) {
      alert(`⚠️ Stock disponible: ${product.stock}`);
      return;
    }
    if (qty > 999) {
      alert('⚠️ Cantidad máxima: 999');
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

  const generateReceiptText = (sale) => {
    const date = new Date(sale.timestamp).toLocaleString('es-PE');
    const docType = getDocumentType ? getDocumentType(sale.clientDNI) : 'DOC';
    const clean = sale.clientDNI.replace(/\D/g, '');

    let receipt = `╔════════════════════════════════════════════╗
║                                            ║
║            🍣 SHARI SUSHI 🍣               ║
║     AUTÉNTICO SABOR JAPONÉS                ║
║     SHARI MAKI, S.L.                       ║
║                                            ║
║  RUC: 20-123456789 | TEL: 555-1234         ║
║  www.sharisushi.pe                         ║
║                                            ║
╚════════════════════════════════════════════╝

─────────────────────────────────────────────
COMPROBANTE DE VENTA
─────────────────────────────────────────────

REFERENCIA: ${sale.id}
${docType}: ${clean}
CLIENTE: ${sale.clientName || 'CLIENTE FRECUENTE'}
MESA: ${sale.table}

FECHA: ${date}
ESTADO: ${sale.verified ? '✓ VERIFICADO' : '⏳ PENDIENTE'}

─────────────────────────────────────────────
ITEMS                           CANT     MONTO
─────────────────────────────────────────────`;

    sale.items.forEach((item) => {
      const itemTotal = item.quantity * item.price;
      const name = item.name.substring(0, 28).padEnd(28);
      const qty = item.quantity.toString().padStart(4);
      const price = itemTotal.toFixed(2).padStart(8);
      receipt += `\n${name} ${qty} S/ ${price}`;
    });

    receipt += `\n─────────────────────────────────────────────`;
    receipt += `\nSubtotal:                        S/ ${sale.subtotal.toFixed(2).padStart(8)}`;

    if (sale.discountValue > 0) {
      receipt += `\nDescuento (${sale.discount}${sale.discountType === 'percentage' ? '%' : 'S/'}):       -S/ ${sale.discountValue.toFixed(2).padStart(7)}`;
    }

    receipt += `\nIGV (18%):                     S/ ${sale.tax.toFixed(2).padStart(8)}`;
    receipt += `\n═════════════════════════════════════════════
TOTAL A PAGAR:                   S/ ${sale.total.toFixed(2).padStart(8)}
═════════════════════════════════════════════`;

    receipt += `\nMÉTODO DE PAGO: ${sale.paymentMethod}`;

    if (sale.paymentMethod === 'Efectivo') {
      receipt += `\nEfectivo Recibido:               S/ ${sale.cashReceived.toFixed(2)}`;
      receipt += `\nCambio/Vuelto:                   S/ ${sale.change.toFixed(2)}`;
    }

    if (sale.notes) {
      receipt += `\n\nNOTAS: ${sale.notes}`;
    }

    receipt += `\n═════════════════════════════════════════════
           ¡GRACIAS POR SU COMPRA!
           
    Esperamos su próxima visita
    Visítenos en redes sociales
             @sharisushi
             
═════════════════════════════════════════════

${new Date(sale.timestamp).toLocaleTimeString('es-PE')}`;

    return receipt;
  };

  const printReceipt = (sale) => {
    const receipt = generateReceiptText(sale);
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Recibo ${sale.id}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Courier New', 'Courier', monospace; background: #fff; color: #000; line-height: 1.4; }
            .receipt { padding: 10px; max-width: 80mm; margin: 0 auto; white-space: pre-wrap; word-wrap: break-word; font-size: 11px; }
            @media print { * { margin: 0 !important; padding: 0 !important; } body { margin: 0; padding: 0; } .receipt { padding: 0; margin: 0; page-break-after: avoid; } @page { margin: 0; size: 80mm auto; } }
          </style>
        </head>
        <body>
          <div class="receipt">${receipt}</div>
          <script>
            window.addEventListener('load', () => { window.print(); setTimeout(() => window.close(), 500); });
            window.addEventListener('afterprint', () => { window.close(); });
          </script>
        </body>
      </html>
    `;

    try {
      const printWin = window.open('', '_blank');
      if (printWin) {
        printWin.document.write(htmlContent);
        printWin.document.close();
      } else {
        alert('⚠️ El navegador bloqueó la ventana de impresión.\nPor favor, permite ventanas emergentes.');
      }
    } catch (e) {
      alert('❌ Error al imprimir: ' + e.message);
    }
  };

  const processPayment = () => {
    if (cart.length === 0) {
      alert('❌ El carrito está vacío');
      return;
    }

    if (!clientDNI.trim() || !clientName.trim()) {
      alert('⚠️ Por favor ingrese datos del cliente');
      setShowClientModal(true);
      return;
    }

    if (validateDocument && !validateDocument(clientDNI)) {
      alert('❌ DNI/RUC inválido\nDNI: 8 dígitos | RUC: 11 dígitos');
      setShowClientModal(true);
      return;
    }

    if (!isCashOpen) {
      alert('❌ Debe abrir la caja primero');
      return;
    }

    if (paymentMethod === 'cash' && cashValue < total) {
      alert(`❌ Dinero insuficiente\nFalta: S/ ${(total - cashValue).toFixed(2)}`);
      return;
    }

    if (isNaN(total) || total < 0) {
      alert('❌ Error en el cálculo del total');
      return;
    }

    const paymentLabel = paymentMethods.find((m) => m.id === paymentMethod)?.label || 'Desconocido';
    const newSale = {
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
      paymentMethod: paymentLabel,
      cashReceived: paymentMethod === 'cash' ? cashValue : total,
      change: paymentMethod === 'cash' ? change : 0,
      notes,
      timestamp: new Date().toISOString(),
      verified: false,
    };

    const movement = {
      id: `MOV-${Date.now()}`,
      type: 'venta',
      description: `Venta ${newSale.id} - ${paymentLabel}`,
      amount: total,
      paymentMethod: paymentLabel,
      date: new Date().toISOString(),
      saleId: newSale.id,
    };

    if (paymentMethod === 'cash') {
      setCashRegister((prev) => prev + total);
      setCashMovements((prev) => [movement, ...prev]);
    }

    if (recordClientPurchase) {
      recordClientPurchase(clientDNI, newSale);
    }

    setSalesHistory((prev) => [newSale, ...prev]);
    printReceipt(newSale);
    alert(`✓ Venta procesada: ${newSale.id}\nTotal: S/ ${total.toFixed(2)}\n\nImprimiendo recibo...`);
    clearCart();
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
    alert(`✓ Orden guardada: ${order.id}`);
    clearCart();
  };

  const sendToKitchen = () => {
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
      paymentMethod: 'Enviado a Cocina',
      cashReceived: 0,
      change: 0,
      notes,
      timestamp: new Date().toISOString(),
      verified: false,
      kitchen: true,
    };
    setSalesHistory((prev) => [order, ...prev]);
    alert(`✓ Orden enviada a cocina: ${order.id}`);
    clearCart();
  };

  const verifySale = (saleId) => {
    setSalesHistory((prev) =>
      prev.map((sale) => (sale.id === saleId ? { ...sale, verified: true } : sale))
    );
    alert(`✓ Venta ${saleId} verificada correctamente`);
  };

  const openCashRegister = () => {
    if (isCashOpen) {
      alert('⚠️ La caja ya está abierta');
      return;
    }
    const input = prompt('Ingrese monto inicial:', '500');
    if (input === null) return;
    const amt = parseFloat(input);
    if (isNaN(amt) || amt < 0 || amt > 999999) {
      alert('❌ Ingrese un monto válido');
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
    alert(`✓ Caja abierta correctamente\nMonto inicial: S/ ${amt.toFixed(2)}`);
  };

  const closeCashRegister = () => {
    if (!isCashOpen) {
      alert('⚠️ La caja ya está cerrada');
      return;
    }

    const todaySalesList = salesHistory.filter(
      (s) => new Date(s.timestamp).toDateString() === new Date().toDateString()
    );
    const cashSales = todaySalesList
      .filter((s) => s.paymentMethod === 'Efectivo' && !s.saved && !s.kitchen)
      .reduce((sum, s) => sum + s.total, 0);

    const todayMovementsList = cashMovements.filter(
      (m) => new Date(m.date).toDateString() === new Date().toDateString()
    );
    const totalIngresos = todayMovementsList
      .filter((m) => m.type === 'ingreso')
      .reduce((sum, m) => sum + m.amount, 0);
    const totalEgresos = todayMovementsList
      .filter((m) => m.type === 'egreso')
      .reduce((sum, m) => sum + m.amount, 0);

    const expected = initialCash + cashSales + totalIngresos - totalEgresos;
    const diff = Math.round((cashRegister - expected) * 100) / 100;

    const msg = `╔════════════════════════════════╗
║      CIERRE DE CAJA            ║
╚════════════════════════════════╝

Monto Inicial: S/ ${initialCash.toFixed(2)}
Ventas en Efectivo: S/ ${cashSales.toFixed(2)}
Ingresos Manuales: +S/ ${totalIngresos.toFixed(2)}
Egresos Manuales: -S/ ${totalEgresos.toFixed(2)}
───────────────────────────────
Esperado: S/ ${expected.toFixed(2)}
Actual: S/ ${cashRegister.toFixed(2)}
───────────────────────────────
Diferencia: S/ ${diff.toFixed(2)}

${Math.abs(diff) < 0.01 ? '✓ CAJA BALANCEADA CORRECTAMENTE' : diff > 0 ? '⚠ SOBRANTE EN CAJA' : '⚠ FALTANTE EN CAJA'}`;

    alert(msg);
    setIsCashOpen(false);
  };

  const todaySales = salesHistory.filter(
    (s) => new Date(s.timestamp).toDateString() === new Date().toDateString()
  );

  const todayStats = {
    totalSales: todaySales.length,
    totalAmount: todaySales.reduce((sum, s) => sum + s.total, 0),
    totalItems: todaySales.reduce((sum, s) => sum + s.items.reduce((t, i) => t + i.quantity, 0), 0),
    verified: todaySales.filter((s) => s.verified).length,
    pending: todaySales.filter((s) => !s.verified).length,
    averageTicket:
      todaySales.length > 0 ? todaySales.reduce((sum, s) => sum + s.total, 0) / todaySales.length : 0,
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

  const peakHour = salesByHour.reduce(
    (best, current) => (current.total > best.total ? current : best),
    salesByHour[0] || { label: '0:00', total: 0 }
  );
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

  const availableTabs = roleTabs[currentUser.role] || ['POS'];

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

  return (
    <div className="App">
      <header className="top-header">
        <div className="header-brand">
          <div className="logo-container">
            <span className="logo-icon">🍣</span>
            <div>
              <h1>SHARI SUSHI</h1>
              <p>Auténtico Sabor Japonés</p>
            </div>
          </div>
        </div>

        <div className="header-nav">
          {availableTabs.map((tab) => (
            <button
              key={tab}
              className={activeTab === tab ? 'nav-btn active' : 'nav-btn'}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="header-status">
          <div className="status-block">
            <span className={`status ${isCashOpen ? 'open' : 'closed'}`}>{isCashOpen ? 'ABIERTA' : 'CERRADA'}</span>
            <strong>S/ {cashRegister.toFixed(2)}</strong>
          </div>
          <div className="header-meta">
            <span>{todayStats.totalSales} órdenes hoy</span>
            <span>{pendingOrders} pendientes</span>
          </div>
        </div>
      </header>

      <div className="main-layout">
        {activeTab === 'POS' && (
          <>
            <aside className="sidebar">
              <div className="sidebar-content">
                <div className="section">
                  <label>MESA</label>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={tableNumber}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setTableNumber('1');
                      } else {
                        const num = parseInt(val, 10);
                        if (!Number.isNaN(num) && num > 0 && num <= 99) {
                          setTableNumber(num.toString());
                        }
                      }
                    }}
                    className="input-field"
                  />
                </div>

                <div className="section">
                  <label>CLIENTE</label>
                  <button onClick={() => setShowClientModal(true)} className="btn-client">
                    {clientName ? `📋 ${clientName.substring(0, 18)}` : '➕ Agregar Cliente'}
                  </button>
                  {clientDNI && (
                    <div className="client-info">
                      <small>✓ {getDocumentType ? getDocumentType(clientDNI) : 'DOC'}: {clientDNI.replace(/\D/g, '')}</small>
                    </div>
                  )}
                </div>

                <div className="section">
                  <label>DESCUENTO</label>
                  <div className="radio-group">
                    <label>
                      <input
                        type="radio"
                        value="percentage"
                        checked={discountType === 'percentage'}
                        onChange={(e) => setDiscountType(e.target.value)}
                      />
                      %
                    </label>
                    <label>
                      <input
                        type="radio"
                        value="fixed"
                        checked={discountType === 'fixed'}
                        onChange={(e) => setDiscountType(e.target.value)}
                      />
                      S/
                    </label>
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={discount}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      if (discountType === 'percentage') {
                        setDiscount(Math.min(Math.max(val, 0), 100));
                      } else {
                        setDiscount(Math.max(val, 0));
                      }
                    }}
                    className="input-field"
                    placeholder={discountType === 'percentage' ? '0 - 100' : '0.00'}
                  />
                </div>

                <div className="section">
                  <label>MÉTODO DE PAGO</label>
                  <div className="payment-list">
                    {paymentMethods.map((m) => (
                      <label key={m.id} className={`payment-item ${paymentMethod === m.id ? 'selected' : ''}`}>
                        <input type="radio" value={m.id} checked={paymentMethod === m.id} onChange={(e) => setPaymentMethod(e.target.value)} />
                        <span>{m.icon} {m.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="section">
                  <label>NOTAS</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Sin wasabi, sin jengibre..."
                    className="textarea-field"
                  />
                </div>
              </div>

              <div className="sidebar-footer">
                <div className="profile-card">
                  <img src={currentUser.avatar} alt={currentUser.name} onError={handleImageError} />
                  <div>
                    <strong>{currentUser.name}</strong>
                    <span>{currentUser.role}</span>
                    <small>ID: {currentUser.sessionId}</small>
                  </div>
                </div>
                <div className="footer-note">SHARI SUSHI — Operación premium</div>
              </div>
            </aside>

            <main className="content-area">
              <div className="search-filter-row">
                <div className="search-box">
                  <input
                    type="text"
                    placeholder="Buscar por nombre o código..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="search-input"
                  />
                </div>
                <div className="filter-bar">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      className={activeCategory === cat ? 'pill-btn active' : 'pill-btn'}
                      onClick={() => setActiveCategory(cat)}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="products-grid">
                {filteredProducts.length === 0 ? (
                  <div className="no-results">No se encontraron productos</div>
                ) : (
                  filteredProducts.map((product) => (
                    <div
                      key={product.id}
                      className={`product-card ${product.stock === 0 ? 'disabled' : ''}`}
                      onClick={() => product.stock > 0 && addToCart(product)}
                    >
                      <div className="product-image">
                        <img src={product.image} alt={product.name} onError={handleImageError} />
                      </div>
                      <div className="product-copy">
                        <div className="card-top">
                          <span className="code">{product.code}</span>
                          <span className="category">{product.category}</span>
                        </div>
                        <h4>{product.name}</h4>
                        <div className="card-bottom">
                          <span className="price">S/ {product.price.toFixed(2)}</span>
                          <span className={`stock ${product.stock < 5 ? 'low' : ''}`}>
                            {product.stock === 0 ? 'Agotado' : `${product.stock}`}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </main>

            <aside className="cart-panel">
              <div className="cart-top">
                <div>
                  <h2>Pedido Actual</h2>
                  <span className="subtitle">{cart.length} artículos</span>
                </div>
                <span className="count">{cart.length}</span>
              </div>

              <div className="cart-items">
                {cart.length === 0 ? (
                  <div className="empty-msg">Carrito vacío</div>
                ) : (
                  cart.map((item) => (
                    <div key={`cart-item-${item.id}`} className="cart-item">
                      <div className="item-thumb">
                        <img src={item.image} alt={item.name} onError={handleImageError} />
                      </div>
                      <div className="item-details">
                        <div className="item-name">{item.name}</div>
                        <div className="item-meta">S/ {item.price.toFixed(2)} cada uno</div>
                        <div className="qty-controls">
                          <button onClick={() => updateQuantity(item.id, item.quantity - 1)}>-</button>
                          <span>{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</button>
                        </div>
                      </div>
                      <div className="item-right">
                        <div className="item-price">S/ {(item.quantity * item.price).toFixed(2)}</div>
                        <button onClick={() => removeFromCart(item.id)} className="delete-btn">✕</button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="summary">
                <div className="summary-line">
                  <span>Subtotal</span>
                  <strong>S/ {subtotal.toFixed(2)}</strong>
                </div>
                {discount > 0 && (
                  <div className="summary-line discount">
                    <span>Descuento</span>
                    <strong>-S/ {discountValue.toFixed(2)}</strong>
                  </div>
                )}
                <div className="summary-line">
                  <span>Base imponible</span>
                  <strong>S/ {netAmount.toFixed(2)}</strong>
                </div>
                <div className="summary-line tax">
                  <span>IGV (18%)</span>
                  <strong>S/ {tax.toFixed(2)}</strong>
                </div>
                <div className="summary-line total">
                  <span>Total</span>
                  <strong>S/ {total.toFixed(2)}</strong>
                </div>

                {paymentMethod === 'cash' && (
                  <div className="cash-section">
                    <label>Efectivo Recibido</label>
                    <input
                      type="number"
                      value={cashInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || val === '0') {
                          setCashInput('');
                        } else {
                          const num = parseFloat(val);
                          if (!Number.isNaN(num) && num >= 0) {
                            setCashInput(num.toString());
                          }
                        }
                      }}
                      placeholder="0.00"
                      min="0"
                    />
                    <div className="summary-line">
                      <span>Vuelto</span>
                      <strong className={change > 0 ? 'green' : ''}>S/ {change.toFixed(2)}</strong>
                    </div>
                  </div>
                )}
              </div>

              <div className="action-buttons">
                <button onClick={processPayment} className="btn primary" disabled={cart.length === 0}>PAGAR</button>
                <button onClick={saveOrder} className="btn secondary" disabled={cart.length === 0}>GUARDAR ORDEN</button>
                <button onClick={sendToKitchen} className="btn tertiary" disabled={cart.length === 0}>ENVIAR A COCINA</button>
              </div>
            </aside>
          </>
        )}

        {activeTab === 'Caja' && (
          <div className="full-section caja-view">
            <div className="cash-header-grid">
              <div className="status-card">
                <span className="label">Saldo Actual</span>
                <span className="value">S/ {cashRegister.toFixed(2)}</span>
              </div>
              <div className="status-card">
                <span className="label">Monto Inicial</span>
                <span className="value">S/ {initialCash.toFixed(2)}</span>
              </div>
              <div className="status-card">
                <span className="label">Ticket Promedio</span>
                <span className="value">S/ {todayStats.averageTicket.toFixed(2)}</span>
              </div>
              <div className="status-card">
                <span className="label">Órdenes Pendientes</span>
                <span className="value">{pendingOrders}</span>
              </div>
            </div>

            <div className="cash-section-container">
              <div className="cash-left">
                <h3>Flujo de Efectivo</h3>
                <div className="movement-list">
                  {cashMovements.slice(0, 10).map((mov) => (
                    <div key={mov.id} className="movement-item">
                      <div>
                        <p className="mov-type">{mov.type === 'apertura' ? '📂' : '💳'} {mov.description}</p>
                        <small className="mov-date">{new Date(mov.date).toLocaleTimeString('es-PE')}</small>
                      </div>
                      <strong>+ S/ {mov.amount.toFixed(2)}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="cash-right">
                <h3>Resumen Diario</h3>
                <div className="summary-box">
                  <p><span>Total Ventas</span><strong>{todayStats.totalSales}</strong></p>
                  <p><span>Ingresos Totales</span><strong>S/ {todayStats.totalAmount.toFixed(2)}</strong></p>
                  <p><span>Ítems Vendidos</span><strong>{todayStats.totalItems}</strong></p>
                  <p><span>Promedio por Ticket</span><strong>S/ {todayStats.averageTicket.toFixed(2)}</strong></p>
                  <p><span>Ventas Verificadas</span><strong>{todayStats.verified}</strong></p>
                  <p><span>Ventas Pendientes</span><strong>{todayStats.pending}</strong></p>
                </div>

                <div className="sales-history-card">
                  <h4>Ventas de Hoy</h4>
                  <div className="sales-list">
                    {todaySales.slice(0, 6).map((sale) => (
                      <button
                        type="button"
                        key={sale.id}
                        className={`sale-chip ${sale.verified ? 'verified' : 'pending'}`}
                        onClick={() => setSelectedCashSale(sale)}
                      >
                        <div>
                          <strong>{sale.id}</strong>
                          <small>{sale.paymentMethod}</small>
                        </div>
                        <span>S/ {sale.total.toFixed(2)}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {selectedCashSale && (
                  <div className="sale-details-card">
                    <div className="sale-details-title">
                      <div>
                        <h4>Detalle {selectedCashSale.id}</h4>
                        <small>{selectedCashSale.verified ? 'VERIFICADA' : 'PENDIENTE'}</small>
                      </div>
                      <button type="button" onClick={() => setSelectedCashSale(null)}>✕</button>
                    </div>
                    <div className="sale-products-grid">
                      {selectedCashSale.items.map((item) => (
                        <div key={`${selectedCashSale.id}-${item.id}`} className="sale-product-card">
                          <img src={item.image} alt={item.name} onError={handleImageError} />
                          <div>
                            <strong>{item.name}</strong>
                            <span>{item.quantity} × S/ {item.price.toFixed(2)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="sale-summary-row">
                      <span>Subtotal</span>
                      <strong>S/ {selectedCashSale.subtotal.toFixed(2)}</strong>
                    </div>
                    <div className="sale-summary-row">
                      <span>IGV (18%)</span>
                      <strong>S/ {selectedCashSale.tax.toFixed(2)}</strong>
                    </div>
                    <div className="sale-summary-row total-row">
                      <span>Total</span>
                      <strong>S/ {selectedCashSale.total.toFixed(2)}</strong>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="button-group">
              <button onClick={openCashRegister} className="btn open" disabled={isCashOpen}>📂 ABRIR CAJA</button>
              <button onClick={closeCashRegister} className="btn close" disabled={!isCashOpen}>🔒 CERRAR CAJA</button>
            </div>
          </div>
        )}

        {activeTab === 'Reportes' && (
          <div className="full-section reportes-view">
            <div className="report-header">
              <div>
                <h2>REPORTES FINANCIEROS</h2>
                <p>{new Date().toLocaleDateString('es-PE')}</p>
              </div>
            </div>

            <div className="kpi-grid">
              <div className="kpi-card">
                <span>Ticket Promedio</span>
                <strong>S/ {todayStats.averageTicket.toFixed(2)}</strong>
              </div>
              <div className="kpi-card">
                <span>Hora Pico</span>
                <strong>{peakHour.label}</strong>
              </div>
              <div className="kpi-card">
                <span>Margen Neto</span>
                <strong>S/ {netMargin.toFixed(2)}</strong>
              </div>
              <div className="kpi-card">
                <span>Ventas Totales</span>
                <strong>S/ {todayStats.totalAmount.toFixed(2)}</strong>
              </div>
            </div>

            <div className="chart-grid">
              <section className="graph-card">
                <div className="graph-title">
                  <h3>Flujo de ventas por hora</h3>
                </div>
                <Bar data={salesByHourData} options={salesByHourOptions} />
              </section>

              <section className="graph-card donut-card">
                <div className="graph-title">
                  <h3>Métodos de pago</h3>
                </div>
                <Doughnut data={paymentMethodData} options={paymentMethodOptions} />
              </section>

              <section className="graph-card top-products-card">
                <div className="graph-title">
                  <h3>Top 5 productos más vendidos</h3>
                </div>
                {topProducts.length === 0 ? (
                  <p className="empty-msg">Aún no hay ventas</p>
                ) : (
                  <Bar data={topProductsData} options={topProductsOptions} />
                )}
              </section>
            </div>

            <div className="financial-grid">
              <div className="financial-box">
                <h3>Ingresos por método</h3>
                <div className="method-list">
                  <div className="method-row"><span>💵 Efectivo</span><strong>S/ {paymentBreakdown.cash.toFixed(2)}</strong></div>
                  <div className="method-row"><span>🏧 Tarjeta Débito</span><strong>S/ {paymentBreakdown.debit.toFixed(2)}</strong></div>
                  <div className="method-row"><span>💳 Tarjeta Crédito</span><strong>S/ {paymentBreakdown.credit.toFixed(2)}</strong></div>
                  <div className="method-row"><span>📱 Yape</span><strong>S/ {paymentBreakdown.yape.toFixed(2)}</strong></div>
                  <div className="method-row"><span>📲 Plin</span><strong>S/ {paymentBreakdown.plin.toFixed(2)}</strong></div>
                  <hr />
                  <div className="method-row total"><span>TOTAL</span><strong>S/ {paymentBreakdownTotal.toFixed(2)}</strong></div>
                </div>
              </div>

              <div className="financial-box">
                <h3>Estado de las ventas</h3>
                <div className="status-list">
                  <div className="status-row verified"><span>✓ Verificadas</span><strong>{todayStats.verified}</strong><span className="percentage">({((todayStats.verified / Math.max(1, todayStats.totalSales)) * 100).toFixed(0)}%)</span></div>
                  <div className="status-row pending"><span>⏳ Pendientes</span><strong>{todayStats.pending}</strong><span className="percentage">({((todayStats.pending / Math.max(1, todayStats.totalSales)) * 100).toFixed(0)}%)</span></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Clientes' && (
          <div className="full-section">
            <ClientManager
              onSelectClient={(client) => {
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
                      <span className="badge">{sale.verified ? '✓ VERIFICADO' : '⏳ PENDIENTE'}</span>
                      <span>{new Date(sale.timestamp).toLocaleTimeString('es-PE')}</span>
                      <span className="amount">S/ {sale.total.toFixed(2)}</span>
                    </div>
                    <div className="item-meta">
                      Mesa {sale.table} • {sale.items.length} items • {sale.paymentMethod}
                    </div>
                    <div className="item-actions">
                      <button onClick={() => printReceipt(sale)} className="mini-btn print">🖨️ Imprimir</button>
                      {!sale.verified && (
                        <button onClick={() => verifySale(sale.id)} className="mini-btn verify">✓ Verificar</button>
                      )}
                      <button onClick={() => setSelectedSale(sale)} className="mini-btn">📋 Detalles</button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {selectedSale && (
              <div className="modal" onClick={() => setSelectedSale(null)}>
                <div className="modal-box" onClick={(e) => e.stopPropagation()}>
                  <div className="modal-title">
                    <h3>Venta: {selectedSale.id}</h3>
                    <button onClick={() => setSelectedSale(null)}>✕</button>
                  </div>
                  <div className="modal-body">
                    <ReceiptDisplay sale={selectedSale} />
                  </div>
                  <div className="modal-actions">
                    <button onClick={() => printReceipt(selectedSale)} className="btn primary">🖨️ Imprimir</button>
                    {!selectedSale.verified && (
                      <button onClick={() => { verifySale(selectedSale.id); setSelectedSale(null); }} className="btn secondary">✓ Verificar</button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showClientModal && (
        <div className="modal" onClick={() => setShowClientModal(false)}>
          <div className="modal-box client-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">
              <h3>🍣 Información del Cliente</h3>
              <button onClick={() => setShowClientModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Nombre o Razón Social *</label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Ej: Juan Pérez"
                  className="input-field"
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>DNI o RUC *</label>
                <input
                  type="text"
                  value={clientDNI}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    if (val.length <= 11) {
                      setClientDNI(val);
                    }
                  }}
                  placeholder="Ej: 12345678 (DNI) o 20123456789 (RUC)"
                  className="input-field"
                />
                {clientDNI && (
                  <small className={validateDocument && validateDocument(clientDNI) ? 'success' : 'error'}>
                    {validateDocument && validateDocument(clientDNI)
                      ? `✓ ${getDocumentType ? getDocumentType(clientDNI) : 'DOC'} válido`
                      : '❌ DNI (8 dígitos) o RUC (11 dígitos)'}
                  </small>
                )}
              </div>
            </div>
            <div className="modal-actions">
              <button
                onClick={() => {
                  const isValid = validateDocument ? validateDocument(clientDNI) : clientDNI.length >= 8;
                  if (clientName.trim() && isValid) {
                    if (createClient) {
                      createClient({
                        name: clientName,
                        document: clientDNI,
                        docType: getDocumentType ? getDocumentType(clientDNI) : 'DOC',
                      });
                    }
                    setShowClientModal(false);
                  } else {
                    alert('Por favor complete los datos correctamente');
                  }
                }}
                disabled={!clientName.trim() || (validateDocument ? !validateDocument(clientDNI) : clientDNI.length < 8)}
                className="btn primary"
              >
                ✓ Guardar Cliente
              </button>
              <button
                onClick={() => {
                  setClientDNI('');
                  setClientName('');
                  setShowClientModal(false);
                }}
                className="btn secondary"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;