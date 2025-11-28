import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { Database } from "../../lib/database.types";
import { X, Upload, FileText, AlertCircle } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

type Expediente = Database["public"]["Tables"]["expedientes"]["Row"];
type DocumentType = Database["public"]["Tables"]["document_types"]["Row"];

interface DocumentUploadModalProps {
  expediente: Expediente;
  documentType: DocumentType;
  onClose: () => void;
  onSuccess: () => void;
}

export function DocumentUploadModal({
  expediente,
  documentType,
  onClose,
  onSuccess,
}: DocumentUploadModalProps) {
  const { profile } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) {
      setFile(null);
      setError("");
      return;
    }

    // 1. Validar tipo MIME
    if (selectedFile.type !== "application/pdf") {
      setError("Solo se permiten archivos en formato PDF.");
      e.target.value = ""; // Limpia el input
      setFile(null);
      return;
    }

    // 2. Validar extensión (por si alguien cambia el tipo manualmente)
    if (!selectedFile.name.toLowerCase().endsWith(".pdf")) {
      setError("El archivo debe tener extensión .pdf");
      e.target.value = "";
      setFile(null);
      return;
    }

    // 3. Validar tamaño (máximo 10MB)
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError("El archivo no debe superar los 10MB.");
      e.target.value = "";
      setFile(null);
      return;
    }

    setFile(selectedFile);
    setError("");
  };

  const handleUpload = async () => {
    if (!file || !profile) return;

    setUploading(true);
    setError("");

    try {
      const { data: existingDocs } = await supabase
        .from("documents")
        .select("version")
        .eq("expediente_id", expediente.id)
        .eq("document_type_id", documentType.id)
        .order("version", { ascending: false })
        .limit(1);

      const newVersion =
        existingDocs && existingDocs.length > 0
          ? existingDocs[0].version + 1
          : 1;

      const fileName = `${expediente.id}/${expediente.student_id}_${documentType.id}_v${newVersion}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: docData, error: docError } = await supabase
        .from("documents")
        .insert({
          expediente_id: expediente.id,
          document_type_id: documentType.id,
          file_path: fileName,
          file_name: file.name,
          version: newVersion,
          status: "pending",
          uploaded_by: profile.id,
        })
        .select()
        .single();

      if (docError) throw docError;

      await supabase.from("document_history").insert({
        document_id: docData.id,
        action: "uploaded",
        status: "pending",
        performed_by: profile.id,
      });

      if (expediente.assigned_reviewer_id) {
        await supabase.from("notifications").insert({
          user_id: expediente.assigned_reviewer_id,
          title: "Nuevo documento subido",
          message: `${profile.full_name} ha subido: ${documentType.name}`,
          type: "document_status",
          related_document_id: docData.id,
        });
      }

      onSuccess();
    } catch (err: any) {
      console.error("Upload error:", err);
      setError(err.message || "Error al subir el documento. Intenta de nuevo.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">
            Subir {documentType.name}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
            disabled={uploading}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {documentType.description && (
            <div className="mb-5 text-sm text-gray-600">
              {documentType.description}
            </div>
          )}

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Selecciona tu archivo PDF
            </label>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-all duration-200">
              <input
                type="file"
                accept="application/pdf,.pdf" // Doble restricción
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
                disabled={uploading}
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center"
              >
                <Upload className="w-12 h-12 text-gray-400 mb-4" />

                {file ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-green-600 font-medium">
                      <FileText className="w-5 h-5" />
                      <span>{file.name}</span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                ) : (
                  <>
                    <span className="text-sm text-gray-600 font-medium">
                      Haz clic para seleccionar tu PDF
                    </span>
                    <p className="text-xs text-gray-500 mt-2">
                      Máximo 10MB • Solo formato PDF
                    </p>
                  </>
                )}
              </label>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={uploading}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Subiendo...
                </>
              ) : (
                "Subir PDF"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
