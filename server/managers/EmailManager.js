const nodemailer = require('nodemailer')
const fs = require('fs-extra')
const Database = require('../Database')
const Logger = require("../Logger")
const { prepareEpubForDevice } = require('../utils/prepareEbookForDevice')

class EmailManager {
  constructor() { }

  getTransporter() {
    return nodemailer.createTransport(Database.emailSettings.getTransportObject())
  }

  async sendTest(res) {
    Logger.info(`[EmailManager] Sending test email`)
    const transporter = this.getTransporter()

    const success = await transporter.verify().catch((error) => {
      Logger.error(`[EmailManager] Failed to verify SMTP connection config`, error)
      return false
    })

    if (!success) {
      return res.status(400).send('Failed to verify SMTP connection configuration')
    }

    transporter.sendMail({
      from: Database.emailSettings.fromAddress,
      to: Database.emailSettings.testAddress || Database.emailSettings.fromAddress,
      subject: 'Test email from Audiobookshelf',
      text: 'Success!'
    }).then((result) => {
      Logger.info(`[EmailManager] Test email sent successfully`, result)
      res.sendStatus(200)
    }).catch((error) => {
      Logger.error(`[EmailManager] Failed to send test email`, error)
      res.status(400).send(error.message || 'Failed to send test email')
    })
  }

  async sendEBookToDevice(ebookFile, device, res, libraryItem) {
    Logger.info(`[EmailManager] Sending ebook "${ebookFile.metadata.filename}" to device "${device.name}"/"${device.email}"`)
    const transporter = this.getTransporter()

    const success = await transporter.verify().catch((error) => {
      Logger.error(`[EmailManager] Failed to verify SMTP connection config`, error)
      return false
    })

    if (!success) {
      return res.status(400).send('Failed to verify SMTP connection configuration')
    }

    // Prepare epub before sending: correct the filename to the book title and
    // replace the embedded cover with the Audiobookshelf cover. Falls back to
    // sending the original file if preparation fails or the format isn't epub.
    let prepared = null
    try {
      prepared = await prepareEpubForDevice(ebookFile, libraryItem)
    } catch (error) {
      Logger.error(`[EmailManager] Failed to prepare epub, sending original file`, error)
    }

    const attachmentFilename = prepared?.filename || ebookFile.metadata.filename
    const attachmentPath = prepared?.path || ebookFile.metadata.path

    const cleanup = () => {
      if (prepared?.path) {
        fs.remove(prepared.path).catch((error) => {
          Logger.warn(`[EmailManager] Failed to remove temp ebook "${prepared.path}"`, error)
        })
      }
    }

    transporter.sendMail({
      from: Database.emailSettings.fromAddress,
      to: device.email,
      subject: "Here is your Ebook!",
      html: '<div dir="auto"></div>',
      attachments: [
        {
          filename: attachmentFilename,
          path: attachmentPath,
        }
      ]
    }).then((result) => {
      Logger.info(`[EmailManager] Ebook sent to device successfully`, result)
      res.sendStatus(200)
    }).catch((error) => {
      Logger.error(`[EmailManager] Failed to send ebook to device`, error)
      res.status(400).send(error.message || 'Failed to send ebook to device')
    }).finally(cleanup)
  }
}
module.exports = EmailManager
