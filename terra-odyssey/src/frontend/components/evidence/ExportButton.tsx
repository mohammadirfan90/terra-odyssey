"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, FileArchive, FileJson, FileSpreadsheet } from "lucide-react";

interface ExportButtonProps {
  jobId: string;
}

export const ExportButton: React.FC<ExportButtonProps> = ({ jobId }) => {
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownload = (format: "zip" | "json" | "timeseries_csv") => {
    setDownloading(format);
    const url = `/api/investigations/${jobId}/export?format=${format}`;
    const link = document.createElement("a");
    link.href = url;
    link.download = "";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => setDownloading(null), 1000);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="default"
        size="sm"
        onClick={() => handleDownload("zip")}
        disabled={downloading !== null}
        className="gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-medium"
      >
        <FileArchive className="w-4 h-4" />
        {downloading === "zip" ? "Downloading..." : "Export Reproducibility Bundle (.zip)"}
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() => handleDownload("json")}
        disabled={downloading !== null}
        className="gap-1.5 border-slate-700 hover:bg-slate-800 text-slate-300"
      >
        <FileJson className="w-4 h-4 text-amber-400" />
        Investigation Record (.json)
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() => handleDownload("timeseries_csv")}
        disabled={downloading !== null}
        className="gap-1.5 border-slate-700 hover:bg-slate-800 text-slate-300"
      >
        <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
        Time Series (.csv)
      </Button>
    </div>
  );
};
