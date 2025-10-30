import { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  REST,
  Routes,
  AttachmentBuilder
} from 'discord.js';
import { createClient } from './client.js';
import { config } from './tokens.js';
import { promises as fs } from 'fs';
import axios from 'axios';
import play from 'play-dl';
import { Downloader } from '@tobyg74/tiktok-api-dl';

const client = createClient();
const DATA_FILE = './control_panel_data.json';

async function loadData() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return { controlPanels: [] };
  }
}

async function saveData(data) {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

const commands = [
  new SlashCommandBuilder()
    .setName('setup_control_panel')
    .setDescription('🎛️ إعداد لوحة التحكم المركزية (للإداريين فقط)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
];

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(config.token);
  
  try {
    console.log('🔄 جاري تسجيل الأوامر...');
    await rest.put(
      Routes.applicationCommands(config.clientId),
      { body: commands.map(cmd => cmd.toJSON()) }
    );
    console.log('✅ تم تسجيل الأوامر بنجاح!');
  } catch (error) {
    console.error('❌ خطأ في تسجيل الأوامر:', error);
  }
}

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      await handleSlashCommand(interaction);
    } else if (interaction.isButton()) {
      await handleButton(interaction);
    } else if (interaction.isModalSubmit()) {
      await handleModalSubmit(interaction);
    }
  } catch (error) {
    console.error('❌ خطأ في معالجة التفاعل:', error);
    try {
      const errorMessage = { content: '❌ حدث خطأ أثناء معالجة طلبك. حاول مرة أخرى.', flags: 64 };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage).catch(() => {});
      } else {
        await interaction.reply(errorMessage).catch(() => {});
      }
    } catch (e) {
    }
  }
});

async function handleSlashCommand(interaction) {
  if (interaction.commandName === 'setup_control_panel') {
    const havenLogo = new AttachmentBuilder('./haven_logo.png', { name: 'haven_logo.png' });
    
    const embed = new EmbedBuilder()
      .setColor('#808080')
      .setTitle('لوحة التحكم')
      .setDescription('احذر من الشراء للميزة اللتي تريد أحد الخيارات التالية:')
      .setImage('attachment://haven_logo.png')
      .addFields(
        { 
          name: 'Avatar', 
          value: '(لا حد افتر شخص معين)', 
          inline: true 
        },
        { 
          name: 'Banner', 
          value: '(لا حد بنر شخص معين)', 
          inline: true 
        },
        { 
          name: 'Download', 
          value: '(تحميل مقطع)', 
          inline: true 
        },
        { 
          name: 'Boost', 
          value: '(شراء حالة بوبر إشتراك النيترو الخاصة بك)', 
          inline: true 
        },
        { 
          name: 'Nitro', 
          value: '(شراء حالة نيترو إشتراك النيترو الخاصة بك)', 
          inline: true 
        }
      )
      .setFooter({ text: 'Haven Control Panel' })
      .setTimestamp();

    const row1 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('btn_avatar')
          .setLabel('Avatar')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('btn_banner')
          .setLabel('Banner')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('btn_download')
          .setLabel('Download')
          .setStyle(ButtonStyle.Secondary)
      );

    const row2 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('btn_boost')
          .setLabel('Boost')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('btn_nitro')
          .setLabel('Nitro')
          .setStyle(ButtonStyle.Secondary)
      );

    await interaction.reply({ 
      embeds: [embed], 
      components: [row1, row2],
      files: [havenLogo]
    });
    
    const message = await interaction.fetchReply();

    const data = await loadData();
    data.controlPanels = data.controlPanels || [];
    data.controlPanels.push({
      messageId: message.id,
      channelId: interaction.channelId,
      guildId: interaction.guildId,
      createdAt: new Date().toISOString()
    });
    await saveData(data);
  }
}

async function handleButton(interaction) {
  const buttonId = interaction.customId;

  switch (buttonId) {
    case 'btn_avatar':
      await showUserInputModal(interaction, 'avatar');
      break;
    
    case 'btn_banner':
      await showUserInputModal(interaction, 'banner');
      break;
    
    case 'btn_download':
      await showDownloadOptionsModal(interaction);
      break;
    
    case 'btn_boost':
      await showDevelopmentMessage(interaction, 'Boost');
      break;
    
    case 'btn_nitro':
      await showDevelopmentMessage(interaction, 'Nitro');
      break;
  }
}

async function showUserInputModal(interaction, type) {
  const modal = new ModalBuilder()
    .setCustomId(`user_input_${type}`)
    .setTitle(type === 'avatar' ? '👤 الحصول على أفتار' : '🖼️ الحصول على بنر');

  const userInput = new TextInputBuilder()
    .setCustomId('user_identifier')
    .setLabel('معرف المستخدم (ID) أو اسم المستخدم')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('مثال: 123456789 أو @username')
    .setRequired(true);

  const row = new ActionRowBuilder().addComponents(userInput);
  modal.addComponents(row);

  await interaction.showModal(modal);
}

async function showDownloadOptionsModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('download_options')
    .setTitle('📥 تحميل مقطع');

  const urlInput = new TextInputBuilder()
    .setCustomId('media_url')
    .setLabel('رابط الفيديو أو المقطع الصوتي')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('ضع الرابط من YouTube, TikTok, Instagram, إلخ...')
    .setRequired(true);

  const row = new ActionRowBuilder().addComponents(urlInput);
  modal.addComponents(row);

  await interaction.showModal(modal);
}

async function handleModalSubmit(interaction) {
  if (interaction.customId.startsWith('user_input_')) {
    const type = interaction.customId.split('_')[2];
    const identifier = interaction.fields.getTextInputValue('user_identifier');
    
    await interaction.deferReply({ flags: 64 });
    
    try {
      let user = null;
      
      if (/^\d+$/.test(identifier)) {
        user = await client.users.fetch(identifier).catch(() => null);
      }
      
      if (!user && interaction.guild) {
        const searchTerm = identifier.replace(/[@<>]/g, '');
        const members = await interaction.guild.members.fetch();
        const member = members.find(m => 
          m.user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
          m.user.tag.toLowerCase().includes(searchTerm.toLowerCase())
        );
        if (member) user = member.user;
      }

      if (!user) {
        return await interaction.editReply({
          content: '❌ لم أتمكن من العثور على هذا المستخدم. تأكد من المعرف أو الاسم وحاول مرة أخرى.',
        });
      }

      if (type === 'avatar') {
        const avatarURL = user.displayAvatarURL({ dynamic: true, size: 4096 });
        const embed = new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle(`👤 أفتار ${user.tag}`)
          .setDescription(`[📥 تحميل الأفتار بجودة عالية](${avatarURL})`)
          .setImage(avatarURL)
          .setFooter({ text: `User ID: ${user.id}` })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } 
      else if (type === 'banner') {
        const fetchedUser = await client.users.fetch(user.id, { force: true });
        const bannerURL = fetchedUser.bannerURL({ dynamic: true, size: 4096 });

        if (!bannerURL) {
          return await interaction.editReply({
            content: `❌ المستخدم **${user.tag}** لا يملك بنر مخصص.`,
          });
        }

        const embed = new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle(`🖼️ بنر ${user.tag}`)
          .setDescription(`[📥 تحميل البنر بجودة عالية](${bannerURL})`)
          .setImage(bannerURL)
          .setFooter({ text: `User ID: ${user.id}` })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      }
    } catch (error) {
      console.error('خطأ في جلب معلومات المستخدم:', error);
      await interaction.editReply({
        content: '❌ حدث خطأ أثناء جلب المعلومات. حاول مرة أخرى لاحقاً.',
      });
    }
  }
  else if (interaction.customId === 'download_options') {
    const url = interaction.fields.getTextInputValue('media_url');
    
    await interaction.deferReply({ flags: 64 });

    try {
      await handleMediaDownload(interaction, url);
    } catch (error) {
      console.error('خطأ في التحميل:', error);
      await interaction.editReply({
        content: '❌ حدث خطأ أثناء التحميل. تأكد من الرابط وحاول مرة أخرى.',
      });
    }
  }
}

async function handleMediaDownload(interaction, url) {
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    await handleYouTubeDownload(interaction, url);
  } else if (url.includes('tiktok.com')) {
    await handleTikTokDownload(interaction, url);
  } else if (url.includes('instagram.com')) {
    await interaction.editReply({
      content: '⚠️ التحميل من Instagram قيد التطوير حالياً. سيتم إضافته قريباً!',
    });
  } else if (url.includes('snapchat.com')) {
    await interaction.editReply({
      content: '⚠️ التحميل من Snapchat قيد التطوير حالياً. سيتم إضافته قريباً!',
    });
  } else if (url.includes('soundcloud.com')) {
    await interaction.editReply({
      content: '⚠️ التحميل من SoundCloud قيد التطوير حالياً. سيتم إضافته قريباً!',
    });
  } else {
    await interaction.editReply({
      content: '❌ رابط غير مدعوم. الرجاء استخدام روابط من: YouTube, TikTok, Instagram, Snapchat, أو SoundCloud.',
    });
  }
}

async function handleYouTubeDownload(interaction, url) {
  try {
    const info = await play.video_info(url);
    
    if (!info) {
      return await interaction.editReply({
        content: '❌ رابط غير صالح أو لا يمكن الوصول إلى الفيديو.',
      });
    }

    const durationInSeconds = info.video_details.durationInSec;
    const MAX_DURATION = 600;
    
    if (durationInSeconds > MAX_DURATION) {
      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('📺 الفيديو كبير جداً')
        .setDescription(`**${info.video_details.title}**\n\n⚠️ الفيديو أطول من 10 دقائق (${info.video_details.durationRaw}). لا يمكن تحميله بسبب حجم الملف الكبير.`)
        .addFields(
          { name: '⏱️ المدة', value: info.video_details.durationRaw || 'غير متوفر', inline: true },
          { name: '📺 القناة', value: info.video_details.channel?.name || 'غير متوفر', inline: true },
          { name: '🔗 الرابط', value: `[مشاهدة على YouTube](${url})` }
        )
        .setThumbnail(info.video_details.thumbnails[0]?.url)
        .setTimestamp();

      return await interaction.editReply({ embeds: [embed] });
    }

    await interaction.editReply({
      content: `⏬ جاري تحميل: **${info.video_details.title}**\n⏱️ المدة: ${info.video_details.durationRaw}\n\nالرجاء الانتظار...`
    });

    const stream = await play.stream(url, { quality: 2 });
    const fileName = `video_${Date.now()}.mp4`;
    const filePath = `./${fileName}`;
    
    const writeStream = (await import('fs')).createWriteStream(filePath);
    stream.stream.pipe(writeStream);

    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    const fileStats = await fs.stat(filePath);
    const fileSizeMB = fileStats.size / (1024 * 1024);
    
    if (fileSizeMB > 500) {
      await fs.unlink(filePath);
      return await interaction.editReply({
        content: `❌ الفيديو كبير جداً (${fileSizeMB.toFixed(2)} MB). الحد الأقصى 500 MB.`,
      });
    }

    const attachment = new AttachmentBuilder(filePath, { name: fileName });

    let warningMessage = `✅ تم تحميل: **${info.video_details.title}**\n📺 القناة: ${info.video_details.channel?.name || 'غير متوفر'}`;
    
    if (fileSizeMB > 25 && fileSizeMB <= 50) {
      warningMessage += `\n\n⚠️ حجم الفيديو ${fileSizeMB.toFixed(2)} MB - يحتاج Discord Nitro Classic لعرضه بشكل صحيح.`;
    } else if (fileSizeMB > 50) {
      warningMessage += `\n\n⚠️ حجم الفيديو ${fileSizeMB.toFixed(2)} MB - يحتاج Discord Nitro أو سيرفر Boosted لعرضه بشكل صحيح.`;
    }

    await interaction.editReply({
      content: warningMessage,
      files: [attachment]
    });

    await fs.unlink(filePath).catch(() => {});
    
  } catch (error) {
    console.error('خطأ في معالجة رابط YouTube:', error);
    await interaction.editReply({
      content: '❌ حدث خطأ في معالجة الرابط أو التحميل. تأكد من أن الرابط صحيح أو حاول مرة أخرى.',
    });
  }
}

async function handleTikTokDownload(interaction, url) {
  try {
    await interaction.editReply({
      content: `⏬ جاري تحميل الفيديو من TikTok...\n\nالرجاء الانتظار...`
    });

    const result = await Downloader(url, { version: "v3" });
    
    console.log('TikTok Result:', JSON.stringify(result, null, 2));
    
    if (!result || result.status !== "success") {
      return await interaction.editReply({
        content: '❌ رابط غير صالح أو لا يمكن الوصول إلى الفيديو.',
      });
    }

    const videoData = result.result;
    let downloadUrl;

    if (videoData.type === "image") {
      return await interaction.editReply({
        content: '⚠️ هذا المنشور يحتوي على صور. حالياً البوت يدعم تحميل الفيديوهات فقط.',
      });
    }

    downloadUrl = videoData.videoSD || videoData.videoHD || videoData.videoWatermark || videoData.video;

    if (!downloadUrl) {
      console.log('Video Data structure:', JSON.stringify(videoData, null, 2));
      return await interaction.editReply({
        content: '❌ لا يمكن الحصول على رابط التحميل. حاول مرة أخرى.',
      });
    }

    await interaction.editReply({
      content: `⏬ جاري التحميل من السيرفر...\n\nهذا قد يستغرق دقيقة أو اثنتين للملفات الكبيرة...`
    });

    const response = await axios({
      method: 'GET',
      url: downloadUrl,
      responseType: 'stream',
      timeout: 300000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    const fileName = `tiktok_${Date.now()}.mp4`;
    const filePath = `./${fileName}`;
    const writeStream = (await import('fs')).createWriteStream(filePath);
    
    response.data.pipe(writeStream);

    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    await interaction.editReply({
      content: `📤 جاري رفع الملف إلى Discord...\n\nالرجاء الانتظار...`
    });

    const fileStats = await fs.stat(filePath);
    const fileSizeMB = fileStats.size / (1024 * 1024);
    
    if (fileSizeMB > 500) {
      await fs.unlink(filePath);
      return await interaction.editReply({
        content: `❌ الفيديو كبير جداً (${fileSizeMB.toFixed(2)} MB). الحد الأقصى 500 MB.`,
      });
    }

    const attachment = new AttachmentBuilder(filePath, { name: fileName });

    let warningMessage = `✅ تم تحميل: **${videoData.desc || 'فيديو TikTok'}**\n👤 المستخدم: ${videoData.author?.nickname || 'غير متوفر'}`;
    
    if (fileSizeMB > 25 && fileSizeMB <= 50) {
      warningMessage += `\n\n⚠️ حجم الفيديو ${fileSizeMB.toFixed(2)} MB - يحتاج Discord Nitro Classic لعرضه بشكل صحيح.`;
    } else if (fileSizeMB > 50) {
      warningMessage += `\n\n⚠️ حجم الفيديو ${fileSizeMB.toFixed(2)} MB - يحتاج Discord Nitro أو سيرفر Boosted لعرضه بشكل صحيح.`;
    }

    await interaction.editReply({
      content: warningMessage,
      files: [attachment]
    });

    await fs.unlink(filePath).catch(() => {});
    
  } catch (error) {
    console.error('خطأ في معالجة رابط TikTok:', error);
    await interaction.editReply({
      content: '❌ حدث خطأ في معالجة الرابط أو التحميل. تأكد من أن الرابط صحيح أو حاول مرة أخرى.',
    });
  }
}

async function showDevelopmentMessage(interaction, featureName) {
  const embed = new EmbedBuilder()
    .setColor('#FFA500')
    .setTitle('🚧 قيد التطوير')
    .setDescription(`**ميزة ${featureName}** قيد التطوير حالياً وستكون متاحة قريباً!`)
    .addFields(
      { name: '📋 الحالة', value: 'قيد التطوير النشط', inline: true },
      { name: '📅 متوقع', value: 'التحديث القادم', inline: true }
    )
    .setFooter({ text: 'شكراً لصبركم!' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], flags: 64 });
}

async function showDevInfo(interaction) {
  const embed = new EmbedBuilder()
    .setColor('#00D166')
    .setTitle('ℹ️ معلومات تطوير البوت')
    .setDescription('**Haven Control Bot** - بوت ديسكورد بلوحة تحكم مركزية شاملة')
    .addFields(
      { 
        name: '✅ الميزات المتاحة حالياً', 
        value: '• الحصول على أفتار المستخدمين\n• الحصول على بنر المستخدمين\n• تحميل وإرسال فيديوهات YouTube مباشرة\n• تحميل وإرسال فيديوهات TikTok مباشرة', 
        inline: false 
      },
      { 
        name: '🚧 قيد التطوير', 
        value: '• تحميل من Instagram\n• تحميل من Snapchat, SoundCloud\n• فحص البوست من الروابط', 
        inline: false 
      },
      { 
        name: '🔮 مخطط مستقبلاً', 
        value: '• اختيار جودة التحميل\n• تحويل صيغ الملفات\n• نظام السجلات والإحصائيات\n• إعدادات مخصصة لكل سيرفر', 
        inline: false 
      },
      { 
        name: '📊 إحصائيات البوت', 
        value: `الخوادم: ${client.guilds.cache.size}\nوقت التشغيل: ${Math.floor(client.uptime / 1000 / 60)} دقيقة`, 
        inline: false 
      }
    )
    .setFooter({ text: 'Haven Control Bot v1.0.0' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function startBot() {
  try {
    await client.login(config.token);
    await registerCommands();
  } catch (error) {
    console.error('❌ فشل تشغيل البوت:', error);
    console.log('\n⚠️ تأكد من:');
    console.log('1. أن التوكن صحيح في ملف tokens.js أو متغيرات البيئة');
    console.log('2. أن البوت لديه الصلاحيات المناسبة');
    console.log('3. أن CLIENT_ID موجود ومطابق لمعرف البوت');
    process.exit(1);
  }
}

startBot();
