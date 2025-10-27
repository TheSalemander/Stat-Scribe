// ==============================
// Stat-Scribe Bot — Slash Commands Version
// ==============================

const { Client, GatewayIntentBits, Routes, Collection } = require("discord.js");
const express = require("express");
const fetch = require("node-fetch");

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

  // ✅ Restrict all slash commands to the stats channel
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
// Webhook (for auto-standings updates)
// ==============================
const app = express();
app.use(express.json());
app.listen(PORT, () => console.log(`Webhook listening on ${PORT}`));

// Auto-delete non-bot text messages in the allowed channel
client.on("messageCreate", msg => {
  if (msg.channel.id !== ALLOWED_CHANNEL) return;
  if (msg.author.bot) return;
  msg.delete().catch(() => {});
});

client.login(process.env.DISCORD_TOKEN);
