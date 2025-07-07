const util = require('util')
const { Sequelize } = require('sequelize')

/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface - a sequelize QueryInterface object.
 * @property {import('../Logger')} logger - a Logger object.
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context - an object containing the migration context.
 */

const migrationVersion = '2.25.7'
const migrationName = `${migrationVersion}-fix-author-name-triggers`
const loggerPrefix = `[${migrationVersion} migration]`

// Migration constants
const libraryItems = 'libraryItems'
const bookAuthors = 'bookAuthors'
const authors = 'authors'
const columns = [
  { name: 'authorNamesFirstLast', source: `${authors}.name` },
  { name: 'authorNamesLastFirst', source: `${authors}.lastFirst` }
]
const authorsSort = `${bookAuthors}.createdAt ASC`
const columnNames = columns.map((column) => column.name).join(', ')
const columnSourcesExpression = columns.map((column) => `GROUP_CONCAT(${column.source}, ', ' ORDER BY ${authorsSort})`).join(', ')
const authorsJoin = `${authors} JOIN ${bookAuthors} ON ${authors}.id = ${bookAuthors}.authorId`

/**
 * This upward migration recreates the author name update triggers with proper syntax
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function up({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} UPGRADE BEGIN: ${migrationName}`)

  // Drop any existing triggers first
  await dropTriggers(queryInterface, logger)

  // Create new triggers with proper syntax
  await createTriggers(queryInterface, logger)

  logger.info(`${loggerPrefix} UPGRADE END: ${migrationName}`)
}

/**
 * This downward migration removes the author name update triggers
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function down({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} DOWNGRADE BEGIN: ${migrationName}`)

  await dropTriggers(queryInterface, logger)

  logger.info(`${loggerPrefix} DOWNGRADE END: ${migrationName}`)
}

async function dropTriggers(queryInterface, logger) {
  const triggers = [
    'update_library_items_author_names_on_book_authors_insert',
    'update_library_items_author_names_on_book_authors_delete',
    'update_library_items_author_names_on_authors_update'
  ]

  for (const trigger of triggers) {
    logger.info(`${loggerPrefix} dropping trigger ${trigger}`)
    await queryInterface.sequelize.query(`DROP TRIGGER IF EXISTS ${trigger}`)
    logger.info(`${loggerPrefix} dropped trigger ${trigger}`)
  }
}

async function createTriggers(queryInterface, logger) {
  // Create trigger for bookAuthors insert
  logger.info(`${loggerPrefix} creating trigger for bookAuthors insert`)
  await queryInterface.sequelize.query(`
    CREATE TRIGGER update_library_items_author_names_on_book_authors_insert
    AFTER INSERT ON ${bookAuthors}
    FOR EACH ROW
    BEGIN
      UPDATE ${libraryItems}
      SET (${columnNames}) = (
        SELECT ${columnSourcesExpression}
        FROM ${authorsJoin}
        WHERE ${bookAuthors}.bookId = NEW.bookId
      )
      WHERE mediaId = NEW.bookId AND mediaType = 'book';
    END;
  `)
  logger.info(`${loggerPrefix} created trigger for bookAuthors insert`)

  // Create trigger for bookAuthors delete
  logger.info(`${loggerPrefix} creating trigger for bookAuthors delete`)
  await queryInterface.sequelize.query(`
    CREATE TRIGGER update_library_items_author_names_on_book_authors_delete
    AFTER DELETE ON ${bookAuthors}
    FOR EACH ROW
    BEGIN
      UPDATE ${libraryItems}
      SET (${columnNames}) = (
        SELECT ${columnSourcesExpression}
        FROM ${authorsJoin}
        WHERE ${bookAuthors}.bookId = OLD.bookId
      )
      WHERE mediaId = OLD.bookId AND mediaType = 'book';
    END;
  `)
  logger.info(`${loggerPrefix} created trigger for bookAuthors delete`)

  // Create trigger for authors update
  logger.info(`${loggerPrefix} creating trigger for authors update`)
  await queryInterface.sequelize.query(`
    CREATE TRIGGER update_library_items_author_names_on_authors_update
    AFTER UPDATE OF name, lastFirst ON ${authors}
    FOR EACH ROW
    BEGIN
      UPDATE ${libraryItems}
      SET (${columnNames}) = (
        SELECT ${columnSourcesExpression}
        FROM ${authorsJoin}
        WHERE ${bookAuthors}.bookId = ${libraryItems}.mediaId
      )
      WHERE mediaId IN (
        SELECT bookId 
        FROM ${bookAuthors} 
        WHERE authorId = NEW.id
      ) AND mediaType = 'book';
    END;
  `)
  logger.info(`${loggerPrefix} created trigger for authors update`)
}

module.exports = { up, down } 