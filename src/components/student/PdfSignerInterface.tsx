import React, { useState } from 'react';
import { Document, Page } from 'react-pdf';
import { Check, ZoomIn, ZoomOut } from 'lucide-react';
import '../../lib/pdf-worker'; // Importamos la config del worker
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

interface SignatureBox {
  page: number;
  x: number; // Porcentaje 0-1
  y: number; // Porcentaje 0-1
}

interface PdfSignerInterfaceProps {
  file: File;
  onConfirm: (coords: SignatureBox) => void;
  onCancel: () => void;
}

export function PdfSignerInterface({ file, onConfirm, onCancel }: PdfSignerInterfaceProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [signaturePos, setSignaturePos] = useState<SignatureBox | null>(null);
  const [scale, setScale] = useState(1.0); // Zoom para ver mejor

  // Callback cuando carga el PDF
  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
  }

  // Manejar el clic en una página específica
  const handlePageClick = (e: React.MouseEvent, pageNum: number) => {
    // currentTarget es el div contenedor de la página que recibió el clic
    const rect = e.currentTarget.getBoundingClientRect();
    
    // Calculamos coordenadas relativas (0.0 a 1.0)
    // e.clientX/Y son coordenadas globales del mouse
    // rect.left/top son la posición de la página en pantalla
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    // Ajustar para centrar la firma en el clic y evitar desbordes
    // (Asumiendo firma de 25% ancho x 8% alto)
    const finalX = Math.min(Math.max(x - 0.125, 0), 0.75); 
    const finalY = Math.min(Math.max(y - 0.04, 0), 0.92);

    setSignaturePos({
      page: pageNum,
      x: finalX,
      y: finalY
    });
  };

  return (
    <div className="flex flex-col h-full bg-gray-200 rounded-lg overflow-hidden">
      {/* Barra Superior: Instrucciones y Zoom */}
      <div className="bg-white p-3 border-b flex justify-between items-center shadow-md z-10 flex-shrink-0">
        <div>
          <h3 className="font-bold text-gray-800">Colocar Firma</h3>
          <p className="text-xs text-gray-500">Haz scroll y clic en el lugar deseado.</p>
        </div>
        
        <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
          <button 
            onClick={() => setScale(s => Math.max(0.5, s - 0.1))}
            className="p-1.5 hover:bg-white rounded text-gray-600"
            title="Reducir Zoom"
          >
            <ZoomOut className="w-4 h-4"/>
          </button>
          <span className="text-xs font-mono w-12 text-center">{Math.round(scale * 100)}%</span>
          <button 
            onClick={() => setScale(s => Math.min(2.0, s + 0.1))}
            className="p-1.5 hover:bg-white rounded text-gray-600"
            title="Aumentar Zoom"
          >
            <ZoomIn className="w-4 h-4"/>
          </button>
        </div>
      </div>

      {/* Área del PDF con Scroll */}
      <div className="flex-1 overflow-y-auto p-8 relative">
        <div className="flex flex-col items-center gap-6">
          <Document
            file={file}
            onLoadSuccess={onDocumentLoadSuccess}
            className="flex flex-col gap-6"
            loading={<div className="text-gray-500 font-medium">Cargando documento...</div>}
          >
            {/* Renderizamos TODAS las páginas */}
            {Array.from(new Array(numPages), (el, index) => (
              <div 
                key={`page_${index + 1}`}
                className="relative cursor-crosshair shadow-lg transition-transform origin-top"
                onClick={(e) => handlePageClick(e, index + 1)}
                style={{ width: 'fit-content' }} // Ajuste importante para el borde
              >
                {/* Indicador de número de página */}
                <div className="absolute -left-12 top-0 text-xs text-gray-400 font-bold">
                  Pág {index + 1}
                </div>

                <Page 
                  pageNumber={index + 1} 
                  scale={scale}
                  width={600} // Ancho base
                  renderAnnotationLayer={false}
                  renderTextLayer={false}
                  className="bg-white"
                />

                {/* La "Cajita Azul" de la firma (Solo si esta es la página seleccionada) */}
                {signaturePos && signaturePos.page === (index + 1) && (
                  <div 
                    className="absolute border-2 border-blue-600 bg-blue-100/40 backdrop-blur-[1px] flex items-center justify-center shadow-sm pointer-events-none z-20"
                    style={{
                      left: `${signaturePos.x * 100}%`,
                      top: `${signaturePos.y * 100}%`,
                      width: '25%',   // Coincide con el backend (0.25)
                      height: '8%'    // Coincide con el backend (0.08)
                    }}
                  >
                    <span className="text-[10px] sm:text-xs font-bold text-blue-800 uppercase tracking-wider bg-white/80 px-1 rounded">
                      Tu Firma
                    </span>
                  </div>
                )}
              </div>
            ))}
          </Document>
        </div>
      </div>

      {/* Footer de Confirmación */}
      <div className="bg-white p-4 border-t flex justify-between items-center flex-shrink-0">
        <button 
          onClick={onCancel} 
          className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium"
        >
          Cancelar
        </button>
        
        <div className="text-sm text-gray-500">
          {signaturePos 
            ? `Firma en pág. ${signaturePos.page}` 
            : "Selecciona una ubicación"}
        </div>

        <button 
          disabled={!signaturePos}
          onClick={() => signaturePos && onConfirm(signaturePos)}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm transition-all"
        >
          <Check className="w-4 h-4" />
          Confirmar
        </button>
      </div>
    </div>
  );
}