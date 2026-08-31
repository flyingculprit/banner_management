import { NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { 
      district = 'Tamil Nadu', 
      city = '', 
      area = '', 
      address = '', 
      width = '20', 
      height = '10', 
      trafficDensity = 'medium',
      monthlyRate = '25000'
    } = body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing GEMINI_API_KEY in .env.local file.' },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    const totalSqFt = Number(width) * Number(height) || 200;

    const prompt = `
      You are an expert commercial real estate and outdoor billboard advertising valuation AI in India.
      Analyze this billboard spot and calculate a fair monthly rental rate in INR and a location viability score from 1 to 100.

      Billboard Location Details:
      - District: ${district}
      - City / Town: ${city}
      - Area / Landmark: ${area}
      - Exact Address: ${address || area}
      - Dimensions: ${width} ft x ${height} ft (Total Area: ${totalSqFt} sq.ft)
      - Traffic Density: ${trafficDensity}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            monthly_rate: { type: Type.NUMBER },
            location_score: { type: Type.NUMBER },
            reason: { type: Type.STRING },
          },
          required: ['monthly_rate', 'location_score', 'reason'],
        },
      },
    });

    const parsedData = JSON.parse(response.text || '{}');

    return NextResponse.json({
      success: true,
      monthly_rate: Number(parsedData.monthly_rate) || Number(monthlyRate) || 25000,
      location_score: Math.min(Math.max(Number(parsedData.location_score) || 75, 1), 100),
      reason: parsedData.reason || 'Valuation completed successfully.',
    });
  } catch (error: any) {
    console.error('AI Valuation Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process AI location valuation.' },
      { status: 500 }
    );
  }
}