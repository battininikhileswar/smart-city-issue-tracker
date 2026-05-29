import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './store/authStore';
import useThemeStore from './store/themeStore';
import ChatbotWidget from './components/ChatbotWidget';
import VoiceAssistantWidget from './components/VoiceAssistantWidget';

// Pages
import LandingPage from './pages/LandingPage';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import CitizenDashboard from './pages/citizen/Dashboard';
import SubmitComplaint from './pages/citizen/SubmitComplaint';
import TrackComplaint from './pages/citizen/TrackComplaint';
import ComplaintDetail from './pages/citizen/ComplaintDetail';
import ProfileSettings from './pages/citizen/ProfileSettings';
import PSDashboard from './pages/authority/PSDashboard';
import ACBDashboard from './pages/authority/ACBDashboard';
import MunicipalDashboard from './pages/authority/MunicipalDashboard';
import AdminPanel from './pages/admin/AdminPanel';
import CreateAuthority from './pages/admin/CreateAuthority';
import EscalationsPage from './pages/admin/EscalationsPage';
import NotFound from './pages/NotFound';

const ProtectedRoute = ({ children, roles }) => {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user?.role)) return <Navigate to="/unauthorized" replace />;
  return children;
};

const PublicRoute = ({ children }) => {
  const { isAuthenticated, user } = useAuthStore();
  if (isAuthenticated) {
    const redirectMap = {
      citizen: '/dashboard',
      ps_officer: '/ps-dashboard',
      acb_officer: '/acb-dashboard',
      municipal_officer: '/municipal-dashboard',
      super_admin: '/admin',
    };
    return <Navigate to={redirectMap[user?.role] || '/dashboard'} replace />;
  }
  return children;
};

const Unauthorized = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
    <div className="text-center">
      <div className="text-6xl font-bold text-red-200 dark:text-red-900 font-display mb-2">403</div>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Access Denied</h1>
      <p className="text-slate-500 dark:text-slate-400">You don't have permission to access this page.</p>
    </div>
  </div>
);

export default function App() {
  const { initializeAuth } = useAuthStore();
  const { initTheme } = useThemeStore();

  useEffect(() => {
    initializeAuth();
    initTheme();
  }, []);

  return (
    <>
      <Routes>
        {/* Public */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/track" element={<TrackComplaint />} />
        <Route path="/track/:complaintId" element={<TrackComplaint />} />

        {/* Auth */}
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

        {/* Citizen */}
        <Route path="/dashboard" element={<ProtectedRoute roles={['citizen']}><CitizenDashboard /></ProtectedRoute>} />
        <Route path="/submit-complaint" element={<ProtectedRoute roles={['citizen']}><SubmitComplaint /></ProtectedRoute>} />
        <Route path="/complaints/:id" element={<ProtectedRoute roles={['citizen']}><ComplaintDetail /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfileSettings /></ProtectedRoute>} />

        {/* Authorities */}
        <Route path="/ps-dashboard" element={<ProtectedRoute roles={['ps_officer', 'super_admin']}><PSDashboard /></ProtectedRoute>} />
        <Route path="/acb-dashboard" element={<ProtectedRoute roles={['acb_officer', 'super_admin']}><ACBDashboard /></ProtectedRoute>} />
        <Route path="/municipal-dashboard" element={<ProtectedRoute roles={['municipal_officer', 'super_admin']}><MunicipalDashboard /></ProtectedRoute>} />

        {/* Admin */}
        <Route path="/admin/*" element={<ProtectedRoute roles={['super_admin']}><AdminPanel /></ProtectedRoute>} />
        <Route path="/admin/create-authority" element={<ProtectedRoute roles={['super_admin']}><CreateAuthority /></ProtectedRoute>} />
        <Route path="/admin/escalations" element={<ProtectedRoute roles={['super_admin']}><EscalationsPage /></ProtectedRoute>} />

        {/* Misc */}
        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <ChatbotWidget />
      <VoiceAssistantWidget />
    </>
  );
}
