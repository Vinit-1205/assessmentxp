import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/apiClient';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Download, Search, Users } from 'lucide-react';

const PERSONA_STYLES = {
  'Super Admin': 'bg-purple-100 text-purple-700 border-purple-200',
  'Admin': 'bg-blue-100 text-blue-700 border-blue-200',
  'Tenant Admin': 'bg-green-100 text-green-700 border-green-200',
  'Tenant Executive': 'bg-amber-100 text-amber-700 border-amber-200',
  'Candidate': 'bg-slate-100 text-slate-700 border-slate-200',
  'Unassigned': 'bg-slate-50 text-slate-400 border-slate-200',
};

const PERSONA_ORDER = ['Super Admin', 'Admin', 'Tenant Admin', 'Tenant Executive', 'Candidate', 'Unassigned'];

function exportToCSV(rows) {
  const headers = ['Name', 'Email', 'Persona', 'Global Role', 'Institution', 'Tenant Roles', 'Joined'];
  const lines = rows.map((r) => [
    r.full_name,
    r.email,
    r.persona,
    r.global_role,
    r.institution_name,
    (r.tenant_roles || []).join(' | '),
    new Date(r.created_at || r.created_date).toLocaleDateString(),
  ].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));

  const csv = [headers.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `user-directory-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function UserDirectory() {
  const [search, setSearch] = useState('');
  const [personaFilter, setPersonaFilter] = useState('all');

  const { data, isLoading } = useQuery({
    queryKey: ['user_directory'],
    queryFn: async () => {
      const res = await apiClient.get('/user-directory');
      return res;
    },
  });

  const filtered = useMemo(() => {
    const list = data?.directory || [];
    return list.filter((u) => {
      const matchesSearch =
        !search ||
        u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase());
      const matchesPersona = personaFilter === 'all' || u.persona === personaFilter;
      return matchesSearch && matchesPersona;
    });
  }, [data, search, personaFilter]);

  if (isLoading) {
    return (
      <div className="p-12 text-center">
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
      </div>
    );
  }

  const summary = data?.summary || {};

  return (
    <div className="space-y-6">
      {/* Persona summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {PERSONA_ORDER.map((p) => (
          <Card key={p} className="border-slate-200">
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-slate-900">{summary[p] || 0}</p>
              <p className="text-xs text-slate-500 mt-1">{p}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex flex-1 gap-3 max-w-lg">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={personaFilter} onValueChange={setPersonaFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All Personas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Personas</SelectItem>
              {PERSONA_ORDER.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => exportToCSV(filtered)}>
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Persona</TableHead>
                <TableHead>Institution</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-slate-500">
                    <Users className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                    No users found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.full_name}</TableCell>
                    <TableCell className="text-slate-500">{u.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={PERSONA_STYLES[u.persona]}>
                        {u.persona}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-600">{u.institution_name}</TableCell>
                    <TableCell className="text-slate-500 text-sm">
                      {new Date(u.created_date).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}