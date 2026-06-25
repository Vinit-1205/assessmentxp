import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTenantContext } from '@/hooks/useTenantContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from 'sonner';
import { Palette, UploadCloud, X, Loader2, ImageIcon } from 'lucide-react';

export default function CertificateBranding() {
  const queryClient = useQueryClient();
  const { user, tenantId } = useTenantContext();
  
  const { data: tenant, isLoading } = useQuery({
    queryKey: ['tenant', tenantId],
    queryFn: () => base44.entities.Tenant.get(tenantId),
    enabled: !!tenantId
  });

  const [formData, setFormData] = useState({
    logo_url: '',
    badge_url: '',
    signature_url: '',
    background_url: '',
    border_color: '#000000'
  });
  
  const [uploadingField, setUploadingField] = useState(null);

  useEffect(() => {
    if (tenant) {
      setFormData({
        logo_url: tenant.logo_url || '',
        badge_url: tenant.badge_url || '',
        signature_url: tenant.signature_url || '',
        background_url: tenant.background_url || '',
        border_color: tenant.border_color || '#000000'
      });
    }
  }, [tenant]);

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Tenant.update(tenant.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', user?.tenant_id] });
      toast.success('Certificate branding updated successfully');
    },
    onError: () => toast.error('Failed to update branding')
  });

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  const handleFileUpload = async (e, fieldName) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingField(fieldName);
    try {
      const res = await base44.integrations.Core.UploadFile({ file });
      setFormData(prev => ({ ...prev, [fieldName]: res.file_url }));
      toast.success('Image uploaded');
    } catch (err) {
      console.error(err);
      toast.error('Upload failed');
    } finally {
      setUploadingField(null);
      e.target.value = ''; // Reset input
    }
  };

  const removeImage = (fieldName) => {
    setFormData(prev => ({ ...prev, [fieldName]: '' }));
  };

  const ImageUploader = ({ label, description, fieldName }) => (
    <div className="space-y-3 p-4 border rounded-xl bg-slate-50/50">
      <div>
        <Label className="text-base font-semibold">{label}</Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      
      {formData[fieldName] ? (
        <div className="relative inline-block border rounded-lg overflow-hidden bg-white">
          <img 
            src={formData[fieldName]} 
            alt={label} 
            className="h-32 object-contain bg-slate-50 max-w-full"
          />
          <Button
            size="icon"
            variant="destructive"
            className="absolute top-1 right-1 h-6 w-6 rounded-full"
            onClick={() => removeImage(fieldName)}
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      ) : (
        <div className="relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg bg-white hover:bg-slate-50 transition-colors cursor-pointer">
          {uploadingField === fieldName ? (
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          ) : (
            <>
              <ImageIcon className="w-8 h-8 text-slate-300 mb-2" />
              <div className="text-sm font-medium text-primary">Click to upload</div>
              <div className="text-xs text-slate-500">PNG, JPG, or JPEG</div>
            </>
          )}
          <input
            type="file"
            accept="image/*"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={(e) => handleFileUpload(e, fieldName)}
            disabled={uploadingField === fieldName}
          />
        </div>
      )}
    </div>
  );

  if (isLoading) return <div className="p-8">Loading branding settings...</div>;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Palette className="w-8 h-8 text-primary" /> Certificate Branding
        </h1>
        <p className="text-muted-foreground mt-1">Manage the visual assets for your generated digital credentials.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8 items-start">
        <div className="space-y-6">
          <Card>
        <CardHeader>
          <CardTitle>Visual Assets</CardTitle>
          <CardDescription>Upload logos, signatures, and customize the certificate appearance.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <ImageUploader 
              label="Institutional Logo" 
              description="Placed at the top of the certificate."
              fieldName="logo_url"
            />
            
            <ImageUploader 
              label="Official Badge / Seal" 
              description="Secondary image (e.g., gold seal) placed on the certificate."
              fieldName="badge_url"
            />
            
            <ImageUploader 
              label="Authorized Signature" 
              description="Signature of the Dean/CEO (PNG with transparent background recommended)."
              fieldName="signature_url"
            />
            
            <ImageUploader 
              label="Custom Background" 
              description="Full-page background image (A4 landscape ratio recommended)."
              fieldName="background_url"
            />
          </div>

          <div className="pt-4 border-t">
            <Label className="text-base font-semibold">Border Color</Label>
            <p className="text-sm text-muted-foreground mb-3">Color used for the certificate frame.</p>
            <div className="flex items-center gap-3">
              <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 shadow-sm cursor-pointer border-slate-200">
                <input
                  type="color"
                  value={formData.border_color}
                  onChange={(e) => setFormData({ ...formData, border_color: e.target.value })}
                  className="absolute inset-[-10px] w-[200%] h-[200%] cursor-pointer"
                />
              </div>
              <Input
                type="text"
                value={formData.border_color}
                onChange={(e) => setFormData({ ...formData, border_color: e.target.value })}
                className="w-32 uppercase"
                maxLength={7}
              />
            </div>
          </div>

          <div className="flex justify-end pt-6">
            <Button 
              size="lg" 
              onClick={handleSave} 
              disabled={updateMutation.isPending}
              className="gap-2"
            >
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
              Save Branding
            </Button>
          </div>
        </CardContent>
      </Card>
        </div>

        <div className="sticky top-6">
          <Card>
            <CardHeader>
              <CardTitle>Live Preview</CardTitle>
              <CardDescription>Real-time preview mimicking the final PDF layout.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="w-full bg-slate-100 border border-slate-200 rounded-lg overflow-hidden shadow-inner flex items-center justify-center p-2">
                <svg viewBox="0 0 297 210" className="w-full h-auto bg-white shadow-sm" style={{ display: 'block' }}>
                  {formData.background_url && (
                    <image href={formData.background_url} x="0" y="0" width="297" height="210" preserveAspectRatio="none" />
                  )}
                  
                  <rect x="10" y="10" width="277" height="190" stroke={formData.border_color} strokeWidth="5" fill="none" />
                  <rect x="15" y="15" width="267" height="180" stroke={formData.border_color} strokeWidth="1" fill="none" />
                  
                  {formData.logo_url && (
                    <image href={formData.logo_url} x="118.5" y="20" width="60" height="20" preserveAspectRatio="xMidYMid meet" />
                  )}
                  
                  <text x="148.5" y="50" textAnchor="middle" fontSize="14.11" fontWeight="bold" fontFamily="helvetica, Arial, sans-serif" fill="#000000">Certificate of Completion</text>
                  <text x="148.5" y="75" textAnchor="middle" fontSize="7.05" fontFamily="helvetica, Arial, sans-serif" fill="#000000">This is to certify that</text>
                  <text x="148.5" y="95" textAnchor="middle" fontSize="10.58" fontStyle="italic" fontFamily="helvetica, Arial, sans-serif" fill="#000000">Jane Doe</text>
                  <text x="148.5" y="115" textAnchor="middle" fontSize="5.64" fontFamily="helvetica, Arial, sans-serif" fill="#000000">has successfully completed the exam:</text>
                  <text x="148.5" y="130" textAnchor="middle" fontSize="8.46" fontWeight="bold" fontFamily="helvetica, Arial, sans-serif" fill="#000000">Sample Certification Exam</text>
                  <text x="148.5" y="145" textAnchor="middle" fontSize="5.64" fontFamily="helvetica, Arial, sans-serif" fill="#000000">with an Academic Score of 92%</text>
                  
                  {formData.badge_url && (
                    <image href={formData.badge_url} x="30" y="150" width="40" height="40" preserveAspectRatio="xMidYMid meet" />
                  )}
                  
                  {formData.signature_url && (
                    <image href={formData.signature_url} x="200" y="150" width="60" height="25" preserveAspectRatio="xMidYMid meet" />
                  )}
                  
                  <text x="148.5" y="170" textAnchor="middle" fontSize="4.93" fontFamily="helvetica, Arial, sans-serif" fill="#000000">Awarded by: {tenant?.name || 'Organization'}</text>
                  <text x="148.5" y="180" textAnchor="middle" fontSize="4.93" fontFamily="helvetica, Arial, sans-serif" fill="#000000">Date: May 16, 2026</text>
                </svg>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}