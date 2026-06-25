import { Outlet, Link, useLocation } from 'react-router-dom';
import { LogOut, Award, User, HelpCircle, BookOpen } from 'lucide-react';
import { base44 } from "@/api/base44Client";
import { useQuery } from '@tanstack/react-query';

export default function CandidateLayout() {
  const location = useLocation();
  const { data: user } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });
  
  const { data: tenant } = useQuery({
    queryKey: ['tenant', user?.tenant_id],
    queryFn: () => base44.entities.Tenant.get(user.tenant_id),
    enabled: !!user?.tenant_id
  });

  const handleLogout = async () => {
    await base44.auth.logout();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row font-sans">
      <aside className="w-full md:w-64 bg-slate-900 border-r border-slate-800 flex flex-col md:min-h-screen">
        <div className="p-6 border-b border-slate-800">
          {tenant?.logo_url ? (
            <img src={tenant.logo_url} alt="Tenant Logo" className="h-10 object-contain" />
          ) : (
            <div className="flex items-center gap-2 text-white">
                <Award className="w-6 h-6 text-blue-500" />
                <h1 className="text-xl font-bold">Student Portal</h1>
            </div>
          )}
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <Link to="/dashboard" className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${location.pathname === '/dashboard' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
            <BookOpen className="w-5 h-5" />
            Dashboard
          </Link>
          <Link to="/profile" className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${location.pathname === '/profile' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
            <User className="w-5 h-5" />
            Profile
          </Link>
          <Link to="/support" className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${location.pathname === '/support' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
            <HelpCircle className="w-5 h-5" />
            Help / Support
          </Link>
        </nav>
        <div className="p-4 border-t border-slate-800">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 w-full rounded-md transition-colors text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </aside>
      <main className="flex-1 p-6 md:p-10 w-full overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}