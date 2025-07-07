const { DataTypes } = require('sequelize')

/**
 * Migration: v2.25.6-create-pending-downloads-table
 * Description: Create pendingDownloads table and remove pendingDownloads column from wishlistItems
 */
async function up({ context: { queryInterface, logger } }) {
  // Check if table already exists
  const tableExists = await queryInterface.tableExists('pendingDownloads')
  if (!tableExists) {
    // Create pendingDownloads table
    await queryInterface.createTable('pendingDownloads', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      wishlistItemId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'wishlistItems',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      clientId: {
        type: DataTypes.STRING,
        allowNull: false
      },
      url: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      hash: {
        type: DataTypes.STRING,
        allowNull: true
      },
      addedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      }
    })
    logger.info('[2.25.6 migration] Created pendingDownloads table')
  } else {
    logger.info('[2.25.6 migration] pendingDownloads table already exists')
  }

  // Add indexes safely by checking if they exist first
  try {
    await queryInterface.addIndex('pendingDownloads', ['wishlistItemId'])
  } catch (error) {
    if (!error.message.includes('already exists')) {
      throw error
    }
    logger.warn('[2.25.6 migration] Index pending_downloads_wishlist_item_id already exists')
  }

  try {
    await queryInterface.addIndex('pendingDownloads', ['hash'])
  } catch (error) {
    if (!error.message.includes('already exists')) {
      throw error
    }
    logger.warn('[2.25.6 migration] Index pending_downloads_hash already exists')
  }

  // Remove pendingDownloads column from wishlistItems
  try {
    await queryInterface.removeColumn('wishlistItems', 'pendingDownloads')
  } catch (error) {
    logger.warn('[2.25.6 migration] Column pendingDownloads does not exist in wishlistItems table')
  }

  logger.info('[2.25.6 migration] Created pendingDownloads table and removed pendingDownloads column from wishlistItems')
}

async function down({ context: { queryInterface, logger } }) {
  // Add back pendingDownloads column to wishlistItems
  await queryInterface.addColumn('wishlistItems', 'pendingDownloads', {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  })

  // Drop pendingDownloads table
  await queryInterface.dropTable('pendingDownloads')

  logger.info('[2.25.6 migration] Dropped pendingDownloads table and added back pendingDownloads column from wishlistItems')
}

module.exports = {
  up,
  down
} 