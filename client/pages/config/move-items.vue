<template>
  <div>
    <app-settings-content :header-text="$strings.HeaderMoveItems" :description="$strings.MessageMoveItemsDescription">
      <div class="flex flex-wrap items-end -mx-1 mb-4">
        <div class="w-full md:w-1/3 px-1 mb-2 md:mb-0">
          <ui-dropdown :label="$strings.LabelSourceLibrary" v-model="sourceLibraryId" :items="sourceLibraryItems" :disabled="moving" small @input="sourceLibraryChanged" />
        </div>
        <div class="w-full md:w-1/3 px-1 mb-2 md:mb-0">
          <ui-dropdown :label="$strings.LabelTargetLibrary" v-model="targetLibraryId" :items="targetLibraryItems" :disabled="moving || !sourceLibraryId" small @input="targetLibraryChanged" />
        </div>
        <div v-if="targetFolderItems.length > 1" class="w-full md:w-1/3 px-1">
          <ui-dropdown :label="$strings.LabelTargetFolder" v-model="targetFolderId" :items="targetFolderItems" :disabled="moving" small />
        </div>
      </div>

      <div class="flex items-center justify-between border-b border-white/10 pb-2 mb-1">
        <div class="flex items-center">
          <ui-checkbox v-model="selectAll" :disabled="!items.length || moving" small :label="$strings.LabelSelectAll" checkbox-bg="primary" />
          <p class="text-sm text-gray-300 pl-4">{{ $getString('MessageItemsSelected', [selectedIds.length]) }}</p>
        </div>
        <ui-btn :disabled="!canMove" :loading="moving" small color="bg-success" @click="moveSelected">{{ $strings.ButtonMoveToLibrary }}</ui-btn>
      </div>

      <div class="relative" style="min-height: 160px">
        <div v-if="!sourceLibraryId" class="text-center py-8">
          <p class="text-base text-gray-300">{{ $strings.MessageSelectSourceLibrary }}</p>
        </div>
        <div v-else-if="!loadingItems && !items.length" class="text-center py-8">
          <p class="text-base text-gray-300">{{ $strings.MessageNoItemsFound }}</p>
        </div>

        <ul v-else class="divide-y divide-white/5">
          <li v-for="item in items" :key="item.id" class="flex items-center py-1.5 px-1 hover:bg-white/5 rounded-sm">
            <ui-checkbox v-model="selected[item.id]" :disabled="moving" small checkbox-bg="primary" @input="itemToggled" />
            <div class="pl-3 grow min-w-0">
              <p class="text-sm text-gray-100 truncate">{{ item.media.metadata.title || item.relPath }}</p>
              <p class="text-xs text-gray-400 truncate">{{ item.media.metadata.authorName || '' }}<span v-if="item.media.metadata.authorName" class="px-1">&bull;</span>{{ item.relPath }}</p>
            </div>
          </li>
        </ul>

        <div v-if="loadingItems" class="absolute top-0 left-0 w-full h-full bg-black/25 flex items-center justify-center">
          <ui-loading-indicator />
        </div>
      </div>
    </app-settings-content>
  </div>
</template>

<script>
export default {
  asyncData({ store, redirect }) {
    if (!store.getters['user/getIsAdminOrUp']) {
      redirect('/')
    }
  },
  data() {
    return {
      sourceLibraryId: null,
      targetLibraryId: null,
      targetFolderId: null,
      items: [],
      selected: {},
      loadingItems: false,
      moving: false
    }
  },
  computed: {
    bookLibraries() {
      return this.$store.state.libraries.libraries.filter((lib) => lib.mediaType === 'book')
    },
    sourceLibraryItems() {
      return this.bookLibraries.map((lib) => ({ text: lib.name, value: lib.id }))
    },
    targetLibraryItems() {
      return this.bookLibraries.filter((lib) => lib.id !== this.sourceLibraryId).map((lib) => ({ text: lib.name, value: lib.id }))
    },
    targetLibrary() {
      return this.bookLibraries.find((lib) => lib.id === this.targetLibraryId)
    },
    targetFolderItems() {
      if (!this.targetLibrary) return []
      return (this.targetLibrary.folders || []).map((f) => ({ text: f.fullPath, value: f.id }))
    },
    selectedIds() {
      return this.items.filter((item) => this.selected[item.id]).map((item) => item.id)
    },
    selectAll: {
      get() {
        return this.items.length > 0 && this.selectedIds.length === this.items.length
      },
      set(val) {
        const newSelected = {}
        if (val) {
          this.items.forEach((item) => {
            newSelected[item.id] = true
          })
        }
        this.selected = newSelected
      }
    },
    canMove() {
      return !this.moving && !!this.targetLibraryId && this.selectedIds.length > 0
    }
  },
  methods: {
    // Force reactivity recompute helpers (checkbox v-model on object keys)
    itemToggled() {
      this.selected = { ...this.selected }
    },
    sourceLibraryChanged() {
      if (this.targetLibraryId === this.sourceLibraryId) {
        this.targetLibraryId = null
        this.targetFolderId = null
      }
      this.loadItems()
    },
    targetLibraryChanged() {
      // Default to the first folder of the newly selected target library
      this.targetFolderId = this.targetFolderItems.length ? this.targetFolderItems[0].value : null
    },
    async loadItems() {
      this.items = []
      this.selected = {}
      if (!this.sourceLibraryId) return
      this.loadingItems = true
      try {
        const data = await this.$axios.$get(`/api/libraries/${this.sourceLibraryId}/items?minified=1&limit=0&sort=media.metadata.title`)
        this.items = data.results || []
      } catch (error) {
        console.error('Failed to load library items', error)
        this.$toast.error(this.$strings.ToastFailedToLoadData)
      } finally {
        this.loadingItems = false
      }
    },
    async moveSelected() {
      if (!this.canMove) return
      const libraryItemIds = this.selectedIds
      const payload = {
        libraryItemIds,
        libraryId: this.targetLibraryId
      }
      if (this.targetFolderId) payload.libraryFolderId = this.targetFolderId

      this.moving = true
      try {
        const data = await this.$axios.$post('/api/items/batch/move', payload)
        const movedCount = data.movedCount || 0
        const failed = (data.results || []).filter((r) => !r.success)
        if (movedCount) {
          this.$toast.success(this.$getString('ToastItemsMovedSuccess', [movedCount]))
        }
        if (failed.length) {
          const firstError = failed[0].error || this.$strings.ToastFailedToUpdate
          this.$toast.error(this.$getString('ToastItemsMoveFailed', [failed.length, firstError]))
        }
        await this.loadItems()
      } catch (error) {
        console.error('Failed to move items', error)
        const errorMsg = error.response?.data
        this.$toast.error(typeof errorMsg === 'string' && errorMsg ? errorMsg : this.$strings.ToastFailedToUpdate)
      } finally {
        this.moving = false
      }
    }
  },
  mounted() {}
}
</script>
