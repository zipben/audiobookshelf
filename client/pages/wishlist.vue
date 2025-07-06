<template>
  <div id="page-wrapper" class="page p-6 overflow-y-auto relative" :class="streamLibraryItem ? 'streaming' : ''">
    <div class="w-full max-w-4xl mx-auto">
      <h1 class="text-2xl">{{ $strings.HeaderWishList || 'Wish List' }}</h1>

      <div class="my-4">
        <!-- Google Books Search Bar -->
        <div class="relative mb-6">
          <div class="relative">
            <input v-model="searchQuery" @input="onSearchInput" type="text" placeholder="Search Google Books to add to your wishlist..." class="w-full px-4 py-3 pr-12 bg-bg border border-gray-500 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400" />
            <span class="absolute right-3 top-1/2 transform -translate-y-1/2 material-symbols text-gray-400">search</span>
          </div>

          <!-- Search Results Dropdown -->
          <div v-if="searchResults.length > 0" class="absolute z-50 w-full mt-1 bg-bg border border-gray-500 rounded-lg shadow-lg max-h-96 overflow-y-auto">
            <div v-for="book in searchResults" :key="book.id" class="p-3 hover:bg-primary/20 border-b border-gray-600 last:border-b-0 flex items-center space-x-3">
              <img :src="book.thumbnail" :alt="book.title" class="w-12 h-16 object-cover rounded flex-shrink-0" @error="handleImageError" />
              <div class="flex-1 min-w-0">
                <h3 class="font-semibold text-white truncate">{{ book.title }}</h3>
                <p class="text-sm text-gray-300 truncate">{{ book.authors }}</p>
                <p v-if="book.publishedDate" class="text-xs text-gray-400">{{ book.publishedDate }}</p>
              </div>
              <div class="flex items-center space-x-2 flex-shrink-0">
                <button @click="addBookFromSearch(book, 'audiobook')" class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-md transition-colors flex items-center space-x-1">
                  <span class="material-symbols text-sm">headphones</span>
                  <span>Audiobook</span>
                </button>
                <button @click="addBookFromSearch(book, 'ebook')" class="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded-md transition-colors flex items-center space-x-1">
                  <span class="material-symbols text-sm">book</span>
                  <span>Ebook</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Loading indicator -->
          <div v-if="searchLoading" class="absolute z-50 w-full mt-1 bg-bg border border-gray-500 rounded-lg shadow-lg p-4 text-center">
            <span class="material-symbols animate-spin text-gray-400">hourglass_empty</span>
            <p class="text-gray-400 mt-2">Searching Google Books...</p>
          </div>
        </div>

        <div v-if="wishlistItems.length" class="bg-primary/20 rounded-lg overflow-hidden">
          <table class="w-full">
            <thead class="bg-primary/40">
              <tr class="border-b border-gray-600">
                <th class="text-left px-4 py-3 text-sm font-semibold text-gray-200">Cover</th>
                <th class="text-left px-4 py-3 text-sm font-semibold text-gray-200">Title</th>
                <th class="text-left px-4 py-3 text-sm font-semibold text-gray-200">Author</th>
                <th class="text-left px-4 py-3 text-sm font-semibold text-gray-200">Year</th>
                <th class="text-left px-4 py-3 text-sm font-semibold text-gray-200">Format</th>
                <th class="text-left px-4 py-3 text-sm font-semibold text-gray-200">Notes</th>
                <th class="text-center px-4 py-3 text-sm font-semibold text-gray-200">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in wishlistItems" :key="item.id" class="border-b border-gray-600/50 hover:bg-primary/10 transition-colors">
                <td class="px-4 py-3">
                  <img v-if="item.thumbnail" :src="item.thumbnail" :alt="item.title" class="w-10 h-12 object-cover rounded shadow-sm" @error="handleImageError" />
                  <div v-else class="w-10 h-12 bg-gray-600 rounded flex items-center justify-center">
                    <span class="material-symbols text-gray-400 text-lg">book</span>
                  </div>
                </td>
                <td class="px-4 py-3">
                  <h3 class="font-medium text-white text-sm leading-tight">{{ item.title }}</h3>
                </td>
                <td class="px-4 py-3">
                  <p class="text-sm text-gray-300">{{ item.author || 'Unknown Author' }}</p>
                </td>
                <td class="px-4 py-3">
                  <p class="text-sm text-gray-400">{{ item.publishedDate ? item.publishedDate.split('-')[0] : '-' }}</p>
                </td>
                <td class="px-4 py-3">
                  <div class="flex items-center space-x-1">
                    <span v-if="item.formats && item.formats.includes('audiobook')" class="inline-flex items-center px-2 py-1 bg-blue-600/20 text-blue-300 text-xs rounded-md">
                      <span class="material-symbols text-xs mr-1">headphones</span>
                      Audio
                    </span>
                    <span v-if="item.formats && item.formats.includes('ebook')" class="inline-flex items-center px-2 py-1 bg-green-600/20 text-green-300 text-xs rounded-md">
                      <span class="material-symbols text-xs mr-1">book</span>
                      Ebook
                    </span>
                    <span v-if="!item.formats || item.formats.length === 0" class="text-sm text-gray-400"> - </span>
                  </div>
                </td>
                <td class="px-4 py-3">
                  <p class="text-sm text-gray-400 truncate max-w-xs">{{ item.notes || '-' }}</p>
                </td>
                <td class="px-4 py-3">
                  <div class="flex items-center justify-center space-x-2">
                    <button @click="searchAnnaArchive(item)" class="text-blue-400 hover:text-blue-300 transition-colors p-1" title="Search on Anna's Archive">
                      <span class="material-symbols text-lg">search</span>
                    </button>
                    <button @click="searchJackett(item)" class="text-green-400 hover:text-green-300 transition-colors p-1" title="Search Jackett for downloads">
                      <span class="material-symbols text-lg">link</span>
                    </button>
                    <button v-if="canUserDeleteItem(item)" @click="deleteItemClick(item)" class="text-red-400 hover:text-red-300 transition-colors p-1" title="Delete from wishlist">
                      <span class="material-symbols text-lg">delete</span>
                    </button>
                    <span v-if="!canUserDeleteItem(item)" class="text-xs text-gray-500"> - </span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else class="text-center py-8">
          <span class="material-symbols text-6xl text-gray-400 mb-4">bookmark_border</span>
          <p class="text-lg text-gray-300">{{ $strings.MessageNoWishListItems || 'Your wish list is empty. Add some books or audiobooks you want to read!' }}</p>
        </div>
      </div>
    </div>

    <!-- Jackett Search Modal -->
    <modals-modal v-model="showJackettModal" name="jackett-search" :width="1200" :height="'unset'">
      <template #outer>
        <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
          <p class="text-3xl text-white truncate">Torrent Search</p>
        </div>
      </template>
      <div class="px-4 w-full text-sm py-6 rounded-lg bg-bg shadow-lg border border-black-300 relative overflow-hidden">
        <!-- Search Input -->
        <div class="mb-4">
          <div class="flex items-center space-x-2">
            <div class="flex-1">
              <ui-text-input v-model="jackettSearchQuery" placeholder="Enter search query..." :disabled="jackettSearching" />
            </div>
            <ui-btn @click="performJackettSearch" :loading="jackettSearching" :disabled="!jackettSearchQuery.trim()" color="primary"> Search </ui-btn>
          </div>
        </div>

        <div v-if="jackettSearching" class="text-center py-8">
          <span class="material-symbols animate-spin text-gray-400 text-4xl">hourglass_empty</span>
          <p class="text-gray-400 mt-4">Searching Jackett integrations for "{{ jackettSearchQuery }}"...</p>
        </div>

        <div v-else-if="jackettResults.length === 0 && !jackettSearchError && hasPerformedSearch" class="text-center py-8">
          <span class="material-symbols text-gray-400 text-4xl">search_off</span>
          <p class="text-gray-400 mt-4">No results found for "{{ jackettSearchQuery }}"</p>
          <p class="text-gray-500 text-xs mt-2">Try checking your Jackett integrations or search for a different term</p>
        </div>

        <div v-else-if="jackettSearchError" class="text-center py-8">
          <span class="material-symbols text-red-400 text-4xl">error</span>
          <p class="text-red-400 mt-4">Search Error</p>
          <p class="text-gray-400 text-sm mt-2">{{ jackettSearchError }}</p>
        </div>

        <div v-else-if="!jackettSearching && !hasPerformedSearch" class="text-center py-8">
          <span class="material-symbols text-gray-400 text-4xl">search</span>
          <p class="text-gray-400 mt-4">Enter a search query above to find torrents</p>
        </div>

        <div v-else class="overflow-y-auto max-h-96">
          <div class="mb-4">
            <p class="text-gray-300">
              Found {{ jackettResults.length }} results for "<strong>{{ jackettSearchQuery }}</strong
              >"
            </p>
            <p class="text-gray-400 text-xs mt-1">Showing {{ showingFrom }} to {{ showingTo }} of {{ jackettResults.length }} results</p>
          </div>

          <!-- Results Table -->
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead>
                <tr class="border-b border-white/10">
                  <th class="text-left py-2 px-2 cursor-pointer hover:bg-white/5" @click="sortBy('title')">
                    <div class="flex items-center">
                      <span class="text-xs font-medium text-gray-300">Title</span>
                      <span class="material-symbols text-xs ml-1" :class="getSortIcon('title')">{{ getSortIcon('title') }}</span>
                    </div>
                  </th>
                  <th class="text-left py-2 px-2 cursor-pointer hover:bg-white/5" @click="sortBy('integration')">
                    <div class="flex items-center">
                      <span class="text-xs font-medium text-gray-300">Source</span>
                      <span class="material-symbols text-xs ml-1" :class="getSortIcon('integration')">{{ getSortIcon('integration') }}</span>
                    </div>
                  </th>
                  <th class="text-left py-2 px-2 cursor-pointer hover:bg-white/5" @click="sortBy('size')">
                    <div class="flex items-center">
                      <span class="text-xs font-medium text-gray-300">Size</span>
                      <span class="material-symbols text-xs ml-1" :class="getSortIcon('size')">{{ getSortIcon('size') }}</span>
                    </div>
                  </th>
                  <th class="text-left py-2 px-2 cursor-pointer hover:bg-white/5" @click="sortBy('seeders')">
                    <div class="flex items-center">
                      <span class="text-xs font-medium text-gray-300">Seeders</span>
                      <span class="material-symbols text-xs ml-1" :class="getSortIcon('seeders')">{{ getSortIcon('seeders') }}</span>
                    </div>
                  </th>
                  <th class="text-left py-2 px-2 cursor-pointer hover:bg-white/5" @click="sortBy('peers')">
                    <div class="flex items-center">
                      <span class="text-xs font-medium text-gray-300">Peers</span>
                      <span class="material-symbols text-xs ml-1" :class="getSortIcon('peers')">{{ getSortIcon('peers') }}</span>
                    </div>
                  </th>
                  <th class="text-left py-2 px-2 cursor-pointer hover:bg-white/5" @click="sortBy('pubDate')">
                    <div class="flex items-center">
                      <span class="text-xs font-medium text-gray-300">Date</span>
                      <span class="material-symbols text-xs ml-1" :class="getSortIcon('pubDate')">{{ getSortIcon('pubDate') }}</span>
                    </div>
                  </th>
                  <th class="text-left py-2 px-2">
                    <span class="text-xs font-medium text-gray-300">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="result in paginatedResults" :key="result.guid" class="border-b border-white/5 hover:bg-white/5">
                  <td class="py-2 px-2">
                    <div class="max-w-sm">
                      <p class="text-white text-xs font-medium truncate" :title="result.title">{{ result.title }}</p>
                      <p v-if="result.description" class="text-gray-500 text-xs truncate mt-1" :title="result.description">{{ result.description }}</p>
                    </div>
                  </td>
                  <td class="py-2 px-2">
                    <span class="text-gray-300 text-xs">{{ result.integration }}</span>
                  </td>
                  <td class="py-2 px-2">
                    <span class="text-gray-300 text-xs">{{ result.size && result.size > 0 ? formatFileSize(result.size) : '-' }}</span>
                  </td>
                  <td class="py-2 px-2">
                    <span class="text-green-400 text-xs">{{ result.seeders > 0 ? result.seeders : '-' }}</span>
                  </td>
                  <td class="py-2 px-2">
                    <span class="text-blue-400 text-xs">{{ result.peers > 0 ? result.peers : '-' }}</span>
                  </td>
                  <td class="py-2 px-2">
                    <span class="text-gray-300 text-xs">{{ result.pubDate ? formatDate(result.pubDate) : '-' }}</span>
                  </td>
                  <td class="py-2 px-2">
                    <div class="flex items-center space-x-1">
                      <button v-if="result.magnetUrl" @click="downloadMagnet(result.magnetUrl)" class="text-green-400 hover:text-green-300 transition-colors p-1" title="Download magnet link">
                        <span class="material-symbols text-sm">link</span>
                      </button>
                      <button v-if="result.downloadUrl" @click="downloadTorrent(result.downloadUrl)" class="text-blue-400 hover:text-blue-300 transition-colors p-1" title="Download torrent file">
                        <span class="material-symbols text-sm">link</span>
                      </button>
                      <span v-if="!result.magnetUrl && !result.downloadUrl" class="text-gray-500 text-xs">N/A</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="flex items-center justify-between mt-4 pt-4 border-t border-white/10">
          <div class="flex items-center space-x-2">
            <span class="text-xs text-gray-400">Show:</span>
            <div class="w-16">
              <ui-dropdown v-model="itemsPerPage" :items="itemsPerPageOptions" @input="currentPage = 1" small />
            </div>
          </div>

          <div v-if="totalPages > 1" class="flex items-center space-x-2">
            <div class="flex items-center space-x-1">
              <button @click="currentPage = 1" :disabled="currentPage === 1" :class="currentPage === 1 ? 'text-gray-500 cursor-not-allowed' : 'text-gray-300 hover:text-white cursor-pointer'" class="p-1 text-xs transition-colors">
                <span class="material-symbols text-sm">keyboard_double_arrow_left</span>
              </button>
              <button @click="currentPage = currentPage - 1" :disabled="currentPage === 1" :class="currentPage === 1 ? 'text-gray-500 cursor-not-allowed' : 'text-gray-300 hover:text-white cursor-pointer'" class="p-1 text-xs transition-colors">
                <span class="material-symbols text-sm">keyboard_arrow_left</span>
              </button>
            </div>

            <div class="flex items-center">
              <span class="text-xs text-gray-400">Page {{ currentPage }} of {{ totalPages }}</span>
            </div>

            <div class="flex items-center space-x-1">
              <button @click="currentPage = currentPage + 1" :disabled="currentPage === totalPages" :class="currentPage === totalPages ? 'text-gray-500 cursor-not-allowed' : 'text-gray-300 hover:text-white cursor-pointer'" class="p-1 text-xs transition-colors">
                <span class="material-symbols text-sm">keyboard_arrow_right</span>
              </button>
              <button @click="currentPage = totalPages" :disabled="currentPage === totalPages" :class="currentPage === totalPages ? 'text-gray-500 cursor-not-allowed' : 'text-gray-300 hover:text-white cursor-pointer'" class="p-1 text-xs transition-colors">
                <span class="material-symbols text-sm">keyboard_double_arrow_right</span>
              </button>
            </div>
          </div>

          <ui-btn @click="closeJackettModal">Close</ui-btn>
        </div>
      </div>
    </modals-modal>
  </div>
</template>

<script>
export default {
  data() {
    return {
      loading: false,
      wishlistItems: [],
      searchQuery: '',
      searchResults: [],
      searchLoading: false,
      searchTimeout: null,
      showJackettModal: false,
      jackettSearching: false,
      jackettResults: [],
      jackettSearchError: null,
      selectedBook: null,
      jackettSearchQuery: '',
      hasPerformedSearch: false,
      sortColumn: '',
      sortDirection: 'desc',
      currentPage: 1,
      itemsPerPage: 10,
      itemsPerPageOptions: [
        { text: '10', value: 10 },
        { text: '25', value: 25 },
        { text: '50', value: 50 },
        { text: '100', value: 100 }
      ]
    }
  },
  computed: {
    streamLibraryItem() {
      return this.$store.state.streamLibraryItem
    },
    user() {
      return this.$store.state.user.user || null
    },
    currentUserId() {
      return this.user?.id || null
    },
    userIsAdminOrUp() {
      return this.$store.getters['user/getIsAdminOrUp']
    },
    sortedResults() {
      if (!this.jackettResults || !this.jackettResults.length) return []

      let results = [...this.jackettResults]

      if (this.sortColumn) {
        results.sort((a, b) => {
          let aVal = a[this.sortColumn]
          let bVal = b[this.sortColumn]

          // Handle special cases
          if (this.sortColumn === 'size' || this.sortColumn === 'seeders' || this.sortColumn === 'peers') {
            aVal = parseInt(aVal) || 0
            bVal = parseInt(bVal) || 0
          } else if (this.sortColumn === 'pubDate') {
            aVal = new Date(aVal || 0).getTime()
            bVal = new Date(bVal || 0).getTime()
          } else if (typeof aVal === 'string' && typeof bVal === 'string') {
            aVal = aVal.toLowerCase()
            bVal = bVal.toLowerCase()
          }

          if (this.sortDirection === 'desc') {
            return bVal > aVal ? 1 : bVal < aVal ? -1 : 0
          } else {
            return aVal > bVal ? 1 : aVal < bVal ? -1 : 0
          }
        })
      }

      return results
    },
    paginatedResults() {
      const start = (this.currentPage - 1) * this.itemsPerPage
      const end = start + this.itemsPerPage
      return this.sortedResults.slice(start, end)
    },
    totalPages() {
      return Math.ceil(this.sortedResults.length / this.itemsPerPage)
    },
    showingFrom() {
      return this.sortedResults.length === 0 ? 0 : (this.currentPage - 1) * this.itemsPerPage + 1
    },
    showingTo() {
      return Math.min(this.currentPage * this.itemsPerPage, this.sortedResults.length)
    }
  },
  methods: {
    canUserDeleteItem(item) {
      // User can delete if they are admin or if they created the item
      return this.userIsAdminOrUp || (item.userId && item.userId === this.currentUserId)
    },
    deleteItemClick(item) {
      // Check permissions before showing confirmation
      if (!this.canUserDeleteItem(item)) {
        this.$toast.warning('You do not have permission to delete this item.')
        return
      }

      const payload = {
        message: this.$strings.MessageConfirmDeleteWishListItem || `Are you sure you want to remove "${item.title}" from your wish list?`,
        callback: (confirmed) => {
          if (confirmed) {
            this.deleteItem(item)
          }
        },
        type: 'yesNo'
      }
      this.$store.commit('globals/setConfirmPrompt', payload)
    },

    deleteItem(item) {
      const index = this.wishlistItems.findIndex((i) => i.id === item.id)
      if (index !== -1) {
        this.wishlistItems.splice(index, 1)
        this.saveWishlistToStorage()
      }
    },
    saveWishlistToStorage() {
      // For now, save to localStorage. In production, this would be saved to the server
      localStorage.setItem('audiobookshelf_wishlist', JSON.stringify(this.wishlistItems))
    },
    loadWishlistFromStorage() {
      try {
        const saved = localStorage.getItem('audiobookshelf_wishlist')
        if (saved) {
          this.wishlistItems = JSON.parse(saved)
          // Migrate legacy items without userId - assign to current user or leave blank if no user
          this.wishlistItems.forEach((item) => {
            if (!item.userId && this.currentUserId) {
              item.userId = this.currentUserId
            }
          })
          // Save the migrated data
          if (this.wishlistItems.some((item) => !item.hasOwnProperty('userId'))) {
            this.saveWishlistToStorage()
          }
        }
      } catch (error) {
        console.error('Error loading wishlist from storage:', error)
      }
    },
    onSearchInput() {
      // Clear previous timeout
      if (this.searchTimeout) {
        clearTimeout(this.searchTimeout)
      }

      // Clear results if search is empty
      if (!this.searchQuery.trim()) {
        this.searchResults = []
        return
      }

      // Debounce search to avoid too many API calls
      this.searchTimeout = setTimeout(() => {
        this.searchGoogleBooks()
      }, 500)
    },
    async searchGoogleBooks() {
      if (!this.searchQuery.trim()) return

      this.searchLoading = true
      this.searchResults = []

      try {
        // Using Google Books API
        const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(this.searchQuery)}&maxResults=8`)
        const data = await response.json()

        if (data.items) {
          this.searchResults = data.items.map((item) => ({
            id: item.id,
            title: item.volumeInfo.title || 'Unknown Title',
            authors: item.volumeInfo.authors ? item.volumeInfo.authors.join(', ') : 'Unknown Author',
            publishedDate: item.volumeInfo.publishedDate || null,
            thumbnail: item.volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:') || item.volumeInfo.imageLinks?.smallThumbnail?.replace('http:', 'https:') || '/default-book-cover.jpg',
            description: item.volumeInfo.description || '',
            isbn: item.volumeInfo.industryIdentifiers?.[0]?.identifier || null,
            pageCount: item.volumeInfo.pageCount || null,
            categories: item.volumeInfo.categories || []
          }))
        }
      } catch (error) {
        console.error('Error searching Google Books:', error)
        this.$toast.error('Error searching Google Books. Please try again.')
      } finally {
        this.searchLoading = false
      }
    },
    addBookFromSearch(book, format) {
      // Check if book already exists in wishlist
      const existingBook = this.wishlistItems.find((item) => item.title === book.title && item.author === book.authors)

      if (existingBook) {
        // Check if this format is already requested
        if (existingBook.formats && existingBook.formats.includes(format)) {
          this.$toast.warning(`This book is already in your wishlist as ${format}!`)
          return
        }

        // Add the new format to existing book
        if (!existingBook.formats) {
          existingBook.formats = []
        }
        existingBook.formats.push(format)
        this.saveWishlistToStorage()

        this.$toast.success(`"${book.title}" updated with ${format} format!`)
      } else {
        // Add new book to wishlist
        const newItem = {
          id: Date.now().toString(),
          title: book.title,
          author: book.authors,
          notes: '',
          thumbnail: book.thumbnail,
          publishedDate: book.publishedDate,
          description: book.description,
          isbn: book.isbn,
          pageCount: book.pageCount,
          categories: book.categories,
          formats: [format],
          userId: this.currentUserId,
          addedAt: new Date().toISOString()
        }

        this.wishlistItems.unshift(newItem)
        this.saveWishlistToStorage()

        this.$toast.success(`"${book.title}" added to your wishlist as ${format}!`)
      }

      // Clear search
      this.searchQuery = ''
      this.searchResults = []
    },
    handleImageError(event) {
      // Set a default image if book cover fails to load
      event.target.src = '/default-book-cover.jpg'
    },
    searchAnnaArchive(item) {
      // Construct the search query with title and author
      const query = `${item.title} ${item.author || ''}`.trim()
      const encodedQuery = encodeURIComponent(query)
      const annaArchiveUrl = `https://annas-archive.org/search?q=${encodedQuery}`

      // Open Anna's Archive in a new tab
      window.open(annaArchiveUrl, '_blank', 'noopener,noreferrer')
    },
    async searchJackett(item) {
      // Check if user has admin permissions
      if (!this.userIsAdminOrUp) {
        this.$toast.error('Only administrators can access Jackett search')
        return
      }

      this.selectedBook = item
      this.showJackettModal = true
      this.jackettSearchQuery = `${item.title} ${item.author || ''}`.trim()
      this.hasPerformedSearch = false
      this.jackettResults = []
      this.jackettSearchError = null
      this.sortColumn = ''
      this.sortDirection = 'desc'
      this.currentPage = 1

      // Auto-trigger search
      this.$nextTick(() => {
        this.performJackettSearch()
      })
    },
    async performJackettSearch() {
      if (!this.jackettSearchQuery.trim()) return

      this.jackettSearching = true
      this.jackettResults = []
      this.jackettSearchError = null
      this.currentPage = 1 // Reset pagination

      try {
        const response = await this.$axios.$post('/api/jackett/search', {
          query: this.jackettSearchQuery.trim()
        })

        this.jackettResults = response.results || []
        this.hasPerformedSearch = true

        if (response.errors && response.errors.length > 0) {
          console.warn('Some Jackett integrations failed:', response.errors)
        }
      } catch (error) {
        console.error('Jackett search failed:', error)
        this.jackettSearchError = error.response?.data?.error || error.message || 'Search failed'
        this.hasPerformedSearch = true
      } finally {
        this.jackettSearching = false
      }
    },
    sortBy(column) {
      if (this.sortColumn === column) {
        this.sortDirection = this.sortDirection === 'desc' ? 'asc' : 'desc'
      } else {
        this.sortColumn = column
        this.sortDirection = 'desc'
      }
      this.currentPage = 1 // Reset to first page when sorting
    },
    getSortIcon(column) {
      if (this.sortColumn !== column) return 'unfold_more'
      return this.sortDirection === 'desc' ? 'keyboard_arrow_down' : 'keyboard_arrow_up'
    },
    formatDate(dateString) {
      if (!dateString) return ''
      try {
        const date = new Date(dateString)
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        })
      } catch {
        return ''
      }
    },
    closeJackettModal() {
      this.showJackettModal = false
      this.selectedBook = null
      this.jackettResults = []
      this.jackettSearchError = null
      this.jackettSearchQuery = ''
      this.hasPerformedSearch = false
      this.sortColumn = ''
      this.sortDirection = 'desc'
      this.currentPage = 1
      this.itemsPerPage = 10
    },
    downloadMagnet(magnetUrl) {
      if (!magnetUrl) {
        this.$toast.error('No magnet link available')
        return
      }

      // Create a temporary anchor element to trigger the magnet link
      const link = document.createElement('a')
      link.href = magnetUrl
      link.rel = 'noopener noreferrer'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      this.$toast.success('Magnet link opened')
    },
    downloadTorrent(downloadUrl) {
      if (!downloadUrl) {
        this.$toast.error('No download URL available')
        return
      }

      // Open download URL in new tab
      const link = document.createElement('a')
      link.href = downloadUrl
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      this.$toast.success('Download started')
    },
    formatFileSize(bytes) {
      if (bytes === 0) return '0 Bytes'
      const k = 1024
      const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    },
    handleClickOutside(event) {
      // Close search results when clicking outside the search area
      const searchContainer = event.target.closest('.relative')
      if (!searchContainer || !searchContainer.querySelector('input[v-model="searchQuery"]')) {
        this.searchResults = []
      }
    }
  },
  mounted() {
    this.loadWishlistFromStorage()
    // Add click outside handler to close search results
    document.addEventListener('click', this.handleClickOutside)
  },
  beforeDestroy() {
    // Remove click outside handler
    document.removeEventListener('click', this.handleClickOutside)
  }
}
</script> 