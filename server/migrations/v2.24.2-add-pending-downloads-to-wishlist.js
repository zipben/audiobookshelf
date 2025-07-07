const { DataTypes } = require('sequelize')

/**
 * Migration: v2.24.2-add-pending-downloads-to-wishlist
 * Description: Add pendingDownloads column to wishlistItems table
 */
async function up({ context: { queryInterface, logger } }) {
  // Add pendingDownloads column to wishlistItems table
  await queryInterface.addColumn('wishlistItems', 'pendingDownloads', {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  })

  logger.info('[2.24.2 migration] Added pendingDownloads column to wishlistItems table')
}

/**
 * Migration down
 */
async function down({ context: { queryInterface, logger } }) {
  // Remove pendingDownloads column from wishlistItems table
  await queryInterface.removeColumn('wishlistItems', 'pendingDownloads')
  
  logger.info('[2.24.2 migration] Removed pendingDownloads column from wishlistItems table')
}

module.exports = { up, down } 