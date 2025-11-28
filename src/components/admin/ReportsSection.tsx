import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Download, FileText, Users, TrendingUp, Clock } from 'lucide-react';

interface ReportStats {
  totalExpedientes: number;
  completedExpedientes: number;
  totalStudents: number;
  totalDocuments: number;
  documentsByStatus: {
    pending: number;
    in_review: number;
    accepted: number;
    rejected: number;
    correction_requested: number;
  };
  expedientesByReviewer: Array<{
    reviewer_name: string;
    count: number;
  }>;
}

export function ReportsSection() {
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [expedientes, students, documents, reviewerStats] = await Promise.all([
        supabase.from('expedientes').select('*'),
        supabase.from('profiles').select('*').eq('role', 'student'),
        supabase.from('documents').select('status'),
        supabase.rpc('get_expedientes_by_reviewer') as any,
      ]);

      const documentsByStatus = {
        pending: 0,
        in_review: 0,
        accepted: 0,
        rejected: 0,
        correction_requested: 0,
      };

      documents.data?.forEach((doc) => {
        if (doc.status in documentsByStatus) {
          documentsByStatus[doc.status as keyof typeof documentsByStatus]++;
        }
      });

      setStats({
        totalExpedientes: expedientes.data?.length || 0,
        completedExpedientes: expedientes.data?.filter((e) => e.status === 'completed').length || 0,
        totalStudents: students.data?.length || 0,
        totalDocuments: documents.data?.length || 0,
        documentsByStatus,
        expedientesByReviewer: reviewerStats.data || [],
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = async () => {
    try {
      const { data: expedientes } = await supabase
        .from('expedientes')
        .select(`
          *,
          profiles!expedientes_student_id_fkey(full_name, matricula, carrera),
          periods(name)
        `);

      if (!expedientes) return;

      const csv = [
        ['Estudiante', 'Matrícula', 'Carrera', 'Periodo', 'Progreso', 'Estado'].join(','),
        ...expedientes.map((exp: any) =>
          [
            exp.profiles.full_name,
            exp.profiles.matricula,
            exp.profiles.carrera,
            exp.periods.name,
            exp.progress_percentage,
            exp.status,
          ].join(',')
        ),
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte_expedientes_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('Error al exportar CSV');
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Reportes y Estadísticas</h2>
        <button
          onClick={exportToCSV}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition"
        >
          <Download className="w-5 h-5" />
          Exportar CSV
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-blue-100 p-2 rounded-lg">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Expedientes</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalExpedientes}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-green-100 p-2 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Completados</p>
              <p className="text-2xl font-bold text-gray-900">{stats.completedExpedientes}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-purple-100 p-2 rounded-lg">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Estudiantes</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalStudents}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-orange-100 p-2 rounded-lg">
              <Clock className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Documentos</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalDocuments}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Documentos por Estado</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">Pendientes</span>
              <span className="text-lg font-bold text-yellow-700">{stats.documentsByStatus.pending}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">En Revisión</span>
              <span className="text-lg font-bold text-blue-700">{stats.documentsByStatus.in_review}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">Aceptados</span>
              <span className="text-lg font-bold text-green-700">{stats.documentsByStatus.accepted}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">Rechazados</span>
              <span className="text-lg font-bold text-red-700">{stats.documentsByStatus.rejected}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">Corrección Solicitada</span>
              <span className="text-lg font-bold text-orange-700">
                {stats.documentsByStatus.correction_requested}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Expedientes por Revisor</h3>
          {stats.expedientesByReviewer.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No hay datos disponibles</p>
          ) : (
            <div className="space-y-3">
              {stats.expedientesByReviewer.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">
                    {item.reviewer_name || 'Sin asignar'}
                  </span>
                  <span className="text-lg font-bold text-gray-900">{item.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
