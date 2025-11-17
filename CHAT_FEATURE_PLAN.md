# Chat Feature Implementation Plan

## Overview
Implement a real-time chat system using Socket.io for staff-to-staff communication, supporting one-to-one messaging and group chats.

---

## 1. Technology Stack

### Backend
- **Socket.io** - Real-time bidirectional communication
- **Express.js** - HTTP server (already in use)
- **MongoDB/Mongoose** - Database for storing messages and chat data
- **Node.js** - Runtime environment

### Frontend
- **socket.io-client** - Socket.io client library
- **React** - UI framework (already in use)
- **React Context/Redux** - State management for chat data
- **React Query** - For fetching chat history
- **Shadcn UI Components** - For chat UI components

---

## 2. Database Models

### 2.1 Chat Model
```javascript
// backend/models/Chat.js
{
  _id: ObjectId,
  type: 'one-to-one' | 'group',
  name: String (optional, for groups),
  description: String (optional, for groups),
  createdBy: ObjectId (ref: Staff),
  members: [ObjectId] (ref: Staff),
  avatar: String (optional, for groups),
  isActive: Boolean (default: true),
  lastMessage: ObjectId (ref: Message),
  lastMessageAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### 2.2 Message Model
```javascript
// backend/models/Message.js
{
  _id: ObjectId,
  chatId: ObjectId (ref: Chat),
  senderId: ObjectId (ref: Staff),
  content: String,
  messageType: 'text' | 'image' | 'file' | 'system',
  fileUrl: String (optional),
  fileName: String (optional),
  fileSize: Number (optional),
  isEdited: Boolean (default: false),
  editedAt: Date (optional),
  isDeleted: Boolean (default: false),
  deletedAt: Date (optional),
  readBy: [{
    userId: ObjectId (ref: Staff),
    readAt: Date
  }],
  replyTo: ObjectId (ref: Message, optional),
  createdAt: Date,
  updatedAt: Date
}
```

### 2.3 ChatMember Model (Optional - for additional metadata)
```javascript
// backend/models/ChatMember.js (optional, can be embedded in Chat)
{
  chatId: ObjectId (ref: Chat),
  userId: ObjectId (ref: Staff),
  role: 'admin' | 'member' (default: 'member'),
  joinedAt: Date,
  lastReadMessageId: ObjectId (ref: Message),
  lastReadAt: Date,
  isMuted: Boolean (default: false),
  isPinned: Boolean (default: false),
  notificationsEnabled: Boolean (default: true)
}
```

---

## 3. Backend Architecture

### 3.1 Socket.io Server Setup
- **File**: `backend/socket/socketServer.js`
- **Integration**: Integrate with existing Express server
- **Authentication**: Socket authentication using JWT or session
- **Namespaces**: 
  - `/chat` - Main chat namespace
  - `/notifications` - For notifications (optional)

### 3.2 Socket Events (Server-side)

#### Connection Events
- `connection` - When a staff member connects
- `disconnect` - When a staff member disconnects
- `authenticate` - Authenticate socket connection with staff ID

#### Chat Events
- `join_chat` - Join a specific chat room
- `leave_chat` - Leave a specific chat room
- `send_message` - Send a new message
- `edit_message` - Edit an existing message
- `delete_message` - Delete a message
- `typing_start` - User started typing
- `typing_stop` - User stopped typing
- `mark_read` - Mark messages as read
- `user_online` - User came online
- `user_offline` - User went offline

#### Group Chat Events
- `create_group` - Create a new group chat
- `add_members` - Add members to a group
- `remove_members` - Remove members from a group
- `update_group` - Update group name, description, avatar
- `leave_group` - Leave a group chat
- `delete_group` - Delete a group chat (admin only)

#### Event Responses (Emit to clients)
- `message_received` - New message received
- `message_sent` - Message sent confirmation
- `message_edited` - Message edited notification
- `message_deleted` - Message deleted notification
- `user_typing` - User is typing notification
- `user_stopped_typing` - User stopped typing notification
- `messages_read` - Messages read notification
- `chat_updated` - Chat updated (name, members, etc.)
- `error` - Error occurred

### 3.3 REST API Endpoints

#### Chat Endpoints
- `GET /api/chats` - Get all chats for current staff member
- `GET /api/chats/:id` - Get chat details
- `POST /api/chats` - Create a new chat (one-to-one or group)
- `PUT /api/chats/:id` - Update chat (name, description, avatar)
- `DELETE /api/chats/:id` - Delete a chat
- `GET /api/chats/:id/members` - Get chat members
- `POST /api/chats/:id/members` - Add members to group
- `DELETE /api/chats/:id/members/:memberId` - Remove member from group
- `POST /api/chats/:id/leave` - Leave a group chat

#### Message Endpoints
- `GET /api/chats/:chatId/messages` - Get messages for a chat (with pagination)
- `GET /api/messages/:id` - Get a specific message
- `POST /api/chats/:chatId/messages` - Send a message (REST fallback)
- `PUT /api/messages/:id` - Edit a message
- `DELETE /api/messages/:id` - Delete a message
- `POST /api/messages/:id/read` - Mark message as read
- `POST /api/chats/:chatId/mark-read` - Mark all messages in chat as read
- `GET /api/chats/:chatId/unread-count` - Get unread message count

#### Staff Endpoints (for chat)
- `GET /api/staff/online` - Get list of online staff members
- `GET /api/staff/chat-users` - Get staff members available for chat

---

## 4. Frontend Architecture

### 4.1 Socket Client Setup
- **File**: `glamour-pro-forge/src/services/socket.ts`
- **Connection**: Connect to Socket.io server on app initialization
- **Authentication**: Pass staff ID during connection
- **Reconnection**: Handle automatic reconnection
- **Error Handling**: Handle connection errors

### 4.2 State Management

#### Chat Context/Store
- **File**: `glamour-pro-forge/src/contexts/ChatContext.tsx` or Redux store
- **State**:
  - `chats: Chat[]` - List of all chats
  - `activeChat: Chat | null` - Currently active chat
  - `messages: Record<chatId, Message[]>` - Messages by chat ID
  - `onlineUsers: string[]` - Online staff member IDs
  - `typingUsers: Record<chatId, string[]>` - Users typing in each chat
  - `unreadCounts: Record<chatId, number>` - Unread message counts
  - `socket: Socket | null` - Socket connection instance
  - `isConnected: boolean` - Socket connection status

### 4.3 React Components

#### Main Components
1. **ChatLayout** - Main chat container
   - Sidebar with chat list
   - Main chat area
   - User info panel

2. **ChatList** - List of chats
   - One-to-one chats
   - Group chats
   - Search/filter chats
   - Unread badges
   - Online status indicators

3. **ChatWindow** - Chat message area
   - Message list
   - Message input
   - Typing indicators
   - Read receipts
   - Scroll to bottom
   - Load more messages (pagination)

4. **MessageItem** - Individual message component
   - Sender name and avatar
   - Message content
   - Timestamp
   - Read receipts
   - Edit/delete options
   - Reply to message
   - File attachments

5. **MessageInput** - Message input component
   - Text input
   - File upload
   - Emoji picker (optional)
   - Send button
   - Typing indicator

6. **CreateGroupDialog** - Create group chat
   - Group name input
   - Member selection
   - Group description
   - Group avatar upload

7. **ChatInfoPanel** - Chat information
   - Chat details
   - Member list
   - Group settings (for groups)
   - Leave/delete chat options

8. **OnlineStatusIndicator** - Online/offline status
   - Green dot for online
   - Gray dot for offline
   - Last seen time

### 4.4 Pages/Routes
- `/chat` - Main chat page
- `/chat/:chatId` - Specific chat view

---

## 5. Features Breakdown

### 5.1 One-to-One Messaging
- **Create Chat**: Automatically create chat when staff selects another staff member
- **Message Exchange**: Send and receive messages in real-time
- **Message Status**: Sent, delivered, read indicators
- **Typing Indicators**: Show when the other person is typing
- **Online Status**: Show if the other person is online
- **Message History**: Load previous messages with pagination
- **Search Messages**: Search within a conversation (optional)

### 5.2 Group Chat
- **Create Group**: Create a group with multiple staff members
- **Add Members**: Add new members to existing groups
- **Remove Members**: Remove members from groups (admin only)
- **Group Info**: View group details, members, settings
- **Leave Group**: Leave a group chat
- **Delete Group**: Delete a group (admin only)
- **Group Avatar**: Upload and change group avatar
- **Group Name/Description**: Edit group name and description

### 5.3 Real-time Messaging
- **Instant Delivery**: Messages delivered instantly via Socket.io
- **Typing Indicators**: Real-time typing status
- **Online Status**: Real-time online/offline status
- **Read Receipts**: Real-time read status updates
- **Message Notifications**: Notifications for new messages
- **Connection Status**: Show connection status (connected/disconnected)

### 5.4 Message Features
- **Text Messages**: Send text messages
- **File Attachments**: Send images and files (optional)
- **Edit Messages**: Edit sent messages
- **Delete Messages**: Delete messages (soft delete)
- **Reply to Messages**: Reply to specific messages (optional)
- **Message Reactions**: React to messages (optional)
- **Forward Messages**: Forward messages to other chats (optional)

### 5.5 Additional Features (Optional)
- **Message Search**: Search messages across all chats
- **Message Pinning**: Pin important messages
- **Chat Archiving**: Archive old chats
- **Chat Muting**: Mute notifications for specific chats
- **Message Drafts**: Save draft messages
- **Message Scheduling**: Schedule messages (optional)
- **Voice Messages**: Send voice messages (optional)
- **Video Calls**: Video calling (optional, future feature)

---

## 6. Socket.io Implementation Details

### 6.1 Connection Flow
1. Staff member logs in
2. Frontend connects to Socket.io server
3. Send authentication event with staff ID
4. Server validates staff ID
5. Server joins staff to their personal room (staff:staffId)
6. Server joins staff to all their chat rooms
7. Server emits online status to relevant chats

### 6.2 Message Flow
1. User types message and clicks send
2. Frontend emits `send_message` event to server
3. Server validates message and saves to database
4. Server emits `message_received` to all members of the chat
5. Frontend receives message and updates UI
6. Server updates chat's `lastMessage` and `lastMessageAt`
7. Server updates unread counts for other members

### 6.3 Typing Indicator Flow
1. User starts typing in input field
2. Frontend emits `typing_start` event to server
3. Server broadcasts `user_typing` to other members of the chat
4. Frontend shows typing indicator
5. User stops typing (after 3 seconds of inactivity)
6. Frontend emits `typing_stop` event
7. Server broadcasts `user_stopped_typing` to other members

### 6.4 Read Receipt Flow
1. User opens a chat
2. Frontend marks all messages as read
3. Frontend emits `mark_read` event to server
4. Server updates message `readBy` array
5. Server broadcasts `messages_read` to other members
6. Frontend updates read receipts in UI

### 6.5 Online Status Flow
1. Staff member connects to socket
2. Server adds staff to online users list
3. Server broadcasts `user_online` to relevant chats
4. Frontend updates online status indicators
5. Staff member disconnects
6. Server removes staff from online users list
7. Server broadcasts `user_offline` to relevant chats

---

## 7. Database Indexes

### Chat Model Indexes
- `members` - For finding chats by member
- `type` - For filtering by chat type
- `lastMessageAt` - For sorting chats by recent activity
- `createdBy` - For finding chats created by a user

### Message Model Indexes
- `chatId` - For finding messages in a chat
- `senderId` - For finding messages by sender
- `createdAt` - For sorting messages chronologically
- `chatId + createdAt` - Compound index for efficient querying

---

## 8. Security Considerations

### 8.1 Authentication
- **Socket Authentication**: Authenticate socket connections with staff ID
- **JWT Tokens**: Use JWT tokens for socket authentication (optional)
- **Session Validation**: Validate staff session before allowing chat access
- **Staff Verification**: Verify staff is active before allowing chat

### 8.2 Authorization
- **Chat Access**: Verify staff is a member of a chat before allowing access
- **Message Access**: Verify staff can view messages in a chat
- **Group Admin**: Only admins can add/remove members, delete group
- **Message Ownership**: Only message sender can edit/delete their messages

### 8.3 Data Validation
- **Message Content**: Validate message content (length, content type)
- **File Uploads**: Validate file types, sizes (if implementing file sharing)
- **Chat Creation**: Validate chat name, member IDs
- **Input Sanitization**: Sanitize user input to prevent XSS

### 8.4 Rate Limiting
- **Message Rate**: Limit number of messages per minute
- **Connection Rate**: Limit number of connections per IP
- **File Upload Rate**: Limit file uploads (if implementing)

---

## 9. Performance Considerations

### 9.1 Database Optimization
- **Pagination**: Implement pagination for messages (load 50 messages at a time)
- **Indexes**: Create proper indexes for efficient queries
- **Caching**: Cache chat list and recent messages in Redis (optional)
- **Aggregation**: Use MongoDB aggregation for complex queries

### 9.2 Socket Optimization
- **Room Management**: Use Socket.io rooms for efficient message broadcasting
- **Connection Pooling**: Manage socket connections efficiently
- **Message Batching**: Batch multiple messages if needed
- **Compression**: Enable Socket.io compression for large messages

### 9.3 Frontend Optimization
- **Virtual Scrolling**: Use virtual scrolling for long message lists
- **Lazy Loading**: Lazy load chat list and messages
- **Message Caching**: Cache messages in local state
- **Debouncing**: Debounce typing indicators and search inputs
- **Image Optimization**: Optimize images before sending (if implementing)

---

## 10. UI/UX Design

### 10.1 Chat List Sidebar
- **Layout**: Left sidebar with chat list
- **Chat Items**: Avatar, name, last message preview, timestamp, unread badge
- **Search**: Search bar to filter chats
- **Create Button**: Button to create new chat/group
- **Online Status**: Green dot for online users
- **Unread Badge**: Red badge with unread count

### 10.2 Chat Window
- **Header**: Chat name, online status, chat info button
- **Messages**: Message list with sender name, avatar, timestamp
- **Input Area**: Text input, file upload, send button
- **Typing Indicator**: "User is typing..." indicator
- **Read Receipts**: Checkmarks for read status
- **Scroll to Bottom**: Auto-scroll to latest message

### 10.3 Message Bubbles
- **Sender Messages**: Right-aligned, colored background
- **Receiver Messages**: Left-aligned, different colored background
- **System Messages**: Centered, different style (for group events)
- **Timestamp**: Show timestamp on hover or in message
- **Read Receipts**: Single checkmark (sent), double checkmark (read)

### 10.4 Group Chat Features
- **Group Avatar**: Show group avatar or first letters of group name
- **Member List**: Show all members in group info
- **Admin Badge**: Show admin badge for group admins
- **Add/Remove Members**: Buttons to manage members (admin only)

---

## 11. Implementation Phases

### Phase 1: Backend Setup & Basic Chat
1. Install Socket.io and dependencies
2. Set up Socket.io server
3. Create Chat and Message models
4. Implement basic socket authentication
5. Implement basic message sending/receiving
6. Create REST API endpoints for chats and messages
7. Test socket connection and basic messaging

### Phase 2: One-to-One Messaging
1. Implement one-to-one chat creation
2. Implement message sending/receiving
3. Implement message history loading
4. Implement online status
5. Implement typing indicators
6. Implement read receipts
7. Test one-to-one messaging

### Phase 3: Frontend Basic UI
1. Create ChatLayout component
2. Create ChatList component
3. Create ChatWindow component
4. Create MessageItem component
5. Create MessageInput component
6. Integrate Socket.io client
7. Test basic UI and socket integration

### Phase 4: Group Chat
1. Implement group chat creation
2. Implement add/remove members
3. Implement group info panel
4. Implement leave/delete group
5. Implement group settings
6. Test group chat functionality

### Phase 5: Advanced Features
1. Implement message editing
2. Implement message deletion
3. Implement file attachments (optional)
4. Implement message search (optional)
5. Implement chat archiving (optional)
6. Implement notifications
7. Test all advanced features

### Phase 6: Polish & Optimization
1. Implement pagination for messages
2. Optimize database queries
3. Implement caching (optional)
4. Add error handling
5. Add loading states
6. Add animations and transitions
7. Performance testing and optimization
8. UI/UX improvements

---

## 12. File Structure

### Backend
```
backend/
├── models/
│   ├── Chat.js
│   ├── Message.js
│   └── ChatMember.js (optional)
├── controllers/
│   ├── chatController.js
│   └── messageController.js
├── routes/
│   ├── chatRoutes.js
│   └── messageRoutes.js
├── socket/
│   ├── socketServer.js
│   ├── chatHandlers.js
│   ├── messageHandlers.js
│   └── typingHandlers.js
└── middleware/
    └── socketAuth.js (optional)
```

### Frontend
```
glamour-pro-forge/src/
├── services/
│   ├── socket.ts
│   └── chatApi.ts
├── contexts/
│   └── ChatContext.tsx
├── components/
│   └── Chat/
│       ├── ChatLayout.tsx
│       ├── ChatList.tsx
│       ├── ChatWindow.tsx
│       ├── MessageItem.tsx
│       ├── MessageInput.tsx
│       ├── CreateGroupDialog.tsx
│       ├── ChatInfoPanel.tsx
│       └── OnlineStatusIndicator.tsx
├── pages/
│   └── Chat.tsx
└── hooks/
    ├── useSocket.ts
    ├── useChat.ts
    └── useMessages.ts
```

---

## 13. Dependencies to Install

### Backend
```json
{
  "socket.io": "^4.5.0",
  "socket.io-client": "^4.5.0" // For testing
}
```

### Frontend
```json
{
  "socket.io-client": "^4.5.0",
  "date-fns": "^2.30.0" // Already installed
  "react-virtualized": "^9.22.0" // For virtual scrolling (optional)
}
```

---

## 14. Environment Variables

### Backend
```env
SOCKET_PORT=3001 (optional, if using separate port)
SOCKET_CORS_ORIGIN=http://localhost:8080
```

### Frontend
```env
VITE_SOCKET_URL=http://localhost:3000
```

---

## 15. Testing Strategy

### Backend Testing
- **Unit Tests**: Test chat and message controllers
- **Socket Tests**: Test socket event handlers
- **Integration Tests**: Test chat creation, messaging flow
- **Load Testing**: Test with multiple concurrent connections

### Frontend Testing
- **Component Tests**: Test chat components
- **Socket Tests**: Test socket connection and events
- **Integration Tests**: Test complete chat flow
- **E2E Tests**: Test user interactions

---

## 16. Deployment Considerations

### Backend
- **Socket.io Scaling**: Use Redis adapter for multiple server instances
- **Load Balancer**: Configure sticky sessions for Socket.io
- **CORS Configuration**: Configure CORS for production domain
- **Environment Variables**: Set production environment variables

### Frontend
- **Socket URL**: Configure production Socket.io URL
- **Error Handling**: Handle connection errors gracefully
- **Reconnection**: Implement automatic reconnection
- **Performance**: Optimize bundle size

---

## 17. Future Enhancements (Optional)

1. **File Sharing**: Share images, documents, videos
2. **Voice Messages**: Record and send voice messages
3. **Video Calls**: Video calling between staff members
4. **Screen Sharing**: Share screen during calls
5. **Message Reactions**: React to messages with emojis
6. **Message Pinning**: Pin important messages
7. **Chat Bots**: Integrate chat bots for automation
8. **Message Templates**: Pre-defined message templates
9. **Message Scheduling**: Schedule messages for later
10. **Chat Export**: Export chat history as PDF/text
11. **Dark Mode**: Dark mode for chat UI
12. **Notifications**: Push notifications for new messages
13. **Message Search**: Search messages across all chats
14. **Chat Archiving**: Archive old chats
15. **Chat Muting**: Mute notifications for specific chats

---

## 18. Success Criteria

1. ✅ Staff can send and receive messages in real-time
2. ✅ One-to-one messaging works seamlessly
3. ✅ Group chat creation and management works
4. ✅ Typing indicators work in real-time
5. ✅ Online status updates in real-time
6. ✅ Read receipts work correctly
7. ✅ Message history loads efficiently
8. ✅ UI is responsive and user-friendly
9. ✅ Socket connection is stable and handles reconnection
10. ✅ Performance is acceptable with multiple concurrent users

---

## 19. Notes

- **Staff-Only**: This chat feature is for staff members only, not for clients
- **Authentication**: Staff must be logged in to use chat
- **Active Staff**: Only active staff members can use chat
- **Scalability**: Consider Redis adapter for Socket.io if scaling to multiple servers
- **File Storage**: If implementing file sharing, use the existing `uploads` folder or cloud storage
- **Notifications**: Consider implementing browser notifications for new messages
- **Mobile Responsive**: Ensure chat UI works on mobile devices
- **Accessibility**: Ensure chat UI is accessible (keyboard navigation, screen readers)

---

## 20. Questions to Consider

1. **Authentication Method**: How will we authenticate Socket.io connections? (JWT, session, staff ID)
2. **File Storage**: Where will we store file attachments? (local uploads folder, cloud storage)
3. **Message Limit**: What's the maximum message length?
4. **File Size Limit**: What's the maximum file size for attachments?
5. **Message Retention**: How long should we keep messages? (forever, 30 days, configurable)
6. **Group Size Limit**: What's the maximum number of members in a group?
7. **Notifications**: Should we implement browser notifications?
8. **Mobile App**: Will there be a mobile app in the future?
9. **Admin Features**: Should admins have special privileges in groups?
10. **Message Encryption**: Should we encrypt messages? (optional, for sensitive data)

---

This plan provides a comprehensive roadmap for implementing the chat feature. You can use this as a guide to implement the feature step by step.

