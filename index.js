// ==============================
// Stat-Scribe Bot — Slash Commands Version
// ==============================

const { Client, GatewayIntentBits, Routes, Collection } = require("discord.js");
const express = require("express");
const fetch = require("node-fetch");
const fs = require("fs");
const { createCanvas, registerFont } = require("canvas");

// ✅ Try to register a system font only if it exists
try {
  const fontPath = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";
  if (fs.existsSync(fontPath)) {
    registerFont(fontPath, { family: "DejaVu" });
    console.log("✅ Using system font: DejaVuSans");
  } else {
    console.warn("⚠️ System font not found — using Canvas default font");
  }
} catch (err) {
  console.warn("⚠️ Font registration failed:", err.message);
}



// ==============================
// Config (now using .env)
// ==============================
require("dotenv").config();

const SHEETDB_URL = process.env.SHEETDB_URL;
const MATCHES_SHEET = process.env.MATCHES_SHEET || "matches_games";
const ALLOWED_CHANNEL = process.env.ALLOWED_CHANNEL;
const PORT = process.env.PORT || 3000;

if (!process.env.DISCORD_TOKEN) {
  console.error("❌ ERROR: DISCORD_TOKEN missing in .env or Railway Variables");
  process.exit(1);
}

if (!SHEETDB_URL) {
  console.error("❌ ERROR: SHEETDB_URL missing in .env or Railway Variables");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.commands = new Collection();

// ==============================
// Slash Command Handlers
// ==============================

client.commands.set("standings", {
  run: async (interaction) => {
    const response = await fetch(SHEETDB_URL);
    const data = await response.json();
    data.sort((a, b) => a.Rank - b.Rank);

    let reply = "🏆 **MTG League Standings** 🏆\n\n";
    data.forEach(row => {
      reply += `${row.Rank}. **${row["Player Name"]}** — ${row.Points} pts — MW% ${row["Match Win%"]} — GW% ${row["Game Win%"]}\n`;
    });

    return interaction.reply(reply);
  }
});

client.commands.set("stats", {
  run: async (interaction) => {
    const playerName = interaction.options.getString("player");
    const response = await fetch(SHEETDB_URL);
    const data = await response.json();

    const player = data.find(p => (p["Player Name"] || "").trim().toLowerCase() === playerName.toLowerCase());
    if (!player)
      return interaction.reply(`No stats found for "${playerName}".`);

    return interaction.reply(
      `📊 **${player["Player Name"]}**\n\n` +
      `Rank: ${player.Rank}\n` +
      `Points: ${player.Points}\n` +
      `Matches Played: ${player["Matches Played"]}\n` +
      `Matches Won: ${player["Matches Won"]}\n` +
      `Games Won: ${player["Games Won"]}\n` +
      `Match Win%: ${player["Match Win%"]}\n` +
      `Game Win%: ${player["Game Win%"]}`
    );
  }
});

client.commands.set("streaks", {
  run: async (interaction) => {
    const type = interaction.options.getString("type"); // 'win' or 'lose'
    const matchesRes = await fetch(`${SHEETDB_URL}?sheet=${MATCHES_SHEET}`);
    const rows = await matchesRes.json();

    const streaks = {};
    const players = new Set(rows.flatMap(m => [m.Winner, m.Loser]));

    players.forEach(p => streaks[p] = { win: 0, lose: 0 });

    rows.forEach(m => {
      const winner = m.Winner?.trim();
      const loser = m.Loser?.trim();
      if (!winner || !loser) return;

      streaks[winner].win = (streaks[winner].win || 0) + 1;
      streaks[winner].lose = 0;

      streaks[loser].lose = (streaks[loser].lose || 0) + 1;
      streaks[loser].win = 0;
    });

    const max = Math.max(...[...players].map(p => streaks[p][type]));
    const leaders = [...players].filter(p => streaks[p][type] === max && max > 0);

    if (leaders.length === 0)
      return interaction.reply(`No active ${type} streaks found.`);

    const streakEmoji = type === "win" ? "🔥" : "💀";
    const streakLabel = type === "win" ? "Win" : "Losing";

    let reply = `${streakEmoji} **Current ${streakLabel} Streak${leaders.length > 1 ? "s" : ""}** (${max} match${max > 1 ? "es" : ""})\n`;
    reply += leaders.map(p => `• ${p}`).join("\n");

    return interaction.reply(reply);
  }
});

client.commands.set("pvp", {
  run: async (interaction) => {
    const player1 = interaction.options.getString("player1");
    const player2 = interaction.options.getString("player2");

    if (!player1 || !player2)
      return interaction.reply("Please provide two player names.");

    const response = await fetch(`${SHEETDB_URL}?sheet=matches_games`);
    const matches = await response.json();

    const relevant = matches.filter(
      m =>
        (m.P1?.toLowerCase() === player1.toLowerCase() && m.P2?.toLowerCase() === player2.toLowerCase()) ||
        (m.P1?.toLowerCase() === player2.toLowerCase() && m.P2?.toLowerCase() === player1.toLowerCase())
    );

    if (relevant.length === 0)
      return interaction.reply(`No PvP data found for ${player1} vs ${player2}.`);

    let p1Wins = 0;
    let p2Wins = 0;

    for (const match of relevant) {
      if (match.Winner?.toLowerCase() === player1.toLowerCase()) p1Wins++;
      if (match.Winner?.toLowerCase() === player2.toLowerCase()) p2Wins++;
    }

    const total = p1Wins + p2Wins;
    const p1Pct = total > 0 ? Math.round((p1Wins / total) * 100) : 0;
    const p2Pct = total > 0 ? Math.round((p2Wins / total) * 100) : 0;

    const msg =
      `🎯 **${player1} vs ${player2}**\n` +
      `• ${player1}: ${p1Wins} wins (${p1Pct}%)\n` +
      `• ${player2}: ${p2Wins} wins (${p2Pct}%)\n` +
      `• Total matches: ${total}`;

    return interaction.reply(msg);
  }
});



client.commands.set("pvp-matrix", {
  run: async (interaction) => {
    await interaction.deferReply();

    // Fetch PvP matrix data
    const response = await fetch(`${process.env.SHEETDB_URL}?sheet=PvP_Matrix`);
    const matrixRaw = await response.json();

    // ✅ Clean the data: remove empty rows and cells
    const matrix = matrixRaw
      .filter(r => Object.values(r).some(v => v && v.toString().trim() !== ""))
      .map(row => {
        const cleaned = {};
        for (const [key, value] of Object.entries(row)) {
          if (key && key.trim() !== "") cleaned[key.trim()] = (value || "").trim();
        }
        return cleaned;
      });

    if (!matrix.length)
      return interaction.editReply("No PvP Matrix data found or the sheet is empty.");

    // ✅ Extract player names (headers)
    const headers = Object.keys(matrix[0]).filter(h => h && h.trim() !== "");
    const rows = matrix.map(r => headers.map(h => r[h] || "-"));

    // --- Canvas setup ---
    const cellW = 110;
    const cellH = 40;
    const width = cellW * (headers.length + 1);
    const height = cellH * (rows.length + 1);
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // Background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.font = "bold 16px DejaVu";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // --- Heat color helper ---
    const getHeatColor = (pct) => {
      if (pct === "-" || pct === "" || pct == null) return "#f8f8f8";
      const value = parseInt(pct);
      if (isNaN(value)) return "#f8f8f8";
      const g = Math.round(255 * (value / 100));
      const r = Math.round(255 * (1 - value / 100));
      return `rgb(${r},${g},100)`; // Red → Green gradient
    };

    // --- Header row ---
    headers.forEach((h, i) => {
      ctx.fillStyle = "#ff4d4d";
      ctx.fillRect((i + 1) * cellW, 0, cellW, cellH);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(h, (i + 1.5) * cellW, cellH / 2);
    });

    // --- Left column ---
    headers.forEach((h, i) => {
      ctx.fillStyle = "#00cc44";
      ctx.fillRect(0, (i + 1) * cellH, cellW, cellH);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(h, cellW / 2, (i + 1.5) * cellH);
    });

    // --- Matrix cells ---
    rows.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (x === y) {
          ctx.fillStyle = "#cccccc";
        } else {
          const pctMatch = cell.match(/\((\d+)%\)/);
          const pct = pctMatch ? pctMatch[1] : "-";
          ctx.fillStyle = getHeatColor(pct);
        }

        ctx.fillRect((x + 1) * cellW, (y + 1) * cellH, cellW, cellH);
        ctx.strokeStyle = "#00000020";
        ctx.strokeRect((x + 1) * cellW, (y + 1) * cellH, cellW, cellH);

        ctx.fillStyle = "#000000";
        ctx.font = "14px DejaVu";
        ctx.fillText(cell, (x + 1.5) * cellW, (y + 1.5) * cellH);
      });
    });

    // --- Save and send ---
    const filePath = "/tmp/pvp_matrix.png";
    fs.writeFileSync(filePath, canvas.toBuffer("image/png"));

    await interaction.editReply({
      content: "📊 **Current PvP Matrix (Heatmap View)**",
      files: [filePath],
    });
  },
});

// ==============================
// Remaining Matches Command
// ==============================

client.commands.set("remaining", {
  run: async (interaction) => {
    const playerName = interaction.options.getString("player");
    const standingsRes = await fetch(SHEETDB_URL);
    const standings = await standingsRes.json();
    const players = standings.map(p => p["Player Name"]).filter(Boolean);

    const target = players.find(p => p.toLowerCase() === playerName.toLowerCase());
    if (!target) return interaction.reply(`No player named "${playerName}".`);

    const matchesRes = await fetch(`${SHEETDB_URL}?sheet=${MATCHES_SHEET}`);
    const rows = await matchesRes.json();

    const counts = {};
    players.forEach(p => { if (p !== target) counts[p] = 0; });

    rows.forEach(m => {
      if (m.P1 === target && counts[m.P2] !== undefined) counts[m.P2]++;
      if (m.P2 === target && counts[m.P1] !== undefined) counts[m.P1]++;
    });

    const played = Object.values(counts).reduce((a, b) => a + b, 0);
    const total = (players.length - 1) * 5;
    const pct = Math.round((played / total) * 100);
    const bar = "█".repeat(Math.round(pct / 10)) + "░".repeat(10 - Math.round(pct / 10));

    let reply = `🎯 **Match Progress for ${target}**\n\n`;
    reply += `Matches Completed: **${played}/${total}** (${pct}%)\n`;
    reply += `Progress: \`${bar}\`\n\n`;

    Object.entries(counts)
      .map(([opp, p]) => ({ opp, remain: 5 - p }))
      .sort((a, b) => b.remain - a.remain)
      .forEach(r => reply += `• vs **${r.opp}** — ${r.remain} remaining\n`);

    return interaction.reply(reply);
  }
});

// ==============================
// Interaction Listener
// ==============================

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.channelId !== ALLOWED_CHANNEL) {
    return interaction.reply({
      content: `📊 Please use Stat-Scribe commands in the <#${ALLOWED_CHANNEL}> channel.`,
      ephemeral: true
    });
  }

  const cmd = client.commands.get(interaction.commandName);
  if (cmd) return cmd.run(interaction);
});

// ==============================
// Webhook + Message Cleanup
// ==============================
const app = express();
app.use(express.json());
app.listen(PORT, () => console.log(`Webhook listening on ${PORT}`));

client.on("messageCreate", msg => {
  if (msg.channel.id !== ALLOWED_CHANNEL) return;
  if (msg.author.bot) return;
  msg.delete().catch(() => {});
});

client.login(process.env.DISCORD_TOKEN);
