// Authentication Functions
let currentUser = null;

// Check if user is already logged in
auth.onAuthStateChanged(handleAuthStateChange);

// Handle authentication state
async function handleAuthStateChange(user) {
    if (user) {
        console.log("User is logged in:", user.email);
        currentUser = user;
        
        // Check user role and redirect
        await checkUserRoleAndRedirect(user);
        
    } else {
        console.log("No user logged in");
        // Show login form
        showLoginForm();
    }
}

// Login with email/password (SIMPLIFIED)
async function loginWithEmail() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    if (!email || !password) {
        showMessage('Please enter email and password', 'error');
        return;
    }
    
    showMessage('Logging in...', 'info');
    
    try {
        // Try to sign in
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        console.log("Login successful:", userCredential.user.email);
        
        // The auth state change handler will handle redirect
        
    } catch (error) {
        console.error("Login error:", error.code, error.message);
        
        if (error.code === 'auth/invalid-login-credentials') {
            // User doesn't exist - try to create account
            try {
                await auth.createUserWithEmailAndPassword(email, password);
                showMessage('Account created! Please login again.', 'success');
                
                // Logout and ask to login again
                setTimeout(() => {
                    auth.signOut();
                    showMessage('Please login with your new account', 'info');
                }, 2000);
                
            } catch (createError) {
                showMessage('Cannot create account: ' + createError.message, 'error');
            }
            
        } else if (error.code === 'auth/user-not-found') {
            showMessage('Account not found. Please contact administrator.', 'error');
            
        } else if (error.code === 'auth/wrong-password') {
            showMessage('Incorrect password. Please try again.', 'error');
            
        } else {
            showMessage('Login failed: ' + error.message, 'error');
        }
    }
}

// Login with Google
async function loginWithGoogle() {
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        const result = await auth.signInWithPopup(provider);
        console.log("Google login successful:", result.user.email);
        
    } catch (error) {
        console.error("Google login error:", error);
        showMessage('Google login failed: ' + error.message, 'error');
    }
}

// Check user role and redirect
async function checkUserRoleAndRedirect(user) {
    try {
        // Check if user exists in database
        const userSnapshot = await database.ref('users')
            .orderByChild('email')
            .equalTo(user.email)
            .once('value');
        
        if (userSnapshot.exists()) {
            // User exists in database
            const userData = userSnapshot.val();
            const userId = Object.keys(userData)[0];
            const userInfo = userData[userId];
            
            // Update last login
            await database.ref('users/' + userId).update({
                lastLogin: Date.now(),
                uid: user.uid
            });
            
            // Redirect based on role
            redirectBasedOnRole(userInfo.role);
            
        } else {
            // User not in database - check if admin
            if (user.email === 'admin@vendocine.com') {
                // Create admin account in database
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
                
                redirectBasedOnRole('admin');
                
            } else {
                // Check if student by email
                const studentSnapshot = await database.ref('students')
                    .orderByChild('email')
                    .equalTo(user.email)
                    .once('value');
                
                if (studentSnapshot.exists()) {
                    // Student exists, create user record
                    const studentData = studentSnapshot.val();
                    const studentId = Object.keys(studentData)[0];
                    
                    const userRef = database.ref('users').push();
                    await userRef.set({
                        uid: user.uid,
                        email: user.email,
                        role: 'student',
                        studentId: studentId,
                        createdAt: Date.now(),
                        lastLogin: Date.now(),
                        status: 'active'
                    });
                    
                    redirectBasedOnRole('student');
                    
                } else {
                    // Not registered
                    await auth.signOut();
                    showMessage('Account not registered. Please contact administrator.', 'error');
                }
            }
        }
        
    } catch (error) {
        console.error('Role check error:', error);
        showMessage('Authentication error. Please try again.', 'error');
        await auth.signOut();
    }
}

// Redirect based on role
function redirectBasedOnRole(role) {
    console.log("Redirecting based on role:", role);
    
    switch(role) {
        case 'admin':
            window.location.href = 'admin-dashboard.html';
            break;
        case 'teacher':
            window.location.href = 'teacher-dashboard.html';
            break;
        case 'student':
            window.location.href = 'student-dashboard.html';
            break;
        default:
            showMessage('Unknown user role. Please contact administrator.', 'error');
            auth.signOut();
    }
}

// Show login form (for when user logs out)
function showLoginForm() {
    // This function would show login form if we had hidden it
    console.log("Showing login form");
}

// Show message to user
function showMessage(text, type = 'info') {
    const messageDiv = document.getElementById('login-message');
    if (!messageDiv) {
        // Create message div if it doesn't exist
        const newDiv = document.createElement('div');
        newDiv.id = 'login-message';
        newDiv.className = 'message ' + type;
        newDiv.textContent = text;
        newDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 5px;
            color: white;
            z-index: 1000;
            background: ${type === 'error' ? '#f44336' : 
                        type === 'success' ? '#4CAF50' : '#2196F3'};
        `;
        document.body.appendChild(newDiv);
        
        // Remove after 5 seconds
        setTimeout(() => {
            document.body.removeChild(newDiv);
        }, 5000);
        
        return;
    }
    
    messageDiv.textContent = text;
    messageDiv.className = 'message ' + type;
    messageDiv.style.display = 'block';
    
    setTimeout(() => {
        messageDiv.style.display = 'none';
    }, 5000);
}

// Logout function
function logout() {
    auth.signOut().then(() => {
        window.location.href = 'index.html';
    });
}