// Teacher Dashboard Functions
let teacherId = null;
let teacherClass = null;

document.addEventListener('DOMContentLoaded', function() {
    checkTeacherAccess();
    setupEventListeners();
});

// Check if user is teacher
async function checkTeacherAccess() {
    auth.onAuthStateChanged(async (user) => {
        if (!user) {
            window.location.href = 'index.html';
            return;
        }
        
        const userSnapshot = await database.ref('users')
            .orderByChild('email')
            .equalTo(user.email)
            .once('value');
        
        if (!userSnapshot.exists()) {
            window.location.href = 'index.html';
            return;
        }
        
        const userData = userSnapshot.val();
        const userId = Object.keys(userData)[0];
        const userInfo = userData[userId];
        
        if (userInfo.role !== 'teacher') {
            window.location.href = 'index.html';
            return;
        }
        
        teacherId = userInfo.teacherId;
        
        // Get teacher details
        const teacherSnap = await database.ref('teachers/' + teacherId).once('value');
        if (teacherSnap.exists()) {
            const teacher = teacherSnap.val();
            teacherClass = teacher.class;
            
            // Update UI
            document.getElementById('teacher-name').textContent = teacher.name;
            document.getElementById('teacher-class').textContent = 'Class: ' + (teacherClass || 'Not assigned');
            
            // Load data
            loadTeacherData();
        }
    });
}

// Load teacher data
function loadTeacherData() {
    if (!teacherClass) return;
    
    // Load student count
    database.ref('students').orderByChild('class').equalTo(teacherClass)
        .on('value', (snapshot) => {
            const count = snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
            document.getElementById('student-count').textContent = count;
        });
    
    // Load today's claims
    const today = new Date().toISOString().split('T')[0];
    database.ref('claims').orderByChild('date').equalTo(today)
        .on('value', (snapshot) => {
            if (!snapshot.exists()) {
                document.getElementById('today-claims').textContent = '0';
                return;
            }
            
            let classClaims = 0;
            snapshot.forEach((child) => {
                const claim = child.val();
                if (claim.class === teacherClass) {
                    classClaims++;
                }
            });
            
            document.getElementById('today-claims').textContent = classClaims;
        });
    
    // Load students
    loadMyStudents();
    loadClassClaims();
    loadBarcodes();
}

// Setup event listeners
function setupEventListeners() {
    // Student registration form
    document.getElementById('student-form').addEventListener('submit', registerStudent);
    
    // Search students
    document.getElementById('search-my-students').addEventListener('input', searchMyStudents);
    
    // Filter claims
    document.getElementById('class-claim-filter').addEventListener('change', loadClassClaims);
}

// Register new student
async function registerStudent(e) {
    e.preventDefault();
    
    if (!teacherClass) {
        showMessage('Teacher class not assigned', 'error');
        return;
    }
    
    const studentData = {
        name: document.getElementById('student-name').value,
        email: document.getElementById('student-email').value,
        lrn: document.getElementById('student-lrn').value,
        age: parseInt(document.getElementById('student-age').value) || 0,
        gender: document.getElementById('student-gender').value,
        birthDate: document.getElementById('student-birthdate').value,
        barcodeId: document.getElementById('student-barcode').value,
        class: teacherClass,
        teacherId: teacherId,
        parentContact: document.getElementById('parent-contact').value,
        medicalNotes: document.getElementById('medical-notes').value,
        pillsLeft: 5,
        pillsPerMonth: 5,
        totalClaims: 0,
        status: 'active',
        createdAt: Date.now()
    };
    
    const resultDiv = document.getElementById('student-result');
    
    try {
        // Check if LRN already exists
        const lrnCheck = await database.ref('students')
            .orderByChild('lrn')
            .equalTo(studentData.lrn)
            .once('value');
        
        if (lrnCheck.exists()) {
            resultDiv.innerHTML = '<div class="error">LRN already registered!</div>';
            return;
        }
        
        // Check if barcode already exists
        const barcodeCheck = await database.ref('students')
            .orderByChild('barcodeId')
            .equalTo(studentData.barcodeId)
            .once('value');
        
        if (barcodeCheck.exists()) {
            resultDiv.innerHTML = '<div class="error">Barcode ID already in use!</div>';
            return;
        }
        
        // Add student to database
        const studentRef = database.ref('students').push();
        await studentRef.set({
            id: studentRef.key,
            ...studentData
        });
        
        // Generate QR code URL
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(studentData.barcodeId)}`;
        await studentRef.update({ qrCode: qrCodeUrl });
        
        resultDiv.innerHTML = `
            <div class="success">
                ✅ Student registered successfully!<br>
                <strong>Name:</strong> ${studentData.name}<br>
                <strong>Barcode ID:</strong> ${studentData.barcodeId}<br>
                <strong>LRN:</strong> ${studentData.lrn}
            </div>
        `;
        
        // Clear form
        e.target.reset();
        
        // Generate new barcode
        generateBarcode();
        
        // Reload students list
        loadMyStudents();
        loadBarcodes();
        
    } catch (error) {
        resultDiv.innerHTML = `<div class="error">Error: ${error.message}</div>`;
    }
}

// Load teacher's students
function loadMyStudents() {
    if (!teacherClass) return;
    
    const studentsList = document.getElementById('my-students-list');
    
    database.ref('students').orderByChild('class').equalTo(teacherClass)
        .on('value', async (snapshot) => {
            if (!snapshot.exists()) {
                studentsList.innerHTML = '<div class="table-row"><div colspan="6">No students in your class.</div></div>';
                return;
            }
            
            let html = '';
            
            snapshot.forEach((child) => {
                const student = child.val();
                
                // Format last claim
                let lastClaim = 'Never';
                if (student.lastClaim) {
                    lastClaim = new Date(student.lastClaim).toLocaleDateString();
                }
                
                html += `
                    <div class="table-row">
                        <div>${student.name}</div>
                        <div>${student.lrn}</div>
                        <div><code>${student.barcodeId}</code></div>
                        <div><span class="pill-count ${student.pillsLeft < 3 ? 'low' : ''}">${student.pillsLeft}/5</span></div>
                        <div>${lastClaim}</div>
                        <div>
                            <button onclick="viewStudent('${child.key}')" class="btn-small">View</button>
                            <button onclick="editStudent('${child.key}')" class="btn-small">Edit</button>
                        </div>
                    </div>
                `;
            });
            
            studentsList.innerHTML = html;
        });
}

// Search teacher's students
function searchMyStudents() {
    const searchTerm = document.getElementById('search-my-students').value.toLowerCase();
    const rows = document.querySelectorAll('#my-students-list .table-row');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

// Load class claims
function loadClassClaims() {
    if (!teacherClass) return;
    
    const filter = document.getElementById('class-claim-filter').value;
    const claimsList = document.getElementById('class-claims-list');
    
    let query = database.ref('claims').orderByChild('class').equalTo(teacherClass);
    
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
            claimsList.innerHTML = '<div class="table-row"><div colspan="3">No claims found.</div></div>';
            return;
        }
        
        let html = '';
        const claims = [];
        
        snapshot.forEach((child) => {
            claims.push({ id: child.key, ...child.val() });
        });
        
        // Sort by timestamp (newest first)
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
                <div class="table-row">
                    <div>${studentName}</div>
                    <div>${new Date(claim.timestamp).toLocaleString()}</div>
                    <div>${claim.pillsLeft || 0}/5</div>
                </div>
            `;
        }
        
        claimsList.innerHTML = html;
    });
}

// Load barcodes
function loadBarcodes() {
    if (!teacherClass) return;
    
    const barcodeList = document.getElementById('barcode-list');
    
    database.ref('students').orderByChild('class').equalTo(teacherClass)
        .on('value', (snapshot) => {
            if (!snapshot.exists()) {
                barcodeList.innerHTML = '<p>No students to generate barcodes for.</p>';
                return;
            }
            
            let html = '';
            
            snapshot.forEach((child) => {
                const student = child.val();
                const qrCodeUrl = student.qrCode || 
                    `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(student.barcodeId)}`;
                
                html += `
                    <div class="barcode-card">
                        <div class="barcode-header">
                            <h4>${student.name}</h4>
                            <p>${student.class}</p>
                        </div>
                        <img src="${qrCodeUrl}" alt="Barcode for ${student.barcodeId}" class="barcode-img">
                        <div class="barcode-info">
                            <p><strong>ID:</strong> ${student.barcodeId}</p>
                            <p><strong>LRN:</strong> ${student.lrn}</p>
                        </div>
                        <button onclick="printBarcode('${child.key}')" class="btn-small">Print</button>
                    </div>
                `;
            });
            
            barcodeList.innerHTML = html;
        });
}

// Generate barcode ID
function generateBarcode() {
    const prefix = 'STU';
    const year = new Date().getFullYear().toString().slice(-2);
    const random = Math.floor(10000 + Math.random() * 90000);
    const barcode = `${prefix}${year}${random}`;
    
    document.getElementById('student-barcode').value = barcode;
}

// View student details
function viewStudent(studentId) {
    // Implement view student modal
    alert('View student details - to be implemented');
}

// Edit student
function editStudent(studentId) {
    // Implement edit student modal
    alert('Edit student - to be implemented');
}

// Print single barcode
function printBarcode(studentId) {
    // Implement print single barcode
    alert('Print barcode - to be implemented');
}

// Print all barcodes
function printAllBarcodes() {
    window.print();
}

// Download barcodes as PDF
function downloadBarcodes() {
    alert('Download barcodes as PDF - to be implemented');
}

// Show message
function showMessage(text, type = 'info') {
    alert(`${type.toUpperCase()}: ${text}`);
}

// Show section
function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.style.display = 'none';
    });
    
    // Remove active class from all menu items
    document.querySelectorAll('.sidebar-menu a').forEach(item => {
        item.classList.remove('active');
    });
    
    // Show selected section
    document.getElementById(sectionId).style.display = 'block';
    
    // Add active class to clicked menu item
    event.target.classList.add('active');
    
    // Update page title
    const titles = {
        'my-students': 'My Students',
        'register-student': 'Register Student',
        'class-claims': 'Class Claims',
        'barcodes': 'Student Barcodes'
    };
    
    document.getElementById('page-title').textContent = titles[sectionId] || 'Teacher Dashboard';
}

// Logout function
function logout() {
    auth.signOut().then(() => {
        window.location.href = 'index.html';
    });
}