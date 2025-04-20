import React from 'react';
import './Navbar.css';

export type ActiveView = 'upload' | 'view' | 'settings' | 'generate';

interface NavbarProps {
  activeView: ActiveView;
  onNavClick: (view: ActiveView) => void;
}

const Navbar: React.FC<NavbarProps> = ({ activeView, onNavClick }) => {
  const getButtonClass = (view: ActiveView) => {
    return `nav-button ${activeView === view ? 'active' : ''}`;
  };

  return (
    <nav className="navbar">
      <button 
        className={getButtonClass('generate')} 
        onClick={() => onNavClick('generate')}
      >
        Generate
      </button>
      <button 
        className={getButtonClass('view')}
        onClick={() => onNavClick('view')}
      >
        Files
      </button>
      <button 
        className={getButtonClass('settings')} 
        onClick={() => onNavClick('settings')}
      >
        Settings
      </button>
    </nav>
  );
};

export default Navbar; 