import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTenantContext } from '@/hooks/useTenantContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Loader2 } from 'lucide-react';

export default function Analytics() {
  const { tenantId } = useTenantContext();

  const { data: analyticsData, isLoading } = useQuery({
    queryKey: ['analytics', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const results = await base44.entities.Result.filter({ tenant_id: tenantId }, 'created_date');
      
      // Group by month
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const grouped = {};
      
      results.forEach(r => {
        if (!r.created_date) return;
        const date = new Date(r.created_date);
        const monthStr = months[date.getMonth()];
        if (!grouped[monthStr]) grouped[monthStr] = { count: 0, totalScore: 0 };
        grouped[monthStr].count += 1;
        grouped[monthStr].totalScore += (r.score || 0);
      });
      
      const formatted = Object.keys(grouped).map(key => ({
        name: key,
        score: Math.round(grouped[key].totalScore / grouped[key].count)
      }));
      
      return formatted.length > 0 ? formatted : [
        { name: 'No Data', score: 0 }
      ];
    },
    enabled: !!tenantId,
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Analytics</h1>
        <p className="text-muted-foreground mt-1">Performance insights and statistics.</p>
      </div>

      <Card className="col-span-4 shadow-sm">
        <CardHeader>
          <CardTitle>Average Scores over Time</CardTitle>
        </CardHeader>
        <CardContent className="pl-2">
          <div className="h-[350px] w-full">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analyticsData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}%`} />
                <Tooltip cursor={{fill: 'var(--muted)'}} />
                <Bar dataKey="score" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}