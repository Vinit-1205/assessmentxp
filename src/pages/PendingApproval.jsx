import React from 'react';
import { ShieldAlert, Clock, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';

export default function PendingApproval() {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-amber-100 mb-4">
            <Clock className="h-6 w-6 text-amber-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Pending Approval</h2>
          <p className="text-slate-600 mb-6">
            Your workspace has been created and is currently pending administrator approval.
            You will be able to access the dashboard once it has been reviewed and approved.
          </p>
          <div className="bg-slate-50 rounded-lg p-4 mb-6 text-sm text-slate-500 border border-slate-100">
            If you have questions, please contact support or your system administrator.
          </div>
          <Button onClick={() => logout(true)} variant="outline" className="w-full">
            <LogOut className="w-4 h-4 mr-2" /> Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}