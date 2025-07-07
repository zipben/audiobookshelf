/**
 * MIGRATION v2.25.3
 * 
 * Convert wishlist format field to libraryId field
 */

/**
 * @param {{ context: { queryInterface: import('sequelize').QueryInterface, Database: import('../Database'), logger: import('../Logger') }}} params
 */
async function up({ context: { queryInterface, logger } }) {
  logger.info('[Migration v2.25.3] Adding libraryId column to wishlistItems...')

  // First, check if libraryId column exists using raw SQL
  const tableInfo = await queryInterface.sequelize.query(
    "SELECT * FROM pragma_table_info('wishlistItems')",
    { type: queryInterface.sequelize.QueryTypes.SELECT }
  )
  
  const hasLibraryId = tableInfo.find(col => col.name === 'libraryId')
  
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
 * @param {{ context: { queryInterface: import('sequelize').QueryInterface, logger: import('../Logger') }}} params
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