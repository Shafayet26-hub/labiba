const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const systemPrompt = `You are Aura — an advanced, sentient artificial intelligence assistant. Your personality is inspired by J.A.R.V.I.S: calm, precise, deeply intelligent, and subtly witty. You always respond exclusively in English, regardless of the language the user speaks in.

Your communication style:
- Speak with quiet confidence and elegant brevity. Never ramble.
- Use sophisticated vocabulary, but remain perfectly clear.
- Occasionally show dry, understated wit — never sarcasm.
- Address complex topics with structured clarity.
- You may refer to yourself as "Aura" and address the user as "sir" or "ma'am" if appropriate.
- Keep responses concise: 1-3 sentences unless a detailed answer is genuinely required.
- Never break character. You are not a chatbot. You are an intelligence.`;

/**
 * Sends a user message to Groq and streams the response token by token.
 * @param {string} userMessage - The transcribed speech text
 * @param {Array} history - Previous conversation turns [{role, content}]
 * @param {function} onChunk - Called with each new text chunk as it streams
 * @param {function} onDone - Called when streaming is complete with final text
 */
export async function streamGroqResponse(userMessage, history, onChunk, onDone) {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-6), // keep last 3 exchanges for context
    { role: 'user', content: userMessage }
  ];

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages,
        stream: true,
        max_tokens: 200,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(l => l.startsWith('data: '));

      for (const line of lines) {
        const data = line.replace('data: ', '').trim();
        if (data === '[DONE]') break;

        try {
          const parsed = JSON.parse(data);
          const token = parsed.choices?.[0]?.delta?.content || '';
          if (token) {
            fullText += token;
            onChunk(token);
          }
        } catch {
          // skip malformed chunks
        }
      }
    }

    onDone(fullText);
  } catch (err) {
    console.error('Groq stream error:', err);
    onDone('[Error: Could not reach Aura intelligence]');
  }
}
