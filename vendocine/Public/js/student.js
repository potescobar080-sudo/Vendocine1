// Student Dashboard Functions
let studentId = null;
let studentData = null;

document.addEventListener('DOMContentLoaded', function() {
    checkStudentAccess();
});

// Check if user is student
async function checkStudentAccess() {
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
        
        if (userInfo.role !== 'student') {
            window.location.href = 'index.html';
            return;
        }
        
        studentId = userInfo.studentId;
        
        if (studentId) {
            loadStudentData();
        } else {
            // Find student by email
            const studentSnap = await database.ref('students')
                .orderByChild('email')
                .equalTo(user.email)
                .once('value');
            
            if (studentSnap.exists()) {
                const studentData = studentSnap.val();
                studentId = Object.keys(studentData)[0];
                
                // Update user record with studentId
                await database.ref('users/' + userId).update({
                    studentId: studentId
                });
                
                loadStudentData();
            } else {
                window.location.href = 'index.html';
            }
        }
    });
}

// Load student data
function loadStudentData() {
    if (!studentId) return;
    
    // Load student information
    database.ref('students/' + studentId).on('value', async (snapshot) => {
        if (!snapshot.exists()) {
            window.location.href = 'index.html';
            return;
        }
        
        studentData = snapshot.val();
        
        // Update profile information
        document.getElementById('student-name').textContent = studentData.name;
        document.getElementById('profile-name').textContent = studentData.name;
        document.getElementById('profile-email').textContent = studentData.email;
        document.getElementById('profile-lrn').textContent = studentData.lrn || 'N/A';
        document.getElementById('profile-age').textContent = studentData.age || 'N/A';
        document.getElementById('profile-gender').textContent = studentData.gender || 'N/A';
        document.getElementById('profile-birthdate').textContent = studentData.birthDate || 'N/A';
        document.getElementById('profile-class').textContent = 'Class: ' + (studentData.class || 'N/A');
        document.getElementById('student-class').textContent = 'Class: ' + (studentData.class || 'N/A');
        document.getElementById('profile-parent').textContent = studentData.parentContact || 'N/A';
        
        // Get teacher name
        if (studentData.teacherId) {
            const teacherSnap = await database.ref('teachers/' + studentData.teacherId).once('value');
            if (teacherSnap.exists()) {
                document.getElementById('profile-teacher').textContent = teacherSnap.val().name;
            }
        }
        
        // Update barcode information
        document.getElementById('barcode-name').textContent = studentData.name;
        document.getElementById('barcode-class').textContent = 'Class: ' + (studentData.class || 'N/A');
        document.getElementById('barcode-id').textContent = studentData.barcodeId || 'N/A';
        document.getElementById('barcode-lrn').textContent = studentData.lrn || 'N/A';
        
        if (studentData.qrCode) {
            document.getElementById('barcode-image').src = studentData.qrCode;
        } else if (studentData.barcodeId) {
            const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(studentData.barcodeId)}`;
            document.getElementById('barcode-image').src = qrCodeUrl;
        }
        
        // Update pill counter
        updatePillCounter();
        
        // Load claims
        loadMyClaims();
    });
}

// Update pill counter
function updatePillCounter() {
    if (!studentData) return;
    
    const pillsLeft = studentData.pillsLeft || 5;
    
    // Update pill counter text
    document.getElementById('pills-remaining').textContent = `${pillsLeft}/5`;
    
    // Update visual pills
    const pillVisual = document.getElementById('pill-visual');
    pillVisual.innerHTML = '';
    
    for (let i = 0; i < 5; i++) {
        const pill = document.createElement('div');
        pill.className = 'pill';
        
        if (i < pillsLeft) {
            pill.classList.add('pill-available');
            pill.innerHTML = '💊';
        } else {
            pill.classList.add('pill-used');
            pill.innerHTML = '💊';
        }
        
        pillVisual.appendChild(pill);
    }
    
    // Update last claim
    if (studentData.lastClaim) {
        const lastClaimDate = new Date(studentData.lastClaim);
        document.getElementById('last-claim').textContent = lastClaimDate.toLocaleString();
    }
}

// Load student's claims
function loadMyClaims() {
    if (!studentId) return;
    
    const claimsList = document.getElementById('my-claims-list');
    
    database.ref('claims').orderByChild('studentId').equalTo(studentId)
        .on('value', (snapshot) => {
            if (!snapshot.exists()) {
                claimsList.innerHTML = '<div class="table-row"><div colspan="3">No claims yet.</div></div>';
                document.getElementById('total-claims').textContent = '0 claims';
                document.getElementById('month-claims').textContent = '0 claims';
                return;
            }
            
            let html = '';
            let totalClaims = 0;
            let monthClaims = 0;
            const currentMonth = new Date().getMonth();
            
            snapshot.forEach((child) => {
                const claim = child.val();
                totalClaims++;
                
                // Check if claim is from this month
                const claimDate = new Date(claim.timestamp);
                if (claimDate.getMonth() === currentMonth) {
                    monthClaims++;
                }
                
                html += `
                    <div class="table-row">
                        <div>${new Date(claim.timestamp).toLocaleString()}</div>
                        <div>${(claim.pillsBefore || claim.pillsLeft + 1) || 5}</div>
                        <div>${claim.pillsLeft || 0}</div>
                    </div>
                `;
            });
            
            claimsList.innerHTML = html;
            document.getElementById('total-claims').textContent = `${totalClaims} claims`;
            document.getElementById('month-claims').textContent = `${monthClaims} claims`;
        });
}

// Print barcode
function printBarcode() {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>Print Barcode</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                .barcode-print { text-align: center; }
                .barcode-print img { max-width: 300px; }
                .student-info { margin: 20px 0; }
                @media print { 
                    button { display: none; } 
                    body { padding: 0; }
                }
            </style>
        </head>
        <body>
            <div class="barcode-print">
                <h2>Vendocine Medication Barcode</h2>
                <div class="student-info">
                    <h3>${studentData.name}</h3>
                    <p>Class: ${studentData.class || 'N/A'}</p>
                    <p>Barcode ID: ${studentData.barcodeId || 'N/A'}</p>
                    <p>LRN: ${studentData.lrn || 'N/A'}</p>
                </div>
                <img src="${document.getElementById('barcode-image').src}" alt="Barcode">
                <p><em>Scan this barcode to claim medication</em></p>
                <button onclick="window.print()">Print</button>
                <button onclick="window.close()">Close</button>
            </div>
        </body>
        </html>
    `);
    printWindow.document.close();
}

// Download barcode
function downloadBarcode() {
    const link = document.createElement('a');
    link.href = document.getElementById('barcode-image').src;
    link.download = `barcode-${studentData.barcodeId || 'student'}.png`;
    link.click();
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
        'my-profile': 'My Profile',
        'my-claims': 'My Claims',
        'my-barcode': 'My Barcode'
    };
    
    document.getElementById('page-title').textContent = titles[sectionId] || 'Student Dashboard';
}

// Logout function
function logout() {
    auth.signOut().then(() => {
        window.location.href = 'index.html';
    });
}