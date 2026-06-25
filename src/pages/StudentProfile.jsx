import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Mail } from 'lucide-react';

export default function StudentProfile() {
  const { data: user, isLoading } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });

  if (isLoading) return <div className="text-slate-400">Loading profile...</div>;

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">My Profile</h1>
        <p className="text-slate-400 mt-2">Manage your personal information.</p>
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white text-xl">Account Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4 text-slate-300 border-b border-slate-800 pb-4">
            <User className="w-5 h-5 text-blue-400" />
            <div>
              <p className="text-sm text-slate-500">Full Name</p>
              <p className="font-medium text-lg text-white">{user?.full_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-slate-300">
            <Mail className="w-5 h-5 text-blue-400" />
            <div>
              <p className="text-sm text-slate-500">Email Address</p>
              <p className="font-medium text-lg text-white">{user?.email}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}