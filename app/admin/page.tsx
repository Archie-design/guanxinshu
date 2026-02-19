'use client';

import React, { useState, useEffect } from 'react';
import {
    ChevronLeft,
    Search,
    Calendar,
    Trophy,
    AlertCircle,
    ArrowLeft,
    TrendingUp,
    ListFilter
} from 'lucide-react';
import { getJournalStats, searchJournalEntries, getMissingDates, getDebugInfo } from '@/app/actions';
import Link from 'next/link';

export default function AdminDashboard() {
    const [stats, setStats] = useState<any>(null);
    const [missingDates, setMissingDates] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [loading, setLoading] = useState(true);
    const [debugInfo, setDebugInfo] = useState<any>(null);

    useEffect(() => {
        async function loadData() {
            const [s, m, d] = await Promise.all([
                getJournalStats(),
                getMissingDates(),
                getDebugInfo()
            ]);
            setStats(s);
            setMissingDates(m);
            setDebugInfo(d);
            setLoading(false);
        }
        loadData();
    }, []);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        const results = await searchJournalEntries(searchQuery);
        setSearchResults(results);
        setIsSearching(false);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#f8fafc]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto min-h-screen bg-[#f8fafc] text-slate-900 pb-20 font-sans">
            <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-100 px-5 py-4 flex items-center shadow-sm">
                <Link href="/" className="p-2 hover:bg-slate-50 rounded-full transition-colors mr-2">
                    <ArrowLeft className="w-6 h-6 text-slate-600" />
                </Link>
                <h1 className="text-xl font-black tracking-tight text-slate-800">數據後台</h1>
            </header>

            <main className="p-5 space-y-8">
                {/* 概覽統計 */}
                <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 flex flex-col items-center">
                        <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600 mb-3">
                            <Trophy className="w-6 h-6" />
                        </div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">當前連續</span>
                        <span className="text-3xl font-black text-slate-800">{stats?.currentStreak || 0} 天</span>
                    </div>
                    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 flex flex-col items-center">
                        <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 mb-3">
                            <TrendingUp className="w-6 h-6" />
                        </div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">最高紀錄</span>
                        <span className="text-3xl font-black text-slate-800">{stats?.longestStreak || 0} 天</span>
                    </div>
                    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 flex flex-col items-center">
                        <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 mb-3">
                            <Calendar className="w-6 h-6" />
                        </div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">總撰寫天數</span>
                        <span className="text-3xl font-black text-slate-800">{stats?.totalDays || 0} 天</span>
                    </div>
                </section>

                {/* 關鍵字搜尋 */}
                <section className="bg-white p-7 rounded-[2.5rem] shadow-sm border border-slate-50">
                    <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center">
                        <Search className="w-5 h-5 mr-3 text-indigo-500" /> 關鍵字搜尋
                    </h2>
                    <form onSubmit={handleSearch} className="relative mb-6">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="輸入關鍵字搜尋觀心筆記..."
                            className="w-full p-4 pl-12 bg-slate-50 rounded-2xl outline-none text-base focus:ring-2 focus:ring-indigo-100 transition-all border border-slate-100"
                        />
                        <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                        <button
                            type="submit"
                            className="absolute right-2 top-1/2 -translate-y-1/2 h-10 px-6 bg-slate-900 text-white text-xs font-bold rounded-xl active:scale-95 transition-all"
                        >
                            搜尋
                        </button>
                    </form>

                    <div className="space-y-4">
                        {isSearching ? (
                            <div className="text-center py-8 text-slate-400">正在搜尋中...</div>
                        ) : searchResults.length > 0 ? (
                            searchResults.map((res, i) => (
                                <Link
                                    key={i}
                                    href={`/?date=${res.date}`}
                                    className="block p-4 bg-slate-50 rounded-2xl hover:bg-indigo-50 transition-colors border border-transparent hover:border-indigo-100"
                                >
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-sm font-black text-indigo-600">{res.date}</span>
                                    </div>
                                    <p className="text-xs text-slate-500 line-clamp-2">{res.preview}</p>
                                </Link>
                            ))
                        ) : searchQuery && !isSearching ? (
                            <div className="text-center py-8 text-slate-400">找不到相關結果</div>
                        ) : (
                            <div className="text-center py-8 text-slate-300 text-sm italic">輸入關鍵字開始搜尋最近的覺察</div>
                        )}
                    </div>
                </section>

                {/* 漏寫日期 */}
                <section className="bg-white p-7 rounded-[2.5rem] shadow-sm border border-slate-50">
                    <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center">
                        <AlertCircle className="w-5 h-5 mr-3 text-rose-500" /> 漏寫提醒 (最近 30 天)
                    </h2>
                    {missingDates.length > 0 ? (
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                            {missingDates.map(date => (
                                <Link
                                    key={date}
                                    href={`/?date=${date}`}
                                    className="py-3 px-2 bg-rose-50 text-rose-600 text-xs font-bold rounded-xl text-center border border-rose-100 hover:bg-rose-100 transition-colors"
                                >
                                    {date.split('-').slice(1).join('/')}
                                </Link>
                            ))}
                        </div>
                    ) : (stats?.totalDays === 0) ? (
                        <div className="text-center py-8 bg-slate-50 rounded-[2rem] border border-slate-100">
                            <p className="text-slate-500 font-bold mb-1">尚未開始紀錄</p>
                            <p className="text-slate-400 text-xs">開始您的第一篇觀心書，數據將會顯示於此。</p>
                        </div>
                    ) : (
                        <div className="text-center py-8 bg-emerald-50 rounded-[2rem] border border-emerald-100">
                            <p className="text-emerald-700 font-bold mb-1">太棒了！</p>
                            <p className="text-emerald-600 text-xs">最近 30 天您沒有漏掉任何一天的觀心紀錄。</p>
                        </div>
                    )}
                </section>

                {/* 除錯資訊 */}
                <div className="text-center pb-8 opacity-50 hover:opacity-100 transition-opacity">
                    <p className="text-[10px] text-slate-400 font-mono">
                        User ID: {debugInfo?.userId || 'N/A'} <br />
                        Visible Rows: {debugInfo?.count ?? 'Error'}
                        {debugInfo?.error && <span className="text-rose-500 block">Error: {debugInfo.error}</span>}
                    </p>
                </div>
            </main>
        </div>
    );
}
