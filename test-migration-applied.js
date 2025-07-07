const Database = require('./server/Database')
const path = require('path')

// Set global config path
global.ConfigPath = path.join(__dirname, 'config')
global.MetadataPath = path.join(__dirname, 'metadata')

async function testMigrationApplied() {
  try {
    console.log('=== Testing Migration Applied ===')
    
    await Database.init()
    
    // Find a wishlist item
    const wishlistItem = await Database.wishlistItemModel.findOne()
    if (!wishlistItem) {
      console.log('❌ No wishlist items found')
      return
    }
    
    console.log(`Found wishlist item: ${wishlistItem.title}`)
    console.log(`Initial pendingDownloads:`, wishlistItem.pendingDownloads)
    
    // Test adding a download entry using the fixed approach
    const downloadEntry = {
      clientId: 'test-migration-client',
      url: 'test-migration-url',
      hash: 'test-migration-hash',
      addedAt: new Date().toISOString()
    }
    
    const pendingDownloads = wishlistItem.pendingDownloads || []
    pendingDownloads.push(downloadEntry)
    
    // Use direct assignment and save() instead of update()
    wishlistItem.pendingDownloads = pendingDownloads
    await wishlistItem.save()
    
    console.log('✅ Successfully saved download entry')
    
    // Verify by fetching fresh from database
    const freshItem = await Database.wishlistItemModel.findByPk(wishlistItem.id)
    console.log(`Fresh from database:`, freshItem.pendingDownloads)
    
    if (freshItem.pendingDownloads && freshItem.pendingDownloads.length > 0) {
      console.log('✅ Migration works! Data persists correctly')
      
      // Clean up test data
      freshItem.pendingDownloads = []
      await freshItem.save()
      console.log('✅ Test data cleaned up')
    } else {
      console.log('❌ Migration failed - data not persisting')
    }
    
  } catch (error) {
    console.error('❌ Error testing migration:', error)
  } finally {
    process.exit(0)
  }
}

testMigrationApplied() 