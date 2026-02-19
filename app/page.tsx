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
  User as UserIcon,
  Save,
  Quote,
  X,
  LogOut,
  CheckCircle2,
  Database,
  Info,
  Check,
  CheckSquare,
  LayoutDashboard
} from 'lucide-react';
import Link from 'next/link';

import { createClient } from '@/utils/supabase/client';

// --- 常數定義 ---
const QUOTES = [
  "「覺察，是改變的開始。」",
  "「定於心，穩於行，觀於意。」",
  "「每一口呼吸都是與靈魂的重新連結。」",
  "「心若安定，世界便不再嘈雜。」",
  "「溫柔對待今日的疲憊，也是一種勇氣。」"
];

const THEMES = [
  { id: 'love', title: '付出愛', color: 'emerald', icon: <Heart className="w-5 h-5" />, label: 'Love' },
  { id: 'steady', title: '穩', color: 'blue', icon: <ShieldCheck className="w-5 h-5" />, label: 'Stability' }
];

const SUB_FIELDS = [
  { id: 'body', title: '身', label: 'Body', icon: <UserIcon className="w-4 h-4" /> },
  { id: 'speech', title: '語', label: 'Speech', icon: <MessageSquare className="w-4 h-4" /> },
  { id: 'mind', title: '意', label: 'Mind', icon: <Brain className="w-4 h-4" /> }
];

export default function Guanxinshu() {
  // --- 狀態管理 ---
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<any>(null);
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
  const [formData, setFormData] = useState<any>({});
  const [recordedDates, setRecordedDates] = useState(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [showModules, setShowModules] = useState({ routine: false, gratitude: false });
  const [calendarView, setCalendarView] = useState(new Date());
  const [pendingTodos, setPendingTodos] = useState<Array<{ date: string; key: string; content: string; done: boolean }>>([]);

  // --- 初始化與 Session 監聽 ---
  useEffect(() => {
    // 監聽 Auth 狀態
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchHistory(supabase);
        loadData(supabase, currentDate);
        fetchTodos(supabase);
      }
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (user) {
      loadData(supabase, currentDate);
      fetchTodos(supabase);
    }
  }, [currentDate, supabase, user]);

  // --- 資料操作邏輯 ---
  const fetchHistory = async (client: any) => {
    try {
      const { data, error } = await client.from('logs').select('id');
      if (!error && data) setRecordedDates(new Set(data.map((i: any) => i.id)));
    } catch (e) { console.error(e); }
  };

  const fetchTodos = async (client: any) => {
    try {
      const { data, error } = await client
        .from('logs')
        .select('id, content, updated_at')
        .order('id', { ascending: false })
        .limit(14);

      if (error || !data) return;

      const todos: Array<{ date: string; key: string; content: string; done: boolean }> = [];
      const todoKeys = [
        'love_body_todo', 'love_speech_todo', 'love_mind_todo',
        'steady_body_todo', 'steady_speech_todo', 'steady_mind_todo'
      ];

      const now = new Date().getTime();
      const threeDays = 3 * 24 * 60 * 60 * 1000;

      data.forEach((row: any) => {
        const content = row.content || {};
        const rowUpdatedAt = new Date(row.updated_at).getTime();

        todoKeys.forEach(key => {
          if (content[key]) {
            const isDone = !!content[`${key}_done`];
            // 顯示條件：未完成 OR (已完成且更新時間在3天內)
            if (!isDone || (now - rowUpdatedAt < threeDays)) {
              todos.push({
                date: row.id,
                key: key,
                content: content[key],
                done: isDone
              });
            }
          }
        });
      });
      setPendingTodos(todos);
    } catch (e) { console.error(e); }
  };

  const loadData = async (client: any, date: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await client.from('logs').select('content').eq('id', date).single();
      if (data) {
        setFormData(data.content);
        setShowModules({
          routine: !!(data.content.routine_boxing || data.content.routine_wife),
          gratitude: !!(data.content.gratitude_1 || data.content.gratitude_2)
        });
      } else {
        setFormData({ logDate: date });
        setShowModules({ routine: false, gratitude: false });
      }
    } catch (e) { setFormData({ logDate: date }); }
    finally { setIsLoading(false); }
  };

  const handleSave = async () => {
    if (!user) return alert("請先登入");
    setIsLoading(true);
    try {
      const { error } = await supabase.from('logs').upsert({
        id: currentDate,
        content: formData,
        user_id: user.id,
        updated_at: new Date().toISOString()
      });
      if (error) throw error;
      alert('紀錄已安全存檔 🌱');
      fetchHistory(supabase);
      fetchTodos(supabase); // Refresh todos after save
    } catch (e) { alert('儲存失敗，請檢查資料庫權限設定'); }
    finally { setIsLoading(false); }
  };

  const handleTodoToggle = async (date: string, key: string, currentStatus: boolean) => {
    // Optimistic update
    setPendingTodos(prev => prev.map(t =>
      (t.date === date && t.key === key) ? { ...t, done: !currentStatus } : t
    ));

    try {
      const { data } = await supabase.from('logs').select('content').eq('id', date).single();
      if (data) {
        const newContent = { ...data.content, [`${key}_done`]: !currentStatus };
        await supabase.from('logs').update({
          content: newContent,
          updated_at: new Date().toISOString()
        }).eq('id', date);
        fetchTodos(supabase); // Re-fetch to confirm
      }
    } catch (e) {
      console.error("Toggle failed", e);
      fetchTodos(supabase); // Revert
    }
  };

  const handleInputChange = (key: string, val: string) => {
    setFormData((prev: any) => ({ ...prev, [key]: val }));
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    location.reload();
  };

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
    if (error) alert(error.message);
  };

  const handleCopy = async () => {
    const lines = [`📅 觀心書 ${currentDate}\n`];

    // 定課
    if (formData.routine_boxing || formData.routine_wife) {
      lines.push('【定課執行】');
      if (formData.routine_boxing) lines.push(`🥊 破曉打陰陽拳：${formData.routine_boxing}`);
      if (formData.routine_wife) lines.push(`👩‍❤️‍👨 欣賞老婆：${formData.routine_wife}`);
      lines.push('');
    }

    // 感恩
    const gratitudes = [1, 2, 3, 4, 5].map(i => formData[`gratitude_${i}`]).filter(Boolean);
    if (gratitudes.length > 0) {
      lines.push('【五感恩】');
      gratitudes.forEach((g, i) => lines.push(`${i + 1}. ${g}`));
      lines.push('');
    }

    // 身語意
    THEMES.forEach(theme => {
      let hasThemeContent = false;
      const themeLines = [`【${theme.title}】`];

      SUB_FIELDS.forEach(field => {
        const plus = formData[`${theme.id}_${field.id}_plus`];
        const minus = formData[`${theme.id}_${field.id}_minus`];
        const todo = formData[`${theme.id}_${field.id}_todo`];

        if (plus || minus || todo) {
          hasThemeContent = true;
          themeLines.push(`${field.title} (${field.label})`);
          if (plus) themeLines.push(`  + ${plus}`);
          if (minus) themeLines.push(`  - ${minus}`);
          if (todo) themeLines.push(`  🎯 ${todo}`);
        }
      });

      if (hasThemeContent) {
        lines.push(...themeLines);
        lines.push('');
      }
    });

    const text = lines.join('\n');
    try {
      await navigator.clipboard.writeText(text);
      alert('已複製到剪貼簿！📋');
    } catch (err) {
      console.error('複製失敗:', err);
      alert('複製失敗，請手動複製');
    }
  };

  // --- 輔助計算 ---
  const [quote, setQuote] = useState('');

  useEffect(() => {
    setQuote(QUOTES[Math.floor(Math.random() * QUOTES.length)]);
  }, []);

  const calendarDays = useMemo(() => {
    const year = calendarView.getFullYear();
    const month = calendarView.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= totalDays; d++) {
      days.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
    return days;
  }, [calendarView]);

  return (
    <div className="max-w-2xl mx-auto min-h-screen bg-[#f8fafc] text-slate-900 pb-32 font-sans overflow-x-hidden">

      {/* 行動裝置優化 Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-100 px-5 py-4 flex justify-between items-center shadow-sm">
        <div className="flex flex-col">
          <h1 className="text-xl font-black tracking-tight text-slate-800">觀心書</h1>
          <div className="flex items-center text-[10px] text-indigo-500 font-bold uppercase tracking-widest mt-0.5">
            <CalendarIcon className="w-3 h-3 mr-1" />
            {currentDate}
          </div>
        </div>
        <div className="flex items-center space-x-2 flex-shrink-0">
          {user && (
            <>
              <div className="flex items-center bg-slate-50 rounded-full pl-3 pr-1 py-1 border border-slate-100 shadow-sm max-w-[140px] xs:max-w-none">
                <span className="text-[10px] font-bold text-slate-500 mr-2 truncate">
                  {user.email?.split('@')[0] || 'User'}
                </span>
                <button onClick={handleLogout} className="p-1.5 bg-white rounded-full text-slate-400 hover:text-rose-500 shadow-sm transition-colors border border-slate-50 flex-shrink-0">
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
              <Link href="/admin" className="p-2 bg-indigo-50 text-indigo-600 rounded-full hover:bg-indigo-100 transition-colors shadow-sm border border-indigo-100">
                <LayoutDashboard className="w-4 h-4" />
              </Link>
            </>
          )}
        </div>
      </header >

      {/* 內容主區塊 */}
      < main className="px-5 pt-6 space-y-6" >

        {/* 登入引導 (若未登入) - 改置於最上方 */}
        {
          !user && (
            <div className="bg-indigo-50 border-2 border-indigo-100 border-dashed rounded-[2.5rem] p-8 text-center animate-in fade-in duration-700">
              <UserIcon className="w-10 h-10 text-indigo-300 mx-auto mb-4" />
              <h4 className="font-black text-indigo-900 mb-2">同步您的覺察紀錄</h4>
              <p className="text-indigo-600/70 text-xs mb-6 px-4">完成設定並登入 Google，即可在不同裝置間同步您的觀心紀錄。</p>
              <button
                onClick={handleGoogleLogin}
                className="w-full bg-white text-slate-800 font-bold py-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center active:scale-95 transition-all"
              >
                <img src="https://www.google.com/favicon.ico" className="w-4 h-4 mr-3" alt="Google" />
                使用 Google 帳號登入
              </button>
            </div>
          )
        }

        {/* 視覺吸引力：格言卡片 */}
        {
          pendingTodos.length > 0 && (
            <div className="bg-amber-50 border-l-4 border-amber-400 p-6 rounded-2xl shadow-sm animate-in slide-in-from-top-2">
              <div className="flex items-center mb-4">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center mr-3">
                  <CheckSquare className="w-5 h-5 text-amber-600" />
                </div>
                <h3 className="font-black text-amber-800 text-lg">待辦行動 ({pendingTodos.length})</h3>
              </div>
              <div className="space-y-3">
                {pendingTodos.map((todo) => (
                  <label
                    key={`${todo.date}-${todo.key}`}
                    className={`flex items-start p-3 rounded-xl cursor-pointer transition-all group ${todo.done ? 'bg-slate-100/50 grayscale opacity-70' : 'bg-white/60 hover:bg-white'}`}
                  >
                    <div className="relative flex items-center mt-1 mr-3">
                      <input
                        type="checkbox"
                        className="peer appearance-none w-5 h-5 border-2 border-amber-300 rounded-md checked:bg-amber-500 checked:border-amber-500 transition-all"
                        checked={todo.done}
                        onChange={() => handleTodoToggle(todo.date, todo.key, todo.done)}
                      />
                      <Check className="w-3.5 h-3.5 text-white absolute top-0.5 left-0.5 opacity-0 peer-checked:opacity-100 pointer-events-none" />
                    </div>
                    <div>
                      <span className={`text-amber-900 font-bold block ${todo.done ? 'line-through text-slate-400' : ''}`}>{todo.content}</span>
                      <span className="text-[10px] text-amber-600/60 font-medium bg-amber-100/50 px-2 py-0.5 rounded-full mt-1 inline-block">
                        {todo.date}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )
        }

        {/* 視覺吸引力：格言卡片 */}
        <div className="relative p-7 rounded-[2.5rem] bg-indigo-600 shadow-xl shadow-indigo-100 overflow-hidden group">
          <Quote className="absolute -top-4 -left-4 w-24 h-24 text-white/10 group-hover:rotate-12 transition-transform duration-700" />
          <p className="text-white font-medium italic relative z-10 leading-relaxed text-center text-sm">
            {quote}
          </p>
        </div>

        {/* 手機優化日曆：大觸控熱區 */}
        <section className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-slate-50">
          <div className="flex justify-between items-center mb-6 px-1">
            <h3 className="font-black text-slate-800 flex items-center">
              {calendarView.getFullYear()}年 {calendarView.getMonth() + 1}月
            </h3>
            <div className="flex bg-slate-50 rounded-xl p-1 border border-slate-100">
              <button onClick={() => setCalendarView(new Date(calendarView.getFullYear(), calendarView.getMonth() - 1, 1))} className="p-2 text-slate-400 active:text-indigo-600 transition-colors"><ChevronLeft className="w-5 h-5" /></button>
              <button onClick={() => setCalendarView(new Date(calendarView.getFullYear(), calendarView.getMonth() + 1, 1))} className="p-2 text-slate-400 active:text-indigo-600 transition-colors"><ChevronRight className="w-5 h-5" /></button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {['日', '一', '二', '三', '四', '五', '六'].map(d => <div key={d} className="text-[10px] font-black text-slate-300 text-center py-1 tracking-widest uppercase">{d}</div>)}
            {calendarDays.map((dateStr, i) => dateStr ? (
              <button
                key={i}
                onClick={() => setCurrentDate(dateStr)}
                className={`aspect-square flex flex-col items-center justify-center rounded-2xl transition-all text-sm font-bold relative
                  ${currentDate === dateStr ? 'bg-indigo-600 text-white shadow-lg scale-105 z-10' : 'bg-slate-50/50 text-slate-500 active:bg-slate-100'}
                `}
              >
                {dateStr.split('-')[2]}
                {recordedDates.has(dateStr) && currentDate !== dateStr && <div className="absolute bottom-1.5 w-1.5 h-1.5 bg-indigo-400 rounded-full" />}
              </button>
            ) : <div key={i} />)}
          </div>
        </section>

        {/* 模組切換：手機專用 Segmented Control */}
        <div className="flex p-1.5 bg-slate-200/50 rounded-2xl space-x-1 backdrop-blur-sm">
          <button
            onClick={() => setShowModules(p => ({ ...p, routine: !p.routine }))}
            className={`flex-1 py-3 rounded-xl text-xs font-black transition-all flex items-center justify-center
              ${showModules.routine ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}
            `}
          >
            <Zap className="w-3.5 h-3.5 mr-2" /> 定課
          </button>
          <button
            onClick={() => setShowModules(p => ({ ...p, gratitude: !p.gratitude }))}
            className={`flex-1 py-3 rounded-xl text-xs font-black transition-all flex items-center justify-center
              ${showModules.gratitude ? 'bg-white text-pink-600 shadow-sm' : 'text-slate-400'}
            `}
          >
            <Heart className="w-3.5 h-3.5 mr-2" /> 感恩
          </button>
        </div>

        {/* 表單內容區 */}
        <div className={`space-y-8 ${!user ? 'opacity-40 pointer-events-none grayscale-[0.5]' : ''}`}>

          {/* 定課模組 */}
          {showModules.routine && (
            <section className="bg-white p-7 rounded-[2.5rem] border-l-[10px] border-indigo-500 shadow-sm animate-in slide-in-from-top-4">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-black text-slate-800 flex items-center"><CheckCircle2 className="w-5 h-5 mr-3 text-indigo-500" /> 定課執行</h2>
              </div>
              <div className="space-y-6">
                <div className="group">
                  <label className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-2 block px-1">破曉打陰陽拳</label>
                  <textarea
                    value={formData.routine_boxing || ''}
                    onChange={e => handleInputChange('routine_boxing', e.target.value)}
                    className="w-full p-4 bg-slate-50 rounded-2xl outline-none text-base focus:ring-2 focus:ring-indigo-100 transition-all min-h-[100px]"
                    placeholder="今日身心的流動..."
                  />
                  <label className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-2 block px-1 mt-6">欣賞老婆的閃光點</label>
                  <textarea
                    value={formData.routine_wife || ''}
                    onChange={e => handleInputChange('routine_wife', e.target.value)}
                    className="w-full p-4 bg-slate-50 rounded-2xl outline-none text-base focus:ring-2 focus:ring-indigo-100 transition-all min-h-[100px]"
                    placeholder="感恩她的一切..."
                  />
                </div>
              </div>
            </section>
          )}

          {/* 感恩模組 */}
          {showModules.gratitude && (
            <section className="bg-white p-7 rounded-[2.5rem] border-l-[10px] border-pink-500 shadow-sm animate-in slide-in-from-top-4">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-black text-slate-800 flex items-center"><Heart className="w-5 h-5 mr-3 text-pink-500" /> 五感恩</h2>
              </div>
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i}>
                    <input
                      type="text"
                      placeholder={`${i}. 我感恩...`}
                      value={formData[`gratitude_${i}`] || ''}
                      onChange={e => handleInputChange(`gratitude_${i}`, e.target.value)}
                      className="w-full p-4 bg-pink-50/50 rounded-2xl outline-none text-sm border-2 border-transparent focus:border-pink-200 transition-all placeholder:text-pink-300"
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 身語意主題區塊 */}
          {THEMES.map(theme => (
            <section key={theme.id} className={`bg-white p-7 rounded-[3rem] border-t-[10px] border-${theme.color === 'emerald' ? 'emerald' : 'blue'}-500 shadow-sm`}>
              <div className="flex items-center mb-8">
                <div className={`w-12 h-12 bg-${theme.color === 'emerald' ? 'emerald' : 'blue'}-100 rounded-2xl flex items-center justify-center text-${theme.color === 'emerald' ? 'emerald' : 'blue'}-600 mr-4 shadow-inner`}>
                  {theme.icon}
                </div>
                <h2 className="text-2xl font-black tracking-tighter text-slate-800">{theme.title}</h2>
              </div>

              <div className="space-y-12">
                {SUB_FIELDS.map(field => (
                  <div key={field.id} className="space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-50 pb-2 px-1">
                      <span className={`flex items-center text-${theme.color === 'emerald' ? 'emerald' : 'blue'}-600 font-black text-lg uppercase tracking-widest`}>
                        {React.cloneElement(field.icon as React.ReactElement<any>, { className: 'mr-2.5 w-5 h-5' })}
                        {field.title}
                      </span>
                      <span className="text-[9px] font-bold text-slate-200 uppercase tracking-tighter">{field.label}</span>
                    </div>
                    <div className="space-y-3">
                      <input
                        type="text"
                        placeholder="＋ 正向覺察"
                        value={formData[`${theme.id}_${field.id}_plus`] || ''}
                        onChange={e => handleInputChange(`${theme.id}_${field.id}_plus`, e.target.value)}
                        className={`w-full p-5 bg-${theme.color === 'emerald' ? 'emerald' : 'blue'}-50/30 rounded-2xl outline-none text-base border-2 border-transparent focus:border-${theme.color === 'emerald' ? 'emerald' : 'blue'}-100 transition-all placeholder:text-slate-300`}
                      />
                      <input
                        type="text"
                        placeholder="－ 負向覺察"
                        value={formData[`${theme.id}_${field.id}_minus`] || ''}
                        onChange={e => handleInputChange(`${theme.id}_${field.id}_minus`, e.target.value)}
                        className="w-full p-5 bg-rose-50/40 rounded-2xl outline-none text-base border-2 border-transparent focus:border-rose-100 transition-all placeholder:text-rose-200"
                      />
                      {formData[`${theme.id}_${field.id}_minus`] && (
                        <div className="pl-4 border-l-4 border-sky-400 animate-in slide-in-from-left duration-500 mt-2">
                          <input
                            type="text"
                            placeholder="🎯 明日的對治方案"
                            value={formData[`${theme.id}_${field.id}_todo`] || ''}
                            onChange={e => handleInputChange(`${theme.id}_${field.id}_todo`, e.target.value)}
                            className="w-full p-5 bg-sky-50 rounded-2xl outline-none text-sm font-bold text-sky-900 border border-sky-100 shadow-sm"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main >

      {/* 底部固定操作列：符合手機單手操作 */}
      < footer className="fixed bottom-0 left-0 w-full p-5 bg-white/80 backdrop-blur-2xl border-t border-slate-100 z-50 pb-safe" >
        <div className="max-w-md mx-auto flex gap-4">
          <button
            type="button"
            onClick={handleCopy}
            className="p-5 bg-slate-50 text-slate-400 rounded-[1.75rem] active:bg-indigo-50 active:text-indigo-600 transition-all shadow-sm border border-slate-100"
          >
            <Copy className="w-6 h-6" />
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 bg-slate-900 text-white font-black py-5 rounded-[1.75rem] shadow-2xl shadow-slate-200 active:scale-95 transition-all flex items-center justify-center space-x-3 tracking-[0.2em]"
          >
            <Save className="w-6 h-6" />
            <span>儲存觀心書</span>
          </button>
        </div>
      </footer >
    </div >
  );
}