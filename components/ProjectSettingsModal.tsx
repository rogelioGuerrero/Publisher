import React, { useEffect, useState } from 'react';
import { ProjectConfig, NewsApiProvider } from '../types';

interface ProjectSettingsModalProps {
    isOpen: boolean;
    initialConfig: ProjectConfig;
    onClose: () => void;
    onSave: (config: ProjectConfig) => void;
}

const parseList = (value: string) => value
    .split(/\n|,/)
    .map(item => item.trim())
    .filter(Boolean);

const formatList = (items: string[]) => items.join('\n');

export const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({ isOpen, initialConfig, onClose, onSave }) => {
    const [geminiKey, setGeminiKey] = useState('');
    const [pexelsKey, setPexelsKey] = useState('');
    const [gnewsKey, setGnewsKey] = useState('');
    const [apinewsKey, setApinewsKey] = useState('');
    const [preferredProvider, setPreferredProvider] = useState<NewsApiProvider>('gnews');
    const [preferredDomains, setPreferredDomains] = useState('');
    const [blockedDomains, setBlockedDomains] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        setGeminiKey(initialConfig.geminiApiKey || '');
        setPexelsKey(initialConfig.pexelsApiKey || '');
        setGnewsKey(initialConfig.gnewsApiKey || '');
        setApinewsKey(initialConfig.apinewsApiKey || '');
        setPreferredProvider(initialConfig.preferredNewsProvider || 'gnews');
        setPreferredDomains(formatList(initialConfig.preferredDomains || []));
        setBlockedDomains(formatList(initialConfig.blockedDomains || []));
    }, [isOpen, initialConfig]);

    if (!isOpen) return null;

    const handleSave = () => {
        onSave({
            geminiApiKey: geminiKey.trim(),
            pexelsApiKey: pexelsKey.trim(),
            gnewsApiKey: gnewsKey.trim(),
            apinewsApiKey: apinewsKey.trim(),
            preferredNewsProvider: preferredProvider,
            preferredDomains: parseList(preferredDomains),
            blockedDomains: parseList(blockedDomains)
        });
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-xl font-bold text-white">Configuración del Proyecto</h3>
                        <p className="text-sm text-slate-400">Estas claves y dominios se guardan solo en tu navegador.</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    <label className="space-y-2">
                        <span className="text-xs uppercase font-bold text-slate-500">Gemini API Key</span>
                        <input 
                            type="text"
                            value={geminiKey}
                            onChange={(e) => setGeminiKey(e.target.value)}
                            placeholder="Ej: AIza..."
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                        />
                    </label>

                    <label className="space-y-2">
                        <span className="text-xs uppercase font-bold text-slate-500">Pexels API Key</span>
                        <input 
                            type="text"
                            value={pexelsKey}
                            onChange={(e) => setPexelsKey(e.target.value)}
                            placeholder="Ej: 563492ad6f91700001000001..."
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                        />
                    </label>

                    <div className="border-t border-slate-700 pt-4">
                        <h4 className="text-sm font-semibold text-white mb-3">Fuentes de Noticias</h4>
                        
                        <label className="space-y-2">
                            <span className="text-xs uppercase font-bold text-slate-500">GNews API Key</span>
                            <input 
                                type="text"
                                value={gnewsKey}
                                onChange={(e) => setGnewsKey(e.target.value)}
                                placeholder="Ej: 2f8c4e..."
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                            />
                            <p className="text-[11px] text-slate-500">Obtén tu clave gratuita en gnews.io</p>
                        </label>

                        <label className="space-y-2 mt-3">
                            <span className="text-xs uppercase font-bold text-slate-500">APINews API Key (alternativa)</span>
                            <input 
                                type="text"
                                value={apinewsKey}
                                onChange={(e) => setApinewsKey(e.target.value)}
                                placeholder="Ej: 9d2a1b..."
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                            />
                        </label>

                        <label className="space-y-2 mt-3">
                            <span className="text-xs uppercase font-bold text-slate-500">Proveedor Preferido</span>
                            <select
                                value={preferredProvider}
                                onChange={(e) => setPreferredProvider(e.target.value as NewsApiProvider)}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                            >
                                <option value="gnews">GNews (recomendado)</option>
                                <option value="apinews">APINews</option>
                            </select>
                        </label>
                    </div>

                    <label className="space-y-2">
                        <span className="text-xs uppercase font-bold text-slate-500">Dominios Confiables</span>
                        <textarea
                            value={preferredDomains}
                            onChange={(e) => setPreferredDomains(e.target.value)}
                            placeholder="Un dominio por línea (ej: bbc.com)"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm h-32"
                        />
                        <p className="text-[11px] text-slate-500">La IA priorizará estos dominios al investigar.</p>
                    </label>

                    <label className="space-y-2">
                        <span className="text-xs uppercase font-bold text-slate-500">Dominios Bloqueados</span>
                        <textarea
                            value={blockedDomains}
                            onChange={(e) => setBlockedDomains(e.target.value)}
                            placeholder="Un dominio por línea"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm h-24"
                        />
                        <p className="text-[11px] text-slate-500">Nunca se citarán estas fuentes.</p>
                    </label>
                </div>

                <div className="flex justify-end gap-3">
                    <button onClick={onClose} className="btn btn-outline px-4 py-2">Cancelar</button>
                    <button onClick={handleSave} className="btn btn-primary px-6 py-2">Guardar</button>
                </div>
            </div>
        </div>
    );
};
