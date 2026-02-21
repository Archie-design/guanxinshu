import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
    let sessionDir = '';
    const uploadedGeminiFiles: any[] = [];
    const apiKey = process.env.GEMINI_API_KEY;
    const ai = new GoogleGenAI({ apiKey });

    try {
        const { sessionId, previousReportContent } = await req.json();
        const tmpDir = path.join(os.tmpdir(), 'guanxinshu_uploads');
        sessionDir = path.join(tmpDir, sessionId);

        if (!fs.existsSync(sessionDir)) {
            return NextResponse.json({ error: '找不到該上傳區塊。可能已被清除或上傳失敗。' }, { status: 400 });
        }

        const allFiles = fs.readdirSync(sessionDir);
        const metaFiles = allFiles.filter(f => f.endsWith('.meta'));

        const parts: any[] = [];

        // 1. Reconstruct PDFs & Upload via Google Gemini File API
        for (const metaFile of metaFiles) {
            const fileName = metaFile.replace('.meta', '');
            const meta = JSON.parse(fs.readFileSync(path.join(sessionDir, metaFile), 'utf-8'));

            let fullBase64 = '';
            for (let i = 0; i < meta.chunkCount; i++) {
                fullBase64 += fs.readFileSync(path.join(sessionDir, `${fileName}.part${i}`), 'utf-8');
            }

            const pdfBuffer = Buffer.from(fullBase64, 'base64');
            const pdfFilePath = path.join(sessionDir, `${fileName}.pdf`);
            fs.writeFileSync(pdfFilePath, pdfBuffer);

            // Google Gemini File API Upload
            const uploadResult = await ai.files.upload({ file: pdfFilePath, config: { mimeType: meta.mimeType || 'application/pdf' } });
            uploadedGeminiFiles.push(uploadResult);

            parts.push({
                fileData: {
                    fileUri: uploadResult.uri,
                    mimeType: uploadResult.mimeType || 'application/pdf',
                }
            });
        }

        // Clean up temporary local files immediately
        try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch (e) { console.error('Cleanup error:', e); }

        // 2. Stream generation
        let prompt = `
你是一位專業的心理諮詢師與個人成長教練。請仔細閱讀並綜合分析使用者上傳的這些「觀心書（反思日記）」PDF 檔案。
請提供一份深入、溫暖、具建設性的綜合分析報告，內容需要包含以下部分：
1. **整體情緒與狀態總結**：總結這段時間內使用者的主要情緒波動、壓力來源以及成長亮點。
2. **行為與思維模式分析**：點出使用者在這段期間常出現的思考慣性或行為模式（包含正向與需要調整的）。
`;

        if (previousReportContent) {
            prompt += `
3. **跨期成長與變化 (重點)**：我提供了一份使用者過去的歷史分析報告。請務必詳細比對這次上傳的日記與這份過去報告的差異。明確點出使用者在哪方面取得了進步、哪些心理負擔已經被放下，或是哪些心理狀態出現了轉變。
以下是過去的歷史報告內容供你參照：
"""
${previousReportContent}
"""

4. **具體建議與下一步**：基於你的分析與跨期成長，給予 3 點具體且可行的建議，幫助使用者在未來達到更穩定的身心狀態。
`;
        } else {
            prompt += `
3. **具體建議與下一步**：基於你的分析，給予 3 點具體且可行的建議，幫助使用者在未來達到更穩定的身心狀態。
`;
        }

        prompt += `
請使用繁體中文，語氣要溫暖、同理、且充滿支持感。排版請使用 Markdown 格式（如標題、清單、粗體等）以利閱讀。
`;
        parts.push({ text: prompt });

        const responseStream = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: parts }]
        });

        const stream = new ReadableStream({
            async start(controller) {
                try {
                    for await (const chunk of responseStream) {
                        if (chunk.text) {
                            controller.enqueue(new TextEncoder().encode(chunk.text));
                        }
                    }
                    controller.close();
                } catch (error) {
                    console.error('Streaming error:', error);
                    controller.error(error);
                } finally {
                    // Cleanup remote Google GenAI files so private journal isn't kept longer than necessary
                    for (const gemFile of uploadedGeminiFiles) {
                        try { await ai.files.delete({ name: gemFile.name }); } catch (e) { console.error('Failed to delete Gemini temp file:', e); }
                    }
                }
            }
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Transfer-Encoding': 'chunked',
            },
        });

    } catch (e: any) {
        console.error('Execution Error:', e);
        try { if (fs.existsSync(sessionDir)) fs.rmSync(sessionDir, { recursive: true, force: true }); } catch (err) { }

        // Also cleanup GenAI files if generation crashed
        for (const gemFile of uploadedGeminiFiles) {
            try { await ai.files.delete({ name: gemFile.name }); } catch (err) { }
        }

        return NextResponse.json({ error: e.message || '分析失敗' }, { status: 500 });
    }
}
