export async function onRequestPost(context) {
    const { message } = await context.request.json();

    // === 1. 使用智谱AI 对话补全 API 生成文本 ===
    // 文档: https://docs.bigmodel.cn/api-reference/%E6%A8%A1%E5%9E%8B-api/%E5%AF%B9%E8%AF%9D%E8%A1%A5%E5%85%A8
    const glmRes = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${context.env.ZHIPU_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "glm-4.5",
        messages: [
          { role: "system", content: "你是一个有帮助的中文助手。" },
          { role: "user", content: message }
        ]
      })
    });

    if (!glmRes.ok) {
      const errText = await glmRes.text();
      return new Response(JSON.stringify({ error: "zhipu_request_failed", detail: errText }), { status: 502 });
    }

    const glmData = await glmRes.json();
    const reply = glmData?.choices?.[0]?.message?.content || "抱歉，我暂时无法回答。";

    // === 2. 调用 OpenAI TTS API（保留，可替换为其他 TTS 服务） ===
    const ttsRes = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${context.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini-tts",
        voice: "alloy",
        input: reply
      })
    });

    if (!ttsRes.ok) {
      // 如果语音失败，也返回文本
      return Response.json({ text: reply, audio: null });
    }

    const audioBuffer = await ttsRes.arrayBuffer();
    const audioBase64 = btoa(
      new Uint8Array(audioBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
    );

    return Response.json({ text: reply, audio: audioBase64 });
  }
  