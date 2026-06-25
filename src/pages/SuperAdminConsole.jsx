import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { LogOut, LayoutDashboard, Building2, Users, BookOpen, Settings, ShieldCheck } from 'lucide-react';
import SADashboard from '@/components/superadmin/SADashboard';
import SAManageTenants from '@/components/superadmin/SAManageTenants';
import SAApprovals from '@/components/superadmin/SAApprovals';

export default function SuperAdminConsole() {
  const { logout, user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  const menuItems = [
    { id: 'dashboard', label: 'SA Dashboard', icon: LayoutDashboard },
    { id: 'approvals', label: 'Pending Approvals', icon: ShieldCheck },
    { id: 'tenants', label: 'Manage Tenants', icon: Building2 },
    { id: 'users', label: 'System Users', icon: Users },
    { id: 'settings', label: 'Platform Settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Super Admin Sidebar */}
      <div className="w-64 bg-white border-r flex flex-col z-20 shadow-sm relative">
        <div className="h-16 flex items-center px-6 border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center text-white font-bold text-lg">U</div>
            <span className="text-xl font-bold text-slate-800">UniSIS</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-6">
          <div className="px-4 mb-6">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2 mb-2">Super Admin</div>
            <div className="space-y-1">
              {menuItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === item.id 
                      ? 'bg-blue-50 text-blue-700' 
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <item.icon className={`w-4 h-4 ${activeTab === item.id ? 'text-blue-600' : 'text-slate-400'}`} />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center text-sm font-bold uppercase">
                {user?.email?.[0] || 'A'}
              </div>
              <div className="overflow-hidden">
                <div className="text-sm font-bold text-slate-800 truncate">{user?.email?.split('@')[0] || 'Admin'}</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Super Admin</div>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={logout} className="text-slate-400 hover:text-red-600 rounded-full">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        <header className="h-16 bg-white border-b flex items-center px-6 sticky top-0 z-10">
          <div className="flex items-center text-sm text-slate-500">
            Super Admin <span className="mx-2">›</span> 
            <span className="text-slate-800 font-medium">
              {menuItems.find(m => m.id === activeTab)?.label}
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6 relative">
          {activeTab === 'dashboard' && <SADashboard onManageClick={() => setActiveTab('tenants')} />}
          {activeTab === 'approvals' && <SAApprovals />}
          {activeTab === 'tenants' && <SAManageTenants />}
          {activeTab !== 'dashboard' && activeTab !== 'tenants' && activeTab !== 'approvals' && (
            <div className="flex h-full items-center justify-center text-slate-500">
              <div className="text-center space-y-4">
                <BookOpen className="w-12 h-12 text-slate-300 mx-auto" />
                <div>{menuItems.find(m => m.id === activeTab)?.label} module is under development.</div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}