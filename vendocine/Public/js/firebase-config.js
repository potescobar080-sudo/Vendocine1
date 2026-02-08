// Your Firebase Configuration - REPLACE WITH YOUR VALUES
const firebaseConfig = {
    apiKey: "AIzaSyD8szi7sjMY7yk0DUYIAV179t6jG3Pvsa0",
    authDomain: "vndocinevsc.firebaseapp.com",
    databaseURL: "https://vndocinevsc-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "vndocinevsc",
    storageBucket: "vndocinevsc.firebasestorage.app",
    messagingSenderId: "875557641698",
    appId: "1:875557641698:web:bbb95fd4d223d63242adbb"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();