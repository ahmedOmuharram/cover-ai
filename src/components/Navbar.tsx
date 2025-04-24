import React from 'react';
import './Navbar.css';

export type ActiveView = 'upload' | 'view' | 'settings' | 'generate' | 'automatic';

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
        className={getItemClass('generate')} 
        onClick={() => onNavClick('generate')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onNavClick('generate')}
      >
        Generate Prompt
        <span className="underline"></span>
      </div>
      <div 
        className={getItemClass('automatic')}
        onClick={() => onNavClick('automatic')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onNavClick('automatic')}
      >
        Automatic
        <span className="underline"></span>
      </div>
      <div 
        className={getItemClass('view')}
        onClick={() => onNavClick('view')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onNavClick('view')}
      >
        My Letters
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