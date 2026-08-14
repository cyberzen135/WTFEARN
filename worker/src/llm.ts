import { Env } from './types';

export interface AdjudicationPair {
  i: number;
  input: { name: string; addr: string };
  candidate: { name: string; addr: string; category: string };
}

export interface AdjudicationDecision {
  i: number;
  same: boolean;
  confidence: number;
  reason: string;
}

export async function adjudicatePairsWithLLM(
  pairs: AdjudicationPair[],
  env: Env
): Promise<AdjudicationDecision[]> {
  if (!pairs || pairs.length === 0) return [];
  if (!env.LLM_API_KEY) {
    // If no API key configured, default to non-match to be safe
    return pairs.map(p => ({
      i: p.i,
      same: false,
      confidence: 0.5,
      reason: 'No LLM API key configured for adjudication'
    }));
  }

  const prompt = `You match local business records to official government licence records.
Answer ONLY with valid JSON matching the schema: {"decisions":[{"i":0,"same":true,"confidence":0.95,"reason":"exact address match with DBA abbreviation"}]}

For each pair decide whether they are the SAME physical business at the SAME address.
Consider abbreviations, DBA vs legal name, franchise numbering, and suite differences.

Pairs:
${JSON.stringify(pairs, null, 2)}`;

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.LLM_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    if (!res.ok) {
      throw new Error(`LLM API returned ${res.status}`);
    }

    const data: any = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Empty LLM response");

    const parsed = JSON.parse(text);
    return parsed.decisions || [];
  } catch (err: any) {
    console.error("LLM adjudication failed:", err.message);
    return pairs.map(p => ({
      i: p.i,
      same: false,
      confidence: 0.0,
      reason: `LLM error: ${err.message}`
    }));
  }
}
