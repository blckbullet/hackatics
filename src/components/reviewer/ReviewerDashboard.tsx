import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import { Database } from "../../lib/database.types";
import { Search, Filter, FileText, LogOut, User } from "lucide-react";
import { ExpedienteCard } from "./ExpedienteCard";
import { ExpedienteDetailModal } from "./ExpedienteDetailModal";
import { NotificationBell } from "../shared/NotificationBell";

type Expediente = Database["public"]["Tables"]["expedientes"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Period = Database["public"]["Tables"]["periods"]["Row"];

interface ExpedienteWithDetails extends Expediente {
  profiles: Profile;
  periods: Period;
  documents: { count: number };
}

export function ReviewerDashboard() {
  const { profile, signOut } = useAuth();
  const [expedientes, setExpedientes] = useState<ExpedienteWithDetails[]>([]);
  const [filteredExpedientes, setFilteredExpedientes] = useState<
    ExpedienteWithDetails[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedExpediente, setSelectedExpediente] =
    useState<ExpedienteWithDetails | null>(null);

  useEffect(() => {
    loadExpedientes();
  }, []);

  useEffect(() => {
    filterExpedientes();
  }, [expedientes, searchTerm, statusFilter]);

  const loadExpedientes = async () => {
    try {
      const query = supabase.from("expedientes").select(`
          *,
          profiles!expedientes_student_id_fkey(*),
          periods(*)
        `);

      if (profile?.role === "reviewer") {
        query.eq("assigned_reviewer_id", profile.id);
      }

      const { data, error } = await query.order("created_at", {
        ascending: false,
      });

      if (error) throw error;

      const expedientesWithCounts = await Promise.all(
        (data || []).map(async (exp) => {
          const { count } = await supabase
            .from("documents")
            .select("*", { count: "exact", head: true })
            .eq("expediente_id", exp.id);

          return {
            ...exp,
            documents: { count: count || 0 },
          };
        })
      );

      setExpedientes(expedientesWithCounts as ExpedienteWithDetails[]);
    } catch (error) {
      console.error("Error loading expedientes:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterExpedientes = () => {
    let filtered = [...expedientes];

    if (searchTerm) {
      filtered = filtered.filter((exp) => {
        const student = exp.profiles;
        return (
          student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          student.matricula?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          student.carrera?.toLowerCase().includes(searchTerm.toLowerCase())
        );
      });
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((exp) => exp.status === statusFilter);
    }

    setFilteredExpedientes(filtered);
  };

  const handleExpedienteUpdate = () => {
    loadExpedientes();
    setSelectedExpediente(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Panel de Revisión
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              {profile?.full_name} • Revisor
            </p>
          </div>
          <div className="flex items-center gap-4">
            <NotificationBell />
            <button
              onClick={signOut}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
            >
              <LogOut className="w-5 h-5" />
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Buscar por nombre, matrícula o carrera..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Todos los estados</option>
                <option value="in_progress">En Progreso</option>
                <option value="completed">Completados</option>
                <option value="cancelled">Cancelados</option>
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-blue-100 p-2 rounded-lg">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Expedientes Asignados</p>
                <p className="text-2xl font-bold text-gray-900">
                  {expedientes.length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-green-100 p-2 rounded-lg">
                <User className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Solicitantes Activos</p>
                <p className="text-2xl font-bold text-gray-900">
                  {expedientes.filter((e) => e.status === "in_progress").length}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-4 text-sm text-gray-600">
          Mostrando {filteredExpedientes.length} de {expedientes.length}{" "}
          expedientes
        </div>

        {filteredExpedientes.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No se encontraron expedientes</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {filteredExpedientes.map((expediente) => (
              <ExpedienteCard
                key={expediente.id}
                expediente={expediente}
                onClick={() => setSelectedExpediente(expediente)}
              />
            ))}
          </div>
        )}
      </main>

      {selectedExpediente && (
        <ExpedienteDetailModal
          expediente={selectedExpediente}
          onClose={() => setSelectedExpediente(null)}
          onUpdate={handleExpedienteUpdate}
        />
      )}
    </div>
  );
}
