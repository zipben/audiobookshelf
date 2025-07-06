const Logger = require('../Logger')
const Database = require('../Database')

/**
 * @typedef RequestWithUser
 * @property {import('../models/User')} user
 * 
 * @typedef {import('express').Request & RequestWithUser} WishlistControllerRequest
 * @typedef {import('express').Response} Response
 */

class WishlistController {
  /**
   * GET: /api/wishlist
   * Get all wishlist items for the current user
   *
   * @param {WishlistControllerRequest} req
   * @param {Response} res
   */
  static async getWishlistItems(req, res) {
    try {
      const wishlistItems = await Database.wishlistItemModel.findAll({
        where: {
          userId: req.user.id
        },
        order: [['createdAt', 'DESC']]
      })

      res.json({ wishlistItems: wishlistItems.map(item => item.toJSON()) })
    } catch (error) {
      Logger.error(`[WishlistController] Error getting wishlist items for user ${req.user.id}:`, error)
      res.status(500).json({ error: 'Failed to get wishlist items' })
    }
  }

  /**
   * POST: /api/wishlist
   * Add a new item to the wishlist
   *
   * @param {WishlistControllerRequest} req
   * @param {Response} res
   */
  static async addWishlistItem(req, res) {
    try {
      const { title, author, notes, thumbnail, publishedDate, description, isbn, pageCount, categories, formats } = req.body

      if (!title) {
        return res.status(400).json({ error: 'Title is required' })
      }

      const formatsToAdd = formats || []
      if (formatsToAdd.length === 0) {
        return res.status(400).json({ error: 'At least one format is required' })
      }

      const createdItems = []
      const existingItems = []

      // Create separate items for each format
      for (const format of formatsToAdd) {
        // Check if item already exists for this user with this specific format
        const existingItem = await Database.wishlistItemModel.findOne({
          where: {
            userId: req.user.id,
            title: title,
            author: author || null,
            format: format
          }
        })

        if (existingItem) {
          existingItems.push(existingItem)
          continue
        }

        // Create new wishlist item for this format
        const wishlistItem = await Database.wishlistItemModel.create({
          title,
          author,
          notes,
          thumbnail,
          publishedDate,
          description,
          isbn,
          pageCount,
          categories,
          format,
          userId: req.user.id
        })

        createdItems.push(wishlistItem)
        Logger.info(`[WishlistController] Added item "${title}" (${format}) to wishlist for user ${req.user.id}`)
      }

      if (createdItems.length === 0 && existingItems.length > 0) {
        return res.status(400).json({ error: 'All items already exist in wishlist with specified formats' })
      }

      // Return the created items (or existing ones if nothing was created)
      const items = createdItems.length > 0 ? createdItems : existingItems
      const responseItems = items.map(item => item.toJSON())

      if (createdItems.length > 0) {
        res.status(201).json({ 
          wishlistItems: responseItems,
          message: `Added ${createdItems.length} item(s) to wishlist`
        })
      } else {
        res.json({ 
          wishlistItems: responseItems,
          message: 'Items already exist in wishlist'
        })
      }

    } catch (error) {
      Logger.error(`[WishlistController] Error adding wishlist item for user ${req.user.id}:`, error)
      res.status(500).json({ error: 'Failed to add wishlist item' })
    }
  }

  /**
   * PUT: /api/wishlist/:id
   * Update a wishlist item
   *
   * @param {WishlistControllerRequest} req
   * @param {Response} res
   */
  static async updateWishlistItem(req, res) {
    try {
      const { id } = req.params
      const { title, author, notes, thumbnail, publishedDate, description, isbn, pageCount, categories, format } = req.body

      const wishlistItem = await Database.wishlistItemModel.findOne({
        where: {
          id: id,
          userId: req.user.id
        }
      })

      if (!wishlistItem) {
        return res.status(404).json({ error: 'Wishlist item not found' })
      }

      // Update the item
      await wishlistItem.update({
        title: title || wishlistItem.title,
        author: author !== undefined ? author : wishlistItem.author,
        notes: notes !== undefined ? notes : wishlistItem.notes,
        thumbnail: thumbnail !== undefined ? thumbnail : wishlistItem.thumbnail,
        publishedDate: publishedDate !== undefined ? publishedDate : wishlistItem.publishedDate,
        description: description !== undefined ? description : wishlistItem.description,
        isbn: isbn !== undefined ? isbn : wishlistItem.isbn,
        pageCount: pageCount !== undefined ? pageCount : wishlistItem.pageCount,
        categories: categories !== undefined ? categories : wishlistItem.categories,
        format: format !== undefined ? format : wishlistItem.format
      })

      Logger.info(`[WishlistController] Updated wishlist item "${wishlistItem.title}" (${wishlistItem.format}) for user ${req.user.id}`)
      res.json({ wishlistItem: wishlistItem.toJSON() })

    } catch (error) {
      Logger.error(`[WishlistController] Error updating wishlist item for user ${req.user.id}:`, error)
      res.status(500).json({ error: 'Failed to update wishlist item' })
    }
  }

  /**
   * DELETE: /api/wishlist/:id
   * Delete a wishlist item
   *
   * @param {WishlistControllerRequest} req
   * @param {Response} res
   */
  static async deleteWishlistItem(req, res) {
    try {
      const { id } = req.params

      const wishlistItem = await Database.wishlistItemModel.findOne({
        where: {
          id: id,
          userId: req.user.id
        }
      })

      if (!wishlistItem) {
        return res.status(404).json({ error: 'Wishlist item not found' })
      }

      // Check permissions - user can delete if they own it or are admin
      const userIsAdminOrUp = req.user.type === 'admin' || req.user.type === 'root'
      if (wishlistItem.userId !== req.user.id && !userIsAdminOrUp) {
        return res.status(403).json({ error: 'Permission denied' })
      }

      await wishlistItem.destroy()

      Logger.info(`[WishlistController] Deleted wishlist item "${wishlistItem.title}" for user ${req.user.id}`)
      res.json({ message: 'Wishlist item deleted successfully' })

    } catch (error) {
      Logger.error(`[WishlistController] Error deleting wishlist item for user ${req.user.id}:`, error)
      res.status(500).json({ error: 'Failed to delete wishlist item' })
    }
  }
}

module.exports = WishlistController 