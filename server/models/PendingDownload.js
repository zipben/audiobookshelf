const { Model, DataTypes } = require('sequelize')

class PendingDownload extends Model {
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
      }
    }, {
      sequelize,
      modelName: 'pendingDownload'
    })
  }

  /**
   * Setup model associations
   * @param {import('../Database').models} models
   */
  static associate(models) {
    PendingDownload.belongsTo(models.wishlistItem, {
      foreignKey: 'wishlistItemId',
      as: 'wishlistItem'
    })
  }

  /**
   * Convert to JSON for client
   * @returns {Object}
   */
  toJSONForClient() {
    return {
      id: this.id,
      wishlistItemId: this.wishlistItemId,
      clientId: this.clientId,
      url: this.url,
      hash: this.hash,
      addedAt: this.addedAt
    }
  }
}

module.exports = PendingDownload 