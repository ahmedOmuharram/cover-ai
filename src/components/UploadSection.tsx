import React, { ChangeEvent, useRef } from 'react';
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { UploadCloud } from 'lucide-react';
import { cn } from "@/lib/utils";

interface UploadSectionProps {
  onFileUpload: (file: File) => void;
  title?: string; // Make title optional
  accept?: string; // Add optional accept prop
  fullscreen?: boolean; // Add fullscreen prop
}

const UploadSection: React.FC<UploadSectionProps> = ({ 
  onFileUpload, 
  title = "Upload a Cover Letter", // Updated default title
  accept = ".pdf", // Default accepted types
  fullscreen = false // Default fullscreen to false
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileUpload(file);
    }
    if (event.target) event.target.value = ''; // Reset input value
  };

  const handleAreaClick = () => {
    inputRef.current?.click();
  };

  return (
    <Card 
      className={cn(
        fullscreen && "flex flex-col h-full border-none shadow-none"
      )}
    >
      <CardContent 
        className={cn(
          "",
          fullscreen && "flex-grow flex flex-col items-center justify-center pb-10" 
        )}
      >
        <CardTitle className="text-lg text-center mb-4">{title}</CardTitle>
        <div
          onClick={handleAreaClick}
          className={cn(
            "flex flex-col items-center justify-center p-8 border-2 border-dashed border-muted rounded-lg cursor-pointer hover:border-primary/50 transition-colors",
            fullscreen && "w-full max-w-md"
          )}
        >
          <UploadCloud className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-primary">Click to upload</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">Supported formats: PDF</p> {/* Inform user about formats */}
        </div>
        <input 
          ref={inputRef}
          type="file" 
          onChange={handleFileChange} 
          accept={accept} // Use accept prop
          className="hidden" // Keep input hidden
        />
      </CardContent>
      {/* CardFooter could be added here if needed later */}
    </Card>
  );
};

export default UploadSection; 