import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Database } from '../../lib/database.types';
import { X, FileText, Download, CheckCircle, XCircle, MessageSquare, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { PdfViewerModal } from './PdfViewerModal';

type Expediente = Database['public']['Tables']['expedientes']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];
type Period = Database['public']['Tables']['periods']['Row'];
type Document = Database['public']['Tables']['documents']['Row'];
type DocumentType = Database['public']['Tables']['document_types']['Row'];

interface ExpedienteWithDetails extends Expediente {
  profiles: Profile;
  periods: Period;
}

interface DocumentWithType extends Document {
  document_types: DocumentType;
}

interface ExpedienteDetailModalProps {
  expediente: ExpedienteWithDetails;
  onClose: () => void;
  onUpdate: () => void;
}

export function ExpedienteDetailModal({ expediente, onClose, onUpdate }: ExpedienteDetailModalProps) {
  const { profile } = useAuth();
  const [documents, setDocuments] = useState<DocumentWithType[]>([]);
  const [allDocumentTypes, setAllDocumentTypes] = useState<DocumentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState<DocumentWithType | null>(null);
  const [comments, setComments] = useState('');
  const [processing, setProcessing] = useState(false);
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [pdfFileUrl, setPdfFileUrl] = useState<string | null>(null);
  const [pdfFileName, setPdfFileName] = useState<string>('');
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    const fetchDocumentTypes = async () => {
      const { data, error } = await supabase.from('document_types').select('*');
      if (error) console.error('Error fetching document types:', error);
      else setAllDocumentTypes(data || []);
    };
    fetchDocumentTypes();
    loadDocuments();
  }, [expediente.id]);

  const loadDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*, document_types(*)')
        .eq('expediente_id', expediente.id)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      setDocuments(data as DocumentWithType[]);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadDocument = async (doc: Document) => {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(doc.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading document:', error);
      alert('Error al descargar el documento');
    }
  };

  const viewDocument = async (doc: Document) => {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(doc.file_path, 3600); // URL valid for 1 hour

      if (error) throw error;

      setPdfFileUrl(data.signedUrl);
      setPdfFileName(doc.file_name);
      setPdfViewerOpen(true);
    } catch (error) {
      console.error('Error creating signed URL:', error);
      alert('Error al visualizar el documento');
    }
  };

  const handleDocumentAction = async (docId: string, action: 'accept' | 'reject' | 'request_correction') => {
    if (!profile) return;

    setProcessing(true);
    try {
      const statusMap = {
        accept: 'accepted',
        reject: 'rejected',
        request_correction: 'correction_requested',
      };

      const { error: updateError } = await supabase
        .from('documents')
        .update({
          status: statusMap[action],
          reviewed_by: profile.id,
          reviewed_at: new Date().toISOString(),
          reviewer_comments: comments || null,
        })
        .eq('id', docId);

      if (updateError) throw updateError;

      await supabase.from('document_history').insert({
        document_id: docId,
        action,
        status: statusMap[action],
        comments: comments || null,
        performed_by: profile.id,
      });

      const doc = documents.find(d => d.id === docId);
      if (doc) {
        await supabase.from('notifications').insert({
          user_id: expediente.student_id,
          title: 'Estado de documento actualizado',
          message: `Tu documento "${doc.document_types.name}" ha sido ${statusMap[action] === 'accepted' ? 'aceptado' : statusMap[action] === 'rejected' ? 'rechazado' : 'marcado para corrección'}`,
          type: 'document_status',
          related_document_id: docId,
        });
      }

      // Re-fetch documents to get the latest statuses for calculation
      const { data: latestDocuments, error: fetchDocsError } = await supabase
        .from('documents')
        .select('*, document_types(*)')
        .eq('expediente_id', expediente.id)
        .order('uploaded_at', { ascending: false });

      if (fetchDocsError) throw fetchDocsError;
      const docs = latestDocuments as DocumentWithType[];
      setDocuments(docs); // Update local documents state

      // Calculate new progress percentage
      const acceptedDocumentsCount = docs.filter(d => d.status === 'accepted').length;
      const totalDocumentTypesCount = allDocumentTypes.length; // Use the fetched total document types

      let calculatedProgress = 0;
      if (totalDocumentTypesCount > 0) {
        calculatedProgress = parseFloat(((acceptedDocumentsCount / totalDocumentTypesCount) * 100).toFixed(2));
      }

      // Update expediente's progress_percentage in Supabase
      if (expediente.progress_percentage !== calculatedProgress) {
        const { error: updateExpedienteError } = await supabase
          .from('expedientes')
          .update({ progress_percentage: calculatedProgress })
          .eq('id', expediente.id);

        if (updateExpedienteError) throw updateExpedienteError;
      }

      setComments('');
      setSelectedDoc(null);
      // await loadDocuments(); // Removed as I'm doing a direct fetch above
      onUpdate(); // This will trigger the parent to reload expedientes
    } catch (error) {
      console.error('Error updating document:', error);
      alert('Error al actualizar el documento');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: { icon: AlertCircle, label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
      in_review: { icon: AlertCircle, label: 'En Revisión', color: 'bg-blue-100 text-blue-800' },
      accepted: { icon: CheckCircle, label: 'Aceptado', color: 'bg-green-100 text-green-800' },
      rejected: { icon: XCircle, label: 'Rechazado', color: 'bg-red-100 text-red-800' },
      correction_requested: { icon: AlertCircle, label: 'Corrección Solicitada', color: 'bg-orange-100 text-orange-800' },
    };

    const badge = badges[status as keyof typeof badges] || badges.pending;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${badge.color}`}>
        <Icon className="w-4 h-4" />
        {badge.label}
      </span>
    );
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
        <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full my-8 flex flex-col max-h-[90vh]">
          <div className="flex items-center justify-between p-6 border-b flex-shrink-0">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{expediente.profiles.full_name}</h2>
              <p className="text-sm text-gray-600 mt-1">
                {expediente.profiles.matricula} • {expediente.profiles.carrera}
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto flex-grow">
            <div className="bg-gradient-to-r from-blue-50 to-slate-50 rounded-xl p-4 mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Periodo</p>
                  <p className="font-semibold text-gray-900">{expediente.periods.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Progreso</p>
                  <p className="font-semibold text-gray-900">{expediente.progress_percentage.toFixed(0)}%</p>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-lg text-gray-900">Documentos del Expediente</h3>
                  <button onClick={() => setShowInfo(!showInfo)} className="text-blue-600 text-sm">
                    {showInfo ? 'Ocultar' : 'Mostrar'} información de revisión
                  </button>
                </div>

                {showInfo && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-blue-800">
                    Para revisar un documento, haga clic en el botón 'Revisar'. Esto le permitirá Aceptar, Rechazar o Solicitar Correcciones al documento. Puede agregar comentarios opcionales antes de tomar una acción.
                  </p>
                </div>
                )}

                {documents.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>No hay documentos en este expediente</p>
                  </div>
                ) : (
                  documents.map((doc) => (
                    <div key={doc.id} className="border rounded-lg p-4 hover:bg-gray-50 transition">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <FileText className="w-5 h-5 text-blue-600" />
                            <h4 className="font-semibold text-gray-900">{doc.document_types.name}</h4>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">
                            Subido: {new Date(doc.uploaded_at).toLocaleString()}
                          </p>
                          {getStatusBadge(doc.status)}
                        </div>
                      </div>

                      {doc.reviewer_comments && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
                          <p className="text-sm font-medium text-amber-900 mb-1">Comentarios:</p>
                          <p className="text-sm text-amber-800">{doc.reviewer_comments}</p>
                        </div>
                      )}

                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => downloadDocument(doc)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm transition"
                        >
                          <Download className="w-4 h-4" />
                          Descargar
                        </button>

                        {doc.file_name.toLowerCase().endsWith('.pdf') && (
                          <button
                            onClick={() => viewDocument(doc)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-sm transition"
                          >
                            <FileText className="w-4 h-4" />
                            Visualizar
                          </button>
                        )}

                                              {(doc.status === 'pending' || doc.status === 'in_review') && (
                                                <>
                                                  {selectedDoc?.id === doc.id ? (
                                                    <div className="flex-1 flex gap-2">
                                                      <input
                                                        type="text"
                                                        placeholder="Comentarios (opcional)"
                                                        value={comments}
                                                        onChange={(e) => setComments(e.target.value)}
                                                        className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                                                      />
                                                      <button
                                                        onClick={() => handleDocumentAction(doc.id, 'accept')}
                                                        disabled={processing}
                                                        className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition disabled:opacity-50"
                                                      >
                                                        <CheckCircle className="w-4 h-4" />
                                                        Aceptar
                                                      </button>
                                                      <button
                                                        onClick={() => handleDocumentAction(doc.id, 'reject')}
                                                        disabled={processing}
                                                        className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition disabled:opacity-50"
                                                      >
                                                        <XCircle className="w-4 h-4" />
                                                        Rechazar
                                                      </button>
                                                      <button
                                                        onClick={() => handleDocumentAction(doc.id, 'request_correction')}
                                                        disabled={processing}
                                                        className="flex items-center gap-1 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm transition disabled:opacity-50"
                                                      >
                                                        <MessageSquare className="w-4 h-4" />
                                                        Solicitar Corrección
                                                      </button>
                                                      <button
                                                        onClick={() => {
                                                          setSelectedDoc(null);
                                                          setComments('');
                                                        }}
                                                        className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm transition"
                                                      >
                                                        Cancelar
                                                      </button>
                                                    </div>
                                                  ) : (
                                                    <button
                                                      onClick={() => setSelectedDoc(doc)}
                                                      className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition"
                                                    >
                                                      <MessageSquare className="w-4 h-4" />
                                                      Revisar
                                                    </button>
                                                  )}
                                                </>
                                              )}                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {pdfViewerOpen && pdfFileUrl && (
        <PdfViewerModal
          fileUrl={pdfFileUrl}
          fileName={pdfFileName}
          onClose={() => {
            setPdfViewerOpen(false);
            setPdfFileUrl(null);
            setPdfFileName('');
          }}
        />
      )}
    </>
  );
}
