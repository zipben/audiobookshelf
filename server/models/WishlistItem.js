const { Model, DataTypes } = require('sequelize')

class WishlistItem extends Model {
  /**
   * Initialize model
   * @param {import('../Database').sequelize} sequelize 
   */
  static init(sequelize) {
    super.init({
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      libraryId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'libraries',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false
      },
      author: {
        type: DataTypes.STRING,
        allowNull: true
      },
      coverPath: {
        type: DataTypes.STRING,
        allowNull: true
      }
    }, {
      sequelize,
      modelName: 'wishlistItem',
      indexes: [
        {
          fields: ['userId']
        },
        {
          fields: ['libraryId']
        }
      ]
    })
  }

  /**
   * Setup model associations
   * @param {import('../Database').models} models
   */
  static associate(models) {
    WishlistItem.belongsTo(models.user, {
      foreignKey: 'userId',
      as: 'user'
    })
    WishlistItem.belongsTo(models.library, {
      foreignKey: 'libraryId',
      as: 'library'
    })
    WishlistItem.hasMany(models.pendingDownload, {
      foreignKey: 'wishlistItemId',
      as: 'pendingDownloads'
    })
  }

  /**
   * Convert to JSON for client
   * @returns {Object}
   */
  toJSONForClient() {
    return {
      id: this.id,
      userId: this.userId,
      libraryId: this.libraryId,
      title: this.title,
      author: this.author,
      coverPath: this.coverPath,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      pendingDownloads: this.pendingDownloads?.map(pd => pd.toJSONForClient()) || []
    }
  }
}

module.exports = WishlistItem 