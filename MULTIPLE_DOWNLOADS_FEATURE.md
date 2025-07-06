# Multiple Downloads Feature for Wishlist Items

## Overview
The wishlist now supports multiple pending downloads per item, allowing users to download different versions or formats of the same book/audiobook simultaneously.

## Key Changes

### Backend Changes (`server/controllers/DownloadClientController.js`)

1. **Progress API Updated**: The `getDownloadProgress` method now returns an array of downloads per wishlist item instead of a single download:
   ```javascript
   progressByWishlistItem[wishlistItem.id] = [
     { name, progress, state, hash, clientId, ... },
     { name, progress, state, hash, clientId, ... }
   ]
   ```

2. **Individual Cancel Support**: The cancel endpoint accepts individual torrent hashes to cancel specific downloads

### Frontend Changes (`client/pages/wishlist.vue`)

1. **Multiple Progress Bars**: Each pending download shows:
   - Torrent name (truncated with tooltip)
   - Progress percentage
   - Progress bar
   - Download state and speed
   - Individual cancel button

2. **Always Available Download Button**: The "Search Jackett" button is always visible, allowing users to add multiple downloads

3. **Individual Cancel Buttons**: Each download has its own cancel button next to the progress bar

## User Experience

### Adding Multiple Downloads
1. User clicks "Search Jackett" for a wishlist item
2. User can add multiple torrents from search results
3. Each torrent appears as a separate progress bar

### Progress Display
- Multiple progress bars stack vertically in the Progress column
- Each shows torrent name, percentage, state, and speed
- Individual cancel buttons allow selective cancellation

### Canceling Downloads
- Users can cancel individual downloads without affecting others
- Cancel button shows loading spinner during cancellation
- Progress updates in real-time

## Technical Details

### Data Structure
- `downloadProgress[wishlistItemId]` now contains an array of download objects
- Each download object includes: `name`, `progress`, `state`, `hash`, `clientId`, `downloadUrl`

### Real-time Updates
- Progress updates every 5 seconds
- Immediate UI updates after adding/canceling downloads
- Proper error handling and user feedback

### State Management
- `cancellingDownloads` object tracks individual cancellation states by hash
- Prevents double-cancellation and provides visual feedback

## Benefits

1. **Flexibility**: Users can download multiple versions (different quality, formats, etc.)
2. **User Control**: Individual cancellation without affecting other downloads
3. **Better UX**: Always available download option, clear progress tracking
4. **Reliability**: Hash-based tracking ensures accurate progress matching 