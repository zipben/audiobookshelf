const axios = require('axios')
const xml2js = require('xml2js')
const Logger = require('../Logger')
const Database = require('../Database')

/**
 * @typedef RequestWithUser
 * @property {import('../models/User')} user
 * 
 * @typedef {import('express').Request & RequestWithUser} JackettControllerRequest
 * @typedef {import('express').Response} Response
 */

class JackettController {
  /**
   * GET: /api/jackett/integrations
   * Get all Jackett integrations
   *
   * @param {JackettControllerRequest} req
   * @param {Response} res
   */
  static async getIntegrations(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[JackettController] Non-admin user "${req.user.username}" attempted to get integrations`)
      return res.sendStatus(403)
    }

    const integrations = Database.serverSettings.jackettIntegrations || []
    res.json({ integrations })
  }

  /**
   * POST: /api/jackett/integrations
   * Create a new Jackett integration
   *
   * @param {JackettControllerRequest} req
   * @param {Response} res
   */
  static async createIntegration(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[JackettController] Non-admin user "${req.user.username}" attempted to create integration`)
      return res.sendStatus(403)
    }

    const { name, url, apiKey, categories, enabled = true } = req.body

    if (!name || !url || !apiKey) {
      return res.status(400).json({ error: 'Name, URL, and API key are required' })
    }

    const integrations = Database.serverSettings.jackettIntegrations || []
    
    // Check if name already exists
    if (integrations.some(integration => integration.name === name)) {
      return res.status(400).json({ error: 'Integration with this name already exists' })
    }

    const newIntegration = {
      id: Date.now().toString(),
      name,
      url,
      apiKey,
      categories: categories || [],
      enabled,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    integrations.push(newIntegration)

    await Database.updateServerSettings({
      jackettIntegrations: integrations
    })

    Logger.info(`[JackettController] Created integration "${name}"`)
    res.json({ integration: newIntegration })
  }

  /**
   * PUT: /api/jackett/integrations/:id
   * Update a Jackett integration
   *
   * @param {JackettControllerRequest} req
   * @param {Response} res
   */
  static async updateIntegration(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[JackettController] Non-admin user "${req.user.username}" attempted to update integration`)
      return res.sendStatus(403)
    }

    const { id } = req.params
    const { name, url, apiKey, categories, enabled } = req.body

    if (!name || !url || !apiKey) {
      return res.status(400).json({ error: 'Name, URL, and API key are required' })
    }

    const integrations = Database.serverSettings.jackettIntegrations || []
    const integrationIndex = integrations.findIndex(integration => integration.id === id)

    if (integrationIndex === -1) {
      return res.status(404).json({ error: 'Integration not found' })
    }

    // Check if name already exists (excluding current integration)
    if (integrations.some((integration, index) => integration.name === name && index !== integrationIndex)) {
      return res.status(400).json({ error: 'Integration with this name already exists' })
    }

    const updatedIntegration = {
      ...integrations[integrationIndex],
      name,
      url,
      apiKey,
      categories: categories || [],
      enabled: enabled !== undefined ? enabled : integrations[integrationIndex].enabled,
      updatedAt: new Date().toISOString()
    }

    integrations[integrationIndex] = updatedIntegration

    await Database.updateServerSettings({
      jackettIntegrations: integrations
    })

    Logger.info(`[JackettController] Updated integration "${name}"`)
    res.json({ integration: updatedIntegration })
  }

  /**
   * DELETE: /api/jackett/integrations/:id
   * Delete a Jackett integration
   *
   * @param {JackettControllerRequest} req
   * @param {Response} res
   */
  static async deleteIntegration(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[JackettController] Non-admin user "${req.user.username}" attempted to delete integration`)
      return res.sendStatus(403)
    }

    const { id } = req.params
    const integrations = Database.serverSettings.jackettIntegrations || []
    const integrationIndex = integrations.findIndex(integration => integration.id === id)

    if (integrationIndex === -1) {
      return res.status(404).json({ error: 'Integration not found' })
    }

    const deletedIntegration = integrations.splice(integrationIndex, 1)[0]

    await Database.updateServerSettings({
      jackettIntegrations: integrations
    })

    Logger.info(`[JackettController] Deleted integration "${deletedIntegration.name}"`)
    res.json({ message: 'Integration deleted successfully' })
  }

  /**
   * POST: /api/jackett/integrations/:id/test
   * Test a Jackett integration connection
   *
   * @param {JackettControllerRequest} req
   * @param {Response} res
   */
  static async testIntegration(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[JackettController] Non-admin user "${req.user.username}" attempted to test integration`)
      return res.sendStatus(403)
    }

    const { id } = req.params
    const integrations = Database.serverSettings.jackettIntegrations || []
    const integration = integrations.find(integration => integration.id === id)

    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' })
    }

    try {
      // Test the connection by trying to get indexer capabilities
      const testUrl = integration.url.replace(/\/torznab.*$/, '/torznab?t=caps&apikey=' + integration.apiKey)
      
      const response = await axios.get(testUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Audiobookshelf'
        }
      })

      if (response.status === 200) {
        Logger.info(`[JackettController] Test successful for integration "${integration.name}"`)
        res.json({ 
          success: true, 
          message: 'Connection successful',
          capabilities: response.data
        })
      } else {
        res.status(400).json({ 
          success: false, 
          message: `HTTP ${response.status}: ${response.statusText}` 
        })
      }
    } catch (error) {
      Logger.error(`[JackettController] Test failed for integration "${integration.name}":`, error.message)
      res.status(400).json({ 
        success: false, 
        message: error.message 
      })
    }
  }

  /**
   * POST: /api/jackett/search
   * Search across all enabled Jackett integrations
   *
   * @param {JackettControllerRequest} req
   * @param {Response} res
   */
  static async search(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[JackettController] Non-admin user "${req.user.username}" attempted to search`)
      return res.sendStatus(403)
    }

    const { query, categories } = req.body

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Search query is required' })
    }

    const integrations = Database.serverSettings.jackettIntegrations || []
    const activeIntegrations = integrations.filter(integration => integration.enabled)

    if (activeIntegrations.length === 0) {
      return res.json({ 
        results: [], 
        message: 'No active Jackett integrations found',
        searchQuery: query.trim()
      })
    }

    Logger.info(`[JackettController] Searching for "${query}" across ${activeIntegrations.length} integrations`)

    try {
      // Search all active integrations in parallel
      const searchPromises = activeIntegrations.map(async (integration) => {
        try {
          return await JackettController.searchIntegration(integration, query.trim(), categories)
        } catch (error) {
          Logger.error(`[JackettController] Search failed for integration "${integration.name}":`, error.message)
          return { integration: integration.name, results: [], error: error.message }
        }
      })

      const searchResults = await Promise.all(searchPromises)
      
      // Combine all results
      const allResults = []
      const integrationErrors = []

      searchResults.forEach(result => {
        if (result.error) {
          integrationErrors.push({
            integration: result.integration,
            error: result.error
          })
        } else {
          allResults.push(...result.results)
        }
      })

      Logger.info(`[JackettController] Search completed. Found ${allResults.length} total results`)

      res.json({
        results: allResults,
        searchQuery: query.trim(),
        totalResults: allResults.length,
        searchedIntegrations: activeIntegrations.length,
        errors: integrationErrors
      })

    } catch (error) {
      Logger.error(`[JackettController] Search error:`, error.message)
      res.status(500).json({ 
        error: 'Search failed', 
        message: error.message 
      })
    }
  }

  /**
   * Search a single Jackett integration
   * 
   * @param {Object} integration 
   * @param {string} query 
   * @param {Array} categories 
   * @returns {Promise<Object>}
   */
  static async searchIntegration(integration, query, categories) {
    // Build search URL following Torznab specification
    const searchParams = new URLSearchParams({
      t: 'search', // Use generic search function as per Torznab spec
      apikey: integration.apiKey,
      q: query,
      format: 'xml'
    })

    // Add categories if specified
    if (categories && categories.length > 0) {
      searchParams.set('cat', categories.join(','))
    } else if (integration.categories && integration.categories.length > 0) {
      searchParams.set('cat', integration.categories.join(','))
    }

    // Use the original Torznab URL with search parameters
    const searchUrl = `${integration.url}?${searchParams.toString()}`
    
    Logger.info(`[JackettController] Searching integration "${integration.name}" at: ${searchUrl.replace(/apikey=[^&]+/, 'apikey=***')}`)

    const response = await axios.get(searchUrl, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Audiobookshelf'
      }
    })

    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    // Parse XML response
    const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true })
    const result = await parser.parseStringPromise(response.data)

    // Extract items from RSS feed
    const items = JackettController.parseSearchResults(result, integration.name)
    
    Logger.info(`[JackettController] Integration "${integration.name}" returned ${items.length} results`)

    return {
      integration: integration.name,
      results: items
    }
  }

  /**
   * Parse Torznab XML search results
   * 
   * @param {Object} xmlResult 
   * @param {string} integrationName 
   * @returns {Array}
   */
  static parseSearchResults(xmlResult, integrationName) {
    try {
      // Navigate the RSS structure
      const channel = xmlResult?.rss?.channel
      if (!channel) {
        Logger.warn(`[JackettController] No RSS channel found in response from ${integrationName}`)
        return []
      }

      let items = channel.item || []
      if (!Array.isArray(items)) {
        items = items ? [items] : []
      }

      return items.map(item => {
        // Parse Torznab attributes
        const attributes = {}
        if (item['torznab:attr']) {
          const attrs = Array.isArray(item['torznab:attr']) ? item['torznab:attr'] : [item['torznab:attr']]
          attrs.forEach(attr => {
            if (attr.name && attr.value !== undefined) {
              attributes[attr.name] = attr.value
            }
          })
        }

        // Extract basic information
        const result = {
          title: item.title || 'Unknown',
          link: item.link || '',
          guid: item.guid || '',
          pubDate: item.pubDate || '',
          description: item.description || '',
          size: parseInt(attributes.size) || 0,
          seeders: parseInt(attributes.seeders) || 0,
          peers: parseInt(attributes.peers) || 0,
          category: attributes.category || '',
          downloadUrl: item.enclosure?.url || item.link || '',
          magnetUrl: attributes.magneturl || '',
          infoHash: attributes.infohash || '',
          integration: integrationName,
          attributes: attributes
        }

        // Add book-specific attributes if available
        if (attributes.booktitle) result.bookTitle = attributes.booktitle
        if (attributes.author) result.author = attributes.author
        if (attributes.publishdate) result.publishDate = attributes.publishdate
        if (attributes.pages) result.pages = parseInt(attributes.pages) || 0

        return result
      })
    } catch (error) {
      Logger.error(`[JackettController] Error parsing search results from ${integrationName}:`, error.message)
      return []
    }
  }

  /**
   * GET: /api/jackett/categories
   * Get book-related Jackett categories
   *
   * @param {JackettControllerRequest} req
   * @param {Response} res
   */
  static async getCategories(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[JackettController] Non-admin user "${req.user.username}" attempted to get categories`)
      return res.sendStatus(403)
    }

    const bookCategories = [
      { id: '7000', name: 'Books - eBook' },
      { id: '7010', name: 'Books - Comics' },
      { id: '7020', name: 'Books - Magazines' },
      { id: '7030', name: 'Books - Technical' },
      { id: '7040', name: 'Books - Romance' },
      { id: '7050', name: 'Books - Mystery' },
      { id: '7060', name: 'Books - Fantasy' },
      { id: '7070', name: 'Books - Science Fiction' },
      { id: '7080', name: 'Books - Biography' },
      { id: '7090', name: 'Books - History' },
      { id: '8000', name: 'Audio - Audiobook' },
      { id: '8010', name: 'Audio - Other' }
    ]

    res.json({ categories: bookCategories })
  }
}

module.exports = JackettController 