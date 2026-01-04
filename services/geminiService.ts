
import { GoogleGenAI, Type } from "@google/genai";

// Initialize the GoogleGenAI client using the API key from process.env.API_KEY as per guidelines.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const GeminiService = {
  suggestDailyMenu: async (theme: string = "Tradicional") => {
    try {
      // Use ai.models.generateContent directly with the model name and prompt.
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Eres un chef experto en comida criolla Dominicana del restaurante "El Neguev". 
        Sugiere 3 platos del día con el tema: ${theme}. 
        Para cada plato dame: Nombre, una descripción deliciosa y un precio sugerido en Pesos Dominicanos (DOP).`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                description: { type: Type.STRING },
                price: { type: Type.NUMBER }
              },
              required: ["name", "description", "price"],
              propertyOrdering: ["name", "description", "price"]
            }
          }
        }
      });
      // The text property of the response is a getter, not a method.
      const jsonStr = response.text;
      return jsonStr ? JSON.parse(jsonStr.trim()) : null;
    } catch (error) {
      console.error("Error generating menu:", error);
      return null;
    }
  }
};
