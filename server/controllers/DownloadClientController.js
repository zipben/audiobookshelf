const axios = require('axios')
const Logger = require('../Logger')
const Database = require('../Database')
const { Op } = require('sequelize')

/**
 * @typedef RequestWithUser
 * @property {import('../models/User')} user
 * 
 * @typedef {import('express').Request & RequestWithUser} DownloadClientControllerRequest
 * @typedef {import('express').Response} Response
 */

class DownloadClientController {


  /**
   * GET: /api/download-clients
   * Get all download clients
   *
   * @param {DownloadClientControllerRequest} req
   * @param {Response} res
   */
  static async getClients(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[DownloadClientController] Non-admin user "${req.user.username}" attempted to get download clients`)
      return res.sendStatus(403)
    }

    const clients = Database.serverSettings.downloadClients || []
    res.json({ clients })
  }

  /**
   * POST: /api/download-clients
   * Create a new download client
   *
   * @param {DownloadClientControllerRequest} req
   * @param {Response} res
   */
  static async createClient(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[DownloadClientController] Non-admin user "${req.user.username}" attempted to create download client`)
      return res.sendStatus(403)
    }

    const { name, type, host, port, username, password, downloadPath, hostDownloadPath, category, enabled = true } = req.body

    if (!name || !type || !host || !port) {
      return res.status(400).json({ error: 'Name, type, host, and port are required' })
    }

    const clients = Database.serverSettings.downloadClients || []
    
    // Check if name already exists
    if (clients.some(client => client.name === name)) {
      return res.status(400).json({ error: 'Download client with this name already exists' })
    }

    const newClient = {
      id: Date.now().toString(),
      name,
      type,
      host,
      port: parseInt(port),
      username: username || '',
      password: password || '',
      downloadPath: downloadPath || '',
      hostDownloadPath: hostDownloadPath || '',
      category: category || '',
      enabled,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    clients.push(newClient)

    await Database.updateServerSettings({
      downloadClients: clients
    })

    Logger.info(`[DownloadClientController] Created download client "${name}"`)
    res.json({ client: newClient })
  }

  /**
   * PUT: /api/download-clients/:id
   * Update a download client
   *
   * @param {DownloadClientControllerRequest} req
   * @param {Response} res
   */
  static async updateClient(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[DownloadClientController] Non-admin user "${req.user.username}" attempted to update download client`)
      return res.sendStatus(403)
    }

    const { id } = req.params
    const { name, type, host, port, username, password, downloadPath, hostDownloadPath, category, enabled } = req.body

    if (!name || !type || !host || !port) {
      return res.status(400).json({ error: 'Name, type, host, and port are required' })
    }

    const clients = Database.serverSettings.downloadClients || []
    const clientIndex = clients.findIndex(client => client.id === id)

    if (clientIndex === -1) {
      return res.status(404).json({ error: 'Download client not found' })
    }

    // Check if name already exists (excluding current client)
    if (clients.some((client, index) => client.name === name && index !== clientIndex)) {
      return res.status(400).json({ error: 'Download client with this name already exists' })
    }

    const updatedClient = {
      ...clients[clientIndex],
      name,
      type,
      host,
      port: parseInt(port),
      username: username || '',
      downloadPath: downloadPath || '',
      hostDownloadPath: hostDownloadPath !== undefined ? hostDownloadPath : clients[clientIndex].hostDownloadPath || '',
      category: category || '',
      enabled: enabled !== undefined ? enabled : clients[clientIndex].enabled,
      updatedAt: new Date().toISOString()
    }

    // Only update password if provided
    if (password) {
      updatedClient.password = password
    }

    clients[clientIndex] = updatedClient

    await Database.updateServerSettings({
      downloadClients: clients
    })

    Logger.info(`[DownloadClientController] Updated download client "${name}"`)
    res.json({ client: updatedClient })
  }

  /**
   * DELETE: /api/download-clients/:id
   * Delete a download client
   *
   * @param {DownloadClientControllerRequest} req
   * @param {Response} res
   */
  static async deleteClient(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[DownloadClientController] Non-admin user "${req.user.username}" attempted to delete download client`)
      return res.sendStatus(403)
    }

    const { id } = req.params
    const clients = Database.serverSettings.downloadClients || []
    const clientIndex = clients.findIndex(client => client.id === id)

    if (clientIndex === -1) {
      return res.status(404).json({ error: 'Download client not found' })
    }

    const deletedClient = clients.splice(clientIndex, 1)[0]

    await Database.updateServerSettings({
      downloadClients: clients
    })

    Logger.info(`[DownloadClientController] Deleted download client "${deletedClient.name}"`)
    res.json({ message: 'Download client deleted successfully' })
  }

  /**
   * POST: /api/download-clients/:id/test
   * Test a download client connection
   *
   * @param {DownloadClientControllerRequest} req
   * @param {Response} res
   */
  static async testClient(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[DownloadClientController] Non-admin user "${req.user.username}" attempted to test download client`)
      return res.sendStatus(403)
    }

    const { id } = req.params
    const clients = Database.serverSettings.downloadClients || []
    const client = clients.find(client => client.id === id)

    if (!client) {
      return res.status(404).json({ error: 'Download client not found' })
    }

    try {
      const result = await DownloadClientController.testConnection(client)
      Logger.info(`[DownloadClientController] Test successful for download client "${client.name}"`)
      res.json(result)
    } catch (error) {
      Logger.error(`[DownloadClientController] Test failed for download client "${client.name}":`, error.message)
      res.status(400).json({ 
        success: false, 
        message: error.message 
      })
    }
  }

  /**
   * POST: /api/download-clients/:id/add-torrent
   * Add a torrent to the download client
   *
   * @param {DownloadClientControllerRequest} req
   * @param {Response} res
   */
  static async addTorrent(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[DownloadClientController] Non-admin user "${req.user.username}" attempted to add torrent`)
      return res.sendStatus(403)
    }

    const { id } = req.params
    const { magnetUrl, downloadUrl, category, downloadPath, wishlistItemId } = req.body

    if (!magnetUrl && !downloadUrl) {
      return res.status(400).json({ error: 'Either magnetUrl or downloadUrl is required' })
    }

    const clients = Database.serverSettings.downloadClients || []
    const client = clients.find(client => client.id === id)

    if (!client) {
      return res.status(404).json({ error: 'Download client not found' })
    }

    if (!client.enabled) {
      return res.status(400).json({ error: 'Download client is disabled' })
    }

    try {
      Logger.debug(`[DownloadClientController] About to call addTorrentToClient with client type: ${client.type}`)
      Logger.debug(`[DownloadClientController] Torrent data: { magnetUrl: ${magnetUrl}, downloadUrl: ${downloadUrl}, wishlistItemId: ${wishlistItemId} }`)
      
      const result = await DownloadClientController.addTorrentToClient(client, {
        magnetUrl,
        downloadUrl,
        category: category || client.category,
        downloadPath: downloadPath || client.downloadPath,
        wishlistItemId
      })
      
      Logger.debug(`[DownloadClientController] addTorrentToClient returned result:`, result)
      Logger.info(`[DownloadClientController] Successfully added torrent to "${client.name}"`)
      res.json(result)
    } catch (error) {
      Logger.error(`[DownloadClientController] Failed to add torrent to "${client.name}":`, error.message)
      Logger.error(`[DownloadClientController] Full error:`, error)
      res.status(400).json({ 
        success: false, 
        message: error.message 
      })
    }
  }

  /**
   * GET: /api/download-clients/progress
   * Get download progress for all clients
   *
   * @param {DownloadClientControllerRequest} req
   * @param {Response} res
   */
  static async getDownloadProgress(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[DownloadClientController] Non-admin user "${req.user.username}" attempted to get download progress`)
      return res.sendStatus(403)
    }

    try {
      // Get all wishlist items for this user
      const allWishlistItems = await Database.wishlistItemModel.findAll({
        where: { 
          userId: req.user.id
        }
      })

      // Filter items that have pending downloads (client-side filtering)
      const wishlistItems = allWishlistItems.filter(item => {
        const pendingDownloads = item.pendingDownloads || []
        return Array.isArray(pendingDownloads) && pendingDownloads.length > 0
      })

      const clients = Database.serverSettings.downloadClients || []
      const enabledClients = clients.filter(client => client.enabled)

      const progressByWishlistItem = {}

      // Get torrents from all clients
      for (const client of enabledClients) {
        try {
          const torrents = await DownloadClientController.getTorrentsFromClient(client)
          Logger.debug(`[DownloadClientController] Got ${torrents.length} torrents from "${client.name}"`)
          
          // Log the structure of torrents if any exist
          if (torrents.length > 0) {
            Logger.debug(`[DownloadClientController] Sample torrent data from "${client.name}":`, torrents[0])
          }
          
          // Match torrents to wishlist items by hash
          for (const wishlistItem of wishlistItems) {
            const pendingDownloads = wishlistItem.pendingDownloads || []
            
            for (const pendingDownload of pendingDownloads) {
              if (pendingDownload.clientId === client.id) {
                // Find matching torrent by hash
                const matchingTorrent = torrents.find(torrent => {
                  if (pendingDownload.hash) {
                    return torrent.hash && torrent.hash.toLowerCase() === pendingDownload.hash.toLowerCase()
                  }
                  return false
                })

                if (matchingTorrent) {
                  Logger.debug(`[DownloadClientController] Found matching torrent for wishlist item "${wishlistItem.title}":`, matchingTorrent)
                  
                  // Initialize array if it doesn't exist
                  if (!progressByWishlistItem[wishlistItem.id]) {
                    progressByWishlistItem[wishlistItem.id] = []
                  }
                  
                  // Add this download to the array with real size data from the torrent client
                  const progressData = {
                    name: matchingTorrent.name,
                    progress: matchingTorrent.progress,
                    state: matchingTorrent.state,
                    dlspeed: matchingTorrent.dlspeed,
                    upspeed: matchingTorrent.upspeed,
                    eta: matchingTorrent.eta,
                    hash: matchingTorrent.hash,
                    clientName: client.name,
                    clientId: client.id,
                    downloadUrl: pendingDownload.url,
                    // Real size data from the torrent client
                    totalSize: matchingTorrent.total_size || 0,
                    downloaded: matchingTorrent.downloaded || 0,
                    amountLeft: matchingTorrent.amount_left || 0
                  }
                  
                  Logger.debug(`[DownloadClientController] Progress data created for wishlist item "${wishlistItem.title}":`, progressData)
                  progressByWishlistItem[wishlistItem.id].push(progressData)
                }
              }
            }
          }
        } catch (error) {
          Logger.error(`[DownloadClientController] Failed to get torrents from "${client.name}":`, error.message)
        }
      }

      Logger.debug(`[DownloadClientController] Final progress response:`, { progressByWishlistItem })
      res.json({ progressByWishlistItem })
    } catch (error) {
      Logger.error(`[DownloadClientController] Failed to get download progress:`, error)
      res.status(500).json({ error: 'Failed to get download progress' })
    }
  }

  /**
   * Test connection to a download client
   * 
   * @param {Object} client 
   * @returns {Promise<Object>}
   */
  static async testConnection(client) {
    switch (client.type) {
      case 'qbittorrent':
        return await DownloadClientController.testQBittorrent(client)
      case 'transmission':
        return await DownloadClientController.testTransmission(client)
      case 'deluge':
        return await DownloadClientController.testDeluge(client)
      case 'rtorrent':
        return await DownloadClientController.testRTorrent(client)
      default:
        throw new Error(`Unsupported client type: ${client.type}`)
    }
  }

  /**
   * Add torrent to download client
   * 
   * @param {Object} client 
   * @param {Object} torrentData 
   * @returns {Promise<Object>}
   */
  static async addTorrentToClient(client, torrentData) {
    Logger.debug(`[DownloadClientController] addTorrentToClient called with:`, {
      clientType: client.type,
      clientName: client.name,
      torrentData: torrentData
    })
    
    switch (client.type) {
      case 'qbittorrent':
        Logger.debug(`[DownloadClientController] Calling addTorrentQBittorrent`)
        const qbResult = await DownloadClientController.addTorrentQBittorrent(client, torrentData)
        Logger.debug(`[DownloadClientController] addTorrentQBittorrent returned:`, qbResult)
        return qbResult
      case 'transmission':
        return await DownloadClientController.addTorrentTransmission(client, torrentData)
      case 'deluge':
        return await DownloadClientController.addTorrentDeluge(client, torrentData)
      case 'rtorrent':
        return await DownloadClientController.addTorrentRTorrent(client, torrentData)
      default:
        throw new Error(`Unsupported client type: ${client.type}`)
    }
  }

  /**
   * Get torrents from download client
   * 
   * @param {Object} client 
   * @returns {Promise<Array>}
   */
  static async getTorrentsFromClient(client) {
    switch (client.type) {
      case 'qbittorrent':
        return await DownloadClientController.getTorrentsQBittorrent(client)
      case 'transmission':
        return await DownloadClientController.getTorrentsTransmission(client)
      case 'deluge':
        return await DownloadClientController.getTorrentsDeluge(client)
      case 'rtorrent':
        return await DownloadClientController.getTorrentsRTorrent(client)
      default:
        throw new Error(`Unsupported client type: ${client.type}`)
    }
  }

  /**
   * Test qBittorrent connection
   * 
   * @param {Object} client 
   * @returns {Promise<Object>}
   */
  static async testQBittorrent(client) {
    const baseUrl = `http://${client.host}:${client.port}`
    
    try {
      // First, login to get session cookie
      const loginResponse = await axios.post(`${baseUrl}/api/v2/auth/login`, 
        `username=${encodeURIComponent(client.username)}&password=${encodeURIComponent(client.password)}`,
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 10000
        }
      )

      if (loginResponse.data !== 'Ok.') {
        throw new Error('Authentication failed')
      }

      // Get session cookie
      const cookies = loginResponse.headers['set-cookie']
      const cookie = cookies ? cookies[0].split(';')[0] : ''

      // Test API access by getting version
      const versionResponse = await axios.get(`${baseUrl}/api/v2/app/version`, {
        headers: { Cookie: cookie },
        timeout: 10000
      })

      return {
        success: true,
        message: `Connected to qBittorrent v${versionResponse.data}`
      }
    } catch (error) {
      if (error.response) {
        throw new Error(`HTTP ${error.response.status}: ${error.response.statusText}`)
      }
      throw new Error(error.message)
    }
  }

  /**
   * Add torrent to qBittorrent
   * 
   * @param {Object} client 
   * @param {Object} torrentData 
   * @returns {Promise<Object>}
   */
  static async addTorrentQBittorrent(client, torrentData) {
    Logger.info(`[DownloadClientController] *** ENTERING addTorrentQBittorrent method ***`)
    Logger.info(`[DownloadClientController] Client:`, client)
    Logger.info(`[DownloadClientController] TorrentData:`, torrentData)
    
    const baseUrl = `http://${client.host}:${client.port}`
    Logger.info(`[DownloadClientController] Base URL: ${baseUrl}`)
    
    try {
      Logger.debug(`[DownloadClientController] Adding torrent to qBittorrent at ${baseUrl}`)
      Logger.debug(`[DownloadClientController] Torrent data:`, { 
        magnetUrl: torrentData.magnetUrl, 
        downloadUrl: torrentData.downloadUrl,
        category: torrentData.category,
        downloadPath: torrentData.downloadPath,
        wishlistItemId: torrentData.wishlistItemId
      })

      // Login first
      const loginResponse = await axios.post(`${baseUrl}/api/v2/auth/login`, 
        `username=${encodeURIComponent(client.username)}&password=${encodeURIComponent(client.password)}`,
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 10000
        }
      )

      Logger.debug(`[DownloadClientController] Login response: ${loginResponse.data}`)

      if (loginResponse.data !== 'Ok.') {
        throw new Error('Authentication failed')
      }

      const cookies = loginResponse.headers['set-cookie']
      const cookie = cookies ? cookies[0].split(';')[0] : ''
      Logger.debug(`[DownloadClientController] Got session cookie: ${cookie}`)

      // Get torrents list before adding to identify the new torrent
      const torrentsBeforeResponse = await axios.get(`${baseUrl}/api/v2/torrents/info`, {
        headers: { Cookie: cookie },
        timeout: 10000
      })
      const torrentsBefore = torrentsBeforeResponse.data.map(t => t.hash)
      Logger.debug(`[DownloadClientController] Found ${torrentsBefore.length} existing torrents`)

      // Prepare form data
      const formData = new URLSearchParams()
      
      let actualMagnetUrl = torrentData.magnetUrl
      
      // If we have a download URL but no magnet URL, follow redirects to get the actual magnet link
      if (!actualMagnetUrl && torrentData.downloadUrl) {
        Logger.debug(`[DownloadClientController] Following redirect for download URL: ${torrentData.downloadUrl}`)
        try {
          const redirectResponse = await axios.get(torrentData.downloadUrl, {
            maxRedirects: 0,
            validateStatus: status => status === 302 || status === 301,
            timeout: 10000
          })
          
          const location = redirectResponse.headers.location
          if (location && location.startsWith('magnet:')) {
            actualMagnetUrl = location
            Logger.debug(`[DownloadClientController] Found magnet URL from redirect: ${actualMagnetUrl}`)
          } else {
            Logger.error(`[DownloadClientController] Redirect did not return a magnet URL. Location: ${location}`)
            throw new Error(`Invalid redirect location: ${location}`)
          }
        } catch (error) {
          if (error.response && (error.response.status === 302 || error.response.status === 301)) {
            // This is actually the expected behavior - we got a redirect
            const location = error.response.headers.location
            if (location && location.startsWith('magnet:')) {
              actualMagnetUrl = location
              Logger.debug(`[DownloadClientController] Found magnet URL from redirect: ${actualMagnetUrl}`)
            } else {
              Logger.error(`[DownloadClientController] Redirect did not return a magnet URL. Location: ${location}`)
              throw new Error(`Invalid redirect location: ${location}`)
            }
          } else {
            Logger.error(`[DownloadClientController] Failed to follow redirect: ${error.message}`)
            throw new Error(`Failed to resolve download URL: ${error.message}`)
          }
        }
      }
      
      if (actualMagnetUrl) {
        formData.append('urls', actualMagnetUrl)
        Logger.debug(`[DownloadClientController] Adding magnet URL: ${actualMagnetUrl}`)
      } else if (torrentData.downloadUrl) {
        // Fallback to download URL if we couldn't get magnet
        formData.append('urls', torrentData.downloadUrl)
        Logger.debug(`[DownloadClientController] Adding download URL as fallback: ${torrentData.downloadUrl}`)
      } else {
        throw new Error('No magnet URL or download URL available')
      }
      
      if (torrentData.category) {
        formData.append('category', torrentData.category)
        Logger.debug(`[DownloadClientController] Setting category: ${torrentData.category}`)
      }
      
      if (torrentData.downloadPath) {
        // Use hostDownloadPath if configured, otherwise fall back to downloadPath
        const hostPath = client.hostDownloadPath || torrentData.downloadPath
        formData.append('savepath', hostPath)
        Logger.debug(`[DownloadClientController] Setting save path: ${hostPath} (using ${client.hostDownloadPath ? 'host path' : 'container path'})`)
      }

      Logger.debug(`[DownloadClientController] Form data: ${formData.toString()}`)

      // Add torrent
      const addResponse = await axios.post(`${baseUrl}/api/v2/torrents/add`, formData, {
        headers: { 
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: cookie 
        },
        timeout: 30000
      })

      Logger.debug(`[DownloadClientController] Add torrent response: ${addResponse.data}`)

      if (addResponse.data === 'Ok.') {
        Logger.debug(`[DownloadClientController] Torrent added successfully to qBittorrent`)
        
        // If wishlist item ID is provided, get the hash of the newly added torrent
        if (torrentData.wishlistItemId) {
          Logger.debug(`[DownloadClientController] Waiting for torrent to be processed...`)
          // Wait a bit for the torrent to be processed
          await new Promise(resolve => setTimeout(resolve, 2000))
          
          // Get torrents list after adding to identify the new torrent
          const torrentsAfterResponse = await axios.get(`${baseUrl}/api/v2/torrents/info`, {
            headers: { Cookie: cookie },
            timeout: 10000
          })
          const torrentsAfter = torrentsAfterResponse.data
          Logger.debug(`[DownloadClientController] Found ${torrentsAfter.length} torrents after adding`)
          
          // Find the new torrent by comparing hashes
          const newTorrent = torrentsAfter.find(t => !torrentsBefore.includes(t.hash))
          
          if (newTorrent) {
            Logger.debug(`[DownloadClientController] Found new torrent with hash: ${newTorrent.hash}`)
            // Store the hash in the wishlist item
            await DownloadClientController.storeTorrentHashInWishlist(
              torrentData.wishlistItemId, 
              client.id,
              torrentData.magnetUrl || torrentData.downloadUrl,
              newTorrent.hash
            )
          } else {
            Logger.debug(`[DownloadClientController] Could not find new torrent, using fallback method`)
            // Fallback to original method if we can't find the new torrent
            await DownloadClientController.storeTorrentHashInWishlist(
              torrentData.wishlistItemId, 
              client.id,
              torrentData.magnetUrl || torrentData.downloadUrl
            )
          }
        }

        return {
          success: true,
          message: 'Torrent added successfully'
        }
      } else {
        Logger.error(`[DownloadClientController] qBittorrent returned unexpected response: ${addResponse.data}`)
        throw new Error('Failed to add torrent')
      }
    } catch (error) {
      Logger.error(`[DownloadClientController] Error adding torrent to qBittorrent:`, error)
      if (error.response) {
        Logger.error(`[DownloadClientController] HTTP Response:`, error.response.data)
        throw new Error(`HTTP ${error.response.status}: ${error.response.statusText}`)
      }
      throw new Error(error.message)
    }
  }

  /**
   * Get torrents from qBittorrent
   * 
   * @param {Object} client 
   * @returns {Promise<Array>}
   */
  static async getTorrentsQBittorrent(client) {
    const baseUrl = `http://${client.host}:${client.port}`
    
    try {
      // Login first
      const loginResponse = await axios.post(`${baseUrl}/api/v2/auth/login`, 
        `username=${encodeURIComponent(client.username)}&password=${encodeURIComponent(client.password)}`,
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 10000
        }
      )

      if (loginResponse.data !== 'Ok.') {
        throw new Error('Authentication failed')
      }

      const cookies = loginResponse.headers['set-cookie']
      const cookie = cookies ? cookies[0].split(';')[0] : ''

      // Get torrents list
      const torrentsResponse = await axios.get(`${baseUrl}/api/v2/torrents/info`, {
        headers: { Cookie: cookie },
        timeout: 10000
      })

      return torrentsResponse.data.map(torrent => ({
        hash: torrent.hash,
        name: torrent.name,
        progress: torrent.progress,
        dlspeed: torrent.dlspeed,
        upspeed: torrent.upspeed,
        priority: torrent.priority,
        num_seeds: torrent.num_seeds,
        num_leechs: torrent.num_leechs,
        ratio: torrent.ratio,
        eta: torrent.eta,
        state: torrent.state,
        seq_dl: torrent.seq_dl,
        f_l_piece_prio: torrent.f_l_piece_prio,
        completion_on: torrent.completion_on,
        tracker: torrent.tracker,
        dl_limit: torrent.dl_limit,
        up_limit: torrent.up_limit,
        downloaded: torrent.downloaded,
        uploaded: torrent.uploaded,
        downloaded_session: torrent.downloaded_session,
        uploaded_session: torrent.uploaded_session,
        amount_left: torrent.amount_left,
        save_path: torrent.save_path,
        completed: torrent.completed,
        max_ratio: torrent.max_ratio,
        max_seeding_time: torrent.max_seeding_time,
        ratio_limit: torrent.ratio_limit,
        seeding_time_limit: torrent.seeding_time_limit,
        seen_complete: torrent.seen_complete,
        last_activity: torrent.last_activity,
        time_active: torrent.time_active,
        total_size: torrent.total_size,
        magnet_uri: torrent.magnet_uri
      }))
    } catch (error) {
      if (error.response) {
        throw new Error(`HTTP ${error.response.status}: ${error.response.statusText}`)
      }
      throw new Error(error.message)
    }
  }

  /**
   * Store torrent hash in wishlist item
   * 
   * @param {string} wishlistItemId 
   * @param {string} clientId 
   * @param {string} magnetOrDownloadUrl 
   * @param {string} providedHash - Optional hash provided by the torrent client
   */
  static async storeTorrentHashInWishlist(wishlistItemId, clientId, magnetOrDownloadUrl, providedHash = null) {
    try {
      const wishlistItem = await Database.wishlistItemModel.findByPk(wishlistItemId)
      if (!wishlistItem) {
        Logger.error(`[DownloadClientController] Wishlist item not found: ${wishlistItemId}`)
        return
      }

      // Use provided hash if available, otherwise extract from magnet URL
      let hash = providedHash
      if (!hash && magnetOrDownloadUrl.startsWith('magnet:')) {
        const hashMatch = magnetOrDownloadUrl.match(/xt=urn:btih:([a-zA-Z0-9]+)/i)
        if (hashMatch) {
          hash = hashMatch[1].toLowerCase()
        }
      }

      const pendingDownloads = wishlistItem.pendingDownloads || []
      const downloadEntry = {
        clientId,
        url: magnetOrDownloadUrl,
        hash: hash,
        addedAt: new Date().toISOString()
      }

      // Avoid duplicates
      const exists = pendingDownloads.some(download => 
        download.url === magnetOrDownloadUrl || (hash && download.hash === hash)
      )

      if (!exists) {
        pendingDownloads.push(downloadEntry)
        
        // Use direct assignment and save() with changed() to force Sequelize to recognize the change
        wishlistItem.pendingDownloads = pendingDownloads
        wishlistItem.changed('pendingDownloads', true)
        await wishlistItem.save()
        
        Logger.info(`[DownloadClientController] Added pending download to wishlist item "${wishlistItem.title}"`)
      }
    } catch (error) {
      Logger.error(`[DownloadClientController] Failed to store torrent hash in wishlist:`, error)
    }
  }

  /**
   * Test Transmission connection
   * 
   * @param {Object} client 
   * @returns {Promise<Object>}
   */
  static async testTransmission(client) {
    // Transmission uses RPC, implement basic test
    return {
      success: true,
      message: 'Transmission connection test not yet implemented'
    }
  }

  /**
   * Add torrent to Transmission
   * 
   * @param {Object} client 
   * @param {Object} torrentData 
   * @returns {Promise<Object>}
   */
  static async addTorrentTransmission(client, torrentData) {
    // Use hostDownloadPath if configured, otherwise fall back to downloadPath
    const hostPath = client.hostDownloadPath || torrentData.downloadPath
    Logger.debug(`[DownloadClientController] Transmission download path: ${hostPath} (using ${client.hostDownloadPath ? 'host path' : 'container path'})`)
    
    // Implement Transmission RPC call
    throw new Error('Transmission torrent adding not yet implemented')
  }

  /**
   * Get torrents from Transmission
   * 
   * @param {Object} client 
   * @returns {Promise<Array>}
   */
  static async getTorrentsTransmission(client) {
    // Implement Transmission RPC call
    throw new Error('Transmission torrent listing not yet implemented')
  }

  /**
   * Test Deluge connection
   * 
   * @param {Object} client 
   * @returns {Promise<Object>}
   */
  static async testDeluge(client) {
    // Deluge uses JSON-RPC, implement basic test
    return {
      success: true,
      message: 'Deluge connection test not yet implemented'
    }
  }

  /**
   * Add torrent to Deluge
   * 
   * @param {Object} client 
   * @param {Object} torrentData 
   * @returns {Promise<Object>}
   */
  static async addTorrentDeluge(client, torrentData) {
    // Use hostDownloadPath if configured, otherwise fall back to downloadPath
    const hostPath = client.hostDownloadPath || torrentData.downloadPath
    Logger.debug(`[DownloadClientController] Deluge download path: ${hostPath} (using ${client.hostDownloadPath ? 'host path' : 'container path'})`)
    
    // Implement Deluge JSON-RPC call
    throw new Error('Deluge torrent adding not yet implemented')
  }

  /**
   * Get torrents from Deluge
   * 
   * @param {Object} client 
   * @returns {Promise<Array>}
   */
  static async getTorrentsDeluge(client) {
    // Implement Deluge JSON-RPC call
    throw new Error('Deluge torrent listing not yet implemented')
  }

  /**
   * Test rTorrent connection
   * 
   * @param {Object} client 
   * @returns {Promise<Object>}
   */
  static async testRTorrent(client) {
    // rTorrent uses XML-RPC, implement basic test
    return {
      success: true,
      message: 'rTorrent connection test not yet implemented'
    }
  }

  /**
   * Add torrent to rTorrent
   * 
   * @param {Object} client 
   * @param {Object} torrentData 
   * @returns {Promise<Object>}
   */
  static async addTorrentRTorrent(client, torrentData) {
    // Use hostDownloadPath if configured, otherwise fall back to downloadPath
    const hostPath = client.hostDownloadPath || torrentData.downloadPath
    Logger.debug(`[DownloadClientController] rTorrent download path: ${hostPath} (using ${client.hostDownloadPath ? 'host path' : 'container path'})`)
    
    // Implement rTorrent XML-RPC call
    throw new Error('rTorrent torrent adding not yet implemented')
  }

  /**
   * Get torrents from rTorrent
   * 
   * @param {Object} client 
   * @returns {Promise<Array>}
   */
  static async getTorrentsRTorrent(client) {
    // Implement rTorrent XML-RPC call
    throw new Error('rTorrent torrent listing not yet implemented')
  }

  /**
   * DELETE: /api/download-clients/:id/torrents/:hash
   * Cancel a download by removing the torrent from the client
   *
   * @param {DownloadClientControllerRequest} req
   * @param {Response} res
   */
  static async cancelDownload(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[DownloadClientController] Non-admin user "${req.user.username}" attempted to cancel download`)
      return res.sendStatus(403)
    }

    const { id, hash } = req.params
    const { wishlistItemId } = req.body

    if (!hash) {
      return res.status(400).json({ error: 'Hash is required' })
    }

    const clients = Database.serverSettings.downloadClients || []
    const client = clients.find(client => client.id === id)

    if (!client) {
      return res.status(404).json({ error: 'Download client not found' })
    }

    if (!client.enabled) {
      return res.status(400).json({ error: 'Download client is disabled' })
    }

    try {
      // Remove torrent from client
      const result = await DownloadClientController.removeTorrentFromClient(client, hash)
      
      // Remove from wishlist pending downloads if provided
      if (wishlistItemId) {
        await DownloadClientController.removePendingDownloadFromWishlist(wishlistItemId, hash)
      }

      Logger.info(`[DownloadClientController] Successfully cancelled download for hash "${hash}" from "${client.name}"`)
      res.json({ success: true, message: 'Download cancelled successfully' })
    } catch (error) {
      Logger.error(`[DownloadClientController] Failed to cancel download from "${client.name}":`, error.message)
      res.status(400).json({ 
        success: false, 
        message: error.message 
      })
    }
  }

  /**
   * Remove torrent from download client
   * 
   * @param {Object} client 
   * @param {string} hash 
   * @returns {Promise<Object>}
   */
  static async removeTorrentFromClient(client, hash) {
    switch (client.type) {
      case 'qbittorrent':
        return await DownloadClientController.removeTorrentQBittorrent(client, hash)
      case 'transmission':
        return await DownloadClientController.removeTorrentTransmission(client, hash)
      case 'deluge':
        return await DownloadClientController.removeTorrentDeluge(client, hash)
      case 'rtorrent':
        return await DownloadClientController.removeTorrentRTorrent(client, hash)
      default:
        throw new Error(`Unsupported client type: ${client.type}`)
    }
  }

  /**
   * Remove pending download from wishlist item
   * 
   * @param {string} wishlistItemId 
   * @param {string} hash 
   */
  static async removePendingDownloadFromWishlist(wishlistItemId, hash) {
    try {
      const wishlistItem = await Database.wishlistItemModel.findByPk(wishlistItemId)
      if (!wishlistItem) {
        Logger.error(`[DownloadClientController] Wishlist item not found: ${wishlistItemId}`)
        return
      }

      const pendingDownloads = wishlistItem.pendingDownloads || []
      const filteredDownloads = pendingDownloads.filter(download => 
        download.hash !== hash && download.hash !== hash.toLowerCase()
      )

      // Use direct assignment and save() with changed() to force Sequelize to recognize the change
      wishlistItem.pendingDownloads = filteredDownloads
      wishlistItem.changed('pendingDownloads', true)
      await wishlistItem.save()
      
      Logger.info(`[DownloadClientController] Removed pending download with hash "${hash}" from wishlist item "${wishlistItem.title}"`)
    } catch (error) {
      Logger.error(`[DownloadClientController] Failed to remove pending download from wishlist:`, error)
    }
  }

  /**
   * Remove torrent from qBittorrent
   * 
   * @param {Object} client 
   * @param {string} hash 
   * @returns {Promise<Object>}
   */
  static async removeTorrentQBittorrent(client, hash) {
    const baseUrl = `http://${client.host}:${client.port}`
    
    try {
      // Login first
      const loginResponse = await axios.post(`${baseUrl}/api/v2/auth/login`, 
        `username=${encodeURIComponent(client.username)}&password=${encodeURIComponent(client.password)}`,
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 10000
        }
      )

      if (loginResponse.data !== 'Ok.') {
        throw new Error('Authentication failed')
      }

      const cookies = loginResponse.headers['set-cookie']
      const cookie = cookies ? cookies[0].split(';')[0] : ''

      // Delete torrent and files
      const deleteResponse = await axios.post(`${baseUrl}/api/v2/torrents/delete`, 
        `hashes=${hash}&deleteFiles=true`,
        {
          headers: { 
            'Content-Type': 'application/x-www-form-urlencoded',
            Cookie: cookie 
          },
          timeout: 10000
        }
      )

      return { success: true, message: 'Torrent removed from qBittorrent' }
    } catch (error) {
      if (error.response) {
        throw new Error(`HTTP ${error.response.status}: ${error.response.statusText}`)
      }
      throw new Error(error.message)
    }
  }

  /**
   * Remove torrent from Transmission
   * 
   * @param {Object} client 
   * @param {string} hash 
   * @returns {Promise<Object>}
   */
  static async removeTorrentTransmission(client, hash) {
    // Implement Transmission RPC call
    throw new Error('Transmission torrent removal not yet implemented')
  }

  /**
   * Remove torrent from Deluge
   * 
   * @param {Object} client 
   * @param {string} hash 
   * @returns {Promise<Object>}
   */
  static async removeTorrentDeluge(client, hash) {
    // Implement Deluge JSON-RPC call
    throw new Error('Deluge torrent removal not yet implemented')
  }

  /**
   * Remove torrent from rTorrent
   * 
   * @param {Object} client 
   * @param {string} hash 
   * @returns {Promise<Object>}
   */
  static async removeTorrentRTorrent(client, hash) {
    // Implement rTorrent XML-RPC call
    throw new Error('rTorrent torrent removal not yet implemented')
  }
}

module.exports = DownloadClientController 