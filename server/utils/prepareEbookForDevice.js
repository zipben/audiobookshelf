const Path = require('path')
const fs = require('fs-extra')
const sharp = require('sharp')
const Logger = require('../Logger')
const StreamZip = require('../libs/nodeStreamZip')
const archiver = require('../libs/archiver')
const parseEpubMetadata = require('./parsers/parseEpubMetadata')
const { sanitizeFilename } = require('./fileUtils')

/**
 * Normalize a zip entry path for comparison (decode percent-encoding, forward slashes)
 * @param {string} p
 * @returns {string}
 */
function normalizeEntryPath(p) {
  if (!p) return ''
  let decoded = p
  try {
    decoded = decodeURIComponent(p)
  } catch {
    // leave as-is if it isn't valid percent-encoding
  }
  return decoded.replace(/\\/g, '/')
}

/**
 * Convert the Audiobookshelf cover to a buffer matching the epub cover's format
 * @param {string} coverPath - absolute path to the ABS cover image
 * @param {string} epubCoverEntryPath - internal epub path of the cover (used for target format)
 * @returns {Promise<Buffer|null>}
 */
async function buildReplacementCover(coverPath, epubCoverEntryPath) {
  if (!coverPath || !(await fs.pathExists(coverPath))) return null

  const ext = Path.extname(epubCoverEntryPath || '').toLowerCase()
  const transformer = sharp(coverPath)
  if (ext === '.png') {
    return transformer.png().toBuffer()
  }
  // Default to jpeg for .jpg/.jpeg and anything else (most epub covers are jpeg)
  return transformer.jpeg().toBuffer()
}

/**
 * Rebuild an epub into a temp file with:
 *  - the emailed filename corrected to the Audiobookshelf book title
 *  - the embedded cover image replaced with the Audiobookshelf cover
 *
 * Never modifies the original library file. Returns null for non-epub formats
 * so the caller sends the original file as-is.
 *
 * @param {import('../models/Book').EBookFileObject} ebookFile
 * @param {import('../models/LibraryItem')} libraryItem
 * @returns {Promise<{ path: string, filename: string }|null>}
 */
async function prepareEpubForDevice(ebookFile, libraryItem) {
  if (ebookFile?.ebookFormat !== 'epub') return null

  const sourcePath = ebookFile.metadata.path
  const title = libraryItem?.media?.title || Path.basename(sourcePath, Path.extname(sourcePath))
  const filename = `${sanitizeFilename(title)}.epub`

  // Locate the epub's internal cover image path (e.g. "OEBPS/images/cover.jpg")
  let epubCoverEntryPath = null
  try {
    const parsed = await parseEpubMetadata.parse(ebookFile)
    epubCoverEntryPath = parsed?.ebookCoverPath || null
  } catch (error) {
    Logger.warn(`[prepareEbookForDevice] Failed to parse epub cover path for "${sourcePath}"`, error)
  }

  // Build the replacement cover buffer from the ABS cover (may be null -> keep original cover)
  let replacementCover = null
  if (epubCoverEntryPath) {
    try {
      replacementCover = await buildReplacementCover(libraryItem?.media?.coverPath, epubCoverEntryPath)
    } catch (error) {
      Logger.warn(`[prepareEbookForDevice] Failed to build replacement cover for "${sourcePath}"`, error)
    }
  }

  const tempDir = Path.join(global.MetadataPath, 'cache/send-ebook')
  await fs.ensureDir(tempDir)
  const outputPath = Path.join(tempDir, `${libraryItem?.id || 'ebook'}-${Date.now()}.epub`)

  const normalizedCoverPath = normalizeEntryPath(epubCoverEntryPath)
  const zip = new StreamZip.async({ file: sourcePath })

  try {
    const entries = await zip.entries()
    const output = fs.createWriteStream(outputPath)
    const archive = archiver('zip', { zlib: { level: 5 } })

    const finished = new Promise((resolve, reject) => {
      output.on('close', resolve)
      output.on('error', reject)
      archive.on('error', reject)
    })
    archive.pipe(output)

    // The mimetype file must be first and stored uncompressed per the epub spec
    if (entries['mimetype']) {
      const mimetypeData = await zip.entryData('mimetype')
      archive.append(mimetypeData, { name: 'mimetype', store: true })
    }

    for (const name of Object.keys(entries)) {
      const entry = entries[name]
      if (entry.isDirectory || name === 'mimetype') continue

      if (replacementCover && normalizeEntryPath(name) === normalizedCoverPath) {
        archive.append(replacementCover, { name })
      } else {
        const data = await zip.entryData(name)
        archive.append(data, { name })
      }
    }

    await archive.finalize()
    await finished
  } catch (error) {
    await zip.close().catch(() => {})
    await fs.remove(outputPath).catch(() => {})
    throw error
  }

  await zip.close().catch((error) => {
    Logger.warn(`[prepareEbookForDevice] Failed to close source epub "${sourcePath}"`, error)
  })

  Logger.info(`[prepareEbookForDevice] Prepared epub "${filename}" at "${outputPath}"`)
  return { path: outputPath, filename }
}
module.exports.prepareEpubForDevice = prepareEpubForDevice
