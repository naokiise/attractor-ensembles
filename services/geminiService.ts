
import { GoogleGenAI, Type } from "@google/genai";
import { LorenzParams, AttractorType, MusicalScale } from "../types";

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found");
  }
  return new GoogleGenAI({ apiKey });
};

export const generateLorenzParams = async (prompt: string): Promise<LorenzParams> => {
  const ai = getAiClient();
  
  const defaultParams: LorenzParams = {
    attractor1: AttractorType.LORENZ,
    attractor2: AttractorType.AIZAWA,
    attractor3: AttractorType.THOMAS,
    sigma: 10,
    rho: 28,
    beta: 8/3,
    speed1: 0.5,
    speed2: 0.8,
    speed3: 0.3,
    waterTune: 1.0,
    glitchTune: 1.0,
    bassTune: 1.0,
    bassFilter: 50,
    bassResonance: 0.2,
    globalGain: 1.0,
    drift: 0.2,
    musicalScale: MusicalScale.LYDIAN
  };

  const systemInstruction = `
    You are an expert in chaotic mathematical systems and sound synthesis. 
    Convert user description into parameters for a 3-layer Generative Audio simulation.
    Layers: Water (Flow/Droplets), Glitch, Bass (Deep Pulse).
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            attractor1: { type: Type.STRING, enum: Object.values(AttractorType) },
            attractor2: { type: Type.STRING, enum: Object.values(AttractorType) },
            attractor3: { type: Type.STRING, enum: Object.values(AttractorType) },
            sigma: { type: Type.NUMBER },
            rho: { type: Type.NUMBER },
            beta: { type: Type.NUMBER },
            speed1: { type: Type.NUMBER },
            speed2: { type: Type.NUMBER },
            speed3: { type: Type.NUMBER },
            waterTune: { type: Type.NUMBER },
            glitchTune: { type: Type.NUMBER },
            bassTune: { type: Type.NUMBER },
            bassFilter: { type: Type.NUMBER },
            bassResonance: { type: Type.NUMBER },
            globalGain: { type: Type.NUMBER, description: "Master boost level, 0.5 to 2.0" },
            drift: { type: Type.NUMBER },
            musicalScale: { type: Type.STRING, enum: Object.values(MusicalScale) }
          },
          required: ["sigma", "rho", "beta", "speed1", "speed2", "speed3", "waterTune", "glitchTune", "bassTune"],
        },
      },
    });

    const text = response.text;
    if (text) {
      const parsed = JSON.parse(text);
      return { ...defaultParams, ...parsed };
    }
    return defaultParams;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return defaultParams;
  }
};
