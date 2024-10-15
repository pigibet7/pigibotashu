const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const express = require('express');
const db = require('./database');
const { FieldValue } = require('firebase-admin/firestore');
require('dotenv').config();

const token = process.env.BOT_TOKEN3; 
const bot = new TelegramBot(token, { polling: true });
const app = express();  // Initialize express app

// Set up Express routes
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Telegram Bot is running');
});

// Example route to get user data from Firestore
app.get('/user/:chatId', async (req, res) => {
  const chatId = req.params.chatId;
  try {
    const userRef = db.collection('pigibetdb').doc(chatId.toString());
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).send('User not found');
    }

    res.json(userDoc.data());
  } catch (error) {
    res.status(500).send('Error fetching user data');
  }
});

// Start Express server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Express server is running on port ${port}`);
});


// Telegram bot logic remains the same
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userName = msg.from.first_name;
  const lastName = msg.from.last_name;
  const referrerId = msg.text.split(' ')[1]; 

  const userRef = db.collection('pigibetdb').doc(chatId.toString());
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    const newUser = {
      referId: referrerId || null,
      referIdLevel2: null,
      referIdLevel3: null,
      level1User: [],
      level2User: [],
      level3User: [],
    };

    if (referrerId) {
      const referrerRef = db.collection('pigibetdb').doc(referrerId);
      const referrerDoc = await referrerRef.get();

      if (referrerDoc.exists) {
        const referrerData = referrerDoc.data();

        newUser.referIdLevel2 = referrerData.referId || null;
        newUser.referIdLevel3 = referrerData.referIdLevel2 || null;

        await referrerRef.update({
          coinBalance: FieldValue.increment(100000),
          invitedUsers: FieldValue.arrayUnion({ chatId }),
          level1User: FieldValue.arrayUnion(chatId),
        });

        if (newUser.referIdLevel2) {
          const level2Ref = db.collection('pigibetdb').doc(newUser.referIdLevel2);
          await level2Ref.update({
            coinBalance: FieldValue.increment(100000),
            level2User: FieldValue.arrayUnion(chatId),
          });
        }

        if (newUser.referIdLevel3) {
          const level3Ref = db.collection('pigibetdb').doc(newUser.referIdLevel3);
          await level3Ref.update({
            coinBalance: FieldValue.increment(100000),
            level3User: FieldValue.arrayUnion(chatId),
          });
        }
      }
    }

    await userRef.set(newUser);
  } else {
    if (!userDoc.data().referId && referrerId) {
      const referrerRef = db.collection('pigibetdb').doc(referrerId);
      const referrerDoc = await referrerRef.get();
      const referrerData = referrerDoc.data();

      await userRef.update({
        referId: referrerId,
        referIdLevel2: referrerData.referId || null,
        referIdLevel3: referrerData.referIdLevel2 || null,
      });

      await referrerRef.update({
        level1User: FieldValue.arrayUnion(chatId),
      });

      if (referrerData.referId) {
        const level2Ref = db.collection('pigibetdb').doc(referrerData.referId);
        await level2Ref.update({
          level2User: FieldValue.arrayUnion(chatId),
        });
      }

      if (referrerData.referIdLevel2) {
        const level3Ref = db.collection('pigibetdb').doc(referrerData.referIdLevel2);
        await level3Ref.update({
          level3User: FieldValue.arrayUnion(chatId),
        });
      }
    }

    await userRef.update({ firstName: userName });
  }

  const referralLink = `https://t.me/Pigibet_bot?start=${chatId}`;
 const message = `Hello ${userName} ${lastName}!

Welcome to PIGITAP – the first and only *Tap-to-Earn* game with real utility! 🎮💰 

In this exciting mini app, you can earn rewards just by tapping, and soon, you'll experience the launch of PIGIBET Casino Games, where our PIGI token will power the entire ecosystem. Get ready for a thrilling gaming adventure with real earning potential! 

Stay tuned and start tapping to win with PIGITAP!

Your referral link is: 
<a href="${referralLink}">${referralLink}</a>

🚀Get 100,000 Free $PIGI tokens on joining the app. 

🚀Refer and Earn 300,000 $PIGI tokens in 3 levels. Each level 100,000 tokens. 

🚀Complete social media tasks and earn more tokens. 

🚀Purchase $PIGI tokens by paying TON and become an early  holder.

`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: 'Join Community 🧑‍💻', url: 'https://t.me/pigi_bet_channel' }
      ],
      [
        { text: 'Play Now', web_app: { url: 'https://pigibetapp.onrender.com/' } }
      ]
    ]
  };
  const photo = './assets/logo.jpg';

  bot.sendPhoto(chatId, fs.readFileSync(photo), {
    caption: message,
    parse_mode: 'HTML',
    reply_markup: keyboard
  });
});


