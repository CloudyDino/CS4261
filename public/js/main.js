console.log("You think you're a hacker? Turn on dark mode by calling `localStorage.setItem(\"theme\", \"dark\")` without the backticks.");

if (localStorage.getItem("theme") == "dark") {
    document.body.classList.add("dark-theme");
}
