<template>
  <div>
    <app-settings-content :header-text="'Jackett Integrations'">
      <div class="mb-4">
        <p class="text-sm text-gray-400 mb-4">Configure Jackett integrations for torrent searching. Each integration represents a single indexer configured in your Jackett instance.</p>

        <ui-btn @click="showAddIntegrationModal = true" color="success" class="mb-4">
          <span class="material-symbols mr-2">add</span>
          Add Integration
        </ui-btn>
      </div>

      <!-- Integrations List -->
      <div v-if="integrations.length > 0" class="space-y-4">
        <div v-for="integration in integrations" :key="integration.id" class="bg-bg border border-white/10 rounded-lg p-4">
          <div class="flex items-center justify-between">
            <div class="flex-1">
              <div class="flex items-center">
                <h3 class="text-lg font-semibold">{{ integration.name }}</h3>
                <div class="ml-2 flex items-center">
                  <div v-if="integration.enabled" class="w-3 h-3 bg-green-500 rounded-full" title="Enabled"></div>
                  <div v-else class="w-3 h-3 bg-red-500 rounded-full" title="Disabled"></div>
                </div>
              </div>
              <p class="text-sm text-gray-400">{{ integration.url }}</p>
              <div v-if="integration.categories && integration.categories.length > 0" class="mt-2">
                <div class="flex flex-wrap gap-1">
                  <span v-for="categoryId in integration.categories" :key="categoryId" class="text-xs bg-primary/20 text-primary px-2 py-1 rounded">
                    {{ getCategoryName(categoryId) }}
                  </span>
                </div>
              </div>
            </div>
            <div class="flex items-center space-x-2">
              <ui-btn @click="testIntegration(integration)" :loading="testingIntegration === integration.id" size="xs" color="bg-blue-600"> Test </ui-btn>
              <ui-btn @click="editIntegration(integration)" size="xs" color="bg-gray-600"> Edit </ui-btn>
              <ui-btn @click="deleteIntegration(integration)" size="xs" color="bg-red-600"> Delete </ui-btn>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="text-center py-8">
        <p class="text-gray-400">No Jackett integrations configured</p>
        <p class="text-sm text-gray-500 mt-2">Add your first integration to enable torrent searching</p>
      </div>
    </app-settings-content>

    <!-- Add/Edit Integration Modal -->
    <modals-modal v-model="showAddIntegrationModal" name="add-jackett-integration" :width="600" :height="'unset'">
      <template #outer>
        <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
          <p class="text-3xl text-white truncate">{{ isEditMode ? 'Edit' : 'Add' }} Jackett Integration</p>
        </div>
      </template>
      <div class="px-4 w-full text-sm py-6 rounded-lg bg-bg shadow-lg border border-black-300 relative overflow-hidden">
        <form @submit.prevent="submitIntegration">
          <div class="mb-4">
            <ui-text-input v-model="integrationForm.name" label="Integration Name" placeholder="e.g., AudioBookBay" :disabled="submittingIntegration" required />
          </div>

          <div class="mb-4">
            <ui-text-input v-model="integrationForm.url" label="Torznab URL" placeholder="http://localhost:9117/api/v2.0/indexers/audiobookbay/torznab" :disabled="submittingIntegration" required />
            <p class="text-xs text-gray-400 mt-1">Get this URL from your Jackett web interface by clicking the indexer settings (wrench icon)</p>
          </div>

          <div class="mb-4">
            <ui-text-input v-model="integrationForm.apiKey" label="API Key" placeholder="Your Jackett API key" :disabled="submittingIntegration" required />
          </div>

          <div class="mb-4">
            <ui-multi-select v-model="integrationForm.categories" label="Categories" placeholder="Select categories to search" :items="availableCategories" :disabled="submittingIntegration" />
            <p class="text-xs text-gray-400 mt-1">Leave empty to search all categories</p>
          </div>

          <div class="mb-6">
            <div class="mb-2">
              <label class="text-sm font-medium">Status</label>
            </div>
            <ui-toggle-switch v-model="integrationForm.enabled" label="Enable Integration" :disabled="submittingIntegration" />
            <p class="text-xs text-gray-400 mt-1">When enabled, this integration will be included in searches. Disabled integrations are saved but not used.</p>
          </div>

          <div class="flex justify-end space-x-2">
            <ui-btn @click="closeModal" :disabled="submittingIntegration">Cancel</ui-btn>
            <ui-btn type="submit" :loading="submittingIntegration" color="success"> {{ isEditMode ? 'Update' : 'Add' }} Integration </ui-btn>
          </div>
        </form>
      </div>
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
      integrations: [],
      availableCategories: [],
      showAddIntegrationModal: false,
      isEditMode: false,
      editingIntegration: null,
      submittingIntegration: false,
      testingIntegration: null,
      integrationForm: {
        name: '',
        url: '',
        apiKey: '',
        categories: [],
        enabled: true
      }
    }
  },
  computed: {
    userIsAdminOrUp() {
      return this.$store.getters['user/getIsAdminOrUp']
    }
  },
  methods: {
    async loadIntegrations() {
      try {
        const response = await this.$axios.$get('/api/jackett/integrations')
        this.integrations = response.integrations || []
      } catch (error) {
        console.error('Failed to load integrations:', error)
        this.$toast.error('Failed to load integrations')
      }
    },
    async loadCategories() {
      try {
        const response = await this.$axios.$get('/api/jackett/categories')
        this.availableCategories = response.categories.map((cat) => ({
          text: cat.name,
          value: cat.id
        }))
      } catch (error) {
        console.error('Failed to load categories:', error)
        this.$toast.error('Failed to load categories')
      }
    },
    getCategoryName(categoryId) {
      const category = this.availableCategories.find((cat) => cat.value === categoryId)
      return category ? category.text : categoryId
    },
    editIntegration(integration) {
      this.isEditMode = true
      this.editingIntegration = integration
      this.integrationForm = {
        name: integration.name,
        url: integration.url,
        apiKey: integration.apiKey,
        categories: integration.categories || [],
        enabled: integration.enabled
      }
      this.showAddIntegrationModal = true
    },
    async submitIntegration() {
      if (!this.integrationForm.name || !this.integrationForm.url || !this.integrationForm.apiKey) {
        this.$toast.error('Please fill in all required fields')
        return
      }

      this.submittingIntegration = true

      try {
        const payload = {
          name: this.integrationForm.name,
          url: this.integrationForm.url,
          apiKey: this.integrationForm.apiKey,
          categories: this.integrationForm.categories,
          enabled: this.integrationForm.enabled
        }

        if (this.isEditMode) {
          await this.$axios.$put(`/api/jackett/integrations/${this.editingIntegration.id}`, payload)
          this.$toast.success('Integration updated successfully')
        } else {
          await this.$axios.$post('/api/jackett/integrations', payload)
          this.$toast.success('Integration added successfully')
        }

        this.closeModal()
        this.loadIntegrations()
      } catch (error) {
        console.error('Failed to save integration:', error)
        const errorMessage = error.response?.data?.error || 'Failed to save integration'
        this.$toast.error(errorMessage)
      } finally {
        this.submittingIntegration = false
      }
    },
    async deleteIntegration(integration) {
      if (!confirm(`Are you sure you want to delete the integration "${integration.name}"?`)) {
        return
      }

      try {
        await this.$axios.$delete(`/api/jackett/integrations/${integration.id}`)
        this.$toast.success('Integration deleted successfully')
        this.loadIntegrations()
      } catch (error) {
        console.error('Failed to delete integration:', error)
        const errorMessage = error.response?.data?.error || 'Failed to delete integration'
        this.$toast.error(errorMessage)
      }
    },
    async testIntegration(integration) {
      this.testingIntegration = integration.id

      try {
        const response = await this.$axios.$post(`/api/jackett/integrations/${integration.id}/test`)
        if (response.success) {
          this.$toast.success('Connection test successful')
        } else {
          this.$toast.error(`Connection test failed: ${response.message}`)
        }
      } catch (error) {
        console.error('Failed to test integration:', error)
        const errorMessage = error.response?.data?.message || 'Connection test failed'
        this.$toast.error(errorMessage)
      } finally {
        this.testingIntegration = null
      }
    },
    closeModal() {
      this.showAddIntegrationModal = false
      this.isEditMode = false
      this.editingIntegration = null
      this.integrationForm = {
        name: '',
        url: '',
        apiKey: '',
        categories: [],
        enabled: true
      }
    }
  },
  mounted() {
    this.loadIntegrations()
    this.loadCategories()
  }
}
</script> 