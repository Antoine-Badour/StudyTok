import { Outlet } from "react-router-dom";

export default function AuthLayout() {
  return (
    <main className="grid min-h-screen place-items-center p-4">
      <div className="app-surface w-full max-w-md rounded-2xl p-6 shadow-[0_16px_45px_rgba(0,0,0,0.35)] backdrop-blur">
        <Outlet />
      </div>
    </main>
  );
}
