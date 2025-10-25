// ==============================
// Stat-Scribe Bot (Standings & Player Stats)
// ==============================

const { Client, GatewayIntentBits } = require("discord.js");
const express = require("express");
const fetch = require("node-fetch");

// ==============================
// Config
// ==============================
const SHEETDB_URL = "https://sheetdb.io/api/v1/39er5p9lp054d"; // Standings sheet
const MATCHES_SHEET = "matches_games";                           // Matches tab name
const ALLOWED_CHANNEL = "1430443661946126378";
const PORT = process.env.PORT || 3000;

// ==============================
// Discord Client
// ==============================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ==============================
// Express (webhook)
// ==============================
const app = express();
app.use(express.json());

app.post("/sheet-update", async (req, res) => {
  console.log("Webhook triggered:", req.body);
  try {
    const channel = await client.channels.fetch(ALLOWED_CHANNEL);
    const response = await fetch(SHEETDB_URL);
    const data = await response.json();

    data.sort((a, b) => a.Rank - b.Rank);

    let reply = "🏆 **MTG League Standings (Updated)** 🏆\n";
    data.forEach(row => {
      reply += `${row.Rank}. ${row["Player Name"]} — ${row.Points} pts — Match W%: ${row["Match Win%"]} — Game W%: ${row["Game Win%"]}\n`;
    });

    await channel.send(reply);
    res.status(200).send("Standings posted!");
  } catch (err) {
    console.error("Error in webhook handling:", err);
    res.status(500).send("Error");
  }
});

app.listen(PORT, () => console.log(`Webhook listening on port ${PORT}`));

// ==============================
// Ready
// ==============================
client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// ==============================
// Commands
// ==============================
client.on("messageCreate", async (message) => {

// Auto-delete non-commands in this channel
if (message.channel.id === ALLOWED_CHANNEL && !message.content.startsWith("!")) {
  return message.delete().catch(() => {});
}

  
  // Log *all* messages for debugging (you'll still return early below)
  console.log("Received message:", message.content, "in channel:", message.channel.id);

  if (message.author.bot) return;
  if (message.channel.id !== ALLOWED_CHANNEL) return;

  const parts = (message.content || "").trim().split(/\s+/);
  const cmd = (parts.shift() || "").toLowerCase();
  const args = parts;

  // ------------------------------------------------------
  // COMMAND: !standings
  // ------------------------------------------------------
  if (cmd === "!standings") {
    try {
      const response = await fetch(SHEETDB_URL);
      const data = await response.json();
      data.sort((a, b) => a.Rank - b.Rank);

      let reply = "🏆 **MTG League Standings** 🏆\n";
      data.forEach(row => {
        reply += `${row.Rank}. ${row["Player Name"]} — ${row.Points} pts — Match W%: ${row["Match Win%"]} — Game W%: ${row["Game Win%"]}\n`;
      });

      return message.channel.send(reply);
    } catch (error) {
      console.error("!standings error:", error);
      return message.channel.send("Error fetching standings. Check bot console.");
    }
  }
  // ------------------------------------------------------
  // END COMMAND: !standings
  // ------------------------------------------------------


  // ------------------------------------------------------
  // COMMAND: !stats <player name>
  // ------------------------------------------------------
  if (cmd === "!stats") {
    const playerName = args.join(" ").trim();
    if (!playerName) return message.channel.send("Please provide a player name. Example: `!stats Allu`");

    try {
      const response = await fetch(SHEETDB_URL);
      const data = await response.json();

      const player = data.find(p => (p["Player Name"] || "").trim().toLowerCase() === playerName.toLowerCase());
      if (!player) {
        return message.channel.send(`No stats found for player "${playerName}".`);
      }

      return message.channel.send(
        `📊 Stats for **${player["Player Name"]}**:\n` +
        `Rank: ${player.Rank}\n` +
        `Points: ${player.Points}\n` +
        `Matches Played: ${player["Matches Played"]}\n` +
        `Matches Won: ${player["Matches Won"]}\n` +
        `Games Won: ${player["Games Won"]}\n` +
        `Match Win%: ${player["Match Win%"]}\n` +
        `Game Win%: ${player["Game Win%"]}`
      );
    } catch (error) {
      console.error("!stats error:", error);
      return message.channel.send("Error fetching player stats.");
    }
  }
  // ------------------------------------------------------
  // END COMMAND: !stats
  // ------------------------------------------------------


  // ------------------------------------------------------
  // COMMAND: !remaining <player name>
  // Shows remaining matches vs each opponent (K=5)
  // Includes a progress bar
  // ------------------------------------------------------
  if (cmd === "!remaining") {
    const playerName = args.join(" ").trim();
    if (!playerName) return message.channel.send("Please provide a player name. Example: `!remaining Allu`");

    try {
      // 1) Get roster from standings
      const standingsRes = await fetch(SHEETDB_URL);
      const standings = await standingsRes.json();
      const players = standings
        .map(p => (p["Player Name"] || "").trim())
        .filter(Boolean);

      // Validate target player
      const target = players.find(p => p.toLowerCase() === playerName.toLowerCase());
      if (!target) {
        return message.channel.send(`No player named "${playerName}".`);
      }

      // 2) Fetch matches from matches sheet
      const matchesRes = await fetch(`${SHEETDB_URL}?sheet=${encodeURIComponent(MATCHES_SHEET)}`);
      const rows = await matchesRes.json();

      // 3) Count matches per opponent for the target player
      const counts = {};
      players.forEach(p => { if (p !== target) counts[p] = 0; });

      rows.forEach(m => {
        const p1 = (m.P1 || "").trim();
        const p2 = (m.P2 || "").trim();
        if (!p1 || !p2) return;

        if (p1 === target && counts.hasOwnProperty(p2)) counts[p2] += 1;
        if (p2 === target && counts.hasOwnProperty(p1)) counts[p1] += 1;
      });

      // 4) Compute totals for progress bar
      const matchesPlayed = Object.values(counts).reduce((a, b) => a + b, 0);
      const totalRequired = (players.length - 1) * 5;  // K=5 per opponent
      const pct = Math.round((matchesPlayed / totalRequired) * 100);
      const filled = Math.round(pct / 10);
      const bar = "█".repeat(filled) + "░".repeat(10 - filled);

      // 5) Build reply (sorted by most remaining first)
      let reply = `🎯 **Match Progress for ${target}**\n\n`;
      reply += `Matches Completed: **${matchesPlayed}/${totalRequired}** (${pct}%)\n`;
      reply += `Progress: \`${bar}\`\n\n`;
      reply += `**Remaining Matches vs Each Opponent (out of 5):**\n\n`;

      const list = Object.entries(counts)
        .map(([opp, played]) => ({ opp, remaining: Math.max(0, 5 - played), played }))
        .sort((a, b) => b.remaining - a.remaining || a.opp.localeCompare(b.opp));

      list.forEach(item => {
        reply += `• vs **${item.opp}** — ${item.remaining} remaining\n`;
      });

      return message.channel.send(reply);

    } catch (err) {
      console.error("!remaining error:", err);
      return message.channel.send("Error calculating remaining matches. Check bot console.");
    }
  }
  // ------------------------------------------------------
  // END COMMAND: !remaining
  // ------------------------------------------------------
});

// ==============================
// Login
// ==============================
client.login(process.env.DISCORD_TOKEN);

