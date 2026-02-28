import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AppLayout() {
  const { signOut, membershipTier, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const navClass = ({ isActive }) =>
    `rounded-full px-3 py-2 text-xs transition sm:px-4 sm:text-sm ${isActive ? "text-white shadow" : "text-white/80 hover:bg-white/5"}`;

  return (
    <div className="min-h-screen text-white">
      <header
        className="sticky top-0 z-20 border-b border-white/10 backdrop-blur"
        style={{ backgroundColor: "color-mix(in srgb, var(--app-panel) 78%, black)" }}
      >
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-3 py-3 sm:px-4 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-base font-bold text-white sm:text-lg">
            Study<span style={{ color: "var(--app-accent)" }}>Tok</span>
          </p>
          <nav className="no-scrollbar flex items-center gap-1 overflow-x-auto whitespace-nowrap sm:gap-2">
            <NavLink to="/" end className={navClass}>
              Home
            </NavLink>
            {membershipTier === "free" ? (
              <NavLink to="/apply-semi-premium" className={navClass}>
                Apply Semi Premium
              </NavLink>
            ) : null}
            <NavLink to="/upload" className={navClass}>
              Upload
            </NavLink>
            <NavLink to="/ai-mode" className={navClass}>
              AI Mode
            </NavLink>
            <NavLink to="/profile" className={navClass}>
              Profile
            </NavLink>
            {isAdmin ? (
              <NavLink to="/admin" className={navClass}>
                Admin
              </NavLink>
            ) : null}
            <NavLink to="/settings" className={navClass}>
              Settings
            </NavLink>
            <button
              onClick={handleLogout}
              className="rounded-full px-4 py-2 text-sm text-rose-300 transition hover:bg-white/5"
            >
              Logout
            </button>
          </nav>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
