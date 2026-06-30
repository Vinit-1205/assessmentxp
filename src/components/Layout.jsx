import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import TenantAdminSidebar from './TenantAdminSidebar';
import { Menu, X } from 'lucide-react';

export default function Layout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col lg:flex-row relative">
      {/* Mobile Top Navigation */}
      <div className="lg:hidden flex items-center justify-between p-4 bg-sidebar text-sidebar-foreground border-b border-sidebar-border sticky top-0 z-30">
        <h1 className="text-xl font-bold tracking-tight text-white">AssessmentXP</h1>
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 text-white hover:bg-sidebar-accent/50 rounded-md focus:outline-none transition-colors"
        >
          {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar container */}
      <div 
        className={`fixed inset-y-0 left-0 z-40 transform ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 lg:static transition-transform duration-200 ease-in-out`}
      >
        <TenantAdminSidebar onClose={() => setIsSidebarOpen(false)} />
      </div>

      {/* Overlay for mobile sidebar */}
      {isSidebarOpen && (
        <div 
          onClick={() => setIsSidebarOpen(false)} 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden" 
        />
      )}

      {/* Main content */}
      <main className="flex-1 lg:ml-64 p-4 md:p-8 overflow-y-auto w-full min-h-[calc(100vh-60px)] lg:min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}