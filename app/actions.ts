'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export async function getJournalEntry(date: string) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) return null;

        const { data, error } = await supabase
            .from('logs')
            .select('content')
            .eq('id', date)
            .eq('user_id', user.id)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('Failed to fetch journal entry:', error);
            return null;
        }

        return data?.content || null;
    } catch (error) {
        console.error('Failed to fetch journal entry:', error);
        return null;
    }
}

export async function getRecordedDates() {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) return [];

        const { data, error } = await supabase
            .from('logs')
            .select('id')
            .eq('user_id', user.id);

        if (error) {
            console.error('Failed to fetch recorded dates:', error);
            return [];
        }

        return data.map((e: { id: string }) => e.id);
    } catch (error) {
        console.error('Failed to fetch recorded dates:', error);
        return [];
    }
}

export async function saveJournalEntry(date: string, data: any) {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            console.error('Auth error:', authError);
            return { success: false, error: 'Unauthorized: 請重新登入' };
        }

        // Content is the whole data object (minus the id/date which is the key)
        const { date: _, ...content } = data;

        // Explicitly include user_id to satisfy RLS 'WITH CHECK' policy
        const { error } = await supabase
            .from('logs')
            .upsert({
                id: date,
                content: content,
                user_id: user.id, // Explicitly set user_id
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id, id' }); // Composite key

        if (error) {
            console.error('Supabase upsert error details:', JSON.stringify(error, null, 2));
            return { success: false, error: error.message || 'Database error' };
        }

        revalidatePath('/');
        return { success: true };
    } catch (error: any) {
        console.error('Failed to save journal entry exception:', error);
        return { success: false, error: error.message || 'Failed to save' };
    }
}

const TODO_KEYS = [
    'love_body_todo', 'love_speech_todo', 'love_mind_todo',
    'steady_body_todo', 'steady_speech_todo', 'steady_mind_todo'
];

export async function getPendingTodos() {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) return [];

        // Fetch last 14 days of logs to look for pending todos
        const { data, error } = await supabase
            .from('logs')
            .select('id, content')
            .eq('user_id', user.id)
            .order('id', { ascending: false })
            .limit(14);

        if (error) {
            console.error('Failed to fetch pending todos:', error);
            return [];
        }

        const pendingTodos: Array<{ date: string; key: string; content: string }> = [];

        data.forEach((row: any) => {
            const content = row.content || {};
            TODO_KEYS.forEach(key => {
                if (content[key] && !content[`${key}_done`]) {
                    pendingTodos.push({
                        date: row.id,
                        key: key,
                        content: content[key]
                    });
                }
            });
        });

        return pendingTodos;
    } catch (error) {
        console.error('Exception fetching pending todos:', error);
        return [];
    }
}

export async function toggleTodo(date: string, key: string, isDone: boolean) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) return { success: false, error: 'Unauthorized' };

        // 1. Fetch existing content
        const { data: currentData, error: fetchError } = await supabase
            .from('logs')
            .select('content')
            .eq('id', date)
            .eq('user_id', user.id)
            .single();

        if (fetchError || !currentData) {
            return { success: false, error: 'Log entry not found' };
        }

        const newContent = {
            ...currentData.content,
            [`${key}_done`]: isDone
        };

        // 2. Update content
        const { error: updateError } = await supabase
            .from('logs')
            .update({
                content: newContent,
                updated_at: new Date().toISOString()
            })
            .eq('id', date)
            .eq('user_id', user.id);

        if (updateError) {
            return { success: false, error: updateError.message };
        }

        revalidatePath('/');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getJournalStats() {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) return null;

        const { data, error } = await supabase
            .from('logs')
            .select('id')
            .eq('user_id', user.id)
            .order('id', { ascending: false });

        if (error || !data) return null;

        const dates = data.map(d => d.id).sort().reverse();
        if (dates.length === 0) return { currentStreak: 0, longestStreak: 0, totalDays: 0 };

        let currentStreak = 0;
        let longestStreak = 0;
        let tempStreak = 0;

        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

        // Calc streaks
        let lastDate = null;
        const sortedDates = [...dates].reverse(); // Oldest to newest for streak

        for (let i = 0; i < sortedDates.length; i++) {
            const d = sortedDates[i];
            if (!lastDate) {
                tempStreak = 1;
            } else {
                const diff = (new Date(d).getTime() - new Date(lastDate).getTime()) / 86400000;
                if (diff === 1) {
                    tempStreak++;
                } else {
                    tempStreak = 1;
                }
            }
            longestStreak = Math.max(longestStreak, tempStreak);
            lastDate = d;
        }

        // Current streak from today or yesterday
        if (dates[0] === today || dates[0] === yesterday) {
            let streak = 0;
            let checkDate = new Date(dates[0]);
            let dateSet = new Set(dates);

            while (dateSet.has(checkDate.toISOString().split('T')[0])) {
                streak++;
                checkDate.setDate(checkDate.getDate() - 1);
            }
            currentStreak = streak;
        }

        return {
            currentStreak,
            longestStreak,
            totalDays: dates.length,
            lastEntry: dates[0]
        };
    } catch (err) {
        console.error(err);
        return { currentStreak: 0, longestStreak: 0, totalDays: 0 };
    }
}

export async function searchJournalEntries(query: string) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) return [];

        // Note: Supabase JSONB search can be tricky. We'll fetch and filter if query is small, 
        // or use arrow operators if simple. But content is a flat-ish object of strings mostly.
        const { data, error } = await supabase
            .from('logs')
            .select('id, content')
            .eq('user_id', user.id)
            .order('id', { ascending: false });

        if (error || !data) return [];

        const queryLower = query.toLowerCase();
        const results = data.filter(row => {
            if (!row.content || typeof row.content !== 'object') return false;
            return Object.values(row.content).some(val =>
                typeof val === 'string' && val.toLowerCase().includes(queryLower)
            );
        });

        return results.map(r => ({
            date: r.id,
            preview: Object.values(r.content as object)
                .filter(v => typeof v === 'string' && v.toLowerCase().includes(query.toLowerCase()))
                .join(' | ')
                .substring(0, 100) + '...'
        }));
    } catch (err) {
        console.error(err);
        return [];
    }
}

export async function getMissingDates() {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) return [];

        const { data, error } = await supabase
            .from('logs')
            .select('id')
            .eq('user_id', user.id)
            .order('id', { ascending: true });

        if (error || !data || data.length === 0) return [];

        const existingDates = new Set(data.map(d => d.id));
        const firstDate = new Date(data[0].id);
        const lastDate = new Date(); // Up to today
        const missing = [];

        let current = new Date(firstDate);
        while (current <= lastDate) {
            const dateStr = current.toISOString().split('T')[0];
            if (!existingDates.has(dateStr)) {
                missing.push(dateStr);
            }
            current.setDate(current.getDate() + 1);
        }

        if (missing.length === 0) return []; // Truly perfect

        return missing.reverse().slice(0, 30);
    } catch (err) {
        return [];
    }
}

export async function getDebugInfo() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return { userId: 'Not Logged In', count: 0 };

        const { count, error } = await supabase
            .from('logs')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id);

        return {
            userId: user.id,
            count: count || 0,
            error: error ? error.message : null
        };
    } catch (e: any) {
        return { userId: 'Error', count: 0, error: e.message };
    }
}

import { GoogleGenAI } from '@google/genai';

export async function analyzePdfs(formData: FormData) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return { success: false, error: 'GEMINI_API_KEY is not set' };
        }

        const files = formData.getAll('files') as File[];
        if (!files || files.length === 0) {
            return { success: false, error: '未提供檔案' };
        }

        const ai = new GoogleGenAI({ apiKey });
        const parts: Array<{ inlineData?: { data: string; mimeType: string }, text?: string }> = [];

        // Convert files to base64
        for (const file of files) {
            const buffer = await file.arrayBuffer();
            const base64 = Buffer.from(buffer).toString('base64');
            parts.push({
                inlineData: {
                    data: base64,
                    mimeType: file.type || 'application/pdf',
                }
            });
        }

        const prompt = `
你是一位專業的心理諮詢師與個人成長教練。請仔細閱讀並綜合分析使用者上傳的這些「觀心書（反思日記）」PDF 檔案。
請提供一份深入、溫滿、具建設性的綜合分析報告，內容需要包含以下部分：
1. **整體情緒與狀態總結**：總結這段時間內使用者的主要情緒波動、壓力來源以及成長亮點。
2. **行為與思維模式分析**：點出使用者在這段期間常出現的思考慣性或行為模式（包含正向與需要調整的）。
3. **具體建議與下一步**：基於你的分析，給予 3 點具體且可行的建議，幫助使用者在未來達到更穩定的身心狀態。

請使用繁體中文，語氣要溫暖、同理、且充滿支持感。排版請使用 Markdown 格式（如標題、清單、粗體等）以利閱讀。
`;
        parts.push({ text: prompt });

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: parts }]
        });

        return { success: true, report: response.text };

    } catch (error: any) {
        console.error('AI Analysis Action Error:', error);
        return { success: false, error: error.message || '分析過程中發生錯誤' };
    }
}
