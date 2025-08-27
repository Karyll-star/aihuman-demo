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

    // === 2. 调用智谱 TTS（CogTTS）合成语音（返回 wav） ===
    try {
      const ttsRes = await fetch("https://open.bigmodel.cn/api/paas/v4/audio/speech", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${context.env.ZHIPU_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "cogtts",
          input: reply,
          voice: "tongtong",
          response_format: "wav"
        })
      });

      if (ttsRes.ok) {
        const audioBuffer = await ttsRes.arrayBuffer();
        const binary = new Uint8Array(audioBuffer);
        let s = "";
        for (let i = 0; i < binary.length; i++) s += String.fromCharCode(binary[i]);
        const audioBase64 = btoa(s);
        return Response.json({ text: reply, audio: audioBase64, mime: "audio/wav" });
      }
    } catch (_) {
      // 忽略并返回纯文本
    }

    return Response.json({ text: reply, audio: null });
  }
  