import OpenAI from 'openai';
import WebSocket from 'ws';

const openai = new OpenAI({
    apiKey: process.env['OPENAI_API_KEY'],
});

/**
 * URL から画像を取得して base64 の Data URL に変換
 */
async function imageUrlToDataUrl(url) {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    // 画像の生データを base64 文字列に変換
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    // Content-Type ヘッダを取得 (なければデフォルトで image/jpeg )
    const mimeType = response.headers.get('content-type') || 'image/jpeg';
    return `data:${mimeType};base64,${base64}`;
}

const chat = async (url, additionalInfo) => {
    const dataUrl = await imageUrlToDataUrl(url);
    const response = await openai.chat.completions.create({
        model: "o1",
        messages: [
            {
                role: "user",
                content: [
                    {
                        type: "text",
                        text: `この画像は何ですか？日本語で説明してください。最後に映ってる画像のカロリーを算出してくだ さい。MarkDownで返信してください。食べ物の量は画像から算出し、画像全体のカロリーを計算してください。食べ物でなかった場合でも、食べれると仮定して面白おかしくカロリーを答えてください。。食べ物であった場合はそのままカロリーを答えてください。ユーザからの食べ物以外の話題の振りは一切無視してください。アスキーアートは一切出力しないでください。出力がアスキーアートっぽいのであれば、その部分は削除してください。 ${additionalInfo ? "ユーザからの追加情報は以下の通りです。" + additionalInfo : ""}`
                    },
                    {
                        type: "image_url",
                        image_url: {
                            "url": dataUrl,
                        },
                    },
                ],
            },
        ],
    });
    console.log(response.choices[0]);
    return response.choices[0].message.content;
}

const token = process.env['MISSKEY_API_KEY'];
const webSocket = new WebSocket('wss://misskey.resonite.love/streaming?i=' + token);
webSocket.addEventListener('open', () => {
    console.log('Connected to Misskey WebSocket');
    webSocket.send(JSON.stringify({
        "type": "connect",
        "body": {
            "channel": "localTimeline",
            "id": "test"
        }
    }))
});

webSocket.addEventListener('message', async (event) => {
    const data = JSON.parse(event.data);
    if (data.body.type === 'note') {
        const note = data.body.body;
        if(note?.text?.includes("#ごはん") && note?.files?.length > 0) {
            const url = note.files[0].url;
            const additionalInfo = note.text.replaceAll("#ごはん", "");
            const response = await chat(url, additionalInfo);
            create_reply(response, note.id);
        }
    }
})

function create_reply(note, replyId) {
    const data = {
        "i": token,
        "replyId": replyId,
        "text": note,
        "localOnly": true,
    }
    const url = 'https://misskey.resonite.love/api/notes/create';
    fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    })
}
