const { Model, DataTypes } = require('sequelize')

class WishlistItem extends Model {
  static init(sequelize) {
    return super.init(
      {
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
        libraryId: {
          type: DataTypes.UUID,
          allowNull: true,
          references: {
            model: 'libraries',
            key: 'id'
          },
          onDelete: 'SET NULL',
          onUpdate: 'CASCADE'
        },
        pendingDownloads: {
          type: DataTypes.JSON,
          allowNull: true,
          defaultValue: []
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
      },
      {
        sequelize,
        modelName: 'wishlistItem',
        tableName: 'wishlistItems',
        timestamps: true
      }
    )
  }

  static associate(models) {
    WishlistItem.belongsTo(models.user, {
      foreignKey: 'userId',
      as: 'user'
    })
    WishlistItem.belongsTo(models.library, {
      foreignKey: 'libraryId',
      as: 'library'
    })
  }

  toJSON() {
    const json = {
      id: this.id,
      title: this.title,
      author: this.author,
      notes: this.notes,
      thumbnail: this.thumbnail,
      publishedDate: this.publishedDate,
      description: this.description,
      isbn: this.isbn,
      pageCount: this.pageCount,
      categories: this.categories,
      libraryId: this.libraryId,
      pendingDownloads: this.pendingDownloads || [],
      userId: this.userId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      addedAt: this.createdAt // For backward compatibility with frontend
    }

    // Include library data if it's loaded
    if (this.library) {
      json.library = {
        id: this.library.id,
        name: this.library.name,
        mediaType: this.library.mediaType,
        icon: this.library.icon
      }
    }

    return json
  }
}

module.exports = WishlistItem 