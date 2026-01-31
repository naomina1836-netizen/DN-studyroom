let time = 1500;
let interval;
let quarter = 1;
let chatSubscription;
let currentUser = null;

// Initialize user on page load
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

// Tasks - Enhanced
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

// Chat System
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

async function loadMessages() {
  try {
    const { data: messages, error } = await supabaseClient
      .from("chat_messages")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(50);
    
    if (error) throw error;
    
    const chatMessages = document.getElementById("chatMessages");
    if (!chatMessages) return;
    
    chatMessages.innerHTML = "";
    
    if (!messages || messages.length === 0) {
      chatMessages.innerHTML = "<div class='message'>No messages yet. Start the conversation!</div>";
      return;
    }
    
    messages.forEach(msg => {
      const div = document.createElement("div");
      div.className = "message";
      const username = msg.username || 'User';
      const time = new Date(msg.created_at).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      div.innerHTML = `
        <strong>${username}:</strong> ${msg.message}
        <small>${time}</small>
      `;
      chatMessages.appendChild(div);
    });
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
  } catch (error) {
    console.error("Error loading messages:", error);
  }
}

function setupChatSubscription() {
  if (chatSubscription) return;
  
  try {
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
    
    console.log("Chat subscription active");
  } catch (error) {
    console.error("Error setting up chat subscription:", error);
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
  
  // Validate file size (10MB limit)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    alert("File too large. Maximum size is 10MB");
    return;
  }
  
  try {
    const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const filePath = `materials/${currentUser.id}/${fileName}`;
    
    // Upload to storage
    const { error: uploadError } = await supabaseClient.storage
      .from('materials')
      .upload(filePath, file);
    
    if (uploadError) {
      throw new Error("Upload failed: " + uploadError.message);
    }
    
    // Save to database
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
    
    // Clear form
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
      
      // Get public URL
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

// Initialize everything
async function initializeApp() {
  try {
    await initUser();
    
    // Load data if we're in the room page
    if (document.getElementById("taskList")) {
      await loadTasks();
    }
    
    if (document.getElementById("chatMessages")) {
      await loadMessages();
      setupChatSubscription();
    }
    
    if (document.getElementById("materialsList")) {
      await loadMaterials();
    }
    
    // Set default status
    if (currentUser && document.querySelector("select[onchange*='setStatus']")) {
      await setStatus("Studying");
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

// Logout function (optional)
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
  
  // Add logout button after a short delay
  setTimeout(addLogoutButton, 1000);
});