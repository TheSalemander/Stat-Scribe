const { Client, GatewayIntentBits } = require("discord.js");
const express = require("express");
const fetch = require("node-fetch");

const SHEETDB_URL = "https://sheetdb.io/api/v1/39er5p9lp054d";
const ALLOWED_CHANNEL = "1430443661946126378";
const PORT = pprocess.env.PORT || 3000; // The local port where webhook will listen

// Create a new Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// 🟢 EXPRESS WEB SERVER for webhook
const app = express();
app.use(express.json());

// Webhook endpoint to receive updates from Google Apps Script
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

// Start the webhook server
app.listen(PORT, () => console.log(`Webhook listening on port ${PORT}`));

// Discord: bot ready
client.on("ready", () => {
    console.log(`Logged in as ${client.user.tag}`);
});

// Discord: message commands
client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (message.channel.id !== ALLOWED_CHANNEL) return;

    const args = message.content.split(" ");
    const command = args[0].toLowerCase();

    // !standings command
    if (command === "!standings") {
        try {
            const response = await fetch(SHEETDB_URL);
            const data = await response.json();
            data.sort((a, b) => a.Rank - b.Rank);

            let reply = "🏆 **MTG League Standings** 🏆\n";
            data.forEach(row => {
                reply += `${row.Rank}. ${row["Player Name"]} — ${row.Points} pts — Match W%: ${row["Match Win%"]} — Game W%: ${row["Game Win%"]}\n`;
            });

            message.channel.send(reply);
        } catch (error) {
            console.error("Fetch error:", error);
            message.channel.send("Error fetching standings. Check bot console.");
        }
    }

    // !stats command
    if (command === "!stats") {
        let playerName = args.slice(1).join(" ").trim();
        if (!playerName)
            return message.channel.send("Please provide a player name. Example: `!stats Jafar tai Iago`");

        try {
            const response = await fetch(SHEETDB_URL);
            const data = await response.json();

            const player = data.find(p =>
                p["Player Name"].trim().toLowerCase() === playerName.toLowerCase()
            );

            if (!player) {
                message.channel.send(`No stats found for player "${playerName}".`);
            } else {
                message.channel.send(
                    `📊 Stats for ${player["Player Name"]}:\n` +
                    `Rank: ${player.Rank}\n` +
                    `Points: ${player.Points}\n` +
                    `Matches Played: ${player["Matches Played"]}\n` +
                    `Matches Won: ${player["Matches Won"]}\n` +
                    `Games Won: ${player["Games Won"]}\n` +
                    `Match Win%: ${player["Match Win%"]}\n` +
                    `Game Win%: ${player["Game Win%"]}`
                );
            }
        } catch (error) {
            console.error("Fetch error:", error);
            message.channel.send("Error fetching player stats.");
        }
    }
});

// Login bot
client.login(process.env.DISCORD_TOKEN);



