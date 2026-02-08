// ============================================
// VENDOCINE - ADMIN DASHBOARD
// Complete Working Version - Ready to Paste
// ============================================

// Global variables
let currentUser = null;
let chartInstances = {};

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log("Admin dashboard initializing...");
    
    // Check admin access
    checkAdminAccess();
    
    // Setup event listeners
    setupEventListeners();
    
    // Update time display
    updateTime();
    setInterval(updateTime, 60000);
});

// ============================================
// AUTHENTICATION & ACCESS CONTROL
// ============================================

// Check if user is admin
async function checkAdminAccess() {
    auth.onAuthStateChanged(async (user) => {
        if (!user) {
            console.log("No user logged in, redirecting...");
            window.location.href = 'index.html';
            return;
        }
        
        console.log("User logged in:", user.email);
        currentUser = user;
        
        try {
            // Check if user exists in database
            const userSnapshot = await database.ref('users')
                .orderByChild('email')
                .equalTo(user.email)
                .once('value');
            
            if (!userSnapshot.exists()) {
                // User not in database - check if admin email
                if (user.email === 'admin@vendocine.com' || user.email.includes('admin')) {
                    // Create admin account
                    const adminRef = database.ref('users').push();
                    await adminRef.set({
                        uid: user.uid,
                        email: user.email,
                        role: 'admin',
                        name: 'Administrator',
                        createdAt: Date.now(),
                        lastLogin: Date.now(),
                        status: 'active',
                        isPreRegistered: true
                    });
                    
                    // Update UI and load data
                    updateAdminUI(user.email, 'Administrator');
                    loadDashboardData();
                    
                } else {
                    // Not admin, redirect
                    await auth.signOut();
                    window.location.href = 'index.html';
                }
                
            } else {
                // User exists in database
                const userData = userSnapshot.val();
                const userId = Object.keys(userData)[0];
                const userInfo = userData[userId];
                
                if (userInfo.role !== 'admin') {
                    // Not admin, redirect
                    await auth.signOut();
                    window.location.href = 'index.html';
                    return;
                }
                
                // Update last login
                await database.ref('users/' + userId).update({
                    lastLogin: Date.now(),
                    uid: user.uid
                });
                
                // Update UI
                updateAdminUI(user.email, userInfo.name);
                
                // Load dashboard data
                loadDashboardData();
            }
            
        } catch (error) {
            console.error('Admin access check error:', error);
            showNotification('Authentication error. Please try again.', 'error');
            await auth.signOut();
            window.location.href = 'index.html';
        }
    });
}

// Update admin UI
function updateAdminUI(email, name) {
    const adminNameEl = document.getElementById('admin-name');
    const adminEmailEl = document.getElementById('admin-email');
    
    if (adminNameEl) adminNameEl.textContent = name || 'Administrator';
    if (adminEmailEl) adminEmailEl.textContent = email;
}

// ============================================
// DASHBOARD DATA LOADING
// ============================================

// Load all dashboard data
function loadDashboardData() {
    console.log("Loading dashboard data...");
    
    // Load statistics
    loadStatistics();
    
    // Load recent activity
    loadRecentActivity();
    
    // Load teachers list
    loadTeachersList();
    
    // Load students list
    loadStudentsList();
    
    // Load classes list
    loadAllClasses();
    
    // Load claims list
    loadClaimsList();
    
    // Load system settings
    loadSystemSettings();
}

// Load statistics
function loadStatistics() {
    // Total Students
    database.ref('students').on('value', (snapshot) => {
        const count = snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
        updateElementText('total-students', count);
        updateElementText('total-students-stat', count);
    });
    
    // Total Teachers
    database.ref('teachers').on('value', (snapshot) => {
        const count = snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
        updateElementText('total-teachers', count);
        updateElementText('active-teachers', count);
    });
    
    // Total Classes
    database.ref('classes').on('value', (snapshot) => {
        const count = snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
        updateElementText('total-classes', count);
        updateElementText('total-classes-stat', count);
    });
    
    // Today's Claims
    const today = new Date().toISOString().split('T')[0];
    database.ref('claims').orderByChild('date').equalTo(today)
        .on('value', (snapshot) => {
            const count = snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
            updateElementText('today-claims', count);
        });
}

// ============================================
// TEACHER MANAGEMENT
// ============================================

// Load teachers list
function loadTeachersList() {
    const teachersDiv = document.getElementById('teachers-table');
    if (!teachersDiv) return;
    
    database.ref('teachers').on('value', (snapshot) => {
        if (!snapshot.exists()) {
            teachersDiv.innerHTML = '<p class="no-data">No teachers registered yet.</p>';
            return;
        }
        
        let html = '<div class="table-header"><div>Name</div><div>Email</div><div>Class</div><div>Actions</div></div>';
        
        snapshot.forEach((child) => {
            const teacher = child.val();
            html += `
                <div class="table-row">
                    <div>${teacher.name}</div>
                    <div>${teacher.email}</div>
                    <div>${teacher.class || 'N/A'}</div>
                    <div>
                        <button onclick="viewTeacher('${child.key}')" class="btn-small">View</button>
                        <button onclick="editTeacher('${child.key}')" class="btn-small">Edit</button>
                        <button onclick="deleteTeacher('${child.key}')" class="btn-small btn-danger">Delete</button>
                    </div>
                </div>
            `;
        });
        
        teachersDiv.innerHTML = html;
    });
}

// Register teacher form handler
document.addEventListener('DOMContentLoaded', function() {
    const teacherForm = document.getElementById('teacher-form');
    if (teacherForm) {
        teacherForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            await registerTeacher(e);
        });
    }
});

// Register new teacher
async function registerTeacher(e) {
    const teacherData = {
        name: document.getElementById('teacher-name').value,
        email: document.getElementById('teacher-email').value,
        phone: document.getElementById('teacher-phone').value,
        employeeId: document.getElementById('teacher-employee-id').value,
        class: document.getElementById('teacher-class').value,
        status: 'active',
        createdAt: Date.now()
    };
    
    const resultDiv = document.getElementById('teacher-result');
    
    try {
        // Check if email exists
        const emailCheck = await database.ref('teachers')
            .orderByChild('email')
            .equalTo(teacherData.email)
            .once('value');
        
        if (emailCheck.exists()) {
            showResult('teacher-result', 'Email already registered!', 'error');
            return;
        }
        
        // Add teacher
        const teacherRef = database.ref('teachers').push();
        const teacherId = teacherRef.key;
        
        await teacherRef.set({
            id: teacherId,
            ...teacherData
        });
        
        // Add to users
        await database.ref('users').push().set({
            email: teacherData.email,
            role: 'teacher',
            name: teacherData.name,
            teacherId: teacherId,
            createdAt: Date.now(),
            status: 'active'
        });
        
        // Add class
        if (teacherData.class) {
            await database.ref('classes/' + teacherData.class).set({
                teacherId: teacherId,
                teacherName: teacherData.name,
                createdAt: Date.now()
            });
        }
        
        showResult('teacher-result', '✅ Teacher registered successfully!', 'success');
        e.target.reset();
        loadTeachersList();
        
    } catch (error) {
        console.error('Teacher registration error:', error);
        showResult('teacher-result', '❌ Error: ' + error.message, 'error');
    }
}

// View teacher
async function viewTeacher(teacherId) {
    try {
        const teacherSnap = await database.ref('teachers/' + teacherId).once('value');
        if (!teacherSnap.exists()) {
            showNotification('Teacher not found', 'error');
            return;
        }
        
        const teacher = teacherSnap.val();
        
        // Get students count
        const studentsSnap = await database.ref('students')
            .orderByChild('teacherId')
            .equalTo(teacherId)
            .once('value');
        const studentCount = studentsSnap.exists() ? Object.keys(studentsSnap.val()).length : 0;
        
        alert(`Teacher Details:\n\nName: ${teacher.name}\nEmail: ${teacher.email}\nClass: ${teacher.class || 'N/A'}\nStudents: ${studentCount}`);
        
    } catch (error) {
        console.error('Error viewing teacher:', error);
        showNotification('Error loading teacher details', 'error');
    }
}

// Delete teacher
async function deleteTeacher(teacherId) {
    if (!confirm('Delete this teacher?')) return;
    
    try {
        await database.ref('teachers/' + teacherId).remove();
        showNotification('Teacher deleted', 'success');
        loadTeachersList();
    } catch (error) {
        console.error('Error deleting teacher:', error);
        showNotification('Error deleting teacher', 'error');
    }
}

// ============================================
// STUDENT MANAGEMENT
// ============================================

// Load students list
function loadStudentsList() {
    const studentsList = document.getElementById('students-list');
    if (!studentsList) return;
    
    database.ref('students').on('value', (snapshot) => {
        if (!snapshot.exists()) {
            studentsList.innerHTML = '<div class="table-row"><div colspan="5">No students found.</div></div>';
            return;
        }
        
        let html = '';
        
        snapshot.forEach((child) => {
            const student = child.val();
            const pillsLeft = student.pillsLeft || 5;
            
            html += `
                <div class="table-row">
                    <td>${student.name}</td>
                    <td>${student.class || 'N/A'}</td>
                    <td>${student.email}</td>
                    <td>
                        <span class="pill-count ${pillsLeft < 3 ? 'low' : ''}">
                            ${pillsLeft}/5
                        </span>
                    </td>
                    <td>
                        <button onclick="viewStudent('${child.key}')" class="btn-small">View</button>
                        <button onclick="resetStudentPills('${child.key}')" class="btn-small">Reset</button>
                    </td>
                </div>
            `;
        });
        
        studentsList.innerHTML = html;
    });
}

// Search students
function searchStudents() {
    const searchTerm = document.getElementById('search-students').value.toLowerCase();
    const rows = document.querySelectorAll('#students-list .table-row');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

// View student
async function viewStudent(studentId) {
    try {
        const studentSnap = await database.ref('students/' + studentId).once('value');
        if (!studentSnap.exists()) {
            showNotification('Student not found', 'error');
            return;
        }
        
        const student = studentSnap.val();
        
        alert(`Student Details:\n\nName: ${student.name}\nEmail: ${student.email}\nClass: ${student.class || 'N/A'}\nLRN: ${student.lrn || 'N/A'}\nPills Left: ${student.pillsLeft || 5}/5`);
        
    } catch (error) {
        console.error('Error viewing student:', error);
        showNotification('Error loading student', 'error');
    }
}

// Reset student pills
async function resetStudentPills(studentId) {
    if (!confirm('Reset pills to 5?')) return;
    
    try {
        await database.ref('students/' + studentId).update({
            pillsLeft: 5,
            lastReset: Date.now()
        });
        showNotification('Pills reset to 5', 'success');
    } catch (error) {
        console.error('Error resetting pills:', error);
        showNotification('Error resetting pills', 'error');
    }
}

// ============================================
// CLASS MANAGEMENT
// ============================================

// Load all classes
async function loadAllClasses() {
    const classesDiv = document.getElementById('classes-table');
    if (!classesDiv) return;
    
    database.ref('classes').on('value', async (snapshot) => {
        if (!snapshot.exists()) {
            classesDiv.innerHTML = '<p class="no-data">No classes found.</p>';
            return;
        }
        
        let html = '<div class="table-header"><div>Class</div><div>Teacher</div><div>Students</div><div>Actions</div></div>';
        
        for (const [className, classData] of Object.entries(snapshot.val())) {
            // Get teacher name
            let teacherName = 'Not assigned';
            if (classData.teacherId) {
                const teacherSnap = await database.ref('teachers/' + classData.teacherId).once('value');
                if (teacherSnap.exists()) {
                    teacherName = teacherSnap.val().name;
                }
            }
            
            // Get student count
            const studentsSnap = await database.ref('students')
                .orderByChild('class')
                .equalTo(className)
                .once('value');
            const studentCount = studentsSnap.exists() ? Object.keys(studentsSnap.val()).length : 0;
            
            html += `
                <div class="table-row">
                    <td><strong>${className}</strong></td>
                    <td>${teacherName}</td>
                    <td>${studentCount} students</td>
                    <td>
                        <button onclick="viewClassStudents('${className}')" class="btn-small">View</button>
                    </td>
                </div>
            `;
        }
        
        classesDiv.innerHTML = html;
    });
}

// View class students
async function viewClassStudents(className) {
    try {
        const studentsSnap = await database.ref('students')
            .orderByChild('class')
            .equalTo(className)
            .once('value');
        
        if (!studentsSnap.exists()) {
            showNotification('No students in this class', 'info');
            return;
        }
        
        let message = `Students in ${className}:\n\n`;
        studentsSnap.forEach((child) => {
            const student = child.val();
            message += `• ${student.name} (${student.email}) - ${student.pillsLeft || 5}/5 pills\n`;
        });
        
        alert(message);
        
    } catch (error) {
        console.error('Error viewing class students:', error);
        showNotification('Error loading class students', 'error');
    }
}

// ============================================
// CLAIMS MANAGEMENT
// ============================================

// Load claims list
function loadClaimsList() {
    const filter = document.getElementById('claim-filter')?.value || 'all';
    const claimsList = document.getElementById('claims-list');
    
    if (!claimsList) return;
    
    let query = database.ref('claims').orderByChild('timestamp');
    
    // Apply time filter
    if (filter === 'today') {
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
        query = query.startAt(startOfDay);
    } else if (filter === 'week') {
        const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        query = query.startAt(weekAgo);
    } else if (filter === 'month') {
        const monthAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        query = query.startAt(monthAgo);
    }
    
    query.limitToLast(50).on('value', async (snapshot) => {
        if (!snapshot.exists()) {
            claimsList.innerHTML = '<tr><td colspan="4">No claims found</td></tr>';
            return;
        }
        
        let html = '';
        const claims = [];
        
        snapshot.forEach((child) => {
            claims.push({ id: child.key, ...child.val() });
        });
        
        // Sort newest first
        claims.sort((a, b) => b.timestamp - a.timestamp);
        
        for (const claim of claims) {
            let studentName = 'Unknown';
            
            if (claim.studentId) {
                const studentSnap = await database.ref('students/' + claim.studentId).once('value');
                if (studentSnap.exists()) {
                    studentName = studentSnap.val().name;
                }
            }
            
            html += `
                <tr>
                    <td>${studentName}</td>
                    <td>${claim.barcodeId || 'N/A'}</td>
                    <td>${new Date(claim.timestamp).toLocaleString()}</td>
                    <td>${claim.pillsLeft || 0}/5</td>
                </tr>
            `;
        }
        
        claimsList.innerHTML = html;
    });
}

// ============================================
// SYSTEM SETTINGS
// ============================================

// Load system settings
function loadSystemSettings() {
    // Load pill limit
    database.ref('settings/maxPillsPerMonth').on('value', (snapshot) => {
        const limit = snapshot.val() || 5;
        const pillLimitInput = document.getElementById('pill-limit');
        if (pillLimitInput) {
            pillLimitInput.value = limit;
        }
    });
    
    // Load maintenance mode
    database.ref('settings/maintenance').on('value', (snapshot) => {
        const isMaintenance = snapshot.val() || false;
        const maintenanceToggle = document.getElementById('maintenance-mode');
        const maintenanceStatus = document.getElementById('maintenance-status');
        
        if (maintenanceToggle) {
            maintenanceToggle.checked = isMaintenance;
        }
        if (maintenanceStatus) {
            maintenanceStatus.textContent = isMaintenance 
                ? 'System in maintenance mode' 
                : 'System is operational';
        }
    });
}

// Update pill limit
async function updatePillLimit() {
    const limitInput = document.getElementById('pill-limit');
    if (!limitInput) return;
    
    const limit = parseInt(limitInput.value);
    
    if (isNaN(limit) || limit < 1 || limit > 30) {
        showNotification('Please enter a valid number between 1 and 30', 'error');
        return;
    }
    
    try {
        await database.ref('settings').update({
            maxPillsPerMonth: limit
        });
        showNotification(`Pill limit updated to ${limit}`, 'success');
    } catch (error) {
        console.error('Error updating pill limit:', error);
        showNotification('Error updating pill limit', 'error');
    }
}

// Toggle maintenance mode
async function toggleMaintenance() {
    const maintenanceToggle = document.getElementById('maintenance-mode');
    if (!maintenanceToggle) return;
    
    const isMaintenance = maintenanceToggle.checked;
    
    try {
        await database.ref('settings').update({
            maintenance: isMaintenance
        });
        
        showNotification(
            isMaintenance 
                ? 'Maintenance mode enabled' 
                : 'Maintenance mode disabled',
            'success'
        );
    } catch (error) {
        console.error('Error updating maintenance mode:', error);
        showNotification('Error updating maintenance mode', 'error');
    }
}

// Reset all monthly claims
async function resetMonthlyClaims() {
    if (!confirm('Reset ALL student pill counts? This will set every student to 5 pills.')) {
        return;
    }
    
    try {
        // Get all students
        const studentsSnapshot = await database.ref('students').once('value');
        
        if (!studentsSnapshot.exists()) {
            showNotification('No students found', 'info');
            return;
        }
        
        const updates = {};
        studentsSnapshot.forEach((child) => {
            updates[`students/${child.key}/pillsLeft`] = 5;
        });
        
        await database.ref().update(updates);
        showNotification('All student pills reset to 5', 'success');
        
    } catch (error) {
        console.error('Error resetting claims:', error);
        showNotification('Error resetting claims', 'error');
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Setup event listeners
function setupEventListeners() {
    // Teacher form already handled in DOMContentLoaded
    
    // Search students
    const searchInput = document.getElementById('search-students');
    if (searchInput) {
        searchInput.addEventListener('input', searchStudents);
    }
    
    // Claims filter
    const claimFilter = document.getElementById('claim-filter');
    if (claimFilter) {
        claimFilter.addEventListener('change', loadClaimsList);
    }
    
    // Maintenance toggle
    const maintenanceToggle = document.getElementById('maintenance-mode');
    if (maintenanceToggle) {
        maintenanceToggle.addEventListener('change', toggleMaintenance);
    }
    
    // Pill limit update
    const updateLimitBtn = document.getElementById('update-pill-limit');
    if (updateLimitBtn) {
        updateLimitBtn.addEventListener('click', updatePillLimit);
    }
}

// Update element text
function updateElementText(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = text;
    }
}

// Show result message
function showResult(elementId, message, type = 'info') {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    element.innerHTML = `
        <div class="alert alert-${type}">
            ${message}
        </div>
    `;
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        element.innerHTML = '';
    }, 5000);
}

// Show notification
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">
                ${type === 'success' ? '✅' : 
                  type === 'error' ? '❌' : 
                  type === 'warning' ? '⚠️' : 'ℹ️'}
            </span>
            <span>${message}</span>
        </div>
    `;
    
    // Style
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 5px;
        background: ${type === 'success' ? '#4CAF50' : 
                     type === 'error' ? '#f44336' : 
                     type === 'warning' ? '#ff9800' : '#2196F3'};
        color: white;
        z-index: 1000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, 300);
        }
    }, 5000);
}

// Update time
function updateTime() {
    const now = new Date();
    const timeElement = document.getElementById('current-time');
    if (timeElement) {
        timeElement.textContent = 
            now.toLocaleDateString() + ' ' + 
            now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    }
}

// Show section
function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.style.display = 'none';
    });
    
    // Remove active class from menu
    document.querySelectorAll('.sidebar-menu a').forEach(item => {
        item.classList.remove('active');
    });
    
    // Show selected section
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.style.display = 'block';
    }
    
    // Add active class to clicked item
    if (event && event.target) {
        event.target.classList.add('active');
    }
    
    // Update page title
    const titles = {
        'overview': 'Admin Dashboard',
        'register-teacher': 'Register Teacher',
        'manage-students': 'Manage Students',
        'all-classes': 'All Classes',
        'view-claims': 'View Claims',
        'system-settings': 'System Settings'
    };
    
    const pageTitle = document.getElementById('page-title');
    if (pageTitle) {
        pageTitle.textContent = titles[sectionId] || 'Admin Dashboard';
    }
}

// Load recent activity (simplified)
function loadRecentActivity() {
    const activityList = document.getElementById('recent-activity-list');
    if (!activityList) return;
    
    // Simple placeholder
    activityList.innerHTML = `
        <div class="activity-item">
            <div class="activity-icon">📝</div>
            <div class="activity-details">
                <p class="activity-action">System initialized</p>
                <p class="activity-time">Just now</p>
            </div>
        </div>
        <div class="activity-item">
            <div class="activity-icon">👤</div>
            <div class="activity-details">
                <p class="activity-action">Admin logged in</p>
                <p class="activity-time">Just now</p>
            </div>
        </div>
    `;
}

// Logout
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        auth.signOut().then(() => {
            window.location.href = 'index.html';
        });
    }
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 5px;
        color: white;
        z-index: 1000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease;
    }
    
    .notification.success {
        background: #4CAF50;
    }
    
    .notification.error {
        background: #f44336;
    }
    
    .notification.warning {
        background: #ff9800;
    }
    
    .notification.info {
        background: #2196F3;
    }
    
    .notification-content {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    
    .pill-count {
        padding: 3px 8px;
        border-radius: 12px;
        font-weight: bold;
        font-size: 0.9em;
    }
    
    .pill-count.low {
        background: #ffebee;
        color: #c62828;
    }
    
    .btn-small {
        padding: 5px 10px;
        font-size: 0.9em;
        margin: 2px;
    }
    
    .btn-danger {
        background: #f44336;
        color: white;
    }
    
    .alert {
        padding: 10px 15px;
        border-radius: 5px;
        margin: 10px 0;
    }
    
    .alert-success {
        background: #d4edda;
        color: #155724;
        border: 1px solid #c3e6cb;
    }
    
    .alert-error {
        background: #f8d7da;
        color: #721c24;
        border: 1px solid #f5c6cb;
    }
    
    .no-data {
        text-align: center;
        padding: 20px;
        color: #666;
        font-style: italic;
    }
`;
document.head.appendChild(style);

console.log("Admin dashboard loaded successfully");