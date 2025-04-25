import React from 'react';
import { HistoryEntry } from '../utils/indexedDB'; // Import type from DB utils
import { jsPDF } from 'jspdf'; // Import for PDF generation

// Shadcn UI Imports
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Lucide Icons
import { Download, Trash2 } from 'lucide-react';

// Define generatePDF function locally (or import if moved to shared utils)
const generatePDF = (text: string, font: 'times' | 'helvetica' = 'times', fontSize: number = 12) => {
  const doc = new jsPDF();
  doc.setFont(font, 'normal');
  doc.setFontSize(fontSize);
  const lineSpacingFactor = 0.45; // Use a standard factor here, or pass it as well if needed
  const lineHeight = fontSize * lineSpacingFactor;

  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const maxLineWidth = pageWidth - margin * 2;
  const lines = doc.splitTextToSize(text, maxLineWidth);

  let y = margin;

  lines.forEach((line: string) => {
    if (y + lineHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, margin, y);
    y += lineHeight;
  });

  return doc;
};

interface HistoryViewProps {
  entries: HistoryEntry[];
  onClearHistory: () => void;
  onDeleteEntry: (id: number) => void;
  pdfFontSize: number; // Add font size prop
}

const HistoryView: React.FC<HistoryViewProps> = ({ 
  entries, 
  onClearHistory, 
  onDeleteEntry, 
  pdfFontSize // Destructure font size
}) => {

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  };

  const handleDownload = (entry: HistoryEntry) => {
    const doc = generatePDF(entry.pdfContent, entry.font, pdfFontSize);
    // Create a filename based on the timestamp
    const timestampStr = new Date(entry.timestamp).toISOString().replace(/[:.]/g, '-');
    doc.save(`cover_letter_history_${timestampStr}.pdf`);
  };

  return (
    <div className="history-view h-full flex flex-col">
      <Card className="flex-grow flex flex-col">
        <CardHeader>
          <CardTitle className="text-xl tracking-tight">Generation History</CardTitle>
        </CardHeader>
        <CardContent className="flex-grow flex flex-col p-4 pt-0">
          {entries.length === 0 ? (
            <div className="flex-grow flex items-center justify-center text-muted-foreground">
              Generate a PDF cover letter to start tracking history
            </div>
          ) : (
            <div className="flex-grow space-y-3 overflow-y-auto pr-1"> {/* Added overflow-y-auto and basic padding */} 
              {entries.map((entry) => (
                <div key={entry.id} className="history-item flex items-center justify-between p-3 border rounded-md bg-card hover:bg-muted/50 transition-colors">
                  <div className="flex-grow min-w-0 mr-4"> {/* Allow text to shrink */} 
                    <p className="text-sm font-medium truncate" title={entry.filename}>{entry.filename}</p>
                    <p className="text-xs text-muted-foreground">{formatTimestamp(entry.timestamp)}</p>
                  </div>
                  <TooltipProvider delayDuration={100}> 
                    <Tooltip>
                      <TooltipTrigger asChild>
                         <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 flex-shrink-0" 
                            onClick={() => handleDownload(entry)} 
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left"><p>Download PDF</p></TooltipContent>
                    </Tooltip>
                    
                    <Tooltip>
                       <TooltipTrigger asChild>
                         <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 flex-shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10" 
                            onClick={() => {
                              if (window.confirm('Are you sure you want to delete this history entry?')) {
                                onDeleteEntry(entry.id);
                              }
                            }} 
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left"><p>Delete Entry</p></TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Clear History Button (only shown if entries exist) */} 
      {entries.length > 0 && (
        <div className="mt-4 flex justify-end flex-shrink-0">
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={onClearHistory}
            className="w-full mb-4"
          >
            <Trash2 className="mr-2 h-4 w-4" /> Clear History
          </Button>
        </div>
      )}
    </div>
  );
};

export default HistoryView; 