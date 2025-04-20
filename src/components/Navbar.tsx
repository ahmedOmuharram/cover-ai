import React from 'react';
import './Navbar.css';

export type ActiveView = 'upload' | 'view' | 'settings' | 'generate';

interface NavbarProps {
  activeView: ActiveView;
  onNavClick: (view: ActiveView) => void;
}

const Navbar: React.FC<NavbarProps> = ({ activeView, onNavClick }) => {
  const getItemClass = (view: ActiveView) => {
    return `nav-item ${activeView === view ? 'active' : ''}`;
  };

  return (
    <nav className="navbar">
      <div 
        className={getItemClass('upload')} 
        onClick={() => onNavClick('upload')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onNavClick('upload')}
      >
        Upload CL
        <span className="underline"></span>
      </div>
      <div 
        className={getItemClass('view')}
        onClick={() => onNavClick('view')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onNavClick('view')}
      >
        View Letters
        <span className="underline"></span>
      </div>
      <div 
        className={getItemClass('generate')} 
        onClick={() => onNavClick('generate')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onNavClick('generate')}
      >
        Generate
        <span className="underline"></span>
      </div>
      <div 
        className={getItemClass('settings')} 
        onClick={() => onNavClick('settings')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onNavClick('settings')}
      >
        Settings
        <span className="underline"></span>
      </div>
    </nav>
  );
};

export default Navbar; 