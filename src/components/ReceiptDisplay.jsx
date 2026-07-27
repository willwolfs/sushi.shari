import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { generateReceiptText, generateQRData, generateReceiptHTML, sendToPrinter } from '../utils/billing';
import './ReceiptDisplay.css';

/**
 * Componente para mostrar y imprimir recibos con QR
 */

export default function ReceiptDisplay({ receipt, onClose }) {
  const [printing, setPrinting] = useState(false);
  const [printed, setPrinted] = useState(false);

  const handlePrint = async () => {
    setPrinting(true);
    try {
      const qrRef = document.querySelector('#qr-code-receipt svg');
      let qrDataUrl = '';
      
      if (qrRef) {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const svgData = new XMLSerializer().serializeToString(qrRef);
          const img = new Image();
          img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            qrDataUrl = canvas.toDataURL('image/png');
          };
          img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
        } catch (e) {
          console.warn('No se pudo convertir QR a PNG:', e);
        }
      }
      
      const htmlContent = generateReceiptHTML(receipt, qrDataUrl);
      await sendToPrinter(htmlContent);
      setPrinted(true);

      setTimeout(() => {
        alert('Recibo enviado a imprimir correctamente');
      }, 500);
    } catch (error) {
      alert('Error al imprimir: ' + error.message);
    } finally {
      setPrinting(false);
    }
  };

  const handleDownloadPDF = () => {
    const receiptText = generateReceiptText(receipt);
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(receiptText));
    element.setAttribute('download', `${receipt.id}.txt`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const qrData = generateQRData(receipt);
  const receiptText = generateReceiptText(receipt);

  return (
    <div className="receipt-modal-overlay">
      <div className="receipt-modal">
        <div className="receipt-header">
          <h2>{receipt.id}</h2>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        <div className="receipt-content">
          {/* Área de vista previa */}
          <div className="receipt-preview">
            <pre>{receiptText}</pre>

            <div className="receipt-qr-section">
              <p className="qr-label">Código de Verificación QR</p>
              <QRCodeSVG
                id="qr-code-receipt"
                value={qrData}
                size={200}
                level="H"
                includeMargin={true}
              />
              <p className="qr-code">{receipt.verificationCode}</p>
            </div>
          </div>

          {/* Información de recibo */}
          <div className="receipt-details">
            <h3>Detalles del Recibo</h3>

            <div className="detail-section">
              <h4>Información General</h4>
              <div className="detail-row">
                <span>Tipo:</span>
                <strong>{receipt.receiptType || 'BOLETA'}</strong>
              </div>
              <div className="detail-row">
                <span>Número:</span>
                <strong>{receipt.id}</strong>
              </div>
              <div className="detail-row">
                <span>Fecha:</span>
                <strong>{new Date(receipt.createdAt || receipt.timestamp).toLocaleString('es-PE')}</strong>
              </div>
              <div className="detail-row">
                <span>Estado:</span>
                <strong className={receipt.verified ? 'status-verified' : 'status-pending'}>
                  {receipt.verified ? 'Verificado' : 'Pendiente'}
                </strong>
              </div>
            </div>

            <div className="detail-section">
              <h4>Cliente</h4>
              <div className="detail-row">
                <span>Nombre:</span>
                <strong>{receipt.clientName}</strong>
              </div>
              <div className="detail-row">
                <span>Documento:</span>
                <strong>{receipt.clientDocumentType || 'DNI'}: {receipt.clientDocument || 'N/A'}</strong>
              </div>
            </div>

            {(receipt.businessName || receipt.businessRUC) && (
              <div className="detail-section">
                <h4>Negocio</h4>
                <div className="detail-row">
                  <span>Razón Social:</span>
                  <strong>{receipt.businessName || 'SHARI SUSHI'}</strong>
                </div>
                <div className="detail-row">
                  <span>RUC:</span>
                  <strong>{receipt.businessRUC || '20-123456789'}</strong>
                </div>
                <div className="detail-row">
                  <span>Teléfono:</span>
                  <strong>{receipt.businessPhone || '555-1234'}</strong>
                </div>
              </div>
            )}

            <div className="detail-section">
              <h4>Artículos ({receipt.items.length})</h4>
              <div className="items-summary">
                {receipt.items.map((item, idx) => (
                  <div key={idx} className="item-row">
                    <span>{item.name}</span>
                    <span className="item-qty">x{item.quantity}</span>
                    <span className="item-price">S/ {(item.quantity * item.price).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="detail-section">
              <h4>Totales</h4>
              <div className="detail-row">
                <span>Subtotal:</span>
                <strong>S/ {receipt.subtotal.toFixed(2)}</strong>
              </div>
              {receipt.discountValue > 0 && (
                <div className="detail-row">
                  <span>Descuento:</span>
                  <strong>-S/ {receipt.discountValue.toFixed(2)}</strong>
                </div>
              )}
              <div className="detail-row">
                <span>IGV (18%):</span>
                <strong>S/ {receipt.tax.toFixed(2)}</strong>
              </div>
              <div className="detail-row total">
                <span>TOTAL:</span>
                <strong>S/ {receipt.total.toFixed(2)}</strong>
              </div>
            </div>

            <div className="detail-section">
              <h4>Método de Pago</h4>
              <div className="detail-row">
                <span>Tipo:</span>
                <strong>{receipt.paymentMethod}</strong>
              </div>
            </div>

            {receipt.notes && (
              <div className="detail-section">
                <h4>Notas</h4>
                <p className="notes-text">{receipt.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Botones de acción */}
        <div className="receipt-actions">
          <button
            className="btn action-btn"
            onClick={handlePrint}
            disabled={printing}
          >
            {printing ? 'Imprimiendo...' : 'Imprimir'}
          </button>
          <button
            className="btn action-btn secondary"
            onClick={handleDownloadPDF}
          >
            Descargar
          </button>
          <button
            className="btn action-btn secondary"
            onClick={onClose}
          >
            ✕ Cerrar
          </button>
        </div>

        {printed && (
          <div className="print-success">
            Recibo impreso exitosamente
          </div>
        )}
      </div>
    </div>
  );
}
