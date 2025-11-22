import React from 'react';

interface EmbedModalProps {
    isOpen: boolean;
    onClose: () => void;
    embedCode: string;
}

export const EmbedModal: React.FC<EmbedModalProps> = ({ isOpen, onClose, embedCode }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg">Embed Code</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
                </div>
                <p className="text-sm text-slate-400 mb-4">Copia este código HTML para insertar el artículo en tu CMS o sitio web.</p>
                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-xs text-indigo-300 overflow-x-auto mb-4">
                    {embedCode}
                </div>
                <button 
                    onClick={() => {navigator.clipboard.writeText(embedCode); alert("Código copiado!");}}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg font-bold"
                >
                    Copiar HTML
                </button>
            </div>
        </div>
    );
};
