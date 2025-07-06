/**
 * MIGRATION v2.25.3
 * 
 * Convert wishlist format field to libraryId field
 */

const { DataTypes } = require('sequelize')

/**
 * @param {import('sequelize').QueryInterface} queryInterface - Sequelize Query Interface
 * @param {import('../Database')} Database - Database instance
 */
async function up({ context: { queryInterface, logger } }) {
  logger.info('[Migration v2.25.3] Adding libraryId column to wishlistItems...')

  // Check if the libraryId column already exists
  const [columns] = await queryInterface.sequelize.query(
    "PRAGMA table_info(wishlistItems)",
    { type: queryInterface.sequelize.QueryTypes.SELECT }
  )
  
  const hasLibraryId = columns.some(col => col.name === 'libraryId')
  
  if (!hasLibraryId) {
    // Add the new libraryId column using raw SQL
    await queryInterface.sequelize.query(
      'ALTER TABLE wishlistItems ADD COLUMN libraryId TEXT'
    )
    logger.info('[Migration v2.25.3] Added libraryId column')
  } else {
    logger.info('[Migration v2.25.3] libraryId column already exists')
  }

  logger.info('[Migration v2.25.3] Migration completed successfully')
}

/**
 * @param {import('sequelize').QueryInterface} queryInterface - Sequelize Query Interface  
 */
async function down({ context: { queryInterface, logger } }) {
  logger.info('[Migration v2.25.3] Removing libraryId column...')

  // Remove the libraryId column (rename since SQLite doesn't support DROP COLUMN)
  await queryInterface.sequelize.query(
    'ALTER TABLE wishlistItems RENAME COLUMN libraryId TO libraryId_deprecated'
  )

  logger.info('[Migration v2.25.3] Rollback completed')
}

module.exports = { up, down } 