import { Outlet } from 'react-router-dom';
import TenantAdminSidebar from './TenantAdminSidebar';

export default function Layout() {
  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <TenantAdminSidebar />
      <main className="flex-1 ml-64 p-8 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}