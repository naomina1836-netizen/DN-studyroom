let time = 1500;
let interval;
let quarter = 1;
let currentUser = null;

async function initUser() {
  try {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (user) {
      currentUser = user;
      console.log("User initialized:", user.email);
    }
  } catch (error) {
    console.error("Error initializing user:", error);
  }
}

// Timer Functions
function startTimer() {
  if (interval) return;
  interval = setInterval(() => {
    time--;
    updateTimer();
    if (time <= 0) finishQuarter();
  }, 1000);
}

function updateTimer() {
  const m = String(Math.floor(time / 60)).padStart(2, '0');
  const s = String(time % 60).padStart(2, '0');
  const timerElement = document.getElementById("timer");
  if (timerElement) {
    timerElement.innerText = `${m}:${s}`;
  }
}

function finishQuarter() {
  clearInterval(interval);
  interval = null;
  time = 1500;
  if (quarter < 4) quarter++;
  const quarterElement = document.getElementById("quarter");
  if (quarterElement) {
    quarterElement.innerText = quarter;
  }
  updateStreak();
}

function resetTimer() {
  clearInterval(interval);
  interval = null;
  time = 1500;
  updateTimer();
}

// Authentication
async function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  if (!email || !password) {
    alert("Please enter both email and password");
    return;
  }

  const { error } = await supabaseClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    alert("Login failed: " + error.message);
  } else {
    window.location.href = "room.html";
  }
}

// Status
async function setStatus(status) {
  if (!currentUser) {
    await initUser();
  }
  
  try {
    await supabaseClient.from("status").upsert({
      user_id: currentUser.id,
      status: status,
      updated_at: new Date().toISOString()
    });
    console.log("Status updated to:", status);
  } catch (error) {
    console.error("Error updating status:", error);
  }
}

// Tasks
async function addTask() {
  if (!currentUser) {
    await initUser();
  }
  
  const taskInput = document.getElementById("taskInput");
  if (!taskInput) return;
  
  const taskText = taskInput.value.trim();
  
  if (!taskText) {
    alert("Please enter a task");
    return;
  }
  
  try {
    const { error } = await supabaseClient.from("tasks").insert([
      { 
        user_id: currentUser.id, 
        text: taskText,
        completed: false 
      }
    ]);
    
    if (error) {
      alert("Error adding task: " + error.message);
    } else {
      taskInput.value = "";
      await loadTasks();
    }
  } catch (error) {
    console.error("Error adding task:", error);
    alert("Failed to add task. Please try again.");
  }
}

async function loadTasks() {
  try {
    if (!currentUser) {
      await initUser();
    }
    
    const { data: tasks, error } = await supabaseClient
      .from("tasks")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false });
    
    if (error) throw error;
    
    const taskList = document.getElementById("taskList");
    if (!taskList) return;
    
    taskList.innerHTML = "";
    
    if (!tasks || tasks.length === 0) {
      taskList.innerHTML = "<li>No tasks yet. Add one above!</li>";
      return;
    }
    
    tasks.forEach(task => {
      const li = document.createElement("li");
      li.className = "task-item";
      li.innerHTML = `
        <input type="checkbox" ${task.completed ? 'checked' : ''} 
               onchange="toggleTask('${task.id}', this.checked)">
        <span class="${task.completed ? 'completed' : ''}">${task.text}</span>
        <button class="delete-btn" onclick="deleteTask('${task.id}')">×</button>
      `;
      taskList.appendChild(li);
    });
  } catch (error) {
    console.error("Error loading tasks:", error);
    const taskList = document.getElementById("taskList");
    if (taskList) {
      taskList.innerHTML = "<li>Error loading tasks</li>";
    }
  }
}

async function toggleTask(taskId, completed) {
  try {
    await supabaseClient
      .from("tasks")
      .update({ 
        completed: completed, 
        updated_at: new Date().toISOString() 
      })
      .eq("id", taskId);
    await loadTasks();
  } catch (error) {
    console.error("Error toggling task:", error);
  }
}

async function deleteTask(taskId) {
  if (!confirm("Delete this task?")) return;
  
  try {
    await supabaseClient.from("tasks").delete().eq("id", taskId);
    await loadTasks();
  } catch (error) {
    console.error("Error deleting task:", error);
    alert("Failed to delete task");
  }
}

// Chat
async function sendMessage() {
  if (!currentUser) {
    await initUser();
  }
  
  const messageInput = document.getElementById("messageInput");
  if (!messageInput) return;
  
  const messageText = messageInput.value.trim();
  
  if (!messageText) {
    alert("Please enter a message");
    return;
  }
  
  try {
    const username = currentUser.email ? currentUser.email.split('@')[0] : 'User';
    
    const { error } = await supabaseClient.from("chat_messages").insert([
      { 
        user_id: currentUser.id,
        username: username,
        message: messageText
      }
    ]);
    
    if (error) {
      console.error("Error sending message:", error);
      alert("Failed to send message: " + error.message);
    } else {
      messageInput.value = "";
    }
  } catch (error) {
    console.error("Error in sendMessage:", error);
    alert("Failed to send message");
  }
}

// Materials Upload
async function uploadMaterial() {
  if (!currentUser) {
    await initUser();
  }
  
  const fileInput = document.getElementById("materialFile");
  const descriptionInput = document.getElementById("materialDesc");
  
  if (!fileInput || !descriptionInput) return;
  
  const file = fileInput.files[0];
  const description = descriptionInput.value.trim();
  
  if (!file) {
    alert("Please select a file to upload");
    return;
  }
  
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    alert("File too large. Maximum size is 10MB");
    return;
  }
  
  try {
    const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const filePath = `materials/${currentUser.id}/${fileName}`;
    
    const { error: uploadError } = await supabaseClient.storage
      .from('materials')
      .upload(filePath, file);
    
    if (uploadError) {
      throw new Error("Upload failed: " + uploadError.message);
    }
    
    const { error: dbError } = await supabaseClient.from("materials").insert([
      {
        user_id: currentUser.id,
        filename: file.name,
        filepath: filePath,
        description: description || file.name,
        filesize: file.size,
        filetype: file.type
      }
    ]);
    
    if (dbError) {
      throw new Error("Database error: " + dbError.message);
    }
    
    fileInput.value = "";
    descriptionInput.value = "";
    
    alert("Material uploaded successfully!");
    await loadMaterials();
    
  } catch (error) {
    console.error("Error uploading material:", error);
    alert("Upload failed: " + error.message);
  }
}

async function loadMaterials() {
  try {
    const { data: materials, error } = await supabaseClient
      .from("materials")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    
    if (error) throw error;
    
    const materialsList = document.getElementById("materialsList");
    if (!materialsList) return;
    
    materialsList.innerHTML = "";
    
    if (!materials || materials.length === 0) {
      materialsList.innerHTML = "<li>No materials uploaded yet.</li>";
      return;
    }
    
    materials.forEach(material => {
      const li = document.createElement("li");
      const fileSize = (material.filesize / 1024).toFixed(1);
      
      const { data: { publicUrl } } = supabaseClient.storage
        .from('materials')
        .getPublicUrl(material.filepath);
      
      li.innerHTML = `
        <div class="material-item">
          <strong>${material.description}</strong><br>
          <small>${material.filename} (${fileSize} KB)</small><br>
          <a href="${publicUrl}" target="_blank" class="download-btn">Download</a>
          <small>Uploaded on ${new Date(material.created_at).toLocaleDateString()}</small>
        </div>
      `;
      materialsList.appendChild(li);
    });
  } catch (error) {
    console.error("Error loading materials:", error);
    const materialsList = document.getElementById("materialsList");
    if (materialsList) {
      materialsList.innerHTML = "<li>Error loading materials</li>";
    }
  }
}

// Streak
function updateStreak() {
  const streakEl = document.getElementById("streak");
  if (streakEl) {
    let days = parseInt(streakEl.innerText) || 0;
    streakEl.innerText = (days + 1) + " days";
  }
}

// Nudge
function sendNudge() {
  alert("🌼 Gentle nudge sent! Stay focused.");
}

// ========== REAL-TIME ENHANCEMENT FUNCTIONS ==========
let presenceSubscription;
let statusSubscription;
let typingSubscription;
let chatSubscription;
let onlineUsers = new Map();

// Initialize all real-time subscriptions
async function setupAllRealtimeSubscriptions() {
  await setupPresenceSubscription();
  await setupStatusSubscription();
  await setupTypingSubscription();
  await setupMessageReadSubscription();
}

// 1. Presence System
async function setupPresenceSubscription() {
  // Set user as online
  await updatePresence(true);
  
  // Subscribe to other users' presence
  presenceSubscription = supabaseClient
    .channel('online-users')
    .on('postgres_changes', 
      { 
        event: '*', 
        schema: 'public', 
        table: 'user_presence' 
      }, 
      async (payload) => {
        if (payload.new.user_id === currentUser.id) return;
        
        const user = await getUserProfile(payload.new.user_id);
        onlineUsers.set(payload.new.user_id, {
          ...user,
          is_online: payload.new.is_online,
          last_seen: payload.new.last_seen
        });
        
        updateOnlineUsersUI();
      }
    )
    .subscribe();
  
  // Handle page visibility
  document.addEventListener('visibilitychange', async () => {
    if (document.hidden) {
      await updatePresence(false);
    } else {
      await updatePresence(true);
    }
  });
  
  // Update presence periodically
  setInterval(async () => {
    if (!document.hidden) {
      await updatePresence(true);
    }
  }, 30000);
}

async function updatePresence(isOnline) {
  try {
    await supabaseClient
      .from('user_presence')
      .upsert({
        user_id: currentUser.id,
        is_online: isOnline,
        last_seen: new Date().toISOString(),
        session_id: generateSessionId()
      });
  } catch (error) {
    console.error('Error updating presence:', error);
  }
}

// 2. Enhanced Status System
async function setupStatusSubscription() {
  statusSubscription = supabaseClient
    .channel('user-status')
    .on('postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'status'
      },
      async (payload) => {
        if (payload.new.user_id === currentUser.id) return;
        
        const user = await getUserProfile(payload.new.user_id);
        const statusElement = document.getElementById(`user-status-${payload.new.user_id}`);
        
        if (statusElement) {
          statusElement.textContent = payload.new.status;
          statusElement.className = `status-badge status-${payload.new.status.toLowerCase().replace(' ', '-')}`;
        }
      }
    )
    .subscribe();
}

// 3. Typing Indicators
let typingTimeout;
let isTyping = false;

async function setupTypingSubscription() {
  typingSubscription = supabaseClient
    .channel('typing-indicators')
    .on('postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'typing_indicators'
      },
      async (payload) => {
        if (payload.new.user_id === currentUser.id) return;
        
        const user = await getUserProfile(payload.new.user_id);
        const typingIndicator = document.getElementById('typing-indicator');
        
        if (typingIndicator) {
          if (payload.new.is_typing) {
            typingIndicator.textContent = `${user.username || 'User'} is typing...`;
            typingIndicator.style.display = 'block';
          } else {
            typingIndicator.style.display = 'none';
          }
        }
      }
    )
    .subscribe();
}

function handleTyping() {
  if (!isTyping) {
    isTyping = true;
    updateTypingIndicator(true);
  }
  
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    isTyping = false;
    updateTypingIndicator(false);
  }, 1000);
}

async function updateTypingIndicator(isTyping) {
  try {
    await supabaseClient
      .from('typing_indicators')
      .upsert({
        user_id: currentUser.id,
        is_typing: isTyping,
        updated_at: new Date().toISOString()
      });
  } catch (error) {
    console.error('Error updating typing indicator:', error);
  }
}

// 4. Message Read Receipts (BIGINT message_id compatible)
async function setupMessageReadSubscription() {
  await markMessagesAsRead();
  
  supabaseClient
    .channel('message-read-receipts')
    .on('postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages'
      },
      async () => {
        await markMessagesAsRead();
      }
    )
    .subscribe();
}

async function markMessagesAsRead() {
  try {
    const { data: messages, error } = await supabaseClient
      .from('chat_messages')
      .select('id, user_id')
      .neq('user_id', currentUser.id)
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (error) throw error;
    
    if (messages && messages.length > 0) {
      for (const msg of messages) {
        const { data: existing } = await supabaseClient
          .from('read_receipts')
          .select('id')
          .eq('user_id', currentUser.id)
          .eq('message_id', msg.id)
          .maybeSingle();
        
        if (!existing) {
          await supabaseClient
            .from('read_receipts')
            .insert({
              user_id: currentUser.id,
              message_id: msg.id
            });
        }
      }
    }
  } catch (error) {
    console.error('Error marking messages as read:', error);
  }
}

// 5. Original Chat Subscription (keep this)
function setupChatSubscription() {
  if (chatSubscription) return;
  
  chatSubscription = supabaseClient
    .channel('chat-room')
    .on('postgres_changes', 
      { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'chat_messages' 
      }, 
      () => {
        loadMessages();
      }
    )
    .subscribe();
}

// 6. Notifications System
async function setupNotifications() {
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
  
  supabaseClient
    .channel('user-notifications')
    .on('postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${currentUser.id}`
      },
      (payload) => {
        showNotification(payload.new);
      }
    )
    .subscribe();
}

async function createNotification(notification) {
  try {
    const { error } = await supabaseClient
      .from('notifications')
      .insert([notification]);
    
    if (error) throw error;
  } catch (error) {
    console.error('Error creating notification:', error);
  }
}

function showNotification(notification) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(notification.title, {
      body: notification.message,
      icon: '/favicon.ico'
    });
  }
  
  const notificationBell = document.getElementById('notification-bell');
  if (notificationBell) {
    notificationBell.classList.add('has-notifications');
    showNotificationToast(notification);
  }
}

// 7. Helper Functions
async function getUserProfile(userId) {
  try {
    const { data, error } = await supabaseClient
      .from('user_profiles')
      .select('username, avatar_url')
      .eq('id', userId)
      .maybeSingle();
    
    return data || { username: 'User' };
  } catch (error) {
    return { username: 'User' };
  }
}

function generateSessionId() {
  return 'session_' + Math.random().toString(36).substr(2, 9);
}

function updateOnlineUsersUI() {
  const onlineList = document.getElementById('online-users-list');
  if (!onlineList) return;
  
  onlineList.innerHTML = '';
  
  onlineUsers.forEach((user, userId) => {
    const userElement = document.createElement('div');
    userElement.className = 'online-user';
    userElement.innerHTML = `
      <span class="user-avatar">${user.username?.charAt(0) || 'U'}</span>
      <span class="user-name">${user.username || 'User'}</span>
      <span class="status-dot ${user.is_online ? 'online' : 'offline'}"></span>
    `;
    onlineList.appendChild(userElement);
  });
  
  // Update online count
  const onlineCount = document.getElementById('online-count');
  if (onlineCount) {
    const count = Array.from(onlineUsers.values()).filter(u => u.is_online).length;
    onlineCount.textContent = count;
  }
}

// 8. Notifications Panel Functions
function showNotificationsPanel() {
  const panel = document.getElementById('notifications-panel');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  if (panel.style.display === 'block') {
    loadNotifications();
  }
}

async function loadNotifications() {
  try {
    const { data: notifications, error } = await supabaseClient
      .from('notifications')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (error) throw error;
    
    const notificationsList = document.getElementById('notifications-list');
    if (!notificationsList) return;
    
    notificationsList.innerHTML = '';
    
    if (!notifications || notifications.length === 0) {
      notificationsList.innerHTML = '<div class="notification-item">No notifications</div>';
      return;
    }
    
    notifications.forEach(notification => {
      const div = document.createElement('div');
      div.className = `notification-item ${notification.is_read ? 'read' : 'unread'}`;
      div.innerHTML = `
        <strong>${notification.title}</strong>
        <p>${notification.message}</p>
        <small>${new Date(notification.created_at).toLocaleString()}</small>
        ${!notification.is_read ? '<button onclick="markNotificationAsRead(\'' + notification.id + '\')">✓</button>' : ''}
      `;
      notificationsList.appendChild(div);
    });
  } catch (error) {
    console.error('Error loading notifications:', error);
    const notificationsList = document.getElementById('notifications-list');
    if (notificationsList) {
      notificationsList.innerHTML = '<div class="notification-item">Error loading notifications</div>';
    }
  }
}

async function markNotificationAsRead(notificationId) {
  try {
    await supabaseClient
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);
    
    await loadNotifications();
  } catch (error) {
    console.error('Error marking notification as read:', error);
  }
}

async function markAllNotificationsAsRead() {
  try {
    await supabaseClient
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', currentUser.id)
      .eq('is_read', false);
    
    await loadNotifications();
    
    const notificationBell = document.getElementById('notification-bell');
    if (notificationBell) {
      notificationBell.classList.remove('has-notifications');
    }
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
  }
}

function showNotificationToast(notification) {
  const toast = document.createElement('div');
  toast.className = 'notification-toast';
  toast.innerHTML = `
    <strong>${notification.title}</strong>
    <p>${notification.message}</p>
  `;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 5000);
}

// ========== INITIALIZATION ==========
async function initializeApp() {
  try {
    await initUser();
    
    if (currentUser) {
      // Setup all real-time features
      await setupAllRealtimeSubscriptions();
      await setupNotifications();
      
      // Load data
      if (document.getElementById("taskList")) {
        await loadTasks();
      }
      
      if (document.getElementById("chatMessages")) {
        await loadMessages();
        setupChatSubscription();
        
        const messageInput = document.getElementById("messageInput");
        if (messageInput) {
          messageInput.addEventListener('input', handleTyping);
        }
      }
      
      if (document.getElementById("materialsList")) {
        await loadMaterials();
      }
      
      if (document.querySelector("select[onchange*='setStatus']")) {
        await setStatus("Studying");
      }
    }
    
    console.log("App initialized successfully");
    
  } catch (error) {
    console.error("Error initializing app:", error);
  }
}

// Enter key handlers
function handleChatKeyPress(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
}

function handleTaskKeyPress(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    addTask();
  }
}

// Logout function
async function logout() {
  await supabaseClient.auth.signOut();
  window.location.href = "index.html";
}

// Add logout button to room page
function addLogoutButton() {
  const roomHeader = document.querySelector('.room h2');
  if (roomHeader && currentUser) {
    const logoutBtn = document.createElement('button');
    logoutBtn.textContent = 'Logout';
    logoutBtn.onclick = logout;
    logoutBtn.style.marginLeft = '20px';
    logoutBtn.style.background = '#dc2626';
    roomHeader.appendChild(logoutBtn);
  }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
  initializeApp();
  
  setTimeout(addLogoutButton, 1000);
});

// Cleanup
window.addEventListener('beforeunload', async () => {
  if (currentUser) {
    await updatePresence(false);
  }
  
  if (presenceSubscription) supabaseClient.removeChannel(presenceSubscription);
  if (statusSubscription) supabaseClient.removeChannel(statusSubscription);
  if (typingSubscription) supabaseClient.removeChannel(typingSubscription);
  if (chatSubscription) supabaseClient.removeChannel(chatSubscription);
});
