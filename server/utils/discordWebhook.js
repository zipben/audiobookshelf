const axios = require('axios')
const FormData = require('form-data')
const Path = require('path')
const fs = require('../libs/fsExtra')
const Logger = require('../Logger')

// e.g. https://discord.com/api/webhooks/123456789012345678/aBcDeF... (discord.com or discordapp.com)
const DISCORD_WEBHOOK_URL_REGEX = /^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/(?:v\d+\/)?webhooks\/\d+\/[\w-]+$/

// Blurple - matches Discord's brand color
const EMBED_COLOR = 5793266

/**
 * Validate that a string is a Discord webhook URL
 *
 * @param {string} url
 * @returns {boolean}
 */
function isValidDiscordWebhookUrl(url) {
  if (!url || typeof url !== 'string') return false
  return DISCORD_WEBHOOK_URL_REGEX.test(url.trim())
}
module.exports.isValidDiscordWebhookUrl = isValidDiscordWebhookUrl

/**
 * Send a "new library item added" notification directly to a Discord webhook.
 *
 * The cover image (if present on disk) is uploaded as a multipart attachment and referenced
 * via `attachment://` so a publicly reachable server URL is not required.
 *
 * @param {Object} library - Library model instance the item belongs to
 * @param {import('../models/LibraryItem')} libraryItem
 * @returns {Promise<boolean>} true if the notification was sent successfully
 */
async function sendLibraryItemAddedNotification(library, libraryItem) {
  const webhookUrl = library?.settings?.discordWebhookUrl
  if (!library?.settings?.discordNotificationsEnabled || !webhookUrl) return false

  if (!isValidDiscordWebhookUrl(webhookUrl)) {
    Logger.error(`[DiscordWebhook] Library "${library.name}" has an invalid Discord webhook URL - skipping notification`)
    return false
  }

  const title = libraryItem.title || 'Unknown Title'
  const author = libraryItem.authorNamesFirstLast || ''
  const mediaTypeLabel = libraryItem.mediaType === 'podcast' ? 'Podcast' : 'Book'

  const embed = {
    title: `New ${mediaTypeLabel} Added`,
    description: author ? `**${title}**\nby ${author}` : `**${title}**`,
    color: EMBED_COLOR,
    footer: {
      text: library.name || 'Audiobookshelf'
    },
    timestamp: new Date().toISOString()
  }

  const form = new FormData()

  // Attach the cover image if it exists on disk
  const coverPath = libraryItem.media?.coverPath
  if (coverPath && (await fs.pathExists(coverPath))) {
    try {
      const coverBuffer = await fs.readFile(coverPath)
      const ext = Path.extname(coverPath).slice(1).toLowerCase() || 'jpg'
      const filename = `cover.${ext === 'jpeg' ? 'jpg' : ext}`
      form.append('files[0]', coverBuffer, { filename })
      embed.thumbnail = { url: `attachment://${filename}` }
    } catch (error) {
      Logger.warn(`[DiscordWebhook] Failed to read cover for "${title}" - sending without cover`, error)
    }
  }

  form.append('payload_json', JSON.stringify({ embeds: [embed] }))

  try {
    await axios.post(webhookUrl, form, {
      headers: form.getHeaders(),
      timeout: 6000
    })
    Logger.info(`[DiscordWebhook] Sent new ${mediaTypeLabel.toLowerCase()} notification for "${title}" to library "${library.name}" channel`)
    return true
  } catch (error) {
    Logger.error(`[DiscordWebhook] Failed to send notification for "${title}"`, error?.response?.data || error?.message || error)
    return false
  }
}
module.exports.sendLibraryItemAddedNotification = sendLibraryItemAddedNotification
