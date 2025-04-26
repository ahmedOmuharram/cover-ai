import React, { useState, useEffect, useRef } from 'react';
import { ToneSetting } from '../App'; // Assuming App.js/.ts exists
import {
  getAllCoverLetters,
  getCoverLetterContent,
  getAllResumes,
  getResumeContent,
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

type ModelType = 'openai-gpt4' | 'openai-o4mini' | 'gemini-pro' | 'gemini-1.5-flash';

interface GenerationViewProps {
  autoDownload: boolean; // Prop needed for automatic PDF download
  useAdditionalContext: boolean; // Prop to control using additional context
  // Props for custom default filename
  useCustomDefaultFilename: boolean;
  customDefaultFilename: string;
  maxWords: number; // Add maxWords prop
  pdfFontSize: number; // Add font size prop
  // Add callback prop
  onGenerationComplete: (data: { content: string; font: 'times' | 'helvetica'; filename: string }) => void;
  injectedJobDescription?: string; // Add from incoming changes
  selectedModel: ModelType;
  setSelectedModel: (model: ModelType) => void;
}

const GenerationView: React.FC<GenerationViewProps> = ({ 
  autoDownload, 
  useAdditionalContext, 
  useCustomDefaultFilename, 
  customDefaultFilename, 
  maxWords,
  pdfFontSize,
  onGenerationComplete,
  injectedJobDescription,
  selectedModel,
  setSelectedModel
}) => {
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
  const [pdfFilename, setPdfFilename] = useState<string>(''); // State for optional PDF filename
  const [hasSavedApiKey, setHasSavedApiKey] = useState<boolean>(false); // Track if a valid key is actually saved

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
    if (selectedModel.startsWith('openai')) {
      return /^sk-/.test(key);
    } else {
      return key.length > 0; // Gemini keys don't have a specific prefix
    }
  };

  const generatePDF = (text: string, font: 'times' | 'helvetica' = 'times') => {
    const doc = new jsPDF();
    const fontSize = pdfFontSize; // Use prop for font size
    const lineSpacingFactor = 0.5; // Further reduced spacing factor
    doc.setFont(font, 'normal');
    doc.setFontSize(fontSize);

    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20; // Define margin (e.g., 20 units)
    const maxLineWidth = pageWidth - margin * 2;
    const lineHeight = fontSize * lineSpacingFactor; // Calculate line height based on font size
    const lines = doc.splitTextToSize(text, maxLineWidth);

    let y = margin; // Initial y position

    lines.forEach((line: string) => {
      // Check if adding the next line exceeds the page height (considering bottom margin)
      if (y + lineHeight > pageHeight - margin) {
        doc.addPage();       // Add a new page
        y = margin;         // Reset y to the top margin
      }
      doc.text(line, margin, y);
      y += lineHeight;       // Move y down for the next line
    });

    return doc;
  };

  // --- Lifecycle Hooks ---
  useEffect(() => { // Cleanup toast timeout
    return () => { if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current); };
  }, []);

  useEffect(() => {
    if (injectedJobDescription) {
      // Update jobDescriptionText unconditionally on new job page
      setJobDescriptionText(injectedJobDescription);
      chrome.storage.session.set({ jobDescriptionText: injectedJobDescription });
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

        // Load API key from local storage based on selected model
        const storageKey = selectedModel === 'openai-gpt4' ? 'openaiApiKey' : selectedModel === 'openai-o4mini' ? 'openaiApiKey' : selectedModel === 'gemini-pro' ? 'geminiApiKey' : 'geminiApiKey';
        chrome.storage.local.get([storageKey, 'tone', 'autoCopy'], (localResult) => {
          if (localResult[storageKey]) {
            const loadedKey = localResult[storageKey];
            setApiKey(loadedKey);
            if (!validateApiKey(loadedKey)) {
              setApiKeyError(`Warning: Saved ${selectedModel.startsWith('openai') ? 'OpenAI' : 'Gemini'} API key format seems invalid.`);
              setHasSavedApiKey(false);
            } else {
              setApiKeyError('');
              setOriginalApiKey(loadedKey);
              setHasSavedApiKey(true);
            }
          } else {
            setHasSavedApiKey(false);
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
    if (selectedModel.startsWith('openai')) {
      setApiKey(value);
      if (value && !validateApiKey(value)) {
        setApiKeyError("Invalid OpenAI API key format (should start with sk-).");
      } else {
        setApiKeyError('');
      }
    } else {
      setApiKey(value);
      if (value && !validateApiKey(value)) {
        setApiKeyError("Invalid Gemini API key format.");
      } else {
        setApiKeyError('');
      }
    }
  };

  const handleSaveApiKey = () => {
    if (selectedModel.startsWith('openai')) {
      if (validateApiKey(apiKey)) {
        chrome.storage.local.set({ openaiApiKey: apiKey }, () => {
          if (chrome.runtime.lastError) {
            setApiKeyError("Failed to save API key. Please try again.");
          } else {
            setOriginalApiKey(apiKey);
            setIsEditingApiKey(false);
            setHasSavedApiKey(true);
            setApiKeyError('');
          }
        });
      } else {
        setApiKeyError("Cannot save invalid API key format.");
      }
    } else {
      if (validateApiKey(apiKey)) {
        chrome.storage.local.set({ geminiApiKey: apiKey }, () => {
          if (chrome.runtime.lastError) {
            setApiKeyError("Failed to save API key. Please try again.");
          } else {
            setOriginalApiKey(apiKey);
            setIsEditingApiKey(false);
            setHasSavedApiKey(true);
            setApiKeyError('');
          }
        });
      } else {
        setApiKeyError("Cannot save invalid Gemini API key format.");
      }
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
         const currentDate = new Date().toLocaleDateString('en-US', { 
           month: '2-digit',
           day: '2-digit',
           year: 'numeric'
         });
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
   - Date: Use ${currentDate} at the top of the letter
   - Greeting: "Dear Hiring Manager," (or a provided name).
   - Opening: One sentence stating the role and why you're excited, weaving in additional context.
   - Body: Two short paragraphs:
     • Match your top 2–3 achievements or skills (from the resume) to the key requirements.
     • Draw inspiration from the base cover letter, but rewrite in fresh language.
   - Closing: Reiterate enthusiasm, mention fit or context, and include a call to action.
   - Signature: "Sincerely," or "Best regards," + [Your Name - Infer from Resume/CL if possible, otherwise use placeholder].
3. Length & Format:
   - Strictly adhere to a maximum word count of ${maxWords}.
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
            setApiKeyError("Valid API key is required."); // Set specific API key error
            throw new Error("Valid API key is required.");
        }
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

        const currentDate = new Date().toLocaleDateString('en-US', { 
          month: '2-digit',
          day: '2-digit',
          year: 'numeric'
        });

        const systemPrompt = `You are an expert cover letter writer. 
        Your task is to rewrite the provided cover letter based *only* on the 
        provided resume and job description.  Ensure the final letter adheres to 
        strictly approximately ${maxWords}: don't change the word count by too much from that number
        no matter how illogical or logical it is. To iterate: WORD COUNT MAXIMUM AND MINIMUM IS ${maxWords}.
         Adapt the tone to be ${tone}. Keep the original cover's header structure exactly the same including spacing, except for the date, which you should change to ${currentDate}.
        Keep the original cover letter's structure and key points where possible, 
        but tailor the content specifically to the job description, highlighting 
        relevant skills and experiences from the resume. ${useAdditionalContext && additionalContext ? ` Also consider the following additional context provided by the user: ${additionalContext}.` : ''} 
        Respond only with the rewritten cover letter text, nothing else. However, change the wording as needed to match the ${maxWords} word count.`;

        const userPrompt = `Job Description:
${jobDescriptionText || 'N/A'}

Cover Letter:
${coverLetterContent}

Resume:
${resumeContent}`;

        let output = '';
        if (selectedModel === 'openai-gpt4' || selectedModel === 'openai-o4mini') {
          const model = selectedModel === 'openai-gpt4' ? 'gpt-4o' : 'openai-o4mini';
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: model,
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
              ],
              ...(model === 'gpt-4o' ? { temperature: 0.7 } : {temperature: 1})
            })
          });
          const data = await response.json();
          output = data.choices[0]?.message?.content || '';
        } else if (selectedModel === 'gemini-1.5-flash') {
          const model = 'gemini-1.5-flash';
          const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: model,
              prompt: {
                text: systemPrompt
              }
            })
          });
          const data = await response.json();
          output = data.result.text || '';
        }

        setGeneratedCoverLetterOutput(output);

        // --- Save to History --- 
        chrome.storage.local.get('selectedFont', (result) => {
           const fontUsed: 'times' | 'helvetica' = (result.selectedFont === 'helvetica') ? 'helvetica' : 'times';
           const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
           
           let determinedFilename: string;
           if (pdfFilename.trim()) {
             determinedFilename = `${pdfFilename.trim().replace(/\.pdf$/i, '')}.pdf`;
           } else if (useCustomDefaultFilename && customDefaultFilename.trim()) {
             determinedFilename = `${customDefaultFilename.trim().replace(/\.pdf$/i, '')}.pdf`;
           } else {
             determinedFilename = `cover_letter_${timestamp}.pdf`;
           }
           
           onGenerationComplete({
             content: output,
             font: fontUsed,
             filename: determinedFilename
           });

           if(autoDownload && output) {
              const doc = generatePDF(output, fontUsed); 
              doc.save(determinedFilename);
           }
        });

     } catch (err: any) {
         console.error("Generate Automatic Error:", err);
          if (err.message.includes("API key") || err.message.includes("Rate limit") || err.message.includes("quota")) {
             setApiKeyError(err.message);
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
       {useAdditionalContext && (
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
       )}

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
                   <Label htmlFor="api-key-input" className="text-base font-medium">
                     {selectedModel.startsWith('openai') ? 'OpenAI API Key' : 'Google Gemini API Key'}
                   </Label>
                   
                   {/* Conditional Rendering based on apiKey existence and editing state */}                  
                   {/* Show display mode ONLY if a valid key is saved AND we are not editing */}
                   {hasSavedApiKey && !isEditingApiKey ? (
                     // Display Mode: Show masked key + Edit/Delete buttons
                     <div className="flex items-center space-x-2">
                       <KeyRound className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                       <span className="flex-grow p-2 border rounded-md bg-muted text-muted-foreground text-sm font-mono overflow-hidden text-ellipsis whitespace-nowrap min-w-0">
                         {selectedModel.startsWith('openai') 
                           ? `sk-${apiKey.slice(3, 10)}${'•'.repeat(Math.max(0, apiKey.length - 10))}`
                           : `${apiKey.slice(0, 7)}${'•'.repeat(Math.max(0, apiKey.length - 7))}`}
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
                                    chrome.storage.local.remove(selectedModel.startsWith('openai') ? 'openaiApiKey' : 'geminiApiKey', () => {
                                      if (chrome.runtime.lastError) {
                                        console.error('Error deleting API key:', chrome.runtime.lastError);
                                        setApiKeyError('Failed to delete API key.');
                                      } else {
                                        setApiKey('');
                                        setApiKeyError('');
                                        setIsEditingApiKey(false); // Ensure we exit edit mode
                                        setHasSavedApiKey(false); // Mark that no valid key is saved anymore
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
                         placeholder={selectedModel.startsWith('openai') 
                           ? "Enter your OpenAI API Key (sk-...)"
                           : "Enter your Google Gemini API Key"}
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
                           // Disable save if input is empty OR if it's invalid format
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
                 <div className="mt-4">
                   {/* Optional Filename Input */}
                   <div className="mb-4 space-y-1.5">
                     <Label htmlFor="pdf-filename" className="text-xs text-muted-foreground">
                       Optional PDF Filename (leave blank for default)
                     </Label>
                     <Input
                       id="pdf-filename"
                       type="text"
                       placeholder="My Custom Cover Letter"
                       value={pdfFilename}
                       onChange={(e) => setPdfFilename(e.target.value)}
                       className="h-8 text-sm bg-white"
                       disabled={isGeneratingAutomatic} // Disable during generation
                     />
                   </div>

                   {/* Original Generate Button */}
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
                                     onClick={() => {
                                        // Retrieve font setting before generating PDF
                                        chrome.storage.local.get('selectedFont', (result) => {
                                            const fontToUse: 'times' | 'helvetica' = (result.selectedFont === 'helvetica') ? 'helvetica' : 'times';
                                            const doc = generatePDF(generatedCoverLetterOutput, fontToUse);
                                            // Determine filename
                                            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                                            // --- Filename Logic with updated priority ---
                                            let determinedFilename: string;
                                            if (pdfFilename.trim()) {
                                              // Priority 1: Optional filename input provided
                                              determinedFilename = `${pdfFilename.trim().replace(/\.pdf$/i, '')}.pdf`;
                                            } else if (useCustomDefaultFilename && customDefaultFilename.trim()) {
                                              // Priority 2: Custom default filename setting enabled and set
                                              determinedFilename = `${customDefaultFilename.trim().replace(/\.pdf$/i, '')}.pdf`; // NO timestamp
                                            } else {
                                              // Priority 3: Fallback to hardcoded default + timestamp
                                              determinedFilename = `cover_letter_${timestamp}.pdf`;
                                            }
                                            // -------------------------------------------
                                            doc.save(determinedFilename); // Use the determined filename
                                        });
                                     }}
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
                       {/* Optional Filename Input - REMOVED FROM HERE */}
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