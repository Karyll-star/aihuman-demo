require('dotenv').config();
const express = require('express');
const path = require('path');
// 在 Node 18+ 使用全局 fetch；否则回退到 undici
let fetchFn = global.fetch;
if (!fetchFn) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { fetch } = require('undici');
  fetchFn = fetch;
}

const app = express();
const PORT = process.env.PORT || 8787;

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// 防止浏览器默认请求 /favicon.ico 造成 404 噪音
app.get('/favicon.ico', (_req, res) => res.status(204).end());

app.post('/ai', async (req, res) => {
  try {
    const { message } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'invalid_message' });
    }

    if (!process.env.ZHIPU_API_KEY) {
      console.error('Missing ZHIPU_API_KEY in environment (.env not loaded?)');
      return res.status(500).json({ error: 'missing_zhipu_key', hint: '请在项目根目录创建 .env 并设置 ZHIPU_API_KEY，然后重启 npm run dev' });
    }

    // 智谱对话补全
    const glmRes = await fetchFn('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.ZHIPU_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'glm-4.5',
        messages: [
          { role: 'system', content: '你是一个有帮助的中文助手。' },
          { role: 'user', content: message }
        ]
      })
    });

    if (!glmRes.ok) {
      const errText = await glmRes.text();
      console.error('Zhipu chat error:', glmRes.status, errText);
      return res.status(502).json({ error: 'zhipu_request_failed', status: glmRes.status, detail: errText });
    }

    const glmData = await glmRes.json();
    const reply = glmData?.choices?.[0]?.message?.content || '抱歉，我暂时无法回答。';

    // 首选：智谱 TTS（CogTTS）
    try {
      const zhipuTtsRes = await fetchFn('https://open.bigmodel.cn/api/paas/v4/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.ZHIPU_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'cogtts',
          input: reply,
          voice: 'tongtong',
          response_format: 'wav'
        })
      });
      if (zhipuTtsRes.ok) {
        const audioBuffer = await zhipuTtsRes.arrayBuffer();
        const audioBase64 = Buffer.from(audioBuffer).toString('base64');
        return res.json({ text: reply, audio: audioBase64, mime: 'audio/wav' });
      }
    } catch (_) {
      // 忽略并回退
    }

    // 优先使用自定义中文 TTS（通过环境变量配置）
    if (process.env.TTS_URL) {
      try {
        const headers = { 'Content-Type': 'application/json' };
        if (process.env.TTS_API_KEY) headers['Authorization'] = `Bearer ${process.env.TTS_API_KEY}`;
        const ttsReqBody = {
          text: reply
        };
        const ttsResp = await fetchFn(process.env.TTS_URL, {
          method: 'POST',
          headers,
          body: JSON.stringify(ttsReqBody)
        });
        if (ttsResp.ok) {
          // 假定返回 JSON: { audio: base64, mime?: 'audio/mp3' }
          const ttsJson = await ttsResp.json();
          return res.json({ text: reply, audio: ttsJson.audio || null, mime: ttsJson.mime || 'audio/mp3' });
        }
      } catch (_) {
        // 忽略并回退
      }
    }

    // 回退到 OpenAI TTS（可选）
    if (process.env.OPENAI_API_KEY) {
      const ttsRes = await fetchFn('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini-tts',
          voice: 'alloy',
          input: reply
        })
      });

      if (ttsRes.ok) {
        const audioBuffer = await ttsRes.arrayBuffer();
        const audioBase64 = Buffer.from(audioBuffer).toString('base64');
        return res.json({ text: reply, audio: audioBase64 });
      }
    }

    // 若没有任何 TTS，可只返回文本
    return res.json({ text: reply, audio: null });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

app.listen(PORT, () => {
  console.log(`Dev server running at http://localhost:${PORT}`);
});


