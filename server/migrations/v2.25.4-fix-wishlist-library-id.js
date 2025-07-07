/**
 * MIGRATION v2.25.4
 * 
 * Fix wishlist libraryId column type and constraints
 */

/**
 * @param {{ context: { queryInterface: import('sequelize').QueryInterface, Database: import('../Database'), logger: import('../Logger') }}} params
 */
async function up({ context: { queryInterface, logger } }) {
  logger.info('[Migration v2.25.4] Fixing libraryId column type and constraints...')

  // Create a backup of the wishlistItems table
  await queryInterface.sequelize.query(`
    CREATE TABLE wishlistItems_backup AS SELECT * FROM wishlistItems;
  `)
  logger.info('[Migration v2.25.4] Created backup table')

  // Drop the original table
  await queryInterface.sequelize.query(`
    DROP TABLE wishlistItems;
  `)
  logger.info('[Migration v2.25.4] Dropped original table')

  // Create the table with correct column types
  await queryInterface.sequelize.query(`
    CREATE TABLE wishlistItems (
      id CHAR(36) PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT,
      notes TEXT,
      thumbnail TEXT,
      publishedDate TEXT,
      description TEXT,
      isbn TEXT,
      pageCount INTEGER,
      categories TEXT,
      format TEXT,
      libraryId CHAR(36) REFERENCES libraries(id) ON DELETE SET NULL ON UPDATE CASCADE,
      pendingDownloads TEXT,
      userId CHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
      createdAt DATETIME NOT NULL,
      updatedAt DATETIME NOT NULL
    );
  `)
  logger.info('[Migration v2.25.4] Created new table with correct column types')

  // Copy the data back
  await queryInterface.sequelize.query(`
    INSERT INTO wishlistItems 
    SELECT * FROM wishlistItems_backup;
  `)
  logger.info('[Migration v2.25.4] Copied data back to main table')

  // Drop the backup table
  await queryInterface.sequelize.query(`
    DROP TABLE wishlistItems_backup;
  `)
  logger.info('[Migration v2.25.4] Dropped backup table')

  // Recreate indexes
  await queryInterface.sequelize.query(`
    CREATE INDEX idx_wishlistItems_userId ON wishlistItems(userId);
    CREATE INDEX idx_wishlistItems_title ON wishlistItems(title);
    CREATE INDEX idx_wishlistItems_createdAt ON wishlistItems(createdAt);
  `)
  logger.info('[Migration v2.25.4] Recreated indexes')

  logger.info('[Migration v2.25.4] Migration completed successfully')
}

/**
 * @param {{ context: { queryInterface: import('sequelize').QueryInterface, logger: import('../Logger') }}} params
 */
async function down({ context: { queryInterface, logger } }) {
  // No down migration needed since this is a fix
  logger.info('[Migration v2.25.4] No down migration needed for this fix')
}

module.exports = { up, down } 