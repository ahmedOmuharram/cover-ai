import React, { useRef, ChangeEvent, useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils"; 
import { Pencil, Trash2, Check, X, PlusCircle, FileText, FileArchive } from 'lucide-react';

interface Document {
  id: number;
  name: string;
}

interface DocumentListProps {
  resumes: Document[];
  letters: Document[];
  onFileUpload: (file: File, type: 'resume' | 'letter') => void;
  onDelete: (id: number, type: 'resume' | 'letter') => Promise<void>;
  onRename: (id: number, newName: string, type: 'resume' | 'letter') => Promise<void>;
}

const DocumentList: React.FC<DocumentListProps> = ({ 
  resumes, 
  letters, 
  onFileUpload,
  onDelete,
  onRename 
}) => {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingType, setEditingType] = useState<'resume' | 'letter' | null>(null);
  const [newName, setNewName] = useState('');
  const coverLetterInputRef = useRef<HTMLInputElement>(null);
  const resumeInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>, type: 'resume' | 'letter') => {
    const file = event.target.files?.[0];
    if (file) {
      onFileUpload(file, type);
    }
    if (event.target) event.target.value = '';
  };

  const handleUploadClick = (inputRef: React.RefObject<HTMLInputElement>) => {
    inputRef.current?.click();
  };

  const handleRenameClick = (id: number, currentName: string, type: 'resume' | 'letter') => {
    setEditingId(id);
    setEditingType(type);
    setNewName(currentName);
  };

  const handleRenameSubmit = async (id: number, type: 'resume' | 'letter') => {
    if (!newName.trim()) return; // Prevent empty names
    try {
      await onRename(id, newName.trim(), type);
      setEditingId(null);
      setEditingType(null);
    } catch (error) {
      console.error('Error renaming document:', error);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingType(null);
    setNewName('');
  }

  // Render function for a single document item
  const renderDocument = (doc: Document, type: 'resume' | 'letter') => {
    const isEditing = editingId === doc.id && editingType === type;
    const Icon = type === 'letter' ? FileText : FileArchive; // Choose icon based on type

    return (
      <div 
        key={doc.id} 
        className="flex items-center justify-between space-x-4 p-2 rounded-md hover:bg-accent/50"
      >
        <div className="flex items-center space-x-3 flex-grow min-w-0"> {/* Allow text to truncate */} 
          <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          {isEditing ? (
            <div className="flex items-center space-x-2 flex-grow min-w-0">
              <Input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRenameSubmit(doc.id, type)}
                className="h-8 flex-grow min-w-0" // Allow input to shrink
                autoFocus
              />
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-green-600 hover:text-green-700"
                      onClick={() => handleRenameSubmit(doc.id, type)}
                      disabled={!newName.trim()}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Save</p></TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={handleCancelEdit}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Cancel</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          ) : (
            <span className="text-sm font-medium truncate flex-grow min-w-0">{doc.name}</span>
          )}
        </div>
        {!isEditing && (
          <div className="flex items-center space-x-1 flex-shrink-0">
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleRenameClick(doc.id, doc.name, type)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Rename</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => onDelete(doc.id, type)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Delete</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </div>
    );
  };

  // Helper to render a section (Letters or Resumes)
  const renderSection = (title: string, documents: Document[], type: 'resume' | 'letter', inputRef: React.RefObject<HTMLInputElement>) => (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Hidden file input */}
        <input 
          type="file" 
          ref={inputRef} 
          onChange={(e) => handleFileChange(e, type)} 
          style={{ display: 'none' }} 
          accept=".pdf,.doc,.docx,.txt"
        />
        
        {documents.length === 0 ? (
          <p className="text-sm text-muted-foreground italic px-2 py-4 text-center">No {type === 'letter' ? 'letters' : 'resumes'} uploaded yet.</p>
        ) : (
          <div className="space-y-1">
            {documents.map(doc => renderDocument(doc, type))}
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button 
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => handleUploadClick(inputRef)}
        >
          <PlusCircle className="mr-2 h-4 w-4" /> 
          Upload New {type === 'letter' ? 'Cover Letter' : 'Resume'}
        </Button>
      </CardFooter>
    </Card>
  );

  return (
    // Use grid for overall layout
    <div className="document-list grid grid-cols-1 md:grid-cols-2 gap-6">
      {renderSection("Cover Letters", letters, 'letter', coverLetterInputRef)}
      {renderSection("Resumes", resumes, 'resume', resumeInputRef)}
    </div>
  );
};

export default DocumentList;