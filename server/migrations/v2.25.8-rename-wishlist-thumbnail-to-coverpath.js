const { DataTypes } = require('sequelize')

/**
 * Migration: v2.25.8-rename-wishlist-thumbnail-to-coverpath
 * Description: Rename thumbnail column to coverPath in wishlistItems table
 */
async function up({ context: { queryInterface, logger } }) {
  logger.info('[2.25.8 migration] Renaming thumbnail column to coverPath in wishlistItems table')

  // Create a backup of the wishlistItems table
  await queryInterface.sequelize.query(`
    CREATE TABLE wishlistItems_backup AS SELECT * FROM wishlistItems;
  `)
  logger.info('[2.25.8 migration] Created backup table')

  // Drop the original table
  await queryInterface.sequelize.query(`
    DROP TABLE wishlistItems;
  `)
  logger.info('[2.25.8 migration] Dropped original table')

  // Create the table with coverPath instead of thumbnail
  await queryInterface.sequelize.query(`
    CREATE TABLE wishlistItems (
      id CHAR(36) PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT,
      notes TEXT,
      coverPath TEXT,
      publishedDate TEXT,
      description TEXT,
      isbn TEXT,
      pageCount INTEGER,
      categories TEXT,
      libraryId CHAR(36) REFERENCES libraries(id) ON DELETE SET NULL ON UPDATE CASCADE,
      userId CHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
      createdAt DATETIME NOT NULL,
      updatedAt DATETIME NOT NULL
    );
  `)
  logger.info('[2.25.8 migration] Created new table with coverPath column')

  // Copy the data back, mapping thumbnail to coverPath
  await queryInterface.sequelize.query(`
    INSERT INTO wishlistItems (
      id, title, author, notes, coverPath, publishedDate, description, isbn, 
      pageCount, categories, libraryId, userId, createdAt, updatedAt
    ) 
    SELECT 
      id, title, author, notes, thumbnail, publishedDate, description, isbn, 
      pageCount, categories, libraryId, userId, createdAt, updatedAt 
    FROM wishlistItems_backup;
  `)
  logger.info('[2.25.8 migration] Copied data back to main table')

  // Drop the backup table
  await queryInterface.sequelize.query(`
    DROP TABLE wishlistItems_backup;
  `)
  logger.info('[2.25.8 migration] Dropped backup table')

  // Recreate indexes
  await queryInterface.sequelize.query(`
    CREATE INDEX idx_wishlistItems_userId ON wishlistItems(userId);
    CREATE INDEX idx_wishlistItems_title ON wishlistItems(title);
    CREATE INDEX idx_wishlistItems_createdAt ON wishlistItems(createdAt);
  `)
  logger.info('[2.25.8 migration] Recreated indexes')

  logger.info('[2.25.8 migration] Migration completed successfully')
}

async function down({ context: { queryInterface, logger } }) {
  logger.info('[2.25.8 migration] Renaming coverPath column back to thumbnail in wishlistItems table')

  // Create a backup of the wishlistItems table
  await queryInterface.sequelize.query(`
    CREATE TABLE wishlistItems_backup AS SELECT * FROM wishlistItems;
  `)
  logger.info('[2.25.8 migration] Created backup table')

  // Drop the original table
  await queryInterface.sequelize.query(`
    DROP TABLE wishlistItems;
  `)
  logger.info('[2.25.8 migration] Dropped original table')

  // Create the table with thumbnail instead of coverPath
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
      userId CHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
      createdAt DATETIME NOT NULL,
      updatedAt DATETIME NOT NULL
    );
  `)
  logger.info('[2.25.8 migration] Created new table with thumbnail column')

  // Copy the data back, mapping coverPath to thumbnail
  await queryInterface.sequelize.query(`
    INSERT INTO wishlistItems (
      id, title, author, notes, thumbnail, publishedDate, description, isbn, 
      pageCount, categories, libraryId, userId, createdAt, updatedAt
    ) 
    SELECT 
      id, title, author, notes, coverPath, publishedDate, description, isbn, 
      pageCount, categories, libraryId, userId, createdAt, updatedAt 
    FROM wishlistItems_backup;
  `)
  logger.info('[2.25.8 migration] Copied data back to main table')

  // Drop the backup table
  await queryInterface.sequelize.query(`
    DROP TABLE wishlistItems_backup;
  `)
  logger.info('[2.25.8 migration] Dropped backup table')

  // Recreate indexes
  await queryInterface.sequelize.query(`
    CREATE INDEX idx_wishlistItems_userId ON wishlistItems(userId);
    CREATE INDEX idx_wishlistItems_title ON wishlistItems(title);
    CREATE INDEX idx_wishlistItems_createdAt ON wishlistItems(createdAt);
  `)
  logger.info('[2.25.8 migration] Recreated indexes')

  logger.info('[2.25.8 migration] Migration completed successfully')
}

module.exports = { up, down } 