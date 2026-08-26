import { NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function POST(request: Request) {
  try {
    const { district, city, area, address, landmark, width, height, requestedPrice } = await request.json();

    const prompt = `
      You are an expert outdoor advertising and billboard valuation AI.
      Analyze the commercial flex/billboard value for this site:
      - District: ${district}
      - City/Town: ${city}
      - Area: ${area}
      - Exact Address / Landmark: ${address}, ${landmark}
      - Flex Dimension: ${width} ft (width) x ${height} ft (height) (Total area: ${Number(width) * Number(height)} sq.ft)
      - Owner's Base Price: ₹${requestedPrice}/month

      Estimate and calculate:
      1. Traffic Score (0-100) based on commercial footfall and vehicle congestion.
      2. Visibility Score (0-100) based on junction/road angle prominence.
      3. Demand Score (0-100) based on local business presence.
      4. Overall Location Score (0-100).
      5. AI Recommended Monthly Rate in Indian Rupees (INR).
      6. A brief valuation reason (max 2 sentences).
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            trafficScore: { type: Type.NUMBER },
            visibilityScore: { type: Type.NUMBER },
            demandScore: { type: Type.NUMBER },
            locationScore: { type: Type.NUMBER },
            aiSuggestedRate: { type: Type.NUMBER },
            reason: { type: Type.STRING },
          },
          required: ['trafficScore', 'visibilityScore', 'demandScore', 'locationScore', 'aiSuggestedRate', 'reason'],
        },
      },
    });

    const parsedData = JSON.parse(response.text || '{}');
    return NextResponse.json(parsedData);
  } catch (error: any) {
    console.error('AI Location Analysis Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to analyze location' },
      { status: 500 }
    );
  }
}