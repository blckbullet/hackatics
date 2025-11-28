import { useAuth, AuthProvider } from './contexts/AuthContext';
import { LoginForm } from './components/auth/LoginForm';
import { StudentDashboard } from './components/student/StudentDashboard';
import { ReviewerDashboard } from './components/reviewer/ReviewerDashboard';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { useState } from 'react';
import { RegisterForm } from './components/auth/RegisterForm';

function AppContent() {
  const { user, profile, loading } = useAuth();
  const [showRegister, setShowRegister] = useState(false);

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

  if (!user || !profile) {
    return showRegister ? <RegisterForm onToggleForm={() => setShowRegister(false)} /> : <LoginForm onToggleForm={() => setShowRegister(true)} />;
  }

  switch (profile.role) {
    case 'student':
      return <StudentDashboard />;
    case 'reviewer':
      return <ReviewerDashboard />;
    case 'admin':
      return <AdminDashboard />;
    default:
      return <LoginForm onToggleForm={() => setShowRegister(true)} />;
  }
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
