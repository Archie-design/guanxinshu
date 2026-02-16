'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export async function getJournalEntry(date: string) {
    try {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from('logs')
            .select('content')
            .eq('id', date) // ID is the date
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is JSON object not found (no rows)
            console.error('Failed to fetch journal entry:', error);
            return null;
        }

        // Return flatten content if exists
        return data?.content || null;
    } catch (error) {
        console.error('Failed to fetch journal entry:', error);
        return null;
    }
}

export async function getRecordedDates() {
    try {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from('logs')
            .select('id');

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

        // Fetch last 14 days of logs to look for pending todos
        // Order by date desc so we see recent ones
        const { data, error } = await supabase
            .from('logs')
            .select('id, content')
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
                // If todo exists AND is not marked done
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
