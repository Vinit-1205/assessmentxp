import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, MessageCircle, FileQuestion } from 'lucide-react';
import { Button } from "@/components/ui/button";

export default function HelpSupport() {
  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Help & Support</h1>
        <p className="text-slate-400 mt-2">Find answers or get in touch with our support team.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <FileQuestion className="w-5 h-5 text-blue-400" /> FAQ
            </CardTitle>
          </CardHeader>
          <CardContent className="text-slate-300 space-y-4">
            <p>Browse our frequently asked questions for quick answers to common issues regarding exams, credentials, and technical requirements.</p>
            <Button variant="outline" className="w-full border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white">
              View FAQs
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Mail className="w-5 h-5 text-emerald-400" /> Contact Support
            </CardTitle>
          </CardHeader>
          <CardContent className="text-slate-300 space-y-4">
            <p>Need further assistance? Our support team is available to help you with any issues you may encounter.</p>
            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold">
              Email Support
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}