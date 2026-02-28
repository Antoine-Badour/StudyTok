import { Navigate, Route, Routes } from "react-router-dom";
import AuthLayout from "./layouts/AuthLayout";
import AppLayout from "./layouts/AppLayout";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import VerifyTwoFAPage from "./pages/VerifyTwoFAPage";
import HomePage from "./pages/HomePage";
import UploadPage from "./pages/UploadPage";
import ProfilePage from "./pages/ProfilePage";
import SettingsPage from "./pages/SettingsPage";
import ApplySemiPremiumPage from "./pages/ApplySemiPremiumPage";
import AdminPanelPage from "./pages/AdminPanelPage";
import AdminLitePage from "./pages/AdminLitePage";
import AIModePage from "./pages/AIModePage";
import { useAuth } from "./context/AuthContext";

function ProtectedRoute({ children }) {
  const { user, loading, isTwoFactorVerified } = useAuth();

  if (loading) {
    return <div className="grid min-h-screen place-items-center">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isTwoFactorVerified) {
    return <Navigate to="/verify-2fa" replace />;
  }

  return children;
}

function PublicRoute({ children }) {
  const { user, isTwoFactorVerified } = useAuth();

  if (user && isTwoFactorVerified) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default function App() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          path="/signup"
          element={
            <PublicRoute>
              <SignupPage />
            </PublicRoute>
          }
        />
        <Route path="/verify-2fa" element={<VerifyTwoFAPage />} />
      </Route>

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<HomePage />} />
        <Route path="apply-semi-premium" element={<ApplySemiPremiumPage />} />
        <Route path="upload" element={<UploadPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="ai-mode" element={<AIModePage />} />
        <Route path="admin" element={<AdminPanelPage />} />
      </Route>

      <Route path="/admin-lite" element={<AdminLitePage />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
