'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Heart,
  Zap,
  ShieldCheck,
  Copy,
  Settings,
  Brain,
  MessageSquare,
  User,
  Save,
  Quote,
  X,
  LogOut,
  Mail // Added Mail icon for Google
} from 'lucide-react';
import { getJournalEntry, getRecordedDates, saveJournalEntry } from './actions';
import { createClient } from '@/utils/supabase/client';
import { supabase } from '@/lib/supabase';

// --- 配置與常數 ---
const QUOTES = [
  "「覺察，是改變的開始。」",
  "「定於心，穩於行，觀於意。」",
  "「每一口呼吸都是與靈魂的重新連結。」",
  "「心若安定，世界便不再嘈雜。」",
  "「溫柔對待今日的疲憊，也是一種勇氣。」",
  "「在覺察中，看見真實的自己。」"
];

const THEMES = [
  {
    id: 'love',
    title: '付出愛',
    color: 'emerald',
    icon: <Heart className="w-5 h-5" />,
    label: 'Love & Compassion'
  },
  {
    id: 'steady',
    title: '穩',
    color: 'blue',
    icon: <ShieldCheck className="w-5 h-5" />,
    label: 'Stability & Mind'
  }
];

const SUB_FIELDS = [
  { id: 'body', title: '身', label: 'Physical Body', icon: <User className="w-4 h-4" /> },
  { id: 'speech', title: '語', label: 'Speech & Word', icon: <MessageSquare className="w-4 h-4" /> },
  { id: 'mind', title: '意', label: 'Mind & Intention', icon: <Brain className="w-4 h-4" /> }
];

interface FormData {
  [key: string]: string;
}

interface ShowModules {
  routine: boolean;
  gratitude: boolean;
}

export default function GuanXinShu() {
  // --- 狀態管理 ---
  const [apiUrl, setApiUrl] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState('');
  const [formData, setFormData] = useState<FormData>({});
  const [recordedDates, setRecordedDates] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [showModules, setShowModules] = useState<ShowModules>({ routine: false, gratitude: false });
  const [calendarView, setCalendarView] = useState<Date | null>(null);

  // --- 初始化 ---
  useEffect(() => {
    // Client-side only initialization
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Set state
    setCurrentDate(todayStr);
    setCalendarView(today);

    // Initial fetch
    fetchHistory();
  }, []);

  // --- 資料存取邏輯 ---
  const fetchHistory = async () => {
    try {
      const dates = await getRecordedDates();
      setRecordedDates(new Set(dates));
    } catch (e) {
      console.error("History fetch failed", e);
    }
  };

  const loadData = async (date: string) => {
    setIsLoading(true);
    try {
      const data = await getJournalEntry(date);
      if (data) {
        setFormData(data as unknown as FormData);
        // 智慧展開：如果該模組有內容則顯示
        const hasRoutine = data.routine_boxing || data.routine_wife;
        const hasGratitude = data.gratitude_1 || data.gratitude_2 || data.gratitude_3;
        setShowModules({ routine: !!hasRoutine, gratitude: !!hasGratitude });
      } else {
        setFormData({ logDate: date });
        setShowModules({ routine: false, gratitude: false });
      }
    } catch (e) {
      console.error("Load data failed", e);
      setFormData({ logDate: date });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const result = await saveJournalEntry(currentDate, formData);
      if (result && result.success) {
        alert('觀心紀錄已儲存 🌱');
        fetchHistory();
      } else {
        const errorMessage = result?.error || 'Unknown error';
        console.error('Save error:', errorMessage);
        alert(`儲存失敗: ${errorMessage}`);
      }
    } catch (e: any) {
      console.error("Save failed", e);
      alert(`儲存失敗: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // --- UI 組件與輔助函數 ---
  // Move quote selection to useEffect to avoid hydration mismatch
  const [quote, setQuote] = useState('');
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    setQuote(QUOTES[Math.floor(Math.random() * QUOTES.length)]);

    // Check session
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });
  }, []);

  const handleGoogleLogin = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
        },
      }
    });
  };

  const calendarDays = useMemo(() => {
    if (!calendarView) return [];
    const year = calendarView.getFullYear();
    const month = calendarView.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const days: (string | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= totalDays; d++) {
      days.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
    return days;
  }, [calendarView]);

  const handleInputChange = (key: string, val: string) => {
    setFormData(prev => ({ ...prev, [key]: val }));
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setFormData({});
    setRecordedDates(new Set());
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-4xl font-black text-slate-800 mb-2 tracking-tight">觀心書</h1>
        <p className="text-slate-500 mb-10 font-medium tracking-wide">每日覺察，安頓身心</p>
        <button
          onClick={handleGoogleLogin}
          className="bg-[#4285F4] text-white px-10 py-4 rounded-2xl font-bold flex items-center space-x-3 hover:bg-[#357ae8] transition-all shadow-xl active:scale-95"
        >
          <Mail className="w-6 h-6 fill-current" />
          <span className="text-lg">使用 Google 帳號登入</span>
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      {/* 載入狀態 */}
      {isLoading && (
        <div className="fixed inset-0 bg-white/60 backdrop-blur-sm z-[100] flex items-center justify-center">
          <Zap className="w-10 h-10 text-indigo-600 animate-bounce" />
        </div>
      )}

      {/* Header */}
      <header className="flex justify-between items-start mb-10">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter">觀心書</h1>
          <p className="text-slate-400 font-bold mt-2 flex items-center">
            <CalendarIcon className="w-4 h-4 mr-2" /> {currentDate}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {user.email && <span className="text-[10px] font-bold text-slate-300 uppercase hidden sm:block">{user.email.split('@')[0]}</span>}
          <button
            onClick={handleSignOut}
            className="p-3 bg-white rounded-2xl shadow-sm text-slate-400 hover:text-rose-500 hover:scale-105 active:scale-95 transition-all"
            title="登出"
          >
            <LogOut className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* 格言區 */}
      <div className="bg-indigo-50/50 p-8 rounded-[2rem] text-center mb-10 relative">
        <Quote className="absolute top-4 left-6 w-8 h-8 text-indigo-100" />
        <p className="italic text-indigo-900 font-medium leading-relaxed">{quote}</p>
      </div>

      {/* 日曆切換器 */}
      <section className="bg-white p-6 rounded-[2rem] border mb-10">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-black text-slate-800">
            {calendarView ? `${calendarView.getFullYear()}年 ${calendarView.getMonth() + 1}月` : '載入中...'}
          </h3>
          <div className="flex space-x-2">
            <button
              onClick={() => calendarView && setCalendarView(new Date(calendarView.getFullYear(), calendarView.getMonth() - 1, 1))}
              className="p-2 hover:bg-slate-100 rounded-lg"
              disabled={!calendarView}
            >
              <ChevronLeft />
            </button>
            <button
              onClick={() => calendarView && setCalendarView(new Date(calendarView.getFullYear(), calendarView.getMonth() + 1, 1))}
              className="p-2 hover:bg-slate-100 rounded-lg"
              disabled={!calendarView}
            >
              <ChevronRight />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-2 text-center">
          {['日', '一', '二', '三', '四', '五', '六'].map(d => <div key={d} className="text-[10px] font-black text-slate-300 uppercase">{d}</div>)}
          {calendarDays.map((dateStr, i) => dateStr ? (
            <div
              key={i}
              onClick={() => setCurrentDate(dateStr)}
              className={`aspect-square flex flex-col items-center justify-center rounded-2xl cursor-pointer transition-all text-sm font-bold relative
                ${currentDate === dateStr ? 'bg-indigo-600 text-white shadow-lg scale-110 z-10' : 'hover:bg-indigo-50 text-slate-600'}
              `}
            >
              {dateStr.split('-')[2]}
              {recordedDates.has(dateStr) && currentDate !== dateStr && <div className="absolute bottom-1.5 w-1 h-1 bg-indigo-400 rounded-full" />}
            </div>
          ) : <div key={i} />)}
        </div>
      </section>

      {/* 功能切換 */}
      <div className="flex gap-4 mb-10 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setShowModules(p => ({ ...p, routine: !p.routine }))}
          className={`px-6 py-3 rounded-2xl text-sm font-black transition-all border ${showModules.routine ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white text-slate-500'}`}
        >
          定課模組
        </button>
        <button
          onClick={() => setShowModules(p => ({ ...p, gratitude: !p.gratitude }))}
          className={`px-6 py-3 rounded-2xl text-sm font-black transition-all border ${showModules.gratitude ? 'bg-pink-50 border-pink-200 text-pink-600' : 'bg-white text-slate-500'}`}
        >
          五感恩
        </button>
      </div>

      <form className="space-y-10">
        {/* 定課 */}
        {showModules.routine && (
          <div className="bg-white p-8 rounded-[2rem] border-l-[8px] border-indigo-500 shadow-sm transition-all animate-in fade-in slide-in-from-top-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black text-indigo-900">定課執行</h2>
              <span className="text-[10px] font-black text-indigo-200 tracking-[0.3em]">DAILY DISCIPLINE</span>
            </div>
            <div className="space-y-6">
              <textarea
                placeholder="破曉打陰陽拳的覺受..."
                value={formData.routine_boxing || ''}
                onChange={e => handleInputChange('routine_boxing', e.target.value)}
                className="w-full p-5 bg-slate-50 border-none rounded-2xl outline-none text-sm min-h-[80px]"
              />
              <textarea
                placeholder="欣賞老婆的閃光點..."
                value={formData.routine_wife || ''}
                onChange={e => handleInputChange('routine_wife', e.target.value)}
                className="w-full p-5 bg-slate-50 border-none rounded-2xl outline-none text-sm min-h-[80px]"
              />
            </div>
          </div>
        )}
        {/* 五感恩 */}
        {showModules.gratitude && (
          <div className="bg-white p-8 rounded-[2rem] border-l-[8px] border-pink-500 shadow-sm transition-all animate-in fade-in slide-in-from-top-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black text-pink-900">五感恩</h2>
              <span className="text-[10px] font-black text-pink-200 tracking-[0.3em]">GRATITUDE</span>
            </div>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <input
                  key={i}
                  type="text"
                  placeholder={`感恩事項 ${i}...`}
                  value={formData[`gratitude_${i}`] || ''}
                  onChange={e => handleInputChange(`gratitude_${i}`, e.target.value)}
                  className="w-full p-4 bg-pink-50/50 rounded-xl outline-none text-sm border border-transparent focus:border-pink-200"
                />
              ))}
            </div>
          </div>
        )}
        {/* 核心內容：付出愛、穩 (均包含身語意) */}
        {THEMES.map(theme => (
          <section key={theme.id} className={`bg-white p-8 rounded-[2.5rem] border-t-[8px] border-${theme.color}-500 shadow-sm`}>
            <div className="flex items-center mb-10">
              <div className={`w-14 h-14 bg-${theme.color}-100 rounded-2xl flex items-center justify-center text-${theme.color}-600 mr-5 shadow-inner`}>
                {theme.icon}
              </div>
              <h2 className="text-3xl font-black tracking-tight">{theme.title}</h2>
            </div>

            <div className="space-y-12">
              {SUB_FIELDS.map(field => (
                <div key={field.id}>
                  <div className="flex justify-between items-center mb-4">
                    <span className={`flex items-center text-${theme.color}-600 font-black text-sm uppercase tracking-tight`}>
                      {React.cloneElement(field.icon, { className: 'mr-2 w-4 h-4' })}
                      ｜ {field.title} ｜
                    </span>
                    <span className="text-[10px] font-black text-slate-300 tracking-widest uppercase">{field.label}</span>
                  </div>
                  <div className="space-y-4">
                    <input
                      type="text"
                      placeholder="＋ 正向覺察"
                      value={formData[`${theme.id}_${field.id}_plus`] || ''}
                      onChange={e => handleInputChange(`${theme.id}_${field.id}_plus`, e.target.value)}
                      className={`w-full p-5 bg-${theme.color}-50/30 rounded-2xl outline-none text-sm border-2 border-transparent focus:border-${theme.color}-100`}
                    />
                    <input
                      type="text"
                      placeholder="－ 負向覺察"
                      value={formData[`${theme.id}_${field.id}_minus`] || ''}
                      onChange={e => handleInputChange(`${theme.id}_${field.id}_minus`, e.target.value)}
                      className="w-full p-5 bg-rose-50/30 rounded-2xl outline-none text-sm border-2 border-transparent focus:border-rose-100"
                    />
                    {formData[`${theme.id}_${field.id}_minus`] && (
                      <div className="pl-4 border-l-4 border-blue-400 animate-in slide-in-from-left duration-300 mt-2">
                        <input
                          type="text"
                          placeholder="🎯 明日的調整方案"
                          value={formData[`${theme.id}_${field.id}_todo`] || ''}
                          onChange={e => handleInputChange(`${theme.id}_${field.id}_todo`, e.target.value)}
                          className="w-full p-5 bg-sky-50 rounded-2xl outline-none text-sm font-bold text-sky-800 border border-sky-100 shadow-sm"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}



        {/* Spacer for fixed footer */}
        <div className="h-48" />
      </form>

      {/* 底部按鈕 */}
      <footer className="fixed bottom-0 left-0 w-full p-6 bg-white/70 backdrop-blur-2xl border-t z-50 flex justify-center">
        <div className="flex gap-4 w-full max-w-md">
          <button
            type="button"
            onClick={() => {/* 複製邏輯 */ }}
            className="p-5 bg-slate-100 text-slate-500 rounded-3xl hover:bg-slate-200 active:scale-90 transition-all"
          >
            <Copy className="w-6 h-6" />
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 bg-slate-900 text-white font-black py-5 rounded-3xl shadow-2xl hover:bg-black transition-all active:scale-95 flex items-center justify-center space-x-2"
          >
            <Save className="w-6 h-6" />
            <span className="tracking-[0.2em]">儲存觀心書</span>
          </button>
        </div>
      </footer>

      {/* Settings Modal removed */}
    </div>
  );
}