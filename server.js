const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const APP_TOKEN = process.env.APP_TOKEN || 'chanbe-secret-token';
const PORT = process.env.PORT || 3000;

function checkToken(req, res, next) {
  const token = req.headers['x-app-token'];
  if (!token || token !== APP_TOKEN) {
    return res.status(401).json({ error: 'Token invalide' });
  }
  next();
}

async function callClaude(prompt) {
  const response = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model: 'claude-3-haiku-20240307',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    },
    {
      headers: {
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      }
    }
  );
  return response.data.content[0].text;
}

app.post('/api/detect-language', checkToken, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Texte manquant' });
    const prompt = `Détecte la langue de ce texte et réponds UNIQUEMENT avec le code ISO 639-1 (ex: fr, en, ar, sw, ...). Texte: "${text}"`;
    const result = await callClaude(prompt);
    res.json({ language: result.trim() });
  } catch (err) {
    res.status(500).json({ error: 'Erreur détection langue' });
  }
});

app.post('/api/translate', checkToken, async (req, res) => {
  try {
    const { text, sourceLang, targetLang } = req.body;
    if (!text || !targetLang) return res.status(400).json({ error: 'Paramètres manquants' });
    const prompt = `Traduis ce texte${sourceLang ? ' du ' + sourceLang : ''} vers ${targetLang}. Réponds UNIQUEMENT avec la traduction, sans explication. Texte: "${text}"`;
    const result = await callClaude(prompt);
    res.json({ translation: result.trim() });
  } catch (err) {
    res.status(500).json({ error: 'Erreur traduction' });
  }
});

app.post('/api/scan-translate', checkToken, async (req, res) => {
  try {
    const { imageBase64, targetLang } = req.body;
    if (!imageBase64 || !targetLang) return res.status(400).json({ error: 'Paramètres manquants' });
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-3-haiku-20240307',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } },
            { type: 'text', text: `Extrait tout le texte visible dans cette image, puis traduis-le en ${targetLang}. Format:\nTEXTE ORIGINAL:\n[texte]\n\nTRADUCTION:\n[traduction]` }
          ]
        }]
      },
      { headers: { 'x-api-key': CLAUDE_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' } }
    );
    res.json({ result: response.data.content[0].text.trim() });
  } catch (err) {
    res.status(500).json({ error: 'Erreur scan traduction' });
  }
});

app.post('/api/ask-ai', checkToken, async (req, res) => {
  try {
    const { question, context } = req.body;
    if (!question) return res.status(400).json({ error: 'Question manquante' });
    const prompt = context ? `Contexte: ${context}\n\nQuestion: ${question}` : question;
    const result = await callClaude(prompt);
    res.json({ answer: result.trim() });
  } catch (err) {
    res.status(500).json({ error: 'Erreur IA' });
  }
});

app.get('/', (req, res) => {
  res.json({ status: 'Chanbé IA Backend actif', version: '1.0.0' });
});

app.listen(PORT, () => console.log(`Serveur démarré sur le port ${PORT}`));
