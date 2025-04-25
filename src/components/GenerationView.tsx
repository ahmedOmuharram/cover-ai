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
import { Wand2, Loader2, AlertTriangle, ClipboardCopy, Check, KeyRound, Save, Sparkles, Download } from 'lucide-react';

interface DocumentInfo {
  id: number;
  name: string;
}

interface GenerationViewProps {
  autoDownload: boolean; // Prop needed for automatic PDF download
  injectedJobDescription?: string;
}

const GenerationView: React.FC<GenerationViewProps> = ({ autoDownload, injectedJobDescription }) => {
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

  useEffect(() => {
    if (injectedJobDescription) {
      setJobDescriptionText((prev) => {
        if (!prev) {
          chrome.storage.session.set({ jobDescriptionText: injectedJobDescription });
          return injectedJobDescription;
        }
        return prev;
      });
    }
  }, [injectedJobDescription]);
  

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
         const prompt = `
You are a professional career coach and expert resume writer.  Use the inputs below (in order) to craft a tailored cover letter.

---
1) Job Description:
${jobDescriptionText || 'N/A'}

2) Tone:
${tone}

3) Additional Context:
${additionalContext || 'N/A'}

4) Base Cover Letter:
${coverLetterContent}

5) Base Resume:
${resumeContent}
---

Instructions:
1. Adopt the requested tone throughout (professional, friendly, or casual).
2. Structure:
   - Greeting: “Dear Hiring Manager,” (or a provided name).
   - Opening: One sentence stating the role and why you’re excited, weaving in additional context.
   - Body: Two short paragraphs:
     • Match your top 2–3 achievements or skills (from the resume) to the key requirements.
     • Draw inspiration from the base cover letter, but rewrite in fresh language.
   - Closing: Reiterate enthusiasm, mention fit or context, and include a call to action.
   - Signature: “Sincerely,” or “Best regards,” + candidate name.
3. Length & Format:
   - ~300–400 words, 3–4 paragraphs.
   - Do not repeat the job description verbatim; integrate its language naturally.
4. Output only the final cover letter text, ready to copy/paste.

Please generate the complete cover letter now.
`.trim();



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
                <SelectTrigger id="cover-letter-select" className="w-full min-w-0 truncate overflow-hidden">
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
               <Label htmlFor="resume-select">Base Resume</Label>
              <Select
                value={selectedResumeId}
                onValueChange={setSelectedResumeId}
                disabled={isGeneratingPrompt || isGeneratingAutomatic}
              >
                 <SelectTrigger id="resume-select" className="w-full min-w-0 truncate overflow-hidden">
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
              className="min-h-[150px]" // Slightly smaller default height
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
          className="min-h-[80px]"
          disabled={isGeneratingPrompt || isGeneratingAutomatic}
         />
       </div>

        <Tabs defaultValue="prompt" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="prompt" className="data-[state=active]:shadow-none">
                    Prompt
                </TabsTrigger>
                <TabsTrigger 
                  value="automatic" 
                  className={cn(
                    "group", // Add group utility
                    // Active state: Gradient BG, white text.
                    "data-[state=active]:shadow-none data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-blue-500 data-[state=active]:text-primary-foreground"
                    // NO inactive styles directly on trigger
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
                     className="w-full sm:w-auto"
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
                       <Textarea readOnly value={manualPromptOutput} className="min-h-[200px] font-mono text-sm bg-muted/50" rows={15} />
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
                {/* API Key Section */}
                 <div className="space-y-2">
                   <Label htmlFor="api-key-input" className="text-base font-medium">OpenAI API Key</Label>
                   <div className="flex items-center gap-2">
                     <KeyRound className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                     <Input
                       id="api-key-input"
                       type="password"
                       placeholder="Enter your OpenAI API key (sk-...)"
                       value={apiKey}
                       onChange={(e) => handleApiKeyChange(e.target.value)}
                       className={cn(apiKeyError && "border-destructive")}
                       disabled={isGeneratingAutomatic}
                     />
                     <Button onClick={handleSaveApiKey} disabled={!apiKey || !!apiKeyError || isGeneratingAutomatic} variant="outline" size="icon" aria-label="Save API Key">
                       <Save className="h-4 w-4" />
                     </Button>
                   </div>
                    {apiKeyError && (
                     <Alert variant="destructive" className="mt-2">
                       <AlertTriangle className="h-4 w-4" />
                       <AlertTitle>API Key Error</AlertTitle>
                       <AlertDescription>{apiKeyError}</AlertDescription>
                     </Alert>
                   )}
                   {!apiKeyError && apiKey && validateApiKey(apiKey) && (
                     <p className="text-xs text-muted-foreground mt-1">API key appears valid!</p>
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
                     className="w-full sm:w-auto"
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
                       <Textarea readOnly value={generatedCoverLetterOutput} className="min-h-[200px] font-mono text-sm bg-muted/50" rows={20} />
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