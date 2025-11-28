import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { Database } from "../../lib/database.types";
import { Search, Filter, UserPlus } from "lucide-react";
import { ExpedienteCard } from "../reviewer/ExpedienteCard";
import { ExpedienteDetailModal } from "../reviewer/ExpedienteDetailModal";

type Expediente = Database["public"]["Tables"]["expedientes"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Period = Database["public"]["Tables"]["periods"]["Row"];

interface ExpedienteWithDetails extends Expediente {
  profiles: Profile;
  periods: Period;
  documents: { count: number };
}

export function ExpedientesManager() {
  const [expedientes, setExpedientes] = useState<ExpedienteWithDetails[]>([]);
  const [filteredExpedientes, setFilteredExpedientes] = useState<
    ExpedienteWithDetails[]
  >([]);
  const [reviewers, setReviewers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [reviewerFilter, setReviewerFilter] = useState<string>("all");
  const [selectedExpediente, setSelectedExpediente] =
    useState<ExpedienteWithDetails | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningExpediente, setAssigningExpediente] =
    useState<ExpedienteWithDetails | null>(null);
  const [selectedReviewer, setSelectedReviewer] = useState("");
  const [bulkAssignLoading, setBulkAssignLoading] = useState(false);
  const [bulkAssignError, setBulkAssignError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [expResponse, reviewersResponse] = await Promise.all([
        supabase
          .from("expedientes")
          .select(
            `
            *,
            profiles!expedientes_student_id_fkey(*),
            periods(*)
          `
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("*")
          .eq("role", "reviewer")
          .order("full_name"),
      ]);

      if (expResponse.error) throw expResponse.error;
      if (reviewersResponse.error) throw reviewersResponse.error;

      const expedientesWithCounts = await Promise.all(
        (expResponse.data || []).map(async (exp) => {
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
      setReviewers(reviewersResponse.data);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    filterExpedientes();
  }, [expedientes, searchTerm, reviewerFilter]);

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

    if (reviewerFilter !== "all") {
      if (reviewerFilter === "unassigned") {
        filtered = filtered.filter((exp) => !exp.assigned_reviewer_id);
      } else {
        filtered = filtered.filter(
          (exp) => exp.assigned_reviewer_id === reviewerFilter
        );
      }
    }

    setFilteredExpedientes(filtered);
  };

  const handleAssign = (expediente: ExpedienteWithDetails) => {
    setAssigningExpediente(expediente);
    setSelectedReviewer(expediente.assigned_reviewer_id || "");
    setShowAssignModal(true);
  };

  const handleAssignSubmit = async () => {
    if (!assigningExpediente) return;

    try {
      const { error } = await supabase
        .from("expedientes")
        .update({
          assigned_reviewer_id: selectedReviewer || null,
        })
        .eq("id", assigningExpediente.id);

      if (error) throw error;

      if (selectedReviewer) {
        await supabase.from("notifications").insert({
          user_id: selectedReviewer,
          title: "Expediente asignado",
          message: `Se te ha asignado el expediente de ${assigningExpediente.profiles.full_name}`,
          type: "assignment",
        });
      }

      setShowAssignModal(false);
      setAssigningExpediente(null);
      loadData();
    } catch (error) {
      console.error("Error assigning expediente:", error);
      alert("Error al asignar expediente");
    }
  };

  const handleBulkAssign = async () => {
    if (bulkAssignLoading) return;

    if (
      !window.confirm(
        "¿Estás seguro de que quieres asignar todos los expedientes sin revisor a los revisores disponibles de forma equitativa?"
      )
    ) {
      return;
    }

    setBulkAssignLoading(true);
    setBulkAssignError(null);

    try {
      // 1. Fetch unassigned expedientes
      const { data: unassignedExpedientes, error: unassignedError } =
        await supabase
          .from("expedientes")
          .select(
            "id, student_id, profiles!expedientes_student_id_fkey(full_name)"
          )
          .is("assigned_reviewer_id", null);

      if (unassignedError) throw unassignedError;

      // 2. Fetch all reviewers
      const { data: allReviewers, error: reviewersError } = await supabase
        .from("profiles")
        .select("id, full_name") // Fetch full_name for notifications
        .eq("role", "reviewer");

      if (reviewersError) throw reviewersError;

      if (!allReviewers || allReviewers.length === 0) {
        alert("No hay revisores disponibles para asignar expedientes.");
        setBulkAssignLoading(false);
        return;
      }

      if (!unassignedExpedientes || unassignedExpedientes.length === 0) {
        alert("No hay expedientes sin asignar.");
        setBulkAssignLoading(false);
        return;
      }

      // 3. Implement round-robin distribution
      const assignments = [];
      const notifications = [];
      let reviewerIndex = 0;

      for (const exp of unassignedExpedientes) {
        const reviewer = allReviewers[reviewerIndex];
        assignments.push({
          id: exp.id,
          assigned_reviewer_id: reviewer.id,
        });

        notifications.push({
          user_id: reviewer.id,
          title: "Expediente asignado",
          message: `Se te ha asignado el expediente de ${exp.profiles.full_name}`,
          type: "assignment",
        });

        reviewerIndex = (reviewerIndex + 1) % allReviewers.length;
      }

      // 4. Actualizar asignaciones en paralelo (100% confiable)
      const updatePromises = assignments.map(({ id, assigned_reviewer_id }) =>
        supabase
          .from("expedientes")
          .update({ assigned_reviewer_id })
          .eq("id", id)
      );

      const results = await Promise.all(updatePromises);
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;

      // 5. Insert notifications
      const { error: notificationsError } = await supabase
        .from("notifications")
        .insert(notifications);
      if (notificationsError) throw notificationsError;

      alert(
        `Se asignaron ${unassignedExpedientes.length} expedientes a ${allReviewers.length} revisores.`
      );
      loadData(); // Reload all data to reflect new assignments
    } catch (error: any) {
      console.error("Error during bulk assignment:", error);
      setBulkAssignError(
        error.message || "Error al realizar la asignación masiva."
      );
      alert("Error al realizar la asignación masiva.");
    } finally {
      setBulkAssignLoading(false);
    }
  };

  const handleExpedienteUpdate = () => {
    loadData();
    setSelectedExpediente(null);
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
        <h2 className="text-2xl font-bold text-gray-900">
          Gestión de Expedientes
        </h2>
        <button
          onClick={handleBulkAssign}
          disabled={bulkAssignLoading}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition disabled:opacity-50"
        >
          {bulkAssignLoading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
          ) : (
            <UserPlus className="w-5 h-5" />
          )}
          Asignar Todos
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
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
              value={reviewerFilter}
              onChange={(e) => setReviewerFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos los revisores</option>
              <option value="unassigned">Sin asignar</option>
              {reviewers.map((reviewer) => (
                <option key={reviewer.id} value={reviewer.id}>
                  {reviewer.full_name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {bulkAssignError && (
          <div className="mt-4 text-red-600 text-sm">{bulkAssignError}</div>
        )}
      </div>

      <div className="mb-4 text-sm text-gray-600">
        Mostrando {filteredExpedientes.length} de {expedientes.length}{" "}
        expedientes
      </div>

      {filteredExpedientes.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <p className="text-gray-600">No se encontraron expedientes</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {filteredExpedientes.map((expediente) => (
            <div key={expediente.id} className="relative">
              <ExpedienteCard
                expediente={expediente}
                onClick={() => setSelectedExpediente(expediente)}
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleAssign(expediente);
                }}
                className="absolute bottom-4 right-4 flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition"
              >
                <UserPlus className="w-4 h-4" />
                {expediente.assigned_reviewer_id ? "Reasignar" : "Asignar"}
              </button>
            </div>
          ))}
        </div>
      )}

      {selectedExpediente && (
        <ExpedienteDetailModal
          expediente={selectedExpediente}
          onClose={() => setSelectedExpediente(null)}
          onUpdate={handleExpedienteUpdate}
        />
      )}

      {showAssignModal && assigningExpediente && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b">
              <h3 className="text-xl font-bold text-gray-900">
                Asignar Revisor
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Expediente de {assigningExpediente.profiles.full_name}
              </p>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Seleccionar Revisor
              </label>
              <select
                value={selectedReviewer}
                onChange={(e) => setSelectedReviewer(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-6"
              >
                <option value="">Sin asignar</option>
                {reviewers.map((reviewer) => (
                  <option key={reviewer.id} value={reviewer.id}>
                    {reviewer.full_name}
                  </option>
                ))}
              </select>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAssignSubmit}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                >
                  Asignar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
