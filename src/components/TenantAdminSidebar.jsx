import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { LayoutDashboard, PenTool, Send, Users, BarChart3, ShieldAlert, ShieldCheck, LogOut, BookOpen } from 'lucide-react';
import { cn } from "@/lib/utils";

export default function TenantAdminSidebar({ onClose }) {
  const location = useLocation();
  
  const { user, logout } = useAuth();
  
  // Hide Exam Builder from Proctors, etc. Filter based on active roles.
  const userRoles = user?.activeRoles?.map(r => r.role) || [];
  const isSuperAdmin = userRoles.includes('admin') || userRoles.includes('super_admin');
  const isTenantAdmin = userRoles.includes('tenant_admin') || isSuperAdmin;
  const isExaminer = userRoles.includes('examiner') || isTenantAdmin;

  const navItems = [
    { name: 'SA Console', path: '/super-admin', icon: ShieldAlert, show: isSuperAdmin },
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, show: true },
    { name: 'Exam Builder', path: '/exam-builder', icon: PenTool, show: isExaminer },
    { name: 'Exam Deployment', path: '/deploy-exam', icon: Send, show: isExaminer },
    { name: 'Candidate Management', path: '/candidates', icon: Users, show: true },
    { name: 'Question Bank', path: '/question-bank', icon: BookOpen, show: isExaminer },
    { name: 'Proctoring Review', path: '/proctoring-review', icon: ShieldCheck, show: true },
    { name: 'Reports', path: '/reports', icon: BarChart3, show: true },
    { name: 'Staff Management', path: '/staff', icon: Users, show: isTenantAdmin },
    { name: 'Certificate Branding', path: '/certificate-branding', icon: PenTool, show: isTenantAdmin },
  ].filter(item => item.show);

  const handleLogout = async () => {
    if (onClose) onClose();
    await logout();
  };

  return (
    <div className="w-64 bg-sidebar text-sidebar-foreground h-screen flex flex-col fixed left-0 top-0 border-r border-sidebar-border">
      <div className="p-6">
        <h1 className="text-2xl font-bold tracking-tight text-white">AssessmentXP</h1>
        <p className="text-sidebar-foreground/80 text-sm mt-1">Tenant Admin</p>
      </div>
      <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
                isActive 
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" 
                  : "hover:bg-sidebar-accent/50 text-sidebar-foreground/80 hover:text-sidebar-foreground"
              )}
            >
              <Icon className="w-5 h-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-sidebar-border shrink-0">
        <button 
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-md transition-colors hover:bg-sidebar-accent/50 text-sidebar-foreground/80 hover:text-sidebar-foreground"
        >
          <LogOut className="w-5 h-5" />
          Logout
        </button>
      </div>
    </div>
  );
}