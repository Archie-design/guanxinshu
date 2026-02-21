'use client';

import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { UploadCloud, FileText, ArrowLeft, Sparkles, X, AlertCircle, History, Save, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

interface SavedReport {
    id: string;
    title: string;
    report: string;
    createdAt: string;
}

export default function AnalysisPage() {
    const [files, setFiles] = useState<File[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [loadingStatus, setLoadingStatus] = useState<string>('');
    const [report, setReport] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    // Save & History State
    const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
    const [reportTitle, setReportTitle] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [compareWithHistory, setCompareWithHistory] = useState(false);
    const [viewingHistoryId, setViewingHistoryId] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const reportEndRef = useRef<HTMLDivElement>(null);

    // Fetch history on mount
    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const { getSavedAiReports } = await import('@/app/actions');
                const history = await getSavedAiReports();
                setSavedReports(history);
            } catch (err) {
                console.error('Failed to load history', err);
            }
        };
        fetchHistory();
    }, []);

    // Auto-scroll when report updates
    useEffect(() => {
        if (isAnalyzing && reportEndRef.current) {
            reportEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [report, isAnalyzing]);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            addFiles(Array.from(e.dataTransfer.files));
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            addFiles(Array.from(e.target.files));
        }
    };

    const addFiles = (newFiles: File[]) => {
        const validFiles = newFiles.filter(file => file.type === 'application/pdf');
        if (validFiles.length !== newFiles.length) {
            setError('請確保上傳的檔案皆為 PDF 格式。');
        } else {
            setError(null);
        }
        setFiles(prev => {
            const fileNames = prev.map(f => f.name);
            const addedFiles = validFiles.filter(f => !fileNames.includes(f.name));
            return [...prev, ...addedFiles];
        });
        setViewingHistoryId(null); // Clear history view if uploading new
    };

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleSaveReport = async () => {
        if (!report || !reportTitle.trim()) return;
        setIsSaving(true);
        try {
            const { saveAiReport } = await import('@/app/actions');
            const result = await saveAiReport(reportTitle.trim(), report);
            if (result.success) {
                setSaveSuccess(true);
                // Refresh list
                const { getSavedAiReports } = await import('@/app/actions');
                setSavedReports(await getSavedAiReports());
                setTimeout(() => setSaveSuccess(false), 3000);
            } else {
                throw new Error(result.error);
            }
        } catch (err: any) {
            setError(err.message || '儲存失敗');
        } finally {
            setIsSaving(false);
        }
    };

    const loadHistoryReport = (id: string) => {
        const found = savedReports.find(r => r.id === id);
        if (found) {
            setViewingHistoryId(id);
            setReport(found.report);
            setError(null);
            setFiles([]); // Clear upload staging so user doesn't get confused
        }
    };

    const handleAnalyze = async () => {
        if (files.length === 0) return;
        setIsAnalyzing(true);
        setReport('');
        setError(null);
        setSaveSuccess(false);
        setReportTitle('');
        setViewingHistoryId(null);
        setLoadingStatus('準備資料中...');

        const sessionId = Date.now().toString() + Math.random().toString(36).substring(7);

        // Retrieve latest report if comparing
        let previousReportContent = null;
        if (compareWithHistory && savedReports.length > 0) {
            previousReportContent = savedReports[0].report;
        }

        const fileToBase64 = (file: File): Promise<string> => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve((reader.result as string).split(',')[1]);
                reader.onerror = reject;
            });
        };

        try {
            // 1. Upload chunks
            for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
                setLoadingStatus(`上傳並處理紀錄中 (${fileIndex + 1}/${files.length})...`);
                const file = files[fileIndex];
                const base64 = await fileToBase64(file);
                const CHUNK_SIZE = 3 * 1024 * 1024; // 3MB base64 per chunk payload (safe under 10MB limit)
                const chunkCount = Math.ceil(base64.length / CHUNK_SIZE);

                for (let i = 0; i < chunkCount; i++) {
                    const chunk = base64.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
                    const res = await fetch('/api/analyze/upload', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            sessionId,
                            fileIndex,
                            mimeType: file.type || 'application/pdf',
                            chunkIndex: i,
                            chunkCount,
                            data: chunk
                        })
                    });
                    if (!res.ok) {
                        const err = await res.json().catch(() => ({}));
                        throw new Error(err.error || '上傳檔案區塊時發生錯誤');
                    }
                }
            }

            // 2. Execute Analysis Stream
            setLoadingStatus('資料已就緒。AI 諮商師正在仔細閱讀您的日記，這可能需要一到兩分鐘的時間，請稍候...');
            const response = await fetch('/api/analyze/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, previousReportContent }) // Pass previous report
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || `HTTP error! status: ${response.status}`);
            }

            if (!response.body) throw new Error('您的瀏覽器不支援 ReadableStream。');

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                if (loadingStatus) setLoadingStatus(''); // Clear status when stream starts
                const chunk = decoder.decode(value, { stream: true });
                setReport(prev => prev + chunk);
            }

        } catch (err: any) {
            console.error('Analysis error:', err);
            setError(err.message || '分析過程中發生錯誤，請稍後再試。');
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50/50 via-slate-50 to-purple-50/50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-white/70 backdrop-blur-xl border-b border-white/20 shadow-[0_4px_30px_rgba(0,0,0,0.03)] px-5 py-4">
                <div className="max-w-4xl mx-auto flex items-center">
                    <Link href="/admin" className="p-2.5 bg-white shadow-sm hover:shadow-md hover:scale-105 active:scale-95 rounded-full transition-all mr-4 border border-slate-100/50">
                        <ArrowLeft className="w-5 h-5 text-slate-600" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center">
                            AI 觀心綜合分析
                            <Sparkles className="w-5 h-5 ml-2 text-purple-500 animate-pulse" />
                        </h1>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">上傳過去的紀錄，讓 AI 為您的成長萃取精華</p>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto p-5 py-8 flex flex-col lg:flex-row gap-8 items-start">

                {/* Left/Top Content Area */}
                <div className="flex-1 w-full space-y-8">
                    {/* Error Banner */}
                    {error && (
                        <div className="bg-rose-50/80 backdrop-blur-sm border border-rose-100 text-rose-600 px-5 py-4 rounded-2xl flex items-start shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
                            <AlertCircle className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                                <h3 className="text-sm font-bold">發生錯誤</h3>
                                <p className="text-xs mt-1 text-rose-500/90">{error}</p>
                            </div>
                            <button onClick={() => setError(null)} className="p-1 hover:bg-rose-100 rounded-lg transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    {/* Upload Section - Only show if not viewing history */}
                    {!viewingHistoryId && (
                        <section className="bg-white/60 backdrop-blur-md rounded-[2.5rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white">
                            <div
                                className={`relative group flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-[2rem] transition-all duration-300 ${isDragging
                                    ? 'border-indigo-400 bg-indigo-50/50 scale-[1.02]'
                                    : 'border-indigo-100 hover:border-indigo-300 hover:bg-indigo-50/30'
                                    }`}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-purple-500/5 rounded-[2rem] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                                <div className="w-20 h-20 bg-white shadow-xl shadow-indigo-100/50 rounded-full flex items-center justify-center mb-6 transform group-hover:-translate-y-2 transition-transform duration-300">
                                    <UploadCloud className="w-10 h-10 text-indigo-500" />
                                </div>
                                <h3 className="text-lg font-black text-slate-800 mb-2">上傳觀心書 PDF</h3>
                                <p className="text-sm text-slate-500 text-center max-w-sm mb-6">
                                    支援多檔上傳。拖曳檔案至此，或點擊下方按鈕選擇您的紀錄檔案。
                                </p>

                                <input
                                    type="file"
                                    multiple
                                    accept=".pdf"
                                    className="hidden"
                                    ref={fileInputRef}
                                    onChange={handleFileSelect}
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="px-8 py-3.5 bg-slate-900 text-white font-bold rounded-2xl shadow-lg shadow-slate-900/20 hover:shadow-xl hover:shadow-slate-900/30 hover:-translate-y-0.5 active:scale-95 transition-all w-full sm:w-auto"
                                >
                                    選擇檔案
                                </button>
                            </div>

                            {/* File List */}
                            {files.length > 0 && (
                                <div className="mt-8">
                                    <h4 className="text-sm font-bold text-slate-800 mb-4 px-2">已選擇的檔案 ({files.length})</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {files.map((file, idx) => (
                                            <div key={idx} className="group flex items-center p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
                                                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center mr-3 text-indigo-500 flex-shrink-0">
                                                    <FileText className="w-5 h-5" />
                                                </div>
                                                <div className="flex-1 min-w-0 pr-3">
                                                    <p className="text-sm font-bold text-slate-700 truncate">{file.name}</p>
                                                    <p className="text-xs text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                                </div>
                                                <button
                                                    onClick={() => removeFile(idx)}
                                                    className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors opacity-0 group-hover:opacity-100"
                                                    title="移除檔案"
                                                >
                                                    <X className="w-5 h-5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Compare with history option */}
                                    {savedReports.length > 0 && (
                                        <div className="mt-6 flex items-center bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/50 transition-colors hover:bg-indigo-50/80 cursor-pointer" onClick={() => setCompareWithHistory(!compareWithHistory)}>
                                            <input
                                                type="checkbox"
                                                className="w-5 h-5 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 bg-white cursor-pointer mr-3"
                                                checked={compareWithHistory}
                                                onChange={(e) => setCompareWithHistory(e.target.checked)}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                            <div className="flex-1">
                                                <p className="text-sm font-bold text-indigo-900 cursor-pointer">💡 與上一份報告進行跨期比較</p>
                                                <p className="text-xs text-indigo-600/80 mt-0.5 pointer-events-none">AI 將會參照您最新一份存檔的歷史報告，點出您的成長與改變。</p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="mt-8 flex justify-center">
                                        <button
                                            onClick={handleAnalyze}
                                            disabled={isAnalyzing}
                                            className={`relative overflow-hidden group px-10 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-500/25 hover:shadow-2xl hover:shadow-indigo-500/40 transition-all ${isAnalyzing ? 'opacity-90 cursor-not-allowed scale-[0.98]' : 'hover:-translate-y-1 active:scale-95'
                                                }`}
                                        >
                                            {/* Shine effect */}
                                            <div className="absolute inset-0 -translate-x-[100%] group-hover:animate-[shine_1.5s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12" />

                                            <span className="relative flex items-center text-lg">
                                                {isAnalyzing ? (
                                                    <>
                                                        <div className="mr-3 flex space-x-1">
                                                            <div className="w-2 h-2 bg-indigo-200 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                                            <div className="w-2 h-2 bg-indigo-200 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                                            <div className="w-2 h-2 bg-indigo-200 rounded-full animate-bounce"></div>
                                                        </div>
                                                        <span className="text-sm font-medium">{loadingStatus || '正在分析...'}</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Sparkles className="w-6 h-6 mr-2" />
                                                        開始綜合分析
                                                    </>
                                                )}
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </section>
                    )}

                    {/* Report Section */}
                    {(report || isAnalyzing) && (
                        <section className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] p-6 sm:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-white">

                            {viewingHistoryId && (
                                <div className="mb-6 flex items-center justify-between pb-6 border-b border-slate-100">
                                    <div className="flex items-center text-indigo-600 bg-indigo-50 px-4 py-2 rounded-xl text-sm font-bold">
                                        <History className="w-4 h-4 mr-2" />
                                        <span>觀看歷史檔案：{savedReports.find(r => r.id === viewingHistoryId)?.title}</span>
                                    </div>
                                    <button onClick={() => { setViewingHistoryId(null); setReport(''); }} className="text-sm text-slate-500 hover:text-slate-800 font-medium px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">
                                        清空畫面，準備新分析
                                    </button>
                                </div>
                            )}

                            <div className="prose prose-slate prose-img:rounded-2xl prose-headings:font-black prose-h1:text-indigo-800 prose-h2:text-indigo-700 prose-h3:text-indigo-600 prose-a:text-indigo-600 hover:prose-a:text-indigo-500 prose-strong:text-purple-700 prose-li:marker:text-indigo-400 prose-p:leading-relaxed prose-p:text-slate-700 max-w-none">
                                {report ? (
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {report}
                                    </ReactMarkdown>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-20 text-indigo-400">
                                        <Sparkles className="w-12 h-12 mb-6 animate-pulse opacity-60 text-indigo-400" />
                                        <p className="text-sm font-bold tracking-widest uppercase mb-2">準備接收報告</p>
                                        <p className="text-xs text-indigo-400/80 max-w-xs text-center">{loadingStatus}</p>
                                    </div>
                                )}
                                <div ref={reportEndRef} />
                            </div>

                            {/* Save Report Form (only show when a new report is generated completely and not viewing history) */}
                            {report && !isAnalyzing && !viewingHistoryId && (
                                <div className="mt-12 pt-8 border-t border-slate-200">
                                    <div className="bg-indigo-50/50 rounded-2xl p-6 border border-indigo-100/50">
                                        <h4 className="text-indigo-900 font-bold mb-2 flex items-center">
                                            <Save className="w-5 h-5 mr-2" />
                                            儲存這份分析報告
                                        </h4>
                                        <p className="text-sm text-indigo-700/70 mb-4">將這次的面談存檔，未來就可以讓 AI 進行跨期成長比較！</p>

                                        <div className="flex flex-col sm:flex-row gap-3">
                                            <input
                                                type="text"
                                                placeholder="例如：2024 年 2 月紀錄"
                                                value={reportTitle}
                                                onChange={(e) => setReportTitle(e.target.value)}
                                                className="flex-1 px-4 py-3 rounded-xl border-slate-200 focus:border-indigo-500 focus:ring focus:ring-indigo-200 transition-all font-medium text-slate-700"
                                            />
                                            <button
                                                onClick={handleSaveReport}
                                                disabled={isSaving || !reportTitle.trim()}
                                                className={`px-6 py-3 rounded-xl font-bold flex items-center justify-center transition-all ${saveSuccess
                                                        ? 'bg-emerald-500 text-white'
                                                        : isSaving || !reportTitle.trim()
                                                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                                            : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md hover:shadow-lg hover:-translate-y-0.5'
                                                    }`}
                                            >
                                                {saveSuccess ? (
                                                    <><CheckCircle2 className="w-5 h-5 mr-2" /> 已儲存</>
                                                ) : isSaving ? (
                                                    '儲存中...'
                                                ) : (
                                                    '儲存報告'
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </section>
                    )}
                </div>

                {/* Right Sidebar - History Reports */}
                <div className="w-full lg:w-80 flex-shrink-0">
                    <section className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-white sticky top-24">
                        <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center">
                            <History className="w-5 h-5 mr-2 text-indigo-500" />
                            歷史分析紀錄
                        </h3>

                        {savedReports.length === 0 ? (
                            <div className="text-center py-10">
                                <FileText className="w-8 h-8 text-slate-200 mx-auto mb-3" />
                                <p className="text-sm text-slate-400 font-medium">還沒有任何紀錄</p>
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-[calc(100vh-250px)] overflow-y-auto pr-2 custom-scrollbar">
                                {savedReports.map((item) => (
                                    <button
                                        key={item.id}
                                        onClick={() => loadHistoryReport(item.id)}
                                        className={`w-full text-left p-4 rounded-2xl border transition-all ${viewingHistoryId === item.id
                                                ? 'border-indigo-500 bg-indigo-50/50 shadow-sm'
                                                : 'border-slate-100 hover:border-indigo-200 hover:bg-slate-50'
                                            }`}
                                    >
                                        <p className="font-bold text-slate-800 truncate">{item.title}</p>
                                        <p className="text-xs text-slate-400 mt-1">
                                            {new Date(item.createdAt).toLocaleDateString('zh-TW', {
                                                year: 'numeric', month: 'long', day: 'numeric',
                                                hour: '2-digit', minute: '2-digit'
                                            })}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            </main>
        </div>
    );
}
