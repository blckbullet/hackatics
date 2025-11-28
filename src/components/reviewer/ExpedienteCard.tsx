import { Database } from '../../lib/database.types';
import { User, Calendar, TrendingUp, FileText } from 'lucide-react';

type Expediente = Database['public']['Tables']['expedientes']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];
type Period = Database['public']['Tables']['periods']['Row'];

interface ExpedienteWithDetails extends Expediente {
  profiles: Profile;
  periods: Period;
  documents: { count: number };
}

interface ExpedienteCardProps {
  expediente: ExpedienteWithDetails;
  onClick: () => void;
}

export function ExpedienteCard({ expediente, onClick }: ExpedienteCardProps) {
  const student = expediente.profiles;
  const period = expediente.periods;

  const getStatusColor = (expediente: ExpedienteWithDetails) => {
    if (expediente.progress_percentage === 100) {
      return 'bg-green-100 text-green-800';
    }
    const colors = {
      in_progress: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return colors[expediente.status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (expediente: ExpedienteWithDetails) => {
    if (expediente.progress_percentage === 100) {
      return 'Finalizado';
    }
    const labels = {
      in_progress: 'En Progreso',
      completed: 'Completado',
      cancelled: 'Cancelado',
    };
    return labels[expediente.status as keyof typeof labels] || expediente.status;
  };

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl shadow-sm border hover:shadow-md transition cursor-pointer"
    >
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-full">
              <User className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{student.full_name}</h3>
              <p className="text-sm text-gray-600">
                {student.matricula} • {student.carrera}
              </p>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(expediente)}`}>
            {getStatusLabel(expediente)}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-4 pt-4 border-t">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Periodo</p>
              <p className="text-sm font-medium text-gray-900">{period.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Progreso</p>
              <p className="text-sm font-medium text-gray-900">{expediente.progress_percentage.toFixed(0)}%</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Documentos</p>
              <p className="text-sm font-medium text-gray-900">{expediente.documents.count}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
