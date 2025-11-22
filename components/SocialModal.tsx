import React from 'react';
import { MediaItem } from '../types';
import { getMediaSrc } from '../utils';

interface SocialModalProps {
    isOpen: boolean;
    onClose: () => void;
    platform: 'x' | 'linkedin' | 'facebook';
    onPlatformChange: (p: 'x' | 'linkedin' | 'facebook') => void;
    isGenerating: boolean;
    contentMap: { x: string; linkedin: string; facebook: string };
    onRegenerate: () => void;
    media: MediaItem[];
    shareUrl: string;
}

export const SocialModal: React.FC<SocialModalProps> = ({
    isOpen,
    onClose,
    platform,
    onPlatformChange,
    isGenerating,
    contentMap,
    onRegenerate,
    media,
    shareUrl
}) => {
    if (!isOpen) return null;

    const getSocialLabel = () => {
        if (platform === 'x') return 'X';
        if (platform === 'linkedin') return 'LinkedIn';
        return 'Facebook';
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl h-[80vh] flex flex-col">
                <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                    <h3 className="font-bold text-lg">Social Studio AI</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
                </div>
                
                {/* TABS */}
                <div className="flex border-b border-slate-800">
                    {(['x', 'linkedin', 'facebook'] as const).map(p => (
                        <button
                            key={p}
                            onClick={() => onPlatformChange(p)}
                            className={`flex-1 py-3 text-sm font-bold transition-colors relative ${platform === p ? 'text-white bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            {p === 'x' ? 'X (Twitter)' : p === 'linkedin' ? 'LinkedIn' : 'Facebook'}
                            {platform === p && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-500"></div>}
                        </button>
                    ))}
                </div>

                <div className="p-6 flex-1 overflow-y-auto">
                    {isGenerating ? (
                        <div className="flex items-center justify-center h-40">
                            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : (
                        <>
                            <label className="text-xs uppercase font-bold text-slate-500 mb-2 block">Texto Generado para {getSocialLabel()}</label>
                            <textarea 
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-4 text-slate-200 h-40 resize-none focus:ring-1 focus:ring-indigo-500 outline-none font-mono text-sm"
                                value={contentMap[platform]}
                                readOnly
                            />
                            <div className="flex justify-end mt-2">
                                <button onClick={onRegenerate} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                    Reescribir
                                </button>
                            </div>

                            <div className="mt-6">
                                <label className="text-xs uppercase font-bold text-slate-500 mb-2 block">Media para Adjuntar</label>
                                <div className="flex gap-2 overflow-x-auto pb-2">
                                    {media.slice(0, 4).map((m, i) => (
                                        <div key={i} className="w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden border border-slate-700 relative group">
                                            {m.type === 'video' ? <div className="w-full h-full bg-slate-800 flex items-center justify-center text-slate-500">Video</div> : <img src={getMediaSrc(m)} className="w-full h-full object-cover" alt="thumb" />}
                                            <a 
                                                href={getMediaSrc(m)} 
                                                download={`media-${i}.${m.mimeType.split('/')[1]}`}
                                                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white font-bold text-xs transition-opacity"
                                            >
                                                Descargar
                                            </a>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-[10px] text-slate-500 mt-1">* Descarga la imagen/video para adjuntarla manualmente en tu post.</p>
                            </div>
                        </>
                    )}
                </div>
                <div className="p-4 border-t border-slate-800 flex justify-end gap-3">
                    <button 
                        onClick={() => {navigator.clipboard.writeText(contentMap[platform]); alert("Texto copiado!");}}
                        className="px-4 py-2 border border-slate-600 rounded-lg hover:bg-slate-800 text-sm font-medium"
                    >
                        Copiar Texto
                    </button>
                    <a 
                        href={shareUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="px-4 py-2 bg-white text-slate-900 rounded-lg hover:bg-slate-200 text-sm font-bold flex items-center gap-2"
                    >
                        Abrir {getSocialLabel()} ↗
                    </a>
                </div>
            </div>
        </div>
    );
};
