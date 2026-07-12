require("dotenv").config();

const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

const fetch = require("node-fetch");

// =====================================
// ENVIRONMENT VARIABLES
// =====================================

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const TWITCH_USERNAME = process.env.TWITCH_USERNAME;
const CHANNEL_ID = process.env.CHANNEL_ID;
const GHOST_ROLE_ID = process.env.GHOST_ROLE_ID;
const LIVE_ROLE_ID = process.env.LIVE_ROLE_ID;
const WELCOME_CHANNEL_ID = process.env.WELCOME_CHANNEL_ID;

// =====================================
// CHECK ENVIRONMENT VARIABLES
// =====================================

const required = {
    DISCORD_TOKEN,
    TWITCH_CLIENT_ID,
    TWITCH_CLIENT_SECRET,
    TWITCH_USERNAME,
    CHANNEL_ID
};

for (const [name, value] of Object.entries(required)) {

    if (!value) {

        console.error(`❌ Missing ${name} in .env`);

        process.exit(1);

    }

}

// =====================================
// DISCORD CLIENT
// =====================================

const client = new Client({

intents: [

    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent

]

});

// =====================================
// VARIABLES
// =====================================

let twitchToken = "";
let streamLive = false;
let lastStreamTitle = "";

// =====================================
// TWITCH LOGIN
// =====================================

async function getTwitchToken() {

    console.log("🔑 Connecting to Twitch...");

    const response = await fetch(
        "https://id.twitch.tv/oauth2/token",
        {
            method: "POST",
            body: new URLSearchParams({

                client_id: TWITCH_CLIENT_ID,
                client_secret: TWITCH_CLIENT_SECRET,
                grant_type: "client_credentials"

            })
        }
    );

    const data = await response.json();

    if (!data.access_token) {

        console.log("❌ Twitch Login Failed");

        console.log(data);

        return;

    }

    twitchToken = data.access_token;

    console.log("✅ Twitch Connected");

}

// =====================================
// CHECK TWITCH STREAM
// =====================================

async function checkStream() {

    try {

        console.log("🔍 Checking Twitch...");

        const response = await fetch(
            `https://api.twitch.tv/helix/streams?user_login=${TWITCH_USERNAME}`,
            {
                headers: {
                    "Client-ID": TWITCH_CLIENT_ID,
                    "Authorization": `Bearer ${twitchToken}`
                }
            }
        );

        const data = await response.json();

        // Token expired
        if (response.status === 401) {

            console.log("🔄 Twitch token expired...");

            await getTwitchToken();

            return;

        }

        // Stream Offline
        if (!data.data || data.data.length === 0) {

            if (streamLive) {

                console.log("⚫ Stream Ended");

            }

            streamLive = false;
            lastStreamTitle = "";

            console.log("⚫ Stream Offline");

            return;

        }

        const stream = data.data[0];

        console.log("🔴 STREAM LIVE!");
        console.log("🎮 Game:", stream.game_name);
        console.log("📝 Title:", stream.title);

        // Already announced
        if (streamLive && lastStreamTitle === stream.title) {

            console.log("🟢 Already announced.");

            return;

        }

        streamLive = true;
        lastStreamTitle = stream.title;

        const channel = await client.channels.fetch(CHANNEL_ID);

const thumbnail = stream.thumbnail_url
    .replace("{width}", "1280")
    .replace("{height}", "720");

const embed = new EmbedBuilder()
    .setColor(0x9146FF)
    .setAuthor({
        name: "HauntHQ is LIVE!"
    })
    .setTitle("🔴 LIVE NOW ON TWITCH")
    .setURL(`https://twitch.tv/${TWITCH_USERNAME}`)
    .setDescription("Come hang out and chat!")
    .addFields(
        {
            name: "🎮 Game",
            value: stream.game_name || "Unknown"
        },
        {
            name: "📝 Stream Title",
            value: stream.title || "No Title"
        }
    )
    .setImage(thumbnail)
    .setFooter({
        text: "HauntHQ • Twitch Live Notification"
    })
    .setTimestamp();

        const button = new ButtonBuilder()
            .setLabel("Watch Stream")
            .setStyle(ButtonStyle.Link)
            .setURL(`https://twitch.tv/${TWITCH_USERNAME}`);

        const row = new ActionRowBuilder()
            .addComponents(button);

        await channel.send({

            content: `<@&${LIVE_ROLE_ID}>`,

            embeds: [embed],
            components: [row]

        });

        console.log("✅ Live notification sent.");

    }

    catch (err) {

        console.error(err);

    }

}

// =====================================
// BOT READY
// =====================================

client.once("clientReady", async () => {

    console.clear();

    console.log("========================================");
    console.log("🚀 HauntHQ Live Bot Started");
    console.log("========================================");
    console.log(`✅ Logged in as ${client.user.tag}`);

    await getTwitchToken();

    console.log("🚀 Twitch Monitoring Started");

    await checkStream();

    setInterval(checkStream, 60000);

});

// =====================================
// DISCORD COMMANDS
// =====================================

client.on("messageCreate", async (message) => {

    if (message.author.bot) return;

    const OWNER_ID = "298019447686561792";

    if (message.author.id !== OWNER_ID) return;

    // ==========================
    // !rules
    // ==========================

    if (message.content.toLowerCase() === "!rules") {

        const embed = new EmbedBuilder()
            .setColor(0x9146FF)
            .setTitle("📜 Welcome to The HQ")
            .setDescription(`Before you can access the server, please read the rules.

Click **✅ I Agree** below to verify and unlock the server.`);

        const button = new ButtonBuilder()
            .setCustomId("agree_rules")
            .setLabel("✅ I Agree")
            .setStyle(ButtonStyle.Success);

        const row = new ActionRowBuilder()
            .addComponents(button);

        await message.channel.send({
            embeds: [embed],
            components: [row]
        });

        console.log("📜 Rules posted.");

        return;
    }

    // ==========================
    // !botstatus
    // ==========================

    if (message.content.toLowerCase() === "!botstatus") {

        await message.reply(
`✅ **HauntHQ Live Bot**

🟢 Discord Connected
🎮 Watching: ${TWITCH_USERNAME}
🔑 Twitch Connected: ${twitchToken ? "✅ Yes" : "❌ No"}
📡 Monitoring Every 60 Seconds`
        );

        console.log("✅ !botstatus");

        return;
    }

    // ==========================
    // !verify
    // ==========================

    if (message.content.toLowerCase() === "!verify") {

        const embed = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle("✅ Verification")
            .setDescription(`Click **✅ I Agree** below to verify you've read the rules and unlock access to **The HQ**.`);

        const button = new ButtonBuilder()
            .setCustomId("agree_rules")
            .setLabel("✅ I Agree")
            .setStyle(ButtonStyle.Success);

        const row = new ActionRowBuilder()
            .addComponents(button);

        await message.channel.send({
            embeds: [embed],
            components: [row]
        });

        console.log("✅ Verification message posted.");

        return;
    }

    // ==========================
    // !notify
    // ==========================

    if (message.content.toLowerCase() === "!notify") {

        const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle("🔔 Live Notifications")
            .setDescription(`Want to know whenever **Bizzy** goes live on Twitch?

Click the button below to receive live stream notifications.

Click it again at any time to stop receiving notifications.`);

        const button = new ButtonBuilder()
            .setCustomId("live_notifications")
            .setLabel("🔴 Notify Me")
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder()
            .addComponents(button);

        await message.channel.send({
            embeds: [embed],
            components: [row]
        });

        console.log("🔔 Notification message posted.");

        return;
    }

    // ==========================
    // !testlive
    // ==========================

    if (message.content.toLowerCase() === "!testlive") {

        const channel = await client.channels.fetch(CHANNEL_ID);

        const embed = new EmbedBuilder()
            .setColor(0x9146FF)
            .setTitle(`🔴 ${TWITCH_USERNAME} is LIVE!`)
            .setDescription("🧪 Test Notification")
            .addFields(
                {
                    name: "🎮 Game",
                    value: "Test Game",
                    inline: true
                },
                {
                    name: "📝 Title",
                    value: "Testing Discord Notification",
                    inline: false
                }
            )
            .setTimestamp();

        const button = new ButtonBuilder()
            .setLabel("Watch Stream")
            .setStyle(ButtonStyle.Link)
            .setURL(`https://twitch.tv/${TWITCH_USERNAME}`);

        const row = new ActionRowBuilder()
            .addComponents(button);

        await channel.send({

            content: `<@&${LIVE_ROLE_ID}>`,

            embeds: [embed],
            components: [row]

        });

        console.log("🧪 Test notification sent.");

        return;
    }

});

// =====================================
// BUTTONS
// =====================================

client.on("interactionCreate", async (interaction) => {

    if (!interaction.isButton()) return;

    // ==========================
    // VERIFY BUTTON
    // ==========================

    if (interaction.customId === "agree_rules") {

        const member = interaction.member;

        if (member.roles.cache.has(GHOST_ROLE_ID)) {

            await interaction.reply({
                content: "✅ You're already verified!",
                ephemeral: true
            });

            return;
        }

        await member.roles.add(GHOST_ROLE_ID);

        await interaction.reply({
            content: "👻 Welcome to **The HQ**! You now have access to the server.",
            ephemeral: true
        });

        console.log(`${interaction.user.tag} verified.`);

        return;

    }

    // ==========================
    // LIVE NOTIFICATIONS BUTTON
    // ==========================

    if (interaction.customId === "live_notifications") {

        const member = interaction.member;

        if (member.roles.cache.has(LIVE_ROLE_ID)) {

            await member.roles.remove(LIVE_ROLE_ID);

            await interaction.reply({
                content: "🔕 Live notifications disabled.",
                ephemeral: true
            });

            return;

        }

        await member.roles.add(LIVE_ROLE_ID);

        await interaction.reply({
            content: "🔔 You'll now be notified when Bizzy goes live!",
            ephemeral: true
        });

        console.log(`${interaction.user.tag} toggled live notifications.`);

    }

});

// =====================================
// LOGIN
// =====================================

client.login(DISCORD_TOKEN)
.then(() => {

    console.log("🔐 Login request sent");

})
.catch((err) => {

    console.error("❌ Discord Login Failed");

    console.error(err);

});