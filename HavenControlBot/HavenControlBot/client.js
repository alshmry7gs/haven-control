import { Client, GatewayIntentBits, Partials, Collection } from 'discord.js';

export function createClient() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers,
    ],
    partials: [
      Partials.Message,
      Partials.Channel,
      Partials.Reaction,
      Partials.User,
    ],
  });

  client.commands = new Collection();

  client.once('ready', () => {
    console.log(`✅ تم تشغيل البوت بنجاح! اسم البوت: ${client.user.tag}`);
    console.log(`📊 عدد الخوادم: ${client.guilds.cache.size}`);
    client.user.setPresence({
      activities: [{ name: 'Haven Control Panel | /setup_control_panel' }],
      status: 'online',
    });
  });

  client.on('error', (error) => {
    console.error('❌ خطأ في البوت:', error);
  });

  return client;
}
