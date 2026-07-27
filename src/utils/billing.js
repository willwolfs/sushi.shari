import { v4 as uuidv4 } from 'uuid';
import { getDocumentType } from './clients';

/**
 * Módulo de Ventas y Facturación
 * Generación de comprobantes con QR para impresoras térmicas
 */

// Crear comprobante
export const createReceipt = (saleData) => {
  const receiptNumber = `BOL-${Date.now()}`;
  
  return {
    id: receiptNumber,
    saleId: saleData.saleId || uuidv4(),
    receiptType: saleData.receiptType || 'BOLETA', // BOLETA, FACTURA, TICKET
    businessName: saleData.businessName || 'SHARI SUSHI',
    businessRUC: saleData.businessRUC || '20-123456789',
    businessPhone: saleData.businessPhone || '555-1234',
    businessWebsite: saleData.businessWebsite || 'www.sharisushi.pe',
    clientName: saleData.clientName || 'CLIENTE FRECUENTE',
    clientDocument: saleData.clientDocument || '',
    clientDocumentType: saleData.clientDocumentType || '',
    items: saleData.items || [],
    subtotal: saleData.subtotal || 0,
    discount: saleData.discount || 0,
    discountType: saleData.discountType || 'percentage',
    discountValue: saleData.discountValue || 0,
    netAmount: saleData.netAmount || 0,
    taxRate: 0.18, // IGV 18% Perú
    tax: saleData.tax || 0,
    total: saleData.total || 0,
    paymentMethod: saleData.paymentMethod || 'Efectivo',
    paymentDetails: saleData.paymentDetails || {},
    tableNumber: saleData.tableNumber || '',
    notes: saleData.notes || '',
    createdAt: new Date().toISOString(),
    verified: false,
    verificationCode: uuidv4().slice(0, 8).toUpperCase(),
  };
};

// Generar datos para QR (formato de facturación simplificado)
export const generateQRData = (receipt) => {
  const qrData = {
    id: receipt.id,
    business: receipt.businessRUC,
    client: receipt.clientDocument,
    amount: receipt.total.toFixed(2),
    date: new Date(receipt.createdAt).toISOString().split('T')[0],
    code: receipt.verificationCode,
  };
  
  return JSON.stringify(qrData);
};

// Generar recibo en texto (para terminal 58mm o 80mm)
export const generateReceiptText = (receipt) => {
  const date = new Date(receipt.createdAt);
  const docType = receipt.clientDocumentType || getDocumentType(receipt.clientDocument);

  let text = `
╔════════════════════════════════════════════╗
║                                            ║
║            ${receipt.businessName}
║     AUTÉNTICO SABOR JAPONÉS                ║
║                                            ║
║  RUC: ${receipt.businessRUC.padEnd(24)}║
║  TEL: ${receipt.businessPhone.padEnd(25)}║
║  ${receipt.businessWebsite.padEnd(39)}║
║                                            ║
╚════════════════════════════════════════════╝

─────────────────────────────────────────────
${receipt.receiptType}
─────────────────────────────────────────────

NÚMERO: ${receipt.id}
${docType}: ${receipt.clientDocument}
CLIENTE: ${receipt.clientName}
${receipt.tableNumber ? `MESA: ${receipt.tableNumber}\n` : ''}
FECHA: ${date.toLocaleString('es-PE')}
ESTADO: ${receipt.verified ? 'VERIFICADO' : 'PENDIENTE'}

─────────────────────────────────────────────
ITEM                        CANT    UNIT    TOT
─────────────────────────────────────────────`;

  receipt.items.forEach((item) => {
    const itemTotal = (item.quantity * item.price).toFixed(2);
    const name = item.name.substring(0, 24).padEnd(24);
    const qty = item.quantity.toString().padStart(4);
    const unit = item.price.toFixed(2).padStart(7);
    const total = itemTotal.padStart(6);
    text += `\n${name}${qty}${unit}${total}`;
  });

  text += `\n─────────────────────────────────────────────`;
  text += `\nSubtotal:                        S/ ${receipt.subtotal.toFixed(2).padStart(8)}`;

  if (receipt.discountValue > 0) {
    const discountLabel = receipt.discountType === 'percentage' 
      ? `${receipt.discount}%`
      : 'S/';
    text += `\nDescuento (${discountLabel}):       -S/ ${receipt.discountValue.toFixed(2).padStart(7)}`;
  }

  text += `\nBase Imponible:                  S/ ${receipt.netAmount.toFixed(2).padStart(8)}`;
  text += `\nIGV (18%):                      S/ ${receipt.tax.toFixed(2).padStart(8)}`;
  text += `\n═════════════════════════════════════════════
TOTAL A PAGAR:                   S/ ${receipt.total.toFixed(2).padStart(8)}
═════════════════════════════════════════════`;

  text += `\nMÉTODO DE PAGO: ${receipt.paymentMethod}`;

  if (receipt.paymentMethod === 'Efectivo' && receipt.paymentDetails.cashReceived) {
    text += `\nEfectivo:                        S/ ${receipt.paymentDetails.cashReceived.toFixed(2)}`;
    text += `\nCambio:                          S/ ${receipt.paymentDetails.change.toFixed(2)}`;
  }

  if (receipt.notes) {
    text += `\n\nNOTAS:\n${receipt.notes}`;
  }

  text += `\n═════════════════════════════════════════════
           ¡GRACIAS POR SU COMPRA!
           
    Código de Verificación: ${receipt.verificationCode}
    Esperamos su próxima visita
    @${receipt.businessName.toLowerCase().replace(/\s/g, '')}
         
═════════════════════════════════════════════

${date.toLocaleTimeString('es-PE')}`;

  return text;
};

// Generar HTML para impresión (compatible con impresoras térmicas)
export const generateReceiptHTML = (receipt, qrDataUrl) => {
  const receiptText = generateReceiptText(receipt);

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="ie=edge">
  <title>${receipt.id}</title>
  <style>
    * { 
      margin: 0; 
      padding: 0; 
      box-sizing: border-box; 
    }
    body { 
      font-family: 'Courier New', 'Courier', monospace; 
      background: #fff; 
      color: #000; 
      line-height: 1.3;
      padding: 5px;
    }
    .receipt-container {
      width: 80mm;
      margin: 0 auto;
      background: white;
      padding: 5px;
    }
    pre { 
      white-space: pre-wrap; 
      word-wrap: break-word; 
      font-size: 11px;
      font-family: 'Courier New', monospace;
    }
    .qr-section {
      text-align: center;
      margin: 10px 0;
    }
    .qr-section img {
      max-width: 70mm;
      height: auto;
    }
    @media print { 
      * { margin: 0 !important; padding: 2px !important; } 
      body { margin: 0; padding: 0; } 
      .receipt-container { width: 100%; margin: 0; padding: 0; }
      @page { 
        margin: 0; 
        size: 80mm auto; 
      } 
    }
  </style>
</head>
<body>
  <div class="receipt-container">
    <pre>${receiptText}</pre>
    ${qrDataUrl ? `<div class="qr-section"><img src="${qrDataUrl}" alt="QR Code" /></div>` : ''}
  </div>
  <script>
    window.addEventListener('load', () => { 
      setTimeout(() => { window.print(); }, 500);
    });
    window.addEventListener('afterprint', () => { 
      setTimeout(() => { window.close(); }, 1000);
    });
  </script>
</body>
</html>
  `;
};

// Calcular subtotal
export const calculateSubtotal = (items) => {
  return items.reduce((total, item) => total + (item.quantity * item.price), 0);
};

// Calcular descuento
export const calculateDiscount = (subtotal, discount, discountType) => {
  if (discountType === 'percentage') {
    return Math.min((subtotal * discount) / 100, subtotal);
  }
  return Math.min(discount, subtotal);
};

// Calcular impuestos (IGV 18% Perú)
export const calculateTax = (netAmount, taxRate = 0.18) => {
  return Number((netAmount * taxRate).toFixed(2));
};

// Calcular total (precios de carta incluyen IGV)
export const calculateTotal = (subtotal, discountValue) => {
  return Number((subtotal - discountValue).toFixed(2));
};

// Validar recibo antes de procesar
export const validateReceipt = (receipt) => {
  const errors = [];

  if (receipt.items.length === 0) {
    errors.push('El recibo debe tener al menos un artículo');
  }

  if (!receipt.clientName || receipt.clientName.trim().length === 0) {
    errors.push('Debe ingresar el nombre del cliente');
  }

  if (!receipt.clientDocument || receipt.clientDocument.trim().length === 0) {
    errors.push('Debe ingresar el documento del cliente');
  }

  if (receipt.total <= 0) {
    errors.push('El total debe ser mayor a cero');
  }

  if (!receipt.paymentMethod || receipt.paymentMethod.trim().length === 0) {
    errors.push('Debe seleccionar un método de pago');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

// Generar ticket HTML para comanda de cocina
export const generateKitchenTicketHTML = (receiptData) => {
  const dateStr = new Date(receiptData.createdAt || Date.now()).toLocaleString('es-PE');
  const itemsHTML = (receiptData.items || []).map(item => `
    <tr>
      <td style="font-weight: bold; font-size: 1.2rem;">${item.quantity}x</td>
      <td style="font-weight: bold; font-size: 1.1rem; padding-left: 8px;">${item.name}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Comanda Cocina - ${receiptData.id}</title>
  <style>
    body { font-family: 'Courier New', monospace; width: 280px; margin: 0 auto; padding: 10px; font-size: 14px; }
    .title { font-size: 20px; font-weight: bold; text-align: center; text-transform: uppercase; border-bottom: 2px solid #000; padding-bottom: 6px; }
    .header-info { margin: 10px 0; border-bottom: 1px dashed #000; padding-bottom: 8px; }
    .header-info p { margin: 3px 0; }
    .items-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    .items-table td { padding: 6px 0; border-bottom: 1px solid #eee; }
    .notes { margin-top: 10px; background: #f0f0f0; padding: 8px; font-weight: bold; }
    .footer { text-align: center; font-size: 12px; margin-top: 15px; border-top: 1px dashed #000; padding-top: 6px; }
  </style>
</head>
<body>
  <div class="title">COMANDA DE COCINA</div>
  <div class="header-info">
    <p><strong>ORDEN N°:</strong> ${receiptData.id}</p>
    <p><strong>MODALIDAD:</strong> ${receiptData.consumptionMode || 'Mesa ' + (receiptData.tableNumber || '1')}</p>
    <p><strong>FECHA:</strong> ${dateStr}</p>
    ${receiptData.clientName ? `<p><strong>CLIENTE:</strong> ${receiptData.clientName}</p>` : ''}
  </div>

  <table class="items-table">
    <tbody>
      ${itemsHTML}
    </tbody>
  </table>

  ${receiptData.notes ? `<div class="notes">NOTAS: ${receiptData.notes}</div>` : ''}

  <div class="footer">
    --- SHARI SUSHI COCINA ---
  </div>

  <script>
    window.addEventListener('load', () => { 
      setTimeout(() => { window.print(); }, 400);
    });
    window.addEventListener('afterprint', () => { 
      setTimeout(() => { window.close(); }, 800);
    });
  </script>
</body>
</html>
  `;
};

// Imprimir comprobante o comanda mediante iframe oculto (100% antibloqueo de ventanas emergentes)
export const sendToPrinter = (receiptHTML, printerName = 'default') => {
  return new Promise((resolve) => {
    try {
      let iframe = document.getElementById('thermal-print-iframe');
      if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'thermal-print-iframe';
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0px';
        iframe.style.height = '0px';
        iframe.style.border = 'none';
        document.body.appendChild(iframe);
      }

      const doc = iframe.contentWindow.document;
      doc.open();
      doc.write(receiptHTML);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } catch (err) {
          console.warn('Falló foco iframe:', err);
        }
        resolve({ success: true, message: 'Enviado a impresora' });
      }, 300);
    } catch (error) {
      console.warn('Error imprimiendo via iframe:', error);
      resolve({ success: false, message: error.message });
    }
  });
};
