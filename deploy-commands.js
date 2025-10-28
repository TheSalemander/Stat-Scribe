const { REST, Routes } = require("discord.js");
require("dotenv").config();

const GUILD_ID = "YOUR_DISCORD_SERVER_ID_HERE";
const CLIENT_ID = "YOUR_BOT_APPLICATION_ID_HERE";

const commands = [
  {
    name: "standings",
    description: "Show full league standings"
  },
  {
    name: "stats",
    description: "Show stats for a player",
    options: [
      {
        name: "player",
        description: "The player's name",
        type: 3,
        required: true
      }
    ]
  },
  {
    name: "remaining",
    description: "Show remaining matches for a player",
    options: [
      {
        name: "player",
        description: "The player's name",
        type: 3,
        required: true
      }
    ]
  }

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
        { name: "Lose", value: "lose" }
      ]
    }
  ]
},
{
  name: "pvp",
  description: "Check head-to-head record between two players",
  options: [
    { name: "player1", description: "First player", type: 3, required: true },
    { name: "player2", description: "Second player", type: 3, required: true }
  ]
}


];

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
  console.log("✅ Slash commands deployed.");
})();
