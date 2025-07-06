const { DataTypes } = require('sequelize')

async function up({ context: { queryInterface, logger } }) {
  logger.info('[2.25.0 migration] Creating wishlistItems table')
  
  await queryInterface.createTable('wishlistItems', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    author: {
      type: DataTypes.STRING,
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    thumbnail: {
      type: DataTypes.STRING,
      allowNull: true
    },
    publishedDate: {
      type: DataTypes.STRING,
      allowNull: true
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    isbn: {
      type: DataTypes.STRING,
      allowNull: true
    },
    pageCount: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    categories: {
      type: DataTypes.JSON,
      allowNull: true
    },
    formats: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: '[]'
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
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

  // Add indexes for faster lookups
  await queryInterface.addIndex('wishlistItems', ['userId'])
  await queryInterface.addIndex('wishlistItems', ['title'])
  await queryInterface.addIndex('wishlistItems', ['createdAt'])
  
  logger.info('[2.25.0 migration] wishlistItems table created successfully')
}

async function down({ context: { queryInterface, logger } }) {
  logger.info('[2.25.0 migration] Dropping wishlistItems table')
  await queryInterface.dropTable('wishlistItems')
  logger.info('[2.25.0 migration] wishlistItems table dropped successfully')
}

module.exports = { up, down } 