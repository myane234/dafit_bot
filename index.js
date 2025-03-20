const { default: makeWASocket, useMultiFileAuthState, makeInMemoryStore, downloadMediaMessage } = require("@whiskeysockets/baileys");
const P = require("pino");
const fs = require('fs');

async function startBot() {
    console.log("🚀 Memulai bot...");

    // Sistem login pakai session
    const { state, saveCreds } = await useMultiFileAuthState("session");
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: P({ level: "silent" }),
    });

    sock.ev.on("creds.update", saveCreds);

    let currentQuestion = null;
    let currentAnswer = null;

    // Handle pesan masuk
    sock.ev.on("messages.upsert", async (m) => {
        try {
            const msg = m.messages[0];
            if (!msg.message) return;

            const from = msg.key.remoteJid;
            const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
            const isGroup = from.endsWith("@g.us");

            console.log(`📩 Pesan dari: ${from} | Grup: ${isGroup ? "Ya" : "Tidak"} | Isi: ${body}`);

            // Perintah !menu
            if (body.startsWith("!menu")) {
                console.log("✅ Perintah !menu diterima, memproses...");
                try {
                    const imageBuffer = fs.readFileSync('assets/menu-img.jpg');
                    const menuText = `🤖 *Dafitra Bot* 🤖
Perkenalkan, saya adalah Dafitra_Bot. Silakan lihat daftar menu di bawah ini untuk mengetahui berbagai fitur yang dapat saya lakukan.

「  I N F O  B O T  」
ִֶָ☾. Name : Dafitra_Bot
ִֶָ☾. Owner : +62821-8380-7360
ִֶָ☾. Total Fitur : 4 Fitur
ִֶָ☾. Total Command : 7 Command
ִֶָ☾. Prefix : ( Prefix_Bot )
ִֶָ☾. Language : Bahasa Indonesia
ִֶָ☾. Library : Baileys
ִֶָ☾. Runtime : Node.js
ִֶָ☾. Version : 1.0.0

「  F I T U R  B O T  」
ִֶָ☾. !menu
ִֶָ☾. !tagall  (Admin Only)
ִֶָ☾. !  mtk
ִֶָ☾. !brat [teks]`;

                    await sock.sendMessage(from, { 
                        image: imageBuffer, 
                        caption: menuText 
                    });

                    console.log("✅ Menu berhasil dikirim!");
                } catch (error) {
                    console.error("❌ Gagal mengirim menu:", error);
                }
            }

            // Perintah !tagall (hanya di grup)
            if (isGroup && body.startsWith("!tagall")) {
                console.log("✅ Perintah !tagall diterima, memproses...");
                try {
                    const groupMetadata = await sock.groupMetadata(from);
                    if (!groupMetadata) return console.log("❌ Gagal mendapatkan metadata grup.");

                    const senderId = msg.key.participant || msg.key.remoteJid;
                    const isAdmin = groupMetadata.participants.some(p => p.id === senderId && (p.admin === 'admin' || p.admin === 'superadmin'));

                    if (!isAdmin) {
                        return console.log("❌ Perintah !tagall hanya dapat digunakan oleh admin grup.");
                    }

                    const members = groupMetadata.participants.map(p => p.id);
                    if (members.length === 0) return console.log("❌ Grup kosong, tidak ada yang bisa ditag.");

                    const mentions = members.map(m => `@${m.replace(/@s\.whatsapp\.net$/, "")}`).join(" ");
                    await sock.sendMessage(from, { 
                        text: `👥 Tagall:\n${mentions}`, 
                        mentions: members 
                    });

                    console.log("✅ Tagall berhasil dikirim!");
                } catch (error) {
                    console.error("❌ Gagal mengirim tag all:", error);
                }
            }

            // Perintah !tebakmtk
            if (body.startsWith("!mtk")) {
                console.log("✅ Perintah !tebakmtk diterima, memproses...");
                try {
                    const num1 = Math.floor(Math.random() * 10) + 1;
                    const num2 = Math.floor(Math.random() * 10) + 1;
                    const operator = ['+', '-', '*', '/'][Math.floor(Math.random() * 4)];
                    let question, answer;

                    switch (operator) {
                        case '+':
                            question = `${num1} + ${num2}`;
                            answer = num1 + num2;
                            break;
                        case '-':
                            question = `${num1} - ${num2}`;
                            answer = num1 - num2;
                            break;
                        case '*':
                            question = `${num1} * ${num2}`;
                            answer = num1 * num2;
                            break;
                        case '/':
                            question = `${num1} / ${num2}`;
                            answer = (num1 / num2).toFixed(2);
                            break;
                    }

                    currentQuestion = question;
                    currentAnswer = answer;

                    await sock.sendMessage(from, { 
                        text: `🤔 Tebak-tebakan Matematika:\n${question}\nJawab dengan benar menggunakan perintah !j [jawaban]`, 
                    });

                    console.log("✅ Tebak-tebakan Matematika berhasil dikirim!");
                } catch (error) {
                    console.error("❌ Gagal mengirim tebak-tebakan matematika:", error);
                }
            }

            // Perintah !answer
            if (body.startsWith("!j")) {
                console.log("✅ Perintah !j jawab diterima, memproses...");
                try {
                    const userAnswer = parseFloat(body.split(" ")[1]);

                    if (userAnswer === parseFloat(currentAnswer)) {
                        await sock.sendMessage(from, { 
                            text: `🎉 Jawaban benar! ${currentQuestion} = ${currentAnswer}`, 
                        });
                    } else {
                        await sock.sendMessage(from, { 
                            text: `❌ Jawaban salah. Coba lagi! ${currentQuestion} = ${currentAnswer}`, 
                        });
                    }

                    // Reset current question and answer
                    currentQuestion = null;
                    currentAnswer = null;

                    console.log("✅ Jawaban berhasil diproses!");
                } catch (error) {
                    console.error("❌ Gagal memproses jawaban:", error);
                }
            }

            
        } catch (error) {
            console.error("❌ Error di event messages.upsert:", error);
        }
    });

    // Update koneksi (handle reconnect otomatis)
    sock.ev.on("connection.update", (update) => {
        console.log("🔄 Update koneksi:", update);
        const { connection, lastDisconnect } = update;
        if (connection === "open") {
            console.log("✅ Bot berhasil terhubung!");
        } else if (connection === "close") {
            console.log("⚠️ Koneksi terputus! Mencoba reconnect...");
            if (lastDisconnect?.error?.output?.statusCode !== 401) {
                startBot();
            } else {
                console.log("❌ Autentikasi gagal, hapus folder 'session' lalu coba scan ulang.");
            }
        }
    });

    sock.ev.on("qr", (qr) => {
        console.log("📸 Scan QR ini untuk login!");
    });
}

// Jalankan bot
startBot();