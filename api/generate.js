export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not set' });
  }

  try {
    const { task, inputName, sourceBase64, rarityInfo } = req.body || {};

    if (task === 'image') {
      if (!inputName || !sourceBase64) {
        return res.status(400).json({ error: 'Missing inputName or sourceBase64' });
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-image:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `A magical and positive TCG card illustration for "${inputName}".
- Character: A cute, friendly, and mysterious guardian creature inspired by the provided image.
- Aesthetic: Charming, lovable, magical pet mascot, gentle face, soft fantasy feeling.
- Background: Beautiful epic fantasy scenery, such as a crystal garden, serene starlit forest, or glowing ethereal sanctuary.
- Art Style: Character is clean anime-style illustration with polished fantasy card art feeling.
- Constraint: No violence, no horror, no gore, no dark symbols, no text in image. Focus on magical companionship and wonder.`
                  },
                  {
                    inlineData: {
                      mimeType: 'image/jpeg',
                      data: sourceBase64
                    }
                  }
                ]
              }
            ],
            generationConfig: {
              responseModalities: ['TEXT', 'IMAGE']
            }
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return res.status(response.status).json({
          error: data?.error?.message || 'Image generation failed',
          raw: data
        });
      }

      const imageBase64 =
        data?.candidates?.[0]?.content?.parts?.find(part => part.inlineData)?.inlineData?.data;

      if (!imageBase64) {
        return res.status(500).json({ error: 'No generated image returned', raw: data });
      }

      return res.status(200).json({ imageBase64 });
    }

    if (task === 'text') {
      if (!inputName || !rarityInfo) {
        return res.status(400).json({ error: 'Missing inputName or rarityInfo' });
      }

      const min = Number(rarityInfo.min) || 500;
      const max = Number(rarityInfo.max) || 3000;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Create positive and fun RPG attributes for a magical guardian pet named "${inputName}".
Rules:
- name: Friendly/cute fantasy Japanese name, max 10 characters
- desc: Gentle, mysterious, or slightly funny Japanese description, max 40 characters
- atk: Integer between ${min} and ${max}
- mag: Integer between ${min} and ${max}
Return JSON only.`
                  }
                ]
              }
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: 'OBJECT',
                properties: {
                  name: { type: 'STRING' },
                  desc: { type: 'STRING' },
                  atk: { type: 'NUMBER' },
                  mag: { type: 'NUMBER' }
                },
                required: ['name', 'desc', 'atk', 'mag']
              }
            }
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return res.status(response.status).json({
          error: data?.error?.message || 'Text generation failed',
          raw: data
        });
      }

      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

      let parsed;
      try {
        parsed = JSON.parse(rawText.replace(/```json|```/g, '').trim());
      } catch {
        parsed = {};
      }

      return res.status(200).json({
        data: {
          name: parsed.name || inputName,
          desc: parsed.desc || '謎めいた精霊の気配を纏う存在。',
          atk: Math.max(min, Math.min(max, Number(parsed.atk) || min)),
          mag: Math.max(min, Math.min(max, Number(parsed.mag) || min))
        }
      });
    }

    return res.status(400).json({ error: 'Invalid task' });
  } catch (error) {
    return res.status(500).json({
      error: 'Server error',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
