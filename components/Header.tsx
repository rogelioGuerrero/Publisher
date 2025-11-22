import React from 'react';

interface HeaderProps {
    theme: 'light' | 'dark';
    onToggleTheme: () => void;
    onReset: () => void;
    onOpenKeySettings: () => void;
    onShowHistory: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
    theme, 
    onToggleTheme, 
    onReset, 
    onOpenKeySettings, 
    onShowHistory 
}) => {
    return (
        <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40">
            <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2 cursor-pointer" onClick={onReset}>
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">N</div>
                    <h1 className="font-bold text-xl tracking-tight">Gener<span className="text-indigo-400">News</span></h1>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={onToggleTheme} 
                        className="p-2 rounded-full border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                        title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                    >
                        {theme === 'dark' ? '☀️' : '🌙'}
                    </button>
                    <button onClick={onOpenKeySettings} className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-full border border-slate-700 transition-colors flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                        API Key
                    </button>
                    <button onClick={onShowHistory} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    </button>
                </div>
            </div>
        </header>
    );
};
