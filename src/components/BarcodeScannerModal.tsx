import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedBarcode: string) => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
}) => {
  const [manualCode, setManualCode] = useState<string>('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanning, setScanning] = useState<boolean>(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const hasDetectedRef = useRef<boolean>(false);

  // Reproducir un pitido breve de confirmación de lectura estilo punto de venta
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // Tono A5
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.16);
      if (navigator.vibrate) navigator.vibrate(60);
    } catch {}
  };

  useEffect(() => {
    if (!isOpen) return;

    hasDetectedRef.current = false;
    setCameraError(null);
    setScanning(true);

    const readerId = 'barcode-scanner-viewport';
    let isStopped = false;

    const startScanner = async () => {
      try {
        const scanner = new Html5Qrcode(readerId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.QR_CODE,
          ],
          verbose: false,
        });
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 15,
            qrbox: { width: 260, height: 140 },
            aspectRatio: 1.0,
          },
          async (decodedText) => {
            if (hasDetectedRef.current || isStopped) return;
            hasDetectedRef.current = true;
            playBeep();

            try {
              if (scanner.isScanning) {
                await scanner.stop();
              }
            } catch {}

            onScanSuccess(decodedText.trim());
          },
          () => {
            // Ignorar frames sin código detectado
          }
        );
      } catch (err: any) {
        if (!isStopped) {
          console.warn('Error al iniciar cámara:', err);
          setCameraError(
            'No se pudo acceder a la cámara. Revisa los permisos en tu navegador o ingresa los dígitos del código manualmente abajo.'
          );
        }
      } finally {
        if (!isStopped) setScanning(false);
      }
    };

    // Pequeño timeout para asegurar que el div esté montado en el DOM
    const timer = setTimeout(() => {
      startScanner();
    }, 150);

    return () => {
      isStopped = true;
      clearTimeout(timer);
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    if (scannerRef.current && scannerRef.current.isScanning) {
      scannerRef.current.stop().catch(() => {});
    }
    playBeep();
    onScanSuccess(manualCode.trim());
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.78)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: 16,
        backdropFilter: 'blur(6px)',
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          maxWidth: 420,
          width: '100%',
          margin: 0,
          padding: 18,
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.5)',
          borderRadius: 20,
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontWeight: 800, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>📷 Lector de Código de Barra</span>
          </div>
          <button
            type="button"
            className="btn-ghost"
            style={{ padding: '2px 8px', fontSize: '0.9rem' }}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="sub" style={{ fontSize: '0.8rem', marginBottom: 12, lineHeight: 1.4 }}>
          Apunta con la cámara trasera al código de barra del producto (Score, bebidas, etc.). Se identificará automáticamente.
        </div>

        {/* Visor de la cámara */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            minHeight: 260,
            background: '#000',
            borderRadius: 14,
            overflow: 'hidden',
            marginBottom: 12,
            border: '2px solid var(--accent)',
            boxShadow: '0 0 16px rgba(37,99,235,0.3)',
          }}
        >
          <div id="barcode-scanner-viewport" style={{ width: '100%' }} />

          {/* Línea roja láser guía */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '10%',
              right: '10%',
              height: 2,
              background: 'rgba(239, 68, 68, 0.85)',
              boxShadow: '0 0 8px rgba(239, 68, 68, 0.95)',
              pointerEvents: 'none',
              transform: 'translateY(-50%)',
            }}
          />

          {scanning && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '0.85rem',
                background: 'rgba(0,0,0,0.4)',
              }}
            >
              Iniciando cámara...
            </div>
          )}
        </div>

        {cameraError && (
          <div
            style={{
              background: 'rgba(220,38,38,0.1)',
              border: '1px solid var(--accent2)',
              color: 'var(--accent2)',
              padding: '8px 12px',
              borderRadius: 8,
              fontSize: '0.8rem',
              marginBottom: 12,
              lineHeight: 1.35,
            }}
          >
            {cameraError}
          </div>
        )}

        {/* Alternativa manual */}
        <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="sub" style={{ fontSize: '0.76rem', fontWeight: 600 }}>
            O ingresa los dígitos del código manualmente:
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="text"
              placeholder="Ej: 7801610006733"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              style={{ fontSize: '0.85rem', padding: '8px 10px' }}
            />
            <button
              type="submit"
              className="btn-primary"
              disabled={!manualCode.trim()}
              style={{ padding: '8px 14px', fontSize: '0.82rem', fontWeight: 700 }}
            >
              Identificar
            </button>
          </div>
        </form>

        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn-ghost"
            style={{ fontSize: '0.85rem', padding: '6px 14px' }}
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
