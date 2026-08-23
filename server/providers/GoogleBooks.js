const axios = require('axios')
const Logger = require('../Logger')
const Database = require('../Database')

class GoogleBooks {
  #responseTimeout = 10000

  constructor() {}

  extractIsbn(industryIdentifiers) {
    if (!industryIdentifiers || !industryIdentifiers.length) return null

    var isbnObj = industryIdentifiers.find((i) => i.type === 'ISBN_13') || industryIdentifiers.find((i) => i.type === 'ISBN_10')
    if (isbnObj && isbnObj.identifier) return isbnObj.identifier
    return null
  }

  cleanResult(item) {
    var { id, volumeInfo } = item
    if (!volumeInfo) return null
    const { title, subtitle, authors, publisher, publisherDate, description, industryIdentifiers, categories, imageLinks } = volumeInfo

    let cover = null
    // Selects the largest cover assuming the largest is the last key in the object
    if (imageLinks && Object.keys(imageLinks).length) {
      cover = imageLinks[Object.keys(imageLinks).pop()]
      cover = cover?.replace(/^http:/, 'https:') || null
    }

    return {
      id,
      title,
      subtitle: subtitle || null,
      author: authors ? authors.join(', ') : null,
      publisher,
      publishedYear: publisherDate ? publisherDate.split('-')[0] : null,
      description,
      cover,
      genres: categories && Array.isArray(categories) ? [...categories] : null,
      isbn: this.extractIsbn(industryIdentifiers)
    }
  }

  /**
   * Configured Google Books API key, if any.
   * Requests without a key share a single global Google quota that is routinely
   * exhausted, returning HTTP 429 for everyone using it.
   * @returns {string}
   */
  getApiKey() {
    return Database.serverSettings?.googleBooksApiKey || process.env.GOOGLE_BOOKS_API_KEY || ''
  }

  /**
   * Search for a book by title and author
   * @param {string} title
   * @param {string} author
   * @param {number} [timeout] response timeout in ms
   * @returns {Promise<Object[]>}
   **/
  async search(title, author, timeout = this.#responseTimeout) {
    if (!timeout || isNaN(timeout)) timeout = this.#responseTimeout

    title = encodeURIComponent(title)
    let queryString = `q=intitle:${title}`
    if (author) {
      author = encodeURIComponent(author)
      queryString += `+inauthor:${author}`
    }
    const apiKey = this.getApiKey()
    if (apiKey) queryString += `&key=${encodeURIComponent(apiKey)}`
    const url = `https://www.googleapis.com/books/v1/volumes?${queryString}`
    // Do not log the api key
    Logger.debug(`[GoogleBooks] Search url: ${url.replace(/&key=[^&]*/, '&key=[redacted]')}`)
    const items = await axios
      .get(url, {
        timeout
      })
      .then((res) => {
        if (!res || !res.data || !res.data.items) return []
        return res.data.items
      })
      .catch((error) => {
        if (error.response?.status === 429) {
          Logger.error(`[GoogleBooks] Search rate limited (HTTP 429). ${apiKey ? 'The configured Google Books API key has exceeded its quota.' : 'No Google Books API key is configured, so requests use a shared global quota that is frequently exhausted. Set one in server settings or the GOOGLE_BOOKS_API_KEY environment variable.'}`)
        } else {
          Logger.error('[GoogleBooks] Volume search error', error.message)
        }
        return []
      })
    return items.map((item) => this.cleanResult(item))
  }
}

module.exports = GoogleBooks
