/**
 * MIGRATION v2.25.1
 * 
 * Convert wishlist items with multiple formats to separate items for each format
 */

const { DataTypes } = require('sequelize')
const Logger = require('../Logger')

/**
 * @param {{ context: { queryInterface: import('sequelize').QueryInterface, Database: import('../Database'), logger: import('../Logger') }}} params
 */
async function up({ context: { queryInterface, Database, logger } }) {
  logger.info('[Migration v2.25.1] Converting wishlist formats to separate items...')

  // First, check if format column exists
  const [columns] = await queryInterface.sequelize.query(
    "PRAGMA table_info(wishlistItems)",
    { type: queryInterface.sequelize.QueryTypes.SELECT }
  )
  
  const hasFormat = columns.some(col => col.name === 'format')
  
  if (!hasFormat) {
    // Add the new format column using raw SQL
    await queryInterface.sequelize.query(
      'ALTER TABLE wishlistItems ADD COLUMN format TEXT'
    )
    logger.info('[Migration v2.25.1] Added format column')
  } else {
    logger.info('[Migration v2.25.1] format column already exists')
  }

  // Get all existing wishlist items with formats
  const items = await queryInterface.sequelize.query(
    'SELECT id, title, author, notes, thumbnail, publishedDate, description, formats, libraryId FROM wishlistItems WHERE formats IS NOT NULL',
    { type: queryInterface.sequelize.QueryTypes.SELECT }
  )

  logger.info(`[Migration v2.25.1] Found ${items.length} wishlist items with formats`)

  // For each item with multiple formats, create new items
  for (const item of items) {
    try {
      const formats = JSON.parse(item.formats || '[]')
      if (formats.length > 1) {
        // Create new items for each additional format
        for (let i = 1; i < formats.length; i++) {
          await queryInterface.sequelize.query(
            'INSERT INTO wishlistItems (title, author, notes, thumbnail, publishedDate, description, format, libraryId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            {
              replacements: [
                item.title,
                item.author,
                item.notes,
                item.thumbnail,
                item.publishedDate,
                item.description,
                formats[i],
                item.libraryId
              ]
            }
          )
        }
        // Update original item with first format
        await queryInterface.sequelize.query(
          'UPDATE wishlistItems SET format = ? WHERE id = ?',
          {
            replacements: [formats[0], item.id]
          }
        )
      } else if (formats.length === 1) {
        // Just update the format
        await queryInterface.sequelize.query(
          'UPDATE wishlistItems SET format = ? WHERE id = ?',
          {
            replacements: [formats[0], item.id]
          }
        )
      }
    } catch (error) {
      logger.error(`[Migration v2.25.1] Error processing item ${item.id}:`, error)
    }
  }

  logger.info('[Migration v2.25.1] Migration completed successfully')
}

/**
 * @param {{ context: { queryInterface: import('sequelize').QueryInterface, logger: import('../Logger') }}} params
 */
async function down({ context: { queryInterface, logger } }) {
  logger.info('[Migration v2.25.1] Rolling back format column...')

  // Rename the format column since SQLite doesn't support DROP COLUMN
  await queryInterface.sequelize.query(
    'ALTER TABLE wishlistItems RENAME COLUMN format TO format_deprecated'
  )

  logger.info('[Migration v2.25.1] Rollback completed')
}

module.exports = { up, down } 