import { NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function POST(request: Request) {
  try {
    const { campaignName, flexWidth, flexHeight, base64Image } = await request.json();

    const prompt = `
      You are an expert advertisement quality and compliance auditor for outdoor flex boards.
      Evaluate this advertisement image for a billboard campaign named "${campaignName}" with target size ${flexWidth}ft x ${flexHeight}ft.
      
      Analyze:
      1. Image Quality / Clarity (Good, Average, Poor)
      2. Flex Dimensions Compatibility (Correct, Incorrect, Acceptable)
      3. Text Readability from a road distance (Good, Fair, Poor)
      4. Brand/Logo Visibility (Good, Fair, Poor)
      5. Content Safety (Is it compliant with outdoor public advertising standards? True/False)
      6. Content Score (0 to 100)
      7. Concise audit remarks (Max 2 sentences).
    `;

    const contents: any[] = [{ text: prompt }];

    if (base64Image) {
      const base64Data = base64Image.split(',')[1] || base64Image;
      contents.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Data,
        },
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: contents,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            imageQuality: { type: Type.STRING },
            dimensionCheck: { type: Type.STRING },
            textReadability: { type: Type.STRING },
            logoVisibility: { type: Type.STRING },
            isSafeContent: { type: Type.BOOLEAN },
            contentScore: { type: Type.NUMBER },
            remarks: { type: Type.STRING },
          },
          required: [
            'imageQuality',
            'dimensionCheck',
            'textReadability',
            'logoVisibility',
            'isSafeContent',
            'contentScore',
            'remarks',
          ],
        },
      },
    });

    const parsedData = JSON.parse(response.text || '{}');
    return NextResponse.json(parsedData);
  } catch (error: any) {
    console.error('AI Verification Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to verify banner content' },
      { status: 500 }
    );
  }
}