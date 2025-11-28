import React, { useState, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import './App.css';
import SignatureModal from './components/SignatureModal'; // Importar el nuevo modal

// --- WORKER SETUP ---
try {
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();
} catch (e) {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;
}

// --- TYPES ---
interface Marker {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
}

interface DraggableBoxProps extends Marker {
  onDrag: (pos: { x: number; y: number }) => void;
  onDelete: () => void;
  parentRef: React.RefObject<HTMLDivElement>;
  isSelected: boolean;
  onSelect: () => void;
  children?: React.ReactNode;
}

// --- ICONS & DRAGGABLE COMPONENT (Mismos de antes) ---
const Icons = {
  Upload: () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>),
  FileText: () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>),
  Save: () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>),
  X: () => (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>),
  Plus: () => (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>),
  CheckCircle: () => (<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>)
};

const DraggableBox: React.FC<DraggableBoxProps> = ({ x, y, width, height, onDrag, onDelete, children, parentRef, isSelected, onSelect }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    onSelect(); setIsDragging(true);
    setDragOffset({ x: e.clientX - x, y: e.clientY - y });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !parentRef.current) return;
      const parentRect = parentRef.current.getBoundingClientRect();
      let newX = e.clientX - dragOffset.x;
      let newY = e.clientY - dragOffset.y;
      const maxX = parentRect.width - width;
      const maxY = parentRect.height - height;
      onDrag({ x: Math.max(0, Math.min(newX, maxX)), y: Math.max(0, Math.min(newY, maxY)) });
    };
    const handleMouseUp = () => setIsDragging(false);
    if (isDragging) { window.addEventListener('mousemove', handleMouseMove); window.addEventListener('mouseup', handleMouseUp); }
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [isDragging, dragOffset, parentRef, width, height, onDrag]);

  return (
    <div onMouseDown={handleMouseDown} style={{ width: `${width}px`, height: `${height}px`, position: 'absolute', top: 0, left: 0, transform: `translate(${x}px, ${y}px)`, zIndex: isDragging ? 100 : 50, cursor: isDragging ? 'grabbing' : 'grab' }} className={`group flex items-center justify-center transition-all select-none rounded backdrop-blur-sm ${isSelected || isDragging ? 'border-2 border-indigo-600 bg-indigo-50/50' : 'border border-dashed border-indigo-500 bg-white/30 hover:bg-indigo-50/50'}`}>
      {children}
      <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center shadow hover:bg-red-600"><Icons.X /></button>
    </div>
  );
};

// --- APP ---
const App: React.FC = () => {
  const [viewState, setViewState] = useState<'initial' | 'editor' | 'success'>('initial'); 
  const [pdfFile, setPdfFile] = useState<string | null>(null); 
  const [realFile, setRealFile] = useState<File | null>(null);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMarkerId, setSelectedMarkerId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const pdfContainerRef = useRef<HTMLDivElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoading(true);
    setRealFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPdfFile(objectUrl);
    setTimeout(() => { setViewState('editor'); setMarkers([]); setIsLoading(false); }, 800);
  };

  const addMarker = () => {
    const newId = Date.now();
    setMarkers(prev => [...prev, { id: newId, x: 100, y: 100, page: 1, width: 150, height: 60 }]);
    setSelectedMarkerId(newId);
  };

  const handleSignClick = () => {
    if (markers.length === 0) return alert("Añade al menos una firma.");
    setIsModalOpen(true);
  };

  const processSecureSignature = async (keyFile: File, password: string) => {
    if (!pdfContainerRef.current || !realFile) return;

    setIsLoading(true);

    const containerWidth = pdfContainerRef.current.offsetWidth;
    const containerHeight = pdfContainerRef.current.offsetHeight;

    const signaturesPayload = markers.map(m => ({
      page: m.page,
      x_percent: m.x / containerWidth,
      y_percent: m.y / containerHeight,
      width_percent: m.width / containerWidth,
      height_percent: m.height / containerHeight,
    }));

    const formData = new FormData();
    formData.append('file', realFile);
    formData.append('private_key', keyFile);
    formData.append('password', password);
    formData.append('signatures', JSON.stringify(signaturesPayload));
    formData.append('user_id', 'usuario_ejemplo_123'); // En app real, esto viene del login

    try {
      const response = await fetch('http://localhost:8000/secure-sign-pdf', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Error desconocido");
      }

      // Descargar PDF
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `firmado_seguro_${realFile.name}`);
      document.body.appendChild(link);
      link.click();
      
      setViewState('success');
      setIsModalOpen(false);
    } catch (error: any) {
      alert("Error: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (viewState === 'success') {
    return (
      <div className="h-screen w-full bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-10 rounded-xl shadow-2xl text-center">
          <div className="flex justify-center mb-4"><Icons.CheckCircle /></div>
          <h2 className="text-2xl font-bold text-gray-800">¡Firma Segura Completada!</h2>
          <p className="text-gray-500 mt-2 mb-6">El documento ha sido firmado criptográficamente y descargado.</p>
          <button onClick={() => window.location.reload()} className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Procesar otro</button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-100 overflow-hidden">
      <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 z-20 shadow-sm flex-shrink-0">
        <div className="flex items-center space-x-2 font-bold text-gray-800 text-lg select-none">
          <span className="text-indigo-600"><Icons.FileText /></span>
          <span>DocuSigner <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded ml-2 font-normal">SECURE</span></span>
        </div>
        {viewState === 'editor' && (
           <div className="flex space-x-3">
              <button onClick={addMarker} className="flex items-center px-4 py-1.5 text-sm bg-indigo-50 text-indigo-700 rounded-md hover:bg-indigo-100 border border-indigo-200 transition-colors font-medium">
                <span className="mr-2"><Icons.Plus /></span> Agregar Firma
              </button>
              <button onClick={handleSignClick} className="flex items-center px-4 py-1.5 text-sm bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-md hover:from-indigo-700 hover:to-indigo-800 shadow transition-all font-medium">
                <span className="mr-2"><Icons.Save /></span> Firmar
              </button>
           </div>
        )}
      </header>

      <main className="flex-1 relative overflow-hidden flex flex-col">
        {viewState === 'initial' && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 animate-fade-in-up">
             <div className="max-w-xl w-full text-center">
                <h1 className="text-4xl font-extrabold text-gray-900 mb-6 tracking-tight">Firma Digital Avanzada</h1>
                <div className="bg-white p-12 rounded-2xl shadow-xl border-2 border-dashed border-gray-300 hover:border-indigo-500 transition-all group cursor-pointer relative">
                   <input type="file" accept=".pdf" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                   <div className="text-indigo-500 mb-4 flex justify-center transform group-hover:scale-110 transition-transform duration-300"><Icons.Upload /></div>
                   <h3 className="text-xl font-bold text-gray-800">Sube documento PDF</h3>
                   <p className="text-gray-400 mt-2">Seguridad criptográfica integrada</p>
                </div>
             </div>
          </div>
        )}

        {viewState === 'editor' && pdfFile && (
          <div className="flex-1 bg-gray-600 overflow-auto flex justify-center p-8 relative cursor-grab active:cursor-grabbing" onClick={() => setSelectedMarkerId(null)}>
             <div ref={pdfContainerRef} className="relative shadow-2xl bg-white transition-transform duration-200" style={{ width: 'fit-content', height: 'fit-content' }}>
                <Document file={pdfFile} loading={<div className="text-white p-10 font-medium">Cargando...</div>}>
                  <Page pageNumber={1} width={850} renderTextLayer={false} renderAnnotationLayer={false} />
                </Document>
                {markers.map((marker) => (
                  <DraggableBox key={marker.id} {...marker} parentRef={pdfContainerRef} isSelected={selectedMarkerId === marker.id} onSelect={() => setSelectedMarkerId(marker.id)} onDrag={(newPos) => setMarkers(prev => prev.map(m => m.id === marker.id ? { ...m, ...newPos } : m))} onDelete={() => setMarkers(prev => prev.filter(m => m.id !== marker.id))}>
                    <div className="flex flex-col items-center justify-center w-full h-full pointer-events-none">
                       <span className="text-indigo-600 font-bold text-[10px] uppercase tracking-wider bg-indigo-50/90 px-2 py-0.5 rounded shadow-sm border border-indigo-100">Firma Aquí</span>
                    </div>
                  </DraggableBox>
                ))}
             </div>
          </div>
        )}

        {/* Modal de Seguridad */}
        <SignatureModal 
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onConfirm={processSecureSignature}
          isLoading={isLoading}
        />
        
        {/* Loading Overlay (para carga inicial de PDF) */}
        {isLoading && !isModalOpen && (
          <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
            <p className="font-semibold text-gray-700 animate-pulse">Procesando...</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;