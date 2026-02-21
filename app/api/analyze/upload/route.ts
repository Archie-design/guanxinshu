import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

export async function POST(req: NextRequest) {
    try {
        const { sessionId, fileIndex, mimeType, chunkIndex, chunkCount, data } = await req.json();

        const tmpDir = path.join(os.tmpdir(), 'guanxinshu_uploads');
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

        const sessionDir = path.join(tmpDir, sessionId);
        if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

        // Save base64 chunk to part file
        const chunkPath = path.join(sessionDir, `file${fileIndex}.part${chunkIndex}`);
        fs.writeFileSync(chunkPath, data);

        // Store metadata 
        if (chunkIndex === 0) {
            const metaPath = path.join(sessionDir, `file${fileIndex}.meta`);
            fs.writeFileSync(metaPath, JSON.stringify({ mimeType, chunkCount }));
        }

        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error('Upload Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
