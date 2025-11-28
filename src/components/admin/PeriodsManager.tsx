import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Database } from '../../lib/database.types';
import { Plus, Edit, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

type Period = Database['public']['Tables']['periods']['Row'];

export function PeriodsManager() {
  const { profile } = useAuth();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<Period | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    start_date: '',
    end_date: '',
    is_active: false,
  });

  useEffect(() => {
    loadPeriods();
  }, []);

  const loadPeriods = async () => {
    try {
      const { data, error } = await supabase
        .from('periods')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPeriods(data);
    } catch (error) {
      console.error('Error loading periods:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingPeriod) {
        const { error } = await supabase
          .from('periods')
          .update({
            ...formData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingPeriod.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('periods')
          .insert({
            ...formData,
            created_by: profile?.id,
          });

        if (error) throw error;
      }

      setShowModal(false);
      setEditingPeriod(null);
      setFormData({ name: '', start_date: '', end_date: '', is_active: false });
      loadPeriods();
    } catch (error) {
      console.error('Error saving period:', error);
      alert('Error al guardar el periodo');
    }
  };

  const handleEdit = (period: Period) => {
    setEditingPeriod(period);
    setFormData({
      name: period.name,
      start_date: period.start_date,
      end_date: period.end_date,
      is_active: period.is_active,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este periodo?')) return;

    try {
      const { error } = await supabase
        .from('periods')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadPeriods();
    } catch (error) {
      console.error('Error deleting period:', error);
      alert('Error al eliminar el periodo');
    }
  };

  const toggleActive = async (period: Period) => {
    try {
      const { error } = await supabase
        .from('periods')
        .update({ is_active: !period.is_active })
        .eq('id', period.id);

      if (error) throw error;
      loadPeriods();
    } catch (error) {
      console.error('Error toggling period:', error);
      alert('Error al actualizar el periodo');
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Gestión de Periodos</h2>
        <button
          onClick={() => {
            setEditingPeriod(null);
            setFormData({ name: '', start_date: '', end_date: '', is_active: false });
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
        >
          <Plus className="w-5 h-5" />
          Nuevo Periodo
        </button>
      </div>

      <div className="grid gap-4">
        {periods.map((period) => (
          <div key={period.id} className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">{period.name}</h3>
                  {period.is_active ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                      <CheckCircle className="w-3 h-3" />
                      Activo
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                      <XCircle className="w-3 h-3" />
                      Inactivo
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600">
                  {new Date(period.start_date).toLocaleDateString()} - {new Date(period.end_date).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleActive(period)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                    period.is_active
                      ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      : 'bg-green-100 hover:bg-green-200 text-green-700'
                  }`}
                >
                  {period.is_active ? 'Desactivar' : 'Activar'}
                </button>
                <button
                  onClick={() => handleEdit(period)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                >
                  <Edit className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleDelete(period.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {periods.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p>No hay periodos registrados</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b">
              <h3 className="text-xl font-bold text-gray-900">
                {editingPeriod ? 'Editar Periodo' : 'Nuevo Periodo'}
              </h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre del Periodo
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ej: Enero-Junio 2025"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha de Inicio
                </label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha de Fin
                </label>
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                  Periodo Activo
                </label>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingPeriod(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                >
                  {editingPeriod ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
