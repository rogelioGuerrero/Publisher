import React, { useEffect, useState } from 'react';
import { ProjectConfig, AIProvider, ImageModel } from '../types';

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
    const [activeProvider, setActiveProvider] = useState<AIProvider>('gemini');
    const [geminiKey, setGeminiKey] = useState('');
    const [deepseekKey, setDeepseekKey] = useState('');
    const [pexelsKey, setPexelsKey] = useState('');
    const [preferredDomains, setPreferredDomains] = useState('');
    const [blockedDomains, setBlockedDomains] = useState('');
    const [imageModel, setImageModel] = useState<ImageModel>('gemini-2.5-flash-image');

    useEffect(() => {
        if (!isOpen) return;
        setActiveProvider(initialConfig.activeProvider || 'gemini');
        setGeminiKey(initialConfig.geminiApiKey || '');
        setDeepseekKey(initialConfig.deepseekApiKey || '');
        setPexelsKey(initialConfig.pexelsApiKey || '');
        setPreferredDomains(formatList(initialConfig.preferredDomains || []));
        setBlockedDomains(formatList(initialConfig.blockedDomains || []));
        setImageModel(initialConfig.imageModel || 'gemini-2.5-flash-image');
    }, [isOpen, initialConfig]);

    if (!isOpen) return null;

    const handleSave = () => {
        onSave({
            activeProvider,
            geminiApiKey: geminiKey.trim(),
            deepseekApiKey: deepseekKey.trim(),
            pexelsApiKey: pexelsKey.trim(),
            preferredDomains: parseList(preferredDomains),
            blockedDomains: parseList(blockedDomains),
            imageModel
        });
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl p-4 space-y-4 max-h-[90vh] overflow-hidden">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-xl font-bold text-white">Configuración del Proyecto</h3>
                        <p className="text-sm text-slate-400">Estas claves y dominios se guardan solo en tu navegador.</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
                </div>

                <div className="space-y-4 overflow-y-auto max-h-[70vh] pr-2">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <label className="space-y-2 md:col-span-2">
                            <span className="text-xs uppercase font-bold text-slate-500">Proveedor de IA Activo</span>
                            <select 
                                value={activeProvider}
                                onChange={(e) => setActiveProvider(e.target.value as AIProvider)}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                            >
                                <option value="gemini">Google Gemini</option>
                                <option value="deepseek">DeepSeek</option>
                            </select>
                        </label>

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
                            <span className="text-xs uppercase font-bold text-slate-500">DeepSeek API Key</span>
                            <input 
                                type="text"
                                value={deepseekKey}
                                onChange={(e) => setDeepseekKey(e.target.value)}
                                placeholder="Ej: sk-..."
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                            />
                        </label>

                        <label className="space-y-2 md:col-span-2">
                            <span className="text-xs uppercase font-bold text-slate-500">Pexels API Key</span>
                            <input 
                                type="text"
                                value={pexelsKey}
                                onChange={(e) => setPexelsKey(e.target.value)}
                                placeholder="Ej: 563492ad6f91700001000001..."
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                            />
                        </label>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <label className="space-y-2">
                            <span className="text-xs uppercase font-bold text-slate-500">Dominios Confiables</span>
                            <textarea
                                value={preferredDomains}
                                onChange={(e) => setPreferredDomains(e.target.value)}
                                placeholder="Un dominio por línea (ej: bbc.com)"
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm min-h-[160px]"
                            />
                            <p className="text-[11px] text-slate-500">La IA priorizará estos dominios al investigar.</p>
                        </label>

                        <label className="space-y-2">
                            <span className="text-xs uppercase font-bold text-slate-500">Modelo de Imagen</span>
                            <select
                                value={imageModel}
                                onChange={(e) => setImageModel(e.target.value as ImageModel)}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                            >
                                <option value="gemini-2.5-flash-image">Gemini 2.5 Flash Image</option>
                                <option value="gemini-3-pro-image-preview">Gemini 3 Pro Preview</option>
                                <option value="imagen-3-fast-generate-001">Imagen 3 Fast Generate</option>
                            </select>
                        </label>
    
                        <label className="space-y-2">
                            <span className="text-xs uppercase font-bold text-slate-500">Dominios Bloqueados</span>
                            <textarea
                                value={blockedDomains}
                                onChange={(e) => setBlockedDomains(e.target.value)}
                                placeholder="Un dominio por línea"
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm min-h-[130px]"
                            />
                            <p className="text-[11px] text-slate-500">Nunca se citarán estas fuentes.</p>
                        </label>
                    </div>
                </div>

                <div className="flex justify-end gap-3">
                    <button onClick={onClose} className="btn btn-outline px-4 py-2">Cancelar</button>
                    <button onClick={handleSave} className="btn btn-primary px-6 py-2">Guardar</button>
                </div>
            </div>
        </div>
    );
};
