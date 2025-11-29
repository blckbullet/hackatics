import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { Database } from "../../lib/database.types";
import { X, Upload, FileText, AlertCircle, Key, Lock, PenTool } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { PdfSignerInterface } from "./PdfSignerInterface"; // <--- Importamos el nuevo componente


type Expediente = Database["public"]["Tables"]["expedientes"]["Row"];
type DocumentType = Database["public"]["Tables"]["document_types"]["Row"];

interface DocumentUploadModalProps {
  expediente: Expediente;
  documentType: DocumentType;
  onClose: () => void;
  onSuccess: () => void;
}


// Definimos los pasos del proceso
type Step = 'upload' | 'place-signature' | 'credentials';

export function DocumentUploadModal({
  expediente,
  documentType,
  onClose,
  onSuccess,
}: DocumentUploadModalProps) {
  const { profile } = useAuth();
  
  // Estado de pasos
  const [currentStep, setCurrentStep] = useState<Step>('upload');

  // Estados de datos
  const [file, setFile] = useState<File | null>(null);
  const [coords, setCoords] = useState<{page:number, x:number, y:number} | null>(null);
  const [pemFile, setPemFile] = useState<File | null>(null);
  const [pemPassword, setPemPassword] = useState("");
  
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  // --- PASO 1: SELECCIÓN ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected?.type === "application/pdf") {
      setFile(selected);
      setError("");
      // Avanzamos al paso de colocar firma automáticamente
      setCurrentStep('place-signature');
    } else {
      setError("Solo archivos PDF");
    }
  };

  // --- PASO 2: COLOCAR FIRMA ---
  const handleSignatureConfirmed = (signatureBox: {page:number, x:number, y:number}) => {
    setCoords(signatureBox);
    setCurrentStep('credentials'); // Avanzamos al paso final
  };

  // --- PASO 3: SUBIDA FINAL ---
  const handleUploadAndSign = async () => {
    if (!file || !profile || !pemFile || !pemPassword || !coords) return;

    setUploading(true);
    try {
      // 1. Convertir coordenadas para el Backend
      // El backend (ReportLab) usa coordenadas cartesianas (Y=0 abajo).
      // Nuestra UI usa Y=0 arriba (HTML). Debemos invertir Y.
      // Además, pasamos width y height fijos (25% y 8%) que usamos en la UI.
      const signaturePayload = [{
        page: coords.page,
        x: coords.x,
        // INVERSIÓN IMPORTANTE: 1 - y - alto
        y: 1 - coords.y - 0.08, 
        w: 0.25,
        h: 0.08
      }];

      const formData = new FormData();
      formData.append("file", file);
      formData.append("private_key", pemFile);
      formData.append("password", pemPassword);
      formData.append("user_id", profile.id);
      formData.append("signatures", JSON.stringify(signaturePayload));

      const response = await fetch("http://localhost:8000/secure-sign-pdf", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Error en firma segura (Backend)");

      const signedBlob = await response.blob();
      const signedFile = new File([signedBlob], file.name, { type: "application/pdf" });

      // ... (Lógica de subida a Supabase idéntica a la anterior) ...
      // Calcular versión...
       const { data: existingDocs } = await supabase
        .from("documents")
        .select("version")
        .eq("expediente_id", expediente.id)
        .eq("document_type_id", documentType.id)
        .order("version", { ascending: false })
        .limit(1);

      const newVersion = existingDocs && existingDocs.length > 0 ? existingDocs[0].version + 1 : 1;
      const fileName = `${expediente.id}/${expediente.student_id}_${documentType.id}_v${newVersion}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(fileName, signedFile, { cacheControl: "3600", upsert: false });

      if(uploadError) throw uploadError;

      // Insertar en BD
      const { error: docError, data: docData } = await supabase
        .from("documents")
        .insert({
            expediente_id: expediente.id,
            document_type_id: documentType.id,
            file_path: fileName,
            file_name: file.name,
            version: newVersion,
            status: "pending",
            uploaded_by: profile.id,
        }).select().single();
        
      if(docError) throw docError;
      
      onSuccess();
      
    } catch (err: any) {
      setError(err.message || "Error al subir");
    } finally {
      setUploading(false);
    }
  };

  // --- RENDERIZADO CONDICIONAL ---

  // Si estamos en el paso de FIRMA, mostramos el componente a pantalla completa
  if (currentStep === 'place-signature' && file) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[85vh]">
          <PdfSignerInterface 
            file={file} 
            onConfirm={handleSignatureConfirmed}
            onCancel={() => { setFile(null); setCurrentStep('upload'); }}
          />
        </div>
      </div>
    );
  }

  // Render normal (Paso 1 y 3)
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <h2 className="text-xl font-bold">
            {currentStep === 'upload' ? `Subir ${documentType.name}` : 'Finalizar Firma'}
          </h2>
          <button onClick={onClose}><X className="w-6 h-6 text-gray-400"/></button>
        </div>

        {error && <div className="mb-4 bg-red-50 text-red-700 p-3 rounded">{error}</div>}

        {currentStep === 'upload' ? (
          /* PASO 1: SUBIR PDF */
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-all">
             <input type="file" accept=".pdf" onChange={handleFileChange} className="hidden" id="file-upload" />
             <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
               <Upload className="w-12 h-12 text-gray-400 mb-4" />
               <span className="text-gray-600 font-medium">Seleccionar PDF para firmar</span>
             </label>
          </div>
        ) : (
          /* PASO 3: CREDENCIALES */
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="bg-blue-50 p-3 rounded-lg flex items-center gap-3 text-blue-800 text-sm mb-4">
              <PenTool className="w-5 h-5"/>
              <span>Firma colocada en página {coords?.page}. Ingresa tu llave para aplicar.</span>
            </div>

            <div className="space-y-3">
               <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Llave Privada (.pem)</label>
                  <input type="file" accept=".pem,.key" onChange={e => setPemFile(e.target.files?.[0] || null)} 
                    className="w-full mt-1 text-sm text-gray-600 file:mr-2 file:py-1 file:px-3 file:rounded-full file:bg-gray-100 file:border-0 hover:file:bg-gray-200"/>
               </div>
               <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Contraseña</label>
                  <div className="relative mt-1">
                    <input type="password" value={pemPassword} onChange={e => setPemPassword(e.target.value)} 
                      className="w-full pl-9 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"/>
                    <Key className="w-4 h-4 text-gray-400 absolute left-3 top-3"/>
                  </div>
               </div>
            </div>

            <div className="flex gap-3 pt-4 mt-6 border-t">
              <button onClick={() => setCurrentStep('place-signature')} className="flex-1 py-2 border rounded-lg hover:bg-gray-50 text-gray-600">
                Cambiar Posición
              </button>
              <button 
                onClick={handleUploadAndSign}
                disabled={uploading || !pemFile || !pemPassword}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex justify-center items-center gap-2"
              >
                {uploading ? (
                  <> <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> Firmando... </>
                ) : (
                  <> <Lock className="w-4 h-4"/> Firmar y Subir </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}