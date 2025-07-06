/**
 * MIGRATION v2.25.1
 * 
 * Convert wishlist items with multiple formats to separate items for each format
 */

const Logger = require('../Logger')

/**
 * @param {import('sequelize').QueryInterface} queryInterface - Sequelize Query Interface
 * @param {import('../Database')} Database - Database instance
 */
async function up(queryInterface, Database) {
  Logger.info('[Migration v2.25.1] Converting wishlist formats to separate items...')

  // First, add the new format column
  await queryInterface.addColumn('wishlistItems', 'format', {
    type: 'TEXT',
    allowNull: true
  })

  // Get all existing wishlist items with formats
  const items = await queryInterface.sequelize.query(
    'SELECT id, title, author, notes, thumbnail, publishedDate, description, isbn, pageCount, categories, formats, pendingDownloads, userId, createdAt, updatedAt FROM wishlistItems WHERE formats IS NOT NULL AND formats != "[]"',
    { type: queryInterface.sequelize.QueryTypes.SELECT }
  )

  Logger.info(`[Migration v2.25.1] Found ${items.length} items to process`)

  // Process each item
  for (const item of items) {
    let formats = []
    try {
      formats = JSON.parse(item.formats) || []
    } catch (error) {
      Logger.warn(`[Migration v2.25.1] Could not parse formats for item ${item.id}:`, item.formats)
      continue
    }

    if (formats.length === 0) {
      continue
    }

    if (formats.length === 1) {
      // Single format, just update the format field
      await queryInterface.sequelize.query(
        'UPDATE wishlistItems SET format = ? WHERE id = ?',
        { replacements: [formats[0], item.id] }
      )
      Logger.debug(`[Migration v2.25.1] Updated single format item ${item.id} to format: ${formats[0]}`)
    } else {
      // Multiple formats, create separate items for each format
      Logger.debug(`[Migration v2.25.1] Creating separate items for ${item.id} with formats:`, formats)
      
      for (let i = 0; i < formats.length; i++) {
        const format = formats[i]
        
        if (i === 0) {
          // Update the first item to have the first format
          await queryInterface.sequelize.query(
            'UPDATE wishlistItems SET format = ? WHERE id = ?',
            { replacements: [format, item.id] }
          )
        } else {
          // Create a new item for each additional format
          const newId = Database.uuidv4()
          await queryInterface.sequelize.query(
            `INSERT INTO wishlistItems (id, title, author, notes, thumbnail, publishedDate, description, isbn, pageCount, categories, format, pendingDownloads, userId, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            { 
              replacements: [
                newId,
                item.title,
                item.author,
                item.notes,
                item.thumbnail,
                item.publishedDate,
                item.description,
                item.isbn,
                item.pageCount,
                item.categories,
                format,
                item.pendingDownloads,
                item.userId,
                item.createdAt,
                item.updatedAt
              ]
            }
          )
          Logger.debug(`[Migration v2.25.1] Created new item ${newId} for format: ${format}`)
        }
      }
    }
  }

  // Remove the old formats column
  await queryInterface.removeColumn('wishlistItems', 'formats')

  Logger.info('[Migration v2.25.1] Migration completed successfully')
}

/**
 * @param {import('sequelize').QueryInterface} queryInterface - Sequelize Query Interface  
 */
async function down(queryInterface) {
  Logger.info('[Migration v2.25.1] Reverting wishlist format separation...')

  // Add back the formats column
  await queryInterface.addColumn('wishlistItems', 'formats', {
    type: 'TEXT',
    allowNull: true,
    defaultValue: '[]'
  })

  // This is a destructive migration - we can't perfectly restore the original state
  // since we've split items. We'll just set formats to an array with the single format
  await queryInterface.sequelize.query(
    'UPDATE wishlistItems SET formats = \'["' || format || '"]\' WHERE format IS NOT NULL'
  )

  // Remove the format column
  await queryInterface.removeColumn('wishlistItems', 'format')

  Logger.info('[Migration v2.25.1] Rollback completed')
}

module.exports = { up, down } 