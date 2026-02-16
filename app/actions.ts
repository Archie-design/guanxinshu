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
