import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import { Database } from "../../lib/database.types";
import {
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Download,
  LogOut,
} from "lucide-react";
import { FileObject } from "@supabase/storage-js";
import { DocumentUploadModal } from "./DocumentUploadModal";
import { NotificationBell } from "../shared/NotificationBell";
import { PdfViewerModal } from "../reviewer/PdfViewerModal";

type Expediente = Database["public"]["Tables"]["expedientes"]["Row"];
type Document = Database["public"]["Tables"]["documents"]["Row"];
type DocumentType = Database["public"]["Tables"]["document_types"]["Row"];

interface DocumentWithType extends Document {
  document_types: DocumentType;
}

export function StudentDashboard() {
  const { profile, signOut } = useAuth();

  const [expediente, setExpediente] = useState<Expediente | null>(null);
  const [documents, setDocuments] = useState<DocumentWithType[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [formatos, setFormatos] = useState<FileObject[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados para firma digital
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const signatureInputRef = useRef<HTMLInputElement>(null);

  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState<DocumentType | null>(
    null
  );
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [pdfFileUrl, setPdfFileUrl] = useState<string | null>(null);
  const [pdfFileName, setPdfFileName] = useState<string>("");

  // ==================== CARGA INICIAL ====================
  const loadExpediente = useCallback(async () => {
    try {
      const { data: activePeriod } = await supabase
        .from("periods")
        .select("*")
        .eq("is_active", true)
        .maybeSingle();

      if (!activePeriod) {
        setLoading(false);
        return;
      }

      let currentExpediente: Expediente | null = null;
      const { data: expData, error: expError } = await supabase
        .from("expedientes")
        .select("*")
        .eq("student_id", profile?.id)
        .eq("period_id", activePeriod.id)
        .maybeSingle();

      if (expError && expError.code !== "PGRST116") throw expError;

      if (!expData) {
        const { data: newExp, error: createError } = await supabase
          .from("expedientes")
          .insert({
            student_id: profile!.id,
            period_id: activePeriod.id,
            progress_percentage: 0,
          })
          .select()
          .single();

        if (createError) throw createError;
        currentExpediente = newExp;
      } else {
        currentExpediente = expData;
      }
      setExpediente(currentExpediente);

      const { data: fetchedDocuments } = await supabase
        .from("documents")
        .select("*, document_types(*)")
        .eq("expediente_id", currentExpediente?.id || "")
        .order("uploaded_at", { ascending: false });

      setDocuments((fetchedDocuments as DocumentWithType[]) || []);

      const { data: fetchedDocumentTypes } = await supabase
        .from("document_types")
        .select("*")
        .order("order_number");

      setDocumentTypes(fetchedDocumentTypes || []);

      // Cálculo de progreso
      const acceptedCount = (fetchedDocuments || []).filter(
        (d: any) => d.status === "accepted"
      ).length;
      const total = (fetchedDocumentTypes || []).length;
      const progress = total > 0 ? (acceptedCount / total) * 100 : 0;

      if (
        currentExpediente &&
        Math.abs(currentExpediente.progress_percentage - progress) > 0.01
      ) {
        await supabase
          .from("expedientes")
          .update({ progress_percentage: progress })
          .eq("id", currentExpediente.id);
        setExpediente((prev) =>
          prev ? { ...prev, progress_percentage: progress } : null
        );
      }
    } catch (error) {
      console.error("Error cargando expediente:", error);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    loadExpediente();
  }, [loadExpediente]);

  // Cargar formatos descargables
  useEffect(() => {
    const fetchFormatos = async () => {
      const { data } = await supabase.storage.from("formatos").list();
      if (data) setFormatos(data);
    };
    fetchFormatos();
  }, []);

  // ==================== FIRMA DIGITAL ====================
  // Cargar firma existente al montar el componente
  useEffect(() => {
    const loadSignature = async () => {
      if (!profile?.signature_path) return;

      const { data } = await supabase.storage
        .from("signatures")
        .createSignedUrl(profile.signature_path, 3600);

      if (data) setSignatureUrl(data.signedUrl);
    };
    loadSignature();
  }, [profile?.signature_path]);

  const handleSignatureUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.id) return;

    if (!file.type.includes("png")) {
      alert("Solo se permiten archivos PNG.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert("La imagen no debe pesar más de 2 MB.");
      return;
    }

    setUploadingSignature(true);

    const fileName = `${profile.id}.png`; // Nombre único por alumno

    const { error: uploadError } = await supabase.storage
      .from("signatures")
      .upload(fileName, file, {
        upsert: true,
        contentType: "image/png",
      });

    if (uploadError) {
      console.error("Error subiendo firma:", uploadError);
      alert("Error al subir la firma. Intenta de nuevo.");
      setUploadingSignature(false);
      return;
    }

    // Actualizar columna signature_path en profiles
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ signature_path: fileName })
      .eq("id", profile.id);

    if (updateError) {
      console.error("Error actualizando perfil:", updateError);
      alert("Firma subida pero no se pudo guardar la referencia.");
    }

    // Obtener URL firmada y actualizar estado
    const { data } = await supabase.storage
      .from("signatures")
      .createSignedUrl(fileName, 3600);

    if (data) setSignatureUrl(data.signedUrl);

    setUploadingSignature(false);
  };

  const triggerSignatureUpload = () => {
    signatureInputRef.current?.click();
  };

  // ==================== FUNCIONES EXISTENTES ====================
  const handleDownloadFormato = async (fileName: string) => {
    const { data } = await supabase.storage
      .from("formatos")
      .createSignedUrl(fileName, 60);
    if (data) window.open(data.signedUrl, "_blank");
  };

  const viewFormato = async (fileName: string) => {
    const { data } = await supabase.storage
      .from("formatos")
      .createSignedUrl(fileName, 300);
    if (data) {
      const viewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(
        data.signedUrl
      )}&embedded=true`;
      window.open(viewerUrl, "_blank");
    }
  };

  const handleUploadClick = (docType: DocumentType) => {
    setSelectedDocType(docType);
    setUploadModalOpen(true);
  };

  const handleUploadSuccess = () => {
    setUploadModalOpen(false);
    loadExpediente();
  };

  const downloadDocument = async (doc: Document) => {
    const { data } = await supabase.storage
      .from("documents")
      .download(doc.file_path);
    if (data) {
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.file_name;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const viewDocument = async (doc: Document) => {
    const { data } = await supabase.storage
      .from("documents")
      .createSignedUrl(doc.file_path, 3600);
    if (data) {
      setPdfFileUrl(data.signedUrl);
      setPdfFileName(doc.file_name);
      setPdfViewerOpen(true);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, any> = {
      pending: {
        Icon: Clock,
        label: "Pendiente",
        color: "bg-yellow-100 text-yellow-800",
      },
      in_review: {
        Icon: AlertCircle,
        label: "En Revisión",
        color: "bg-blue-100 text-blue-800",
      },
      accepted: {
        Icon: CheckCircle,
        label: "Aceptado",
        color: "bg-green-100 text-green-800",
      },
      rejected: {
        Icon: XCircle,
        label: "Rechazado",
        color: "bg-red-100 text-red-800",
      },
      correction_requested: {
        Icon: AlertCircle,
        label: "Corrección Solicitada",
        color: "bg-orange-100 text-orange-800",
      },
    };

    const {
      Icon = Clock,
      label = "Pendiente",
      color = "bg-yellow-100 text-yellow-800",
    } = badges[status] || {};

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${color}`}
      >
        <Icon className="w-4 h-4" /> {label}
      </span>
    );
  };

  // ==================== RENDER ====================
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!expediente) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-center">
        <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
        <p className="text-xl text-gray-700">
          No hay periodo activo en este momento
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Mis Formatos
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {profile?.full_name} • {profile?.matricula}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <NotificationBell />
              <button
                onClick={signOut}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                <LogOut className="w-5 h-5" /> Salir
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* ==================== SECCIÓN FIRMA DIGITAL ==================== */}
          <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <svg
                className="w-6 h-6 text-indigo-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              Mi Firma Digital (PNG con fondo transparente)
            </h3>

            <div className="max-w-md">
              {signatureUrl ? (
                <div className="space-y-6">
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 bg-gray-50 text-center">
                    <img
                      src={signatureUrl}
                      alt="Firma del alumno"
                      className="max-h-32 mx-auto object-contain bg-white rounded-lg shadow-md"
                    />
                    <p className="text-sm text-gray-600 mt-4 font-medium">
                      Firma cargada correctamente
                    </p>
                  </div>

                  <button
                    onClick={triggerSignatureUpload}
                    disabled={uploadingSignature}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg font-medium transition"
                  >
                    {uploadingSignature ? (
                      "Subiendo..."
                    ) : (
                      <>
                        <Upload className="w-5 h-5" />
                        Cambiar Firma
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center bg-gray-50">
                  <div className="bg-gray-200 border-2 border-dashed rounded-xl w-32 h-32 mx-auto mb-4 flex items-center justify-center">
                    <svg
                      className="w-12 h-12 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                  </div>
                  <p className="text-gray-600 mb-2">
                    Aún no has subido tu firma digital
                  </p>
                  <p className="text-sm text-gray-500 mb-6">
                    Debe ser un archivo{" "}
                    <strong>PNG con fondo transparente</strong> y firma en negro
                    o azul oscuro.
                  </p>

                  <button
                    onClick={triggerSignatureUpload}
                    disabled={uploadingSignature}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg font-medium transition"
                  >
                    {uploadingSignature ? (
                      "Subiendo firma..."
                    ) : (
                      <>
                        <Upload className="w-5 h-5" />
                        Subir Firma PNG
                      </>
                    )}
                  </button>
                </div>
              )}

              <input
                ref={signatureInputRef}
                type="file"
                accept="image/png"
                onChange={handleSignatureUpload}
                className="hidden"
              />
            </div>

            <div className="mt-6 text-sm text-gray-500">
              <p>
                <strong>Tip:</strong> Firma en una hoja blanca, toma foto con
                buena luz, luego usa una app como "Remove.bg" o "Background
                Eraser" para dejar el fondo transparente.
              </p>
            </div>
          </div>

          {/* ==================== FORMATOS DESCARGABLES ==================== */}
          <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Download className="w-5 h-5 text-gray-600" />
              Formatos para Descargar
            </h3>

            {formatos.length > 0 ? (
              <ul className="space-y-3">
                {formatos.map((formato) => {
                  const displayName = formato.name
                    .replace(/_/g, " ")
                    .replace(/\.[^.]+$/, "");

                  return (
                    <li
                      key={formato.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg bg-gray-50 hover:bg-gray-100 transition"
                    >
                      <div className="flex items-center gap-3 mb-3 sm:mb-0">
                        <FileText className="w-5 h-5 text-blue-600" />
                        <span className="text-sm font-medium text-gray-800 truncate max-w-xs">
                          {displayName}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handleDownloadFormato(formato.name)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-xs font-medium transition"
                        >
                          <Download className="w-4 h-4" /> Descargar
                        </button>

                        {formato.name.match(/\.(doc|docx)$/i) && (
                          <button
                            onClick={() => viewFormato(formato.name)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition"
                          >
                            <FileText className="w-4 h-4" /> Ver
                          </button>
                        )}

                        <button
                          onClick={() =>
                            documentTypes[0] &&
                            handleUploadClick(documentTypes[0])
                          }
                          disabled={!documentTypes[0]}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition shadow-sm ${
                            documentTypes[0]
                              ? "bg-green-600 hover:bg-green-700 text-white"
                              : "bg-gray-400 text-gray-200 cursor-not-allowed"
                          }`}
                        >
                          <Upload className="w-4 h-4" />
                          Subir PDF
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">
                No hay formatos disponibles para descargar.
              </p>
            )}
          </div>

          {/* ==================== HISTORIAL COMPLETO DE DOCUMENTOS ==================== */}
          <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <FileText className="w-6 h-6 text-blue-600" />
              Historial Completo de Documentos Subidos
            </h3>

            {documentTypes.length === 0 ? (
              <p className="text-sm text-gray-500">
                No hay tipos de documentos configurados.
              </p>
            ) : (
              <div className="space-y-10">
                {documentTypes.map((docType) => {
                  const versions = documents
                    .filter((d) => d.document_type_id === docType.id)
                    .sort(
                      (a, b) =>
                        new Date(b.uploaded_at).getTime() -
                        new Date(a.uploaded_at).getTime()
                    );

                  const latestDoc = versions[0];

                  return (
                    <div
                      key={docType.id}
                      className="border-l-4 border-blue-500 pl-6"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-semibold text-gray-800">
                          {docType.name}
                        </h4>
                        {versions.length > 0 && (
                          <span className="text-sm text-gray-500">
                            {versions.length} versión
                            {versions.length > 1 ? "es" : ""}
                          </span>
                        )}
                      </div>

                      {versions.length === 0 ? (
                        <div className="text-center py-6 bg-gray-50 rounded-lg">
                          <p className="text-gray-500 italic mb-4">
                            Aún no has subido este documento
                          </p>
                          <button
                            onClick={() => handleUploadClick(docType)}
                            className="flex items-center gap-2 mx-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
                          >
                            <Upload className="w-4 h-4" />
                            Subir {docType.name}
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {versions.map((doc, index) => (
                            <div
                              key={doc.id}
                              className={`p-5 rounded-lg border-2 transition-all ${
                                index === 0
                                  ? "border-blue-400 bg-blue-50 shadow-sm"
                                  : "border-gray-200 bg-gray-50"
                              }`}
                            >
                              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-3">
                                    {getStatusBadge(doc.status)}
                                    {index === 0 && (
                                      <span className="text-xs font-bold bg-blue-600 text-white px-3 py-1 rounded-full">
                                        Versión Actual
                                      </span>
                                    )}
                                  </div>

                                  <div className="text-sm text-gray-700 space-y-1">
                                    <p>
                                      <strong>Subido:</strong>{" "}
                                      {new Date(doc.uploaded_at).toLocaleString(
                                        "es-MX",
                                        {
                                          day: "2-digit",
                                          month: "long",
                                          year: "numeric",
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        }
                                      )}
                                    </p>
                                    <p>
                                      <strong>Archivo:</strong> {doc.file_name}
                                    </p>
                                  </div>

                                  {doc.reviewer_comments && (
                                    <div className="mt-4 p-4 bg-amber-50 border border-amber-300 rounded-lg">
                                      <p className="text-sm font-semibold text-amber-900">
                                        Comentario del revisor:
                                      </p>
                                      <p className="text-sm text-amber-800 mt-1">
                                        {doc.reviewer_comments}
                                      </p>
                                    </div>
                                  )}
                                </div>

                                <div className="flex flex-wrap gap-2">
                                  <button
                                    onClick={() => downloadDocument(doc)}
                                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition"
                                  >
                                    <Download className="w-4 h-4" />
                                    Descargar
                                  </button>

                                  {doc.file_name
                                    .toLowerCase()
                                    .endsWith(".pdf") && (
                                    <button
                                      onClick={() => viewDocument(doc)}
                                      className="flex items-center gap-2 px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-sm transition"
                                    >
                                      <FileText className="w-4 h-4" />
                                      Ver PDF
                                    </button>
                                  )}

                                  {(doc.status === "rejected" ||
                                    doc.status === "correction_requested") &&
                                    index === 0 && (
                                      <button
                                        onClick={() =>
                                          handleUploadClick(docType)
                                        }
                                        className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition"
                                      >
                                        <Upload className="w-4 h-4" />
                                        Subir Corrección
                                      </button>
                                    )}
                                </div>
                              </div>
                            </div>
                          ))}

                          {latestDoc &&
                            !["rejected", "correction_requested"].includes(
                              latestDoc.status
                            ) &&
                            latestDoc.status !== "pending" && (
                              <div className="mt-4 text-center">
                                <button
                                  onClick={() => handleUploadClick(docType)}
                                  className="text-sm text-blue-600 hover:text-blue-800 underline"
                                >
                                  Subir nueva versión de {docType.name}
                                </button>
                              </div>
                            )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Puedes mantener o quitar la lista rápida de abajo */}
          {/* ... resto del código (lista rápida, modales, etc.) ... */}
        </main>

        {/* ==================== MODALES ==================== */}
        {uploadModalOpen && selectedDocType && expediente && (
          <DocumentUploadModal
            expediente={expediente}
            documentType={selectedDocType}
            onClose={() => setUploadModalOpen(false)}
            onSuccess={handleUploadSuccess}
          />
        )}

        {pdfViewerOpen && pdfFileUrl && (
          <PdfViewerModal
            fileUrl={pdfFileUrl}
            fileName={pdfFileName}
            onClose={() => {
              setPdfViewerOpen(false);
              setPdfFileUrl(null);
              setPdfFileName("");
            }}
          />
        )}
      </div>
    </>
  );
}
