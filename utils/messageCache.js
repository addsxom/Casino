const MAX_CACHED_MESSAGES = 5000;
const messageCache = new Map();

function cacheMessage(message) {
  if (!message?.guild || !message.author || message.author.bot) return;

  messageCache.set(message.id, {
    authorId: message.author.id,
    authorTag: message.author.tag,
    content: message.content || '',
    channelId: message.channel.id,
    createdAt: Date.now()
  });

  if (messageCache.size > MAX_CACHED_MESSAGES) {
    const oldestKey = messageCache.keys().next().value;
    if (oldestKey) messageCache.delete(oldestKey);
  }
}

function getCachedMessage(messageId) {
  return messageCache.get(messageId) || null;
}

function deleteCachedMessage(messageId) {
  messageCache.delete(messageId);
}

module.exports = {
  cacheMessage,
  getCachedMessage,
  deleteCachedMessage
};
