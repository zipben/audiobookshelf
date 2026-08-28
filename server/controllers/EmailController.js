const { Request, Response, NextFunction } = require('express')
const Logger = require('../Logger')
const SocketAuthority = require('../SocketAuthority')
const Database = require('../Database')

/**
 * @typedef RequestUserObject
 * @property {import('../models/User')} user
 *
 * @typedef {Request & RequestUserObject} RequestWithUser
 */

class EmailController {
  constructor() {}

  /**
   * GET: /api/emails/settings
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  getSettings(req, res) {
    res.json({
      settings: Database.emailSettings
    })
  }

  /**
   * PATCH: /api/emails/settings
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async updateSettings(req, res) {
    const updated = Database.emailSettings.update(req.body)
    if (updated) {
      await Database.updateSetting(Database.emailSettings)
    }
    res.json({
      settings: Database.emailSettings
    })
  }

  /**
   * POST: /api/emails/test
   *
   * @this {import('../routers/ApiRouter')}
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async sendTest(req, res) {
    this.emailManager.sendTest(res)
  }

  /**
   * POST: /api/emails/ereader-devices
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async updateEReaderDevices(req, res) {
    if (!req.body.ereaderDevices || !Array.isArray(req.body.ereaderDevices)) {
      return res.status(400).send('Invalid payload. ereaderDevices array required')
    }

    const ereaderDevices = req.body.ereaderDevices
    for (const device of ereaderDevices) {
      if (!device.name || !device.email) {
        return res.status(400).send('Invalid payload. ereaderDevices array items must have name and email')
      }
    }

    const updated = Database.emailSettings.update({
      ereaderDevices
    })
    if (updated) {
      await Database.updateSetting(Database.emailSettings)
      SocketAuthority.adminEmitter('ereader-devices-updated', {
        ereaderDevices: Database.emailSettings.ereaderDevices
      })
    }
    res.json({
      ereaderDevices: Database.emailSettings.ereaderDevices
    })
  }

  /**
   * POST: /api/emails/send-ebook-to-device
   * Send ebook to device
   * User must have access to device and library item
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async sendEBookToDevice(req, res) {
    Logger.debug(`[EmailController] Send ebook to device requested by user "${req.user.username}" for libraryItemId=${req.body.libraryItemId}, deviceName=${req.body.deviceName}`)

    const device = Database.emailSettings.getEReaderDevice(req.body.deviceName)
    if (!device) {
      return res.status(404).send('Ereader device not found')
    }

    // Check user has access to device
    if (!Database.emailSettings.checkUserCanAccessDevice(device, req.user)) {
      return res.sendStatus(403)
    }

    const libraryItem = await Database.libraryItemModel.getExpandedById(req.body.libraryItemId)
    if (!libraryItem) {
      return res.status(404).send('Library item not found')
    }

    // Check user has access to library item
    if (!req.user.checkCanAccessLibraryItem(libraryItem)) {
      return res.sendStatus(403)
    }

    const ebookFile = libraryItem.media.ebookFile
    if (!ebookFile) {
      return res.status(404).send('Ebook file not found')
    }

    // Block PDF files from being sent to a device (server setting)
    if (Database.serverSettings.blockPdfSendToDevice && ebookFile.ebookFormat?.toLowerCase() === 'pdf') {
      Logger.info(`[EmailController] Blocked sending PDF ebook to device (blockPdfSendToDevice enabled) for libraryItemId=${libraryItem.id}`)
      return res.status(400).send('PDF files cannot be sent to a device')
    }

    // Block ebook files larger than the configured max file size (server setting, in MB, 0 = no limit)
    const maxEbookFileSizeMB = Database.serverSettings.maxEbookFileSizeMB
    const ebookFileSize = ebookFile.metadata?.size || 0
    if (maxEbookFileSizeMB > 0 && ebookFileSize > maxEbookFileSizeMB * 1024 * 1024) {
      Logger.info(`[EmailController] Blocked sending ebook to device. File size ${ebookFileSize} bytes exceeds limit of ${maxEbookFileSizeMB}MB for libraryItemId=${libraryItem.id}`)
      return res.status(400).send(`Ebook file is too large to send to a device (max ${maxEbookFileSizeMB} MB)`)
    }

    this.emailManager.sendEBookToDevice(ebookFile, device, res, libraryItem)
  }

  /**
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   * @param {NextFunction} next
   */
  adminMiddleware(req, res, next) {
    if (!req.user.isAdminOrUp) {
      return res.sendStatus(404)
    }

    next()
  }
}
module.exports = new EmailController()
