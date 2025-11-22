import React from 'react';
import { NewsArticle } from '../types';

interface HistorySidebarProps {
    isOpen: boolean;
    onClose: () => void;
    history: NewsArticle[];
    onLoadArticle: (article: NewsArticle) => void;
}

export const HistorySidebar: React.FC<HistorySidebarProps> = ({ isOpen, onClose, history, onLoadArticle }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
            <div className="w-80 bg-slate-900 border-l border-slate-800 h-full p-6 overflow-y-auto animate-fade-in">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-xl">Historial</h3>
                    <button onClick={onClose}>✕</button>
                </div>
                <div className="space-y-4">
                    {history.map(h => (
                        <div key={h.id} onClick={() => onLoadArticle(h)} className="bg-slate-800 p-3 rounded-lg cursor-pointer hover:bg-slate-700 transition-colors">
                            <div className="text-xs text-indigo-400 mb-1">{new Date(h.createdAt).toLocaleDateString()}</div>
                            <h4 className="font-bold text-sm line-clamp-2 mb-1">{h.title}</h4>
                            <div className="flex gap-2 text-[10px] text-slate-500">
                                <span>{h.language.toUpperCase()}</span>
                                <span>•</span>
                                <span>{h.media.length} media</span>
                            </div>
                        </div>
                    ))}
                    {history.length === 0 && <p className="text-slate-500 text-center py-8">No hay historial reciente.</p>}
                </div>
            </div>
        </div>
    );
};
