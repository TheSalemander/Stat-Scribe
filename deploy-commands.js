const { REST, Routes } = require("discord.js");
require("dotenv").config();

// Your Guild and Client IDs
const GUILD_ID = "1430443251147472969";
const CLIENT_ID = "1430838998066139179";

// ==============================
// Command Definitions
// ==============================
const commands = [
  {
    name: "standings",
    description: "Show full league standings",
  },
  {
    name: "stats",
    description: "Show stats for a player",
    options: [
      {
        name: "player",
        description: "The player's name",
        type: 3, // STRING
        required: true,
      },
    ],
  },
  {
    name: "remaining",
    description: "Show remaining matches for a player",
    options: [
      {
        name: "player",
        description: "The player's name",
        type: 3, // STRING
        required: true,
      },
    ],
  },
  {
    name: "streaks",
    description: "Show current win or losing streaks",
    options: [
      {
        name: "type",
        description: "Type of streak (win or lose)",
        type: 3, // STRING
        required: true,
        choices: [
          { name: "Win", value: "win" },
          { name: "Lose", value: "lose" },
        ],
      },
    ],
  },
  {
    name: "pvp",
    description: "Check head-to-head record between two players",
    options: [
      {
        name: "player1",
        description: "First player",
        type: 3, // STRING
        required: true,
      },
      {
        name: "player2",
        description: "Second player",
        type: 3, // STRING
        required: true,
      },
    ],
  },
  {
    name: "pvp-matrix",
    description: "Show the full PvP Matrix (Heatmap View)",
  },
];

// ==============================
// Register Commands
// ==============================
const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log("🚀 Deploying slash commands to guild:", GUILD_ID);

    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
      body: commands,
    });

    console.log("✅ Successfully registered slash commands.");
  } catch (err) {
    console.error("❌ Error registering commands:", err);
  }
})();
