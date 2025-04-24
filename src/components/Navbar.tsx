import React from 'react';
import { cn } from "@/lib/utils"; // Import cn utility
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FileText, Bot, FolderArchive, Cog } from 'lucide-react'; // Import icons

export type ActiveView = 'upload' | 'view' | 'settings' | 'generate' | 'automatic';

interface NavbarProps {
  activeView: ActiveView;
  onNavClick: (view: ActiveView) => void;
}

const Navbar: React.FC<NavbarProps> = ({ activeView, onNavClick }) => {

  // Increase vertical padding inside button container
  const baseButtonClass = "p-2 rounded-md cursor-pointer transition-colors duration-150 ease-in-out flex items-center justify-center h-9 w-9"; // Changed back to p-2
  
  // Styles for the active nav item
  const activeButtonClass = "bg-primary text-primary-foreground";
  
  // Styles for inactive nav items (default text color + hover effect)
  const inactiveButtonClass = "text-muted-foreground hover:bg-accent hover:text-accent-foreground"; 

  return (
    // TooltipProvider wraps the whole navbar
    <TooltipProvider delayDuration={100}> 
      {/* Increase vertical padding on the navbar itself */}
      <nav className="navbar bg-card py-2 px-1 flex justify-around items-center flex-shrink-0 border-b"> {/* Changed p-1 to py-2 px-1 */} 
        
        {/* Generate Prompt Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                baseButtonClass, 
                activeView === 'generate' ? activeButtonClass : inactiveButtonClass
              )}
              onClick={() => onNavClick('generate')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onNavClick('generate')}
              aria-label="Generate Prompt" // Add aria-label for accessibility
            >
              <FileText className="h-5 w-5" /> {/* Icon */} 
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Generate Prompt</p>
          </TooltipContent>
        </Tooltip>

        {/* My Documents Button */} 
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                baseButtonClass, 
                activeView === 'view' ? activeButtonClass : inactiveButtonClass
              )}
              onClick={() => onNavClick('view')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onNavClick('view')}
              aria-label="My Documents"
            >
              <FolderArchive className="h-5 w-5" /> {/* Icon */} 
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>My Documents</p>
          </TooltipContent>
        </Tooltip>

        {/* Settings Button */} 
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                baseButtonClass, 
                activeView === 'settings' ? activeButtonClass : inactiveButtonClass
              )}
              onClick={() => onNavClick('settings')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onNavClick('settings')}
              aria-label="Settings"
            >
              <Cog className="h-5 w-5" /> {/* Icon */} 
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Settings</p>
          </TooltipContent>
        </Tooltip>

      </nav>
    </TooltipProvider>
  );
};

export default Navbar;