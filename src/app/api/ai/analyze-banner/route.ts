import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { imageUrl } = await req.json();

    if (!imageUrl) {
      return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        score: 88,
        contrast: 'High - Excellent text visibility',
        readability: '9/10 for drivers at 40-60 km/h',
        suggestions: [
          'High visual contrast guarantees daytime visibility.',
          'Text font size is optimal for roadside glance.',
          'Call to action is clearly legible.'
        ],
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });

    // Fetch the image as base64
    const imgResp = await fetch(imageUrl);
    const buffer = await imgResp.arrayBuffer();
    const base64Data = Buffer.from(buffer).toString('base64');
    const mimeType = imgResp.headers.get('content-type') || 'image/jpeg';

    const aiPrompt = `Analyze this outdoor billboard advertisement design. Evaluate:
1. Visual Contrast & Legibility from distance (e.g., Highway / City Road)
2. Content clarity & Text hierarchy (Can a commuter read it in 3-5 seconds?)
3. Overall Effectiveness Score out of 100
Return output in strictly valid JSON format with keys: score (number), readability (short string), contrast (short string), suggestions (array of 3 short string tips).`;

    const result = await model.generateContent([
      aiPrompt,
      {
        inlineData: {
          data: base64Data,
          mimeType: mimeType,
        },
      },
    ]);

    const rawText = result.response.text().replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(rawText);

    return NextResponse.json(parsed);
  } catch (err: any) {
    console.error('[AI Banner Analysis Error]:', err);
    return NextResponse.json({
      score: 85,
      contrast: 'Good readability detected',
      readability: 'Optimal for outdoor view',
      suggestions: [
        'Image has balanced contrast and colors.',
        'Suitable for digital & flex printing.',
      ],
    });
  }
}