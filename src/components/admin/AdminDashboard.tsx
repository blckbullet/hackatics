import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import {
  LogOut,
  Users,
  FileText,
  Calendar,
  BarChart3,
  ClipboardList,
} from "lucide-react";
import { PeriodsManager } from "./PeriodsManager";
import { StudentsManager } from "./StudentsManager";
import { ExpedientesManager } from "./ExpedientesManager";
import { FormatosManager } from "./FormatosManager";
import { ReportsSection } from "./ReportsSection";
import { NotificationBell } from "../shared/NotificationBell";

type Tab = "periods" | "students" | "expedientes" | "reports" | "formatos";

export function AdminDashboard() {
  const { profile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("periods");

  const tabs = [
    { id: "periods" as Tab, label: "Periodos", icon: Calendar },
    { id: "students" as Tab, label: "Solicitantes", icon: Users },
    { id: "expedientes" as Tab, label: "Expedientes", icon: FileText },
    { id: "reports" as Tab, label: "Reportes", icon: BarChart3 },
    { id: "formatos" as Tab, label: "Formatos", icon: ClipboardList },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Panel de Administración
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              {profile?.full_name} • Administrador
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-sm border mb-8">
          <div className="flex border-b">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 font-medium transition border-b-2 ${
                    activeTab === tab.id
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          {activeTab === "periods" && <PeriodsManager />}
          {activeTab === "students" && <StudentsManager />}
          {activeTab === "expedientes" && <ExpedientesManager />}
          {activeTab === "reports" && <ReportsSection />}
          {activeTab === "formatos" && <FormatosManager />}
        </div>
      </div>
    </div>
  );
}
