const sqlite3 = require('sqlite3').verbose()
const path = require('path')

const dbPath = path.join(__dirname, 'config', 'absdatabase.sqlite')

async function debugDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(err)
        return
      }
      
      console.log('=== Database Direct Debug ===')
      
      // Check table structure
      db.all("PRAGMA table_info(wishlistItems)", (err, rows) => {
        if (err) {
          reject(err)
          return
        }
        
        console.log('Table structure:')
        rows.forEach(row => {
          console.log(`- ${row.name}: ${row.type} (nullable: ${row.notnull === 0})`)
        })
        
        const hasPendingDownloads = rows.find(row => row.name === 'pendingDownloads')
        console.log(`\nPendingDownloads column exists: ${!!hasPendingDownloads}`)
        
        if (hasPendingDownloads) {
          console.log(`Column type: ${hasPendingDownloads.type}`)
          console.log(`Column nullable: ${hasPendingDownloads.notnull === 0}`)
        }
        
        // Check actual data
        db.all("SELECT id, title, pendingDownloads FROM wishlistItems LIMIT 3", (err, rows) => {
          if (err) {
            reject(err)
            return
          }
          
          console.log('\nActual data:')
          rows.forEach(row => {
            console.log(`- ${row.title}: pendingDownloads = ${row.pendingDownloads}`)
          })
          
          // Try updating directly with SQL
          const testItemId = rows[0]?.id
          if (testItemId) {
            console.log(`\nTesting direct SQL update on item ${testItemId}...`)
            
            const testData = JSON.stringify([{
              clientId: 'direct-sql-test',
              url: 'direct-sql-url',
              hash: 'direct-sql-hash',
              addedAt: new Date().toISOString()
            }])
            
            db.run("UPDATE wishlistItems SET pendingDownloads = ? WHERE id = ?", [testData, testItemId], function(err) {
              if (err) {
                console.error('❌ Direct SQL update failed:', err)
              } else {
                console.log('✅ Direct SQL update successful')
                
                // Verify the update
                db.get("SELECT pendingDownloads FROM wishlistItems WHERE id = ?", [testItemId], (err, row) => {
                  if (err) {
                    console.error('❌ Error verifying update:', err)
                  } else {
                    console.log('Verification result:', row.pendingDownloads)
                    
                    // Clean up
                    db.run("UPDATE wishlistItems SET pendingDownloads = ? WHERE id = ?", [JSON.stringify([]), testItemId], (err) => {
                      if (err) {
                        console.error('❌ Error cleaning up:', err)
                      } else {
                        console.log('✅ Test data cleaned up')
                      }
                      db.close()
                      resolve()
                    })
                  }
                })
              }
            })
          } else {
            console.log('❌ No wishlist items found for testing')
            db.close()
            resolve()
          }
        })
      })
    })
  })
}

debugDatabase().catch(console.error) 