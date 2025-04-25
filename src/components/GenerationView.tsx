import React, { useState, useEffect, useRef } from 'react';
import { ToneSetting } from '../App'; // Assuming App.js/.ts exists
import {
  getAllCoverLetters,
  getCoverLetterContent,
  getAllResumes,
  getResumeContent
} from '../utils/indexedDB'; // Assuming indexedDB.js/.ts exists
import OpenAI from 'openai';
import { jsPDF } from 'jspdf';

// Shadcn UI Imports
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Lucide Icons
import { Wand2, Loader2, AlertTriangle, ClipboardCopy, Check, KeyRound, Save, Sparkles, Download, Pencil, Trash2, X } from 'lucide-react';

interface DocumentInfo {
  id: number;
  name: string;
}

interface GenerationViewProps {
  autoDownload: boolean; // Prop needed for automatic PDF download
}

const GenerationView: React.FC<GenerationViewProps> = ({ autoDownload }) => {
  // Combined State
  const [coverLetters, setCoverLetters] = useState<DocumentInfo[]>([]);
  const [resumes, setResumes] = useState<DocumentInfo[]>([]);
  const [selectedCoverLetterId, setSelectedCoverLetterId] = useState<string>('');
  const [selectedResumeId, setSelectedResumeId] = useState<string>('');
  const [jobDescriptionText, setJobDescriptionText] = useState<string>('');
  const [tone, setTone] = useState<ToneSetting>('professional');
  const [apiKey, setApiKey] =useState<string>('');
  const [apiKeyError, setApiKeyError] = useState<string>('');
  const [autoCopy, setAutoCopy] = useState<boolean>(false); // Needed for manual prompt auto-copy
  const [additionalContext, setAdditionalContext] = useState<string>(''); // State for additional context
  const [isEditingApiKey, setIsEditingApiKey] = useState<boolean>(false); // State for editing API key
  const [originalApiKey, setOriginalApiKey] = useState<string>(''); // Store key before editing

  // Loading/Error States
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState<boolean>(false);
  const [isGeneratingAutomatic, setIsGeneratingAutomatic] = useState<boolean>(false);
  const [promptError, setPromptError] = useState<string>('');
  const [automaticError, setAutomaticError] = useState<string>(''); // Separate error for automatic

  // Outputs
  const [manualPromptOutput, setManualPromptOutput] = useState<string>('');
  const [generatedCoverLetterOutput, setGeneratedCoverLetterOutput] = useState<string>('');

  // UI Feedback State (Toasts, Copy Buttons) - Consider consolidating later if identical
  const [showToast, setShowToast] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');
  const [manualCopyButtonText, setManualCopyButtonText] = useState<React.ReactNode>(<ClipboardCopy className="h-4 w-4" />);
  const [autoCopyButtonText, setAutoCopyButtonText] = useState<React.ReactNode>(<ClipboardCopy className="h-4 w-4" />);

  const toastTimeoutRef = useRef<number | null>(null);

  // --- Utility Functions (Toast, API Key Validation, PDF Gen) ---
  const showToastNotification = (message: string) => {
    if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current);
    setToastMessage(message);
    setShowToast(true);
    toastTimeoutRef.current = window.setTimeout(() => setShowToast(false), 3000) as unknown as number;
  };

  const validateApiKey = (key: string): boolean => {
    return /^sk-/.test(key);
  };

  const generatePDF = (text: string) => {
    const doc = new jsPDF();
    doc.setFont('times', 'normal');
    doc.setFontSize(12);
    const lines = doc.splitTextToSize(text, doc.internal.pageSize.getWidth() - 40);
    doc.text(lines, 20, 20);
    return doc;
  };

  // --- Lifecycle Hooks ---
  useEffect(() => { // Cleanup toast timeout
    return () => { if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current); };
  }, []);

  useEffect(() => { // Load initial data
    const loadData = async () => {
      setIsInitialLoading(true);
      setPromptError('');
      setAutomaticError('');
      setApiKeyError('');
      try {
        // Fetch documents
        const [clData, resumeData] = await Promise.all([getAllCoverLetters(), getAllResumes()]);
        setCoverLetters(clData.map((d: DocumentInfo) => ({ id: d.id, name: d.name })));
        setResumes(resumeData.map((r: DocumentInfo) => ({ id: r.id, name: r.name })));

        // Load API key from local storage
        chrome.storage.local.get(['openaiApiKey', 'tone', 'autoCopy'], (localResult) => {
          if (localResult.openaiApiKey) {
            const loadedKey = localResult.openaiApiKey;
            setApiKey(loadedKey);
            if (!validateApiKey(loadedKey)) setApiKeyError("Warning: Saved API key format seems invalid.");
            else setApiKeyError('');
          }
          if (localResult.tone) {
             const validTones: ToneSetting[] = ['professional', 'friendly', 'casual'];
             if (validTones.includes(localResult.tone)) setTone(localResult.tone as ToneSetting);
          }
          setAutoCopy(!!localResult.autoCopy);
        });

        // Load selections & JD & Context from session storage
        chrome.storage.session.get(['selectedCoverLetterId', 'selectedResumeId', 'jobDescriptionText', 'additionalContext'], (sessionResult) => {
          if (sessionResult.selectedCoverLetterId) setSelectedCoverLetterId(sessionResult.selectedCoverLetterId);
          if (sessionResult.selectedResumeId) setSelectedResumeId(sessionResult.selectedResumeId);
          if (sessionResult.jobDescriptionText) setJobDescriptionText(sessionResult.jobDescriptionText);
          if (sessionResult.additionalContext) setAdditionalContext(sessionResult.additionalContext); // Load context
        });

      } catch (err) {
        console.error("Error loading initial data:", err);
        setPromptError("Failed to load documents. Please try reloading."); // Show general error
        setAutomaticError("Failed to load documents. Please try reloading.");
      } finally {
        setIsInitialLoading(false);
      }
    };
    loadData();

    // Add message listener for JD text
     const messageListener = (message: any) => {
      if (message.type === 'JOB_DESCRIPTION_TEXT' && message.payload?.text) {
        const newText = message.payload.text;
        const source = message.payload.source;
        setJobDescriptionText(prevText => {
          const shouldUpdate = source === 'highlight' || !prevText;
          if (shouldUpdate) {
            chrome.storage.session.set({ jobDescriptionText: newText }); // Save incoming JD
            return newText;
          }
          return prevText;
        });
      }
    };
    chrome.runtime.onMessage.addListener(messageListener);
    return () => chrome.runtime.onMessage.removeListener(messageListener);

  }, []);

  useEffect(() => { // Save selections & JD to session storage on change
    const dataToSave: { [key: string]: any } = {};
    if (selectedCoverLetterId) dataToSave.selectedCoverLetterId = selectedCoverLetterId;
    if (selectedResumeId) dataToSave.selectedResumeId = selectedResumeId;
    dataToSave.jobDescriptionText = jobDescriptionText; // Always save current JD
    dataToSave.additionalContext = additionalContext; // Save context
    if (Object.keys(dataToSave).length > 0) {
      chrome.storage.session.set(dataToSave);
    }
  }, [selectedCoverLetterId, selectedResumeId, jobDescriptionText, additionalContext]);


  // --- Event Handlers (To be fully implemented) ---
  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    if (value && !validateApiKey(value)) setApiKeyError("Invalid OpenAI API key format.");
    else setApiKeyError('');
  };

  const handleSaveApiKey = () => {
     if (validateApiKey(apiKey)) {
      chrome.storage.local.set({ openaiApiKey: apiKey }, () => {
        if (chrome.runtime.lastError) {
          console.error('Error saving API key:', chrome.runtime.lastError);
          setApiKeyError('Failed to save API key.');
        } else {
          setApiKeyError('');
          setOriginalApiKey(apiKey);
          setIsEditingApiKey(false);
          showToastNotification('API Key saved successfully!');
        }
      });
    } else {
      setApiKeyError("Cannot save invalid API key format.");
    }
  };

  const handleGeneratePrompt = async () => {
     setIsGeneratingPrompt(true);
     setPromptError('');
     setManualPromptOutput('');
    // ... (Adapted logic from GeneratePage)
    console.log("Generate Prompt clicked");
     try {
         if (!selectedCoverLetterId || !selectedResumeId) {
            throw new Error("Please select both a cover letter and a resume.");
         }
         const clId = parseInt(selectedCoverLetterId, 10);
         const resumeId = parseInt(selectedResumeId, 10);
         const [coverLetterContent, resumeContent] = await Promise.all([
            getCoverLetterContent(clId),
            getResumeContent(resumeId)
         ]);
         if (coverLetterContent === null || resumeContent === null) {
            throw new Error("Could not retrieve content for selected documents.");
         }
         const prompt = `Job Description:
${jobDescriptionText || 'N/A'}

Tone: ${tone}

Additional Context:
${additionalContext || 'N/A'}

Cover Letter:
${coverLetterContent}

Resume:
${resumeContent}

TODO: Add instructions here.`;
         setManualPromptOutput(prompt.trim());
         if (autoCopy) await copyToClipboardManual(prompt.trim(), 'Automatically copied to clipboard');
     } catch (err: any) {
         setPromptError(err.message || "Failed to generate prompt.");
     } finally {
         setIsGeneratingPrompt(false);
     }
  };

  const handleGenerateAutomatic = async () => {
     setIsGeneratingAutomatic(true);
     setAutomaticError('');
     setApiKeyError(''); // Clear API key error before attempt
     setGeneratedCoverLetterOutput('');
     // ... (Adapted logic from AutomaticPage)
     console.log("Generate Automatic clicked");
     try {
        if (!apiKey || !validateApiKey(apiKey)) {
            throw new Error("Valid OpenAI API key is required.");
        }
        if (!selectedCoverLetterId || !selectedResumeId) {
            throw new Error("Please select both a cover letter and a resume.");
        }
        // ... (rest of API call logic) ...
         const clId = parseInt(selectedCoverLetterId, 10);
         const resumeId = parseInt(selectedResumeId, 10);
         const [coverLetterContent, resumeContent] = await Promise.all([
            getCoverLetterContent(clId),
            getResumeContent(resumeId)
         ]);
          if (coverLetterContent === null || resumeContent === null) {
            throw new Error("Could not retrieve content for selected documents.");
         }
         const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
         const systemPrompt = `You are an expert cover letter writer. You have access to the following information:
-      - The original cover letter: ${coverLetterContent}
-      - The user's resume: ${resumeContent}
-      - The job description: ${jobDescriptionText || 'N/A'}
-      - Additional Context: ${additionalContext || 'N/A'}
-      - The desired tone: ${tone}
-
-      Your task is to generate a concise, professional cover letter that:
-      1. Matches the job requirements
-      2. Highlights relevant experience from the resume
-      3. Maintains the style of the original cover letter
-      4. Uses the specified tone (${tone})
-      5. Is exactly 270 words or less
-      
-      Make sure to:
-      - Keep the same general structure as the original cover letter
-      - Use specific examples from the resume
-      - Address key requirements from the job description
-      - Maintain professional formatting
-      - Be concise and impactful
-      - Include all essential sections: header, date, salutation, body paragraphs, and closing
-      - Focus on quality over quantity
-      - Count words carefully to ensure the total is 270 or less`;

         const completion = await openai.chat.completions.create({
             model: "gpt-4o", // Ensure model is specified
             messages: [ // Ensure messages are specified
               { role: "system", content: systemPrompt },
               { role: "user", content: "Please generate a tailored cover letter based on the provided information." }
             ],
             temperature: 0.7
         }).catch((error) => { // Refined error handling from AutomaticPage
             console.error("OpenAI API Error:", error);
             if (error instanceof OpenAI.APIError) {
                if (error.status === 401) {
                  throw new Error("Invalid API key. Please check your API key and try again.");
                } else if (error.status === 429) {
                  throw new Error("Rate limit exceeded or quota finished. Please check your OpenAI account.");
                } else {
                  throw new Error(`API Error: ${error.status} - ${error.message}`);
                }
             }
             throw new Error("An unexpected error occurred while contacting OpenAI.");
          });
          const output = completion.choices[0]?.message?.content || '';
          setGeneratedCoverLetterOutput(output);
          if(autoDownload && output) {
            const doc = generatePDF(output);
            doc.save('cover_letter.pdf');
         }

     } catch (err: any) {
         console.error("Generate Automatic Error:", err);
          if (err.message.includes("API key") || err.message.includes("Rate limit") || err.message.includes("quota")) {
             setApiKeyError(err.message); // Set specific API key error
          } else {
             setAutomaticError(err.message || "Failed to generate cover letter.");
          }
     } finally {
        setIsGeneratingAutomatic(false);
     }
  };

  const copyToClipboardManual = async (text: string, toastMsg?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setManualCopyButtonText(<Check className="h-4 w-4 text-green-600" />);
      showToastNotification(toastMsg || 'Prompt copied!');
      setTimeout(() => setManualCopyButtonText(<ClipboardCopy className="h-4 w-4" />), 1500);
    } catch (err) { /* ... */ }
  };

  const copyToClipboardAutomatic = async (text: string, toastMsg?: string) => {
     try {
      await navigator.clipboard.writeText(text);
      setAutoCopyButtonText(<Check className="h-4 w-4 text-green-600" />);
      showToastNotification(toastMsg || 'Cover letter copied!');
      setTimeout(() => setAutoCopyButtonText(<ClipboardCopy className="h-4 w-4" />), 1500);
    } catch (err) { /* ... */ }
  };


  // --- Render Logic ---
  if (isInitialLoading) {
    return (
      <div className="space-y-6 p-4">
        {/* Combined Skeleton */}
        <Skeleton className="h-6 w-1/4 mb-2" /> {/* Gen Inputs Title */}
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
        <Skeleton className="h-24 mt-4 mb-4" /> {/* JD Textarea */}
        <Skeleton className="h-16 mt-4 mb-4" /> {/* Additional Context Textarea */}
        <Skeleton className="h-10 w-1/2 mb-4" /> {/* TabsList */}
         {/* Placeholder for tab content (button/output) */}
        <Skeleton className="h-10 w-1/4" /> 
        <Skeleton className="h-40 mt-6" /> 
      </div>
    );
  }

  // Main Render
  return (
    <div className="generation-view space-y-6 p-4">
      {/* Common Inputs Section */}
      <div className="space-y-4">
         {/* ... Generation Inputs Title, Selectors, JD Textarea ... */}
          <h2 className="text-lg font-semibold">Generation Inputs</h2>
          {/* Selectors Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Cover Letter Select */}
            <div className="space-y-1.5">
              <Label htmlFor="cover-letter-select">Base Cover Letter</Label>
              <Select
                value={selectedCoverLetterId}
                onValueChange={setSelectedCoverLetterId}
                disabled={isGeneratingPrompt || isGeneratingAutomatic}
              >
                <SelectTrigger id="cover-letter-select" className="w-full min-w-0 truncate overflow-hidden bg-white">
                  <SelectValue placeholder="Select a cover letter..." />
                </SelectTrigger>
                <SelectContent>
                   {coverLetters.length === 0 ? (
                     <SelectItem value="disabled" disabled>No cover letters found</SelectItem>
                   ) : (
                     coverLetters.map(doc => (
                       <SelectItem key={doc.id} value={String(doc.id)}>
                         <span className="block w-full min-w-0 truncate overflow-hidden">{doc.name}</span>
                       </SelectItem>
                     ))
                   )}
                 </SelectContent>
              </Select>
            </div>
             {/* Resume Select */}
             <div className="space-y-1.5">
               <Label htmlFor="resume-select">Resume</Label>
              <Select
                value={selectedResumeId}
                onValueChange={setSelectedResumeId}
                disabled={isGeneratingPrompt || isGeneratingAutomatic}
              >
                 <SelectTrigger id="resume-select" className="w-full min-w-0 truncate overflow-hidden bg-white">
                   <SelectValue placeholder="Select a resume..." />
                 </SelectTrigger>
                 <SelectContent>
                    {resumes.length === 0 ? (
                     <SelectItem value="disabled" disabled>No resumes found</SelectItem>
                   ) : (
                     resumes.map(doc => (
                       <SelectItem key={doc.id} value={String(doc.id)}>
                         <span className="block w-full min-w-0 truncate overflow-hidden">{doc.name}</span>
                       </SelectItem>
                     ))
                   )}
                 </SelectContent>
               </Select>
             </div>
           </div>
           {/* Job Description Textarea */}
           <div className="space-y-1.5">
             <Label htmlFor="job-description">Job Description</Label>
             <Textarea
              id="job-description"
              placeholder="Paste the job description here..."
              value={jobDescriptionText}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setJobDescriptionText(e.target.value)}
              rows={8}
              className="min-h-[150px] bg-white placeholder:text-sm"
              disabled={isGeneratingPrompt || isGeneratingAutomatic}
             />
           </div>
      </div>

       {/* Additional Context Textarea (Before Tabs) */}
       <div className="space-y-1.5">
         <Label htmlFor="additional-context">Additional Context (Optional)</Label>
         <Textarea
          id="additional-context"
          placeholder="Provide any extra instructions, details about the company, specific skills to emphasize, etc..."
          value={additionalContext}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setAdditionalContext(e.target.value)}
          rows={4} // Shorter default height
          className="min-h-[80px] bg-white placeholder:text-sm"
          disabled={isGeneratingPrompt || isGeneratingAutomatic}
         />
       </div>

        <Tabs defaultValue="prompt" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-white">
                <TabsTrigger value="prompt" className="data-[state=active]:shadow-none data-[state=active]:bg-[#245F73] data-[state=active]:text-primary-foreground">
                    Prompt
                </TabsTrigger>
                <TabsTrigger 
                  value="automatic" 
                  className={cn(
                    "group", 
                    "data-[state=active]:shadow-none data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-blue-500 data-[state=active]:text-primary-foreground"
                  )}
                >
                     <div className="flex items-center gap-1.5">
                        {/* Icon gets explicit inactive color, inherits active color */}
                       <Sparkles className={cn(
                         "h-4 w-4", 
                         "group-data-[state=inactive]:text-purple-500" // Purple when inactive
                       )} /> 
                       {/* Text gets gradient ONLY when inactive */}
                       <span className={cn(
                         "group-data-[state=inactive]:bg-gradient-to-r group-data-[state=inactive]:from-purple-500 group-data-[state=inactive]:to-blue-500 group-data-[state=inactive]:bg-clip-text group-data-[state=inactive]:text-transparent"
                       )}>
                         Automatic
                       </span> 
                     </div>
                </TabsTrigger>
            </TabsList>

            {/* Prompt Generation Tab */}
            <TabsContent value="prompt" className="mt-4 space-y-4">
                 {/* Error Display */}
                 {promptError && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Error</AlertTitle>
                      <AlertDescription>{promptError}</AlertDescription>
                    </Alert>
                  )}

                {/* Generate Button */}
                 <div>
                   <Button
                     onClick={handleGeneratePrompt}
                     disabled={isGeneratingPrompt || !selectedCoverLetterId || !selectedResumeId}
                     className="w-full bg-[#733E24] text-white hover:bg-[#5e311f] disabled:bg-gray-400 disabled:text-gray-800"
                   >
                     {isGeneratingPrompt ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                     Generate Prompt
                   </Button>
                 </div>

                 {/* Output Section */}
                 {(!isGeneratingPrompt && manualPromptOutput) && (
                    <div className="space-y-2 pt-4 border-t">
                       <div className="flex items-center justify-between">
                         <h2 className="text-lg font-semibold">Generated Prompt</h2>
                         <Button variant="ghost" size="icon" onClick={() => copyToClipboardManual(manualPromptOutput)} className="h-8 w-8">
                           {manualCopyButtonText}
                         </Button>
                       </div>
                       <Textarea
                        id="manual-prompt-output"
                        readOnly
                        value={manualPromptOutput}
                        placeholder="Generated prompt will appear here..."
                        rows={10}
                        className="text-xs font-mono bg-white"
                       />
                    </div>
                 )}
                 {/* Loading Skeleton for Output */}
                 {(isGeneratingPrompt && !promptError) && (
                    <div className="space-y-2 pt-4 border-t">
                        <div className="flex items-center justify-between">
                           <Skeleton className="h-6 w-1/4" />
                           <Skeleton className="h-8 w-8 rounded-md" />
                        </div>
                        <Skeleton className="h-[200px] w-full" />
                    </div>
                 )}
            </TabsContent>

             {/* Automatic Generation Tab */}
            <TabsContent value="automatic" className="mt-4 space-y-4">
                {/* API Key Section - Updated Logic */}
                 <div className="space-y-2">
                   <Label htmlFor="api-key-input" className="text-base font-medium">OpenAI API Key</Label>
                   
                   {/* Conditional Rendering based on apiKey existence and editing state */}                  
                   {apiKey && validateApiKey(apiKey) && !isEditingApiKey ? (
                     // Display Mode: Show masked key + Edit/Delete buttons
                     <div className="flex items-center space-x-2">
                       <KeyRound className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                       <span className="flex-grow p-2 border rounded-md bg-muted text-muted-foreground text-sm font-mono overflow-hidden text-ellipsis whitespace-nowrap min-w-0">
                         sk-{apiKey.slice(3, 10)}{'•'.repeat(Math.max(0, apiKey.length - 10))}
                       </span>
                       <TooltipProvider delayDuration={100}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => { 
                                setOriginalApiKey(apiKey);
                                setIsEditingApiKey(true); 
                              }} className="h-9 w-9">
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Edit Key</p></TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-9 w-9 text-destructive hover:text-destructive"
                                onClick={() => {
                                  if (window.confirm('Are you sure you want to delete your saved API key?')) {
                                    chrome.storage.local.remove('openaiApiKey', () => {
                                      if (chrome.runtime.lastError) {
                                        console.error('Error deleting API key:', chrome.runtime.lastError);
                                        setApiKeyError('Failed to delete API key.');
                                      } else {
                                        setApiKey('');
                                        setApiKeyError('');
                                        setIsEditingApiKey(false);
                                        showToastNotification('API Key deleted successfully!');
                                      }
                                    });
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Delete Key</p></TooltipContent>
                          </Tooltip>
                       </TooltipProvider>
                     </div>
                   ) : (
                     // Edit or Initial Input Mode
                     <div className="flex items-center space-x-2">
                       <KeyRound className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                       <Input
                         id="api-key"
                         type="password"
                         placeholder="Enter your OpenAI API Key (sk-...)"
                         value={apiKey}
                         onChange={(e) => handleApiKeyChange(e.target.value)}
                         className={cn("flex-grow", apiKeyError && "border-destructive", "bg-white")}
                         disabled={isGeneratingAutomatic} // Keep disabled during generation
                       />
                       {isEditingApiKey ? (
                         // Save/Cancel buttons during edit
                         <>
                           <TooltipProvider delayDuration={100}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                 <Button 
                                   onClick={handleSaveApiKey} 
                                   size="icon" 
                                   className="h-8 w-8 bg-[#245F73] hover:bg-[#1d4a5b] text-white" 
                                   disabled={!apiKey || !!apiKeyError || isGeneratingAutomatic}
                                 >
                                   <Check className="h-4 w-4" />
                                 </Button>
                              </TooltipTrigger>
                              <TooltipContent><p>Save Changes</p></TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => { 
                                  setApiKey(originalApiKey);
                                  setApiKeyError(''); 
                                  setIsEditingApiKey(false); 
                                }} className="h-9 w-9">
                                  <X className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent><p>Cancel</p></TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                         </>
                       ) : (
                         // Original Save button for initial input
                         <Button 
                           onClick={handleSaveApiKey} 
                           size="sm" 
                           disabled={!apiKey || !!apiKeyError || isGeneratingAutomatic}
                           className="bg-[#733E24] text-white hover:bg-[#5e311f] disabled:bg-gray-400 disabled:text-gray-600"
                         >
                           <Save className="mr-2 h-4 w-4" /> Save Key
                         </Button>
                       )}
                     </div>
                   )}

                    {/* API Key Error Display (Moved slightly down for clarity) */}                   
                    {(apiKeyError && (!apiKey || isEditingApiKey)) && (
                     <Alert variant="destructive" className="mt-2">
                       <AlertTriangle className="h-4 w-4" />
                       <AlertTitle>API Key Error</AlertTitle>
                       <AlertDescription>{apiKeyError}</AlertDescription>
                     </Alert>
                   )}
                   {/* Valid Key Hint (Only show when displaying saved key) */}                   
                   {apiKey && validateApiKey(apiKey) && !isEditingApiKey && (
                     <p className="text-xs text-muted-foreground mt-1">API key saved and appears valid.</p>
                   )}
                 </div>

                {/* General Error Display for Automatic */}
                {automaticError && !apiKeyError && ( // Show only if not an API key error
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Generation Error</AlertTitle>
                      <AlertDescription>{automaticError}</AlertDescription>
                    </Alert>
                  )}

                 {/* Generate Button */}
                 <div>
                   <Button
                     onClick={handleGenerateAutomatic}
                     disabled={isGeneratingAutomatic || !apiKey || !validateApiKey(apiKey) || !selectedCoverLetterId || !selectedResumeId}
                     className="w-full bg-[#733E24] text-white hover:bg-[#5e311f] disabled:bg-gray-400 disabled:text-gray-800"
                   >
                     {isGeneratingAutomatic ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                     Generate Cover Letter
                   </Button>
                 </div>

                 {/* Output Section */}
                  {(!isGeneratingAutomatic && generatedCoverLetterOutput) && (
                    <div className="space-y-2 pt-4 border-t">
                       <div className="flex items-center justify-between">
                         <h2 className="text-lg font-semibold">Generated Cover Letter</h2>
                         <div className="flex items-center gap-1">
                            <TooltipProvider delayDuration={100}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" onClick={() => copyToClipboardAutomatic(generatedCoverLetterOutput)} className="h-8 w-8">
                                    {autoCopyButtonText}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Copy</p></TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                 <TooltipTrigger asChild>
                                   <Button 
                                     variant="ghost" 
                                     size="icon" 
                                     onClick={() => generatePDF(generatedCoverLetterOutput).save('cover_letter.pdf')}
                                     className="h-8 w-8"
                                    >
                                     <Download className="h-4 w-4" />
                                   </Button>
                                 </TooltipTrigger>
                                 <TooltipContent><p>Download PDF</p></TooltipContent>
                               </Tooltip>
                            </TooltipProvider>
                         </div>
                       </div>
                       <Textarea
                        id="generated-cover-letter"
                        readOnly
                        value={generatedCoverLetterOutput}
                        placeholder="Generated cover letter will appear here..."
                        rows={12}
                        className="text-sm bg-white"
                       />
                    </div>
                 )}
                 {/* Loading Skeleton for Output */}
                  {(isGeneratingAutomatic && !automaticError && !apiKeyError) && (
                    <div className="space-y-2 pt-4 border-t">
                       <div className="flex items-center justify-between">
                           <Skeleton className="h-6 w-1/4" />
                            <div className="flex items-center gap-1">
                              <Skeleton className="h-8 w-8 rounded-md" />
                              <Skeleton className="h-8 w-8 rounded-md" />
                            </div>
                       </div>
                       <Skeleton className="h-[200px] w-full" />
                    </div>
                  )}
            </TabsContent>
        </Tabs>

       {/* Custom Styled Toast Notification (Common) */}
      {showToast && (
        <div className="fixed bottom-4 right-4 z-50 p-3 rounded-md bg-foreground text-background shadow-lg text-sm font-medium animate-in fade-in slide-in-from-bottom-2">
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default GenerationView; 