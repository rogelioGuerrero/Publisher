import React from 'react';

interface CodeBlockProps {
  code: string;
  label?: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ code, label }) => {
  return (
    <div className="rounded-lg overflow-hidden border border-slate-700 bg-slate-950 my-4">
      {label && (
        <div className="bg-slate-800 px-4 py-2 text-xs font-mono text-slate-400 border-b border-slate-700 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            {label}
        </div>
      )}
      <pre className="p-4 overflow-x-auto text-sm font-mono text-indigo-300">
        <code>{code}</code>
      </pre>
    </div>
  );
};