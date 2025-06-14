const { Request, Response, NextFunction } = require('express')
const uuidv4 = require('uuid').v4
const Logger = require('../Logger')
const SocketAuthority = require('../SocketAuthority')
const Database = require('../Database')

const { toNumber } = require('../utils/index')

/**
 * @typedef RequestUserObject
 * @property {import('../models/User')} user
 *
 * @typedef {Request & RequestUserObject} RequestWithUser
 *
 * @typedef RequestEntityObject
 * @property {import('../models/User')} reqUser
 *
 * @typedef {RequestWithUser & RequestEntityObject} UserControllerRequest
 */

class UserController {
  constructor() {}

  /**
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async findAll(req, res) {
    if (!req.user.isAdminOrUp) return res.sendStatus(403)
    const hideRootToken = !req.user.isRoot

    const includes = (req.query.include || '').split(',').map((i) => i.trim())

    // Minimal toJSONForBrowser does not include mediaProgress and bookmarks
    const allUsers = await Database.userModel.findAll()
    const users = allUsers.map((u) => u.toOldJSONForBrowser(hideRootToken, true))

    if (includes.includes('latestSession')) {
      for (const user of users) {
        const userSessions = await Database.getPlaybackSessions({ userId: user.id })
        user.latestSession = userSessions.sort((a, b) => b.updatedAt - a.updatedAt).shift() || null
      }
    }

    res.json({
      users
    })
  }

  /**
   * GET: /api/users/:id
   * Get a single user
   * 
   * @param {UserControllerRequest} req
   * @param {Response} res
   */
  async findOne(req, res) {
    const user = req.reqUser
    const hideRootToken = !req.user.isRoot

    // If requesting user is not admin and not the user themselves, return limited public data
    if (!req.user.isAdminOrUp && req.user.id !== user.id) {
      const publicUserData = {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        type: user.type,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
      return res.json(publicUserData)
    }

    res.json(user.toOldJSONForBrowser(hideRootToken))
  }

  /**
   * POST: /api/users
   * Create a new user
   *
   * @this {import('../routers/ApiRouter')}
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async create(req, res) {
    if (!req.body.username || !req.body.password || typeof req.body.username !== 'string' || typeof req.body.password !== 'string') {
      return res.status(400).send('Username and password are required')
    }
    if (req.body.type && !Database.userModel.accountTypes.includes(req.body.type)) {
      return res.status(400).send('Invalid account type')
    }

    const usernameExists = await Database.userModel.checkUserExistsWithUsername(req.body.username)
    if (usernameExists) {
      return res.status(400).send('Username already taken')
    }

    const userId = uuidv4()
    const pash = await this.auth.hashPass(req.body.password)
    const token = await this.auth.generateAccessToken({ id: userId, username: req.body.username })
    const userType = req.body.type || 'user'

    // librariesAccessible and itemTagsSelected can be on req.body or req.body.permissions
    // Old model stored them outside of permissions, new model stores them inside permissions
    let reqLibrariesAccessible = req.body.librariesAccessible || req.body.permissions?.librariesAccessible
    if (reqLibrariesAccessible && (!Array.isArray(reqLibrariesAccessible) || reqLibrariesAccessible.some((libId) => typeof libId !== 'string'))) {
      Logger.warn(`[UserController] create: Invalid librariesAccessible value: ${reqLibrariesAccessible}`)
      reqLibrariesAccessible = null
    }
    let reqItemTagsSelected = req.body.itemTagsSelected || req.body.permissions?.itemTagsSelected
    if (reqItemTagsSelected && (!Array.isArray(reqItemTagsSelected) || reqItemTagsSelected.some((tagId) => typeof tagId !== 'string'))) {
      Logger.warn(`[UserController] create: Invalid itemTagsSelected value: ${reqItemTagsSelected}`)
      reqItemTagsSelected = null
    }
    if (req.body.permissions?.itemTagsSelected || req.body.permissions?.librariesAccessible) {
      delete req.body.permissions.itemTagsSelected
      delete req.body.permissions.librariesAccessible
    }

    // Map permissions
    const permissions = Database.userModel.getDefaultPermissionsForUserType(userType)
    if (req.body.permissions && typeof req.body.permissions === 'object') {
      for (const key in req.body.permissions) {
        if (permissions[key] !== undefined) {
          if (typeof req.body.permissions[key] !== 'boolean') {
            Logger.warn(`[UserController] create: Invalid permission value for key ${key}. Should be boolean`)
          } else {
            permissions[key] = req.body.permissions[key]
          }
        } else {
          Logger.warn(`[UserController] create: Invalid permission key: ${key}`)
        }
      }
    }

    permissions.itemTagsSelected = reqItemTagsSelected || []
    permissions.librariesAccessible = reqLibrariesAccessible || []

    const newUser = {
      id: userId,
      type: userType,
      username: req.body.username,
      email: typeof req.body.email === 'string' ? req.body.email : null,
      displayName: typeof req.body.displayName === 'string' ? req.body.displayName : null,
      pash,
      token,
      isActive: !!req.body.isActive,
      permissions,
      bookmarks: [],
      extraData: {
        seriesHideFromContinueListening: []
      }
    }

    const user = await Database.userModel.create(newUser)
    if (user) {
      SocketAuthority.adminEmitter('user_added', user.toOldJSONForBrowser())
      res.json({
        user: user.toOldJSONForBrowser()
      })
    } else {
      return res.status(500).send('Failed to save new user')
    }
  }

  /**
   * PATCH: /api/users/:id
   * Update user
   *
   * @this {import('../routers/ApiRouter')}
   *
   * @param {UserControllerRequest} req
   * @param {Response} res
   */
  async update(req, res) {
    Logger.info('[UserController] Update request:', {
      params: req.params,
      body: req.body,
      user: req.user?.username,
      reqUser: req.reqUser?.username
    })

    const user = req.reqUser

    if (user.isRoot && !req.user.isRoot) {
      Logger.error(`[UserController] Admin user "${req.user.username}" attempted to update root user`)
      return res.sendStatus(403)
    } else if (user.isRoot) {
      // Root user cannot update type
      delete req.body.type
    }

    const updatePayload = req.body

    // Validate payload
    const keysThatCannotBeUpdated = ['id', 'pash', 'token', 'extraData', 'bookmarks']
    for (const key of keysThatCannotBeUpdated) {
      if (updatePayload[key] !== undefined) {
        return res.status(400).send(`Key "${key}" cannot be updated`)
      }
    }
    if (updatePayload.email && typeof updatePayload.email !== 'string') {
      return res.status(400).send('Invalid email')
    }
    if (updatePayload.username && typeof updatePayload.username !== 'string') {
      return res.status(400).send('Invalid username')
    }
    if (updatePayload.displayName && typeof updatePayload.displayName !== 'string') {
      return res.status(400).send('Invalid display name')
    }
    if (updatePayload.type && !Database.userModel.accountTypes.includes(updatePayload.type)) {
      return res.status(400).send('Invalid account type')
    }
    if (updatePayload.permissions && typeof updatePayload.permissions !== 'object') {
      return res.status(400).send('Invalid permissions')
    }

    let hasUpdates = false
    let shouldUpdateToken = false
    // When changing username create a new API token
    if (updatePayload.username && updatePayload.username !== user.username) {
      const usernameExists = await Database.userModel.checkUserExistsWithUsername(updatePayload.username)
      if (usernameExists) {
        return res.status(400).send('Username already taken')
      }
      user.username = updatePayload.username
      shouldUpdateToken = true
      hasUpdates = true
    }

    // Updating password
    if (updatePayload.password) {
      user.pash = await this.auth.hashPass(updatePayload.password)
      hasUpdates = true
    }

    let hasPermissionsUpdates = false
    let updateLibrariesAccessible = updatePayload.librariesAccessible || updatePayload.permissions?.librariesAccessible
    if (updateLibrariesAccessible && (!Array.isArray(updateLibrariesAccessible) || updateLibrariesAccessible.some((libId) => typeof libId !== 'string'))) {
      Logger.warn(`[UserController] update: Invalid librariesAccessible value: ${updateLibrariesAccessible}`)
      updateLibrariesAccessible = null
    }
    let updateItemTagsSelected = updatePayload.itemTagsSelected || updatePayload.permissions?.itemTagsSelected
    if (updateItemTagsSelected && (!Array.isArray(updateItemTagsSelected) || updateItemTagsSelected.some((tagId) => typeof tagId !== 'string'))) {
      Logger.warn(`[UserController] update: Invalid itemTagsSelected value: ${updateItemTagsSelected}`)
      updateItemTagsSelected = null
    }
    if (updatePayload.permissions?.itemTagsSelected || updatePayload.permissions?.librariesAccessible) {
      delete updatePayload.permissions.itemTagsSelected
      delete updatePayload.permissions.librariesAccessible
    }
    if (updatePayload.permissions && typeof updatePayload.permissions === 'object') {
      const permissions = {
        ...user.permissions
      }
      const defaultPermissions = Database.userModel.getDefaultPermissionsForUserType(updatePayload.type || user.type || 'user')
      for (const key in updatePayload.permissions) {
        // Check that the key is a valid permission key or is included in the default permissions
        if (permissions[key] !== undefined || defaultPermissions[key] !== undefined) {
          if (typeof updatePayload.permissions[key] !== 'boolean') {
            Logger.warn(`[UserController] update: Invalid permission value for key ${key}. Should be boolean`)
          } else if (permissions[key] !== updatePayload.permissions[key]) {
            permissions[key] = updatePayload.permissions[key]
            hasPermissionsUpdates = true
          }
        } else {
          Logger.warn(`[UserController] update: Invalid permission key: ${key}`)
        }
      }

      if (updateItemTagsSelected && updateItemTagsSelected.join(',') !== user.permissions.itemTagsSelected.join(',')) {
        permissions.itemTagsSelected = updateItemTagsSelected
        hasPermissionsUpdates = true
      }
      if (updateLibrariesAccessible && updateLibrariesAccessible.join(',') !== user.permissions.librariesAccessible.join(',')) {
        permissions.librariesAccessible = updateLibrariesAccessible
        hasPermissionsUpdates = true
      }
      updatePayload.permissions = permissions
    }

    // Permissions were updated
    if (hasPermissionsUpdates) {
      user.permissions = updatePayload.permissions
      user.changed('permissions', true)
      hasUpdates = true
    }

    if (updatePayload.email && updatePayload.email !== user.email) {
      user.email = updatePayload.email
      hasUpdates = true
    }
    if (updatePayload.type && updatePayload.type !== user.type) {
      user.type = updatePayload.type
      hasUpdates = true
    }
    if (updatePayload.isActive !== undefined && !!updatePayload.isActive !== user.isActive) {
      user.isActive = updatePayload.isActive
      hasUpdates = true
    }
    if (updatePayload.lastSeen && typeof updatePayload.lastSeen === 'number') {
      user.lastSeen = updatePayload.lastSeen
      hasUpdates = true
    }
    if (updatePayload.displayName !== undefined) {
      user.displayName = updatePayload.displayName
      hasUpdates = true
    }

    if (hasUpdates) {
      if (shouldUpdateToken) {
        user.token = await this.auth.generateAccessToken(user)
        Logger.info(`[UserController] User ${user.username} has generated a new api token`)
      }
      await user.save()
      SocketAuthority.clientEmitter(req.user.id, 'user_updated', user.toOldJSONForBrowser())
    }

    res.json({
      success: true,
      user: user.toOldJSONForBrowser()
    })
  }

  /**
   * DELETE: /api/users/:id
   * Delete a user
   *
   * @param {UserControllerRequest} req
   * @param {Response} res
   */
  async delete(req, res) {
    if (req.params.id === 'root') {
      Logger.error('[UserController] Attempt to delete root user. Root user cannot be deleted')
      return res.sendStatus(400)
    }
    if (req.user.id === req.params.id) {
      Logger.error(`[UserController] User ${req.user.username} is attempting to delete self`)
      return res.sendStatus(400)
    }
    const user = req.reqUser

    // Todo: check if user is logged in and cancel streams

    // Remove user playlists
    const userPlaylists = await Database.playlistModel.findAll({
      where: {
        userId: user.id
      }
    })
    for (const playlist of userPlaylists) {
      await playlist.destroy()
    }

    // Set PlaybackSessions userId to null
    const [sessionsUpdated] = await Database.playbackSessionModel.update(
      {
        userId: null
      },
      {
        where: {
          userId: user.id
        }
      }
    )
    Logger.info(`[UserController] Updated ${sessionsUpdated} playback sessions to remove user id`)

    const userJson = user.toOldJSONForBrowser()
    await user.destroy()
    SocketAuthority.adminEmitter('user_removed', userJson)
    res.json({
      success: true
    })
  }

  /**
   * PATCH: /api/users/:id/openid-unlink
   *
   * @param {UserControllerRequest} req
   * @param {Response} res
   */
  async unlinkFromOpenID(req, res) {
    Logger.debug(`[UserController] Unlinking user "${req.reqUser.username}" from OpenID with sub "${req.reqUser.authOpenIDSub}"`)

    if (!req.reqUser.authOpenIDSub) {
      return res.sendStatus(200)
    }

    req.reqUser.extraData.authOpenIDSub = null
    req.reqUser.changed('extraData', true)
    await req.reqUser.save()
    SocketAuthority.clientEmitter(req.user.id, 'user_updated', req.reqUser.toOldJSONForBrowser())
    res.sendStatus(200)
  }

  /**
   * GET: /api/users/:id/listening-sessions
   *
   * @param {UserControllerRequest} req
   * @param {Response} res
   */
  async getListeningSessions(req, res) {
    var listeningSessions = await this.getUserListeningSessionsHelper(req.params.id)

    const itemsPerPage = toNumber(req.query.itemsPerPage, 10) || 10
    const page = toNumber(req.query.page, 0)

    const start = page * itemsPerPage
    const sessions = listeningSessions.slice(start, start + itemsPerPage)

    const payload = {
      total: listeningSessions.length,
      numPages: Math.ceil(listeningSessions.length / itemsPerPage),
      page,
      itemsPerPage,
      sessions
    }

    res.json(payload)
  }

  /**
   * GET: /api/users/:id/listening-stats
   *
   * @this {import('../routers/ApiRouter')}
   *
   * @param {UserControllerRequest} req
   * @param {Response} res
   */
  async getListeningStats(req, res) {
    var listeningStats = await this.getUserListeningStatsHelpers(req.params.id)
    res.json(listeningStats)
  }

  /**
   * GET: /api/users/online
   *
   * @this {import('../routers/ApiRouter')}
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async getOnlineUsers(req, res) {
    if (!req.user.isAdminOrUp) {
      return res.sendStatus(403)
    }

    res.json({
      usersOnline: SocketAuthority.getUsersOnline(),
      openSessions: this.playbackSessionManager.sessions
    })
  }

  /**
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   * @param {NextFunction} next
   */
  async middleware(req, res, next) {
    Logger.info('[UserController] Middleware request:', {
      method: req.method,
      path: req.path,
      params: req.params,
      userId: req.user?.id,
      username: req.user?.username
    })

    // For GET requests, allow viewing any user's public profile
    if (req.method === 'GET') {
      // Continue to next middleware
    } else if (!req.user.isAdminOrUp && req.user.id !== req.params.id) {
      // For non-GET requests, require admin or self
      return res.sendStatus(403)
    }

    if (req.params.id) {
      req.reqUser = await Database.userModel.getUserById(req.params.id)
      if (!req.reqUser) {
        return res.sendStatus(404)
      }
    }

    next()
  }

  /**
   * GET: /api/users/:id/reviews
   * Get reviews for a user with associated library items
   * 
   * @param {UserControllerRequest} req
   * @param {Response} res
   */
  async getUserReviews(req, res) {
    try {
      // First get all reviews for the user
      const reviews = await Database.commentModel.findAll({
        where: { userId: req.params.id },
        include: [{
          model: Database.userModel,
          as: 'user',
          attributes: ['id', 'username', 'displayName']
        }],
        order: [['createdAt', 'DESC']]
      })

      // Get all libraryItemIds from the reviews
      const libraryItemIds = reviews.map(review => review.libraryItemId)

      // Get all library items with their books
      const libraryItems = await Database.libraryItemModel.findAll({
        where: {
          id: libraryItemIds
        },
        attributes: ['id', 'title', 'mediaType', 'path', 'relPath', 'libraryId', 'libraryFolderId', 'isFile', 'updatedAt'],
        include: [{
          model: Database.bookModel,
          as: 'book',
          attributes: ['id', 'title', 'coverPath']
        }]
      })

      // Create a map of library items by id for easy lookup
      const libraryItemsMap = libraryItems.reduce((map, item) => {
        map[item.id] = item
        return map
      }, {})

      // Merge the data
      const reviewsWithItems = reviews.map(review => {
        const reviewJson = review.toJSON()
        const libraryItem = libraryItemsMap[reviewJson.libraryItemId]
        
        if (libraryItem) {
          const libraryItemJson = libraryItem.toJSON()
          reviewJson.libraryItem = libraryItemJson
          if (libraryItemJson.book) {
            reviewJson.libraryItem.media = {
              coverPath: libraryItemJson.book.coverPath
            }
            reviewJson.book = libraryItemJson.book
          }
        }
        return reviewJson
      })

      res.json(reviewsWithItems)
    } catch (error) {
      Logger.error('[UserController] getUserReviews error:', error)
      res.status(500).json({ error: 'Failed to get user reviews' })
    }
  }
}
module.exports = new UserController()
