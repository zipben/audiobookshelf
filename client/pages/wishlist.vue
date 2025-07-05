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
                  <div class="flex items-center justify-center">
                    <ui-icon-btn v-if="canUserDeleteItem(item)" icon="delete" :size="7" @click="deleteItemClick(item)" />
                    <span v-else class="text-xs text-gray-500"> - </span>
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
      searchTimeout: null
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