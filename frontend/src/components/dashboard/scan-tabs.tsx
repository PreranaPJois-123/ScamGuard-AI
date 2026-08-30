"use client";

import { useState, useRef } from "react";
import { FileText, Link as LinkIcon, Mail, Image as ImageIcon, File, QrCode, Camera } from "lucide-react";
import { FileUploadZone } from "./file-upload-zone";
import { CameraScanner } from "./camera-scanner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";

interface ScanTabsProps {
  onScan: (texts: string[], files: File[], inputType: string) => void;
  isScanning?: boolean;
}

const TABS = [
  { id: "text", label: "Text", icon: FileText, type: "text" },
  { id: "url", label: "URL", icon: LinkIcon, type: "url" },
  { id: "email", label: "Email", icon: Mail, type: "email" },
  { id: "image", label: "Image / OCR", icon: ImageIcon, type: "image" },
  { id: "camera", label: "Live Camera", icon: Camera, type: "camera" },
  { id: "pdf", label: "PDF", icon: File, type: "pdf" },
  { id: "qr", label: "QR Code", icon: QrCode, type: "qr" },
];

export function ScanTabs({ onScan, isScanning = false }: ScanTabsProps) {
  const [activeTab, setActiveTab] = useState("text");
  const [textValue, setTextValue] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const isFileTab = ["image", "pdf", "qr"].includes(activeTab);
  const isCameraTab = activeTab === "camera";

  const handleScan = () => {
    if (isScanning) return;
    if (isFileTab) {
      if (selectedFiles.length > 0) {
        onScan([], selectedFiles, activeTab);
      }
    } else if (!isCameraTab) {
      if (textValue.trim()) {
        onScan([textValue.trim()], [], activeTab);
      }
    }
  };

  useKeyboardShortcuts({
    "mod+enter": (e) => {
      e.preventDefault();
      handleScan();
    },
  });

  return (
    <div className="w-full bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="flex overflow-x-auto border-b border-border hide-scrollbar">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setTextValue("");
                setSelectedFiles([]);
              }}
              className={`flex items-center space-x-2 px-5 py-3.5 text-sm font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? "border-b-2 border-primary text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="p-6">
        {isCameraTab ? (
          <CameraScanner
            onCapture={(file) => onScan([], [file], "image")}
            isScanning={isScanning}
          />
        ) : isFileTab ? (
          <div className="space-y-4">
            <FileUploadZone
              onFilesSelected={setSelectedFiles}
              maxFiles={10}
              acceptedTypes={activeTab === "image" || activeTab === "qr" ? "image/*" : activeTab === "pdf" ? ".pdf" : "*/*"}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <Textarea
              ref={textAreaRef}
              placeholder={
                activeTab === "url"
                  ? "Enter website URL to analyze (e.g. https://secure-bank-login.xyz)..."
                  : activeTab === "email"
                  ? "Paste raw email body or header text..."
                  : "Paste suspicious SMS, WhatsApp message, or email body..."
              }
              className="min-h-[200px] resize-y text-base"
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
            />
          </div>
        )}

        {!isCameraTab && (
          <div className="mt-6 flex justify-end">
            <Button
              onClick={handleScan}
              disabled={isScanning || (isFileTab ? selectedFiles.length === 0 : !textValue.trim())}
              size="lg"
              className="w-full sm:w-auto"
            >
              {isScanning ? "Scanning..." : (
                <>
                  Scan Now <kbd className="ml-2 hidden sm:inline-block rounded bg-primary-foreground/20 px-1.5 py-0.5 text-[10px] font-mono font-medium">⌘↵</kbd>
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
