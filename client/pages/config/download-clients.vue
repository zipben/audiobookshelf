<template>
  <div>
    <app-settings-content :header-text="'Download Clients'">
      <div class="mb-4">
        <p class="text-sm text-gray-400 mb-4">Configure download clients for automatic torrent downloading. Connect to torrent clients like qBittorrent, Transmission, or Deluge to automatically download torrents found through Jackett searches.</p>

        <ui-btn @click="showAddClientModal = true" color="success" class="mb-4">
          <span class="material-symbols mr-2">add</span>
          Add Download Client
        </ui-btn>
      </div>

      <!-- Clients List -->
      <div v-if="clients.length > 0" class="space-y-4">
        <div v-for="client in clients" :key="client.id" class="bg-bg border border-white/10 rounded-lg p-4">
          <div class="flex items-center justify-between">
            <div class="flex-1">
              <div class="flex items-center">
                <h3 class="text-lg font-semibold">{{ client.name }}</h3>
                <div class="ml-2 flex items-center">
                  <div v-if="client.enabled" class="w-3 h-3 bg-green-500 rounded-full" title="Enabled"></div>
                  <div v-else class="w-3 h-3 bg-red-500 rounded-full" title="Disabled"></div>
                </div>
              </div>
              <p class="text-sm text-gray-400">{{ client.type }} - {{ client.host }}:{{ client.port }}</p>
              <p v-if="client.downloadPath" class="text-xs text-gray-500 mt-1">Download path: {{ client.downloadPath }}</p>
            </div>
            <div class="flex items-center space-x-2">
              <ui-btn @click="testClient(client)" :loading="testingClient === client.id" size="xs" color="bg-blue-600"> Test </ui-btn>
              <ui-btn @click="editClient(client)" size="xs" color="bg-gray-600"> Edit </ui-btn>
              <ui-btn @click="deleteClient(client)" size="xs" color="bg-red-600"> Delete </ui-btn>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="text-center py-8">
        <p class="text-gray-400">No download clients configured</p>
        <p class="text-sm text-gray-500 mt-2">Add your first download client to enable automatic torrent downloading</p>
      </div>
    </app-settings-content>

    <!-- Add/Edit Client Modal -->
    <modals-modal v-model="showAddClientModal" name="add-download-client" :width="900" :height="700">
      <template #outer>
        <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
          <p class="text-3xl text-white truncate">{{ isEditMode ? 'Edit' : 'Add' }} Download Client</p>
        </div>
      </template>

      <!-- Main Form Content -->
      <div v-if="!showDirectoryPicker" class="px-4 w-full text-sm py-6 rounded-lg bg-bg shadow-lg border border-black-300 relative overflow-hidden">
        <form @submit.prevent="submitClient">
          <div class="mb-4">
            <ui-text-input v-model="clientForm.name" label="Client Name" placeholder="e.g., Main qBittorrent" :disabled="submittingClient" required />
          </div>

          <div class="mb-4">
            <ui-dropdown v-model="clientForm.type" label="Client Type" :items="clientTypes" :disabled="submittingClient" />
          </div>

          <div class="grid grid-cols-2 gap-4 mb-4">
            <ui-text-input v-model="clientForm.host" label="Host" placeholder="localhost" :disabled="submittingClient" required />
            <ui-text-input v-model="clientForm.port" label="Port" placeholder="8080" type="number" :disabled="submittingClient" required />
          </div>

          <div class="grid grid-cols-2 gap-4 mb-4">
            <ui-text-input v-model="clientForm.username" label="Username" placeholder="admin" :disabled="submittingClient" />
            <ui-text-input v-model="clientForm.password" label="Password" type="password" :disabled="submittingClient" />
          </div>

          <!-- Host Download Path -->
          <div class="flex items-center py-2">
            <div class="w-52">
              <span class="text-sm text-gray-400">Host Download Path</span>
              <p class="text-xs text-gray-500 mt-1">Path on the host system (for torrent client)</p>
            </div>
            <div class="flex-grow">
              <div class="flex">
                <ui-text-input v-model="clientForm.hostDownloadPath" placeholder="e.g., /Users/username/Downloads" class="w-full" />
                <ui-btn v-if="clientForm.hostDownloadPath" color="primary" small class="ml-2 h-9 w-18" type="button" @click="clearHostPath">Clear</ui-btn>
              </div>
            </div>
          </div>

          <!-- Download Path (Container) -->
          <div class="flex items-center py-2">
            <div class="w-52">
              <span class="text-sm text-gray-400">Container Download Path</span>
              <p class="text-xs text-gray-500 mt-1">Path inside the container (for folder browser)</p>
            </div>
            <div class="flex-grow">
              <div class="flex">
                <ui-text-input ref="downloadPathInput" v-model="clientForm.downloadPath" placeholder="e.g., /workspaces/audiobookshelf/downloads" class="w-full" />
                <ui-btn color="primary" small class="ml-2 h-9 w-18" type="button" @click="browseContainerPath">Browse</ui-btn>
                <ui-btn v-if="clientForm.downloadPath" color="primary" small class="ml-2 h-9 w-18" type="button" @click="clearContainerPath">Clear</ui-btn>
              </div>
            </div>
          </div>

          <div class="mb-4">
            <ui-text-input v-model="clientForm.category" label="Category" placeholder="audiobooks" :disabled="submittingClient" />
            <p class="text-xs text-gray-400 mt-1">Category to assign to downloaded torrents (optional)</p>
          </div>

          <div class="mb-6">
            <div class="mb-2">
              <label class="text-sm font-medium">Status</label>
            </div>
            <ui-toggle-switch v-model="clientForm.enabled" label="Enable Client" :disabled="submittingClient" />
            <p class="text-xs text-gray-400 mt-1">When enabled, this client can be used for automatic downloads. Disabled clients are saved but not used.</p>
          </div>

          <div class="flex justify-end space-x-2">
            <ui-btn type="button" @click="closeModal" :disabled="submittingClient">Cancel</ui-btn>
            <ui-btn type="submit" :loading="submittingClient" color="success"> {{ isEditMode ? 'Update' : 'Add' }} Client </ui-btn>
          </div>
        </form>
      </div>

      <!-- Folder Chooser -->
      <modals-libraries-lazy-folder-chooser v-else @back="showDirectoryPicker = false" @select="selectDownloadPath" />
    </modals-modal>
  </div>
</template>

<script>
export default {
  asyncData({ store, redirect }) {
    if (!store.getters['user/getIsAdminOrUp']) {
      redirect('/home')
    }
  },
  data() {
    return {
      clients: [],
      showAddClientModal: false,
      showDirectoryPicker: false,
      isEditMode: false,
      editingClient: null,
      submittingClient: false,
      testingClient: null,
      clientForm: {
        name: '',
        type: 'qbittorrent',
        host: 'localhost',
        port: 8080,
        username: '',
        password: '',
        downloadPath: '',
        hostDownloadPath: '',
        category: '',
        enabled: true
      },
      clientTypes: [
        { text: 'qBittorrent', value: 'qbittorrent' },
        { text: 'Transmission', value: 'transmission' },
        { text: 'Deluge', value: 'deluge' },
        { text: 'rTorrent/ruTorrent', value: 'rtorrent' }
      ]
    }
  },
  computed: {
    userIsAdminOrUp() {
      return this.$store.getters['user/getIsAdminOrUp']
    }
  },
  methods: {
    async loadClients() {
      try {
        const response = await this.$axios.$get('/api/download-clients')
        this.clients = response.clients || []
      } catch (error) {
        console.error('Failed to load download clients:', error)
        this.$toast.error('Failed to load download clients')
      }
    },
    editClient(client) {
      this.isEditMode = true
      this.editingClient = client
      this.clientForm = {
        name: client.name,
        type: client.type,
        host: client.host,
        port: client.port,
        username: client.username || '',
        password: '', // Don't populate password for security
        downloadPath: client.downloadPath || '',
        hostDownloadPath: client.hostDownloadPath || '',
        category: client.category || '',
        enabled: client.enabled
      }
      this.showAddClientModal = true
    },
    browseContainerPath() {
      this.showDirectoryPicker = true
    },
    selectDownloadPath(fullPath) {
      this.clientForm.downloadPath = fullPath
      this.showDirectoryPicker = false
    },
    clearDownloadPath() {
      this.clientForm.downloadPath = ''
    },
    clearContainerPath() {
      this.clientForm.downloadPath = ''
    },
    clearHostPath() {
      this.clientForm.hostDownloadPath = ''
    },
    async submitClient() {
      if (!this.clientForm.name || !this.clientForm.type || !this.clientForm.host || !this.clientForm.port) {
        this.$toast.error('Please fill in all required fields')
        return
      }

      this.submittingClient = true

      try {
        const payload = {
          name: this.clientForm.name,
          type: this.clientForm.type,
          host: this.clientForm.host,
          port: parseInt(this.clientForm.port),
          username: this.clientForm.username,
          password: this.clientForm.password,
          downloadPath: this.clientForm.downloadPath,
          hostDownloadPath: this.clientForm.hostDownloadPath,
          category: this.clientForm.category,
          enabled: this.clientForm.enabled
        }

        if (this.isEditMode) {
          await this.$axios.$put(`/api/download-clients/${this.editingClient.id}`, payload)
          this.$toast.success('Download client updated successfully')
        } else {
          await this.$axios.$post('/api/download-clients', payload)
          this.$toast.success('Download client added successfully')
        }

        this.closeModal()
        this.loadClients()
      } catch (error) {
        console.error('Failed to save download client:', error)
        const errorMessage = error.response?.data?.error || 'Failed to save download client'
        this.$toast.error(errorMessage)
      } finally {
        this.submittingClient = false
      }
    },
    async deleteClient(client) {
      if (!confirm(`Are you sure you want to delete the download client "${client.name}"?`)) {
        return
      }

      try {
        await this.$axios.$delete(`/api/download-clients/${client.id}`)
        this.$toast.success('Download client deleted successfully')
        this.loadClients()
      } catch (error) {
        console.error('Failed to delete download client:', error)
        const errorMessage = error.response?.data?.error || 'Failed to delete download client'
        this.$toast.error(errorMessage)
      }
    },
    async testClient(client) {
      this.testingClient = client.id

      try {
        const response = await this.$axios.$post(`/api/download-clients/${client.id}/test`)
        if (response.success) {
          this.$toast.success(`Connection test successful - ${response.message}`)
        } else {
          this.$toast.error(`Connection test failed: ${response.message}`)
        }
      } catch (error) {
        console.error('Failed to test download client:', error)
        const errorMessage = error.response?.data?.message || 'Connection test failed'
        this.$toast.error(errorMessage)
      } finally {
        this.testingClient = null
      }
    },
    closeModal() {
      this.showAddClientModal = false
      this.showDirectoryPicker = false
      this.isEditMode = false
      this.editingClient = null
      this.clientForm = {
        name: '',
        type: 'qbittorrent',
        host: 'localhost',
        port: 8080,
        username: '',
        password: '',
        downloadPath: '',
        hostDownloadPath: '',
        category: '',
        enabled: true
      }
    }
  },
  mounted() {
    this.loadClients()
  }
}
</script> 