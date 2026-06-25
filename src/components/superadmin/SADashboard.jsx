import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Building, Users, ShieldCheck, Activity, Globe } from 'lucide-react';
import { Progress } from "@/components/ui/progress";
import { Button } from '@/components/ui/button';

export default function SADashboard({ onManageClick }) {
  const { data: institutions, isLoading: isLoadingInst } = useQuery({
    queryKey: ['sa_institutions'],
    queryFn: () => base44.entities.Institution.list(),
  });

  const { data: tenantUsers, isLoading: isLoadingUsers } = useQuery({
    queryKey: ['sa_tenant_users'],
    queryFn: () => base44.entities.TenantUser.list(),
  });

  if (isLoadingInst || isLoadingUsers) {
    return <div className="p-8 text-center text-slate-500">Loading dashboard...</div>;
  }

  const activeInstitutions = institutions?.filter(i => i.status === 'Active' || i.is_active) || [];
  const suspendedInstitutions = institutions?.filter(i => i.status === 'Suspended') || [];
  const pendingInstitutions = institutions?.filter(i => i.status === 'Pending') || [];
  
  const totalStaff = tenantUsers?.length || 0;
  // Mock student data since we don't have global Student listing easily aggregatable here yet without complex queries
  const totalStudents = 37800;

  const getPlanCount = (plan) => institutions?.filter(i => i.plan === plan).length || 0;
  const enterpriseCount = getPlanCount('Enterprise');
  const professionalCount = getPlanCount('Professional');
  const starterCount = getPlanCount('Starter');

  const recentActivity = [
    { title: "New institution registered", desc: "Cape Town College of Arts", time: "2 hours ago", color: "bg-blue-500" },
    { title: "Tenant Admin changed", desc: "Lagos State University - new admin assigned", time: "5 hours ago", color: "bg-orange-500" },
    { title: "Institution suspended", desc: "Dakar Business School - payment overdue", time: "1 day ago", color: "bg-red-500" },
    { title: "Plan upgraded", desc: "Nairobi Technical Institute → Professional", time: "2 days ago", color: "bg-green-500" },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Super Admin Dashboard</h1>
        <p className="text-sm text-slate-500">Platform-wide overview of all registered institutions</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-6 relative">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 mb-4">
              <Building className="w-5 h-5" />
            </div>
            <div className="absolute top-6 right-6 text-green-500"><Activity className="w-4 h-4" /></div>
            <div className="text-3xl font-bold text-slate-800">{institutions?.length || 0}</div>
            <div className="text-sm font-medium text-slate-700">Total Institutions</div>
            <div className="text-xs text-slate-500 mt-1">{activeInstitutions.length} active</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-6 relative">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center text-green-600 mb-4">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="absolute top-6 right-6 text-green-500"><Activity className="w-4 h-4" /></div>
            <div className="text-3xl font-bold text-slate-800">{activeInstitutions.length}</div>
            <div className="text-sm font-medium text-slate-700">Active Tenants</div>
            <div className="text-xs text-slate-500 mt-1">{suspendedInstitutions.length} suspended</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-6 relative">
            <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600 mb-4">
              <Users className="w-5 h-5" />
            </div>
            <div className="absolute top-6 right-6 text-green-500"><Activity className="w-4 h-4" /></div>
            <div className="text-3xl font-bold text-slate-800">37.8k</div>
            <div className="text-sm font-medium text-slate-700">Total Students</div>
            <div className="text-xs text-slate-500 mt-1">across all institutions</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-6 relative">
            <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600 mb-4">
              <Users className="w-5 h-5" />
            </div>
            <div className="absolute top-6 right-6 text-green-500"><Activity className="w-4 h-4" /></div>
            <div className="text-3xl font-bold text-slate-800">{totalStaff}</div>
            <div className="text-sm font-medium text-slate-700">Total Staff</div>
            <div className="text-xs text-slate-500 mt-1">tenant admins & staff</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold text-slate-800 mb-6">Institution Status</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1.5"><span className="text-slate-600">Active</span><span className="font-medium">{activeInstitutions.length}</span></div>
                <Progress value={(activeInstitutions.length / institutions.length) * 100} className="h-2 bg-slate-100" indicatorColor="bg-green-500" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1.5"><span className="text-slate-600">Pending</span><span className="font-medium">{pendingInstitutions.length}</span></div>
                <Progress value={(pendingInstitutions.length / institutions.length) * 100} className="h-2 bg-slate-100" indicatorColor="bg-orange-400" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1.5"><span className="text-slate-600">Suspended</span><span className="font-medium">{suspendedInstitutions.length}</span></div>
                <Progress value={(suspendedInstitutions.length / institutions.length) * 100} className="h-2 bg-slate-100" indicatorColor="bg-red-500" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1.5"><span className="text-slate-600">Inactive</span><span className="font-medium">0</span></div>
                <Progress value={0} className="h-2 bg-slate-100" indicatorColor="bg-slate-400" />
              </div>
            </div>
            <div className="mt-6 pt-4 border-t flex justify-between text-xs font-medium text-slate-500">
              <span>Pending approvals</span>
              <span className="text-orange-500">{pendingInstitutions.length} awaiting</span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold text-slate-800 mb-6">Plan Distribution</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-24 text-sm text-slate-600">Enterprise</div>
                <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-purple-500 rounded-full" style={{width: `${(enterpriseCount/institutions.length)*100}%`}}></div></div>
                <div className="text-xs text-slate-500 w-16 text-right">{enterpriseCount} institutions</div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-24 text-sm text-slate-600">Professional</div>
                <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-blue-500 rounded-full" style={{width: `${(professionalCount/institutions.length)*100}%`}}></div></div>
                <div className="text-xs text-slate-500 w-16 text-right">{professionalCount} institutions</div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-24 text-sm text-slate-600">Starter</div>
                <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-slate-400 rounded-full" style={{width: `${(starterCount/institutions.length)*100}%`}}></div></div>
                <div className="text-xs text-slate-500 w-16 text-right">{starterCount} institution</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-8">
              <div className="bg-purple-50 rounded-lg p-3 text-center border border-purple-100">
                <div className="text-lg font-bold text-purple-700">{enterpriseCount}</div>
                <div className="text-[10px] uppercase font-semibold text-purple-500">Enterprise</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-100">
                <div className="text-lg font-bold text-blue-700">{professionalCount}</div>
                <div className="text-[10px] uppercase font-semibold text-blue-500">Professional</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 text-center border border-slate-200">
                <div className="text-lg font-bold text-slate-700">{starterCount}</div>
                <div className="text-[10px] uppercase font-semibold text-slate-500">Starter</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-sm font-semibold text-slate-800">Recent Activity</h3>
              <Activity className="w-4 h-4 text-slate-400" />
            </div>
            <div className="space-y-5 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
              {recentActivity.map((activity, idx) => (
                <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className={`flex items-center justify-center w-5 h-5 rounded-full border-2 border-white ${activity.color} shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm relative z-10`}></div>
                  <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.5rem)] pl-3 md:pl-0 md:group-odd:pr-3 md:group-even:pl-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-xs font-semibold text-slate-800">{activity.title}</div>
                      <div className="text-[10px] text-slate-500">{activity.time}</div>
                    </div>
                    <div className="text-[10px] text-slate-500">{activity.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-slate-200">
        <div className="p-6 flex justify-between items-end border-b">
          <div>
            <h3 className="text-base font-semibold text-slate-800">All Institutions</h3>
            <p className="text-xs text-slate-500 mt-1">{institutions.length} registered institutions</p>
          </div>
          <Button variant="ghost" className="text-blue-600 hover:text-blue-700" onClick={onManageClick}>
            View all & manage →
          </Button>
        </div>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider h-10">INSTITUTION</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider h-10">COUNTRY</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider h-10">TENANT ADMIN</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider h-10">PLAN</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider h-10 text-right">STUDENTS</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider h-10 text-center">STATUS</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider h-10">LAST ACTIVE</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider h-10 text-right">ACTION</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {institutions.slice(0, 3).map((inst) => {
                const admin = tenantUsers?.find(u => u.institution_id === inst.id && (u.role === 'tenant_admin' || u.role === 'admin'));
                return (
                  <TableRow key={inst.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs uppercase">
                          {inst.slug ? inst.slug.substring(0, 3) : inst.name.substring(0, 2)}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-800 text-sm">{inst.name}</div>
                          <div className="text-xs text-slate-500">{inst.slug || 'N/A'}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Globe className="w-3.5 h-3.5 text-slate-400" />
                        {inst.country || '—'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-slate-800">{admin ? 'Admin' : '—'}</div>
                      <div className="text-xs text-slate-500">{admin?.email || 'No admin assigned'}</div>
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        inst.plan === 'Enterprise' ? 'bg-purple-50 text-purple-600 border border-purple-100' :
                        inst.plan === 'Professional' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                        'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                        {inst.plan || 'Starter'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-sm text-slate-800">
                      {inst.student_volume ? inst.student_volume : '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        inst.status === 'Active' || inst.is_active ? 'text-green-600 bg-green-50' :
                        inst.status === 'Suspended' ? 'text-red-600 bg-red-50' : 'text-orange-600 bg-orange-50'
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${
                          inst.status === 'Active' || inst.is_active ? 'bg-green-500' :
                          inst.status === 'Suspended' ? 'bg-red-500' : 'bg-orange-500'
                        }`}></div>
                        {inst.status || (inst.is_active ? 'Active' : 'Inactive')}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">8h ago</TableCell>
                    <TableCell className="text-right">
                      <Button variant="link" className="text-blue-600 px-0 hover:no-underline hover:text-blue-800 h-auto" onClick={onManageClick}>
                        Manage
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}