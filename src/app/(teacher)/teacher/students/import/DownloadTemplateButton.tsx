"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DownloadTemplateButtonProps {
  organizationSlug: string;
}

export function DownloadTemplateButton({ organizationSlug }: DownloadTemplateButtonProps) {
  const handleDownload = () => {
    // CSV headers matching the format requirements in the import page
    const headers = "student_login,first_name,last_name,class_code,organization_slug,pin";
    
    // Example row with placeholder data
    const exampleRow = `ST-100001,John,Doe,ABC123,${organizationSlug},1234`;
    
    // Create CSV content
    const csvContent = `${headers}\n${exampleRow}`;
    
    // Create Blob and download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = url;
    link.download = "student-import-template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  };

  return (
    <Button variant="ghost" size="sm" className="-ml-2" onClick={handleDownload}>
      <Download className="mr-2 h-4 w-4" />
      Download Template
    </Button>
  );
}
