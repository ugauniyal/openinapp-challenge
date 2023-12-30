const fs = require('fs').promises;
const path = require('path');
const process = require('process');
const { authenticate } = require('@google-cloud/local-auth');
const { google } = require('googleapis');



const SCOPES = ['https://www.googleapis.com/auth/gmail.modify']; // Scope for gmail
const TOKEN_PATH = path.join(process.cwd(), 'token.json'); // Token file generated after authorization containing refresh token
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json'); // Credentials file including all the client id and secrets.



// Load the credential file
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content); 
    return google.auth.fromJSON(credentials);
  } catch (err) {
    console.log(err);
    return null;
  }
}

// Save the refresh token file as token.json
async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

// Authorize and create the token.json file if not already exists otherwise authorize and move forward.
async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (!client) {
    client = await authenticate({
      scopes: SCOPES,
      keyfilePath: CREDENTIALS_PATH,
    });
    if (client.credentials) {
      await saveCredentials(client);
    }
  }
  return client;
}


// Get all the threads where the user has replied to so that we can filter out the new and unread mails afterwards by excluding all replied threads.
async function getRepliedThreads(gmail) {
  const res = await gmail.users.messages.list({ userId: 'me', q: 'is:sent' }); // Get the sent mails by me
  const messages = res.data.messages || [];
  return messages.map((message) => message.threadId);
}


// Now reply to all the mails which are unread, not replied and are not in our custom label.
async function identifyAndReplyToThreads(auth, labelId, maxResults) {
  const gmail = google.gmail({ version: 'v1', auth });
  const repliedThreads = await getRepliedThreads(gmail);
  const threads = await getThreads(gmail, maxResults);

  if (!threads || threads.length === 0) {
    console.log('No threads found.');
    return;
  }

  for (const thread of threads) {
    await processThread(auth, gmail, thread, repliedThreads, labelId);

  }
}


// Get all the threads of mails
async function getThreads(gmail, maxResults) {
  const res = await gmail.users.threads.list({ userId: 'me', maxResults });
  return res.data.threads || [];
}



// Send the mail to all the threads which are now filtered.
async function processThread(_auth, gmail, thread, repliedThreads, labelId) {
  const threadId = thread.id;

  // Send mail to all the threads which are not in replied threads i.e. which are not being replied to yet.
  if (!repliedThreads.includes(threadId)) {
    const threadRes = await gmail.users.threads.get({ userId: 'me', id: threadId });
    const messages = threadRes.data.messages;

    const sentByYou = messages.some((message) => isSentByYou(message));

    if (!sentByYou) {
      const threadLabels = threadRes.data.labelIds || [];

      if (!threadLabels.includes(labelId)) {
        const recipientEmail = getLastRecipient(messages);

        const replyMessage = `Hello, will get back soon.`;

        await sendReply(gmail, threadId, recipientEmail, replyMessage);

        console.log(`Replied to thread with ID: ${threadId}`);

        await applyLabelToThread(_auth, threadId, labelId); // Apply label to all the filtered emails.
      }
    }
  }
}

// Check if the mail is sent by the user so that we can exclude it after.
function isSentByYou(message) {
  const headers = message.payload.headers;
  const fromHeader = headers.find((header) => header.name === 'From');
  return fromHeader && fromHeader.value === 'example@example.com';
}


// Get the recipient email address for further procedure.
function getLastRecipient(messages) {
  const lastMessage = messages[messages.length - 1];
  const headers = lastMessage.payload.headers;
  const toHeader = headers.find((header) => header.name === 'To');
  return toHeader ? toHeader.value : '';
}

// Send the reply to the filtered emails
async function sendReply(gmail, threadId, recipientEmail, replyMessage) {
  await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      threadId,
      raw: Buffer.from(
        `To: ${recipientEmail}\r\n` +
        `Subject: Re: Your Subject\r\n\r\n` +
        `${replyMessage}`
      ).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
    },
  });
}

// Get the label id so that we can check if the label is already created or not.
async function getLabelId(auth, labelName) {
  const gmail = google.gmail({ version: 'v1', auth });
  const res = await gmail.users.labels.list({ userId: 'me' });
  const labels = res.data.labels;

  const existingLabel = labels.find((label) => label.name === labelName);
  if (existingLabel) {
    return existingLabel.id;
  } else {
    const createdLabel = await createLabel(auth, labelName);
    return createdLabel;
  }
}

// Function to create the label if not yet created
async function createLabel(auth, labelName) {
  const gmail = google.gmail({ version: 'v1', auth });
  const res = await gmail.users.labels.create({
    userId: 'me',
    requestBody: {
      labelListVisibility: 'labelShow',
      messageListVisibility: 'show',
      name: labelName,
    },
  });
  console.log(`Label created: ${labelName}`);
  return res.data.id;
}

// Function to apply label to all the filtered threads and mark them as read.
async function applyLabelToThread(auth, threadId, labelId) {
  const gmail = google.gmail({ version: 'v1', auth });
  await gmail.users.threads.modify({
    userId: 'me',
    id: threadId,
    requestBody: {
      addLabelIds: [labelId],
      removeLabelIds: ['UNREAD'],
    },
  });
  console.log(`Tagged thread ${threadId} with label ${labelId}`);
}


// Scheduling the task of sending mail and creating and pushing mails to label, to run randomly in a set of interval.
async function scheduledTask() {
  const auth = await authorize();
  const labelName = 'ExampleLabel';
  const labelId = await getLabelId(auth, labelName);
  const maxResults = 16; // Set the max results as much as you want so that it will run on that much mail. I kept it just for test purpose, you can also remove it.

  const randomTimeout = Math.floor(Math.random() * (120 - 45 + 1) + 45) * 1000; // Creating a time interval between 45 to 120 seconds.
  console.log(`Next run in ${randomTimeout / 1000} seconds...`);

  await identifyAndReplyToThreads(auth, labelId, maxResults);  // Calling the function to reply to all the filtered mails. 


  setTimeout(scheduledTask, randomTimeout); // Setting the task to be executed between every (45 to 120) seconds.
}

scheduledTask();
