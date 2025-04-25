import React, { useState, useEffect } from 'react';
import { ToneSetting } from '../App'; // Assuming App.js/.ts exists
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Check, X, Pencil, Trash2 } from 'lucide-react';

interface SettingsViewProps {
  // Props from App.tsx
  tone: ToneSetting;
  handleToneChange: (newTone: ToneSetting) => void;
  selectedFont: 'times' | 'helvetica';
  setSelectedFont: (font: 'times' | 'helvetica') => void;
  autoCopy: boolean;
  setAutoCopy: (enabled: boolean) => void;
  autoDownload: boolean;
  setAutoDownload: (enabled: boolean) => void;
  useAdditionalContext: boolean;
  setUseAdditionalContext: (enabled: boolean) => void;
  useCustomDefaultFilename: boolean;
  setUseCustomDefaultFilename: (enabled: boolean) => void;
  customDefaultFilename: string;
  setCustomDefaultFilename: (filename: string) => void; // To update App state
  handleClearDatabase: () => void;
  maxWords: number;
  handleSetMaxWords: (words: number) => void;
  pdfFontSize: number;
  handleSetPdfFontSize: (size: number) => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({
  tone,
  handleToneChange,
  selectedFont,
  setSelectedFont,
  autoCopy,
  setAutoCopy,
  autoDownload,
  setAutoDownload,
  useAdditionalContext,
  setUseAdditionalContext,
  useCustomDefaultFilename,
  setUseCustomDefaultFilename,
  customDefaultFilename,
  setCustomDefaultFilename, // Receive the setter
  handleClearDatabase,
  maxWords,
  handleSetMaxWords,
  pdfFontSize,
  handleSetPdfFontSize,
}) => {

  // State local to SettingsView for editing custom filename
  const [filenameInput, setFilenameInput] = useState<string>(customDefaultFilename);
  const [isEditingCustomFilename, setIsEditingCustomFilename] = useState<boolean>(false);

  // Local state for the max words input display value
  const [inputValue, setInputValue] = useState<string>(String(maxWords));
  // Local state for the font size input display value
  const [fontSizeInputValue, setFontSizeInputValue] = useState<string>(String(pdfFontSize));

  // Effect to sync local input value when the maxWords prop changes from parent
  useEffect(() => {
    setInputValue(String(maxWords));
  }, [maxWords]);

  // Effect to sync local font size input value when the pdfFontSize prop changes
  useEffect(() => {
    setFontSizeInputValue(String(pdfFontSize));
  }, [pdfFontSize]);

  // --- Handlers local to SettingsView for Custom Default Filename ---
  const handleSaveCustomFilename = () => {
    const finalName = filenameInput.trim();
    setCustomDefaultFilename(finalName); // Update App state via prop
    chrome.storage.local.set({ customDefaultFilename: finalName }, () => {
      console.log('Custom default filename saved:', finalName);
      setIsEditingCustomFilename(false);
    });
  };

  const handleCancelCustomFilenameEdit = () => {
    setFilenameInput(customDefaultFilename); // Reset input state to saved value from App
    setIsEditingCustomFilename(false);
  };

  const handleClearCustomFilename = () => {
     if (window.confirm('Are you sure you want to clear the custom default filename?')) {
        setCustomDefaultFilename(''); // Update App state via prop
        setFilenameInput(''); // Clear local input state
        setIsEditingCustomFilename(false); // Exit edit mode if active
        chrome.storage.local.remove('customDefaultFilename', () => {
           console.log('Custom default filename cleared.');
        });
     }
  };
  // ------------------------------------------

  // --- Handler for Clearing API Key (Local to SettingsView) ---
  const handleClearApiKey = () => {
    if (window.confirm('Are you sure you want to permanently remove your saved OpenAI API key?')) {
        chrome.storage.local.remove(['openaiApiKey'], () => {
          if (chrome.runtime.lastError) {
            console.error('Error clearing API key:', chrome.runtime.lastError);
            // Optionally show an error to the user
          } else {
            console.log('API key cleared successfully');
            // Optionally show a success message
          }
        });
      }
  };
  // ------------------------------------------


  return (
    // JSX from App.tsx will be pasted here
    <Card className="h-full gap-3">
        {/* Content will be moved here */}
        <CardHeader>
            <CardTitle className="text-2xl tracking-tight mb-0">Settings</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col justify-between h-full p-5 pt-0 mt-0">
            {/* Top settings: tone, auto-copy, auto-download */}
                      <div className="space-y-6">
                        {/* Tone Selection Setting */}
                        <div className="flex items-center space-x-4">
                          <Label htmlFor="tone-select" className="flex-shrink-0">
                            Generation Tone
                          </Label>
                          <div className="flex-grow">
                            <Select
                              value={tone}
                              onValueChange={(value: ToneSetting) => handleToneChange(value)}
                            >
                              <SelectTrigger id="tone-select" className="w-full">
                                <SelectValue placeholder="Select tone" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="professional">Professional</SelectItem>
                                <SelectItem value="friendly">Friendly</SelectItem>
                                <SelectItem value="casual">Casual</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        {/* PDF Font Selection Setting */}
                        <div className="flex items-center space-x-4">
                          <Label htmlFor="font-select" className="flex-shrink-0">
                            Font (PDFs)
                          </Label>
                          <div className="flex-grow">
                            <Select
                              value={selectedFont}
                              onValueChange={(value: 'times' | 'helvetica') => {
                                setSelectedFont(value);
                                // Storage logic handled in App.tsx wrapper
                              }}
                            >
                              <SelectTrigger id="font-select" className="w-full">
                                <SelectValue placeholder="Select font" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="times">Times New Roman</SelectItem>
                                <SelectItem value="helvetica">Helvetica</SelectItem> 
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        {/* Max Words Setting */}
                        <div className="flex items-center space-x-4">
                          <Label htmlFor="max-words-input" className="flex-shrink-0 flex-grow">
                            Word Count (Approx.)
                          </Label>
                          <div className="ml-auto">
                            <Input
                              id="max-words-input"
                              type="number"
                              value={inputValue}
                              min={1}
                              step={10}
                              onChange={(e) => {
                                const currentVal = e.target.value;
                                console.log('[onChange] Raw Value:', currentVal);
                                setInputValue(currentVal);

                                const numValue = parseInt(currentVal, 10);
                                console.log('[onChange] Parsed Value:', numValue);
                                if (!isNaN(numValue) && numValue >= 1) {
                                  console.log('[onChange] Condition PASSED, calling handleSetMaxWords');
                                  handleSetMaxWords(numValue);
                                } else {
                                  console.log('[onChange] Condition FAILED');
                                }
                              }}
                              onBlur={(e) => {
                                console.log('[onBlur] Input Value:', inputValue);
                                const finalNumValue = parseInt(inputValue, 10);
                                console.log('[onBlur] Parsed Value:', finalNumValue);
                                if (inputValue === '' || isNaN(finalNumValue) || finalNumValue < 1) {
                                  console.log('[onBlur] Condition PASSED, resetting to 270');
                                  handleSetMaxWords(270);
                                } else {
                                  console.log('[onBlur] Condition FAILED, value is valid');
                                }
                              }}
                              className="w-24"
                            />
                          </div>
                        </div>
                        {/* Font Size Setting */}
                        <div className="flex items-center space-x-4">
                          <Label htmlFor="font-size-input" className="flex-shrink-0 flex-grow">
                            PDF Font Size (pt)
                          </Label>
                          <div className="ml-auto">
                            <Input
                              id="font-size-input"
                              type="number"
                              value={fontSizeInputValue}
                              min={1}
                              step={1}
                              onChange={(e) => {
                                // Only update the local display value on change
                                setFontSizeInputValue(e.target.value);
                              }}
                              onBlur={(e) => {
                                const finalNumValue = parseInt(fontSizeInputValue, 10);
                                // Validate on blur: check if empty, invalid, or below minimum
                                if (fontSizeInputValue === '' || isNaN(finalNumValue) || finalNumValue < 1) { 
                                  // If invalid, reset parent state AND local state to default (12)
                                  handleSetPdfFontSize(12); 
                                  setFontSizeInputValue('12'); // Directly set input value back
                                } else {
                                  // If valid, ensure parent state has the final valid number
                                  handleSetPdfFontSize(finalNumValue);
                                  // Optionally ensure local state matches exactly if parsing changed it (e.g., leading zeros)
                                  setFontSizeInputValue(String(finalNumValue)); 
                                }
                              }}
                              className="w-24 text-right"
                            />
                          </div>
                        </div>
                        {/* Auto-copy Setting */}
                        <div className="flex items-center space-x-4">
                          <Label htmlFor="auto-copy" className="flex-grow">
                            Auto-copy prompt to clipboard?
                          </Label>
                          <div className="ml-auto flex items-center space-x-2">
                            <Checkbox
                              id="auto-copy"
                              checked={autoCopy}
                              className="data-[state=checked]:bg-[#733E24] data-[state=checked]:border-[#733E24]"
                              onCheckedChange={(checked) => {
                                const isChecked = !!checked;
                                setAutoCopy(isChecked);
                                // Storage logic handled in App.tsx wrapper
                              }}
                            />
                          </div>
                        </div>
                        {/* Auto-download Setting */}
                        <div className="flex items-center space-x-4">
                          <Label htmlFor="auto-download" className="flex-grow">
                            Auto-download cover letter as PDF?
                          </Label>
                          <div className="ml-auto flex items-center space-x-2">
                            <Checkbox
                              id="auto-download"
                              checked={autoDownload}
                              className="data-[state=checked]:bg-[#733E24] data-[state=checked]:border-[#733E24]"
                              onCheckedChange={(checked) => {
                                const isChecked = !!checked;
                                setAutoDownload(isChecked);
                                // Storage logic handled in App.tsx wrapper
                              }}
                            />
                          </div>
                        </div>
                        {/* Use Additional Context Setting */}
                        <div className="flex items-center space-x-4">
                          <Label htmlFor="additional-context" className="flex-grow">
                            Use additional context for generation?
                          </Label>
                          <div className="ml-auto flex items-center space-x-2">
                            <Checkbox
                              id="additional-context"
                              checked={useAdditionalContext}
                              className="data-[state=checked]:bg-[#733E24] data-[state=checked]:border-[#733E24]"
                              onCheckedChange={(checked) => {
                                const isChecked = !!checked;
                                setUseAdditionalContext(isChecked);
                                // Storage logic handled in App.tsx wrapper
                              }}
                            />
                          </div>
                        </div>
                        {/* --- Custom Default Filename Setting (Moved into main block) --- */}
                      {/* Main Checkbox Row */}
                      <div className="flex items-center space-x-4">
                        <Label htmlFor="custom-default-filename-checkbox" className="flex-grow">
                          Use Custom Default Filename for PDF Downloads?
                        </Label>
                        <div className="ml-auto flex items-center space-x-2">
                            <Checkbox
                              id="custom-default-filename-checkbox"
                              checked={useCustomDefaultFilename}
                              className="data-[state=checked]:bg-[#733E24] data-[state=checked]:border-[#733E24]"
                              onCheckedChange={(checked) => {
                                const isChecked = !!checked;
                                setUseCustomDefaultFilename(isChecked);
                                // Storage logic handled in App.tsx wrapper
                              }}
                            />
                        </div>
                      </div>

                      {/* Conditional Input/Edit Section - Rendered below if checkbox is checked */}
                      {useCustomDefaultFilename && (
                        <div className="pl-7 mt-3 space-y-2"> {/* Add margin-top (mt-3) here */}
                          {customDefaultFilename && !isEditingCustomFilename ? (
                            <div className="flex items-center space-x-2">
                              <Input
                                readOnly
                                value={customDefaultFilename}
                                className="flex-grow h-8 text-sm bg-muted border-muted"
                              />
                              <TooltipProvider delayDuration={100}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" onClick={() => {
                                      setFilenameInput(customDefaultFilename); // Ensure input state matches before edit
                                      setIsEditingCustomFilename(true);
                                    }} className="h-8 w-8">
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent><p>Edit</p></TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={handleClearCustomFilename}>
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent><p>Clear</p></TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          ) : (
                            // Input/Edit Mode
                            <div className="flex items-center space-x-2">
                              <Input
                                id="custom-default-filename-input"
                                type="text"
                                placeholder="default: cover_letter[timestamp]"
                                value={filenameInput} // Use local filenameInput state
                                onChange={(e) => setFilenameInput(e.target.value)} // Update local filenameInput state
                                className="flex-grow h-8 text-sm bg-background"
                              />
                              {isEditingCustomFilename ? (
                                 <TooltipProvider delayDuration={100}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        {/* Disable save if input hasn't changed from original or is empty */}
                                        <Button onClick={handleSaveCustomFilename} size="icon" className="h-8 w-8 bg-[#245F73] text-primary-foreground" disabled={!filenameInput.trim() || filenameInput.trim() === customDefaultFilename}>
                                          <Check className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent><p>Save</p></TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" onClick={handleCancelCustomFilenameEdit} className="h-8 w-8">
                                          <X className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent><p>Cancel</p></TooltipContent>
                                    </Tooltip>
                                 </TooltipProvider>
                              ) : (
                                // Show save button only if there's text and it's not the edit mode
                                filenameInput.trim() && (
                                  <TooltipProvider delayDuration={100}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button onClick={handleSaveCustomFilename} size="icon" className="h-8 w-8 bg-[#245F73] text-primary-foreground">
                                          <Check className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent><p>Save</p></TooltipContent>
                                    </Tooltip>
                                   </TooltipProvider>
                                )
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      {/* --- End Custom Default Filename Setting --- */}

                      </div>

            {/* Bottom actions: clear data & API key */}
             <div className="space-y-6 pt-4 border-t">
                {/* Clear API Key Setting - Grouping button and text */}
                <div className="flex items-start space-x-4">
                  <Label className="pt-1.5 flex-shrink-0">
                    API Key
                  </Label>
                  <div className="flex flex-col items-end flex-grow">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleClearApiKey} // Use local handler
                    >
                      Clear Saved API Key
                    </Button>
                  </div>
                </div>
                {/* Clear Database Setting - Restructured */}
                <div className="flex items-start space-x-4">
                  <Label className="pt-1.5 flex-shrink-0">
                    Manage Files
                  </Label>
                  <div className="flex flex-col items-end flex-grow">
                    <Button variant="destructive" size="sm" onClick={handleClearDatabase}>
                      Delete All Documents
                    </Button>
                  </div>
                </div>
              </div>
        </CardContent>
    </Card>
  );
};

export default SettingsView; 