/**
 * MIGRATION v2.25.5
 * 
 * Fix wishlist libraryId column type and constraints
 */

/**
 * @param {{ context: { queryInterface: import('sequelize').QueryInterface, Database: import('../Database'), logger: import('../Logger') }}} params
 */
async function up({ context: { queryInterface, logger } }) {
  logger.info('[Migration v2.25.5] Fixing libraryId column type and constraints...')

  // Get the first library ID to use as default
  const [libraries] = await queryInterface.sequelize.query(`
    SELECT id FROM libraries LIMIT 1;
  `)
  if (!libraries.length) {
    throw new Error('No libraries found in the database')
  }
  const defaultLibraryId = libraries[0].id
  logger.info(`[Migration v2.25.5] Using default library ID: ${defaultLibraryId}`)

  // Create a backup of the wishlistItems table
  await queryInterface.sequelize.query(`
    CREATE TABLE wishlistItems_backup AS SELECT * FROM wishlistItems;
  `)
  logger.info('[Migration v2.25.5] Created backup table')

  // Drop the original table
  await queryInterface.sequelize.query(`
    DROP TABLE wishlistItems;
  `)
  logger.info('[Migration v2.25.5] Dropped original table')

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
      libraryId CHAR(36) REFERENCES libraries(id) ON DELETE SET NULL ON UPDATE CASCADE,
      pendingDownloads TEXT,
      userId CHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
      createdAt DATETIME NOT NULL,
      updatedAt DATETIME NOT NULL
    );
  `)
  logger.info('[Migration v2.25.5] Created new table with correct column types')

  // Copy the data back with explicit column list, using the default library ID
  await queryInterface.sequelize.query(`
    INSERT INTO wishlistItems (
      id, title, author, notes, thumbnail, publishedDate, description, isbn, 
      pageCount, categories, libraryId, pendingDownloads, userId, 
      createdAt, updatedAt
    ) 
    SELECT 
      id, title, author, notes, thumbnail, publishedDate, description, isbn, 
      pageCount, categories, '${defaultLibraryId}', pendingDownloads, userId, 
      createdAt, updatedAt 
    FROM wishlistItems_backup;
  `)
  logger.info('[Migration v2.25.5] Copied data back to main table')

  // Drop the backup table
  await queryInterface.sequelize.query(`
    DROP TABLE wishlistItems_backup;
  `)
  logger.info('[Migration v2.25.5] Dropped backup table')

  // Recreate indexes
  await queryInterface.sequelize.query(`
    CREATE INDEX idx_wishlistItems_userId ON wishlistItems(userId);
    CREATE INDEX idx_wishlistItems_title ON wishlistItems(title);
    CREATE INDEX idx_wishlistItems_createdAt ON wishlistItems(createdAt);
  `)
  logger.info('[Migration v2.25.5] Recreated indexes')

  logger.info('[Migration v2.25.5] Migration completed successfully')
}

/**
 * @param {{ context: { queryInterface: import('sequelize').QueryInterface, logger: import('../Logger') }}} params
 */
async function down({ context: { queryInterface, logger } }) {
  // No down migration needed since this is a fix
  logger.info('[Migration v2.25.5] No down migration needed for this fix')
}

module.exports = { up, down } 