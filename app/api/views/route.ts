import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'views.json');

async function getViews() {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf-8');
        return JSON.parse(data).views;
    } catch (error) {
        return 0;
    }
}

async function saveViews(views: number) {
    try {
        await fs.writeFile(DATA_FILE, JSON.stringify({ views }), 'utf-8');
    } catch (error) {
        console.error('Failed to save views:', error);
    }
}

export async function GET() {
    const views = await getViews();
    return NextResponse.json({ views });
}

export async function POST() {
    let views = await getViews();
    views++;
    await saveViews(views);
    return NextResponse.json({ views });
}
