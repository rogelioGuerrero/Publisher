import React from 'react';
import { ChartData } from '../types';

interface DataChartProps {
    data: ChartData;
}

export const DataChart: React.FC<DataChartProps> = ({ data }) => {
    if (!data || !data.values || data.values.length === 0) return null;

    const maxVal = Math.max(...data.values);

    return (
        <div className="my-8 p-6 bg-slate-800/50 rounded-xl border border-slate-700">
            <h4 className="text-sm font-bold text-indigo-400 uppercase mb-4 tracking-wider flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                {data.title}
            </h4>
            
            <div className="space-y-4">
                {data.labels.map((label, idx) => {
                    const value = data.values[idx];
                    const percentage = (value / maxVal) * 100;
                    
                    return (
                        <div key={idx} className="relative">
                            <div className="flex justify-between text-xs mb-1 text-slate-300">
                                <span className="font-medium">{label}</span>
                                <span className="font-mono">{value} {data.unit}</span>
                            </div>
                            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" 
                                    style={{ width: `${percentage}%` }}
                                ></div>
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="mt-4 text-[10px] text-slate-500 text-right">
                Generado por IA basado en datos del artículo
            </div>
        </div>
    );
};