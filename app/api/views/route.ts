import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { kv } from '@vercel/kv';

export const dynamic = 'force-dynamic';

const DATA_FILE = path.join(process.cwd(), 'data', 'views.json');

async function getViews() {
    // Try Vercel KV first
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
        try {
            const views = await kv.get<number>('views');
            return views || 0;
        } catch (error) {
            console.error('Vercel KV Error:', error);
            // Fallthrough to local file if KV fails (optional, but good for stability)
        }
    }

    // Fallback to local file
    try {
        const data = await fs.readFile(DATA_FILE, 'utf-8');
        return JSON.parse(data).views;
    } catch (error) {
        return 0;
    }
}

async function incrementViews() {
    // Try Vercel KV first
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
        try {
            const views = await kv.incr('views');
            return views;
        } catch (error) {
            console.error('Vercel KV Error:', error);
        }
    }

    // Fallback to local file
    try {
        let currentViews = await getViews();
        currentViews++;
        await fs.writeFile(DATA_FILE, JSON.stringify({ views: currentViews }), 'utf-8');
        return currentViews;
    } catch (error) {
        console.error('Failed to save views locally:', error);
        return 0;
    }
}

export async function GET() {
    const views = await getViews();
    return NextResponse.json({ views });
}

export async function POST() {
    const views = await incrementViews();
    return NextResponse.json({ views });
}
