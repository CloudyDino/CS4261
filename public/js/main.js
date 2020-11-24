document.addEventListener('DOMContentLoaded', function () {
    console.log("You think you're a hacker? Turn on dark mode by calling `localStorage.setItem(\"theme\", \"dark\")` without the backticks.");

    if (localStorage.getItem("theme") == "dark") {
        document.body.classList.add("dark-theme");
    }
});

function login() {
    firebase.auth()
        .signInWithPopup(new firebase.auth.GoogleAuthProvider())
        .then(function (result) {
            window.location.href = 'dashboard.html';
        }).catch((error) => {
            console.error(`Error ${error.code}: ${error.message}`);
            alert(error.message);
        });
}

function logout() {
    firebase.auth().signOut()
        .then(function () {
            window.location.href = 'index.html';
        })
        .catch(error => {
            console.log(error);
            alert("Logout was unsuccessful");
        });
}
